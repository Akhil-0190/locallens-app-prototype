import '../models/spot_card.dart';
import '../models/traveler_preferences.dart';

/// Gateway service for traveler preferences and place discovery.
///
/// INTEGRATION BOUNDARY:
/// - Developer B owns AI taste-matching recommendations and candidate scoring.
/// - Developer C owns Maps grounding (C2 complete) and walking routes (C3 merged in backend).
/// - Developer D displays supplied data and manages traveler UI states.
/// - Clearly discloses sample responses adhering to Domain 06 contracts.
class TravelerService {
  // Toggle for live vs mock discovery
  static const bool useMockDiscovery = true;

  // Active user preference state conforming to Domain 02
  TravelerPreferencesDocument _currentPreferences = TravelerPreferencesDocument(
    userId: 'usr_guest_traveler',
    favoriteVibes: const [
      'heritage',
      'vintage_filter_coffee',
      'street_food',
    ],
    dietaryRestrictions: const ['vegetarian'],
    budgetTier: BudgetTier.moderate,
    maxBudgetPerMealInr: 250,
    preferredPacing: TravelPacing.balanced,
    preferredNeighborhoods: const ['Malleshwaram', 'Basavanagudi'],
    accessibilityNeeds: const [],
    updatedAt: DateTime.now(),
  );

  TravelerPreferencesDocument get currentPreferences => _currentPreferences;

  void updatePreferences(TravelerPreferencesDocument newPrefs) {
    _currentPreferences = newPrefs;
  }

  /// Returns places adhering to Domain 06 CanonicalPlaceDocument
  Future<List<SpotCard>> getDiscoveredPlaces({
    required TravelerPreferencesDocument preferences,
    String? neighborhoodFilter,
    bool isGroupMode = false,
  }) async {
    // Simulate network latency
    await Future.delayed(const Duration(milliseconds: 350));

    // Curated sample places strictly conforming to Domain 06 sample schema
    final allSamplePlaces = [
      SpotCard(
        id: 'place_ctr_malleshwaram_01',
        spotName: 'Central Tiffin Room (Shri Sagar)',
        formattedAddress:
            '7th Cross Rd, Margosa Rd, Malleshwaram, Bengaluru 560003',
        mapsLink: 'https://www.google.com/maps/search/?api=1&query=Central+Tiffin+Room+Malleshwaram+Bengaluru',
        primaryCategory: 'south_indian_restaurant',
        categories: const ['restaurant', 'heritage_cafe', 'breakfast_spot'],
        infoParagraph:
            'Iconic 1920s heritage breakfast institution celebrated for its crisp butter benne masala dose and slow-dripped chicory filter coffee.',
        photoUrls: const [
          'https://images.unsplash.com/photo-1589301760014-d929f3979dbc'
        ],
        openHours: '07:30 AM - 12:30 PM, 04:00 PM - 09:00 PM',
        authenticityScore: 96,
        touristTrapLikelihood: 'LOW',
        isTouristTrap: false,
        localSentimentSummary:
            'Beloved generational eatery patronized by decades of local Bangaloreans.',
        recommendedTiming: 'Early weekday morning around 7:45 AM before queues.',
        practicalTips:
            'Cash or UPI only. Ask for "benne dose" with extra white butter on the side.',
        greetingCard:
            'Welcome to Shri Sagar CTR! Savor the legendary crisp golden dose that has fueled Bengaluru mornings for over 70 years.',
        vibeTags: const [
          'heritage',
          'vintage_filter_coffee',
          'pocket_friendly',
          'generational_recipes',
        ],
        hourlyLimit: 12,
        currentVisitors: 4,
        remainingCapacity: 8,
        crowdLevel: 'MODERATE',
        isThrottled: false,
        contributedBy: const ContributorAttribution(
          userId: 'usr_blr_782914',
          displayName: 'Priya Sharma',
          badgeTitle: 'Neighborhood Insider',
          isVerifiedResident: true,
        ),
        isVerified: true,
        isMockData: true,
      ),
      SpotCard(
        id: 'place_veena_stores_02',
        spotName: 'Veena Stores',
        formattedAddress: 'Margosa Rd, Malleshwaram, Bengaluru 560003',
        mapsLink: 'https://www.google.com/maps/search/?api=1&query=Veena+Stores+Malleshwaram+Bengaluru',
        primaryCategory: 'breakfast_kiosk',
        categories: const ['street_food', 'heritage_eatery'],
        infoParagraph:
            'Standing-only breakfast landmark serving steaming hot soft idlis drenched in spicy mint chutney and piping hot filter coffee since 1977.',
        photoUrls: const [], // Intentional empty photo to test fallback
        openHours: '06:30 AM - 12:00 PM, 03:30 PM - 08:30 PM',
        authenticityScore: 98,
        touristTrapLikelihood: 'LOW',
        isTouristTrap: false,
        localSentimentSummary:
            'Deeply cherished community institution known for consistent quality.',
        recommendedTiming: 'Between 7:00 AM and 8:30 AM.',
        practicalTips:
            'No seating available; stand under the margosa trees like a local.',
        greetingCard:
            'Banni, idli-chutney tinnona! Start your Malleshwaram morning the quintessential local way.',
        vibeTags: const [
          'street_food',
          'heritage',
          'pocket_friendly',
          'generational_recipes',
        ],
        hourlyLimit: 10,
        currentVisitors: 7,
        remainingCapacity: 3,
        crowdLevel: 'HIGH',
        isThrottled: false,
        contributedBy: const ContributorAttribution(
          userId: 'usr_blr_782914',
          displayName: 'Aravinth S',
          badgeTitle: 'Local Resident',
          isVerifiedResident: true,
        ),
        isVerified: true,
        isMockData: true,
      ),
      SpotCard(
        id: 'place_brahmins_coffee_03',
        spotName: 'Brahmin\'s Coffee Bar',
        formattedAddress:
            'Ranga Rao Rd, Shankarapuram, Basavanagudi, Bengaluru 560004',
        mapsLink: 'https://www.google.com/maps/search/?api=1&query=Brahmins+Coffee+Bar+Basavanagudi+Bengaluru',
        primaryCategory: 'coffee_counter',
        categories: const ['cafe', 'heritage_breakfast'],
        infoParagraph:
            'Unpretentious heritage corner joint famous for crispy medu vada, sweet kesari bath, and aromatic chicory filter coffee.',
        photoUrls: const [
          'https://images.unsplash.com/photo-1517256064527-09c73fc73e38'
        ],
        openHours: '06:00 AM - 12:00 PM, 03:00 PM - 07:00 PM',
        authenticityScore: 97,
        touristTrapLikelihood: 'LOW',
        isTouristTrap: false,
        localSentimentSummary:
            'South Bangalore staple renowned for its watery green coconut chutney.',
        recommendedTiming: 'Right at 6:30 AM for freshly fried vadas.',
        practicalTips: 'Dip the hot vada directly in the chutney counter cup.',
        greetingCard:
            'Namaskara! Welcome to Basavanagudi\'s most storied coffee counter.',
        vibeTags: const [
          'vintage_filter_coffee',
          'heritage',
          'pocket_friendly',
        ],
        hourlyLimit: 8,
        currentVisitors: 2,
        remainingCapacity: 6,
        crowdLevel: 'LOW',
        isThrottled: false,
        contributedBy: const ContributorAttribution(
          userId: 'usr_blr_782914',
          displayName: 'Priya Sharma',
          badgeTitle: 'Neighborhood Insider',
          isVerifiedResident: true,
        ),
        isVerified: true,
        isMockData: true,
      ),
      SpotCard(
        id: 'place_kadu_temple_04',
        spotName: 'Kadu Malleshwara & Nandi Teertha',
        formattedAddress: '2nd Temple St, Malleshwaram, Bengaluru 560003',
        mapsLink: 'https://www.google.com/maps/search/?api=1&query=Kadu+Malleshwara+Temple+Malleshwaram+Bengaluru',
        primaryCategory: 'historic_temple',
        categories: const ['heritage_site', 'quiet_walk'],
        infoParagraph:
            '17th-century black stone Shiva temple and natural spring sanctum surrounded by tranquil stepped courtyards.',
        photoUrls: const [],
        openHours: '06:00 AM - 12:00 PM, 05:00 PM - 08:30 PM',
        authenticityScore: 99,
        touristTrapLikelihood: 'LOW',
        isTouristTrap: false,
        localSentimentSummary:
            'Peaceful historical sanctuary amidst the bustling neighborhood.',
        recommendedTiming: 'Late evening sunset prayers around 6:00 PM.',
        practicalTips:
            'Footwear stands available at temple entrance; step-free access through eastern gate.',
        greetingCard:
            'Experience centuries of tranquil stone architecture and the sacred Nandi spring.',
        vibeTags: const [
          'heritage',
          'quiet_courtyard',
          'artisanal_crafts',
        ],
        hourlyLimit: 14,
        currentVisitors: 3,
        remainingCapacity: 11,
        crowdLevel: 'LOW',
        isThrottled: false,
        contributedBy: const ContributorAttribution(
          userId: 'usr_blr_782914',
          displayName: 'Aravinth S',
          badgeTitle: 'Local Resident',
          isVerifiedResident: true,
        ),
        isVerified: true,
        isMockData: true,
      ),
      SpotCard(
        id: 'place_tourist_trap_05',
        spotName: 'Commercial Street Overpriced Gift Arcade',
        formattedAddress: 'Commercial St, Tasker Town, Shivaji Nagar 560001',
        mapsLink: 'https://www.google.com/maps/search/?api=1&query=Commercial+Street+Shivaji+Nagar+Bengaluru',
        primaryCategory: 'souvenir_shop',
        categories: const ['tourist_kiosk'],
        infoParagraph:
            'High-commission souvenir arcade with mass-produced trinkets marketed falsely as authentic local sandalwood handicrafts.',
        photoUrls: const [],
        openHours: '10:00 AM - 09:00 PM',
        authenticityScore: 28,
        touristTrapLikelihood: 'SEVERE',
        isTouristTrap: true,
        localSentimentSummary:
            'Aggressive touts targeting unguided foreign and domestic tourists.',
        recommendedTiming: 'Avoid during peak afternoon hours.',
        practicalTips: 'Heavily inflated prices; not recommended by local residents.',
        greetingCard: 'Caution: Tourist trap advisory in effect.',
        vibeTags: const ['artisanal_crafts'],
        hourlyLimit: 15,
        currentVisitors: 15,
        remainingCapacity: 0,
        crowdLevel: 'AT_CAPACITY',
        isThrottled: true,
        contributedBy: null,
        isVerified: false,
        isMockData: true,
      ),
    ];

    // Filter by neighborhood if explicitly selected
    if (neighborhoodFilter != null && neighborhoodFilter.isNotEmpty) {
      return allSamplePlaces.where((place) {
        return place.formattedAddress.toLowerCase().contains(neighborhoodFilter.toLowerCase());
      }).toList();
    }

    return allSamplePlaces;
  }
}
