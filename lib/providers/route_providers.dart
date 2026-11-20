import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/walking_route.dart';
import '../services/route_service.dart';
import '../services/street_assistance_service.dart';

final routeServiceProvider = Provider<RouteService>((ref) {
  return RouteService();
});

final streetAssistanceServiceProvider = Provider<StreetAssistanceService>((ref) {
  return StreetAssistanceService();
});

/// Async state for the active walking route
final activeRouteProvider =
    StateNotifierProvider<ActiveRouteNotifier, AsyncValue<WalkingRoute>>((ref) {
  final service = ref.watch(routeServiceProvider);
  return ActiveRouteNotifier(service);
});

class ActiveRouteNotifier extends StateNotifier<AsyncValue<WalkingRoute>> {
  final RouteService _service;

  ActiveRouteNotifier(this._service) : super(const AsyncValue.loading()) {
    loadDefaultRoute();
  }

  Future<void> loadDefaultRoute() async {
    state = const AsyncValue.loading();
    try {
      final route = await _service.getPersonalizedRoute(
        placeIds: [
          'place_ctr_malleshwaram_01',
          'place_veena_stores_02',
          'place_kadu_temple_03',
        ],
      );
      state = AsyncValue.data(route);
    } catch (e, st) {
      state = AsyncValue.error(e, st);
    }
  }

  Future<void> applyPlanB(String constrainedPlaceId) async {
    final current = state.valueOrNull;
    if (current == null) return;

    state = const AsyncValue.loading();
    try {
      final altRoute = await _service.requestPlanBAlternative(
        originalRouteId: current.routeId,
        constrainedPlaceId: constrainedPlaceId,
      );
      state = AsyncValue.data(altRoute);
    } catch (e, st) {
      state = AsyncValue.error(e, st);
    }
  }
}

/// Currently focused or selected route stop index
final selectedStopIndexProvider = StateProvider<int>((ref) => 0);

/// Active route venue constraints and disruptions
final activeDisruptionsProvider =
    FutureProvider<List<DisruptionAlert>>((ref) async {
  final service = ref.watch(routeServiceProvider);
  return service.getActiveDisruptions();
});

/// Plan-B rerouting in progress state
final isRequestingPlanBProvider = StateProvider<bool>((ref) => false);

/// Audio guidance playing state
final isAudioPlayingProvider = StateProvider<bool>((ref) => false);
