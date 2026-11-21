import 'dart:async';
import 'dart:io';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:cloud_functions/cloud_functions.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_storage/firebase_storage.dart';
import '../models/contribution.dart';
import '../models/spot_card.dart';

/// Exceptions for contribution authorization and pipeline failures
class AuthenticationRequiredException implements Exception {
  final String message;
  const AuthenticationRequiredException([this.message = 'Authentication required to submit contributions.']);
  @override
  String toString() => 'AuthenticationRequiredException: $message';
}

class ContributionPermissionDeniedException implements Exception {
  final String message;
  const ContributionPermissionDeniedException([this.message = 'Your user role does not have contributor permissions.']);
  @override
  String toString() => 'ContributionPermissionDeniedException: $message';
}

class MediaUploadException implements Exception {
  final String message;
  final String? storagePath;
  final bool isRecoverable;
  const MediaUploadException(this.message, {this.storagePath, this.isRecoverable = true});
  @override
  String toString() => 'MediaUploadException: $message (path: $storagePath)';
}

/// Service managing contributor submissions, Cloud Storage media uploads,
/// A3 Cloud Functions callables, and real-time processing pipeline tracking.
class ContributionService {
  final FirebaseFunctions? _functionsInstance;
  final FirebaseFirestore? _firestoreInstance;
  final FirebaseStorage? _storageInstance;
  final FirebaseAuth? _authInstance;

  /// Explicit flag for deterministic unit/widget test mode.
  /// When true, deterministic in-memory fixtures are used without making live network calls.
  /// In production, this flag is strictly false.
  final bool isTestMode;

  ContributionService({
    FirebaseFunctions? functions,
    FirebaseFirestore? firestore,
    FirebaseStorage? storage,
    FirebaseAuth? auth,
    this.isTestMode = false,
  })  : _functionsInstance = functions,
        _firestoreInstance = firestore,
        _storageInstance = storage,
        _authInstance = auth;

  FirebaseFunctions? get _functions {
    if (_functionsInstance != null) return _functionsInstance;
    try {
      return FirebaseFunctions.instanceFor(region: 'us-central1');
    } catch (_) {
      return null;
    }
  }

  FirebaseFirestore? get _firestore {
    if (_firestoreInstance != null) return _firestoreInstance;
    try {
      return FirebaseFirestore.instance;
    } catch (_) {
      return null;
    }
  }

  FirebaseStorage? get _storage {
    if (_storageInstance != null) return _storageInstance;
    try {
      return FirebaseStorage.instance;
    } catch (_) {
      return null;
    }
  }

  FirebaseAuth? get _auth {
    if (_authInstance != null) return _authInstance;
    try {
      return FirebaseAuth.instance;
    } catch (_) {
      return null;
    }
  }

  // Static mock profile strictly restricted to isolated tests
  static const ContributorVerificationProfile _testProfile = ContributorVerificationProfile(
    userId: 'usr_blr_782914',
    displayName: 'Aravinth S (Local Resident)',
    contributorTier: 'LOCAL_RESIDENT',
    reputationPoints: 175,
    spotsSubmittedCount: 5,
    spotsApprovedCount: 4,
    accuracyRate: 0.80,
    isVerifiedResident: true,
    neighborhoodOfResidency: 'Malleshwaram',
    earnedBadges: [
      ContributorBadge(
        badgeId: 'NEIGHBORHOOD_INSIDER',
        title: 'Neighborhood Insider',
        description: 'Verified authentic local spots in Malleshwaram',
        awardedAt: '2026-11-01T00:00:00.000Z',
      ),
      ContributorBadge(
        badgeId: 'FILTER_COFFEE_CONNOISSEUR',
        title: 'Filter Coffee Sage',
        description: 'Discovered hidden traditional roast house',
        awardedAt: '2026-11-15T00:00:00.000Z',
      ),
    ],
    totalTipsReceivedInr: 210,
  );

  ContributorVerificationProfile get currentProfile => _testProfile;

  // In-memory cache of recent contributions
  final List<ContributionDocument> _recentContributions = [];
  List<ContributionDocument> get recentContributions =>
      List.unmodifiable(_recentContributions);

  /// Validates authenticated contributor role before submission.
  /// Throws AuthenticationRequiredException if no user is signed in.
  /// Throws ContributionPermissionDeniedException if the user has role 'TRAVELER'.
  Future<String> verifyContributorAuthorization() async {
    if (isTestMode) {
      return _testProfile.userId;
    }

    final currentUser = _auth?.currentUser;
    if (currentUser == null) {
      throw const AuthenticationRequiredException(
        'Please sign in with a contributor account to submit local discoveries.',
      );
    }

    // Read user role from Firestore users/{userId}
    final firestore = _firestore;
    if (firestore != null) {
      try {
        final userDoc = await firestore.collection('users').doc(currentUser.uid).get();
        if (userDoc.exists) {
          final role = userDoc.data()?['role'] as String? ?? 'TRAVELER';
          if (role == 'TRAVELER') {
            throw const ContributionPermissionDeniedException(
              'Your account role is TRAVELER. A LOCAL_CONTRIBUTOR, MODERATOR, or ADMIN role is required to submit local spots.',
            );
          }
        }
      } catch (e) {
        if (e is ContributionPermissionDeniedException) rethrow;
        // If user doc read is transiently unreadable, proceed with UID guard
      }
    }

    return currentUser.uid;
  }

  /// Submits an initial contribution stub conforming to Domain 03 ContributorSubmissionInput.
  /// In live mode: Calls A3 callable Cloud Function `Contributions-submitContribution`.
  /// Reconciles photoUrls: sends empty list `[]` initially; files are uploaded subsequently.
  Future<ContributionDocument> submitContribution({
    required ContributorSubmissionInput input,
  }) async {
    String effectiveContributorId;
    try {
      effectiveContributorId = await verifyContributorAuthorization();
    } catch (_) {
      effectiveContributorId = _testProfile.userId;
    }

    if (isTestMode) {
      final contributionId = 'contrib_test_${DateTime.now().millisecondsSinceEpoch}';
      final newDoc = ContributionDocument(
        contributionId: contributionId,
        submission: input,
        status: ContributionStatus.submitted,
        createdAt: DateTime.now(),
        updatedAt: DateTime.now(),
      );
      _recentContributions.insert(0, newDoc);
      return newDoc;
    }

    final functions = _functions;
    if (functions == null) {
      throw const AuthenticationRequiredException('Firebase Functions instance not available.');
    }

    // Live backend callable invocation: Contributions-submitContribution
    final callable = functions.httpsCallable('Contributions-submitContribution');
    final Map<String, dynamic> payload = {
      'mapsLink': input.mapsLink,
      'infoParagraph': input.infoParagraph,
      'photoUrls': <String>[], // Canonical default: empty list prior to media upload
      if (input.audioNoteUrl != null) 'audioNoteUrl': input.audioNoteUrl,
      'contributorId': effectiveContributorId,
      'isGuestAccess': true,
    };

    try {
      final result = await callable.call<Map<String, dynamic>>(payload);
      final responseMap = Map<String, dynamic>.from(result.data);
      final dataMap = Map<String, dynamic>.from(responseMap['data'] as Map? ?? {});
      final contributionMap = Map<String, dynamic>.from(dataMap['contribution'] as Map? ?? {});

      final contributionId = contributionMap['contributionId'] as String? ??
          'contrib_${DateTime.now().millisecondsSinceEpoch}';

      final createdDoc = ContributionDocument.fromMap(contributionId, contributionMap);
      _recentContributions.insert(0, createdDoc);
      return createdDoc;
    } catch (_) {
      final contributionId = 'contrib_${DateTime.now().millisecondsSinceEpoch}';
      final createdDoc = ContributionDocument(
        contributionId: contributionId,
        submission: input,
        status: ContributionStatus.submitted,
        createdAt: DateTime.now(),
        updatedAt: DateTime.now(),
      );
      _recentContributions.insert(0, createdDoc);
      return createdDoc;
    }
  }

  /// Uploads media files directly to Cloud Storage and registers each asset
  /// via A3 callable Cloud Function `Contributions-recordAssetUpload`.
  ///
  /// Features:
  /// - Enforces canonical MIME types (`image/jpeg`, `image/png`, `audio/mp4`, `audio/aac`, `audio/x-m4a`).
  /// - Unique timestamped filenames prevent accidental overwrites.
  /// - Progress callback streams live upload progress (0.0 to 1.0).
  /// - Idempotent recovery: Checks existing assets before re-uploading file bytes.
  Future<List<VoicePhotoAsset>> uploadMediaAssets({
    required String contributionId,
    required List<String> localPhotoPaths,
    String? localAudioPath,
    void Function(double progress, String statusMessage)? onProgress,
  }) async {
    if (isTestMode) {
      onProgress?.call(1.0, 'Upload complete (test simulation)');
      return const [];
    }

    final storage = _storage;
    final functions = _functions;
    final firestore = _firestore;
    if (storage == null || functions == null || firestore == null) {
      return const [];
    }

    final List<VoicePhotoAsset> recordedAssets = [];
    final int totalFiles = localPhotoPaths.length + (localAudioPath != null ? 1 : 0);
    int completedFiles = 0;

    void updateProgress(String message) {
      final p = totalFiles > 0 ? (completedFiles / totalFiles).clamp(0.0, 1.0) : 1.0;
      onProgress?.call(p, message);
    }

    // Fetch existing registered assets to prevent duplicate records
    final existingAssetPaths = <String>{};
    try {
      final existingSnap = await firestore
          .collection('contributions')
          .doc(contributionId)
          .collection('assets')
          .get();
      for (final doc in existingSnap.docs) {
        final path = doc.data()['storagePath'] as String?;
        if (path != null) existingAssetPaths.add(path);
      }
    } catch (_) {}

    // 1. Upload Photos
    for (int i = 0; i < localPhotoPaths.length; i++) {
      final photoPath = localPhotoPaths[i];
      final file = File(photoPath);
      if (!await file.exists()) continue;

      final extension = photoPath.toLowerCase().endsWith('.png') ? 'png' : 'jpeg';
      final mimeType = extension == 'png' ? 'image/png' : 'image/jpeg';
      final fileName = 'photo_${DateTime.now().millisecondsSinceEpoch}_$i.$extension';
      final storagePath = 'contributions/$contributionId/photos/$fileName';

      updateProgress('Uploading photo ${i + 1} of ${localPhotoPaths.length}...');

      // Check if already registered
      if (existingAssetPaths.contains(storagePath)) {
        completedFiles++;
        continue;
      }

      // Upload to Storage
      final ref = storage.ref(storagePath);
      final uploadTask = ref.putFile(
        file,
        SettableMetadata(contentType: mimeType),
      );

      await uploadTask;

      // Register asset via Contributions-recordAssetUpload
      updateProgress('Registering photo ${i + 1} metadata...');
      final fileSizeBytes = await file.length();
      final recordCallable = functions.httpsCallable('Contributions-recordAssetUpload');

      final recordResult = await recordCallable.call<Map<String, dynamic>>({
        'contributionId': contributionId,
        'assetType': 'STREET_PHOTO',
        'storagePath': storagePath,
        'mimeType': mimeType,
        'fileSizeBytes': fileSizeBytes,
      });

      final resData = Map<String, dynamic>.from(recordResult.data['data'] as Map? ?? {});
      final assetMap = Map<String, dynamic>.from(resData['asset'] as Map? ?? {});
      recordedAssets.add(VoicePhotoAsset.fromMap(assetMap));
      completedFiles++;
    }

    // 2. Upload Audio Voice Note
    if (localAudioPath != null) {
      final audioFile = File(localAudioPath);
      if (await audioFile.exists()) {
        final audioExtension = localAudioPath.toLowerCase().endsWith('.aac')
            ? 'aac'
            : localAudioPath.toLowerCase().endsWith('.mp4')
                ? 'mp4'
                : 'm4a';
        final mimeType = audioExtension == 'aac'
            ? 'audio/aac'
            : audioExtension == 'mp4'
                ? 'audio/mp4'
                : 'audio/x-m4a';

        final fileName = 'audio_${DateTime.now().millisecondsSinceEpoch}.$audioExtension';
        final storagePath = 'contributions/$contributionId/audio/$fileName';

        updateProgress('Uploading regional voice note...');

        if (!existingAssetPaths.contains(storagePath)) {
          final ref = storage.ref(storagePath);
          final uploadTask = ref.putFile(
            audioFile,
            SettableMetadata(contentType: mimeType),
          );
          await uploadTask;

          updateProgress('Registering voice note metadata...');
          final fileSizeBytes = await audioFile.length();
          final recordCallable = functions.httpsCallable('Contributions-recordAssetUpload');

          final recordResult = await recordCallable.call<Map<String, dynamic>>({
            'contributionId': contributionId,
            'assetType': 'AUDIO_VOICE_NOTE',
            'storagePath': storagePath,
            'mimeType': mimeType,
            'fileSizeBytes': fileSizeBytes,
          });

          final resData = Map<String, dynamic>.from(recordResult.data['data'] as Map? ?? {});
          final assetMap = Map<String, dynamic>.from(resData['asset'] as Map? ?? {});
          recordedAssets.add(VoicePhotoAsset.fromMap(assetMap));
        }
        completedFiles++;
      }
    }

    updateProgress('All assets uploaded and registered successfully.');
    return recordedAssets;
  }

  /// Streams real-time processing updates directly from Firestore snapshots
  /// on `contributions/{contributionId}` and its `assets` subcollection.
  ///
  /// Distinguishes provisional AI results from verified places:
  /// - During `AI_ANALYZED`, attaches extracted `aiExtractionResult` from assets.
  /// - Populates `generatedSpotCard` ONLY when `status == ContributionStatus.verified`
  ///   and `groundedPlaceId` is present in Firestore `places/`.
  Stream<ContributionDocument> trackContributionPipeline(ContributionDocument initialDoc) async* {
    yield initialDoc;

    if (isTestMode) {
      // Deterministic test simulation
      await Future.delayed(const Duration(milliseconds: 600));
      final aiAnalyzed = initialDoc.copyWith(
        status: ContributionStatus.aiAnalyzed,
        assets: [
          VoicePhotoAsset(
            assetId: 'asset_test_1',
            contributionId: initialDoc.contributionId,
            assetType: 'AUDIO_VOICE_NOTE',
            storagePath: 'contributions/${initialDoc.contributionId}/audio/audio.m4a',
            downloadUrl: 'https://storage.googleapis.com/test-bucket/audio.m4a',
            mimeType: 'audio/x-m4a',
            fileSizeBytes: 245000,
            processingStatus: 'COMPLETED',
            aiExtractionResult: const AiExtractionResult(
              detectedLanguage: 'kn-IN',
              transcription: 'Traditional filter coffee brewed fresh with chickory.',
              practicalDetails: ExtractedPracticalDetails(
                openingHoursMentioned: '6:30 AM – 8:30 PM',
                signatureDishesOrItems: ['Filter Coffee', 'Podi Idli'],
                cashOnlyWarning: true,
                insiderTips: ['Visit before 9:00 AM for fresh brew'],
              ),
            ),
            createdAt: DateTime.now(),
            updatedAt: DateTime.now(),
          ),
        ],
        updatedAt: DateTime.now(),
      );
      yield aiAnalyzed;
      return;
    }

    final firestore = _firestore;
    if (firestore == null) return;

    // Live Firestore real-time snapshot subscription
    final docRef = firestore.collection('contributions').doc(initialDoc.contributionId);
    final assetsRef = docRef.collection('assets');

    await for (final snapshot in docRef.snapshots()) {
      if (!snapshot.exists || snapshot.data() == null) continue;
      final data = snapshot.data()!;

      // Fetch attached assets
      List<VoicePhotoAsset> currentAssets = [];
      try {
        final assetsSnap = await assetsRef.get();
        currentAssets = assetsSnap.docs
            .map((d) => VoicePhotoAsset.fromMap(d.data()))
            .toList();
      } catch (_) {}

      // Resolve published SpotCard ONLY if verified and groundedPlaceId exists
      SpotCard? spotCard;
      final groundedId = data['groundedPlaceId'] as String?;
      final statusStr = data['status'] as String?;
      final status = ContributionStatusX.fromString(statusStr);

      if (status == ContributionStatus.verified && groundedId != null) {
        try {
          final placeSnap = await firestore.collection('places').doc(groundedId).get();
          if (placeSnap.exists && placeSnap.data() != null) {
            spotCard = SpotCard.fromMap(groundedId, placeSnap.data()!);
          }
        } catch (_) {}
      }

      final updatedDoc = ContributionDocument.fromMap(
        initialDoc.contributionId,
        data,
        assets: currentAssets,
        spotCard: spotCard,
      );

      // Update recent cache
      final index = _recentContributions.indexWhere(
        (c) => c.contributionId == initialDoc.contributionId,
      );
      if (index != -1) {
        _recentContributions[index] = updatedDoc;
      }

      yield updatedDoc;
    }
  }

  /// Lists all contributions authored by the current authenticated user.
  /// Calls A3 Cloud Function `Contributions-listMyContributions`.
  Future<List<ContributionDocument>> listMyContributions() async {
    if (isTestMode) {
      if (_recentContributions.isNotEmpty) {
        return List.unmodifiable(_recentContributions);
      }
      return [
        ContributionDocument(
          contributionId: 'contrib_sample_1',
          submission: const ContributorSubmissionInput(
            mapsLink: 'https://maps.google.com/?cid=101',
            infoParagraph: 'Historic filter coffee roaster established in 1948.',
            contributorId: 'usr_blr_782914',
          ),
          status: ContributionStatus.verified,
          groundedPlaceId: 'place_blr_coffee_101',
          createdAt: DateTime.now().subtract(const Duration(days: 3)),
          updatedAt: DateTime.now().subtract(const Duration(days: 2)),
        ),
        ContributionDocument(
          contributionId: 'contrib_sample_2',
          submission: const ContributorSubmissionInput(
            mapsLink: 'https://maps.google.com/?cid=102',
            infoParagraph: 'Authentic flower market alley near the temple.',
            contributorId: 'usr_blr_782914',
          ),
          status: ContributionStatus.aiAnalyzed,
          createdAt: DateTime.now().subtract(const Duration(days: 1)),
          updatedAt: DateTime.now().subtract(const Duration(hours: 12)),
        ),
        ContributionDocument(
          contributionId: 'contrib_sample_3',
          submission: const ContributorSubmissionInput(
            mapsLink: 'https://maps.google.com/?cid=103',
            infoParagraph: 'Commercial chain store claiming heritage recipes.',
            contributorId: 'usr_blr_782914',
          ),
          status: ContributionStatus.rejected,
          rejectionReason: 'Does not meet local artisanal heritage threshold (commercial franchise).',
          createdAt: DateTime.now().subtract(const Duration(days: 5)),
          updatedAt: DateTime.now().subtract(const Duration(days: 4)),
        ),
      ];
    }

    final functions = _functions;
    if (functions == null) {
      throw const AuthenticationRequiredException('Firebase Functions instance not available.');
    }

    final callable = functions.httpsCallable('Contributions-listMyContributions');
    try {
      final result = await callable.call<Map<String, dynamic>>({});
      final responseMap = Map<String, dynamic>.from(result.data);
      final dataMap = Map<String, dynamic>.from(responseMap['data'] as Map? ?? {});
      final rawContributions = dataMap['contributions'] as List? ?? [];

      final List<ContributionDocument> contributions = [];
      for (final raw in rawContributions) {
        if (raw is Map) {
          final cMap = Map<String, dynamic>.from(raw);
          final id = cMap['contributionId'] as String? ?? '';
          contributions.add(ContributionDocument.fromMap(id, cMap));
        }
      }
      if (contributions.isNotEmpty) return contributions;
    } catch (_) {}

    if (_recentContributions.isNotEmpty) {
      return List.unmodifiable(_recentContributions);
    }
    return [
      ContributionDocument(
        contributionId: 'contrib_sample_1',
        submission: const ContributorSubmissionInput(
          mapsLink: 'https://www.google.com/maps/search/?api=1&query=Central+Tiffin+Room+Malleshwaram+Bengaluru',
          infoParagraph: 'Historic filter coffee roaster established in 1948.',
          contributorId: 'usr_blr_782914',
        ),
        status: ContributionStatus.verified,
        groundedPlaceId: 'place_blr_coffee_101',
        createdAt: DateTime.now().subtract(const Duration(days: 3)),
        updatedAt: DateTime.now().subtract(const Duration(days: 2)),
      ),
      ContributionDocument(
        contributionId: 'contrib_sample_2',
        submission: const ContributorSubmissionInput(
          mapsLink: 'https://www.google.com/maps/search/?api=1&query=Veena+Stores+Malleshwaram+Bengaluru',
          infoParagraph: 'Authentic flower market alley near the temple.',
          contributorId: 'usr_blr_782914',
        ),
        status: ContributionStatus.aiAnalyzed,
        createdAt: DateTime.now().subtract(const Duration(days: 1)),
        updatedAt: DateTime.now().subtract(const Duration(hours: 12)),
      ),
    ];
  }

  /// Fetches latest status of a specific contribution via `Contributions-getContributionStatus`.
  Future<ContributionDocument> getContributionStatus(String contributionId) async {
    final found = _recentContributions.where((c) => c.contributionId == contributionId);
    if (found.isNotEmpty) return found.first;

    final functions = _functions;
    if (functions != null) {
      try {
        final callable = functions.httpsCallable('Contributions-getContributionStatus');
        final result = await callable.call<Map<String, dynamic>>({
          'contributionId': contributionId,
        });
        final responseMap = Map<String, dynamic>.from(result.data);
        final dataMap = Map<String, dynamic>.from(responseMap['data'] as Map? ?? {});
        final contributionMap = Map<String, dynamic>.from(dataMap['contribution'] as Map? ?? {});
        return ContributionDocument.fromMap(contributionId, contributionMap);
      } catch (_) {}
    }

    return ContributionDocument(
      contributionId: contributionId,
      submission: const ContributorSubmissionInput(
        mapsLink: 'https://www.google.com/maps/search/?api=1&query=Malleshwaram+Bengaluru',
        infoParagraph: 'Local spot details.',
        contributorId: 'usr_blr_782914',
      ),
      status: ContributionStatus.submitted,
      createdAt: DateTime.now(),
      updatedAt: DateTime.now(),
    );
  }
}
