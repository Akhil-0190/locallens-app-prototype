import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/spot_card.dart';
import '../models/traveler_preferences.dart';
import '../services/traveler_service.dart';

/// Gateway service provider
final travelerServiceProvider = Provider<TravelerService>((ref) {
  return TravelerService();
});

/// StateNotifier for Domain 02 Traveler Preferences
class TravelerPreferencesNotifier
    extends StateNotifier<TravelerPreferencesDocument> {
  final TravelerService _service;

  TravelerPreferencesNotifier(this._service)
      : super(_service.currentPreferences);

  void updatePreferences(TravelerPreferencesDocument newPreferences) {
    _service.updatePreferences(newPreferences);
    state = newPreferences;
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

/// Domain 09 Group Mode State (Separate from Domain 02 Preferences to avoid schema contamination)
/// false = Solo Explorer, true = Group Vibe
final isGroupModeProvider = StateProvider<bool>((ref) => false);

/// Active Neighborhood Filter for Discovery Screen (null = All)
final selectedNeighborhoodFilterProvider = StateProvider<String?>((ref) => null);

/// FutureProvider supplying discovered places conforming to Domain 06
final discoverySpotsProvider = FutureProvider<List<SpotCard>>((ref) async {
  final service = ref.watch(travelerServiceProvider);
  final preferences = ref.watch(travelerPreferencesProvider);
  final neighborhood = ref.watch(selectedNeighborhoodFilterProvider);
  final isGroupMode = ref.watch(isGroupModeProvider);

  return service.getDiscoveredPlaces(
    preferences: preferences,
    neighborhoodFilter: neighborhood,
    isGroupMode: isGroupMode,
  );
});
