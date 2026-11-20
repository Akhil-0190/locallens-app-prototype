import 'spot_card.dart';

/// Contribution status matching Domain 03 contract (docs/contracts/03-local-contributions.md)
enum ContributionStatus {
  submitted,
  aiAnalyzed,
  mapsGrounded,
  verified,
  rejected,
}

extension ContributionStatusX on ContributionStatus {
  String get value {
    switch (this) {
      case ContributionStatus.submitted:
        return 'SUBMITTED';
      case ContributionStatus.aiAnalyzed:
        return 'AI_ANALYZED';
      case ContributionStatus.mapsGrounded:
        return 'MAPS_GROUNDED';
      case ContributionStatus.verified:
        return 'VERIFIED';
      case ContributionStatus.rejected:
        return 'REJECTED';
    }
  }

  String get displayName {
    switch (this) {
      case ContributionStatus.submitted:
        return 'Submitted to Backend';
      case ContributionStatus.aiAnalyzed:
        return 'AI Extracted (Gemini B2)';
      case ContributionStatus.mapsGrounded:
        return 'Maps Grounded (C2)';
      case ContributionStatus.verified:
        return 'Verified & Published';
      case ContributionStatus.rejected:
        return 'Rejected';
    }
  }

  static ContributionStatus fromString(String? val) {
    switch (val?.toUpperCase()) {
      case 'AI_ANALYZED':
        return ContributionStatus.aiAnalyzed;
      case 'MAPS_GROUNDED':
        return ContributionStatus.mapsGrounded;
      case 'VERIFIED':
        return ContributionStatus.verified;
      case 'REJECTED':
        return ContributionStatus.rejected;
      case 'SUBMITTED':
      default:
        return ContributionStatus.submitted;
    }
  }
}

/// Extracted practical details matching Domain 04 ExtractedPracticalDetails
class ExtractedPracticalDetails {
  final String? openingHoursMentioned;
  final List<String> signatureDishesOrItems;
  final String? priceLevelNote;
  final bool cashOnlyWarning;
  final List<String> insiderTips;

  const ExtractedPracticalDetails({
    this.openingHoursMentioned,
    this.signatureDishesOrItems = const [],
    this.priceLevelNote,
    this.cashOnlyWarning = false,
    this.insiderTips = const [],
  });

  factory ExtractedPracticalDetails.fromMap(Map<String, dynamic>? map) {
    if (map == null) return const ExtractedPracticalDetails();
    return ExtractedPracticalDetails(
      openingHoursMentioned: map['openingHoursMentioned'] as String?,
      signatureDishesOrItems: List<String>.from(map['signatureDishesOrItems'] ?? []),
      priceLevelNote: map['priceLevelNote'] as String?,
      cashOnlyWarning: map['cashOnlyWarning'] as bool? ?? false,
      insiderTips: List<String>.from(map['insiderTips'] ?? []),
    );
  }

  Map<String, dynamic> toMap() => {
    if (openingHoursMentioned != null) 'openingHoursMentioned': openingHoursMentioned,
    'signatureDishesOrItems': signatureDishesOrItems,
    if (priceLevelNote != null) 'priceLevelNote': priceLevelNote,
    'cashOnlyWarning': cashOnlyWarning,
    'insiderTips': insiderTips,
  };
}

/// AI extraction result matching Domain 04 VoicePhotoAssetDocument.aiExtractionResult
class AiExtractionResult {
  final String? detectedLanguage;
  final String? transcription;
  final String? englishTranslation;
  final ExtractedPracticalDetails? practicalDetails;
  final List<String> ocrDetectedText;
  final double? confidenceScore;

  const AiExtractionResult({
    this.detectedLanguage,
    this.transcription,
    this.englishTranslation,
    this.practicalDetails,
    this.ocrDetectedText = const [],
    this.confidenceScore,
  });

  factory AiExtractionResult.fromMap(Map<String, dynamic>? map) {
    if (map == null) return const AiExtractionResult();
    return AiExtractionResult(
      detectedLanguage: map['detectedLanguage'] as String?,
      transcription: map['transcription'] as String?,
      englishTranslation: map['englishTranslation'] as String?,
      practicalDetails: map['practicalDetails'] != null
          ? ExtractedPracticalDetails.fromMap(
              Map<String, dynamic>.from(map['practicalDetails'] as Map))
          : null,
      ocrDetectedText: List<String>.from(map['ocrDetectedText'] ?? []),
      confidenceScore: (map['confidenceScore'] as num?)?.toDouble(),
    );
  }

  Map<String, dynamic> toMap() => {
    if (detectedLanguage != null) 'detectedLanguage': detectedLanguage,
    if (transcription != null) 'transcription': transcription,
    if (englishTranslation != null) 'englishTranslation': englishTranslation,
    if (practicalDetails != null) 'practicalDetails': practicalDetails!.toMap(),
    'ocrDetectedText': ocrDetectedText,
    if (confidenceScore != null) 'confidenceScore': confidenceScore,
  };
}

/// Voice / photo asset document matching Domain 04 VoicePhotoAssetDocument
class VoicePhotoAsset {
  final String assetId;
  final String contributionId;
  final String assetType; // 'AUDIO_VOICE_NOTE', 'STREET_PHOTO', 'MENU_PHOTO', 'STOREFRONT_PHOTO'
  final String storagePath;
  final String downloadUrl;
  final String mimeType;
  final int fileSizeBytes;
  final String processingStatus; // 'UPLOADED', 'PROCESSING', 'COMPLETED', 'FAILED'
  final AiExtractionResult? aiExtractionResult;
  final String? errorMessage;
  final DateTime createdAt;
  final DateTime updatedAt;

  const VoicePhotoAsset({
    required this.assetId,
    required this.contributionId,
    required this.assetType,
    required this.storagePath,
    required this.downloadUrl,
    required this.mimeType,
    required this.fileSizeBytes,
    this.processingStatus = 'UPLOADED',
    this.aiExtractionResult,
    this.errorMessage,
    required this.createdAt,
    required this.updatedAt,
  });

  factory VoicePhotoAsset.fromMap(Map<String, dynamic> map) {
    return VoicePhotoAsset(
      assetId: map['assetId'] as String? ?? '',
      contributionId: map['contributionId'] as String? ?? '',
      assetType: map['assetType'] as String? ?? 'STREET_PHOTO',
      storagePath: map['storagePath'] as String? ?? '',
      downloadUrl: map['downloadUrl'] as String? ?? '',
      mimeType: map['mimeType'] as String? ?? '',
      fileSizeBytes: (map['fileSizeBytes'] as num?)?.toInt() ?? 0,
      processingStatus: map['processingStatus'] as String? ?? 'UPLOADED',
      aiExtractionResult: map['aiExtractionResult'] != null
          ? AiExtractionResult.fromMap(
              Map<String, dynamic>.from(map['aiExtractionResult'] as Map))
          : null,
      errorMessage: map['errorMessage'] as String?,
      createdAt: DateTime.tryParse(map['createdAt'] as String? ?? '') ?? DateTime.now(),
      updatedAt: DateTime.tryParse(map['updatedAt'] as String? ?? '') ?? DateTime.now(),
    );
  }
}

/// Contributor submission input matching Domain 03 ContributorSubmissionInput
class ContributorSubmissionInput {
  final String mapsLink;
  final String infoParagraph;
  final List<String> photoUrls;
  final String? audioNotePath; // Local file path for audio upload
  final List<String> localPhotoPaths; // Local file paths for photo upload
  final String? audioNoteUrl;  // Cloud storage URL once uploaded
  final String contributorId;
  final String selectedLanguage;

  const ContributorSubmissionInput({
    required this.mapsLink,
    required this.infoParagraph,
    this.photoUrls = const [],
    this.audioNotePath,
    this.localPhotoPaths = const [],
    this.audioNoteUrl,
    required this.contributorId,
    this.selectedLanguage = 'en',
  });

  /// Payload sent to A3 `Contributions-submitContribution` Cloud Function
  Map<String, dynamic> toCanonicalPayload() => {
    'mapsLink': mapsLink,
    'infoParagraph': infoParagraph,
    'photoUrls': photoUrls,
    if (audioNoteUrl != null) 'audioNoteUrl': audioNoteUrl,
    'contributorId': contributorId,
  };

  Map<String, dynamic> toMap() => {
    'mapsLink': mapsLink,
    'infoParagraph': infoParagraph,
    'photoUrls': photoUrls,
    if (audioNoteUrl != null) 'audioNoteUrl': audioNoteUrl,
    'contributorId': contributorId,
    'selectedLanguage': selectedLanguage,
  };
}

/// Contribution document matching Domain 03 ContributionDocument
class ContributionDocument {
  final String contributionId;
  final ContributorSubmissionInput submission;
  final ContributionStatus status;
  final String? groundedPlaceId;
  final String? rejectionReason;
  final String? moderatedBy;
  final List<VoicePhotoAsset> assets;
  final DateTime createdAt;
  final DateTime updatedAt;
  final SpotCard? generatedSpotCard; // Populated ONLY once formally verified and grounded

  const ContributionDocument({
    required this.contributionId,
    required this.submission,
    required this.status,
    this.groundedPlaceId,
    this.rejectionReason,
    this.moderatedBy,
    this.assets = const [],
    required this.createdAt,
    required this.updatedAt,
    this.generatedSpotCard,
  });

  factory ContributionDocument.fromMap(
    String id,
    Map<String, dynamic> data, {
    List<VoicePhotoAsset> assets = const [],
    SpotCard? spotCard,
  }) {
    final subData = data['submission'] is Map<String, dynamic>
        ? data['submission'] as Map<String, dynamic>
        : data;

    final subInput = ContributorSubmissionInput(
      mapsLink: subData['mapsLink'] as String? ?? '',
      infoParagraph: subData['infoParagraph'] as String? ?? '',
      photoUrls: List<String>.from(subData['photoUrls'] ?? []),
      audioNoteUrl: subData['audioNoteUrl'] as String?,
      contributorId: subData['contributorId'] as String? ?? '',
      selectedLanguage: subData['selectedLanguage'] as String? ?? 'en',
    );

    return ContributionDocument(
      contributionId: id,
      submission: subInput,
      status: ContributionStatusX.fromString(data['status'] as String?),
      groundedPlaceId: data['groundedPlaceId'] as String?,
      rejectionReason: data['rejectionReason'] as String?,
      moderatedBy: data['moderatedBy'] as String?,
      assets: assets,
      createdAt: DateTime.tryParse(data['createdAt'] as String? ?? '') ?? DateTime.now(),
      updatedAt: DateTime.tryParse(data['updatedAt'] as String? ?? '') ?? DateTime.now(),
      generatedSpotCard: spotCard,
    );
  }

  ContributionDocument copyWith({
    ContributionStatus? status,
    String? groundedPlaceId,
    String? rejectionReason,
    List<VoicePhotoAsset>? assets,
    SpotCard? generatedSpotCard,
    DateTime? updatedAt,
  }) {
    return ContributionDocument(
      contributionId: contributionId,
      submission: submission,
      status: status ?? this.status,
      groundedPlaceId: groundedPlaceId ?? this.groundedPlaceId,
      rejectionReason: rejectionReason ?? this.rejectionReason,
      moderatedBy: moderatedBy,
      assets: assets ?? this.assets,
      createdAt: createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
      generatedSpotCard: generatedSpotCard ?? this.generatedSpotCard,
    );
  }
}

/// Contributor badge matching Domain 05
class ContributorBadge {
  final String badgeId;
  final String title;
  final String description;
  final String awardedAt;

  const ContributorBadge({
    required this.badgeId,
    required this.title,
    required this.description,
    required this.awardedAt,
  });
}

/// Contributor profile matching Domain 05 ContributorVerificationProfile
class ContributorVerificationProfile {
  final String userId;
  final String displayName;
  final String contributorTier; // 'LOCAL_RESIDENT', 'HERITAGE_SAGE', 'COMMUNITY_PILLAR', 'COMMUNITY_SCOUT'
  final int reputationPoints;
  final int spotsSubmittedCount;
  final int spotsApprovedCount;
  final double accuracyRate;
  final bool isVerifiedResident;
  final String neighborhoodOfResidency;
  final List<ContributorBadge> earnedBadges;
  final int totalTipsReceivedInr;

  const ContributorVerificationProfile({
    required this.userId,
    required this.displayName,
    this.contributorTier = 'LOCAL_RESIDENT',
    this.reputationPoints = 150,
    this.spotsSubmittedCount = 5,
    this.spotsApprovedCount = 4,
    this.accuracyRate = 0.80,
    this.isVerifiedResident = true,
    this.neighborhoodOfResidency = 'Malleshwaram',
    this.earnedBadges = const [
      ContributorBadge(
        badgeId: 'NEIGHBORHOOD_INSIDER',
        title: 'Neighborhood Insider',
        description: 'Verified 3+ hidden gems in home neighborhood',
        awardedAt: '2026-11-01T00:00:00.000Z',
      ),
      ContributorBadge(
        badgeId: 'FILTER_COFFEE_CONNOISSEUR',
        title: 'Filter Coffee Sage',
        description: 'Discovered authentic traditional roast house',
        awardedAt: '2026-11-15T00:00:00.000Z',
      ),
    ],
    this.totalTipsReceivedInr = 180,
  });

  String get tierDisplayName {
    switch (contributorTier) {
      case 'HERITAGE_SAGE':
        return 'Heritage Sage';
      case 'COMMUNITY_PILLAR':
        return 'Community Pillar';
      case 'COMMUNITY_SCOUT':
        return 'Community Scout';
      case 'LOCAL_RESIDENT':
      default:
        return 'Local Resident';
    }
  }
}

/// Regional language descriptor
class RegionalLanguage {
  final String code;
  final String name;
  final String nativeLabel;

  const RegionalLanguage({
    required this.code,
    required this.name,
    required this.nativeLabel,
  });

  static const List<RegionalLanguage> supportedLanguages = [
    RegionalLanguage(code: 'en', name: 'English', nativeLabel: 'English'),
    RegionalLanguage(code: 'kn-IN', name: 'Kannada', nativeLabel: 'ಕನ್ನಡ'),
    RegionalLanguage(code: 'ta-IN', name: 'Tamil', nativeLabel: 'தமிழ்'),
    RegionalLanguage(code: 'hi-IN', name: 'Hindi', nativeLabel: 'हिन्दी'),
    RegionalLanguage(code: 'te-IN', name: 'Telugu', nativeLabel: 'తెలుగు'),
  ];
}
