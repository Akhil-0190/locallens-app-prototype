import 'package:flutter/services.dart';

enum DeviceNetworkStatus {
  wifi,
  cellular,
  ethernet,
  connected,
  offline,
}

enum NativeAiStatus {
  unsupportedDevice,
  aicoreNotInstalled,
  modelNotAvailable,
  llamaCppRuntimeReady,
  inferenceActive,
}

class AICoreAvailabilityResult {
  final bool isAvailable;
  final int apiLevel;
  final bool isSupportedDevice;
  final bool aicorePackageInstalled;
  final String statusMessage;

  const AICoreAvailabilityResult({
    required this.isAvailable,
    required this.apiLevel,
    required this.isSupportedDevice,
    required this.aicorePackageInstalled,
    required this.statusMessage,
  });

  factory AICoreAvailabilityResult.fromMap(Map<dynamic, dynamic> map) {
    return AICoreAvailabilityResult(
      isAvailable: map['isAvailable'] as bool? ?? false,
      apiLevel: (map['apiLevel'] as num?)?.toInt() ?? 0,
      isSupportedDevice: map['isSupportedDevice'] as bool? ?? false,
      aicorePackageInstalled: map['aicorePackageInstalled'] as bool? ?? false,
      statusMessage: map['statusMessage'] as String? ?? 'Unknown',
    );
  }
}

class DeviceAICapabilities {
  final bool hasNpu;
  final int ramAvailableMb;
  final int aicoreVersion;
  final List<String> supportedFeatures;
  final int apiLevel;
  final int totalRamMb;
  final bool aicoreInstalled;
  final bool npuDetectionSupported;
  final String? npuHardwareReported;
  final String? hardwarePlatform;

  const DeviceAICapabilities({
    required this.hasNpu,
    required this.ramAvailableMb,
    required this.aicoreVersion,
    required this.supportedFeatures,
    this.apiLevel = 0,
    this.totalRamMb = 0,
    this.aicoreInstalled = false,
    this.npuDetectionSupported = false,
    this.npuHardwareReported,
    this.hardwarePlatform,
  });

  factory DeviceAICapabilities.fromMap(Map<dynamic, dynamic> map) {
    final features = (map['supportedFeatures'] ?? map['supportedRuntimes'] as List?)
            ?.map((e) => e.toString())
            .toList() ??
        [];
    return DeviceAICapabilities(
      hasNpu: map['hasNpu'] as bool? ?? false,
      ramAvailableMb: (map['ramAvailableMb'] as num?)?.toInt() ?? 0,
      aicoreVersion: (map['aicoreVersion'] as num?)?.toInt() ?? 0,
      supportedFeatures: features,
      apiLevel: (map['apiLevel'] as num?)?.toInt() ?? 0,
      totalRamMb: (map['totalRamMb'] as num?)?.toInt() ?? 0,
      aicoreInstalled: map['aicoreInstalled'] as bool? ?? false,
      npuDetectionSupported: map['npuDetectionSupported'] as bool? ?? false,
      npuHardwareReported: map['npuHardwareReported'] as String?,
      hardwarePlatform: map['hardwarePlatform'] as String?,
    );
  }
}

class EdgeDeviceSupport {
  final int totalRamMb;
  final int freeStorageMb;
  final bool gemmaE2bSupported;
  final String recommendedBackend; // 'GPU' | 'CPU' | 'UNSUPPORTED'
  final bool geminiNanoAvailable;
  final bool gemmaModelDownloaded;
  final String? gemmaModelPath;
  final bool gemmaLoaded;
  final String activeBackend;

  const EdgeDeviceSupport({
    required this.totalRamMb,
    required this.freeStorageMb,
    required this.gemmaE2bSupported,
    required this.recommendedBackend,
    required this.geminiNanoAvailable,
    required this.gemmaModelDownloaded,
    this.gemmaModelPath,
    required this.gemmaLoaded,
    required this.activeBackend,
  });

  factory EdgeDeviceSupport.fromMap(Map<dynamic, dynamic> map) {
    return EdgeDeviceSupport(
      totalRamMb: (map['totalRamMb'] as num?)?.toInt() ?? 0,
      freeStorageMb: (map['freeStorageMb'] as num?)?.toInt() ?? 0,
      gemmaE2bSupported: map['gemmaE2bSupported'] as bool? ?? false,
      recommendedBackend: map['recommendedBackend']?.toString() ?? 'UNSUPPORTED',
      geminiNanoAvailable: map['geminiNanoAvailable'] as bool? ?? false,
      gemmaModelDownloaded: map['gemmaModelDownloaded'] as bool? ?? false,
      gemmaModelPath: map['gemmaModelPath']?.toString(),
      gemmaLoaded: map['gemmaLoaded'] as bool? ?? false,
      activeBackend: map['activeBackend']?.toString() ?? 'NONE',
    );
  }
}

class GemmaInitResult {
  final bool loaded;
  final String backend;
  final int loadTimeMs;
  final String? error;

  const GemmaInitResult({
    required this.loaded,
    required this.backend,
    required this.loadTimeMs,
    this.error,
  });
}

class GemmaInferenceResult {
  final bool success;
  final String text;
  final double tokensPerSec;
  final String model;
  final String backend;
  final String? error;

  const GemmaInferenceResult({
    required this.success,
    required this.text,
    required this.tokensPerSec,
    required this.model,
    required this.backend,
    this.error,
  });
}

class NativePlatformService {
  static const MethodChannel _deviceChannel =
      MethodChannel('com.innovotribe.locallens/device_info');
  static const MethodChannel _aiChannel =
      MethodChannel('com.innovotribe.locallens/native_ai');
  static const MethodChannel _edgeAiChannel =
      MethodChannel('com.innovotribe.locallens/edge_ai');

  NativePlatformService();

  /// Queries remaining available disk space on the device in bytes.
  Future<int> getAvailableDiskSpaceBytes() async {
    try {
      final bytes =
          await _deviceChannel.invokeMethod<int>('getAvailableDiskSpaceBytes');
      return bytes ?? 0;
    } on MissingPluginException {
      return 1024 * 1024 * 1024; // 1 GB fallback
    } catch (_) {
      return 0;
    }
  }

  /// Queries current device network connectivity status.
  Future<DeviceNetworkStatus> getNetworkStatus() async {
    try {
      final statusStr =
          await _deviceChannel.invokeMethod<String>('getNetworkStatus');
      switch (statusStr) {
        case 'WIFI':
          return DeviceNetworkStatus.wifi;
        case 'CELLULAR':
          return DeviceNetworkStatus.cellular;
        case 'ETHERNET':
          return DeviceNetworkStatus.ethernet;
        case 'CONNECTED':
          return DeviceNetworkStatus.connected;
        default:
          return DeviceNetworkStatus.offline;
      }
    } on MissingPluginException {
      return DeviceNetworkStatus.wifi;
    } catch (_) {
      return DeviceNetworkStatus.offline;
    }
  }

  /// Interrogates genuine Android AICore availability and API level.
  Future<AICoreAvailabilityResult> checkAICoreAvailability() async {
    try {
      final map = await _aiChannel
          .invokeMethod<Map<dynamic, dynamic>>('checkAICoreAvailability');
      if (map != null) {
        return AICoreAvailabilityResult.fromMap(map);
      }
    } on MissingPluginException {
      // Platform channel not connected (e.g. desktop/unit test)
    } catch (_) {}

    return const AICoreAvailabilityResult(
      isAvailable: false,
      apiLevel: 0,
      isSupportedDevice: false,
      aicorePackageInstalled: false,
      statusMessage: 'AICore platform channel unavailable',
    );
  }

  /// Interrogates device hardware telemetry and supported edge runtimes.
  Future<DeviceAICapabilities> getDeviceAICapabilities() async {
    try {
      final map = await _aiChannel
          .invokeMethod<Map<dynamic, dynamic>>('getDeviceAICapabilities');
      if (map != null) {
        return DeviceAICapabilities.fromMap(map);
      }
    } on MissingPluginException {
      // Platform channel not connected
    } catch (_) {}

    return const DeviceAICapabilities(
      hasNpu: false,
      ramAvailableMb: 0,
      aicoreVersion: 0,
      supportedFeatures: [],
      apiLevel: 0,
      totalRamMb: 0,
      aicoreInstalled: false,
      npuDetectionSupported: false,
    );
  }

  /// Returns the current discrete state of native on-device AI.
  Future<NativeAiStatus> getNativeAiStatus({String? modelPath}) async {
    try {
      final statusStr =
          await _aiChannel.invokeMethod<String>('getNativeAiStatus', {
        ...?modelPath == null ? null : {'modelPath': modelPath},
      });
      switch (statusStr) {
        case 'UNSUPPORTED_DEVICE':
          return NativeAiStatus.unsupportedDevice;
        case 'AICORE_NOT_INSTALLED':
          return NativeAiStatus.aicoreNotInstalled;
        case 'MODEL_NOT_AVAILABLE':
          return NativeAiStatus.modelNotAvailable;
        case 'LLAMA_CPP_RUNTIME_READY':
          return NativeAiStatus.llamaCppRuntimeReady;
        case 'INFERENCE_ACTIVE':
          return NativeAiStatus.inferenceActive;
        default:
          return NativeAiStatus.unsupportedDevice;
      }
    } on MissingPluginException {
      return NativeAiStatus.unsupportedDevice;
    } catch (_) {
      return NativeAiStatus.unsupportedDevice;
    }
  }

  /// Checks on-device model provisioning status across AICore and Gemma GGUF runtimes.
  Future<Map<String, dynamic>> checkModelProvisioning({String engine = 'GEMMA_GGUF'}) async {
    try {
      final res = await _aiChannel.invokeMethod<Map<dynamic, dynamic>>(
        'checkModelProvisioning',
        {'engine': engine},
      );
      if (res != null) {
        return Map<String, dynamic>.from(res);
      }
    } catch (_) {}
    return {
      'engine': engine,
      'isProvisioned': false,
      'error': 'Channel communication failed',
    };
  }

  /// Summarizes offline traveler note adhering to B6 contract via native AICore/Gemma runtime.
  Future<Map<String, dynamic>> summarizeOfflineNote({
    required String noteText,
    required String spotName,
    String language = 'en',
    String? modelPath,
  }) async {
    try {
      final result = await _aiChannel.invokeMethod<Map<dynamic, dynamic>>(
        'summarizeOfflineNote',
        {
          'noteText': noteText,
          'spotName': spotName,
          'language': language,
          ...?modelPath == null ? null : {'modelPath': modelPath},
        },
      );
      if (result != null) {
        return Map<String, dynamic>.from(result);
      }
    } catch (_) {}

    return {
      'success': false,
      'code': 'CHANNEL_ERROR',
      'isLocalInference': false,
      'message': 'Failed to communicate with native AI channel.',
    };
  }

  /// Extracts offline keywords adhering to B6 contract via native AICore/Gemma runtime.
  Future<Map<String, dynamic>> extractOfflineKeywords({
    required String text,
    String? modelPath,
  }) async {
    try {
      final result = await _aiChannel.invokeMethod<Map<dynamic, dynamic>>(
        'extractOfflineKeywords',
        {
          'text': text,
          ...?modelPath == null ? null : {'modelPath': modelPath},
        },
      );
      if (result != null) {
        return Map<String, dynamic>.from(result);
      }
    } catch (_) {}

    return {
      'success': false,
      'code': 'CHANNEL_ERROR',
      'isLocalInference': false,
      'message': 'Failed to communicate with native AI channel.',
    };
  }

  /// Invokes on-device offline inference through the native bridge.
  /// Strictly respects frozen AI architecture: never claims local inference
  /// succeeded unless actual local model execution is completed.
  Future<Map<String, dynamic>> executeOfflineInference({
    required String prompt,
    String engine = 'AICORE',
    String? modelPath,
  }) async {
    try {
      final result = await _aiChannel.invokeMethod<Map<dynamic, dynamic>>(
        'executeOfflineInference',
        {
          'prompt': prompt,
          'engine': engine,
          ...?modelPath == null ? null : {'modelPath': modelPath},
        },
      );
      if (result != null) {
        return Map<String, dynamic>.from(result);
      }
    } on MissingPluginException {
      // Channel missing
    } catch (_) {}

    return {
      'success': false,
      'isLocalInference': false,
      'code': 'CHANNEL_ERROR',
      'message': 'Failed to communicate with native AI channel.',
    };
  }

  /// Interrogates real Android RAM, free storage, LiteRT-LM Gemma 4 E2B readiness, and AICore status.
  Future<EdgeDeviceSupport> checkEdgeDeviceSupport() async {
    try {
      final res = await _edgeAiChannel
          .invokeMethod<Map<dynamic, dynamic>>('checkDeviceSupport');
      if (res != null) {
        return EdgeDeviceSupport.fromMap(res);
      }
    } catch (_) {}
    return const EdgeDeviceSupport(
      totalRamMb: 0,
      freeStorageMb: 0,
      gemmaE2bSupported: false,
      recommendedBackend: 'UNSUPPORTED',
      geminiNanoAvailable: false,
      gemmaModelDownloaded: false,
      gemmaLoaded: false,
      activeBackend: 'NONE',
    );
  }

  /// Loads the downloaded Gemma 4 E2B `.litertlm` bundle into LiteRT-LM on Android (GPU/CPU).
  Future<GemmaInitResult> initGemmaE2B({
    required String modelPath,
    bool? useGpu,
  }) async {
    try {
      final res = await _edgeAiChannel.invokeMethod<Map<dynamic, dynamic>>(
        'initGemmaE2B',
        {
          'modelPath': modelPath,
          if (useGpu != null) 'useGpu': useGpu,
        },
      );
      if (res != null) {
        return GemmaInitResult(
          loaded: res['loaded'] as bool? ?? false,
          backend: res['backend']?.toString() ?? 'NONE',
          loadTimeMs: (res['loadTimeMs'] as num?)?.toInt() ?? 0,
          error: res['error']?.toString(),
        );
      }
    } catch (e) {
      return GemmaInitResult(
        loaded: false,
        backend: 'NONE',
        loadTimeMs: 0,
        error: e.toString(),
      );
    }
    return const GemmaInitResult(
      loaded: false,
      backend: 'NONE',
      loadTimeMs: 0,
      error: 'Edge AI channel unavailable.',
    );
  }

  /// Executes real on-device Gemma 4 E2B multimodal (text or image + text) inference via LiteRT-LM.
  Future<GemmaInferenceResult> runGemmaMultimodal({
    required String prompt,
    String? imagePath,
    String? modelPath,
    int maxTokens = 384,
  }) async {
    try {
      final res = await _edgeAiChannel.invokeMethod<Map<dynamic, dynamic>>(
        'runGemmaMultimodal',
        {
          'prompt': prompt,
          if (imagePath != null) 'imagePath': imagePath,
          if (modelPath != null) 'modelPath': modelPath,
          'maxTokens': maxTokens,
        },
      );
      if (res != null) {
        return GemmaInferenceResult(
          success: res['success'] as bool? ?? false,
          text: res['text']?.toString() ?? '',
          tokensPerSec: (res['tokensPerSec'] as num?)?.toDouble() ?? 0.0,
          model: res['model']?.toString() ?? 'gemma-4-e2b',
          backend: res['backend']?.toString() ?? 'NONE',
          error: res['error']?.toString(),
        );
      }
    } catch (e) {
      return GemmaInferenceResult(
        success: false,
        text: '',
        tokensPerSec: 0.0,
        model: 'gemma-4-e2b',
        backend: 'NONE',
        error: e.toString(),
      );
    }
    return const GemmaInferenceResult(
      success: false,
      text: '',
      tokensPerSec: 0.0,
      model: 'gemma-4-e2b',
      backend: 'NONE',
      error: 'Edge AI channel did not respond.',
    );
  }
}
