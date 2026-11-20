import 'package:flutter_test/flutter_test.dart';
import 'package:locallens/services/native_platform_service.dart';

void main() {
  group('NativePlatformService & B6 AI Bridge Tests', () {
    test('test mode returns safe telemetry without throwing MissingPluginException', () async {
      final service = NativePlatformService(isTestMode: true);

      final diskSpace = await service.getAvailableDiskSpaceBytes();
      expect(diskSpace, greaterThan(0));

      final netStatus = await service.getNetworkStatus();
      expect(netStatus, DeviceNetworkStatus.wifi);

      final aiCaps = await service.getDeviceAICapabilities();
      expect(aiCaps.apiLevel, 34);
      expect(aiCaps.supportedRuntimes, contains('LLAMA_CPP_GEMMA4_GGUF'));
      expect(aiCaps.npuDetectionSupported, isFalse); // No fabricated NPU detection

      final aicoreResult = await service.checkAICoreAvailability();
      expect(aicoreResult.isSupportedDevice, isTrue);
      expect(aicoreResult.isAvailable, isFalse); // Not installed in test

      final status = await service.getNativeAiStatus();
      expect(status, NativeAiStatus.aicoreNotInstalled);
    });

    test('B6 summarization and keyword extraction methods return structured unassisted response without fabricating inference', () async {
      final service = NativePlatformService(isTestMode: true);

      final summaryRes = await service.summarizeOfflineNote(
        noteText: 'Crisp golden dose at CTR',
        spotName: 'CTR Shri Sagar',
        language: 'en',
      );
      expect(summaryRes['success'], isFalse);
      expect(summaryRes['code'], 'MODEL_NOT_DOWNLOADED');
      expect(summaryRes['isLocalInference'], isFalse);
      expect(summaryRes['spotName'], 'CTR Shri Sagar');

      final keywordsRes = await service.extractOfflineKeywords(
        text: 'heritage coffee filter breakfast dose',
      );
      expect(keywordsRes['success'], isFalse);
      expect(keywordsRes['code'], 'MODEL_NOT_DOWNLOADED');
      expect(keywordsRes['isLocalInference'], isFalse);
    });

    test('executeOfflineInference strictly refuses to fabricate inference when model is uninstalled', () async {
      final service = NativePlatformService(isTestMode: true);

      final result = await service.executeOfflineInference(
        prompt: 'Summarize CTR dosas and filter coffee',
        engine: 'AICORE',
      );

      // Invariant: Never claim inference succeeded unless actual local inference runs!
      expect(result['success'], isFalse);
      expect(result['isLocalInference'], isFalse);
      expect(result['code'], 'MODEL_NOT_DOWNLOADED');
      expect(result['message'], contains('Running in unassisted mode'));
    });
  });
}
