import 'dart:convert';
import 'dart:typed_data';
import 'package:crypto/crypto.dart';
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

  group('Offline Pack Checksum & Ingestion Security Tests', () {
    test('valid SHA-256 byte payload ingests cleanly into SQLite', () async {
      const spot = OfflineSpotItem(
        id: 'spot_verified_dose',
        spotName: 'Verified Dose Spot',
        mapsLink: 'https://maps.google.com/?cid=99',
        infoParagraph: 'Authentic local breakfast.',
        photoUrlsJson: '[]',
        vibeTagsJson: '["breakfast"]',
        latitude: 12.998,
        longitude: 77.570,
        hasValidCoordinates: true,
      );

      final manifestData = {
        'packId': 'pack_valid_checksum',
        'neighborhood': 'Malleshwaram',
        'city': 'Bengaluru',
        'version': 1,
        'totalSpotsCount': 1,
        'totalRoutesCount': 0,
        'downloadSizeBytes': 0,
        'downloadUrl': 'https://example.com/pack.json',
        'sha256Checksum': '',
        'spots': [spot.toJson()],
        'routes': [],
        'publishedAt': '2026-11-20T10:00:00Z',
      };

      final payloadBytes = Uint8List.fromList(utf8.encode(jsonEncode(manifestData)));
      final expectedSha = sha256.convert(payloadBytes).toString().toLowerCase();

      final manifest = OfflinePackManifest.fromJson({
        ...manifestData,
        'downloadSizeBytes': payloadBytes.length,
        'sha256Checksum': expectedSha,
      });

      // Execute ingestion with exact matching raw bytes
      await service.downloadAndIngestPack(manifest, injectedBytes: payloadBytes);

      final spots = await service.getOfflineSpots(packId: 'pack_valid_checksum');
      expect(spots.length, 1);
      expect(spots.first.id, 'spot_verified_dose');

      final packs = await service.getDownloadedPacks();
      expect(packs.length, 1);
      expect(packs.first.packId, 'pack_valid_checksum');
      expect(packs.first.sha256Checksum, expectedSha);
    });

    test('corrupted raw byte payload throws PackChecksumMismatchException and aborts transaction', () async {
      const manifest = OfflinePackManifest(
        packId: 'pack_corrupt',
        neighborhood: 'Malleshwaram',
        city: 'Bengaluru',
        version: 1,
        totalSpotsCount: 1,
        totalRoutesCount: 0,
        downloadSizeBytes: 100,
        downloadUrl: 'https://example.com/corrupt.json',
        sha256Checksum: '1111222233334444555566667777888899990000aaaabbbbccccddddeeeeffff',
        publishedAt: '2026-11-20T10:00:00Z',
      );

      // Raw bytes that do NOT match the expected checksum
      final corruptedBytes = Uint8List.fromList(List.filled(100, 42));

      expect(
        () => service.downloadAndIngestPack(manifest, injectedBytes: corruptedBytes),
        throwsA(isA<PackChecksumMismatchException>()),
      );

      // Verify no records committed
      final spots = await db.select(db.localSpots).get();
      expect(spots, isEmpty);

      final packs = await db.select(db.offlinePacks).get();
      expect(packs, isEmpty);
    });

    test('byte size mismatch throws PackSizeMismatchException and aborts', () async {
      const manifest = OfflinePackManifest(
        packId: 'pack_wrong_size',
        neighborhood: 'Malleshwaram',
        city: 'Bengaluru',
        version: 1,
        totalSpotsCount: 1,
        totalRoutesCount: 0,
        downloadSizeBytes: 500, // Expected 500 bytes
        downloadUrl: 'https://example.com/wrong.json',
        sha256Checksum: 'some_hash',
        publishedAt: '2026-11-20T10:00:00Z',
      );

      // Payload has only 50 bytes
      final wrongSizeBytes = Uint8List.fromList(List.filled(50, 1));

      expect(
        () => service.downloadAndIngestPack(manifest, injectedBytes: wrongSizeBytes),
        throwsA(isA<PackSizeMismatchException>()),
      );
    });
  });
}
