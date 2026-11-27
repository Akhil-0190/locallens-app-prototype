import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:locallens/database/app_database.dart';
import 'package:locallens/models/walking_route.dart';
import 'package:locallens/services/offline_pack_service.dart';

void main() {
  late AppDatabase db;
  late OfflinePackService service;

  setUp(() {
    db = AppDatabase(NativeDatabase.memory());
    service = OfflinePackService(db: db, enableTileDownloads: false);
  });

  tearDown(() async {
    await db.close();
  });

  group('Domain 08 Canonical Route 18-Field Preservation Tests', () {
    test('all 18 fields of CanonicalRouteDocument round-trip to LocalRoutes SQLite without loss', () async {
      const step1 = RouteStep(
        instruction: 'Head north on Margosa Road toward 8th Cross',
        distanceMeters: 250,
        durationSeconds: 190,
        startCoordinate: NormalizedCoordinate(latitude: 12.998242, longitude: 77.570953, formatted: '12.998242, 77.570953'),
        endCoordinate: NormalizedCoordinate(latitude: 13.000851, longitude: 77.569421, formatted: '13.000851, 77.569421'),
      );

      const leg1 = RouteLeg(
        startPlaceId: 'place_ctr_01',
        endPlaceId: 'place_kadu_02',
        distanceMeters: 450,
        durationSeconds: 340,
        startCoordinate: NormalizedCoordinate(latitude: 12.998242, longitude: 77.570953, formatted: '12.998242, 77.570953'),
        endCoordinate: NormalizedCoordinate(latitude: 13.000851, longitude: 77.569421, formatted: '13.000851, 77.569421'),
        steps: [step1],
      );

      const originalRoute = WalkingRoute(
        routeId: 'route_domain08_canonical_full_01',
        title: 'Malleshwaram Heritage & Coffee Trail',
        neighborhood: 'Malleshwaram',
        theme: 'Heritage / Culinary Walking Trail',
        origin: NormalizedCoordinate(
          latitude: 12.998242,
          longitude: 77.570953,
          precision: 6,
          formatted: '12.998242, 77.570953',
          isValid: true,
        ),
        destination: NormalizedCoordinate(
          latitude: 13.003125,
          longitude: 77.571012,
          precision: 6,
          formatted: '13.003125, 77.571012',
          isValid: true,
        ),
        waypoints: [
          NormalizedCoordinate(
            latitude: 13.000851,
            longitude: 77.569421,
            precision: 6,
            formatted: '13.000851, 77.569421',
            isValid: true,
          ),
        ],
        waypointPlaceIds: ['place_ctr_01', 'place_kadu_02'],
        optimizedWaypointOrder: [0], // Field 9: Preserved waypoint ordering
        totalDistanceMeters: 1150,
        totalDurationSeconds: 870,
        formattedDistance: '1.1 km',
        formattedDuration: '15 mins',
        encodedPolyline: '_{znAw`~xMg@g@eAo@m@e@u@o@_Am@wA}@y@w@u@aAk@q@k@_Am@g@',
        legs: [leg1],
        isMockData: false,
        createdAt: '2026-11-20T08:30:00.000Z',
        updatedAt: '2026-11-20T08:30:00.000Z',
      );

      // 1. Ingest route into LocalRoutes
      await db.into(db.localRoutes).insertOnConflictUpdate(originalRoute.toCompanion());

      // 2. Query back via WalkingRoute.fromLocalRoute
      final routes = await service.getOfflineRoutes();
      expect(routes.length, 1);
      final retrieved = routes.first;

      // Verify all 18 fields
      expect(retrieved.routeId, 'route_domain08_canonical_full_01');
      expect(retrieved.title, 'Malleshwaram Heritage & Coffee Trail');
      expect(retrieved.neighborhood, 'Malleshwaram');
      expect(retrieved.theme, 'Heritage / Culinary Walking Trail');
      expect(retrieved.origin.latitude, 12.998242);
      expect(retrieved.origin.longitude, 77.570953);
      expect(retrieved.destination.latitude, 13.003125);
      expect(retrieved.destination.longitude, 77.571012);
      expect(retrieved.waypoints.length, 1);
      expect(retrieved.waypoints.first.latitude, 13.000851);
      expect(retrieved.waypointPlaceIds, ['place_ctr_01', 'place_kadu_02']);
      expect(retrieved.optimizedWaypointOrder, [0]); // Verified preserved!
      expect(retrieved.totalDistanceMeters, 1150);
      expect(retrieved.totalDurationSeconds, 870);
      expect(retrieved.formattedDistance, '1.1 km');
      expect(retrieved.formattedDuration, '15 mins');
      expect(retrieved.encodedPolyline, '_{znAw`~xMg@g@eAo@m@e@u@o@_Am@wA}@y@w@u@aAk@q@k@_Am@g@');
      expect(retrieved.legs.length, 1);
      expect(retrieved.legs.first.startPlaceId, 'place_ctr_01');
      expect(retrieved.legs.first.steps.length, 1);
      expect(retrieved.legs.first.steps.first.instruction, 'Head north on Margosa Road toward 8th Cross');
      expect(retrieved.isMockData, isFalse);
      expect(retrieved.createdAt, '2026-11-20T08:30:00.000Z');
      expect(retrieved.updatedAt, '2026-11-20T08:30:00.000Z');
    });
  });
}
