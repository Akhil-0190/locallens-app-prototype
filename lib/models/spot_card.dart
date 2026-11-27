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
  final double? latitude;
  final double? longitude;

  // Stage 1 Grounding, Safety/Hygiene & Community Signals
  final String neighborhood;
  final String verificationTier; // 'UNVERIFIED', 'AI_EVIDENCE_CHECKED', 'COMMUNITY_VERIFIED'
  final List<String> safetyHygieneBadges;
  final int hygieneEndorsementCount;
  final String heritageContext;
  final List<String> safetyNotices;
  final List<String> searchGroundingUrls;
  final List<String> mustTryItems;
  final List<Map<String, dynamic>> dialectPhrases;
  final double? rating;
  final int? userRatingCount;
  final bool? isOpenNow;

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
    this.isMockData = false,
    this.latitude,
    this.longitude,
    this.neighborhood = 'Malleshwaram',
    this.verificationTier = 'UNVERIFIED',
    this.safetyHygieneBadges = const [],
    this.hygieneEndorsementCount = 0,
    this.heritageContext = '',
    this.safetyNotices = const [],
    this.searchGroundingUrls = const [],
    this.mustTryItems = const [],
    this.dialectPhrases = const [],
    this.rating,
    this.userRatingCount,
    this.isOpenNow,
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
    final safetyHygiene = data['safetyHygiene'] is Map
        ? Map<String, dynamic>.from(data['safetyHygiene'] as Map)
        : null;
    final communitySignals = data['communitySignals'] is Map
        ? Map<String, dynamic>.from(data['communitySignals'] as Map)
        : null;
    final aiSynthesis = data['aiSynthesis'] is Map
        ? Map<String, dynamic>.from(data['aiSynthesis'] as Map)
        : null;
    final mapsGrounding = data['mapsGrounding'] is Map
        ? Map<String, dynamic>.from(data['mapsGrounding'] as Map)
        : null;
    final coordMap = data['coordinate'] is Map
        ? Map<String, dynamic>.from(data['coordinate'] as Map)
        : (data['location'] is Map ? Map<String, dynamic>.from(data['location'] as Map) : null);

    final rawDialects = communitySignals?['dialectPhrases'] as List? ?? [];
    final parsedDialects = rawDialects
        .whereType<Map>()
        .map((m) => Map<String, dynamic>.from(m))
        .toList();

    return SpotCard(
      id: id,
      mapsLink: data['mapsLink'] ?? '',
      infoParagraph: data['infoParagraph'] ?? aiSynthesis?['storySummary'] ?? '',
      photoUrls: List<String>.from(data['photoUrls'] ?? []),
      spotName: data['spotName'] ?? data['name'] ?? 'Verified Local Spot',
      openHours: data['openHours'] ??
          (mapsGrounding?['regularHours'] is List && (mapsGrounding!['regularHours'] as List).isNotEmpty
              ? (mapsGrounding['regularHours'] as List).join(' | ')
              : 'Check Maps for hours'),
      practicalTips: authenticity?['practicalTips'] ?? data['practicalTips'] ?? '',
      greetingCard: authenticity?['greetingCard'] ?? data['greetingCard'] ?? '',
      isTouristTrap: authenticity?['isTouristTrap'] ??
          mapsGrounding?['isTouristTrap'] ??
          data['isTouristTrap'] ??
          false,
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
      crowdLevel: capacity?['crowdLevel'] ??
          communitySignals?['latestCrowdLevel'] ??
          data['crowdLevel'] ??
          'MODERATE',
      isThrottled: capacity?['isThrottled'] ?? (remaining <= 0),
      formattedAddress: data['formattedAddress'] ?? '',
      primaryCategory: data['primaryCategory'] ?? '',
      categories: List<String>.from(data['categories'] ?? []),
      isVerified: data['isVerified'] ?? true,
      isMockData: data['isMockData'] ?? false,
      latitude: (coordMap?['latitude'] ?? data['latitude'] as num?)?.toDouble(),
      longitude: (coordMap?['longitude'] ?? data['longitude'] as num?)?.toDouble(),
      neighborhood: data['neighborhood'] as String? ?? 'Malleshwaram',
      verificationTier: safetyHygiene?['verificationTier'] as String? ??
          (data['isVerified'] == true ? 'AI_EVIDENCE_CHECKED' : 'UNVERIFIED'),
      safetyHygieneBadges: List<String>.from(safetyHygiene?['badges'] ?? []),
      hygieneEndorsementCount: (safetyHygiene?['endorsementCount'] as num?)?.toInt() ?? 0,
      heritageContext: data['heritageContext'] as String? ??
          aiSynthesis?['heritageContext'] as String? ??
          '',
      safetyNotices: List<String>.from(
        data['safetyNotices'] ?? aiSynthesis?['safetyNotices'] ?? const [],
      ),
      searchGroundingUrls: List<String>.from(
        data['searchGroundingUrls'] ?? aiSynthesis?['searchGroundingUrls'] ?? const [],
      ),
      mustTryItems: List<String>.from(
        data['mustTryItems'] ?? aiSynthesis?['mustTryItems'] ?? const [],
      ),
      dialectPhrases: parsedDialects,
      rating: (data['rating'] ?? mapsGrounding?['rating'] as num?)?.toDouble(),
      userRatingCount: (data['userRatingCount'] ?? mapsGrounding?['userRatingCount'] as num?)?.toInt(),
      isOpenNow: (data['isOpenNow'] ?? mapsGrounding?['isOpenNow']) as bool?,
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
  final String reputationTier;
  final int approvedGemsCount;

  const ContributorAttribution({
    required this.userId,
    required this.displayName,
    this.badgeTitle = 'Neighborhood Insider',
    this.isVerifiedResident = true,
    this.reputationTier = 'COMMUNITY_SCOUT',
    this.approvedGemsCount = 0,
  });

  factory ContributorAttribution.fromMap(Map<String, dynamic> data) {
    return ContributorAttribution(
      userId: data['userId'] ?? '',
      displayName: data['displayName'] ?? 'Local Resident',
      badgeTitle: data['badgeTitle'] ?? 'Neighborhood Insider',
      isVerifiedResident: data['isVerifiedResident'] ?? true,
      reputationTier: data['reputationTier'] ?? 'COMMUNITY_SCOUT',
      approvedGemsCount: (data['approvedGemsCount'] as num?)?.toInt() ?? 0,
    );
  }

  Map<String, dynamic> toMap() => {
    'userId': userId,
    'displayName': displayName,
    'badgeTitle': badgeTitle,
    'isVerifiedResident': isVerifiedResident,
    'reputationTier': reputationTier,
    'approvedGemsCount': approvedGemsCount,
  };
}
