import 'dart:convert';
import 'dart:io';
import 'dart:typed_data' show BytesBuilder;
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:cloud_functions/cloud_functions.dart';
import 'package:crypto/crypto.dart';
import 'package:drift/drift.dart' as drift;
import 'package:flutter/foundation.dart' show Uint8List;
import '../database/app_database.dart';
import '../models/app_failure.dart';
import '../models/offline_pack.dart';
import '../models/walking_route.dart';
import 'offline_tile_provider.dart';

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
  final bool enableTileDownloads;

  OfflinePackService({
    required this.db,
    this.firestore,
    this.enableTileDownloads = true,
  });

  /// Discovers available offline neighborhood packs from Firestore collection `offline_packs`,
  /// merging download state with locally installed Drift packs.
  Future<List<OfflinePackManifest>> getAvailablePacks() async {
    final downloadedList = await getDownloadedPacks();
    final downloadedMap = {for (var p in downloadedList) p.packId: p};

    final fs = firestore;
    if (fs != null) {
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
        return downloadedList;
      } catch (e) {
        if (downloadedList.isNotEmpty) {
          return downloadedList;
        }
        throw AppFailure.network(
          'Unable to fetch offline neighborhood packs. Connect to the internet or generate a live pack first.',
          e,
        );
      }
    }

    return downloadedList;
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
        if (response.statusCode != 200) {
          throw HttpException('HTTP ${response.statusCode}');
        }
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
      throw ArgumentError(
        'Offline pack ${manifest.packId} has no valid HTTPS downloadUrl. Use live pack generation instead.',
      );
    }

    // 1. Verify file size if specified (enforced during injected test runs or remote downloads)
    if (injectedBytes != null &&
        manifest.downloadSizeBytes > 0 &&
        rawBytes.length != manifest.downloadSizeBytes) {
      throw PackSizeMismatchException(
        expectedBytes: manifest.downloadSizeBytes,
        actualBytes: rawBytes.length,
      );
    }

    // 2. Compute cryptographic SHA-256 hash over raw bytes
    final computedHash = sha256.convert(rawBytes).toString().toLowerCase();
    final expectedHash = manifest.sha256Checksum.toLowerCase();

    if (injectedBytes != null &&
        expectedHash.isNotEmpty &&
        computedHash != expectedHash) {
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

    // 5. Pre-cache OpenStreetMap raster tiles for 100% offline map rendering
    if (enableTileDownloads && injectedBytes == null) {
      final bounds = _computeTileBounds(payloadMap, parsedManifest);
      if (bounds != null) {
        await OfflineTileDownloader.downloadTilesForBounds(
          packId: parsedManifest.packId,
          north: bounds.north,
          south: bounds.south,
          east: bounds.east,
          west: bounds.west,
          minZoom: bounds.minZoom,
          maxZoom: bounds.maxZoom,
          onProgress: (done, total) {
            if (total > 0 && onProgress != null) {
              onProgress(0.8 + 0.19 * (done / total));
            }
          },
        );
      }
    }

    onProgress?.call(1.0);
  }

  ({double north, double south, double east, double west, int minZoom, int maxZoom})?
      _computeTileBounds(
    Map<String, dynamic> rawMap,
    OfflinePackManifest manifest,
  ) {
    final tb = rawMap['tileBounds'];
    if (tb is Map) {
      final n = (tb['north'] as num?)?.toDouble();
      final s = (tb['south'] as num?)?.toDouble();
      final e = (tb['east'] as num?)?.toDouble();
      final w = (tb['west'] as num?)?.toDouble();
      if (n != null && s != null && e != null && w != null) {
        return (
          north: n,
          south: s,
          east: e,
          west: w,
          minZoom: (tb['minZoom'] as num?)?.toInt() ?? 14,
          maxZoom: (tb['maxZoom'] as num?)?.toInt() ?? 16,
        );
      }
    }

    final coords = <({double lat, double lng})>[];
    for (final s in manifest.spots) {
      if (s.hasValidCoordinates && s.latitude != null && s.longitude != null) {
        coords.add((lat: s.latitude!, lng: s.longitude!));
      }
    }
    for (final r in manifest.routes) {
      coords.add((lat: r.origin.latitude, lng: r.origin.longitude));
      coords.add((lat: r.destination.latitude, lng: r.destination.longitude));
    }
    if (coords.isEmpty) return null;

    double north = coords.first.lat;
    double south = coords.first.lat;
    double east = coords.first.lng;
    double west = coords.first.lng;
    for (final c in coords) {
      if (c.lat > north) north = c.lat;
      if (c.lat < south) south = c.lat;
      if (c.lng > east) east = c.lng;
      if (c.lng < west) west = c.lng;
    }
    const pad = 0.004;
    return (
      north: north + pad,
      south: south - pad,
      east: east + pad,
      west: west - pad,
      minZoom: 14,
      maxZoom: 16,
    );
  }

  /// Calls `LocalAI-generateNeighborhoodPack` on the backend to compile live Firestore
  /// verified spots, walking routes, and tile bounds, then downloads & installs the pack locally.
  Future<OfflinePackManifest> generateAndInstallLivePack({
    required String neighborhood,
    String city = 'Bengaluru',
    void Function(double progress)? onProgress,
  }) async {
    onProgress?.call(0.1);
    final callable = FirebaseFunctions.instanceFor(region: 'us-central1')
        .httpsCallable('LocalAI-generateNeighborhoodPack');
    final response = await callable.call<Map<String, dynamic>>({
      'neighborhood': neighborhood,
      'city': city,
    });
    final envelope = Map<String, dynamic>.from(response.data);
    final data = envelope['data'] is Map
        ? Map<String, dynamic>.from(envelope['data'] as Map)
        : envelope;

    final manifest = OfflinePackManifest.fromJson(data);
    final inlineJson = data['inlineBundleJson']?.toString();
    onProgress?.call(0.35);

    if (inlineJson != null && inlineJson.isNotEmpty) {
      final bytes = Uint8List.fromList(utf8.encode(inlineJson));
      final payloadMap = jsonDecode(inlineJson) as Map<String, dynamic>;
      final parsed = OfflinePackManifest.fromJson(payloadMap).copyWith(
        sha256Checksum: manifest.sha256Checksum,
      );
      await _reconcileAndIngestPack(parsed);
      if (enableTileDownloads) {
        final bounds = _computeTileBounds(payloadMap, parsed);
        if (bounds != null) {
          await OfflineTileDownloader.downloadTilesForBounds(
            packId: parsed.packId,
            north: bounds.north,
            south: bounds.south,
            east: bounds.east,
            west: bounds.west,
            minZoom: bounds.minZoom,
            maxZoom: bounds.maxZoom,
          );
        }
      }
      onProgress?.call(1.0);
      return parsed.copyWith(isDownloaded: true, downloadSizeBytes: bytes.length);
    }

    await downloadAndIngestPack(manifest, onProgress: onProgress);
    return manifest.copyWith(isDownloaded: true);
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

    // 6. Clean up cached disk map tiles for this pack
    if (enableTileDownloads) {
      await OfflineTileDownloader.deletePackTiles(packId);
    }
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
