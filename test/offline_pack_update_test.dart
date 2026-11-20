import 'dart:convert';
import 'dart:typed_data';
import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:locallens/database/app_database.dart';
import 'package:locallens/models/offline_pack.dart';
import 'package:locallens/models/walking_route.dart';
import 'package:locallens/services/offline_pack_service.dart';

void main() {
  late AppDatabase db;
  late OfflinePackService service;

  setUp(() {
    db = AppDatabase(NativeDatabase.memory());
    service = OfflinePackService(db: db);
  });

  tearDown(() async {
    await db.close();
  });

  group('Atomic Pack Version Update & Reconciliation Tests', () {
    test('updating a pack replaces spots/routes, reconciles memberships, and purges orphaned items', () async {
      const spot1 = OfflineSpotItem(
        id: 'spot_1',
        spotName: 'Spot One (Original)',
        mapsLink: 'https://maps.google.com/?cid=1',
        infoParagraph: 'Spot 1 info',
        photoUrlsJson: '[]',
        vibeTagsJson: '[]',
        latitude: 12.99,
        longitude: 77.57,
        hasValidCoordinates: true,
      );

      const spot2 = OfflineSpotItem(
        id: 'spot_2',
        spotName: 'Spot Two',
        mapsLink: 'https://maps.google.com/?cid=2',
        infoParagraph: 'Spot 2 info',
        photoUrlsJson: '[]',
        vibeTagsJson: '[]',
        latitude: 12.992,
        longitude: 77.572,
        hasValidCoordinates: true,
      );

      const spot3 = OfflineSpotItem(
        id: 'spot_3',
        spotName: 'Spot Three (Added in V2)',
        mapsLink: 'https://maps.google.com/?cid=3',
        infoParagraph: 'Spot 3 info',
        photoUrlsJson: '[]',
        vibeTagsJson: '[]',
        latitude: 12.995,
        longitude: 77.575,
        hasValidCoordinates: true,
      );

      const route1 = WalkingRoute(
        routeId: 'route_1',
        title: 'Route 1 (V1)',
        neighborhood: 'Malleshwaram',
        theme: 'Heritage',
        origin: NormalizedCoordinate(latitude: 12.99, longitude: 77.57, formatted: '12.99, 77.57'),
        destination: NormalizedCoordinate(latitude: 12.992, longitude: 77.572, formatted: '12.992, 77.572'),
        waypoints: [],
        waypointPlaceIds: ['spot_1', 'spot_2'],
        optimizedWaypointOrder: [0],
        totalDistanceMeters: 500,
        totalDurationSeconds: 400,
        formattedDistance: '500 m',
        formattedDuration: '6 mins',
        encodedPolyline: '_{znAw`~xM',
        legs: [],
        isMockData: false,
        createdAt: '2026-11-20T10:00:00Z',
        updatedAt: '2026-11-20T10:00:00Z',
      );

      const route2 = WalkingRoute(
        routeId: 'route_2',
        title: 'Route 2 (V2 Replacement)',
        neighborhood: 'Malleshwaram',
        theme: 'Culinary Walk',
        origin: NormalizedCoordinate(latitude: 12.992, longitude: 77.572, formatted: '12.992, 77.572'),
        destination: NormalizedCoordinate(latitude: 12.995, longitude: 77.575, formatted: '12.995, 77.575'),
        waypoints: [],
        waypointPlaceIds: ['spot_2', 'spot_3'],
        optimizedWaypointOrder: [0],
        totalDistanceMeters: 650,
        totalDurationSeconds: 520,
        formattedDistance: '650 m',
        formattedDuration: '8 mins',
        encodedPolyline: '_{znAw`~xM_expanded',
        legs: [],
        isMockData: false,
        createdAt: '2026-11-20T12:00:00Z',
        updatedAt: '2026-11-20T12:00:00Z',
      );

      // Version 1 of pack: has spot_1, spot_2, route_1
      const packV1 = OfflinePackManifest(
        packId: 'pack_malleshwaram',
        neighborhood: 'Malleshwaram',
        city: 'Bengaluru',
        version: 1,
        totalSpotsCount: 2,
        totalRoutesCount: 1,
        downloadSizeBytes: 0,
        downloadUrl: '',
        sha256Checksum: '',
        spots: [spot1, spot2],
        routes: [route1],
        publishedAt: '2026-11-20T10:00:00Z',
      );

      // 1. Ingest V1
      await service.downloadAndIngestPack(
        packV1,
        injectedBytes: Uint8List.fromList(utf8.encode(jsonEncode(packV1.toJson()))),
      );

      var spots = await db.select(db.localSpots).get();
      expect(spots.length, 2);
      expect(spots.map((s) => s.id).toSet(), {'spot_1', 'spot_2'});

      var routes = await db.select(db.localRoutes).get();
      expect(routes.length, 1);
      expect(routes.first.routeId, 'route_1');

      var packRow = await (db.select(db.offlinePacks)..where((p) => p.packId.equals('pack_malleshwaram'))).getSingle();
      expect(packRow.version, 1);

      // Version 2 of pack: spot_1 removed, spot_2 retained, spot_3 added; route_1 replaced by route_2
      const packV2 = OfflinePackManifest(
        packId: 'pack_malleshwaram',
        neighborhood: 'Malleshwaram',
        city: 'Bengaluru',
        version: 2,
        totalSpotsCount: 2,
        totalRoutesCount: 1,
        downloadSizeBytes: 0,
        downloadUrl: '',
        sha256Checksum: '',
        spots: [spot2, spot3],
        routes: [route2],
        publishedAt: '2026-11-20T12:00:00Z',
      );

      // 2. Ingest V2 (Update)
      await service.downloadAndIngestPack(
        packV2,
        injectedBytes: Uint8List.fromList(utf8.encode(jsonEncode(packV2.toJson()))),
      );

      // Verify pack registry upgraded to version 2
      packRow = await (db.select(db.offlinePacks)..where((p) => p.packId.equals('pack_malleshwaram'))).getSingle();
      expect(packRow.version, 2);

      // Verify spot_1 was purged (orphaned), spot_2 was retained, spot_3 was added
      spots = await db.select(db.localSpots).get();
      expect(spots.length, 2);
      expect(spots.map((s) => s.id).toSet(), {'spot_2', 'spot_3'});

      // Verify route_1 was purged (orphaned) and route_2 is active
      routes = await db.select(db.localRoutes).get();
      expect(routes.length, 1);
      expect(routes.first.routeId, 'route_2');
      expect(routes.first.title, 'Route 2 (V2 Replacement)');
    });
  });
}
