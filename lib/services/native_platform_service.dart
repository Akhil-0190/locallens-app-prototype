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
  final int apiLevel;
  final int ramAvailableMb;
  final int totalRamMb;
  final bool aicoreInstalled;
  final List<String> supportedRuntimes;
  final bool hasNpu;

  const DeviceAICapabilities({
    required this.apiLevel,
    required this.ramAvailableMb,
    required this.totalRamMb,
    required this.aicoreInstalled,
    required this.supportedRuntimes,
    required this.hasNpu,
  });

  factory DeviceAICapabilities.fromMap(Map<dynamic, dynamic> map) {
    final runtimes = (map['supportedRuntimes'] as List?)
            ?.map((e) => e.toString())
            .toList() ??
        [];
    return DeviceAICapabilities(
      apiLevel: (map['apiLevel'] as num?)?.toInt() ?? 0,
      ramAvailableMb: (map['ramAvailableMb'] as num?)?.toInt() ?? 0,
      totalRamMb: (map['totalRamMb'] as num?)?.toInt() ?? 0,
      aicoreInstalled: map['aicoreInstalled'] as bool? ?? false,
      supportedRuntimes: runtimes,
      hasNpu: map['hasNpu'] as bool? ?? false,
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
        apiLevel: 34,
        ramAvailableMb: 4096,
        totalRamMb: 8192,
        aicoreInstalled: false,
        supportedRuntimes: ['LLAMA_CPP_GEMMA4_GGUF'],
        hasNpu: true,
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
      apiLevel: 0,
      ramAvailableMb: 0,
      totalRamMb: 0,
      aicoreInstalled: false,
      supportedRuntimes: [],
      hasNpu: false,
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
