import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_tts/flutter_tts.dart';

import '../services/gemini_live_voice_service.dart';

class _LanguageOption {
  final String code;
  final String label;
  final String nativeName;

  const _LanguageOption(this.code, this.label, this.nativeName);
}

const List<_LanguageOption> _supportedLiveLanguages = [
  _LanguageOption('kn-IN', 'Kannada', 'ಕನ್ನಡ'),
  _LanguageOption('hi-IN', 'Hindi', 'हिन्दी'),
  _LanguageOption('ta-IN', 'Tamil', 'தமிழ்'),
  _LanguageOption('te-IN', 'Telugu', 'తెలుగు'),
  _LanguageOption('mr-IN', 'Marathi', 'मराठी'),
  _LanguageOption('bn-IN', 'Bengali', 'বাংলা'),
];

/// Interactive bidirectional live voice translation sheet backed by Gemini 3.8 Live.
class LiveVoiceTranslatorSheet extends StatefulWidget {
  final String neighborhood;
  final String? spotId;
  final String? spotName;

  const LiveVoiceTranslatorSheet({
    super.key,
    this.neighborhood = 'Malleshwaram',
    this.spotId,
    this.spotName,
  });

  @override
  State<LiveVoiceTranslatorSheet> createState() =>
      _LiveVoiceTranslatorSheetState();
}

class _LiveVoiceTranslatorSheetState extends State<LiveVoiceTranslatorSheet> {
  final GeminiLiveVoiceService _liveService = GeminiLiveVoiceService();
  final FlutterTts _tts = FlutterTts();
  final TextEditingController _typedController = TextEditingController();
  StreamSubscription<LiveVoiceStateSnapshot>? _sub;

  LiveVoiceStateSnapshot _snapshot = const LiveVoiceStateSnapshot();
  String _targetLanguage = 'kn-IN';

  @override
  void initState() {
    super.initState();
    _sub = _liveService.stateStream.listen((state) {
      if (mounted) {
        setState(() => _snapshot = state);
      }
    });
    _connectLive();
  }

  @override
  void dispose() {
    _sub?.cancel();
    _typedController.dispose();
    _tts.stop();
    _liveService.dispose();
    super.dispose();
  }

  Future<void> _connectLive() async {
    await _liveService.connect(
      sourceLanguage: 'en-IN',
      targetLanguage: _targetLanguage,
      neighborhood: widget.neighborhood,
      spotId: widget.spotId,
      spotName: widget.spotName,
    );
  }

  Future<void> _toggleMic() async {
    if (_snapshot.isMicStreaming) {
      await _liveService.stopMicrophoneStream();
      return;
    }
    if (_snapshot.connectionState != LiveVoiceConnectionState.connected &&
        _snapshot.connectionState != LiveVoiceConnectionState.listening) {
      final ok = await _liveService.connect(
        sourceLanguage: 'en-IN',
        targetLanguage: _targetLanguage,
        neighborhood: widget.neighborhood,
        spotId: widget.spotId,
        spotName: widget.spotName,
      );
      if (!ok) return;
    }
    await _liveService.startMicrophoneStream();
  }

  Future<void> _sendTyped() async {
    final text = _typedController.text.trim();
    if (text.isEmpty) return;
    _typedController.clear();
    await _liveService.translateTypedPhrase(
      text: text,
      sourceLanguage: 'en-IN',
      targetLanguage: _targetLanguage,
      contextHint: widget.spotName != null
          ? 'Ordering or chatting at ${widget.spotName} in ${widget.neighborhood}'
          : 'Street conversation in ${widget.neighborhood}',
    );
  }

  @override
  Widget build(BuildContext context) {
    final isConnected =
        _snapshot.connectionState == LiveVoiceConnectionState.connected ||
            _snapshot.connectionState == LiveVoiceConnectionState.listening;
    final isConnecting =
        _snapshot.connectionState == LiveVoiceConnectionState.connecting;

    return Padding(
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(context).viewInsets.bottom,
      ),
      child: DraggableScrollableSheet(
        initialChildSize: 0.85,
        minChildSize: 0.55,
        maxChildSize: 0.95,
        expand: false,
        builder: (context, scrollController) {
          return Column(
            children: [
              // Header
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 14, 12, 8),
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: Colors.teal.shade50,
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: const Icon(
                        Icons.interpreter_mode,
                        color: Color(0xFF0F766E),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'Gemini 3.8 Live Voice Translator',
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          Text(
                            widget.spotName != null
                                ? '${widget.spotName} • ${widget.neighborhood}'
                                : 'Bidirectional Street Interpreter • ${widget.neighborhood}',
                            style: TextStyle(
                              fontSize: 11,
                              color: Colors.grey.shade600,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ],
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.close),
                      onPressed: () => Navigator.of(context).pop(),
                    ),
                  ],
                ),
              ),

              // Language Pair Selector
              SizedBox(
                height: 40,
                child: ListView(
                  scrollDirection: Axis.horizontal,
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  children: _supportedLiveLanguages.map((lang) {
                    final selected = _targetLanguage == lang.code;
                    return Padding(
                      padding: const EdgeInsets.only(right: 6),
                      child: ChoiceChip(
                        label: Text('EN ↔ ${lang.label} (${lang.nativeName})'),
                        selected: selected,
                        onSelected: (val) {
                          if (!val || _targetLanguage == lang.code) return;
                          setState(() => _targetLanguage = lang.code);
                          _connectLive();
                        },
                      ),
                    );
                  }).toList(),
                ),
              ),
              const SizedBox(height: 8),

              // Live Connection Status Pill
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: Container(
                  width: double.infinity,
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 8,
                  ),
                  decoration: BoxDecoration(
                    color: _snapshot.errorMessage != null
                        ? Colors.orange.shade50
                        : isConnected
                            ? const Color(0xFFCCFBF1)
                            : Colors.grey.shade100,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(
                      color: _snapshot.errorMessage != null
                          ? Colors.orange.shade300
                          : isConnected
                              ? const Color(0xFF14B8A6)
                              : Colors.grey.shade300,
                    ),
                  ),
                  child: Row(
                    children: [
                      if (isConnecting)
                        const SizedBox(
                          width: 14,
                          height: 14,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      else
                        Icon(
                          _snapshot.isMicStreaming
                              ? Icons.graphic_eq
                              : isConnected
                                  ? Icons.wifi_tethering
                                  : Icons.info_outline,
                          size: 16,
                          color: _snapshot.errorMessage != null
                              ? Colors.orange.shade900
                              : const Color(0xFF0F766E),
                        ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          _snapshot.errorMessage ?? _snapshot.statusMessage,
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            color: _snapshot.errorMessage != null
                                ? Colors.orange.shade900
                                : const Color(0xFF0F766E),
                          ),
                        ),
                      ),
                      if (!isConnected && !isConnecting)
                        TextButton(
                          onPressed: _connectLive,
                          style: TextButton.styleFrom(
                            visualDensity: VisualDensity.compact,
                          ),
                          child: const Text('Reconnect'),
                        ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 10),

              // Bidirectional Transcript Feed
              Expanded(
                child: _snapshot.transcripts.isEmpty
                    ? Center(
                        child: Padding(
                          padding: const EdgeInsets.all(24),
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(
                                Icons.record_voice_over_outlined,
                                size: 42,
                                color: Colors.teal.shade300,
                              ),
                              const SizedBox(height: 10),
                              const Text(
                                'Tap the microphone below and speak in English or the local language.',
                                textAlign: TextAlign.center,
                                style: TextStyle(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                              const SizedBox(height: 6),
                              Text(
                                'Gemini 3.8 Live streams low-latency voice translation directly to your speaker and logs transcripts here.',
                                textAlign: TextAlign.center,
                                style: TextStyle(
                                  fontSize: 12,
                                  color: Colors.grey.shade600,
                                ),
                              ),
                            ],
                          ),
                        ),
                      )
                    : ListView.builder(
                        controller: scrollController,
                        padding: const EdgeInsets.symmetric(
                          horizontal: 16,
                          vertical: 8,
                        ),
                        itemCount: _snapshot.transcripts.length,
                        itemBuilder: (context, idx) {
                          final item = _snapshot.transcripts[idx];
                          final isUser = item.speaker == 'YOU';
                          return Align(
                            alignment: isUser
                                ? Alignment.centerRight
                                : Alignment.centerLeft,
                            child: Container(
                              margin: const EdgeInsets.only(bottom: 10),
                              padding: const EdgeInsets.all(12),
                              constraints: BoxConstraints(
                                maxWidth:
                                    MediaQuery.of(context).size.width * 0.78,
                              ),
                              decoration: BoxDecoration(
                                color: isUser
                                    ? const Color(0xFF0F766E)
                                    : Colors.teal.shade50,
                                borderRadius: BorderRadius.circular(14),
                                border: isUser
                                    ? null
                                    : Border.all(color: Colors.teal.shade200),
                              ),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      Text(
                                        isUser ? 'Spoken' : 'Translated',
                                        style: TextStyle(
                                          fontSize: 10,
                                          fontWeight: FontWeight.bold,
                                          color: isUser
                                              ? Colors.teal.shade100
                                              : Colors.teal.shade700,
                                        ),
                                      ),
                                      if (!isUser) ...[
                                        const SizedBox(width: 6),
                                        InkWell(
                                          onTap: () => _tts.speak(item.text),
                                          child: Icon(
                                            Icons.volume_up,
                                            size: 15,
                                            color: Colors.teal.shade800,
                                          ),
                                        ),
                                      ],
                                    ],
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    item.text,
                                    style: TextStyle(
                                      fontSize: 14,
                                      color: isUser
                                          ? Colors.white
                                          : Colors.black87,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          );
                        },
                      ),
              ),

              // Big Mic Push/Toggle Control + Quick Text Fallback
              Container(
                padding: const EdgeInsets.fromLTRB(16, 10, 16, 16),
                decoration: BoxDecoration(
                  color: Colors.white,
                  border: Border(
                    top: BorderSide(color: Colors.grey.shade200),
                  ),
                ),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: TextField(
                            controller: _typedController,
                            decoration: InputDecoration(
                              hintText: 'Or type phrase to translate...',
                              isDense: true,
                              contentPadding: const EdgeInsets.symmetric(
                                horizontal: 12,
                                vertical: 10,
                              ),
                              border: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(24),
                              ),
                            ),
                            onSubmitted: (_) => _sendTyped(),
                          ),
                        ),
                        const SizedBox(width: 8),
                        IconButton.filledTonal(
                          icon: const Icon(Icons.send),
                          onPressed: _sendTyped,
                          tooltip: 'Translate phrase',
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    SizedBox(
                      width: double.infinity,
                      child: FilledButton.icon(
                        style: FilledButton.styleFrom(
                          backgroundColor: _snapshot.isMicStreaming
                              ? Colors.red.shade600
                              : const Color(0xFF0F766E),
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(28),
                          ),
                        ),
                        onPressed: isConnecting ? null : _toggleMic,
                        icon: Icon(
                          _snapshot.isMicStreaming ? Icons.stop : Icons.mic,
                        ),
                        label: Text(
                          _snapshot.isMicStreaming
                              ? 'Stop Speaking & Translate'
                              : 'Tap to Speak (Live Bidirectional Voice)',
                          style: const TextStyle(
                            fontWeight: FontWeight.bold,
                            fontSize: 14,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}
