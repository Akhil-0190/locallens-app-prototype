import 'dart:async';
import 'dart:convert';

import 'package:cloud_functions/cloud_functions.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/services.dart';
import 'package:record/record.dart';
import 'package:web_socket_channel/web_socket_channel.dart';

enum LiveVoiceConnectionState {
  disconnected,
  connecting,
  connected,
  listening,
  error,
}

class LiveVoiceTranscriptItem {
  final String id;
  final String speaker; // 'YOU' | 'TRANSLATION' | 'SYSTEM'
  final String text;
  final DateTime timestamp;
  final String? languageCode;

  const LiveVoiceTranscriptItem({
    required this.id,
    required this.speaker,
    required this.text,
    required this.timestamp,
    this.languageCode,
  });
}

class LiveVoiceStateSnapshot {
  final LiveVoiceConnectionState connectionState;
  final String statusMessage;
  final String? sessionId;
  final String modelName;
  final bool isMicStreaming;
  final String? errorMessage;
  final List<LiveVoiceTranscriptItem> transcripts;

  const LiveVoiceStateSnapshot({
    this.connectionState = LiveVoiceConnectionState.disconnected,
    this.statusMessage = 'Ready to connect to Gemini 3.8 Live',
    this.sessionId,
    this.modelName = 'gemini-3.8-live',
    this.isMicStreaming = false,
    this.errorMessage,
    this.transcripts = const [],
  });

  LiveVoiceStateSnapshot copyWith({
    LiveVoiceConnectionState? connectionState,
    String? statusMessage,
    String? sessionId,
    String? modelName,
    bool? isMicStreaming,
    String? errorMessage,
    bool clearError = false,
    List<LiveVoiceTranscriptItem>? transcripts,
  }) {
    return LiveVoiceStateSnapshot(
      connectionState: connectionState ?? this.connectionState,
      statusMessage: statusMessage ?? this.statusMessage,
      sessionId: sessionId ?? this.sessionId,
      modelName: modelName ?? this.modelName,
      isMicStreaming: isMicStreaming ?? this.isMicStreaming,
      errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
      transcripts: transcripts ?? this.transcripts,
    );
  }
}

/// Real-time bidirectional voice translation service powered by Gemini 3.8 Live
/// using ephemeral v1alpha tokens minted by `Assistance-initializeLiveSession`.
///
/// Audio pipeline:
/// - Input: 16kHz 16-bit mono PCM via `record` AudioRecorder stream -> WSS `realtimeInput.audio`
/// - Output: 24kHz 16-bit mono PCM from WSS `serverContent.modelTurn.parts[].inlineData`
///   -> Android native `AudioTrack` via `com.innovotribe.locallens/pcm_audio`.
class GeminiLiveVoiceService {
  static const MethodChannel _pcmChannel =
      MethodChannel('com.innovotribe.locallens/pcm_audio');

  final FirebaseFunctions? _functionsOverride;
  final AudioRecorder _recorder = AudioRecorder();

  WebSocketChannel? _channel;
  StreamSubscription<dynamic>? _wsSubscription;
  StreamSubscription<Uint8List>? _micSubscription;

  final StreamController<LiveVoiceStateSnapshot> _stateController =
      StreamController<LiveVoiceStateSnapshot>.broadcast();

  LiveVoiceStateSnapshot _state = const LiveVoiceStateSnapshot();
  bool _setupComplete = false;
  String _pendingOutputBuffer = '';
  String _pendingInputBuffer = '';

  GeminiLiveVoiceService({FirebaseFunctions? functions})
      : _functionsOverride = functions;

  Stream<LiveVoiceStateSnapshot> get stateStream => _stateController.stream;
  LiveVoiceStateSnapshot get currentState => _state;

  FirebaseFunctions get _functions =>
      _functionsOverride ?? FirebaseFunctions.instanceFor(region: 'us-central1');

  void _emit(LiveVoiceStateSnapshot next) {
    _state = next;
    if (!_stateController.isClosed) {
      _stateController.add(next);
    }
  }

  void _appendTranscript(String speaker, String text, {String? languageCode}) {
    final trimmed = text.trim();
    if (trimmed.isEmpty) return;
    final nextList = [
      ..._state.transcripts,
      LiveVoiceTranscriptItem(
        id: 'tr_${DateTime.now().microsecondsSinceEpoch}',
        speaker: speaker,
        text: trimmed,
        timestamp: DateTime.now(),
        languageCode: languageCode,
      ),
    ];
    _emit(_state.copyWith(transcripts: nextList));
  }

  /// Requests an ephemeral token from Cloud Functions and opens the Gemini 3.8 Live WSS session.
  Future<bool> connect({
    required String sourceLanguage,
    required String targetLanguage,
    String neighborhood = 'Malleshwaram',
    String? spotId,
    String? spotName,
  }) async {
    await disconnect(preserveTranscripts: true);

    _emit(_state.copyWith(
      connectionState: LiveVoiceConnectionState.connecting,
      statusMessage: 'Minting Gemini 3.8 Live ephemeral token...',
      clearError: true,
    ));

    try {
      String uid = 'guest_traveler';
      try {
        uid = FirebaseAuth.instance.currentUser?.uid ?? 'guest_traveler';
      } catch (_) {}

      final callable = _functions.httpsCallable('Assistance-initializeLiveSession');
      final response = await callable.call<Map<String, dynamic>>({
        'travelerId': uid,
        'sessionPurpose': 'VENDOR_ORDERING',
        'preferredLanguage': targetLanguage,
        'sourceLanguage': sourceLanguage,
        'targetLanguage': targetLanguage,
        'neighborhoodHint': neighborhood,
        if (spotId != null && spotId.isNotEmpty) 'spotId': spotId,
        if (spotName != null && spotName.isNotEmpty) 'spotName': spotName,
        'mode': 'BIDI_VOICE_TRANSLATION',
        'isGuestAccess': true,
        'userId': uid,
      });

      final envelope = Map<String, dynamic>.from(response.data);
      final data = envelope['data'] is Map
          ? Map<String, dynamic>.from(envelope['data'] as Map)
          : envelope;

      final isSupported = data['isLiveSessionSupported'] == true;
      final clientConnectionUrl = data['clientConnectionUrl']?.toString();
      final sessionId = data['sessionId']?.toString();
      final model = data['model']?.toString() ?? 'gemini-3.8-live';
      final systemInstructions = data['systemInstructionsApplied']?.toString() ??
          'You are a real-time bidirectional street voice translator between $sourceLanguage and $targetLanguage.';

      if (!isSupported || clientConnectionUrl == null || clientConnectionUrl.isEmpty) {
        final diag = data['diagnostics'] is Map
            ? Map<String, dynamic>.from(data['diagnostics'] as Map)
            : const <String, dynamic>{};
        final reason = diag['notes']?.toString() ??
            'Gemini 3.8 Live ephemeral token is currently unavailable.';
        _emit(_state.copyWith(
          connectionState: LiveVoiceConnectionState.error,
          statusMessage: 'Live voice session unavailable',
          errorMessage: reason,
        ));
        return false;
      }

      _emit(_state.copyWith(
        statusMessage: 'Connecting to Gemini 3.8 Live WebSocket...',
        sessionId: sessionId,
        modelName: model,
      ));

      final channel = WebSocketChannel.connect(Uri.parse(clientConnectionUrl));
      _channel = channel;
      _setupComplete = false;

      // Start native Android 24kHz PCM AudioTrack for zero-jank audio streaming playback
      try {
        await _pcmChannel.invokeMethod('startPcmPlayback', {'sampleRate': 24000});
      } catch (_) {
        // Non-Android / test environment: transcripts still function cleanly
      }

      _wsSubscription = channel.stream.listen(
        _handleServerFrame,
        onError: (Object error) {
          _emit(_state.copyWith(
            connectionState: LiveVoiceConnectionState.error,
            isMicStreaming: false,
            statusMessage: 'WebSocket connection interrupted',
            errorMessage: 'Gemini Live stream error: $error',
          ));
        },
        onDone: () {
          if (_state.connectionState != LiveVoiceConnectionState.disconnected &&
              _state.connectionState != LiveVoiceConnectionState.error) {
            _emit(_state.copyWith(
              connectionState: LiveVoiceConnectionState.disconnected,
              isMicStreaming: false,
              statusMessage: 'Live session closed. Tap Connect to start a new session.',
            ));
          }
        },
      );

      // Send mandatory Gemini Live setup handshake frame
      final setupFrame = <String, dynamic>{
        'setup': {
          'model': 'models/$model',
          'generationConfig': {
            'responseModalities': ['AUDIO'],
          },
          'inputAudioTranscription': <String, dynamic>{},
          'outputAudioTranscription': <String, dynamic>{},
          'systemInstruction': {
            'parts': [
              {'text': systemInstructions},
            ],
          },
        },
      };
      channel.sink.add(jsonEncode(setupFrame));

      _emit(_state.copyWith(
        connectionState: LiveVoiceConnectionState.connected,
        statusMessage: 'Connected to Gemini 3.8 Live ($sourceLanguage ↔ $targetLanguage)',
        clearError: true,
      ));
      return true;
    } catch (e) {
      _emit(_state.copyWith(
        connectionState: LiveVoiceConnectionState.error,
        isMicStreaming: false,
        statusMessage: 'Unable to connect to Gemini Live',
        errorMessage: e.toString(),
      ));
      return false;
    }
  }

  void _handleServerFrame(dynamic rawMessage) {
    try {
      final String textPayload;
      if (rawMessage is String) {
        textPayload = rawMessage;
      } else if (rawMessage is List<int>) {
        textPayload = utf8.decode(rawMessage);
      } else {
        return;
      }

      final decoded = jsonDecode(textPayload);
      if (decoded is! Map<String, dynamic>) return;

      if (decoded.containsKey('setupComplete')) {
        _setupComplete = true;
        _emit(_state.copyWith(
          connectionState: _state.isMicStreaming
              ? LiveVoiceConnectionState.listening
              : LiveVoiceConnectionState.connected,
          statusMessage: 'Live interpreter ready — tap Mic and speak naturally',
        ));
        return;
      }

      final serverContent = decoded['serverContent'];
      if (serverContent is! Map<String, dynamic>) return;

      // 1. Live input audio transcription
      final inputTr = serverContent['inputTranscription'];
      if (inputTr is Map<String, dynamic>) {
        final chunk = inputTr['text']?.toString() ?? '';
        if (chunk.isNotEmpty) {
          _pendingInputBuffer += chunk;
        }
      }

      // 2. Live output audio transcription
      final outputTr = serverContent['outputTranscription'];
      if (outputTr is Map<String, dynamic>) {
        final chunk = outputTr['text']?.toString() ?? '';
        if (chunk.isNotEmpty) {
          _pendingOutputBuffer += chunk;
        }
      }

      // 3. Streamed 24kHz PCM audio output
      final modelTurn = serverContent['modelTurn'];
      if (modelTurn is Map<String, dynamic>) {
        final parts = modelTurn['parts'];
        if (parts is List) {
          for (final part in parts) {
            if (part is Map<String, dynamic>) {
              final inlineData = part['inlineData'];
              if (inlineData is Map<String, dynamic>) {
                final b64 = inlineData['data']?.toString();
                if (b64 != null && b64.isNotEmpty) {
                  final pcmBytes = base64Decode(b64);
                  _pcmChannel
                      .invokeMethod('feedPcmChunk', {'bytes': pcmBytes})
                      .catchError((_) => 0);
                }
              }
              final partText = part['text']?.toString();
              if (partText != null &&
                  partText.isNotEmpty &&
                  _pendingOutputBuffer.isEmpty) {
                _pendingOutputBuffer += partText;
              }
            }
          }
        }
      }

      // 4. Flush transcript bubbles when a turn completes
      if (serverContent['turnComplete'] == true) {
        if (_pendingInputBuffer.trim().isNotEmpty) {
          _appendTranscript('YOU', _pendingInputBuffer);
          _pendingInputBuffer = '';
        }
        if (_pendingOutputBuffer.trim().isNotEmpty) {
          _appendTranscript('TRANSLATION', _pendingOutputBuffer);
          _pendingOutputBuffer = '';
        }
      }
    } catch (_) {
      // Ignore malformed keepalive frames safely
    }
  }

  /// Starts streaming 16kHz 16-bit mono PCM microphone audio to Gemini 3.8 Live.
  Future<void> startMicrophoneStream() async {
    if (_channel == null) {
      _emit(_state.copyWith(
        errorMessage: 'Connect to Gemini 3.8 Live first before speaking.',
      ));
      return;
    }

    final hasPermission = await _recorder.hasPermission();
    if (!hasPermission) {
      _emit(_state.copyWith(
        errorMessage: 'Microphone permission is required for live voice translation.',
      ));
      return;
    }

    await stopMicrophoneStream();

    final stream = await _recorder.startStream(
      const RecordConfig(
        encoder: AudioEncoder.pcm16bits,
        sampleRate: 16000,
        numChannels: 1,
      ),
    );

    _emit(_state.copyWith(
      connectionState: LiveVoiceConnectionState.listening,
      isMicStreaming: true,
      statusMessage: _setupComplete
          ? 'Listening... speak in either language'
          : 'Streaming voice to Gemini 3.8 Live...',
      clearError: true,
    ));

    _micSubscription = stream.listen(
      (Uint8List pcmChunk) {
        if (_channel == null || pcmChunk.isEmpty) return;
        final frame = <String, dynamic>{
          'realtimeInput': {
            'audio': {
              'mimeType': 'audio/pcm;rate=16000',
              'data': base64Encode(pcmChunk),
            },
          },
        };
        try {
          _channel?.sink.add(jsonEncode(frame));
        } catch (_) {}
      },
      onError: (Object err) {
        _emit(_state.copyWith(
          isMicStreaming: false,
          connectionState: LiveVoiceConnectionState.connected,
          errorMessage: 'Microphone capture error: $err',
        ));
      },
    );
  }

  /// Stops microphone audio streaming and signals audioStreamEnd so Gemini responds immediately.
  Future<void> stopMicrophoneStream() async {
    await _micSubscription?.cancel();
    _micSubscription = null;

    try {
      if (await _recorder.isRecording()) {
        await _recorder.stop();
      }
    } catch (_) {}

    if (_channel != null && _state.isMicStreaming) {
      try {
        _channel?.sink.add(jsonEncode({
          'realtimeInput': {'audioStreamEnd': true},
        }));
      } catch (_) {}
    }

    if (_state.isMicStreaming) {
      _emit(_state.copyWith(
        isMicStreaming: false,
        connectionState: _channel != null
            ? LiveVoiceConnectionState.connected
            : LiveVoiceConnectionState.disconnected,
        statusMessage: 'Translating...',
      ));
    }
  }

  /// Sends a text phrase over the live session (or falls back to unary `Assistance-translateText`).
  Future<void> translateTypedPhrase({
    required String text,
    required String sourceLanguage,
    required String targetLanguage,
    String? contextHint,
  }) async {
    final trimmed = text.trim();
    if (trimmed.isEmpty) return;

    _appendTranscript('YOU', trimmed, languageCode: sourceLanguage);

    if (_channel != null &&
        (_state.connectionState == LiveVoiceConnectionState.connected ||
            _state.connectionState == LiveVoiceConnectionState.listening)) {
      _channel?.sink.add(jsonEncode({
        'clientContent': {
          'turns': [
            {
              'role': 'user',
              'parts': [
                {'text': trimmed},
              ],
            },
          ],
          'turnComplete': true,
        },
      }));
      return;
    }

    // Unary fallback via Assistance-translateText if live socket isn't active
    try {
      String uid = 'guest_traveler';
      try {
        uid = FirebaseAuth.instance.currentUser?.uid ?? 'guest_traveler';
      } catch (_) {}

      final callable = _functions.httpsCallable('Assistance-translateText');
      final response = await callable.call<Map<String, dynamic>>({
        'sourceText': trimmed,
        'sourceLanguage': sourceLanguage,
        'targetLanguage': targetLanguage,
        if (contextHint != null) 'conversationContext': contextHint,
        'isGuestAccess': true,
        'userId': uid,
      });

      final envelope = Map<String, dynamic>.from(response.data);
      final data = envelope['data'] is Map
          ? Map<String, dynamic>.from(envelope['data'] as Map)
          : envelope;

      final translated = data['translatedText']?.toString() ?? '';
      final phonetic = data['phoneticTranscription']?.toString();
      final display = phonetic != null && phonetic.isNotEmpty
          ? '$translated\n($phonetic)'
          : translated;
      if (display.isNotEmpty) {
        _appendTranscript('TRANSLATION', display, languageCode: targetLanguage);
      }
    } catch (e) {
      _emit(_state.copyWith(errorMessage: 'Translation request failed: $e'));
    }
  }

  /// Cleanly closes WebSocket, microphone stream, and native Android AudioTrack.
  Future<void> disconnect({bool preserveTranscripts = false}) async {
    await stopMicrophoneStream();
    await _wsSubscription?.cancel();
    _wsSubscription = null;

    try {
      await _channel?.sink.close();
    } catch (_) {}
    _channel = null;
    _setupComplete = false;
    _pendingInputBuffer = '';
    _pendingOutputBuffer = '';

    try {
      await _pcmChannel.invokeMethod('stopPcmPlayback');
    } catch (_) {}

    _emit(_state.copyWith(
      connectionState: LiveVoiceConnectionState.disconnected,
      isMicStreaming: false,
      statusMessage: 'Disconnected',
      transcripts: preserveTranscripts ? _state.transcripts : const [],
    ));
  }

  Future<void> dispose() async {
    await disconnect();
    await _recorder.dispose();
    await _stateController.close();
  }
}
