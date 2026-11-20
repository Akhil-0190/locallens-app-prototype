import 'dart:async';
import 'dart:io';
import 'package:crypto/crypto.dart';
import 'package:path_provider/path_provider.dart';
import 'native_platform_service.dart';

enum ModelDownloadStatus {
  notDownloaded,
  checkingStorage,
  downloading,
  verifyingChecksum,
  ready,
  error,
  cancelled,
}

class ModelDownloadProgress {
  final int bytesDownloaded;
  final int totalBytes;
  final double progressPercent;
  final ModelDownloadStatus status;
  final String? errorMessage;

  const ModelDownloadProgress({
    this.bytesDownloaded = 0,
    this.totalBytes = 3344000000,
    this.progressPercent = 0.0,
    this.status = ModelDownloadStatus.notDownloaded,
    this.errorMessage,
  });
}

/// Offline Model Manager for pinned Gemma 4 E2B GGUF weights.
///
/// SPECIFICATIONS (Developer B / B6 Contract):
/// - Repository: unsloth/gemma-4-E2B-it-GGUF
/// - Revision: 90f9618340396838ee7ff5b0ba2da27da62953d3
/// - File: gemma-4-E2B-it-Q4_K_M.gguf
/// - Size: 3,344,000,000 bytes (~3.11 GB)
/// - SHA-256: 740185b21d22ceb83a11c3aa62ad5842ef32c70f6096d756bbee85a1e4ec34b8
class OfflineModelManager {
  static const String modelFileName = 'gemma-4-E2B-it-Q4_K_M.gguf';
  static const int expectedSizeBytes = 3344000000;
  static const String expectedSha256 =
      '740185b21d22ceb83a11c3aa62ad5842ef32c70f6096d756bbee85a1e4ec34b8';
  static const String downloadUrl =
      'https://huggingface.co/unsloth/gemma-4-E2B-it-GGUF/resolve/90f9618340396838ee7ff5b0ba2da27da62953d3/gemma-4-E2B-it-Q4_K_M.gguf';

  static const int minRequiredDiskSpaceMb = 5000;

  final NativePlatformService _platformService;
  final HttpClient _httpClient;
  bool _isCancelled = false;

  OfflineModelManager({
    NativePlatformService? platformService,
    HttpClient? httpClient,
  })  : _platformService = platformService ?? NativePlatformService(),
        _httpClient = httpClient ?? HttpClient();

  /// Gets the absolute File handle where the model is or will be stored.
  Future<File> getModelFile() async {
    final docsDir = await getApplicationDocumentsDirectory();
    final modelsDir = Directory('${docsDir.path}/models');
    if (!modelsDir.existsSync()) {
      modelsDir.createSync(recursive: true);
    }
    return File('${modelsDir.path}/$modelFileName');
  }

  /// Checks if the model file is downloaded and matches the SHA-256 checksum.
  Future<bool> isModelReady() async {
    final file = await getModelFile();
    if (!file.existsSync()) return false;
    if (file.lengthSync() != expectedSizeBytes) return false;

    // Verify SHA-256
    return await verifyChecksum(file);
  }

  /// Verifies the SHA-256 hash of the target model file.
  Future<bool> verifyChecksum(File file) async {
    if (!file.existsSync()) return false;
    try {
      final digest = await sha256.bind(file.openRead()).first;
      return digest.toString().toLowerCase() == expectedSha256.toLowerCase();
    } catch (_) {
      return false;
    }
  }

  /// Cancels an in-progress download.
  void cancelDownload() {
    _isCancelled = true;
  }

  /// Downloads the model with resumable HTTP range requests and progress reporting.
  Stream<ModelDownloadProgress> downloadModel() async* {
    _isCancelled = false;
    yield const ModelDownloadProgress(status: ModelDownloadStatus.checkingStorage);

    // 1. Storage Pre-flight Check (>= 5,000 MB)
    final freeBytes = await _platformService.getAvailableDiskSpaceBytes();
    final freeMb = freeBytes / (1024 * 1024);
    if (freeMb < minRequiredDiskSpaceMb) {
      yield ModelDownloadProgress(
        status: ModelDownloadStatus.error,
        errorMessage:
            'Insufficient storage: $freeMb MB available, but minimum $minRequiredDiskSpaceMb MB required.',
      );
      return;
    }

    final targetFile = await getModelFile();
    final tempFile = File('${targetFile.path}.download');

    int downloadedBytes = 0;
    if (tempFile.existsSync()) {
      downloadedBytes = tempFile.lengthSync();
    }

    // If existing temp file exceeds expected size, delete and restart
    if (downloadedBytes > expectedSizeBytes) {
      tempFile.deleteSync();
      downloadedBytes = 0;
    }

    yield ModelDownloadProgress(
      bytesDownloaded: downloadedBytes,
      totalBytes: expectedSizeBytes,
      progressPercent: downloadedBytes / expectedSizeBytes,
      status: ModelDownloadStatus.downloading,
    );

    try {
      final request = await _httpClient.getUrl(Uri.parse(downloadUrl));
      if (downloadedBytes > 0) {
        request.headers.add('Range', 'bytes=$downloadedBytes-');
      }

      final response = await request.close();
      if (response.statusCode != HttpStatus.ok &&
          response.statusCode != HttpStatus.partialContent) {
        yield ModelDownloadProgress(
          status: ModelDownloadStatus.error,
          errorMessage: 'Server responded with HTTP ${response.statusCode}',
        );
        return;
      }

      final sink = tempFile.openWrite(mode: FileMode.append);

      await for (final chunk in response) {
        if (_isCancelled) {
          await sink.flush();
          await sink.close();
          yield const ModelDownloadProgress(status: ModelDownloadStatus.cancelled);
          return;
        }

        sink.add(chunk);
        downloadedBytes += chunk.length;

        yield ModelDownloadProgress(
          bytesDownloaded: downloadedBytes,
          totalBytes: expectedSizeBytes,
          progressPercent: (downloadedBytes / expectedSizeBytes).clamp(0.0, 1.0),
          status: ModelDownloadStatus.downloading,
        );
      }

      await sink.flush();
      await sink.close();

      // 2. Checksum Verification
      yield const ModelDownloadProgress(status: ModelDownloadStatus.verifyingChecksum);
      final isChecksumValid = await verifyChecksum(tempFile);

      if (!isChecksumValid) {
        if (tempFile.existsSync()) tempFile.deleteSync();
        yield const ModelDownloadProgress(
          status: ModelDownloadStatus.error,
          errorMessage: 'Checksum mismatch. The downloaded file was corrupted and removed.',
        );
        return;
      }

      // Rename to ready file
      if (targetFile.existsSync()) targetFile.deleteSync();
      tempFile.renameSync(targetFile.path);

      yield const ModelDownloadProgress(
        bytesDownloaded: expectedSizeBytes,
        totalBytes: expectedSizeBytes,
        progressPercent: 1.0,
        status: ModelDownloadStatus.ready,
      );
    } catch (e) {
      yield ModelDownloadProgress(
        status: ModelDownloadStatus.error,
        errorMessage: 'Download error: $e',
      );
    }
  }
}
