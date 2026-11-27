import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/walking_route.dart';
import '../providers/spot_providers.dart';
import '../services/route_service.dart';
import '../services/street_assistance_service.dart';

final routeServiceProvider = Provider<RouteService>((ref) {
  final db = ref.watch(appDatabaseProvider);
  return RouteService(db: db);
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

  void setActiveRoute(WalkingRoute route) {
    state = AsyncValue.data(route);
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

  Future<void> applyPlanB(
    String constrainedPlaceId, {
    String disruptionType = 'VENUE_OVERCROWDED',
    String? disruptionDescription,
    bool preferIndoorAlternatives = false,
  }) async {
    final current = state.valueOrNull;
    if (current == null) return;

    state = const AsyncValue.loading();
    try {
      final altRoute = await _service.requestPlanBAlternative(
        originalRouteId: current.routeId,
        constrainedPlaceId: constrainedPlaceId,
        originalRoute: current,
        disruptionType: disruptionType,
        disruptionDescription: disruptionDescription,
        preferIndoorAlternatives: preferIndoorAlternatives,
      );
      state = AsyncValue.data(altRoute);
    } catch (e, st) {
      state = AsyncValue.error(e, st);
    }
  }
}

/// Currently focused or selected route stop index
final selectedStopIndexProvider = StateProvider<int>((ref) => 0);

/// Active route venue constraints and disruptions evaluated live against active route
final activeDisruptionsProvider =
    FutureProvider<List<DisruptionAlert>>((ref) async {
  final service = ref.watch(routeServiceProvider);
  final route = ref.watch(activeRouteProvider).valueOrNull;
  return service.getActiveDisruptions(route: route);
});

/// Plan-B rerouting in progress state
final isRequestingPlanBProvider = StateProvider<bool>((ref) => false);

/// Audio guidance playing state
final isAudioPlayingProvider = StateProvider<bool>((ref) => false);
