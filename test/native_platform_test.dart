import 'package:flutter_test/flutter_test.dart';
import 'package:locallens/services/native_platform_service.dart';
import 'fakes/fake_services.dart';

void main() {
  group('NativePlatformService & B6 AI Bridge Tests', () {
    test('fake platform service returns safe telemetry without MissingPluginException', () async {
      final service = FakeNativePlatformService();

      final diskSpace = await service.getAvailableDiskSpaceBytes();
      expect(diskSpace, greaterThan(0));

      final netStatus = await service.getNetworkStatus();
      expect(netStatus, DeviceNetworkStatus.wifi);

      final aiCaps = await service.getDeviceAICapabilities();
      expect(aiCaps.hasNpu, isFalse);
      expect(aiCaps.ramAvailableMb, greaterThan(0));
      expect(aiCaps.aicoreVersion, 0);
      expect(aiCaps.supportedFeatures, contains('LITERT_LM_GEMMA4_E2B'));
      expect(aiCaps.apiLevel, 34);
      expect(aiCaps.npuDetectionSupported, isFalse);

      final aicoreResult = await service.checkAICoreAvailability();
      expect(aicoreResult.isSupportedDevice, isTrue);
      expect(aicoreResult.isAvailable, isFalse);

      final status = await service.getNativeAiStatus();
      expect(status, NativeAiStatus.aicoreNotInstalled);
    });

    test('B6 summarization and keyword extraction methods return structured unassisted response without fabricating inference', () async {
      final service = FakeNativePlatformService();

      final summaryRes = await service.summarizeOfflineNote(
        noteText: 'Crisp golden dose at CTR',
        spotName: 'CTR Shri Sagar',
        language: 'en',
      );
      expect(summaryRes['success'], isFalse);
      expect(summaryRes['code'], 'MODEL_NOT_DOWNLOADED');
      expect(summaryRes['isLocalInference'], isFalse);
      expect(summaryRes['modelUsed'], 'NONE (Unassisted Fallback)');
      expect(summaryRes['spotName'], 'CTR Shri Sagar');

      final keywordsRes = await service.extractOfflineKeywords(
        text: 'heritage coffee filter breakfast dose',
      );
      expect(keywordsRes['success'], isFalse);
      expect(keywordsRes['code'], 'MODEL_NOT_DOWNLOADED');
      expect(keywordsRes['isLocalInference'], isFalse);
      expect(keywordsRes['modelUsed'], 'NONE (Unassisted Fallback)');
    });

    test('checkModelProvisioning reports unprovisioned status honestly', () async {
      final service = FakeNativePlatformService();

      final prov = await service.checkModelProvisioning(engine: 'GEMMA_GGUF');
      expect(prov['isProvisioned'], isFalse);
      expect(prov['gemmaModelDownloaded'], isFalse);
      expect(prov['aicoreInstalled'], isFalse);
    });

    test('executeOfflineInference strictly refuses to fabricate inference when model is uninstalled', () async {
      final service = FakeNativePlatformService();

      final result = await service.executeOfflineInference(
        prompt: 'Summarize CTR dosas and filter coffee',
        engine: 'AICORE',
      );

      expect(result['success'], isFalse);
      expect(result['isLocalInference'], isFalse);
      expect(result['code'], 'MODEL_NOT_DOWNLOADED');
      expect(result['message'], isNotEmpty);
    });
  });
}
