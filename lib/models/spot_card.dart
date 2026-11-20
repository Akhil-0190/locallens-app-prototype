class SpotCard {
  final String id;
  final String mapsLink;         // Direct Google Maps link
  final String infoParagraph;    // Local resident's 3-4 line story
  final List<String> photoUrls;  // Street photos

  // Populated automatically by Gemini 3.8 Flash + Google Maps Grounding
  final String spotName;
  final String openHours;
  final String practicalTips;
  final String greetingCard;
  final bool isTouristTrap;
  final int hourlyLimit;
  final int currentVisitors;
  final List<String> vibeTags;
  final ContributorAttribution? contributedBy;

  // Domain 06 Canonical Enrichments (docs/contracts/06-places-and-spot-cards.md)
  final int authenticityScore;
  final String touristTrapLikelihood; // 'LOW', 'MODERATE', 'HIGH', 'SEVERE'
  final String localSentimentSummary;
  final String recommendedTiming;
  final int remainingCapacity;
  final String crowdLevel; // 'LOW', 'MODERATE', 'HIGH', 'AT_CAPACITY'
  final bool isThrottled;
  final String formattedAddress;
  final String primaryCategory;
  final List<String> categories;
  final bool isVerified;
  final bool isMockData;

  SpotCard({
    required this.id,
    required this.mapsLink,
    required this.infoParagraph,
    required this.photoUrls,
    this.spotName = 'Pending Verification',
    this.openHours = 'Check Maps for hours',
    this.practicalTips = '',
    this.greetingCard = '',
    this.isTouristTrap = false,
    this.hourlyLimit = 6,
    this.currentVisitors = 0,
    this.vibeTags = const [],
    this.contributedBy,
    this.authenticityScore = 90,
    this.touristTrapLikelihood = 'LOW',
    this.localSentimentSummary = '',
    this.recommendedTiming = '',
    this.remainingCapacity = 6,
    this.crowdLevel = 'MODERATE',
    this.isThrottled = false,
    this.formattedAddress = '',
    this.primaryCategory = '',
    this.categories = const [],
    this.isVerified = true,
    this.isMockData = true,
  });

  factory SpotCard.fromMap(String id, Map<String, dynamic> data) {
    // Nested Domain 06 structure support
    final authenticity = data['authenticity'] is Map<String, dynamic>
        ? data['authenticity'] as Map<String, dynamic>
        : null;
    final capacity = data['capacity'] is Map<String, dynamic>
        ? data['capacity'] as Map<String, dynamic>
        : null;

    final hourly = (capacity?['hourlyLimit'] ?? data['hourlyLimit'] as num?)?.toInt() ?? 6;
    final visitors = (capacity?['currentVisitors'] ?? data['currentVisitors'] as num?)?.toInt() ?? 0;
    final remaining = (capacity?['remainingCapacity'] as num?)?.toInt() ?? (hourly - visitors);

    final rawContributed = data['contributorAttribution'] ?? data['contributedBy'];

    return SpotCard(
      id: id,
      mapsLink: data['mapsLink'] ?? '',
      infoParagraph: data['infoParagraph'] ?? '',
      photoUrls: List<String>.from(data['photoUrls'] ?? []),
      spotName: data['spotName'] ?? 'Verified Local Spot',
      openHours: data['openHours'] ?? 'Check Maps for hours',
      practicalTips: authenticity?['practicalTips'] ?? data['practicalTips'] ?? '',
      greetingCard: authenticity?['greetingCard'] ?? data['greetingCard'] ?? '',
      isTouristTrap: authenticity?['isTouristTrap'] ?? data['isTouristTrap'] ?? false,
      hourlyLimit: hourly,
      currentVisitors: visitors,
      vibeTags: List<String>.from(authenticity?['vibeTags'] ?? data['vibeTags'] ?? []),
      contributedBy: rawContributed != null
          ? ContributorAttribution.fromMap(
              Map<String, dynamic>.from(rawContributed))
          : null,
      authenticityScore: (authenticity?['authenticityScore'] as num?)?.toInt() ??
          (data['authenticityScore'] as num?)?.toInt() ?? 90,
      touristTrapLikelihood: authenticity?['touristTrapLikelihood'] ??
          data['touristTrapLikelihood'] ?? 'LOW',
      localSentimentSummary: authenticity?['localSentimentSummary'] ??
          data['localSentimentSummary'] ?? '',
      recommendedTiming: authenticity?['recommendedTiming'] ??
          data['recommendedTiming'] ?? '',
      remainingCapacity: remaining,
      crowdLevel: capacity?['crowdLevel'] ?? data['crowdLevel'] ?? 'MODERATE',
      isThrottled: capacity?['isThrottled'] ?? (remaining <= 0),
      formattedAddress: data['formattedAddress'] ?? '',
      primaryCategory: data['primaryCategory'] ?? '',
      categories: List<String>.from(data['categories'] ?? []),
      isVerified: data['isVerified'] ?? true,
      isMockData: data['isMockData'] ?? true,
    );
  }

  Map<String, dynamic> toSubmissionMap() {
    return {
      'mapsLink': mapsLink,
      'infoParagraph': infoParagraph,
      'photoUrls': photoUrls,
      'isVerified': false,
      'createdAt': DateTime.now().toIso8601String(),
      if (contributedBy != null) 'contributedBy': contributedBy!.toMap(),
    };
  }
}

class ContributorAttribution {
  final String userId;
  final String displayName;
  final String badgeTitle;
  final bool isVerifiedResident;

  const ContributorAttribution({
    required this.userId,
    required this.displayName,
    this.badgeTitle = 'Neighborhood Insider',
    this.isVerifiedResident = true,
  });

  factory ContributorAttribution.fromMap(Map<String, dynamic> data) {
    return ContributorAttribution(
      userId: data['userId'] ?? '',
      displayName: data['displayName'] ?? 'Local Resident',
      badgeTitle: data['badgeTitle'] ?? 'Neighborhood Insider',
      isVerifiedResident: data['isVerifiedResident'] ?? true,
    );
  }

  Map<String, dynamic> toMap() => {
    'userId': userId,
    'displayName': displayName,
    'badgeTitle': badgeTitle,
    'isVerifiedResident': isVerifiedResident,
  };
}
