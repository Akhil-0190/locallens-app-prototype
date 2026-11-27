import 'dart:convert';
import 'dart:io';
import 'dart:math' as math;
import 'dart:typed_data' show BytesBuilder;
import 'package:flutter/painting.dart';
import 'package:flutter/services.dart';
import 'package:flutter_map/flutter_map.dart' as fmap;
import 'package:google_maps_flutter/google_maps_flutter.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';

/// 1x1 transparent PNG used cleanly when an offline map tile outside the cached
/// neighborhood bounding box is requested in Airplane Mode (zero network calls).
final Uint8List _kTransparentTilePng = base64Decode(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
);

/// Offline TileProvider implementing Google Maps SDK TileProvider.
/// Serves pre-downloaded, OpenStreetMap-compatible raster tiles from local disk storage.
class LocalOfflineTileProvider implements TileProvider {
  final String packId;
  final int tileSize;
  final String? customTilesDirectory;

  static const String osmAttribution = '© OpenStreetMap contributors';

  const LocalOfflineTileProvider({
    required this.packId,
    this.tileSize = 256,
    this.customTilesDirectory,
  });

  @override
  Future<Tile> getTile(int x, int y, int? zoom) async {
    if (zoom == null || zoom < 12 || zoom > 19) {
      return TileProvider.noTile;
    }

    try {
      final localBytes = await _loadLocalTile(zoom, x, y);
      if (localBytes != null && localBytes.isNotEmpty) {
        return Tile(tileSize, tileSize, localBytes);
      }

      final assetBytes = await _loadAssetTile(zoom, x, y);
      if (assetBytes != null && assetBytes.isNotEmpty) {
        return Tile(tileSize, tileSize, assetBytes);
      }
    } catch (_) {}

    return TileProvider.noTile;
  }

  Future<Uint8List?> _loadLocalTile(int zoom, int x, int y) async {
    try {
      String basePath;
      if (customTilesDirectory != null) {
        basePath = customTilesDirectory!;
      } else {
        final docsDir = await getApplicationDocumentsDirectory();
        basePath = p.join(docsDir.path, 'packs', packId, 'tiles');
      }

      final tileFile = File(p.join(basePath, '$zoom', '$x', '$y.png'));
      if (await tileFile.exists()) {
        return await tileFile.readAsBytes();
      }
    } catch (_) {}
    return null;
  }

  Future<Uint8List?> _loadAssetTile(int zoom, int x, int y) async {
    try {
      final assetPath = 'assets/offline_packs/$packId/tiles/$zoom/$x/$y.png';
      final byteData = await rootBundle.load(assetPath);
      return byteData.buffer.asUint8List();
    } catch (_) {
      return null;
    }
  }
}

/// Pure disk-backed `flutter_map` TileProvider for 100% offline Airplane Mode rendering.
/// Makes ZERO outbound HTTP requests; reads strictly from `<appDocs>/packs/<packId>/tiles/{z}/{x}/{y}.png`.
class LocalDiskFlutterMapTileProvider extends fmap.TileProvider {
  final String tilesBasePath;

  LocalDiskFlutterMapTileProvider({required this.tilesBasePath});

  @override
  ImageProvider getImage(
    fmap.TileCoordinates coordinates,
    fmap.TileLayer options,
  ) {
    final file = File(
      p.join(
        tilesBasePath,
        '${coordinates.z}',
        '${coordinates.x}',
        '${coordinates.y}.png',
      ),
    );
    if (file.existsSync()) {
      return FileImage(file);
    }
    return MemoryImage(_kTransparentTilePng);
  }
}

/// Downloads neighborhood OpenStreetMap raster tiles (zoom 14-16) into local pack storage
/// so `AdaptiveRouteMap` renders real street maps completely offline in Airplane Mode.
class OfflineTileDownloader {
  static Future<String> resolveTilesDirectory(String packId) async {
    final docsDir = await getApplicationDocumentsDirectory();
    return p.join(docsDir.path, 'packs', packId, 'tiles');
  }

  static int _lonToTileX(double lon, int zoom) {
    return ((lon + 180.0) / 360.0 * (1 << zoom)).floor();
  }

  static int _latToTileY(double lat, int zoom) {
    final latRad = lat * math.pi / 180.0;
    return ((1.0 -
                math.log(math.tan(latRad) + 1.0 / math.cos(latRad)) / math.pi) /
            2.0 *
            (1 << zoom))
        .floor();
  }

  /// Pre-caches up to [maxTiles] OSM raster PNGs covering the bounding box into local disk.
  static Future<int> downloadTilesForBounds({
    required String packId,
    required double north,
    required double south,
    required double east,
    required double west,
    int minZoom = 14,
    int maxZoom = 16,
    int maxTiles = 96,
    void Function(int completed, int total)? onProgress,
  }) async {
    final baseDirPath = await resolveTilesDirectory(packId);
    final coords = <({int z, int x, int y})>[];

    for (int z = minZoom; z <= maxZoom; z++) {
      final minX = _lonToTileX(west, z);
      final maxX = _lonToTileX(east, z);
      final minY = _latToTileY(north, z);
      final maxY = _latToTileY(south, z);

      for (int x = minX; x <= maxX; x++) {
        for (int y = minY; y <= maxY; y++) {
          coords.add((z: z, x: x, y: y));
          if (coords.length >= maxTiles) break;
        }
        if (coords.length >= maxTiles) break;
      }
      if (coords.length >= maxTiles) break;
    }

    if (coords.isEmpty) return 0;

    final client = HttpClient()
      ..userAgent = 'LocalLens-OfflinePack/1.0 (https://locallens.app)'
      ..connectionTimeout = const Duration(seconds: 8);

    int savedCount = 0;
    try {
      for (int i = 0; i < coords.length; i++) {
        final t = coords[i];
        final tileFile = File(p.join(baseDirPath, '${t.z}', '${t.x}', '${t.y}.png'));
        if (tileFile.existsSync() && tileFile.lengthSync() > 100) {
          savedCount++;
          onProgress?.call(i + 1, coords.length);
          continue;
        }

        try {
          final uri = Uri.parse('https://tile.openstreetmap.org/${t.z}/${t.x}/${t.y}.png');
          final req = await client.getUrl(uri);
          req.headers.set('User-Agent', 'LocalLens-OfflinePack/1.0 (com.innovotribe.locallens)');
          final res = await req.close();
          if (res.statusCode == HttpStatus.ok) {
            final bytesBuilder = BytesBuilder();
            await for (final chunk in res) {
              bytesBuilder.add(chunk);
            }
            final bytes = bytesBuilder.toBytes();
            if (bytes.length > 100) {
              await tileFile.parent.create(recursive: true);
              await tileFile.writeAsBytes(bytes, flush: false);
              savedCount++;
            }
          }
        } catch (_) {
          // Skip individual tile failure gracefully
        }
        onProgress?.call(i + 1, coords.length);
      }
    } finally {
      client.close();
    }

    return savedCount;
  }

  /// Removes all cached tiles for a deleted neighborhood pack.
  static Future<void> deletePackTiles(String packId) async {
    try {
      final baseDirPath = await resolveTilesDirectory(packId);
      final dir = Directory(baseDirPath);
      if (dir.existsSync()) {
        await dir.delete(recursive: true);
      }
    } catch (_) {}
  }
}
