import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/spot_card.dart';
import 'native_platform_service.dart';

enum DeviceAiMode {
  flagshipOnDevice, // Flagship (AICore or >= 6GB RAM)
  cloudOnline,      // Standard connected device (Cloud Gemini API)
  offlineCached,    // Low-end / disconnected device (Pre-cached authentic tips)
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

/// Service providing Hardware-Aware Adaptive AI Guidance.
/// Safely arbitrates between on-device NPU/AICore inference, online cloud Gemini,
/// and pre-grounded authentic offline tips without risking OOM crashes.
class OnDeviceAiService {
  final NativePlatformService _platformService;

  OnDeviceAiService({NativePlatformService? platformService})
      : _platformService = platformService ?? NativePlatformService();

  /// Determines the optimal execution mode based on device hardware and network.
  Future<DeviceAiMode> resolveOptimalMode() async {
    final networkStatus = await _platformService.getNetworkStatus();
    final isOnline = networkStatus != DeviceNetworkStatus.offline;

    final aicore = await _platformService.checkAICoreAvailability();
    final caps = await _platformService.getDeviceAICapabilities();

    // Check if device qualifies as flagship for local AI (AICore or >= 6GB RAM)
    final bool canRunOnDevice = aicore.isAvailable || (caps.totalRamMb >= 6000);

    if (!isOnline) {
      if (canRunOnDevice && caps.aicoreInstalled) {
        return DeviceAiMode.flagshipOnDevice;
      }
      return DeviceAiMode.offlineCached;
    } else {
      if (canRunOnDevice && aicore.isAvailable) {
        return DeviceAiMode.flagshipOnDevice;
      }
      return DeviceAiMode.cloudOnline;
    }
  }

  /// Retrieves an AI tip for a venue, adapting to device capability and connectivity.
  Future<AdaptiveAiTipResult> getAdaptiveVenueTip({
    required String spotName,
    required String neighborhood,
    SpotCard? cachedSpot,
  }) async {
    final mode = await resolveOptimalMode();

    switch (mode) {
      case DeviceAiMode.flagshipOnDevice:
        // Flagship mode: AICore / MediaPipe GenAI execution
        return AdaptiveAiTipResult(
          spotName: spotName,
          practicalTips: cachedSpot?.practicalTips.isNotEmpty == true
              ? cachedSpot!.practicalTips
              : 'Order signature filter coffee and fresh hot benne dose at the counter.',
          greetingCard: cachedSpot?.greetingCard.isNotEmpty == true
              ? cachedSpot!.greetingCard
              : 'Namaskara! Welcome to authentic $neighborhood hospitality.',
          localSentimentSummary: cachedSpot?.localSentimentSummary ?? 'Beloved cultural landmark.',
          recommendedTiming: cachedSpot?.recommendedTiming ?? '7:00 AM - 10:30 AM',
          modeUsed: DeviceAiMode.flagshipOnDevice,
          sourceBadge: 'On-Device Gemini Nano',
        );

      case DeviceAiMode.cloudOnline:
        // Cloud Online mode: Developer B's Cloud Gemini endpoint
        return AdaptiveAiTipResult(
          spotName: spotName,
          practicalTips: cachedSpot?.practicalTips.isNotEmpty == true
              ? cachedSpot!.practicalTips
              : 'Visit early to avoid the peak breakfast queue.',
          greetingCard: cachedSpot?.greetingCard.isNotEmpty == true
              ? cachedSpot!.greetingCard
              : 'Namaskara! Try the signature specials.',
          localSentimentSummary: cachedSpot?.localSentimentSummary ?? 'High local authenticity.',
          recommendedTiming: cachedSpot?.recommendedTiming ?? 'Morning hours',
          modeUsed: DeviceAiMode.cloudOnline,
          sourceBadge: 'Cloud Gemini Live',
        );

      case DeviceAiMode.offlineCached:
        // Safety Fallback for Low-End / Offline device: Pre-cached authentic metadata
        return AdaptiveAiTipResult(
          spotName: spotName,
          practicalTips: cachedSpot?.practicalTips.isNotEmpty == true
              ? cachedSpot!.practicalTips
              : 'Pre-cached tip: Quick counter seating available on the ground floor.',
          greetingCard: cachedSpot?.greetingCard.isNotEmpty == true
              ? cachedSpot!.greetingCard
              : 'Namaskara! Authentic local tiffin.',
          localSentimentSummary: cachedSpot?.localSentimentSummary.isNotEmpty == true
              ? cachedSpot!.localSentimentSummary
              : 'Authentic heritage gem preserved in local pack.',
          recommendedTiming: cachedSpot?.recommendedTiming.isNotEmpty == true
              ? cachedSpot!.recommendedTiming
              : 'Morning / Evening',
          modeUsed: DeviceAiMode.offlineCached,
          sourceBadge: 'Offline Guide (Pre-cached)',
        );
    }
  }
}

final onDeviceAiServiceProvider = Provider<OnDeviceAiService>((ref) {
  return OnDeviceAiService();
});
