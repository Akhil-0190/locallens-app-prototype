import 'dart:async';
import 'dart:io';
import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/material.dart';
import 'package:path_provider/path_provider.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:record/record.dart';

enum RecordingState { idle, recording, recorded, playing }

/// Voice recorder component handling permissions, recording, waveform pulse, and preview playback.
class VoiceRecorderTile extends StatefulWidget {
  final ValueChanged<String?> onRecordingComplete;
  final VoidCallback? onRecordingDeleted;

  const VoiceRecorderTile({
    super.key,
    required this.onRecordingComplete,
    this.onRecordingDeleted,
  });

  @override
  State<VoiceRecorderTile> createState() => _VoiceRecorderTileState();
}

class _VoiceRecorderTileState extends State<VoiceRecorderTile> {
  final AudioRecorder _audioRecorder = AudioRecorder();
  final AudioPlayer _audioPlayer = AudioPlayer();

  RecordingState _state = RecordingState.idle;
  String? _recordedFilePath;
  int _recordDurationSeconds = 0;
  Timer? _timer;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _audioPlayer.onPlayerComplete.listen((_) {
      if (mounted) {
        setState(() => _state = RecordingState.recorded);
      }
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    _audioRecorder.dispose();
    _audioPlayer.dispose();
    super.dispose();
  }

  Future<void> _startRecording() async {
    setState(() => _errorMessage = null);

    // Request microphone permission
    final status = await Permission.microphone.request();
    if (status.isPermanentlyDenied) {
      setState(() {
        _errorMessage =
            'Microphone access is permanently denied. Please enable it in Settings.';
      });
      return;
    }

    if (!status.isGranted) {
      setState(() {
        _errorMessage = 'Microphone permission is required to record voice notes.';
      });
      return;
    }

    try {
      final tempDir = await getTemporaryDirectory();
      final filePath =
          '${tempDir.path}/voice_note_${DateTime.now().millisecondsSinceEpoch}.m4a';

      const config = RecordConfig(
        encoder: AudioEncoder.aacLc,
        bitRate: 128000,
        sampleRate: 44100,
      );

      await _audioRecorder.start(config, path: filePath);

      _recordDurationSeconds = 0;
      _timer?.cancel();
      _timer = Timer.periodic(const Duration(seconds: 1), (timer) {
        if (!mounted) return;
        setState(() {
          _recordDurationSeconds++;
          if (_recordDurationSeconds >= 90) {
            _stopRecording(); // 90s max limit per Domain 04
          }
        });
      });

      setState(() {
        _state = RecordingState.recording;
        _recordedFilePath = filePath;
      });
    } catch (e) {
      setState(() => _errorMessage = 'Failed to start recording: $e');
    }
  }

  Future<void> _stopRecording() async {
    _timer?.cancel();
    try {
      final path = await _audioRecorder.stop();
      if (!mounted) return;

      setState(() {
        _state = RecordingState.recorded;
        _recordedFilePath = path ?? _recordedFilePath;
      });

      widget.onRecordingComplete(_recordedFilePath);
    } catch (e) {
      setState(() => _errorMessage = 'Failed to stop recording: $e');
    }
  }

  Future<void> _togglePlayback() async {
    if (_recordedFilePath == null) return;

    if (_state == RecordingState.playing) {
      await _audioPlayer.pause();
      setState(() => _state = RecordingState.recorded);
    } else {
      await _audioPlayer.play(DeviceFileSource(_recordedFilePath!));
      setState(() => _state = RecordingState.playing);
    }
  }

  void _deleteRecording() {
    _timer?.cancel();
    _audioPlayer.stop();
    if (_recordedFilePath != null) {
      try {
        final file = File(_recordedFilePath!);
        if (file.existsSync()) file.deleteSync();
      } catch (_) {}
    }

    setState(() {
      _state = RecordingState.idle;
      _recordedFilePath = null;
      _recordDurationSeconds = 0;
    });

    widget.onRecordingComplete(null);
    widget.onRecordingDeleted?.call();
  }

  String _formatDuration(int seconds) {
    final mins = (seconds ~/ 60).toString().padLeft(2, '0');
    final secs = (seconds % 60).toString().padLeft(2, '0');
    return '$mins:$secs';
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: _state == RecordingState.recording
            ? Colors.red.shade50
            : Colors.grey.shade50,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: _state == RecordingState.recording
              ? Colors.red.shade300
              : Colors.grey.shade300,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  Icon(
                    Icons.mic,
                    size: 20,
                    color: _state == RecordingState.recording
                        ? Colors.red
                        : Colors.teal.shade800,
                  ),
                  const SizedBox(width: 8),
                  const Text(
                    'Voice Note (Regional or English)',
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ],
              ),
              if (_state == RecordingState.recording ||
                  _state == RecordingState.recorded ||
                  _state == RecordingState.playing)
                Text(
                  _formatDuration(_recordDurationSeconds),
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.bold,
                    color: _state == RecordingState.recording
                        ? Colors.red
                        : Colors.black87,
                  ),
                ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            'Record local stories, what to order, or phrases. Gemini extracts cultural tips and authentic greetings.',
            style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
          ),
          const SizedBox(height: 12),
          if (_errorMessage != null) ...[
            Container(
              padding: const EdgeInsets.all(8),
              margin: const EdgeInsets.only(bottom: 12),
              decoration: BoxDecoration(
                color: Colors.red.shade100,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Row(
                children: [
                  const Icon(Icons.error_outline, size: 16, color: Colors.red),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      _errorMessage!,
                      style: const TextStyle(fontSize: 12, color: Colors.red),
                    ),
                  ),
                  if (_errorMessage!.contains('Settings'))
                    TextButton(
                      onPressed: openAppSettings,
                      child: const Text('Open Settings', style: TextStyle(fontSize: 12)),
                    ),
                ],
              ),
            ),
          ],
          if (_state == RecordingState.idle)
            OutlinedButton.icon(
              onPressed: _startRecording,
              icon: const Icon(Icons.mic, color: Colors.teal),
              label: const Text('Start Voice Recording (Mic)'),
            )
          else if (_state == RecordingState.recording)
            Row(
              children: [
                Expanded(
                  child: FilledButton.icon(
                    style: FilledButton.styleFrom(backgroundColor: Colors.red),
                    onPressed: _stopRecording,
                    icon: const Icon(Icons.stop),
                    label: const Text('Stop Recording'),
                  ),
                ),
              ],
            )
          else ...[
            Row(
              children: [
                FilledButton.tonalIcon(
                  onPressed: _togglePlayback,
                  icon: Icon(
                    _state == RecordingState.playing
                        ? Icons.pause
                        : Icons.play_arrow,
                  ),
                  label: Text(
                    _state == RecordingState.playing ? 'Pause' : 'Play Preview',
                  ),
                ),
                const SizedBox(width: 8),
                OutlinedButton.icon(
                  onPressed: _deleteRecording,
                  icon: const Icon(Icons.delete_outline, size: 18),
                  label: const Text('Delete'),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}
