import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/offline_pack.dart';
import '../providers/spot_providers.dart';
import '../services/native_platform_service.dart';
import '../services/offline_model_manager.dart';
import '../services/offline_pack_service.dart';

final nativePlatformServiceProvider = Provider<NativePlatformService>((ref) {
  return NativePlatformService();
});

final offlinePackServiceProvider = Provider<OfflinePackService>((ref) {
  final db = ref.watch(appDatabaseProvider);
  FirebaseFirestore? firestore;
  try {
    firestore = FirebaseFirestore.instance;
  } catch (_) {}

  return OfflinePackService(
    db: db,
    firestore: firestore,
  );
});

final availablePacksProvider =
    FutureProvider.autoDispose<List<OfflinePackManifest>>((ref) async {
  final service = ref.watch(offlinePackServiceProvider);
  return service.getAvailablePacks();
});

final downloadedPacksProvider =
    FutureProvider.autoDispose<List<OfflinePackManifest>>((ref) async {
  final service = ref.watch(offlinePackServiceProvider);
  return service.getDownloadedPacks();
});

final deviceStorageProvider = FutureProvider.autoDispose<int>((ref) async {
  final nativeService = ref.watch(nativePlatformServiceProvider);
  return nativeService.getAvailableDiskSpaceBytes();
});

final deviceNetworkProvider =
    FutureProvider.autoDispose<DeviceNetworkStatus>((ref) async {
  final nativeService = ref.watch(nativePlatformServiceProvider);
  return nativeService.getNetworkStatus();
});

final nativeAiCapabilitiesProvider =
    FutureProvider.autoDispose<DeviceAICapabilities>((ref) async {
  final nativeService = ref.watch(nativePlatformServiceProvider);
  return nativeService.getDeviceAICapabilities();
});

final nativeAiStatusProvider =
    FutureProvider.autoDispose<NativeAiStatus>((ref) async {
  final nativeService = ref.watch(nativePlatformServiceProvider);
  return nativeService.getNativeAiStatus();
});

/// Map of packId -> download progress percentage (0.0 to 1.0)
final packDownloadProgressProvider =
    StateProvider<Map<String, double>>((ref) => {});

/// Real Android RAM, storage, GPU/CPU delegate, and Gemma 4 E2B LiteRT-LM status
final edgeDeviceSupportProvider =
    FutureProvider.autoDispose<EdgeDeviceSupport>((ref) async {
  final nativeService = ref.watch(nativePlatformServiceProvider);
  return nativeService.checkEdgeDeviceSupport();
});

final offlineModelManagerProvider = Provider<OfflineModelManager>((ref) {
  final nativeService = ref.watch(nativePlatformServiceProvider);
  return OfflineModelManager(platformService: nativeService);
});
