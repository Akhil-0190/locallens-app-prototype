import 'dart:io';
import 'dart:typed_data';
import 'package:flutter/services.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';

/// Offline TileProvider implementing Google Maps SDK TileProvider.
/// Serves legally pre-downloaded, OpenStreetMap-compatible raster tiles
/// from local pack storage or bundled fallback assets when offline.
///
/// Complies with tile server usage policies and OpenStreetMap licensing
/// (ODbL / CC-BY-SA) by enforcing local-only retrieval and clear attribution.
class LocalOfflineTileProvider implements TileProvider {
  final String packId;
  final int tileSize;
  final String? customTilesDirectory;
  final bool isTestMode;

  static const String osmAttribution = '© OpenStreetMap contributors';

  const LocalOfflineTileProvider({
    required this.packId,
    this.tileSize = 256,
    this.customTilesDirectory,
    this.isTestMode = false,
  });

  @override
  Future<Tile> getTile(int x, int y, int? zoom) async {
    if (zoom == null) return TileProvider.noTile;

    // Constrain to supported offline neighborhood zoom levels (e.g. 13 to 18)
    if (zoom < 12 || zoom > 19) {
      return TileProvider.noTile;
    }

    try {
      // 1. Check custom or application documents directory for downloaded pack tiles
      final localBytes = await _loadLocalTile(zoom, x, y);
      if (localBytes != null && localBytes.isNotEmpty) {
        return Tile(tileSize, tileSize, localBytes);
      }

      // 2. Check bundled asset fallback for sample neighborhood (Malleshwaram)
      final assetBytes = await _loadAssetTile(zoom, x, y);
      if (assetBytes != null && assetBytes.isNotEmpty) {
        return Tile(tileSize, tileSize, assetBytes);
      }
    } catch (_) {
      // Graceful fallback: return noTile on I/O or decode errors
    }

    return TileProvider.noTile;
  }

  Future<Uint8List?> _loadLocalTile(int zoom, int x, int y) async {
    if (isTestMode) return null;

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
