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
        return 'Asset Uploaded';
      case ContributionStatus.aiAnalyzed:
        return 'AI Extracted (Gemini)';
      case ContributionStatus.mapsGrounded:
        return 'Maps Grounded';
      case ContributionStatus.verified:
        return 'Verified & Published';
      case ContributionStatus.rejected:
        return 'Requires Review';
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

/// Contributor submission input matching Domain 03 ContributorSubmissionInput
class ContributorSubmissionInput {
  final String mapsLink;
  final String infoParagraph;
  final List<String> photoUrls;
  final String? audioNotePath; // Local file path
  final String? audioNoteUrl;  // Cloud storage URL once uploaded
  final String contributorId;
  final String selectedLanguage;

  const ContributorSubmissionInput({
    required this.mapsLink,
    required this.infoParagraph,
    required this.photoUrls,
    this.audioNotePath,
    this.audioNoteUrl,
    required this.contributorId,
    this.selectedLanguage = 'en',
  });

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
  final DateTime createdAt;
  final DateTime updatedAt;
  final SpotCard? generatedSpotCard; // Populated once verified or previewed

  const ContributionDocument({
    required this.contributionId,
    required this.submission,
    required this.status,
    this.groundedPlaceId,
    this.rejectionReason,
    this.moderatedBy,
    required this.createdAt,
    required this.updatedAt,
    this.generatedSpotCard,
  });

  ContributionDocument copyWith({
    ContributionStatus? status,
    String? groundedPlaceId,
    String? rejectionReason,
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
