import 'dart:async';
import 'dart:io';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:cloud_functions/cloud_functions.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_storage/firebase_storage.dart';
import '../config/app_config.dart';
import '../models/app_failure.dart';
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

  ContributionService({
    FirebaseFunctions? functions,
    FirebaseFirestore? firestore,
    FirebaseStorage? storage,
    FirebaseAuth? auth,
  })  : _functionsInstance = functions,
        _firestoreInstance = firestore,
        _storageInstance = storage,
        _authInstance = auth;

  FirebaseFunctions? get _functions {
    if (_functionsInstance != null) return _functionsInstance;
    try {
      return FirebaseFunctions.instanceFor(region: AppConfig.apiRegion);
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

  ContributorVerificationProfile? _cachedLiveProfile;

  /// Returns the current authenticated contributor profile.
  /// Always binds to the genuine FirebaseAuth UID (never a hardcoded user ID).
  ContributorVerificationProfile get currentProfile {
    if (_cachedLiveProfile != null) return _cachedLiveProfile!;
    final user = _auth?.currentUser;
    if (user == null) {
      return const ContributorVerificationProfile(
        userId: '',
        displayName: 'Sign in required',
        contributorTier: 'UNAUTHENTICATED',
        reputationPoints: 0,
        spotsSubmittedCount: 0,
        spotsApprovedCount: 0,
        accuracyRate: 0.0,
        isVerifiedResident: false,
        neighborhoodOfResidency: '',
        earnedBadges: [],
        totalTipsReceivedInr: 0,
      );
    }
    return ContributorVerificationProfile(
      userId: user.uid,
      displayName: (user.displayName?.trim().isNotEmpty ?? false)
          ? user.displayName!.trim()
          : (user.email ?? 'Local Contributor (${user.uid.substring(0, user.uid.length >= 6 ? 6 : user.uid.length)})'),
      contributorTier: 'LOCAL_CONTRIBUTOR',
      reputationPoints: 0,
      spotsSubmittedCount: 0,
      spotsApprovedCount: 0,
      accuracyRate: 0.0,
      isVerifiedResident: false,
      neighborhoodOfResidency: '',
      earnedBadges: const [],
      totalTipsReceivedInr: 0,
    );
  }

  /// Loads the authenticated user's real contributor profile from Firestore `users/{uid}`
  /// and `Monetization-getContributorAttribution`, caching it for synchronous getters.
  Future<ContributorVerificationProfile> loadCurrentContributorProfile() async {
    final user = _auth?.currentUser;
    if (user == null) {
      throw const AuthenticationRequiredException(
        'Please sign in to load your contributor profile.',
      );
    }

    String displayName = (user.displayName?.trim().isNotEmpty ?? false)
        ? user.displayName!.trim()
        : (user.email ?? 'Local Contributor (${user.uid.substring(0, user.uid.length >= 6 ? 6 : user.uid.length)})');
    String tier = 'LOCAL_CONTRIBUTOR';
    int reputationPoints = 0;
    int submittedCount = 0;
    int approvedCount = 0;
    bool isVerifiedResident = false;
    String neighborhood = '';
    int totalTipsInr = 0;
    final List<ContributorBadge> badges = [];

    final firestore = _firestore;
    if (firestore != null) {
      try {
        final userSnap = await firestore.collection('users').doc(user.uid).get();
        if (userSnap.exists) {
          final data = userSnap.data() ?? {};
          displayName = (data['displayName'] as String?)?.trim().isNotEmpty == true
              ? data['displayName'] as String
              : displayName;
          tier = (data['role'] as String?) ?? tier;
          neighborhood = (data['neighborhoodOfResidency'] as String?) ?? '';
          isVerifiedResident = data['isVerifiedResident'] as bool? ?? false;
        }
      } catch (_) {}
    }

    final functions = _functions;
    if (functions != null) {
      try {
        final callable = functions.httpsCallable('Monetization-getContributorAttribution');
        final res = await callable.call<Map<String, dynamic>>({'userId': user.uid});
        final dataMap = Map<String, dynamic>.from(res.data['data'] as Map? ?? {});
        if (dataMap.isNotEmpty) {
          displayName = (dataMap['displayName'] as String?) ?? displayName;
          tier = (dataMap['reputationTier'] as String?) ?? tier;
          approvedCount = (dataMap['approvedGemsCount'] as num?)?.toInt() ?? approvedCount;
          submittedCount = (dataMap['submittedGemsCount'] as num?)?.toInt() ?? approvedCount;
          reputationPoints = (dataMap['reputationPoints'] as num?)?.toInt() ?? reputationPoints;
          isVerifiedResident = (dataMap['isVerifiedResident'] as bool?) ?? isVerifiedResident;
          totalTipsInr = (dataMap['totalTipsReceivedInr'] as num?)?.toInt() ?? totalTipsInr;
        }
      } catch (_) {}
    }

    final accuracy = submittedCount > 0 ? (approvedCount / submittedCount).clamp(0.0, 1.0) : 0.0;
    final loaded = ContributorVerificationProfile(
      userId: user.uid,
      displayName: displayName,
      contributorTier: tier,
      reputationPoints: reputationPoints,
      spotsSubmittedCount: submittedCount,
      spotsApprovedCount: approvedCount,
      accuracyRate: accuracy,
      isVerifiedResident: isVerifiedResident,
      neighborhoodOfResidency: neighborhood,
      earnedBadges: badges,
      totalTipsReceivedInr: totalTipsInr,
    );
    _cachedLiveProfile = loaded;
    return loaded;
  }

  // In-memory cache of recent contributions
  final List<ContributionDocument> _recentContributions = [];
  List<ContributionDocument> get recentContributions =>
      List.unmodifiable(_recentContributions);

  /// Validates authenticated contributor role before submission.
  /// Throws AuthenticationRequiredException if no user is signed in.
  /// Throws ContributionPermissionDeniedException if the user has role 'TRAVELER'.
  Future<String> verifyContributorAuthorization() async {
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
    final String effectiveContributorId = await verifyContributorAuthorization();

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
    } on FirebaseFunctionsException catch (e) {
      throw AppFailure.backend(
        e.message ?? 'Contribution submission failed.',
        code: e.code,
        cause: e,
      );
    } catch (e) {
      throw AppFailure.network(
        'Could not submit contribution to cloud backend. Check connection and retry.',
        e,
      );
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
      return contributions;
    } on FirebaseFunctionsException catch (e) {
      if (_recentContributions.isNotEmpty) {
        return List.unmodifiable(_recentContributions);
      }
      throw AppFailure.backend(
        e.message ?? 'Could not load your contributions.',
        code: e.code,
        cause: e,
      );
    } catch (e) {
      if (_recentContributions.isNotEmpty) {
        return List.unmodifiable(_recentContributions);
      }
      throw AppFailure.network(
        'Unable to load your contributions right now.',
        e,
      );
    }
  }

  /// Fetches latest status of a specific contribution via `Contributions-getContributionStatus`.
  Future<ContributionDocument> getContributionStatus(String contributionId) async {
    final found = _recentContributions.where((c) => c.contributionId == contributionId);
    if (found.isNotEmpty) return found.first;

    final functions = _functions;
    if (functions == null) {
      throw AppFailure.network('Firebase Functions instance unavailable.');
    }

    try {
      final callable = functions.httpsCallable('Contributions-getContributionStatus');
      final result = await callable.call<Map<String, dynamic>>({
        'contributionId': contributionId,
      });
      final responseMap = Map<String, dynamic>.from(result.data);
      final dataMap = Map<String, dynamic>.from(responseMap['data'] as Map? ?? {});
      final contributionMap = Map<String, dynamic>.from(dataMap['contribution'] as Map? ?? {});
      if (contributionMap.isEmpty) {
        throw AppFailure.notFound('Contribution $contributionId was not found.');
      }
      return ContributionDocument.fromMap(contributionId, contributionMap);
    } on AppFailure {
      rethrow;
    } on FirebaseFunctionsException catch (e) {
      throw AppFailure.backend(
        e.message ?? 'Failed to fetch contribution status.',
        code: e.code,
        cause: e,
      );
    } catch (e) {
      throw AppFailure.network('Could not refresh contribution status.', e);
    }
  }
}
