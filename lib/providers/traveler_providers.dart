import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/spot_card.dart';
import '../models/traveler_preferences.dart';
import '../services/group_capacity_service.dart';
import '../services/traveler_service.dart';
import 'spot_providers.dart';

/// Live Stage 2 Group & Capacity Cloud Functions / Firestore service provider
final groupCapacityServiceProvider = Provider<GroupCapacityService>((ref) {
  return GroupCapacityService();
});

/// Gateway service provider
final travelerServiceProvider = Provider<TravelerService>((ref) {
  final groupCap = ref.watch(groupCapacityServiceProvider);
  final spotService = ref.watch(spotServiceProvider);
  return TravelerService(
    groupCapacityService: groupCap,
    spotService: spotService,
  );
});

/// StateNotifier for Domain 02 Traveler Preferences (synced with `Preferences-updatePreferences`)
class TravelerPreferencesNotifier
    extends StateNotifier<TravelerPreferencesDocument> {
  final TravelerService _service;

  TravelerPreferencesNotifier(this._service)
      : super(_service.currentPreferences) {
    _hydrateFromBackend();
  }

  Future<void> _hydrateFromBackend() async {
    final loaded = await _service.loadPreferencesFromBackend();
    if (mounted) {
      state = loaded;
    }
  }

  void updatePreferences(TravelerPreferencesDocument newPreferences) {
    state = newPreferences;
    _service.updatePreferences(newPreferences);
  }

  void toggleVibe(String vibe) {
    final currentVibes = List<String>.from(state.favoriteVibes);
    if (currentVibes.contains(vibe)) {
      currentVibes.remove(vibe);
    } else {
      currentVibes.add(vibe);
    }
    updatePreferences(state.copyWith(favoriteVibes: currentVibes));
  }

  void toggleDietary(String diet) {
    final currentDiets = List<String>.from(state.dietaryRestrictions);
    if (currentDiets.contains(diet)) {
      currentDiets.remove(diet);
    } else {
      currentDiets.add(diet);
    }
    updatePreferences(state.copyWith(dietaryRestrictions: currentDiets));
  }

  void setBudgetTier(BudgetTier tier, int maxInr) {
    updatePreferences(state.copyWith(
      budgetTier: tier,
      maxBudgetPerMealInr: maxInr,
    ));
  }

  void setPacing(TravelPacing pacing) {
    updatePreferences(state.copyWith(preferredPacing: pacing));
  }

  void toggleNeighborhood(String neighborhood) {
    final currentHoods = List<String>.from(state.preferredNeighborhoods);
    if (currentHoods.contains(neighborhood)) {
      currentHoods.remove(neighborhood);
    } else {
      currentHoods.add(neighborhood);
    }
    updatePreferences(state.copyWith(preferredNeighborhoods: currentHoods));
  }

  void toggleAccessibility(String need) {
    final currentNeeds = List<String>.from(state.accessibilityNeeds);
    if (currentNeeds.contains(need)) {
      currentNeeds.remove(need);
    } else {
      currentNeeds.add(need);
    }
    updatePreferences(state.copyWith(accessibilityNeeds: currentNeeds));
  }
}

final travelerPreferencesProvider = StateNotifierProvider<
    TravelerPreferencesNotifier, TravelerPreferencesDocument>((ref) {
  final service = ref.watch(travelerServiceProvider);
  return TravelerPreferencesNotifier(service);
});

/// Domain 09 Group Mode State
/// false = Solo Explorer, true = Group Vibe
final isGroupModeProvider = StateProvider<bool>((ref) => false);

/// Active live Firestore Group Session (created or joined via 6-char code)
final activeGroupSessionProvider = StateProvider<GroupSessionModel?>((ref) => null);

/// Latest live weather context returned from `Discovery-matchSoloSpots` / `matchGroupSpots`
final discoveryWeatherProvider = StateProvider<WeatherContextModel?>((ref) => null);

/// Latest live Group Consensus Blend summary returned from `Discovery-matchGroupSpots`
final groupBlendSummaryProvider = StateProvider<GroupBlendSummaryModel?>((ref) => null);

/// Map of `placeId -> BookedVisitModel` for active user hourly slot reservations
final bookedVisitsProvider = StateProvider<Map<String, BookedVisitModel>>((ref) => const {});

/// Active Neighborhood Filter for Discovery Screen (null = All)
final selectedNeighborhoodFilterProvider = StateProvider<String?>((ref) => null);

/// FutureProvider supplying discovered places from live Gemini Embedding 2 Solo/Group Matchmaking
final discoverySpotsProvider = FutureProvider<List<SpotCard>>((ref) async {
  final service = ref.watch(travelerServiceProvider);
  final preferences = ref.watch(travelerPreferencesProvider);
  final neighborhood = ref.watch(selectedNeighborhoodFilterProvider);
  final isGroupMode = ref.watch(isGroupModeProvider);
  final activeGroup = ref.watch(activeGroupSessionProvider);
  final partySize = activeGroup != null
      ? activeGroup.members.length
      : ref.watch(groupSizeProvider);

  final spots = await service.getDiscoveredPlaces(
    preferences: preferences,
    neighborhoodFilter: neighborhood,
    isGroupMode: isGroupMode,
    activeGroupSessionId: activeGroup?.sessionId,
    partySize: partySize,
  );

  // Sync live weather & group blend metadata for banners
  Future.microtask(() {
    ref.read(discoveryWeatherProvider.notifier).state = service.lastWeatherContext;
    ref.read(groupBlendSummaryProvider.notifier).state = service.lastGroupBlendSummary;
  });

  return spots;
});
