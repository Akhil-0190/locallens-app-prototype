import 'dart:io';
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

class NativePlatformService {
  static const MethodChannel _deviceChannel =
      MethodChannel('com.innovotribe.locallens/device_info');
  static const MethodChannel _aiChannel =
      MethodChannel('com.innovotribe.locallens/native_ai');

  final bool _isTestMode;

  NativePlatformService({bool? isTestMode})
      : _isTestMode = isTestMode ??
            Platform.environment.containsKey('FLUTTER_TEST');

  /// Queries remaining available disk space on the device in bytes.
  Future<int> getAvailableDiskSpaceBytes() async {
    if (_isTestMode) {
      // Mock 8.5 GB available storage in test
      return 8500 * 1024 * 1024;
    }
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
    if (_isTestMode) {
      return DeviceNetworkStatus.wifi;
    }
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
    if (_isTestMode) {
      return const AICoreAvailabilityResult(
        isAvailable: false,
        apiLevel: 34,
        isSupportedDevice: true,
        aicorePackageInstalled: false,
        statusMessage:
            'AICORE_NOT_INSTALLED: com.google.android.aicore not present in test',
      );
    }
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
    if (_isTestMode) {
      return const DeviceAICapabilities(
        hasNpu: false,
        ramAvailableMb: 4096,
        aicoreVersion: 0,
        supportedFeatures: ['LLAMA_CPP_GEMMA4_GGUF'],
        apiLevel: 34,
        totalRamMb: 8192,
        aicoreInstalled: false,
        npuDetectionSupported: false,
      );
    }
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
  Future<NativeAiStatus> getNativeAiStatus() async {
    if (_isTestMode) {
      return NativeAiStatus.aicoreNotInstalled;
    }
    try {
      final statusStr =
          await _aiChannel.invokeMethod<String>('getNativeAiStatus');
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

  /// Summarizes offline traveler note adhering to B6 contract.
  /// Returns structured unassisted response until model binary is provided by Developer B.
  Future<Map<String, dynamic>> summarizeOfflineNote({
    required String noteText,
    required String spotName,
    String language = 'en',
  }) async {
    if (_isTestMode) {
      return {
        'success': false,
        'code': 'MODEL_NOT_DOWNLOADED',
        'isLocalInference': false,
        'modelUsed': 'NONE (Unassisted Fallback)',
        'summary': '',
        'keyHighlights': <String>[],
        'message':
            'On-device model for note summarization pending from Developer B (Gemma 4 GGUF/llama.cpp or AICore). Running in unassisted mode.',
        'spotName': spotName,
        'language': language,
      };
    }
    try {
      final result = await _aiChannel.invokeMethod<Map<dynamic, dynamic>>(
        'summarizeOfflineNote',
        {
          'noteText': noteText,
          'spotName': spotName,
          'language': language,
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

  /// Extracts offline keywords adhering to B6 contract.
  /// Returns structured unassisted response until model binary is provided by Developer B.
  Future<Map<String, dynamic>> extractOfflineKeywords({
    required String text,
  }) async {
    if (_isTestMode) {
      return {
        'success': false,
        'code': 'MODEL_NOT_DOWNLOADED',
        'isLocalInference': false,
        'modelUsed': 'NONE (Unassisted Fallback)',
        'keywords': <String>[],
        'message':
            'On-device keyword extraction model binary pending from Developer B. Running in unassisted mode.',
      };
    }
    try {
      final result = await _aiChannel.invokeMethod<Map<dynamic, dynamic>>(
        'extractOfflineKeywords',
        {'text': text},
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
  }) async {
    if (_isTestMode) {
      return {
        'success': false,
        'isLocalInference': false,
        'code': 'MODEL_NOT_DOWNLOADED',
        'message':
            'On-device model binary for $engine is pending download from AICore/Developer B. Running in unassisted mode.',
      };
    }
    try {
      final result = await _aiChannel.invokeMethod<Map<dynamic, dynamic>>(
        'executeOfflineInference',
        {'prompt': prompt, 'engine': engine},
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
}
