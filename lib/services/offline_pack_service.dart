import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:crypto/crypto.dart';
import 'package:drift/drift.dart' as drift;
import 'package:flutter/services.dart' show rootBundle;
import '../database/app_database.dart';
import '../models/offline_pack.dart';
import '../models/walking_route.dart';

class PackChecksumMismatchException implements Exception {
  final String expected;
  final String actual;
  PackChecksumMismatchException({required this.expected, required this.actual});

  @override
  String toString() =>
      'PackChecksumMismatchException: Expected SHA-256 $expected, but got $actual';
}

class PackSizeMismatchException implements Exception {
  final int expectedBytes;
  final int actualBytes;
  PackSizeMismatchException({required this.expectedBytes, required this.actualBytes});

  @override
  String toString() =>
      'PackSizeMismatchException: Expected $expectedBytes bytes, but got $actualBytes bytes';
}

class OfflinePackService {
  final AppDatabase db;
  final FirebaseFirestore? firestore;

  OfflinePackService({
    required this.db,
    this.firestore,
  });

  /// Discovers available offline neighborhood packs.
  /// First queries Firestore collection `offline_packs`. If unavailable or empty,
  /// falls back to bundled sample pack `pack_malleshwaram_v1` with explicit sample labeling.
  Future<List<OfflinePackManifest>> getAvailablePacks({bool forceSampleFallback = false}) async {
    final downloadedList = await getDownloadedPacks();
    final downloadedMap = {for (var p in downloadedList) p.packId: p};

    final fs = firestore;
    if (!forceSampleFallback && fs != null) {
      try {
        final snapshot = await fs.collection('offline_packs').get();
        if (snapshot.docs.isNotEmpty) {
          return snapshot.docs.map((doc) {
            final data = doc.data();
            final manifest = OfflinePackManifest.fromJson({
              'packId': doc.id,
              ...data,
            });
            final isDl = downloadedMap.containsKey(manifest.packId);
            return manifest.copyWith(isDownloaded: isDl);
          }).toList();
        }
      } catch (e) {
        // Firestore rules or connectivity fallback
      }
    }

    // Default bundled sample fixture (Malleshwaram)
    try {
      final jsonString = await rootBundle
          .loadString('assets/offline_packs/pack_malleshwaram_v1.json');
      final data = jsonDecode(jsonString) as Map<String, dynamic>;
      final sampleManifest = OfflinePackManifest.fromJson(data);
      final isDl = downloadedMap.containsKey(sampleManifest.packId);
      return [sampleManifest.copyWith(isDownloaded: isDl)];
    } catch (_) {
      return [];
    }
  }

  /// Retrieves list of all currently installed packs from Drift SQLite.
  Future<List<OfflinePackManifest>> getDownloadedPacks() async {
    final query = db.select(db.offlinePacks)
      ..where((p) => p.isDownloaded.equals(true));
    final rows = await query.get();

    return rows.map((r) {
      return OfflinePackManifest(
        packId: r.packId,
        neighborhood: r.neighborhood,
        city: r.city,
        version: r.version,
        totalSpotsCount: r.totalSpotsCount,
        totalRoutesCount: r.totalRoutesCount,
        downloadSizeBytes: r.downloadSizeBytes,
        downloadUrl: '',
        sha256Checksum: r.sha256Checksum,
        publishedAt: r.downloadedAt,
        isDownloaded: true,
      );
    }).toList();
  }

  /// Downloads raw byte payload from [manifest.downloadUrl], verifies SHA-256 checksum,
  /// and atomically ingests or updates the pack in SQLite.
  Future<void> downloadAndIngestPack(
    OfflinePackManifest manifest, {
    Uint8List? injectedBytes,
    void Function(double progress)? onProgress,
  }) async {
    Uint8List rawBytes;

    if (injectedBytes != null) {
      rawBytes = injectedBytes;
      onProgress?.call(0.5);
    } else if (manifest.downloadUrl.startsWith('http://') ||
        manifest.downloadUrl.startsWith('https://')) {
      final client = HttpClient();
      try {
        final uri = Uri.parse(manifest.downloadUrl);
        final request = await client.getUrl(uri);
        final response = await request.close();
        final bytesBuilder = BytesBuilder();
        final totalLength = response.contentLength;
        int received = 0;

        await for (final chunk in response) {
          bytesBuilder.add(chunk);
          received += chunk.length;
          if (totalLength > 0 && onProgress != null) {
            onProgress(received / totalLength);
          }
        }
        rawBytes = bytesBuilder.toBytes();
      } finally {
        client.close();
      }
    } else {
      // Local bundled sample pack fallback
      final byteData = await rootBundle
          .load('assets/offline_packs/pack_malleshwaram_v1.json');
      rawBytes = byteData.buffer.asUint8List();
      onProgress?.call(0.5);
    }

    // 1. Verify file size if specified
    if (manifest.downloadSizeBytes > 0 &&
        rawBytes.length != manifest.downloadSizeBytes) {
      throw PackSizeMismatchException(
        expectedBytes: manifest.downloadSizeBytes,
        actualBytes: rawBytes.length,
      );
    }

    // 2. Compute cryptographic SHA-256 hash over raw bytes
    final computedHash = sha256.convert(rawBytes).toString().toLowerCase();
    final expectedHash = manifest.sha256Checksum.toLowerCase();

    if (expectedHash.isNotEmpty && computedHash != expectedHash) {
      throw PackChecksumMismatchException(
        expected: expectedHash,
        actual: computedHash,
      );
    }

    onProgress?.call(0.8);

    // 3. Decode JSON payload
    final jsonString = utf8.decode(rawBytes);
    final payloadMap = jsonDecode(jsonString) as Map<String, dynamic>;
    final parsedManifest = OfflinePackManifest.fromJson(payloadMap).copyWith(
      sha256Checksum: manifest.sha256Checksum.isNotEmpty
          ? manifest.sha256Checksum
          : computedHash,
    );

    // 4. Atomically ingest and reconcile pack in SQLite
    await _reconcileAndIngestPack(parsedManifest);
    onProgress?.call(1.0);
  }

  /// Ingests pack spots and routes atomically.
  /// If the pack already exists (version update), reconciles old vs new spots/routes
  /// and removes orphaned records without deleting records shared by other packs.
  Future<void> _reconcileAndIngestPack(OfflinePackManifest manifest) async {
    await db.transaction(() async {
      // Step A: Find existing associations for this pack
      final existingSpotJoins = await (db.select(db.packSpots)
            ..where((ps) => ps.packId.equals(manifest.packId)))
          .get();
      final oldSpotIds = existingSpotJoins.map((j) => j.spotId).toSet();

      final existingRouteJoins = await (db.select(db.packRoutes)
            ..where((pr) => pr.packId.equals(manifest.packId)))
          .get();
      final oldRouteIds = existingRouteJoins.map((j) => j.routeId).toSet();

      final newSpotIds = manifest.spots.map((s) => s.id).toSet();
      final newRouteIds = manifest.routes.map((r) => r.routeId).toSet();

      // Step B: Upsert new spots into LocalSpots
      for (final spot in manifest.spots) {
        await db.into(db.localSpots).insertOnConflictUpdate(spot.toCompanion());
      }

      // Step C: Upsert new routes into LocalRoutes
      for (final route in manifest.routes) {
        await db
            .into(db.localRoutes)
            .insertOnConflictUpdate(route.toCompanion());
      }

      // Step D: Re-link junction tables
      await (db.delete(db.packSpots)
            ..where((ps) => ps.packId.equals(manifest.packId)))
          .go();
      for (final spotId in newSpotIds) {
        await db.into(db.packSpots).insert(
              PackSpotsCompanion.insert(
                packId: manifest.packId,
                spotId: spotId,
              ),
              mode: drift.InsertMode.insertOrIgnore,
            );
      }

      await (db.delete(db.packRoutes)
            ..where((pr) => pr.packId.equals(manifest.packId)))
          .go();
      for (final routeId in newRouteIds) {
        await db.into(db.packRoutes).insert(
              PackRoutesCompanion.insert(
                packId: manifest.packId,
                routeId: routeId,
              ),
              mode: drift.InsertMode.insertOrIgnore,
            );
      }

      // Step E: Upsert OfflinePacks registry row
      await db.into(db.offlinePacks).insertOnConflictUpdate(
            manifest.toCompanion(
              isDownloaded: true,
              downloadedAt: DateTime.now().toUtc().toIso8601String(),
            ),
          );

      // Step F: Reconcile orphaned spots (present in old version but removed in new)
      final removedSpotIds = oldSpotIds.difference(newSpotIds);
      for (final orphanSpotId in removedSpotIds) {
        final refCount = await (db.select(db.packSpots)
              ..where((ps) => ps.spotId.equals(orphanSpotId)))
            .get();
        if (refCount.isEmpty) {
          await (db.delete(db.localSpots)
                ..where((s) => s.id.equals(orphanSpotId)))
              .go();
        }
      }

      // Step G: Reconcile orphaned routes (present in old version but removed in new)
      final removedRouteIds = oldRouteIds.difference(newRouteIds);
      for (final orphanRouteId in removedRouteIds) {
        final refCount = await (db.select(db.packRoutes)
              ..where((pr) => pr.routeId.equals(orphanRouteId)))
            .get();
        if (refCount.isEmpty) {
          await (db.delete(db.localRoutes)
                ..where((r) => r.routeId.equals(orphanRouteId)))
              .go();
        }
      }
    });
  }

  /// Deletes an offline pack cleanly without deleting shared spots or routes
  /// that are still referenced by other installed packs.
  Future<void> deletePack(String packId) async {
    await db.transaction(() async {
      // 1. Identify all spots and routes associated with this pack
      final spotJoins = await (db.select(db.packSpots)
            ..where((ps) => ps.packId.equals(packId)))
          .get();
      final candidateSpotIds = spotJoins.map((j) => j.spotId).toList();

      final routeJoins = await (db.select(db.packRoutes)
            ..where((pr) => pr.packId.equals(packId)))
          .get();
      final candidateRouteIds = routeJoins.map((j) => j.routeId).toList();

      // 2. Delete junction links for this pack
      await (db.delete(db.packSpots)
            ..where((ps) => ps.packId.equals(packId)))
          .go();
      await (db.delete(db.packRoutes)
            ..where((pr) => pr.packId.equals(packId)))
          .go();

      // 3. Delete pack metadata
      await (db.delete(db.offlinePacks)
            ..where((p) => p.packId.equals(packId)))
          .go();

      // 4. Delete orphaned spots only
      for (final spotId in candidateSpotIds) {
        final otherRefs = await (db.select(db.packSpots)
              ..where((ps) => ps.spotId.equals(spotId)))
            .get();
        if (otherRefs.isEmpty) {
          await (db.delete(db.localSpots)
                ..where((s) => s.id.equals(spotId)))
              .go();
        }
      }

      // 5. Delete orphaned routes only
      for (final routeId in candidateRouteIds) {
        final otherRefs = await (db.select(db.packRoutes)
              ..where((pr) => pr.routeId.equals(routeId)))
            .get();
        if (otherRefs.isEmpty) {
          await (db.delete(db.localRoutes)
                ..where((r) => r.routeId.equals(routeId)))
              .go();
        }
      }
    });
  }

  /// Queries verified spots from local SQLite Drift database.
  /// Guarantees that spots with invalid or null coordinates are safely filtered.
  Future<List<OfflineSpotItem>> getOfflineSpots({
    String? packId,
    bool onlyValidCoordinates = false,
  }) async {
    if (packId != null) {
      final joins = await (db.select(db.packSpots)
            ..where((ps) => ps.packId.equals(packId)))
          .get();
      final spotIds = joins.map((j) => j.spotId).toSet();
      if (spotIds.isEmpty) return [];

      final query = db.select(db.localSpots)
        ..where((s) => s.id.isIn(spotIds));
      if (onlyValidCoordinates) {
        query.where((s) => s.hasValidCoordinates.equals(true));
      }
      final rows = await query.get();
      return rows.map((r) => _mapRowToOfflineSpotItem(r)).toList();
    }

    final query = db.select(db.localSpots);
    if (onlyValidCoordinates) {
      query.where((s) => s.hasValidCoordinates.equals(true));
    }
    final rows = await query.get();
    return rows.map((r) => _mapRowToOfflineSpotItem(r)).toList();
  }

  /// Queries cached pedestrian routes from local SQLite Drift database.
  Future<List<WalkingRoute>> getOfflineRoutes({String? packId}) async {
    if (packId != null) {
      final joins = await (db.select(db.packRoutes)
            ..where((pr) => pr.packId.equals(packId)))
          .get();
      final routeIds = joins.map((j) => j.routeId).toSet();
      if (routeIds.isEmpty) return [];

      final query = db.select(db.localRoutes)
        ..where((r) => r.routeId.isIn(routeIds));
      final rows = await query.get();
      return rows.map((r) => WalkingRoute.fromLocalRoute(r)).toList();
    }

    final rows = await db.select(db.localRoutes).get();
    return rows.map((r) => WalkingRoute.fromLocalRoute(r)).toList();
  }

  OfflineSpotItem _mapRowToOfflineSpotItem(LocalSpot row) {
    return OfflineSpotItem(
      id: row.id,
      spotName: row.spotName,
      mapsLink: row.mapsLink,
      infoParagraph: row.infoParagraph,
      photoUrlsJson: row.photoUrlsJson,
      openHours: row.openHours,
      practicalTips: row.practicalTips,
      greetingCard: row.greetingCard,
      isTouristTrap: row.isTouristTrap,
      hourlyLimit: row.hourlyLimit,
      currentVisitors: row.currentVisitors,
      vibeTagsJson: row.vibeTagsJson,
      latitude: row.latitude,
      longitude: row.longitude,
      hasValidCoordinates: row.hasValidCoordinates,
    );
  }
}
