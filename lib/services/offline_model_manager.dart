import 'dart:async';
import 'dart:io';
import 'package:cloud_functions/cloud_functions.dart';
import 'package:crypto/crypto.dart';
import 'package:path_provider/path_provider.dart';
import 'native_platform_service.dart';

enum ModelDownloadStatus {
  notDownloaded,
  checkingStorage,
  downloading,
  verifyingChecksum,
  initializingRuntime,
  ready,
  unsupportedHardware,
  error,
  cancelled,
}

class ModelDownloadProgress {
  final int bytesDownloaded;
  final int totalBytes;
  final double progressPercent;
  final ModelDownloadStatus status;
  final String? errorMessage;
  final String? backendLabel;

  const ModelDownloadProgress({
    this.bytesDownloaded = 0,
    this.totalBytes = 2600000000,
    this.progressPercent = 0.0,
    this.status = ModelDownloadStatus.notDownloaded,
    this.errorMessage,
    this.backendLabel,
  });
}

class EdgeModelManifest {
  final String modelId;
  final String displayName;
  final String fileName;
  final String downloadUrl;
  final int approxSizeBytes;
  final String? sha256Checksum;
  final int minRamMb;
  final int recommendedGpuRamMb;
  final int minFreeStorageMb;
  final bool supportsVision;

  const EdgeModelManifest({
    required this.modelId,
    required this.displayName,
    required this.fileName,
    required this.downloadUrl,
    required this.approxSizeBytes,
    this.sha256Checksum,
    required this.minRamMb,
    required this.recommendedGpuRamMb,
    required this.minFreeStorageMb,
    required this.supportsVision,
  });

  static const EdgeModelManifest defaultGemma4E2B = EdgeModelManifest(
    modelId: 'gemma-4-e2b-it-litertlm',
    displayName: 'Gemma 4 E2B Multimodal (LiteRT-LM)',
    fileName: OfflineModelManager.litertModelFileName,
    downloadUrl: OfflineModelManager.litertDownloadUrl,
    approxSizeBytes: OfflineModelManager.litertApproxSizeBytes,
    sha256Checksum: null,
    minRamMb: 6000,
    recommendedGpuRamMb: 10000,
    minFreeStorageMb: 4000,
    supportsVision: true,
  );

  factory EdgeModelManifest.fromMap(Map<String, dynamic> map) {
    return EdgeModelManifest(
      modelId: map['modelId']?.toString() ?? defaultGemma4E2B.modelId,
      displayName: map['displayName']?.toString() ?? defaultGemma4E2B.displayName,
      fileName: map['fileName']?.toString() ?? defaultGemma4E2B.fileName,
      downloadUrl: map['downloadUrl']?.toString() ?? defaultGemma4E2B.downloadUrl,
      approxSizeBytes:
          (map['approxSizeBytes'] as num?)?.toInt() ?? defaultGemma4E2B.approxSizeBytes,
      sha256Checksum: map['sha256Checksum']?.toString(),
      minRamMb: (map['minRamMb'] as num?)?.toInt() ?? 6000,
      recommendedGpuRamMb: (map['recommendedGpuRamMb'] as num?)?.toInt() ?? 10000,
      minFreeStorageMb: (map['minFreeStorageMb'] as num?)?.toInt() ?? 4000,
      supportsVision: map['supportsVision'] as bool? ?? true,
    );
  }
}

/// Offline Model Manager for on-device Gemma 4 E2B Multimodal weights (LiteRT-LM)
/// with automatic Wi-Fi background setup on >=6 GB RAM phones (GPU tuned for 12 GB RAM
/// such as Motorola Edge 60 Pro) and strict <6 GB RAM safety guard.
class OfflineModelManager {
  // Primary LiteRT-LM Gemma 4 E2B Multimodal bundle
  static const String litertModelFileName = 'gemma-4-E2B-it.litertlm';
  static const int litertApproxSizeBytes = 2600000000;
  static const String litertDownloadUrl =
      'https://huggingface.co/litert-community/gemma-4-E2B-it-litert-lm/resolve/main/gemma-4-E2B-it.litertlm';

  // Legacy B6 contract constants retained for unit test compatibility
  static const String modelFileName = 'gemma-4-E2B-it-Q4_K_M.gguf';
  static const int expectedSizeBytes = 3344000000;
  static const String expectedSha256 =
      '740185b21d22ceb83a11c3aa62ad5842ef32c70f6096d756bbee85a1e4ec34b8';
  static const String downloadUrl =
      'https://huggingface.co/unsloth/gemma-4-E2B-it-GGUF/resolve/90f9618340396838ee7ff5b0ba2da27da62953d3/gemma-4-E2B-it-Q4_K_M.gguf';

  static const int minRequiredDiskSpaceMb = 4000;
  static const int minRequiredRamMb = 6000;

  final NativePlatformService _platformService;
  final HttpClient _httpClient;
  final Directory? baseDirectory;
  bool _isCancelled = false;

  static bool _autoSetupStarted = false;

  OfflineModelManager({
    NativePlatformService? platformService,
    HttpClient? httpClient,
    this.baseDirectory,
  })  : _platformService = platformService ?? NativePlatformService(),
        _httpClient = httpClient ?? HttpClient();

  /// Fetches canonical Gemma 4 E2B manifest from Cloud Function `LocalAI-getModelManifest`.
  Future<EdgeModelManifest> fetchRemoteManifest() async {
    try {
      final callable = FirebaseFunctions.instanceFor(region: 'us-central1')
          .httpsCallable('LocalAI-getModelManifest');
      final response = await callable.call<Map<String, dynamic>>({});
      final envelope = Map<String, dynamic>.from(response.data);
      final data = envelope['data'] is Map
          ? Map<String, dynamic>.from(envelope['data'] as Map)
          : envelope;
      return EdgeModelManifest.fromMap(data);
    } catch (_) {
      return EdgeModelManifest.defaultGemma4E2B;
    }
  }

  /// Gets the absolute File handle for the LiteRT-LM Gemma 4 E2B multimodal bundle.
  Future<File> getLiteRtModelFile({String fileName = litertModelFileName}) async {
    final docsDir = baseDirectory ?? await getApplicationDocumentsDirectory();
    final modelsDir = Directory('${docsDir.path}/models');
    if (!modelsDir.existsSync()) {
      modelsDir.createSync(recursive: true);
    }
    return File('${modelsDir.path}/$fileName');
  }

  /// Legacy handle retained for backward compatibility.
  Future<File> getModelFile() async {
    final docsDir = baseDirectory ?? await getApplicationDocumentsDirectory();
    final modelsDir = Directory('${docsDir.path}/models');
    if (!modelsDir.existsSync()) {
      modelsDir.createSync(recursive: true);
    }
    return File('${modelsDir.path}/$modelFileName');
  }

  Future<String> getModelPath() async {
    final litert = await getLiteRtModelFile();
    if (litert.existsSync() && litert.lengthSync() > 0) {
      return litert.absolute.path;
    }
    final legacy = await getModelFile();
    return legacy.absolute.path;
  }

  /// Returns true if the LiteRT-LM Gemma 4 E2B bundle (or verified legacy GGUF) is installed.
  Future<bool> isModelReady() async {
    final litert = await getLiteRtModelFile();
    if (litert.existsSync() && litert.lengthSync() > 10 * 1024 * 1024) {
      return true;
    }
    final legacy = await getModelFile();
    if (!legacy.existsSync()) return false;
    if (legacy.lengthSync() != expectedSizeBytes) return false;
    return verifyChecksum(legacy);
  }

  Future<bool> verifyChecksum(File file, {String? expected}) async {
    if (!file.existsSync()) return false;
    final targetHash = (expected ?? expectedSha256).trim().toLowerCase();
    if (targetHash.isEmpty) return true;
    try {
      final digest = await sha256.bind(file.openRead()).first;
      return digest.toString().toLowerCase() == targetHash;
    } catch (_) {
      return false;
    }
  }

  void cancelDownload() {
    _isCancelled = true;
  }

  /// Non-blocking startup hook:
  /// - If Gemma 4 E2B is already downloaded and device has >=6 GB RAM, warms up LiteRT-LM (GPU on >=10 GB RAM).
  /// - If not yet downloaded, device is on Wi-Fi, RAM >= 6 GB, and free storage >= 4 GB,
  ///   starts resumable background download automatically.
  Future<void> autoInitIfReadyOrWifi() async {
    if (_autoSetupStarted) {
      return;
    }
    _autoSetupStarted = true;

    try {
      final support = await _platformService.checkEdgeDeviceSupport();
      if (!support.gemmaE2bSupported) {
        return; // Respect <6 GB RAM safety guard strictly
      }

      if (support.gemmaModelDownloaded && support.gemmaModelPath != null) {
        if (!support.gemmaLoaded) {
          await _platformService.initGemmaE2B(
            modelPath: support.gemmaModelPath!,
            useGpu: support.recommendedBackend == 'GPU',
          );
        }
        return;
      }

      final net = await _platformService.getNetworkStatus();
      if (net == DeviceNetworkStatus.wifi &&
          support.freeStorageMb >= minRequiredDiskSpaceMb) {
        // Kick off silent resumable background setup over Wi-Fi
        unawaited(downloadGemmaLiteRtModel().drain<void>());
      }
    } catch (_) {
      // Never crash app launch on optional background model warm-up
    }
  }

  /// Downloads the official Gemma 4 E2B Multimodal `.litertlm` bundle with HTTP Range resume,
  /// hardware RAM safety guard (<6 GB blocked), storage check (>=4 GB), optional SHA-256 check,
  /// and automatic native LiteRT-LM initialization.
  Stream<ModelDownloadProgress> downloadGemmaLiteRtModel() async* {
    _isCancelled = false;
    yield const ModelDownloadProgress(status: ModelDownloadStatus.checkingStorage);

    // 1. Hardware RAM Safety Guard (<6 GB RAM blocked cleanly)
    final support = await _platformService.checkEdgeDeviceSupport();
    if (support.totalRamMb > 0 && support.totalRamMb < minRequiredRamMb) {
      yield ModelDownloadProgress(
        status: ModelDownloadStatus.unsupportedHardware,
        errorMessage:
            'Safety guard: Device RAM (${(support.totalRamMb / 1024).toStringAsFixed(1)} GB) is below the 6 GB minimum for Gemma 4 E2B. Using lightweight offline cache & cloud Gemini instead.',
      );
      return;
    }

    // 2. Storage Pre-flight Check (>= 4,000 MB)
    final manifest = await fetchRemoteManifest();
    final freeBytes = await _platformService.getAvailableDiskSpaceBytes();
    final freeMb = freeBytes / (1024 * 1024);
    if (freeMb < manifest.minFreeStorageMb) {
      yield ModelDownloadProgress(
        status: ModelDownloadStatus.error,
        errorMessage:
            'Insufficient storage: ${freeMb.toStringAsFixed(0)} MB free, but ${manifest.minFreeStorageMb} MB required for Gemma 4 E2B.',
      );
      return;
    }

    final targetFile = await getLiteRtModelFile(fileName: manifest.fileName);
    final tempFile = File('${targetFile.path}.download');
    int downloadedBytes = tempFile.existsSync() ? tempFile.lengthSync() : 0;
    int totalBytes = manifest.approxSizeBytes;

    yield ModelDownloadProgress(
      bytesDownloaded: downloadedBytes,
      totalBytes: totalBytes,
      progressPercent: (downloadedBytes / totalBytes).clamp(0.0, 0.99),
      status: ModelDownloadStatus.downloading,
    );

    try {
      final request = await _httpClient.getUrl(Uri.parse(manifest.downloadUrl));
      request.followRedirects = true;
      request.maxRedirects = 6;
      if (downloadedBytes > 0) {
        request.headers.add('Range', 'bytes=$downloadedBytes-');
      }

      final response = await request.close();
      if (response.statusCode != HttpStatus.ok &&
          response.statusCode != HttpStatus.partialContent) {
        yield ModelDownloadProgress(
          status: ModelDownloadStatus.error,
          errorMessage: 'Model CDN responded with HTTP ${response.statusCode}.',
        );
        return;
      }

      if (response.statusCode == HttpStatus.ok) {
        // Server ignored Range header; restart cleanly
        if (tempFile.existsSync()) tempFile.deleteSync();
        downloadedBytes = 0;
        if (response.contentLength > 0) {
          totalBytes = response.contentLength;
        }
      } else if (response.contentLength > 0) {
        totalBytes = downloadedBytes + response.contentLength;
      }

      final sink = tempFile.openWrite(
        mode: downloadedBytes > 0 ? FileMode.append : FileMode.write,
      );

      var lastEmitMs = DateTime.now().millisecondsSinceEpoch;
      await for (final chunk in response) {
        if (_isCancelled) {
          await sink.flush();
          await sink.close();
          yield const ModelDownloadProgress(status: ModelDownloadStatus.cancelled);
          return;
        }

        sink.add(chunk);
        downloadedBytes += chunk.length;

        final nowMs = DateTime.now().millisecondsSinceEpoch;
        if (nowMs - lastEmitMs >= 250) {
          lastEmitMs = nowMs;
          yield ModelDownloadProgress(
            bytesDownloaded: downloadedBytes,
            totalBytes: totalBytes,
            progressPercent: (downloadedBytes / totalBytes).clamp(0.0, 0.99),
            status: ModelDownloadStatus.downloading,
          );
        }
      }

      await sink.flush();
      await sink.close();

      // 3. Checksum Verification (if manifest pins SHA-256)
      yield ModelDownloadProgress(
        bytesDownloaded: downloadedBytes,
        totalBytes: totalBytes,
        progressPercent: 0.99,
        status: ModelDownloadStatus.verifyingChecksum,
      );
      if (manifest.sha256Checksum != null && manifest.sha256Checksum!.isNotEmpty) {
        final ok = await verifyChecksum(tempFile, expected: manifest.sha256Checksum);
        if (!ok) {
          if (tempFile.existsSync()) tempFile.deleteSync();
          yield const ModelDownloadProgress(
            status: ModelDownloadStatus.error,
            errorMessage: 'SHA-256 verification failed. Corrupted download removed.',
          );
          return;
        }
      }

      if (targetFile.existsSync()) targetFile.deleteSync();
      tempFile.renameSync(targetFile.path);

      // 4. Initialize LiteRT-LM runtime immediately (GPU on >=10 GB RAM, CPU on 6-9 GB RAM)
      yield ModelDownloadProgress(
        bytesDownloaded: downloadedBytes,
        totalBytes: downloadedBytes,
        progressPercent: 1.0,
        status: ModelDownloadStatus.initializingRuntime,
      );

      final initRes = await _platformService.initGemmaE2B(
        modelPath: targetFile.absolute.path,
        useGpu: support.recommendedBackend == 'GPU',
      );

      yield ModelDownloadProgress(
        bytesDownloaded: downloadedBytes,
        totalBytes: downloadedBytes,
        progressPercent: 1.0,
        status: ModelDownloadStatus.ready,
        backendLabel: initRes.loaded ? initRes.backend : support.recommendedBackend,
      );
    } catch (e) {
      yield ModelDownloadProgress(
        status: ModelDownloadStatus.error,
        errorMessage: 'Model download error: $e',
      );
    }
  }

  /// Legacy GGUF download stream preserved for existing B6 unit tests.
  Stream<ModelDownloadProgress> downloadModel() async* {
    _isCancelled = false;
    yield const ModelDownloadProgress(status: ModelDownloadStatus.checkingStorage);

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
    int downloadedBytes = tempFile.existsSync() ? tempFile.lengthSync() : 0;
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
