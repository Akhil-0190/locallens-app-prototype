import 'dart:convert';
import 'dart:typed_data';
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

  group('Shared Spots & Many-to-Many Pack Retention Tests', () {
    test('shared spot is preserved when one pack is deleted, and removed only when all referencing packs are deleted', () async {
      // Shared spot
      const sharedSpot = OfflineSpotItem(
        id: 'spot_shared_dose',
        spotName: 'Heritage Dose Corner',
        mapsLink: 'https://maps.google.com/?cid=1',
        infoParagraph: 'Famous breakfast.',
        photoUrlsJson: '[]',
        vibeTagsJson: '["breakfast"]',
        latitude: 12.998,
        longitude: 77.570,
        hasValidCoordinates: true,
      );

      // Pack A unique spot
      const packASpot = OfflineSpotItem(
        id: 'spot_pack_a_temple',
        spotName: 'Ancient Kadu Temple',
        mapsLink: 'https://maps.google.com/?cid=2',
        infoParagraph: 'Historic temple.',
        photoUrlsJson: '[]',
        vibeTagsJson: '["heritage"]',
        latitude: 13.001,
        longitude: 77.569,
        hasValidCoordinates: true,
      );

      // Pack B unique spot
      const packBSpot = OfflineSpotItem(
        id: 'spot_pack_b_market',
        spotName: 'Sampige Flower Market',
        mapsLink: 'https://maps.google.com/?cid=3',
        infoParagraph: 'Bustling traditional market.',
        photoUrlsJson: '[]',
        vibeTagsJson: '["market"]',
        latitude: 13.003,
        longitude: 77.571,
        hasValidCoordinates: true,
      );

      // Pack A manifest
      const packA = OfflinePackManifest(
        packId: 'pack_malleshwaram_heritage',
        neighborhood: 'Malleshwaram',
        city: 'Bengaluru',
        version: 1,
        totalSpotsCount: 2,
        totalRoutesCount: 0,
        downloadSizeBytes: 0,
        downloadUrl: '',
        sha256Checksum: '',
        spots: [sharedSpot, packASpot],
        publishedAt: '2026-11-20T10:00:00Z',
      );

      // Pack B manifest (shares sharedSpot)
      const packB = OfflinePackManifest(
        packId: 'pack_malleshwaram_food',
        neighborhood: 'Malleshwaram',
        city: 'Bengaluru',
        version: 1,
        totalSpotsCount: 2,
        totalRoutesCount: 0,
        downloadSizeBytes: 0,
        downloadUrl: '',
        sha256Checksum: '',
        spots: [sharedSpot, packBSpot],
        publishedAt: '2026-11-20T10:00:00Z',
      );

      // 1. Ingest both packs
      await service.downloadAndIngestPack(
        packA,
        injectedBytes: Uint8List.fromList(utf8.encode(jsonEncode(packA.toJson()))),
      );
      await service.downloadAndIngestPack(
        packB,
        injectedBytes: Uint8List.fromList(utf8.encode(jsonEncode(packB.toJson()))),
      );

      // Verify all 3 spots are present in LocalSpots
      var allSpots = await db.select(db.localSpots).get();
      expect(allSpots.length, 3);

      // Verify PackSpots junction entries (Pack A has 2, Pack B has 2 = total 4 links)
      var allJoins = await db.select(db.packSpots).get();
      expect(allJoins.length, 4);

      // 2. Delete Pack A
      await service.deletePack('pack_malleshwaram_heritage');

      // Verify: packASpot should be DELETED (orphaned)
      final spotA = await (db.select(db.localSpots)..where((s) => s.id.equals('spot_pack_a_temple'))).get();
      expect(spotA, isEmpty);

      // Verify: sharedSpot MUST BE RETAINED because Pack B still references it!
      final spotShared = await (db.select(db.localSpots)..where((s) => s.id.equals('spot_shared_dose'))).get();
      expect(spotShared.length, 1);
      expect(spotShared.first.spotName, 'Heritage Dose Corner');

      // Verify: Pack B spot is still present
      final spotB = await (db.select(db.localSpots)..where((s) => s.id.equals('spot_pack_b_market'))).get();
      expect(spotB.length, 1);

      // 3. Delete Pack B
      await service.deletePack('pack_malleshwaram_food');

      // Now sharedSpot has 0 referencing packs and should be safely deleted
      final spotSharedAfterB = await (db.select(db.localSpots)..where((s) => s.id.equals('spot_shared_dose'))).get();
      expect(spotSharedAfterB, isEmpty);

      allSpots = await db.select(db.localSpots).get();
      expect(allSpots, isEmpty);
    });
  });
}
