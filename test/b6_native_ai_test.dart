import 'dart:io';
import 'package:flutter_test/flutter_test.dart';
import 'package:locallens/services/native_platform_service.dart';
import 'package:locallens/services/offline_model_manager.dart';

void main() {
  group('Task B6 On-Device AI & Native Integration Test Suite', () {
    test('OfflineModelManager metadata, path, and size constants conform to B6 contract', () {
      expect(OfflineModelManager.modelFileName, 'gemma-4-E2B-it-Q4_K_M.gguf');
      expect(OfflineModelManager.expectedSizeBytes, 3344000000);
      expect(
        OfflineModelManager.expectedSha256,
        '740185b21d22ceb83a11c3aa62ad5842ef32c70f6096d756bbee85a1e4ec34b8',
      );
      expect(OfflineModelManager.minRequiredDiskSpaceMb, 5000);
      expect(
        OfflineModelManager.downloadUrl,
        contains('90f9618340396838ee7ff5b0ba2da27da62953d3'),
      );
    });

    test('OfflineModelManager rejects invalid checksums cleanly', () async {
      final manager = OfflineModelManager();
      final tempDir = await Directory.systemTemp.createTemp('b6_test_');
      final dummyFile = File('${tempDir.path}/dummy_corrupt.bin');
      await dummyFile.writeAsString('corrupted model weight payload');

      final isValid = await manager.verifyChecksum(dummyFile);
      expect(isValid, isFalse);

      await tempDir.delete(recursive: true);
    });

    test('NativePlatformService returns honest provenance and fallback in test mode', () async {
      final service = NativePlatformService(isTestMode: true);

      final aiCoreResult = await service.checkAICoreAvailability();
      expect(aiCoreResult.isAvailable, isFalse);
      expect(aiCoreResult.apiLevel, 34);

      final caps = await service.getDeviceAICapabilities();
      expect(caps.hasNpu, isFalse);
      expect(caps.ramAvailableMb, 4096);
      expect(caps.totalRamMb, 8192);

      final noteSummary = await service.summarizeOfflineNote(
        noteText: 'Visited CTR early morning. Best benne masala dosa.',
        spotName: 'CTR Malleshwaram',
      );
      expect(noteSummary['isLocalInference'], isFalse);
      expect(noteSummary['modelUsed'], 'NONE (Unassisted Fallback)');
      expect(noteSummary['code'], 'MODEL_NOT_DOWNLOADED');

      final keywords = await service.extractOfflineKeywords(
        text: 'Temple street walking tour with filter coffee',
      );
      expect(keywords['isLocalInference'], isFalse);
      expect(keywords['modelUsed'], 'NONE (Unassisted Fallback)');

      final directInference = await service.executeOfflineInference(
        prompt: 'Tell me about Malleshwaram',
      );
      expect(directInference['isLocalInference'], isFalse);
      expect(directInference['code'], 'MODEL_NOT_DOWNLOADED');
    });

    test('OfflineModelManager and NativePlatformService model-path consistency', () async {
      final tempDir = await Directory.systemTemp.createTemp('b6_path_test_');
      final manager = OfflineModelManager(baseDirectory: tempDir);

      final modelFile = await manager.getModelFile();
      final modelPath = await manager.getModelPath();

      // Path consistency checks
      expect(modelPath, equals(modelFile.path));
      expect(modelFile.path, endsWith('models/gemma-4-E2B-it-Q4_K_M.gguf'));
      expect(modelFile.parent.existsSync(), isTrue);
      expect(modelFile.parent.path, endsWith('models'));

      // Verify NativePlatformService can receive the validated path
      final service = NativePlatformService(isTestMode: true);
      final inferenceResult = await service.executeOfflineInference(
        prompt: 'Test prompt',
        engine: 'LLAMA_CPP',
        modelPath: modelPath,
      );
      expect(inferenceResult['isLocalInference'], isFalse);
      expect(inferenceResult['code'], 'MODEL_NOT_DOWNLOADED');

      await tempDir.delete(recursive: true);
    });
  });
}
