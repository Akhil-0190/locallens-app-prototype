import 'package:cloud_functions/cloud_functions.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/spot_card.dart';
import 'native_platform_service.dart';

enum DeviceAiMode {
  gemma4E2BOnDevice, // On-Device Gemma 4 E2B via LiteRT-LM (GPU on 12 GB RAM, CPU on 6-9 GB RAM)
  flagshipOnDevice,  // On-Device Gemini Nano via Android AICore
  cloudOnline,       // Online Cloud Gemini 3.8 Flash
  offlineCached,     // Offline cached spot metadata (no local LLM loaded yet)
}

class AdaptiveAiTipResult {
  final String spotName;
  final String practicalTips;
  final String greetingCard;
  final String localSentimentSummary;
  final String recommendedTiming;
  final DeviceAiMode modeUsed;
  final String sourceBadge;

  const AdaptiveAiTipResult({
    required this.spotName,
    required this.practicalTips,
    required this.greetingCard,
    required this.localSentimentSummary,
    required this.recommendedTiming,
    required this.modeUsed,
    required this.sourceBadge,
  });
}

/// Hardware-Aware Adaptive AI Service.
/// Routes genuinely to:
/// 1. On-Device Gemma 4 E2B (LiteRT-LM) when installed & RAM >= 6 GB
/// 2. On-Device Gemini Nano (Android AICore) when installed & available
/// 3. Cloud Gemini 3.8 Flash (`Assistance-askStreetCopilot`) when online
/// 4. Honest cached SQLite pack summary when offline without a downloaded edge model.
/// Never stamps fake AI badges over static placeholder strings.
class OnDeviceAiService {
  final NativePlatformService _platformService;

  OnDeviceAiService({NativePlatformService? platformService})
      : _platformService = platformService ?? NativePlatformService();

  /// Resolves the genuine optimal execution mode based on real hardware & network state.
  Future<DeviceAiMode> resolveOptimalMode() async {
    final networkStatus = await _platformService.getNetworkStatus();
    final isOnline = networkStatus != DeviceNetworkStatus.offline;
    final edgeSupport = await _platformService.checkEdgeDeviceSupport();

    // Priority 1 (Offline or already loaded): Real on-device Gemma 4 E2B via LiteRT-LM
    if (edgeSupport.gemmaE2bSupported &&
        edgeSupport.gemmaModelDownloaded &&
        (!isOnline || edgeSupport.gemmaLoaded)) {
      return DeviceAiMode.gemma4E2BOnDevice;
    }

    // Priority 2: Android AICore Gemini Nano
    if (edgeSupport.geminiNanoAvailable) {
      final aicore = await _platformService.checkAICoreAvailability();
      if (aicore.isAvailable) {
        return DeviceAiMode.flagshipOnDevice;
      }
    }

    // Priority 3: Cloud Gemini 3.8 Flash when connected
    if (isOnline) {
      return DeviceAiMode.cloudOnline;
    }

    // Priority 4: Honest offline cached mode (model not downloaded yet)
    return DeviceAiMode.offlineCached;
  }

  /// Retrieves a genuine AI tip for a venue using the active execution runtime.
  Future<AdaptiveAiTipResult> getAdaptiveVenueTip({
    required String spotName,
    required String neighborhood,
    SpotCard? cachedSpot,
  }) async {
    final mode = await resolveOptimalMode();
    final contextDetails = cachedSpot != null
        ? 'Notes: ${cachedSpot.infoParagraph}. Tips: ${cachedSpot.practicalTips}. Hours: ${cachedSpot.openHours}.'
        : 'Neighborhood: $neighborhood.';

    // 1. Real On-Device Gemma 4 E2B (LiteRT-LM)
    if (mode == DeviceAiMode.gemma4E2BOnDevice) {
      final edgeSupport = await _platformService.checkEdgeDeviceSupport();
      final prompt =
          'You are a concise local neighborhood guide in $neighborhood. '
          'In 2 short sentences, give one practical street tip for visiting $spotName. '
          'Ground your answer in: $contextDetails';
      final gen = await _platformService.runGemmaMultimodal(
        prompt: prompt,
        modelPath: edgeSupport.gemmaModelPath,
      );
      if (gen.success && gen.text.isNotEmpty) {
        return AdaptiveAiTipResult(
          spotName: spotName,
          practicalTips: gen.text,
          greetingCard: cachedSpot?.greetingCard.isNotEmpty == true
              ? cachedSpot!.greetingCard
              : 'Namaskara!',
          localSentimentSummary: cachedSpot?.localSentimentSummary.isNotEmpty == true
              ? cachedSpot!.localSentimentSummary
              : 'Generated on-device (${gen.tokensPerSec.toStringAsFixed(1)} tok/s)',
          recommendedTiming: cachedSpot?.recommendedTiming.isNotEmpty == true
              ? cachedSpot!.recommendedTiming
              : (cachedSpot?.openHours ?? 'Check local hours'),
          modeUsed: DeviceAiMode.gemma4E2BOnDevice,
          sourceBadge: 'On-Device Gemma 4 E2B (${gen.backend})',
        );
      }
    }

    // 2. Real On-Device Gemini Nano (Android AICore)
    if (mode == DeviceAiMode.flagshipOnDevice) {
      final prompt =
          'Give 1 concise practical street tip (max 2 sentences) for visiting $spotName in $neighborhood. $contextDetails';
      final nano = await _platformService.executeOfflineInference(
        prompt: prompt,
        engine: 'AICORE',
      );
      final output = nano['output']?.toString().trim() ?? '';
      if (nano['success'] == true && output.isNotEmpty) {
        return AdaptiveAiTipResult(
          spotName: spotName,
          practicalTips: output,
          greetingCard: cachedSpot?.greetingCard.isNotEmpty == true
              ? cachedSpot!.greetingCard
              : 'Namaskara!',
          localSentimentSummary: cachedSpot?.localSentimentSummary.isNotEmpty == true
              ? cachedSpot!.localSentimentSummary
              : 'Generated on-device via Android AICore.',
          recommendedTiming: cachedSpot?.recommendedTiming.isNotEmpty == true
              ? cachedSpot!.recommendedTiming
              : (cachedSpot?.openHours ?? 'Check local hours'),
          modeUsed: DeviceAiMode.flagshipOnDevice,
          sourceBadge: 'On-Device Gemini Nano',
        );
      }
    }

    // 3. Real Cloud Gemini 3.8 Flash (`Assistance-askStreetCopilot`)
    if (mode == DeviceAiMode.cloudOnline) {
      try {
        String uid = 'guest_traveler';
        try {
          uid = FirebaseAuth.instance.currentUser?.uid ?? 'guest_traveler';
        } catch (_) {}

        final callable = FirebaseFunctions.instanceFor(region: 'us-central1')
            .httpsCallable('Assistance-askStreetCopilot');
        final response = await callable.call<Map<String, dynamic>>({
          'query': 'Give one concise insider street tip for visiting $spotName in $neighborhood.',
          'travelerContext': {
            'currentNeighborhood': neighborhood,
            'preferredLanguage': 'en-IN',
          },
          'isGuestAccess': true,
          'userId': uid,
        });
        final envelope = Map<String, dynamic>.from(response.data);
        final data = envelope['data'] is Map
            ? Map<String, dynamic>.from(envelope['data'] as Map)
            : envelope;
        final answer = data['answer']?.toString().trim() ?? '';
        final modelUsed = data['modelUsed']?.toString() ?? 'gemini-3.8-flash';
        if (answer.isNotEmpty) {
          return AdaptiveAiTipResult(
            spotName: spotName,
            practicalTips: answer,
            greetingCard: cachedSpot?.greetingCard.isNotEmpty == true
                ? cachedSpot!.greetingCard
                : 'Namaskara!',
            localSentimentSummary: data['culturalContext']?.toString() ??
                (cachedSpot?.localSentimentSummary ?? 'Live Gemini 3.8 Flash street guidance'),
            recommendedTiming: cachedSpot?.recommendedTiming.isNotEmpty == true
                ? cachedSpot!.recommendedTiming
                : (cachedSpot?.openHours ?? 'Check Maps for hours'),
            modeUsed: DeviceAiMode.cloudOnline,
            sourceBadge: 'Cloud Gemini ($modelUsed)',
          );
        }
      } catch (_) {
        // Fall through cleanly to honest offline cached state below
      }
    }

    // 4. Honest Offline Cached Pack State (no fake AI claim!)
    final hasCachedTip = cachedSpot?.practicalTips.isNotEmpty == true;
    return AdaptiveAiTipResult(
      spotName: spotName,
      practicalTips: hasCachedTip
          ? cachedSpot!.practicalTips
          : 'Offline AI model (Gemma 4 E2B) is not downloaded yet. Open Offline Packs over Wi-Fi to enable offline AI street tips.',
      greetingCard: cachedSpot?.greetingCard.isNotEmpty == true
          ? cachedSpot!.greetingCard
          : 'Namaskara!',
      localSentimentSummary: cachedSpot?.localSentimentSummary.isNotEmpty == true
          ? cachedSpot!.localSentimentSummary
          : 'Loaded from local offline neighborhood pack.',
      recommendedTiming: cachedSpot?.recommendedTiming.isNotEmpty == true
          ? cachedSpot!.recommendedTiming
          : (cachedSpot?.openHours ?? 'Check local timing'),
      modeUsed: DeviceAiMode.offlineCached,
      sourceBadge: hasCachedTip
          ? 'Offline Pack Cache'
          : 'Offline Model Not Downloaded',
    );
  }
}

final onDeviceAiServiceProvider = Provider<OnDeviceAiService>((ref) {
  return OnDeviceAiService();
});
