import '../models/walking_route.dart';

/// Client route service providing walking routes and alternative (Plan-B) paths.
///
/// INTEGRATION BOUNDARY:
/// - Developer C owns Google Routes API generation and stop sequencing (C3 merged in backend).
/// - Developer C owns venue hourly capacity and rerouting decision logic (C4).
/// - Developer D presents supplied route responses and user-triggered Plan-B selections.
/// - Clearly discloses sample responses adhering to Domain 08 and Domain 07 contracts.
class RouteService {
  static const bool useMockRoutes = true;

  /// Returns canonical walking route matching C3 SAMPLE_NORMALIZED_WALKING_ROUTE fixture.
  Future<WalkingRoute> getPersonalizedRoute({
    required List<String> placeIds,
  }) async {
    // Simulate network delay
    await Future.delayed(const Duration(milliseconds: 300));

    // Canonical Malleshwaram Heritage & Coffee Trail matching Domain 08 contract sample
    return WalkingRoute(
      routeId: 'route_malleshwaram_heritage_01',
      title: 'Malleshwaram Heritage & Coffee Trail',
      neighborhood: 'Malleshwaram',
      theme: 'Heritage / Culinary Walking Trail',
      origin: const NormalizedCoordinate(
        latitude: 12.998242,
        longitude: 77.570953,
        precision: 6,
        formatted: '12.998242, 77.570953',
      ),
      destination: const NormalizedCoordinate(
        latitude: 13.007250,
        longitude: 77.571890,
        precision: 6,
        formatted: '13.007250, 77.571890',
      ),
      waypoints: const [
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
      waypointPlaceIds: const [
        'place_ctr_malleshwaram_01',
        'place_veena_stores_02',
        'place_kadu_temple_03',
      ],
      optimizedWaypointOrder: const [0, 1, 2],
      totalDistanceMeters: 1150,
      totalDurationSeconds: 870,
      formattedDistance: '1.1 km',
      formattedDuration: '15 mins',
      encodedPolyline: '_{znAw`~xMg@g@eAo@m@e@u@o@_Am@wA}@y@w@u@aAk@q@k@_Am@g@_{~jA}w_sMrAiB`@q@nAoBvB}CxAgBh@_@dAs@nBy@',
      legs: const [
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
      isMockData: true,
      createdAt: '2026-11-20T08:30:00.000Z',
      updatedAt: '2026-11-20T08:30:00.000Z',
    );
  }

  /// Requests a Plan-B alternative route from supplied C4 disruption response.
  /// Does not compute rerouting client-side; returns supplied alternative path.
  Future<WalkingRoute> requestPlanBAlternative({
    required String originalRouteId,
    required String constrainedPlaceId,
  }) async {
    await Future.delayed(const Duration(milliseconds: 400));

    return WalkingRoute(
      routeId: 'route_malleshwaram_plan_b_02',
      title: 'Malleshwaram Uncrowded Garden & Coffee Bypass',
      neighborhood: 'Malleshwaram',
      theme: 'Quiet Alley & Filter Coffee Detour',
      origin: const NormalizedCoordinate(
        latitude: 12.998242,
        longitude: 77.570953,
        precision: 6,
        formatted: '12.998242, 77.570953',
      ),
      destination: const NormalizedCoordinate(
        latitude: 13.007250,
        longitude: 77.571890,
        precision: 6,
        formatted: '13.007250, 77.571890',
      ),
      waypoints: const [
        NormalizedCoordinate(
          latitude: 13.001500,
          longitude: 77.568900,
          precision: 6,
          formatted: '13.001500, 77.568900',
        ),
      ],
      waypointPlaceIds: const [
        'place_janatha_deluxe_alt',
        'place_kadu_temple_03',
      ],
      optimizedWaypointOrder: const [0, 1],
      totalDistanceMeters: 950,
      totalDurationSeconds: 720,
      formattedDistance: '950 m',
      formattedDuration: '12 mins',
      encodedPolyline: '_{znAw`~xMg@g@eAo@m@e@u@o@_Am@wA}@y@w@u@aAk@q@k@_Am@g@',
      legs: const [
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
      isMockData: true,
      createdAt: '2026-11-20T08:35:00.000Z',
      updatedAt: '2026-11-20T08:35:00.000Z',
    );
  }

  /// Returns sample active venue disruptions matching Domain 07 contract.
  Future<List<DisruptionAlert>> getActiveDisruptions() async {
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
