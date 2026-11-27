import 'dart:convert';
import 'dart:io';
import 'package:cloud_functions/cloud_functions.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/services.dart';
import 'package:flutter_tts/flutter_tts.dart';
import 'package:google_mlkit_text_recognition/google_mlkit_text_recognition.dart';
import 'package:url_launcher/url_launcher.dart';
import 'native_platform_service.dart';

/// Model representing regional cultural greetings and vendor interaction phrases.
class OrderingCard {
  final String phraseRegional;
  final String phonetic;
  final String englishMeaning;
  final String category; // 'GREETING', 'FOOD_ORDER', 'PRICING', 'DIETARY'
  final String usageTip;
  final String? formalityLevel;
  final String? contextSuitability;

  const OrderingCard({
    required this.phraseRegional,
    required this.phonetic,
    required this.englishMeaning,
    required this.category,
    required this.usageTip,
    this.formalityLevel,
    this.contextSuitability,
  });

  factory OrderingCard.fromMap(Map<String, dynamic> map) {
    return OrderingCard(
      phraseRegional: map['phraseRegional']?.toString() ?? '',
      phonetic: map['phonetic']?.toString() ?? '',
      englishMeaning: map['englishMeaning']?.toString() ?? '',
      category: map['category']?.toString() ?? 'FOOD_ORDER',
      usageTip: map['usageTip']?.toString() ?? '',
      formalityLevel: map['formalityLevel']?.toString(),
      contextSuitability: map['contextSuitability']?.toString(),
    );
  }
}

class DynamicOrderingCardsResult {
  final List<OrderingCard> cards;
  final String targetLanguage;
  final String modelUsed;
  final bool isLiveAi;

  const DynamicOrderingCardsResult({
    required this.cards,
    required this.targetLanguage,
    required this.modelUsed,
    required this.isLiveAi,
  });
}

/// Model representing camera-based visual translation result.
class CameraTranslationResult {
  final String detectedScript;
  final String originalText;
  final String translatedText;
  final String culturalContext;
  final String engineLabel;

  const CameraTranslationResult({
    required this.detectedScript,
    required this.originalText,
    required this.translatedText,
    required this.culturalContext,
    this.engineLabel = 'Gemini 3.8 Flash Vision',
  });
}

/// Street-ready AI assistance, translation, and local audio guidance service.
///
/// Calls Cloud Functions `Assistance-*` online, or falls back to on-device
/// Gemma 4 E2B (LiteRT-LM) / Google ML Kit offline translation when offline.
/// Text-to-Speech audio guidance runs locally via `flutter_tts` on the client device.
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

  /// Fetches dynamic spot-specific vendor ordering cards via `Assistance-getOrderingPhrases`
  /// powered by Gemini 3.8 Flash (with Firestore cache per spot + language).
  Future<DynamicOrderingCardsResult> fetchDynamicOrderingCards({
    String? spotId,
    String? spotName,
    String neighborhood = 'Malleshwaram',
    String targetLanguage = 'kn-IN',
    String targetVendorType = 'GENERAL',
    List<String>? menuHints,
    List<String>? dietaryRestrictions,
  }) async {
    try {
      final callable = FirebaseFunctions.instanceFor(region: 'us-central1')
          .httpsCallable('Assistance-getOrderingPhrases');
      final response = await callable.call<Map<String, dynamic>>({
        'neighborhood': neighborhood,
        'language': targetLanguage,
        'targetLanguage': targetLanguage,
        'targetVendorType': targetVendorType,
        if (spotId != null && spotId.isNotEmpty) 'spotId': spotId,
        if (spotName != null && spotName.isNotEmpty) 'spotName': spotName,
        if (menuHints != null && menuHints.isNotEmpty) 'menuHints': menuHints,
        if (dietaryRestrictions != null && dietaryRestrictions.isNotEmpty)
          'dietaryRestrictions': dietaryRestrictions,
      });

      final envelope = Map<String, dynamic>.from(response.data);
      final data = envelope['data'] is Map
          ? Map<String, dynamic>.from(envelope['data'] as Map)
          : envelope;
      final rawCards = data['cards'] as List<dynamic>? ?? const [];
      final parsedCards = rawCards
          .whereType<Map>()
          .map((c) => OrderingCard.fromMap(Map<String, dynamic>.from(c)))
          .where((c) => c.phraseRegional.isNotEmpty)
          .toList();

      if (parsedCards.isNotEmpty) {
        final modelUsed = data['modelUsed']?.toString() ?? 'gemini-3.8-flash';
        return DynamicOrderingCardsResult(
          cards: parsedCards,
          targetLanguage: data['targetLanguage']?.toString() ?? targetLanguage,
          modelUsed: modelUsed,
          isLiveAi: modelUsed != 'curated-cultural-repository',
        );
      }
    } catch (_) {
      // Fall back to local offline phrase book when unreachable
    }

    return DynamicOrderingCardsResult(
      cards: getCulturalOrderingCards(),
      targetLanguage: targetLanguage,
      modelUsed: 'offline-phrasebook-fallback',
      isLiveAi: false,
    );
  }

  /// Conversational Q&A backed by Cloud Function `Assistance-askStreetCopilot`.
  /// Throws an explicit error when unreachable so UI can offer on-device AI or retry.
  Future<String> askStreetCopilot(
    String query, {
    String neighborhood = 'Malleshwaram',
    String preferredLanguage = 'en-IN',
  }) async {
    String uid = 'guest_traveler';
    try {
      uid = FirebaseAuth.instance.currentUser?.uid ?? 'guest_traveler';
    } catch (_) {}

    final callable = FirebaseFunctions.instanceFor(region: 'us-central1')
        .httpsCallable('Assistance-askStreetCopilot');
    final result = await callable.call<Map<String, dynamic>>({
      'query': query,
      'travelerContext': {
        'currentNeighborhood': neighborhood,
        'preferredLanguage': preferredLanguage,
      },
      'isGuestAccess': true,
      'userId': uid,
    });
    final data = Map<String, dynamic>.from(result.data);
    if (data['answer'] is String && (data['answer'] as String).isNotEmpty) {
      return data['answer'] as String;
    }
    if (data['data'] is Map) {
      final subData = Map<String, dynamic>.from(data['data'] as Map);
      if (subData['answer'] is String && (subData['answer'] as String).isNotEmpty) {
        return subData['answer'] as String;
      }
    }
    throw Exception('Street Copilot returned an empty response. Please try again.');
  }

  /// Real 2-Path Camera Sign & Menu Translation:
  /// - Path A (Offline / Edge Vision): On-device Gemma 4 E2B Multimodal (LiteRT-LM) supporting 140+ languages directly from pixels.
  /// - Path B (Online Cloud Vision): `Assistance-translateCameraSignage` powered by Gemini 3.8 Flash vision.
  /// - Path C (Offline Fallback when Gemma 4 E2B isn't downloaded): Multi-script Google ML Kit OCR with honest status.
  Future<CameraTranslationResult> translateStreetImage(
    String imagePath, {
    String targetLanguage = 'en',
  }) async {
    if (imagePath.isEmpty || !File(imagePath).existsSync()) {
      return const CameraTranslationResult(
        detectedScript: 'Unavailable',
        originalText: '',
        translatedText: 'No readable image file was captured.',
        culturalContext: 'Capture a clear, well-lit photo of the storefront sign or menu.',
        engineLabel: 'Capture Error',
      );
    }

    final nativePlatform = NativePlatformService();
    final networkStatus = await nativePlatform.getNetworkStatus();
    final isOffline = networkStatus == DeviceNetworkStatus.offline;
    final edgeSupport = await nativePlatform.checkEdgeDeviceSupport();

    // PATH A: On-Device Gemma 4 E2B Multimodal Vision (140+ languages, zero internet required)
    if (edgeSupport.gemmaE2bSupported &&
        edgeSupport.gemmaModelDownloaded &&
        (isOffline || edgeSupport.gemmaLoaded)) {
      const prompt =
          'Read every sign, menu item, and price in this street photo (any script/language). '
          'Return strict JSON only: '
          '{"detectedScript":"...","originalText":"...","translatedText":"...","culturalContext":"..."}';
      final gen = await nativePlatform.runGemmaMultimodal(
        prompt: prompt,
        imagePath: imagePath,
        modelPath: edgeSupport.gemmaModelPath,
      );
      if (gen.success && gen.text.isNotEmpty) {
        try {
          final cleaned = gen.text
              .replaceAll(RegExp(r'^```json\s*', multiLine: true), '')
              .replaceAll(RegExp(r'^```\s*', multiLine: true), '')
              .replaceAll(RegExp(r'```\s*$', multiLine: true), '')
              .trim();
          final decoded = jsonDecode(cleaned);
          if (decoded is Map<String, dynamic>) {
            return CameraTranslationResult(
              detectedScript: decoded['detectedScript']?.toString() ?? 'Detected On-Device',
              originalText: decoded['originalText']?.toString() ?? '',
              translatedText: decoded['translatedText']?.toString() ?? gen.text,
              culturalContext: decoded['culturalContext']?.toString() ??
                  'Translated 100% offline via on-device Gemma 4 E2B (${gen.backend}).',
              engineLabel: 'On-Device Gemma 4 E2B (${gen.backend})',
            );
          }
        } catch (_) {
          // If model replied in natural prose instead of strict JSON, display it cleanly
          return CameraTranslationResult(
            detectedScript: 'Multimodal On-Device Vision',
            originalText: '(Captured Street Signage)',
            translatedText: gen.text,
            culturalContext:
                'Translated 100% offline via on-device Gemma 4 E2B (${gen.backend}, ${gen.tokensPerSec.toStringAsFixed(1)} tok/s).',
            engineLabel: 'On-Device Gemma 4 E2B (${gen.backend})',
          );
        }
      }
    }

    // PATH B: Online Cloud Gemini 3.8 Flash Vision (`Assistance-translateCameraSignage`)
    if (!isOffline) {
      try {
        final bytes = await File(imagePath).readAsBytes();
        final lowerPath = imagePath.toLowerCase();
        final mimeType = lowerPath.endsWith('.png')
            ? 'image/png'
            : lowerPath.endsWith('.webp')
                ? 'image/webp'
                : 'image/jpeg';

        String uid = 'guest_traveler';
        try {
          uid = FirebaseAuth.instance.currentUser?.uid ?? 'guest_traveler';
        } catch (_) {}

        final callable = FirebaseFunctions.instanceFor(region: 'us-central1')
            .httpsCallable('Assistance-translateCameraSignage');
        final response = await callable.call<Map<String, dynamic>>({
          'imagePayload': {
            'base64Data': base64Encode(bytes),
            'mimeType': mimeType,
          },
          'captureContext': 'MENU_BOARD',
          'targetLanguage': targetLanguage,
          'isGuestAccess': true,
          'userId': uid,
        });

        final envelope = Map<String, dynamic>.from(response.data);
        final data = envelope['data'] is Map
            ? Map<String, dynamic>.from(envelope['data'] as Map)
            : envelope;

        final translated = data['translatedText']?.toString() ?? '';
        final original = data['originalText']?.toString() ?? '';
        final script = data['detectedScript']?.toString() ?? 'Detected Script';
        final contextNote = data['culturalContext']?.toString() ?? '';
        final modelUsed = data['modelUsed']?.toString() ?? 'gemini-3.8-flash';

        final menuItems = data['menuItemsDetected'] as List<dynamic>? ?? const [];
        final menuSummary = menuItems
            .whereType<Map>()
            .map((m) {
              final name = m['itemName']?.toString() ?? '';
              final price = m['priceDetected']?.toString();
              return price != null && price.isNotEmpty ? '$name ($price)' : name;
            })
            .where((s) => s.isNotEmpty)
            .join(', ');

        if (translated.isNotEmpty || original.isNotEmpty) {
          return CameraTranslationResult(
            detectedScript: script,
            originalText: original,
            translatedText: menuSummary.isNotEmpty
                ? '$translated\n\nMenu items: $menuSummary'
                : translated,
            culturalContext: contextNote.isNotEmpty
                ? contextNote
                : 'Translated online via Cloud Gemini 3.8 Flash Vision.',
            engineLabel: 'Cloud Vision ($modelUsed)',
          );
        }
      } catch (_) {
        // Fall through cleanly to on-device ML Kit OCR
      }
    }

    // PATH C: Honest On-Device ML Kit OCR Fallback (Latin + Devanagari)
    String recognizedText = '';
    String scriptDetected = 'On-Device ML Kit OCR';
    try {
      final inputImage = InputImage.fromFilePath(imagePath);
      final latinRecognizer = TextRecognizer(script: TextRecognitionScript.latin);
      final latinRes = await latinRecognizer.processImage(inputImage);
      await latinRecognizer.close();

      recognizedText = latinRes.text.trim();
      if (recognizedText.isEmpty) {
        final devanagariRecognizer =
            TextRecognizer(script: TextRecognitionScript.devanagiri);
        final devRes = await devanagariRecognizer.processImage(inputImage);
        await devanagariRecognizer.close();
        if (devRes.text.trim().isNotEmpty) {
          recognizedText = devRes.text.trim();
          scriptDetected = 'On-Device ML Kit OCR (Devanagari)';
        }
      }
    } catch (_) {}

    if (recognizedText.isNotEmpty) {
      return CameraTranslationResult(
        detectedScript: scriptDetected,
        originalText: recognizedText,
        translatedText: recognizedText,
        culturalContext: edgeSupport.gemmaE2bSupported
            ? 'Text extracted offline via ML Kit OCR. Download Gemma 4 E2B in Offline Packs for 140+ language offline translation.'
            : 'Text extracted offline via ML Kit OCR (device RAM < 6 GB safety guard; reconnect for Cloud Gemini 3.8 Flash translation).',
        engineLabel: 'On-Device ML Kit OCR',
      );
    }

    return const CameraTranslationResult(
      detectedScript: 'Unreadable / Offline',
      originalText: '',
      translatedText:
          'Could not read text offline without Gemma 4 E2B installed. Download Gemma 4 E2B over Wi-Fi or reconnect for Gemini 3.8 Flash Vision.',
      culturalContext: 'Ensure good lighting and hold the camera steady over the sign.',
      engineLabel: 'Offline (Model Not Downloaded)',
    );
  }

  /// Objective 9: Gemini Ecosystem Handoff
  ///
  /// Launches Gemini external application or web prompt with preserved local route context.
  /// Falls back gracefully to browser URL if the native Gemini app is not installed.
  Future<bool> launchGeminiHandoff({
    required String contextPrompt,
    String? neighborhood,
    String? currentStop,
  }) async {
    final buffer = StringBuffer();
    if (neighborhood != null && neighborhood.isNotEmpty) {
      buffer.write('Exploring $neighborhood, Bengaluru. ');
    }
    if (currentStop != null && currentStop.isNotEmpty) {
      buffer.write('Currently at $currentStop. ');
    }
    buffer.write(contextPrompt);

    // Copy formatted context prompt to clipboard for 1-tap paste
    await Clipboard.setData(ClipboardData(text: buffer.toString()));

    final encodedPrompt = Uri.encodeComponent(buffer.toString());
    final uri = Uri.parse('https://gemini.google.com/app?prompt=$encodedPrompt');

    try {
      final launched = await launchUrl(uri, mode: LaunchMode.externalApplication);
      if (!launched) {
        return await launchUrl(uri, mode: LaunchMode.platformDefault);
      }
      return launched;
    } catch (_) {
      return false;
    }
  }
}
