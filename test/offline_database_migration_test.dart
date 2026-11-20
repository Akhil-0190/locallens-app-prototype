import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:locallens/database/app_database.dart';
import 'package:locallens/models/offline_pack.dart';
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

  group('Drift Schema v2 & Coordinate Migration Tests', () {
    test('localSpots initialized with nullable coordinates and hasValidCoordinates=false', () async {
      // Insert a spot without coordinates (simulating migrated legacy record)
      await db.into(db.localSpots).insert(
            LocalSpotsCompanion.insert(
              id: 'legacy_spot_01',
              spotName: 'Legacy Corner Shop',
              mapsLink: 'https://maps.google.com/?cid=123',
              infoParagraph: 'A historic spot.',
              photoUrlsJson: '[]',
              vibeTagsJson: '[]',
            ),
          );

      final spots = await db.select(db.localSpots).get();
      expect(spots.length, 1);
      final spot = spots.first;
      expect(spot.id, 'legacy_spot_01');
      expect(spot.latitude, isNull);
      expect(spot.longitude, isNull);
      expect(spot.hasValidCoordinates, isFalse);
    });

    test('spatial filtering strictly excludes spots with unknown coordinates from genuine locations', () async {
      // 1. Insert ungrounded/legacy spot with null coordinates
      await db.into(db.localSpots).insert(
            LocalSpotsCompanion.insert(
              id: 'legacy_spot_02',
              spotName: 'Unmapped Tea Stall',
              mapsLink: '',
              infoParagraph: 'Somewhere in the market',
              photoUrlsJson: '[]',
              vibeTagsJson: '[]',
            ),
          );

      // 2. Ingest genuine spot with valid coordinates
      const genuineSpot = OfflineSpotItem(
        id: 'ctr_malleshwaram',
        spotName: 'Central Tiffin Room',
        mapsLink: 'https://maps.google.com/?cid=456',
        infoParagraph: 'Iconic dose place',
        photoUrlsJson: '[]',
        vibeTagsJson: '["heritage"]',
        latitude: 12.998242,
        longitude: 77.570953,
        hasValidCoordinates: true,
      );
      await db.into(db.localSpots).insertOnConflictUpdate(genuineSpot.toCompanion());

      // Query genuine spatial spots only
      final filteredSpots = await service.getOfflineSpots(onlyValidCoordinates: true);
      expect(filteredSpots.length, 1);
      expect(filteredSpots.first.id, 'ctr_malleshwaram');
      expect(filteredSpots.first.latitude, 12.998242);
      expect(filteredSpots.first.longitude, 77.570953);
      expect(filteredSpots.first.hasValidCoordinates, isTrue);

      // Verify legacy spot is NOT included
      final ungrounded = filteredSpots.where((s) => s.id == 'legacy_spot_02');
      expect(ungrounded, isEmpty);
    });
  });
}
