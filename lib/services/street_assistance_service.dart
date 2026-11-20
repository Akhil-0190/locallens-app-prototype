import 'package:flutter_tts/flutter_tts.dart';

/// Model representing regional cultural greetings and vendor interaction phrases.
class OrderingCard {
  final String phraseRegional;
  final String phonetic;
  final String englishMeaning;
  final String category; // 'GREETING', 'FOOD_ORDER', 'PRICING', 'DIETARY'
  final String usageTip;

  const OrderingCard({
    required this.phraseRegional,
    required this.phonetic,
    required this.englishMeaning,
    required this.category,
    required this.usageTip,
  });
}

/// Model representing camera-based visual translation result.
class CameraTranslationResult {
  final String detectedScript;
  final String originalText;
  final String translatedText;
  final String culturalContext;
  final bool isSimulated;

  const CameraTranslationResult({
    required this.detectedScript,
    required this.originalText,
    required this.translatedText,
    required this.culturalContext,
    this.isSimulated = true,
  });
}

/// Street-ready AI assistance, translation, and local audio guidance service.
///
/// INTEGRATION BOUNDARY:
/// - Developer B owns Gemini Live, conversational AI behavior, and camera translation (B5).
/// - As B5 is not yet deployed, this service uses an isolated sample adapter.
/// - Clearly discloses: [Sample AI: Simulated B5 response].
/// - Text-to-Speech audio guidance runs locally via flutter_tts on the client device.
class StreetAssistanceService {
  final FlutterTts _tts = FlutterTts();
  bool _isSpeaking = false;

  bool get isSpeaking => _isSpeaking;

  StreetAssistanceService() {
    _initTts();
  }

  Future<void> _initTts() async {
    try {
      await _tts.setLanguage('en-IN');
      await _tts.setSpeechRate(0.48);
      await _tts.setVolume(1.0);
      await _tts.setPitch(1.0);

      _tts.setStartHandler(() => _isSpeaking = true);
      _tts.setCompletionHandler(() => _isSpeaking = false);
      _tts.setErrorHandler((_) => _isSpeaking = false);
    } catch (_) {
      // Graceful fallback if TTS engine is unavailable on device
    }
  }

  /// Speaks local audio walking cue via device TTS engine.
  Future<void> speakAudioPrompt(String text) async {
    try {
      await _tts.stop();
      if (text.isNotEmpty) {
        _isSpeaking = true;
        await _tts.speak(text);
      }
    } catch (_) {
      _isSpeaking = false;
    }
  }

  Future<void> stopAudioPrompt() async {
    try {
      await _tts.stop();
      _isSpeaking = false;
    } catch (_) {
      _isSpeaking = false;
    }
  }

  /// Returns authentic regional Kannada & English ordering phrases for local stalls.
  List<OrderingCard> getCulturalOrderingCards() {
    return const [
      OrderingCard(
        phraseRegional: 'ನಮಸ್ಕಾರ, ಒಂದು ಕಪ್ ಫಿಲ್ಟರ್ ಕಾಫಿ ಕೊಡಿ',
        phonetic: 'Namaskara, ondu cup filter coffee kodi',
        englishMeaning: 'Hello, please give one cup of filter coffee.',
        category: 'FOOD_ORDER',
        usageTip: 'Say with a warm nod at heritage darshini counters.',
      ),
      OrderingCard(
        phraseRegional: 'ಬಿಸಿ ಬಿಸಿ ಬೆಣ್ಣೆ ದೋಸೆ ಇದೆಯಾ?',
        phonetic: 'Bisi bisi benne dose ideya?',
        englishMeaning: 'Do you have hot crisp butter dose ready?',
        category: 'FOOD_ORDER',
        usageTip: 'Ask at CTR / Shri Sagar to confirm the current batch.',
      ),
      OrderingCard(
        phraseRegional: 'ಖಾರ ಕಡಿಮೆ ಮಾಡಿ, ಸಾಗು ಜಾಸ್ತಿ ಕೊಡಿ',
        phonetic: 'Khaara kadime maadi, saagu jaasthi kodi',
        englishMeaning: 'Make it less spicy, give extra potato saagu.',
        category: 'DIETARY',
        usageTip: 'Useful for travelers with lower spice tolerance.',
      ),
      OrderingCard(
        phraseRegional: 'ಎಷ್ಟು ಆಯ್ತು ಸರ್ / ಮೇಡಂ?',
        phonetic: 'Eshtu aaythu sir / madam?',
        englishMeaning: 'How much does this cost, sir / madam?',
        category: 'PRICING',
        usageTip: 'Ask before paying via UPI QR code or cash.',
      ),
      OrderingCard(
        phraseRegional: 'ತುಂಬಾ ರುಚಿಯಾಗಿದೆ, ಧನ್ಯವಾದಗಳು!',
        phonetic: 'Thumba ruchiyaagide, dhanyavaadagalu!',
        englishMeaning: 'It is very delicious, thank you!',
        category: 'GREETING',
        usageTip: 'Always brings a delighted smile to stall owners.',
      ),
    ];
  }

  /// Simulated conversational Q&A adapter adhering to anticipated B5 dialogue schema.
  Future<String> askStreetCopilot(String query) async {
    await Future.delayed(const Duration(milliseconds: 350));
    final q = query.toLowerCase();

    if (q.contains('coffee') || q.contains('ctr') || q.contains('benne')) {
      return '[Sample AI: Simulated B5 response] Shri Sagar (CTR) has been serving its signature benne dose since the 1950s. Order at the front register first, collect your token, and take a seat in the heritage wood-panel hall.';
    } else if (q.contains('temple') || q.contains('dress') || q.contains('shoes')) {
      return '[Sample AI: Simulated B5 response] For Kadu Malleshwara Temple, remove footwear at the courtyard gate before entering. Modest dress covering shoulders and knees is traditional.';
    } else if (q.contains('rain') || q.contains('alley') || q.contains('water')) {
      return '[Sample AI: Simulated B5 response] During heavy rains, 8th Cross Flower Market alley can be slippery. Divert via 7th Cross Margosa Road for covered pedestrian pathways.';
    }

    return '[Sample AI: Simulated B5 response] You are on 8th Cross Road in Malleshwaram. The street is known for fresh jasmine garlands, heritage tiffin stalls, and artisan bronze vessels.';
  }

  /// Simulated visual translation adapter for captured street signage.
  Future<CameraTranslationResult> translateStreetImage(String imagePath) async {
    await Future.delayed(const Duration(milliseconds: 400));

    return const CameraTranslationResult(
      detectedScript: 'Kannada (ಕನ್ನಡ)',
      originalText: 'ಶ್ರೀ ಸಾಗರ್ ಉಪಹಾರ ಗೃಹ — ಶುದ್ಧ ತುಪ್ಪ ಮತ್ತು ಬೆಣ್ಣೆ ದೋಸೆ',
      translatedText: 'Shri Sagar Refreshments — Pure Ghee & Butter Dose',
      culturalContext:
          'Heritage signage of Central Tiffin Room dating back to early 20th century Bengaluru.',
      isSimulated: true,
    );
  }
}
