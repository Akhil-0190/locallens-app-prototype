import 'package:firebase_auth/firebase_auth.dart';
import '../models/spot_card.dart';
import '../models/traveler_preferences.dart';
import 'group_capacity_service.dart';
import 'spot_service.dart';

/// Gateway service for live traveler preferences, Gemini Embedding 2 solo/group
/// discovery matchmaking, live weather context, and Firestore spot queries.
class TravelerService {
  final GroupCapacityService _groupCapacityService;
  final SpotService _spotService;

  TravelerService({
    GroupCapacityService? groupCapacityService,
    SpotService? spotService,
  })  : _groupCapacityService = groupCapacityService ?? GroupCapacityService(),
        _spotService = spotService ?? SpotService();

  TravelerPreferencesDocument _currentPreferences = TravelerPreferencesDocument(
    userId: _resolveCurrentUid(),
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

  static String _resolveCurrentUid() {
    try {
      return FirebaseAuth.instance.currentUser?.uid ?? 'unauthenticated';
    } catch (_) {
      return 'unauthenticated';
    }
  }

  TravelerPreferencesDocument get currentPreferences => _currentPreferences;

  WeatherContextModel? lastWeatherContext;
  GroupBlendSummaryModel? lastGroupBlendSummary;
  String lastSlotId = GroupCapacityService.deriveSlotId();

  Future<TravelerPreferencesDocument> loadPreferencesFromBackend() async {
    try {
      final fetched = await _groupCapacityService.fetchPreferences();
      if (fetched != null) {
        _currentPreferences = fetched;
      }
    } catch (_) {
      // Keep local preference state if backend unreachable
    }
    return _currentPreferences;
  }

  Future<void> updatePreferences(TravelerPreferencesDocument newPrefs) async {
    _currentPreferences = newPrefs;
    try {
      _currentPreferences = await _groupCapacityService.savePreferences(newPrefs);
    } catch (_) {
      // Local state already updated; backend retry occurs on next save
    }
  }

  /// Calls live `Discovery-matchGroupSpots` (when in active Group Session) or
  /// `Discovery-matchSoloSpots` (Gemini Embedding 2 + live weather + live hourly crowd caps).
  Future<List<SpotCard>> getDiscoveredPlaces({
    required TravelerPreferencesDocument preferences,
    String? neighborhoodFilter,
    bool isGroupMode = false,
    String? activeGroupSessionId,
    int partySize = 1,
  }) async {
    try {
      final DiscoveryMatchResult matchResult =
          (isGroupMode && activeGroupSessionId != null && activeGroupSessionId.isNotEmpty)
              ? await _groupCapacityService.matchGroupSpots(
                  sessionId: activeGroupSessionId,
                  neighborhood: neighborhoodFilter,
                )
              : await _groupCapacityService.matchSoloSpots(
                  preferences: preferences,
                  neighborhood: neighborhoodFilter,
                  partySize: partySize,
                );

      lastWeatherContext = matchResult.weather;
      lastGroupBlendSummary = matchResult.groupBlend;
      lastSlotId = matchResult.slotId;

      if (matchResult.spots.isNotEmpty) {
        return matchResult.spots;
      }
    } catch (_) {
      // Fall through to direct Firestore / Drift offline spots read
    }

    // Fallback to live Firestore / local Drift cache via SpotService
    final verifiedSpots = await _spotService.getVerifiedSpots(
      neighborhood: neighborhoodFilter,
    );
    if (neighborhoodFilter != null && neighborhoodFilter.isNotEmpty) {
      final hoodLower = neighborhoodFilter.toLowerCase();
      return verifiedSpots.where((place) {
        return place.formattedAddress.toLowerCase().contains(hoodLower) ||
            place.neighborhood.toLowerCase().contains(hoodLower) ||
            place.mapsLink.toLowerCase().contains(hoodLower);
      }).toList();
    }
    return verifiedSpots;
  }
}
