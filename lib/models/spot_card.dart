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
  });

  factory SpotCard.fromMap(String id, Map<String, dynamic> data) {
    return SpotCard(
      id: id,
      mapsLink: data['mapsLink'] ?? '',
      infoParagraph: data['infoParagraph'] ?? '',
      photoUrls: List<String>.from(data['photoUrls'] ?? []),
      spotName: data['spotName'] ?? 'Verified Local Spot',
      openHours: data['openHours'] ?? 'Check Maps for hours',
      practicalTips: data['practicalTips'] ?? '',
      greetingCard: data['greetingCard'] ?? '',
      isTouristTrap: data['isTouristTrap'] ?? false,
      hourlyLimit: data['hourlyLimit'] ?? 6,
      currentVisitors: data['currentVisitors'] ?? 0,
      vibeTags: List<String>.from(data['vibeTags'] ?? []),
    );
  }

  Map<String, dynamic> toSubmissionMap() {
    return {
      'mapsLink': mapsLink,
      'infoParagraph': infoParagraph,
      'photoUrls': photoUrls,
      'isVerified': false,
      'createdAt': DateTime.now().toIso8601String(),
    };
  }
}