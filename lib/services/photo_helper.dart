import 'dart:convert';
import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

class PhotoHelper {
  static final ImagePicker _picker = ImagePicker();
  static final Map<int, Uint8List> _decodedCache = {};

  /// Picks an image, compresses it to ~25-45 KB, and returns a Base64 string.
  static Future<String?> pickAndCompressPhoto({
    ImageSource source = ImageSource.gallery,
  }) async {
    final XFile? file = await _picker.pickImage(
      source: source,
      maxWidth: 480,
      maxHeight: 480,
      imageQuality: 30,
    );

    if (file == null) return null;

    final Uint8List bytes = await file.readAsBytes();

    if (bytes.lengthInBytes > 250 * 1024) {
      throw Exception('Photo is too large even after compression. Try another image.');
    }

    final encoded = base64Encode(bytes);
    _decodedCache[encoded.hashCode] = bytes;
    return encoded;
  }

  /// Safely builds a cached widget from either a Base64 string or a network URL.
  static Widget buildPhotoWidget(
      String photoData, {
        double height = 160,
        double? width = double.infinity,
      }) {
    if (photoData.isEmpty) {
      return _fallbackBox(height, width);
    }

    if (photoData.startsWith('http')) {
      return Image.network(
        photoData,
        height: height,
        width: width,
        fit: BoxFit.cover,
        cacheWidth: 600,
        errorBuilder: (_, __, ___) => _fallbackBox(height, width),
      );
    }

    try {
      final cleanBase64 = photoData.contains(',')
          ? photoData.split(',').last.trim()
          : photoData.trim();

      final bytes = _decodedCache.putIfAbsent(
        cleanBase64.hashCode,
            () => base64Decode(cleanBase64),
      );

      return Image.memory(
        bytes,
        height: height,
        width: width,
        fit: BoxFit.cover,
        cacheWidth: 600,
        gaplessPlayback: true,
        errorBuilder: (_, __, ___) => _fallbackBox(height, width),
      );
    } catch (_) {
      return _fallbackBox(height, width);
    }
  }

  static Widget _fallbackBox(double height, double? width) {
    return Container(
      height: height,
      width: width,
      color: Colors.grey.shade200,
      alignment: Alignment.center,
      child: const Icon(Icons.broken_image, color: Colors.grey),
    );
  }
}