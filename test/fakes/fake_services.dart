import 'package:drift/native.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:locallens/database/app_database.dart';
import 'package:locallens/models/contribution.dart';
import 'package:locallens/models/monetization.dart';
import 'package:locallens/models/spot_card.dart';
import 'package:locallens/models/traveler_preferences.dart';
import 'package:locallens/models/walking_route.dart';
import 'package:locallens/providers/monetization_providers.dart' as mp;
import 'package:locallens/providers/offline_providers.dart';
import 'package:locallens/providers/route_providers.dart';
import 'package:locallens/providers/spot_providers.dart' as sp;
import 'package:locallens/providers/traveler_providers.dart';
import 'package:locallens/services/contribution_service.dart';
import 'package:locallens/services/monetization_service.dart';
import 'package:locallens/services/native_platform_service.dart';
import 'package:locallens/services/offline_pack_service.dart';
import 'package:locallens/services/route_service.dart';
import 'package:locallens/services/spot_service.dart';
import 'package:locallens/services/street_assistance_service.dart';
import 'package:locallens/services/traveler_service.dart';

/// Deterministic in-memory test fixtures — strictly isolated under `test/fakes/`
/// and NEVER imported by production `lib/` code.
final List<SpotCard> testFixtureSpots = [
  SpotCard(
    id: 'spot_ctr_01',
    spotName: 'Central Tiffin Room (CTR / Shri Sagar)',
    mapsLink: 'https://maps.google.com/?q=CTR+Malleshwaram+Bengaluru',
    infoParagraph:
        'Iconic 1920s Malleshwaram tiffin hall famous for golden benne masala dose and brass tumbler filter coffee.',
    photoUrls: [],
    openHours: '7:30 AM – 12:30 PM, 4:00 PM – 9:00 PM',
    practicalTips: 'Pay at the front counter first and collect your paper token.',
    greetingCard: 'Ondu benne masala dose, ondu coffee kodi',
    isTouristTrap: false,
    hourlyLimit: 12,
    currentVisitors: 4,
    vibeTags: ['Heritage', 'Street Food', 'vintage_filter_coffee'],
    authenticityScore: 96,
    localSentimentSummary: 'Beloved multi-generational breakfast institution.',
    remainingCapacity: 8,
    crowdLevel: 'MODERATE',
    formattedAddress: '7th Cross, Margosa Rd, Malleshwaram, Bengaluru',
    primaryCategory: 'Heritage Tiffin',
    isVerified: true,
    isMockData: false,
    latitude: 12.998242,
    longitude: 77.570953,
    neighborhood: 'Malleshwaram',
    verificationTier: 'COMMUNITY_VERIFIED',
    contributedBy: ContributorAttribution(
      userId: 'usr_priya_01',
      displayName: 'Priya Sharma',
      badgeTitle: 'Neighborhood Insider',
      reputationTier: 'HERITAGE_SAGE',
      approvedGemsCount: 5,
      isVerifiedResident: true,
    ),
  ),
  SpotCard(
    id: 'spot_veena_02',
    spotName: 'Veena Stores',
    mapsLink: 'https://maps.google.com/?q=Veena+Stores+Malleshwaram+Bengaluru',
    infoParagraph:
        'Standing-only neighborhood favorite serving steaming soft idlis, crispy vadas, and khara bath since 1977.',
    photoUrls: [],
    openHours: '6:30 AM – 12:00 PM, 3:30 PM – 8:30 PM',
    practicalTips: 'Arrive before 8:30 AM for piping hot shavige bath.',
    greetingCard: 'Eradu idli, ondu vade kodi',
    isTouristTrap: false,
    hourlyLimit: 12,
    currentVisitors: 5,
    vibeTags: ['Street Food', 'Heritage'],
    authenticityScore: 95,
    localSentimentSummary: 'Fast-moving darshini favored by Malleshwaram regulars.',
    remainingCapacity: 7,
    crowdLevel: 'MODERATE',
    formattedAddress: '15th Cross, Margosa Rd, Malleshwaram, Bengaluru',
    primaryCategory: 'South Indian Tiffin',
    isVerified: true,
    isMockData: false,
    latitude: 13.000851,
    longitude: 77.569421,
    neighborhood: 'Malleshwaram',
    verificationTier: 'COMMUNITY_VERIFIED',
  ),
  SpotCard(
    id: 'spot_kadu_03',
    spotName: 'Kadu Malleshwara Temple',
    mapsLink: 'https://maps.google.com/?q=Kadu+Malleshwara+Temple+Bengaluru',
    infoParagraph:
        '17th-century stone temple built during Maratha rule that gave Malleshwaram its name.',
    photoUrls: [],
    openHours: '6:00 AM – 12:00 PM, 5:30 PM – 8:30 PM',
    practicalTips: 'Remove footwear at the courtyard gate before entering.',
    greetingCard: 'Namaskara',
    isTouristTrap: false,
    hourlyLimit: 20,
    currentVisitors: 3,
    vibeTags: ['Heritage', 'Temples & Crafts'],
    authenticityScore: 98,
    localSentimentSummary: 'Peaceful ancient courtyard surrounded by banyan trees.',
    remainingCapacity: 17,
    crowdLevel: 'LOW',
    formattedAddress: '15th Cross, Temple St, Malleshwaram, Bengaluru',
    primaryCategory: 'Heritage Temple',
    isVerified: true,
    isMockData: false,
    latitude: 13.007250,
    longitude: 77.571890,
    neighborhood: 'Malleshwaram',
    verificationTier: 'AI_EVIDENCE_CHECKED',
  ),
  SpotCard(
    id: 'spot_brahmins_04',
    spotName: "Brahmin's Coffee Bar",
    mapsLink: 'https://maps.google.com/?q=Brahmins+Coffee+Bar+Basavanagudi',
    infoParagraph:
        'Iconic 1965 Shankarapuram morning idli-vada and filter coffee counter.',
    photoUrls: [],
    openHours: '6:00 AM – 12:00 PM, 3:00 PM – 7:00 PM',
    practicalTips: 'Cash/UPI accepted at counter; try kesari bath early.',
    greetingCard: 'Ondu idli vada, ondu filter coffee kodi',
    isTouristTrap: false,
    hourlyLimit: 12,
    currentVisitors: 4,
    vibeTags: ['Heritage', 'Street Food', 'vintage_filter_coffee'],
    authenticityScore: 97,
    localSentimentSummary: 'Basavanagudi morning staple.',
    remainingCapacity: 8,
    crowdLevel: 'MODERATE',
    formattedAddress: 'Ranga Rao Rd, Shankarapuram, Basavanagudi, Bengaluru',
    primaryCategory: 'Heritage Tiffin',
    isVerified: true,
    isMockData: false,
    latitude: 12.9539,
    longitude: 77.5688,
    neighborhood: 'Basavanagudi',
    verificationTier: 'COMMUNITY_VERIFIED',
    contributedBy: ContributorAttribution(
      userId: 'usr_priya_01',
      displayName: 'Priya Sharma',
      badgeTitle: 'Neighborhood Insider',
      reputationTier: 'HERITAGE_SAGE',
      approvedGemsCount: 5,
      isVerifiedResident: true,
    ),
  ),
];

class FakeSpotService extends SpotService {
  final List<SpotCard> spots;
  FakeSpotService({List<SpotCard>? spots}) : spots = spots ?? testFixtureSpots;

  @override
  Future<List<SpotCard>> getVerifiedSpots({String? neighborhood}) async {
    if (neighborhood == null || neighborhood.isEmpty) return spots;
    final lower = neighborhood.toLowerCase();
    final filtered = spots
        .where((s) =>
            s.neighborhood.toLowerCase().contains(lower) ||
            s.formattedAddress.toLowerCase().contains(lower) ||
            s.spotName.toLowerCase().contains(lower))
        .toList();
    return filtered.isNotEmpty ? filtered : spots;
  }
}

class FakeTravelerService extends TravelerService {
  final FakeSpotService _fakeSpotService;
  TravelerPreferencesDocument _prefs = TravelerPreferencesDocument(
    userId: 'usr_test_traveler',
    favoriteVibes: const ['heritage', 'vintage_filter_coffee', 'street_food'],
    dietaryRestrictions: const ['vegetarian'],
    budgetTier: BudgetTier.moderate,
    maxBudgetPerMealInr: 250,
    preferredPacing: TravelPacing.balanced,
    preferredNeighborhoods: const ['Malleshwaram', 'Basavanagudi'],
    accessibilityNeeds: const [],
    updatedAt: DateTime(2026, 11, 20),
  );

  FakeTravelerService({FakeSpotService? spotService})
      : _fakeSpotService = spotService ?? FakeSpotService(),
        super(spotService: spotService ?? FakeSpotService());

  @override
  TravelerPreferencesDocument get currentPreferences => _prefs;

  @override
  Future<TravelerPreferencesDocument> loadPreferencesFromBackend() async => _prefs;

  @override
  Future<void> updatePreferences(TravelerPreferencesDocument newPrefs) async {
    _prefs = newPrefs;
  }

  @override
  Future<List<SpotCard>> getDiscoveredPlaces({
    required TravelerPreferencesDocument preferences,
    String? neighborhoodFilter,
    bool isGroupMode = false,
    String? activeGroupSessionId,
    int partySize = 1,
  }) async {
    return _fakeSpotService.getVerifiedSpots(neighborhood: neighborhoodFilter);
  }
}

class FakeRouteService extends RouteService {
  FakeRouteService({super.db});

  static WalkingRoute buildDefaultFixtureRoute() {
    return const WalkingRoute(
      routeId: 'route_malleshwaram_heritage_01',
      title: 'Malleshwaram Heritage & Coffee Trail',
      neighborhood: 'Malleshwaram',
      theme: 'Heritage / Culinary Walking Trail',
      origin: NormalizedCoordinate(
        latitude: 12.998242,
        longitude: 77.570953,
        precision: 6,
        formatted: '12.998242, 77.570953',
      ),
      destination: NormalizedCoordinate(
        latitude: 13.007250,
        longitude: 77.571890,
        precision: 6,
        formatted: '13.007250, 77.571890',
      ),
      waypoints: [
        NormalizedCoordinate(
          latitude: 13.000851,
          longitude: 77.569421,
          precision: 6,
          formatted: '13.000851, 77.569421',
        ),
        NormalizedCoordinate(
          latitude: 13.004120,
          longitude: 77.571430,
          precision: 6,
          formatted: '13.004120, 77.571430',
        ),
      ],
      waypointPlaceIds: [
        'place_ctr_malleshwaram_01',
        'place_veena_stores_02',
        'place_kadu_temple_03',
      ],
      optimizedWaypointOrder: [0, 1, 2],
      totalDistanceMeters: 1150,
      totalDurationSeconds: 870,
      formattedDistance: '1.1 km',
      formattedDuration: '15 mins',
      encodedPolyline:
          '_{znAw`~xMg@g@eAo@m@e@u@o@_Am@wA}@y@w@u@aAk@q@k@_Am@g@_{~jA}w_sMrAiB`@q@nAoBvB}CxAgBh@_@dAs@nBy@',
      legs: [
        RouteLeg(
          startPlaceId: 'place_ctr_malleshwaram_01',
          endPlaceId: 'place_veena_stores_02',
          distanceMeters: 450,
          durationSeconds: 340,
          startCoordinate: NormalizedCoordinate(
            latitude: 12.998242,
            longitude: 77.570953,
            formatted: '12.998242, 77.570953',
          ),
          endCoordinate: NormalizedCoordinate(
            latitude: 13.000851,
            longitude: 77.569421,
            formatted: '13.000851, 77.569421',
          ),
          steps: [
            RouteStep(
              instruction: 'Head north on Margosa Rd toward 7th Cross Rd',
              distanceMeters: 200,
              durationSeconds: 150,
              startCoordinate: NormalizedCoordinate(
                latitude: 12.998242,
                longitude: 77.570953,
                formatted: '12.998242, 77.570953',
              ),
              endCoordinate: NormalizedCoordinate(
                latitude: 12.999900,
                longitude: 77.570400,
                formatted: '12.999900, 77.570400',
              ),
            ),
            RouteStep(
              instruction: 'Turn left onto 8th Cross Rd into Flower Market',
              distanceMeters: 250,
              durationSeconds: 190,
              startCoordinate: NormalizedCoordinate(
                latitude: 12.999900,
                longitude: 77.570400,
                formatted: '12.999900, 77.570400',
              ),
              endCoordinate: NormalizedCoordinate(
                latitude: 13.000851,
                longitude: 77.569421,
                formatted: '13.000851, 77.569421',
              ),
            ),
          ],
        ),
        RouteLeg(
          startPlaceId: 'place_veena_stores_02',
          endPlaceId: 'place_kadu_temple_03',
          distanceMeters: 700,
          durationSeconds: 530,
          startCoordinate: NormalizedCoordinate(
            latitude: 13.000851,
            longitude: 77.569421,
            formatted: '13.000851, 77.569421',
          ),
          endCoordinate: NormalizedCoordinate(
            latitude: 13.007250,
            longitude: 77.571890,
            formatted: '13.007250, 77.571890',
          ),
          steps: [
            RouteStep(
              instruction: 'Walk north on Temple St toward Kadu Malleshwara Temple',
              distanceMeters: 700,
              durationSeconds: 530,
              startCoordinate: NormalizedCoordinate(
                latitude: 13.000851,
                longitude: 77.569421,
                formatted: '13.000851, 77.569421',
              ),
              endCoordinate: NormalizedCoordinate(
                latitude: 13.007250,
                longitude: 77.571890,
                formatted: '13.007250, 77.571890',
              ),
            ),
          ],
        ),
      ],
      isMockData: false,
      createdAt: '2026-11-20T08:30:00.000Z',
      updatedAt: '2026-11-20T08:30:00.000Z',
    );
  }

  static WalkingRoute buildPlanBFixtureRoute() {
    return const WalkingRoute(
      routeId: 'route_malleshwaram_plan_b_02',
      title: 'Malleshwaram Uncrowded Garden & Coffee Bypass',
      neighborhood: 'Malleshwaram',
      theme: 'Quiet Alley & Filter Coffee Detour',
      origin: NormalizedCoordinate(
        latitude: 12.998242,
        longitude: 77.570953,
        precision: 6,
        formatted: '12.998242, 77.570953',
      ),
      destination: NormalizedCoordinate(
        latitude: 13.007250,
        longitude: 77.571890,
        precision: 6,
        formatted: '13.007250, 77.571890',
      ),
      waypoints: [
        NormalizedCoordinate(
          latitude: 13.001500,
          longitude: 77.568900,
          precision: 6,
          formatted: '13.001500, 77.568900',
        ),
      ],
      waypointPlaceIds: [
        'place_janatha_deluxe_alt',
        'place_kadu_temple_03',
      ],
      optimizedWaypointOrder: [0, 1],
      totalDistanceMeters: 950,
      totalDurationSeconds: 720,
      formattedDistance: '950 m',
      formattedDuration: '12 mins',
      encodedPolyline: '_{znAw`~xMg@g@eAo@m@e@u@o@_Am@wA}@y@w@u@aAk@q@k@_Am@g@',
      legs: [
        RouteLeg(
          startPlaceId: 'place_janatha_deluxe_alt',
          endPlaceId: 'place_kadu_temple_03',
          distanceMeters: 950,
          durationSeconds: 720,
          startCoordinate: NormalizedCoordinate(
            latitude: 13.001500,
            longitude: 77.568900,
            formatted: '13.001500, 77.568900',
          ),
          endCoordinate: NormalizedCoordinate(
            latitude: 13.007250,
            longitude: 77.571890,
            formatted: '13.007250, 77.571890',
          ),
          steps: [
            RouteStep(
              instruction: 'Diverted via 9th Cross residential alley to avoid CTR queue',
              distanceMeters: 400,
              durationSeconds: 300,
              startCoordinate: NormalizedCoordinate(
                latitude: 13.001500,
                longitude: 77.568900,
                formatted: '13.001500, 77.568900',
              ),
              endCoordinate: NormalizedCoordinate(
                latitude: 13.003500,
                longitude: 77.570200,
                formatted: '13.003500, 77.570200',
              ),
            ),
            RouteStep(
              instruction: 'Continue north to Kadu Malleshwara Temple court',
              distanceMeters: 550,
              durationSeconds: 420,
              startCoordinate: NormalizedCoordinate(
                latitude: 13.003500,
                longitude: 77.570200,
                formatted: '13.003500, 77.570200',
              ),
              endCoordinate: NormalizedCoordinate(
                latitude: 13.007250,
                longitude: 77.571890,
                formatted: '13.007250, 77.571890',
              ),
            ),
          ],
        ),
      ],
      isMockData: false,
      createdAt: '2026-11-20T08:35:00.000Z',
      updatedAt: '2026-11-20T08:35:00.000Z',
    );
  }

  @override
  Future<WalkingRoute> getPersonalizedRoute({
    required List<String> placeIds,
    List<SpotCard>? spots,
    String routeTitle = 'Walking Trail',
    String neighborhood = 'Malleshwaram',
  }) async {
    return buildDefaultFixtureRoute();
  }

  @override
  Future<WalkingRoute> requestPlanBAlternative({
    required String originalRouteId,
    required String constrainedPlaceId,
    WalkingRoute? originalRoute,
    String disruptionType = 'VENUE_OVERCROWDED',
    String? disruptionDescription,
    bool preferIndoorAlternatives = false,
  }) async {
    return buildPlanBFixtureRoute();
  }

  @override
  Future<Map<String, dynamic>> reportVenueCrowd({
    required String placeId,
    required String crowdLevel,
    int estimatedWaitMinutes = 0,
    bool isVerifiedResident = false,
  }) async {
    return {
      'status': 'SUCCESS',
      'placeId': placeId,
      'crowdLevel': crowdLevel,
      'pointsAwarded': isVerifiedResident ? 25 : 10,
      'reportedAt': DateTime.now().toIso8601String(),
    };
  }

  @override
  Future<List<DisruptionAlert>> getActiveDisruptions({WalkingRoute? route}) async {
    return const [
      DisruptionAlert(
        disruptionId: 'disrupt_ctr_crowd_01',
        impactedPlaceId: 'place_ctr_malleshwaram_01',
        impactedRouteIds: ['route_malleshwaram_heritage_01'],
        type: 'OVERCROWDED_THROTTLED',
        severity: 'REROUTE_RECOMMENDED',
        description:
            'Central Tiffin Room is currently at full capacity (12/12 visitors). 45-min queue on sidewalk.',
        alternativeOptions: [
          AlternativeOption(
            alternativePlaceId: 'place_veena_stores_02',
            alternativePlaceName: 'Veena Stores (Margosa Rd)',
            detourDistanceMeters: 180,
            indoorAlternative: false,
          ),
          AlternativeOption(
            alternativePlaceId: 'place_janatha_deluxe_alt',
            alternativePlaceName: 'Hotel Janatha (8th Cross)',
            detourDistanceMeters: 220,
            indoorAlternative: true,
          ),
        ],
        activeFrom: '2026-11-20T08:00:00.000Z',
        expiresAt: '2026-11-20T10:00:00.000Z',
      ),
    ];
  }
}

class FakeStreetAssistanceService extends StreetAssistanceService {
  @override
  Future<DynamicOrderingCardsResult> fetchDynamicOrderingCards({
    String? spotId,
    String? spotName,
    String neighborhood = 'Malleshwaram',
    String targetVendorType = 'street_stall',
    String targetLanguage = 'kn-IN',
    List<String>? menuHints,
    List<String>? dietaryRestrictions,
  }) async {
    return DynamicOrderingCardsResult(
      cards: getCulturalOrderingCards(),
      targetLanguage: targetLanguage,
      modelUsed: 'gemini-3.8-flash',
      isLiveAi: true,
    );
  }

  @override
  Future<String> askStreetCopilot(
    String query, {
    String neighborhood = 'Malleshwaram',
    String preferredLanguage = 'en-IN',
  }) async {
    final q = query.toLowerCase();
    if (q.contains('coffee') || q.contains('ctr') || q.contains('benne')) {
      return 'Shri Sagar (CTR) has been serving its signature benne dose since the 1920s. Order at the front counter first and collect your token.';
    }
    return 'Explore Malleshwaram heritage lanes, filter coffee counters, and temple courtyards with verified local crowd tips.';
  }

  @override
  Future<CameraTranslationResult> translateStreetImage(
    String imagePath, {
    String targetLanguage = 'en',
  }) async {
    return const CameraTranslationResult(
      detectedScript: 'Kannada (ಕನ್ನಡ)',
      originalText: 'ಶ್ರೀ ಸಾಗರ್ ಉಪಹಾರ ಗೃಹ — ಶುದ್ಧ ತುಪ್ಪ ಮತ್ತು ಬೆಣ್ಣೆ ದೋಸೆ',
      translatedText: 'Shri Sagar Refreshments — Pure Ghee & Butter Dose',
      culturalContext: 'Heritage signage of Central Tiffin Room in Malleshwaram.',
      engineLabel: 'Gemma 4 E2B On-Device Vision',
    );
  }
}

class FakeNativePlatformService extends NativePlatformService {
  @override
  Future<int> getAvailableDiskSpaceBytes() async => 8500 * 1024 * 1024;

  @override
  Future<DeviceNetworkStatus> getNetworkStatus() async => DeviceNetworkStatus.wifi;

  @override
  Future<AICoreAvailabilityResult> checkAICoreAvailability() async {
    return const AICoreAvailabilityResult(
      isAvailable: false,
      apiLevel: 34,
      isSupportedDevice: true,
      aicorePackageInstalled: false,
      statusMessage: 'AICORE_NOT_INSTALLED: com.google.android.aicore not present in test',
    );
  }

  @override
  Future<DeviceAICapabilities> getDeviceAICapabilities() async {
    return const DeviceAICapabilities(
      hasNpu: false,
      ramAvailableMb: 4096,
      aicoreVersion: 0,
      supportedFeatures: ['LITERT_LM_GEMMA4_E2B'],
      apiLevel: 34,
      totalRamMb: 8192,
      aicoreInstalled: false,
      npuDetectionSupported: false,
    );
  }

  @override
  Future<NativeAiStatus> getNativeAiStatus({String? modelPath}) async {
    return NativeAiStatus.aicoreNotInstalled;
  }

  @override
  Future<Map<String, dynamic>> checkModelProvisioning({String engine = 'GEMMA_GGUF'}) async {
    return {
      'engine': engine,
      'gemmaModelDownloaded': false,
      'gemmaModelPath': null,
      'gemmaSizeBytes': 0,
      'aicoreInstalled': false,
      'apiLevel': 34,
      'isProvisioned': false,
    };
  }

  @override
  Future<Map<String, dynamic>> summarizeOfflineNote({
    required String noteText,
    required String spotName,
    String language = 'en',
    String? modelPath,
  }) async {
    return {
      'success': false,
      'code': 'MODEL_NOT_DOWNLOADED',
      'isLocalInference': false,
      'modelUsed': 'NONE (Unassisted Fallback)',
      'summary': '',
      'keyHighlights': <String>[],
      'message': 'On-device model not downloaded yet.',
      'spotName': spotName,
      'language': language,
    };
  }

  @override
  Future<Map<String, dynamic>> extractOfflineKeywords({
    required String text,
    String? modelPath,
  }) async {
    return {
      'success': false,
      'code': 'MODEL_NOT_DOWNLOADED',
      'isLocalInference': false,
      'modelUsed': 'NONE (Unassisted Fallback)',
      'keywords': <String>[],
      'message': 'On-device keyword extraction model not downloaded yet.',
    };
  }

  @override
  Future<Map<String, dynamic>> executeOfflineInference({
    required String prompt,
    String engine = 'AICORE',
    String? modelPath,
  }) async {
    return {
      'success': false,
      'isLocalInference': false,
      'code': 'MODEL_NOT_DOWNLOADED',
      'message': 'On-device model binary for $engine is not downloaded yet.',
    };
  }

  @override
  Future<EdgeDeviceSupport> checkEdgeDeviceSupport() async {
    return const EdgeDeviceSupport(
      totalRamMb: 12288,
      freeStorageMb: 64000,
      gemmaE2bSupported: true,
      recommendedBackend: 'GPU',
      geminiNanoAvailable: false,
      gemmaModelDownloaded: false,
      gemmaLoaded: false,
      activeBackend: 'NONE',
    );
  }
}

class FakeContributionService extends ContributionService {
  static const ContributorVerificationProfile testContributorProfile =
      ContributorVerificationProfile(
    userId: 'usr_test_contributor',
    displayName: 'Aravinth S (Local Resident)',
    contributorTier: 'LOCAL_RESIDENT',
    reputationPoints: 340,
    spotsSubmittedCount: 5,
    spotsApprovedCount: 4,
    accuracyRate: 0.92,
    isVerifiedResident: true,
    neighborhoodOfResidency: 'Malleshwaram',
    earnedBadges: [],
    totalTipsReceivedInr: 1250,
  );

  final List<ContributionDocument> _items = [
    ContributionDocument(
      contributionId: 'contrib_fixture_1',
      submission: const ContributorSubmissionInput(
        mapsLink: 'https://maps.google.com/?cid=101',
        infoParagraph: 'Historic filter coffee roaster established in 1948.',
        contributorId: 'usr_test_contributor',
      ),
      status: ContributionStatus.verified,
      groundedPlaceId: 'place_blr_coffee_101',
      createdAt: DateTime(2026, 11, 17),
      updatedAt: DateTime(2026, 11, 18),
    ),
    ContributionDocument(
      contributionId: 'contrib_fixture_2',
      submission: const ContributorSubmissionInput(
        mapsLink: 'https://maps.google.com/?cid=102',
        infoParagraph: 'Authentic flower market alley near the temple.',
        contributorId: 'usr_test_contributor',
      ),
      status: ContributionStatus.aiAnalyzed,
      createdAt: DateTime(2026, 11, 19),
      updatedAt: DateTime(2026, 11, 19),
    ),
    ContributionDocument(
      contributionId: 'contrib_fixture_3',
      submission: const ContributorSubmissionInput(
        mapsLink: 'https://maps.google.com/?cid=103',
        infoParagraph: 'Commercial chain store claiming heritage recipes.',
        contributorId: 'usr_test_contributor',
      ),
      status: ContributionStatus.rejected,
      rejectionReason: 'Does not meet local artisanal heritage threshold.',
      createdAt: DateTime(2026, 11, 15),
      updatedAt: DateTime(2026, 11, 16),
    ),
  ];

  @override
  ContributorVerificationProfile get currentProfile => testContributorProfile;

  @override
  Future<ContributorVerificationProfile> loadCurrentContributorProfile() async =>
      testContributorProfile;

  @override
  Future<String> verifyContributorAuthorization() async =>
      testContributorProfile.userId;

  @override
  Future<ContributionDocument> submitContribution({
    required ContributorSubmissionInput input,
  }) async {
    final doc = ContributionDocument(
      contributionId: 'contrib_test_${DateTime.now().millisecondsSinceEpoch}',
      submission: input,
      status: ContributionStatus.submitted,
      createdAt: DateTime.now(),
      updatedAt: DateTime.now(),
    );
    _items.insert(0, doc);
    return doc;
  }

  @override
  Future<List<VoicePhotoAsset>> uploadMediaAssets({
    required String contributionId,
    required List<String> localPhotoPaths,
    String? localAudioPath,
    void Function(double progress, String statusMessage)? onProgress,
  }) async {
    onProgress?.call(1.0, 'Upload complete');
    return const [];
  }

  @override
  Stream<ContributionDocument> trackContributionPipeline(
    ContributionDocument initialDoc,
  ) async* {
    yield initialDoc;
    yield initialDoc.copyWith(
      status: ContributionStatus.aiAnalyzed,
      updatedAt: DateTime.now(),
    );
  }

  @override
  Future<List<ContributionDocument>> listMyContributions() async =>
      List.unmodifiable(_items);

  @override
  Future<ContributionDocument> getContributionStatus(String contributionId) async {
    return _items.firstWhere(
      (c) => c.contributionId == contributionId,
      orElse: () => _items.first,
    );
  }
}

class FakeMonetizationService extends MonetizationService {
  final List<RoutePass> _passes = [
    RoutePass(
      passId: 'pass_fixture_active_01',
      userId: 'usr_test_buyer',
      tier: PassTier.neighborhoodAllAccess,
      neighborhood: 'Malleshwaram',
      accessibleRouteIds: const ['route_malleshwaram_heritage_01'],
      pricePaidInr: 299.0,
      paymentMode: PaymentMode.live,
      status: PassStatus.active,
      perksIncluded: const RoutePassPerks(
        audioGuidanceUnlocked: true,
        offlinePackUnlocked: true,
        merchantPartnerDiscountPercent: 10,
      ),
      validFrom: DateTime.now().subtract(const Duration(days: 1)),
      validUntil: DateTime.now().add(const Duration(days: 6)),
      purchasedAt: DateTime.now().subtract(const Duration(days: 1)),
    ),
  ];

  @override
  Future<ContributorAttribution> getContributorAttribution({
    required String userId,
  }) async {
    return ContributorAttribution(
      userId: userId,
      displayName: 'Aravinth S (Local Resident)',
      reputationTier: 'HERITAGE_SAGE',
      badgeTitle: 'Neighborhood Insider',
      approvedGemsCount: 5,
      isVerifiedResident: true,
    );
  }

  @override
  Future<ContributorRewardLedger> getContributorRewardSummary({
    String? userId,
  }) async {
    return ContributorRewardLedger(
      userId: userId ?? 'usr_test_contributor',
      totalEarningsInr: 1250.0,
      availableBalanceInr: 850.0,
      withdrawnTotalInr: 400.0,
      unrecoveredAdjustmentInr: 0.0,
      payoutUpiId: 'aravinth@okhdfcbank',
      reputationPoints: 340,
      guidanceRank: 'Malleshwaram Heritage Master',
      updatedAt: DateTime.now(),
    );
  }

  @override
  Future<({ContributorTip tip, PaymentIntent paymentIntent})> initiateTip({
    required String recipientUserId,
    required String spotId,
    required String spotName,
    required double amountInr,
    String? personalNote,
  }) async {
    if (amountInr <= 0) {
      throw ArgumentError('Tip amount must be positive.');
    }
    final tipId = 'tip_test_${DateTime.now().millisecondsSinceEpoch}';
    final platformFee = (amountInr * 0.05).roundToDouble();
    final netEarnings = amountInr - platformFee;
    final tip = ContributorTip(
      tipId: tipId,
      payerUserId: 'usr_test_payer',
      recipientUserId: recipientUserId,
      spotId: spotId,
      spotName: spotName,
      amountInr: amountInr,
      platformFeeInr: platformFee,
      contributorNetInr: netEarnings,
      paymentMode: PaymentMode.sandbox,
      paymentStatus: TipPaymentStatus.initiated,
      paymentGatewayReference: 'order_test_$tipId',
      personalNote: personalNote,
      createdAt: DateTime.now(),
    );
    final intent = PaymentIntent(
      transactionId: tipId,
      gatewayReference: tip.paymentGatewayReference!,
      amountInr: amountInr,
      currency: 'INR',
      mode: PaymentMode.sandbox,
      qrPayload: 'upi://pay?pa=test@upi&am=$amountInr&tn=$tipId',
    );
    return (tip: tip, paymentIntent: intent);
  }

  @override
  Future<({ContributorTip tip, ContributorRewardLedger rewardLedger, bool isIdempotentReplay})>
      settleTip({
    required String tipId,
    String? simulatedOutcome,
    String? providerPaymentId,
    String? providerSignature,
  }) async {
    if (simulatedOutcome == 'FAILURE') {
      throw PaymentSettlementException(
        'Payment verification failed in test fake.',
        transactionId: tipId,
      );
    }
    final settledTip = ContributorTip(
      tipId: tipId,
      payerUserId: 'usr_test_payer',
      recipientUserId: 'usr_test_contributor',
      spotId: 'spot_101',
      spotName: 'CTR Shri Sagar',
      amountInr: 100.0,
      platformFeeInr: 5.0,
      contributorNetInr: 95.0,
      paymentMode: PaymentMode.live,
      paymentStatus: TipPaymentStatus.completed,
      paymentGatewayReference: providerPaymentId ?? 'pay_test_$tipId',
      createdAt: DateTime.now(),
      settledAt: DateTime.now(),
    );
    final ledger = ContributorRewardLedger(
      userId: 'usr_test_contributor',
      totalEarningsInr: 1345.0,
      availableBalanceInr: 945.0,
      withdrawnTotalInr: 400.0,
      unrecoveredAdjustmentInr: 0.0,
      reputationPoints: 350,
      guidanceRank: 'Malleshwaram Heritage Master',
      updatedAt: DateTime.now(),
    );
    return (tip: settledTip, rewardLedger: ledger, isIdempotentReplay: false);
  }

  @override
  Future<({RoutePass pass, PaymentIntent paymentIntent})> purchaseRoutePass({
    required PassTier tier,
    required String neighborhood,
    List<String>? accessibleRouteIds,
  }) async {
    final passId = 'pass_${neighborhood.toLowerCase()}_${DateTime.now().millisecondsSinceEpoch}';
    final price = tier == PassTier.singleRoute
        ? 99.0
        : (tier == PassTier.annualExplorer ? 999.0 : 299.0);
    final pass = RoutePass(
      passId: passId,
      userId: 'usr_test_buyer',
      tier: tier,
      neighborhood: neighborhood,
      accessibleRouteIds: accessibleRouteIds ?? const ['route_malleshwaram_heritage_01'],
      pricePaidInr: price,
      currency: 'INR',
      paymentMode: PaymentMode.sandbox,
      paymentGatewayReference: 'order_pass_$passId',
      status: PassStatus.pending,
      perksIncluded: const RoutePassPerks(
        audioGuidanceUnlocked: true,
        offlinePackUnlocked: true,
        merchantPartnerDiscountPercent: 10,
      ),
      validFrom: DateTime.now(),
      validUntil: DateTime.now().add(const Duration(days: 7)),
      purchasedAt: DateTime.now(),
    );
    final intent = PaymentIntent(
      transactionId: passId,
      gatewayReference: pass.paymentGatewayReference!,
      amountInr: price,
      currency: 'INR',
      mode: PaymentMode.sandbox,
    );
    _passes.add(pass);
    return (pass: pass, paymentIntent: intent);
  }

  @override
  Future<({RoutePass pass, bool isIdempotentReplay})> confirmPassPayment({
    required String passId,
    String? simulatedOutcome,
    String? providerPaymentId,
    String? providerSignature,
  }) async {
    if (simulatedOutcome == 'FAILURE') {
      throw PaymentSettlementException(
        'Pass verification failed in test fake.',
        transactionId: passId,
      );
    }
    final activePass = RoutePass(
      passId: passId,
      userId: 'usr_test_buyer',
      tier: PassTier.neighborhoodAllAccess,
      neighborhood: 'Malleshwaram',
      accessibleRouteIds: const ['route_malleshwaram_heritage_01'],
      pricePaidInr: 299.0,
      paymentMode: PaymentMode.live,
      status: PassStatus.active,
      perksIncluded: const RoutePassPerks(
        audioGuidanceUnlocked: true,
        offlinePackUnlocked: true,
        merchantPartnerDiscountPercent: 10,
      ),
      validFrom: DateTime.now(),
      validUntil: DateTime.now().add(const Duration(days: 7)),
      purchasedAt: DateTime.now(),
    );
    return (pass: activePass, isIdempotentReplay: false);
  }

  @override
  Future<List<RevenueShareEntry>> getContributorRevenueShares({String? userId}) async =>
      const [];

  @override
  Future<List<RoutePass>> listUserPasses() async => List.unmodifiable(_passes);

  @override
  Future<RoutePassAccessResult> verifyRoutePassAccess({
    String? routeId,
    String? neighborhood,
  }) async {
    return RoutePassAccessResult(
      hasAccess: true,
      unlockedAudio: true,
      unlockedOfflinePack: true,
      partnerDiscountPercent: 10,
      grantingPassId: _passes.first.passId,
    );
  }

  @override
  Future<PublicPartnerOffer?> getPublicPartnerMerchantOffer({
    required String merchantPlaceId,
  }) async {
    return PublicPartnerOffer(
      merchantPlaceId: merchantPlaceId,
      businessName: 'Veena Stores Malleshwaram',
      subscriptionPlan: 'VERIFIED_PARTNER',
      discountPercent: 10,
      discountTerms: '10% discount for route pass holders.',
      isActive: true,
    );
  }

  @override
  Future<Map<String, dynamic>> submitVerificationRequest({
    required String documentType,
    String? documentStoragePath,
    String? neighborhood,
    String? fullName,
    String? notes,
  }) async {
    return {
      'requestId': 'vrf_test_001',
      'status': 'PENDING_REVIEW',
      'submittedAt': DateTime.now().toIso8601String(),
    };
  }

  @override
  Future<Map<String, dynamic>> requestLocalGuidance({
    required String offeringId,
    required String scheduledDateTime,
    String? specialNotes,
  }) async {
    return {
      'bookingId': 'book_test_001',
      'offeringId': offeringId,
      'scheduledDateTime': scheduledDateTime,
      'status': 'PENDING_PAYMENT',
    };
  }

  @override
  Future<Map<String, dynamic>> confirmGuidancePayment({
    required String bookingId,
    String? simulatedOutcome,
  }) async {
    return {
      'bookingId': bookingId,
      'status': 'CONFIRMED',
      'paymentStatus': 'PAID_IN_ESCROW',
    };
  }

  @override
  Future<Map<String, dynamic>> registerPartnerSubscription({
    required String merchantPlaceId,
    required String businessName,
    required String contactEmail,
    required String subscriptionPlan,
    Map<String, dynamic>? activeDiscountOffer,
    int durationDays = 365,
  }) async {
    return {
      'subscription': {
        'subscriptionId': 'sub_test_001',
        'merchantPlaceId': merchantPlaceId,
        'businessName': businessName,
        'contactEmail': contactEmail,
        'subscriptionPlan': subscriptionPlan,
        'status': subscriptionPlan == 'COMMUNITY_FREE' ? 'ACTIVE' : 'PENDING_PAYMENT',
      },
      'isPendingPayment': subscriptionPlan != 'COMMUNITY_FREE',
    };
  }

  @override
  Future<Map<String, dynamic>> confirmPartnerSubscriptionPayment({
    required String subscriptionId,
    String? simulatedOutcome,
  }) async {
    return {
      'subscription': {
        'subscriptionId': subscriptionId,
        'status': 'ACTIVE',
      },
      'isIdempotentReplay': false,
    };
  }
}

/// Shared provider overrides for deterministic widget tests with zero mocks in `lib/`.
List<Override> buildTestProviderOverrides() {
  final fakeSpots = FakeSpotService();
  final fakeTraveler = FakeTravelerService(spotService: fakeSpots);
  final fakeRoute = FakeRouteService();
  final fakeAssist = FakeStreetAssistanceService();
  final fakeNative = FakeNativePlatformService();
  final fakeMonetization = FakeMonetizationService();
  final fakeContribution = FakeContributionService();

  return [
    sp.appDatabaseProvider.overrideWith((ref) {
      final db = AppDatabase(NativeDatabase.memory());
      ref.onDispose(() => db.close());
      return db;
    }),
    sp.spotServiceProvider.overrideWithValue(fakeSpots),
    travelerServiceProvider.overrideWithValue(fakeTraveler),
    routeServiceProvider.overrideWithValue(fakeRoute),
    streetAssistanceServiceProvider.overrideWithValue(fakeAssist),
    nativePlatformServiceProvider.overrideWithValue(fakeNative),
    offlinePackServiceProvider.overrideWith((ref) {
      final db = ref.watch(sp.appDatabaseProvider);
      return OfflinePackService(db: db, enableTileDownloads: false);
    }),
    mp.monetizationServiceProvider.overrideWithValue(fakeMonetization),
    sp.contributionServiceProvider.overrideWithValue(fakeContribution),
    mp.contributionServiceProvider.overrideWithValue(fakeContribution),
  ];
}
