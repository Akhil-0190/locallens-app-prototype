import 'dart:async';
// ignore: deprecated_member_use
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import '../models/contribution.dart';
import '../providers/spot_providers.dart';
import '../services/photo_helper.dart';
import '../widgets/contribution_preview_sheet.dart';
import '../widgets/contribution_status_tracker.dart';
import '../widgets/contributor_onboarding_card.dart';
import '../widgets/voice_recorder_tile.dart';

class AddGemScreen extends ConsumerStatefulWidget {
  const AddGemScreen({super.key});

  @override
  ConsumerState<AddGemScreen> createState() => _AddGemScreenState();
}

class _AddGemScreenState extends ConsumerState<AddGemScreen> {
  final _formKey = GlobalKey<FormState>();
  final _mapsLinkController = TextEditingController();
  final _paragraphController = TextEditingController();

  final List<String> _encodedPhotos = [];
  final List<String> _localPhotoPaths = [];
  String? _recordedAudioPath;
  String _selectedLanguageCode = 'en';

  bool _isSubmitting = false;
  double _uploadProgress = 0.0;
  String? _uploadStatusMessage;
  String? _submissionError;
  StreamSubscription<ContributionDocument>? _pipelineSubscription;

  @override
  void dispose() {
    _pipelineSubscription?.cancel();
    _mapsLinkController.dispose();
    _paragraphController.dispose();
    super.dispose();
  }

  Future<void> _addPhoto(ImageSource source) async {
    if (_encodedPhotos.length >= 2) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Maximum 2 street photos allowed per spot.')),
      );
      return;
    }

    try {
      final picked = await PhotoHelper.pickPhoto(source: source);
      if (picked != null && mounted) {
        setState(() {
          _encodedPhotos.add(picked.base64Data);
          _localPhotoPaths.add(picked.filePath);
        });
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Photo error: $e')),
        );
      }
    }
  }

  void _openPreviewSheet() {
    if (!_formKey.currentState!.validate()) return;

    final profile = ref.read(contributorProfileProvider);
    final input = ContributorSubmissionInput(
      mapsLink: _mapsLinkController.text.trim(),
      infoParagraph: _paragraphController.text.trim(),
      photoUrls: List<String>.from(_encodedPhotos),
      localPhotoPaths: List<String>.from(_localPhotoPaths),
      audioNotePath: _recordedAudioPath,
      contributorId: profile.userId,
      selectedLanguage: _selectedLanguageCode,
    );

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) {
        return ContributionPreviewSheet(
          input: input,
          profile: profile,
          onConfirmSubmit: () => _executeSubmission(input),
        );
      },
    );
  }

  Future<void> _executeSubmission(ContributorSubmissionInput input) async {
    setState(() {
      _isSubmitting = true;
      _submissionError = null;
      _uploadProgress = 0.0;
      _uploadStatusMessage = 'Submitting contribution stub...';
    });

    final contributionService = ref.read(contributionServiceProvider);

    try {
      final initialDoc = await contributionService.submitContribution(input: input);
      ref.read(activeContributionProvider.notifier).state = initialDoc;
      ref.read(isTrackingPipelineProvider.notifier).state = true;

      // Upload media files to Cloud Storage and register assets
      if (input.localPhotoPaths.isNotEmpty || input.audioNotePath != null) {
        setState(() => _uploadStatusMessage = 'Uploading media to Cloud Storage...');
        await contributionService.uploadMediaAssets(
          contributionId: initialDoc.contributionId,
          localPhotoPaths: input.localPhotoPaths,
          localAudioPath: input.audioNotePath,
          onProgress: (p, msg) {
            if (mounted) {
              setState(() {
                _uploadProgress = p;
                _uploadStatusMessage = msg;
              });
            }
          },
        );
      }

      // Listen to pipeline state changes (Real-time Firestore)
      _pipelineSubscription?.cancel();
      _pipelineSubscription = contributionService
          .trackContributionPipeline(initialDoc)
          .listen((updatedDoc) {
        if (!mounted) return;
        ref.read(activeContributionProvider.notifier).state = updatedDoc;

        // When verified, automatically refresh pocket guide
        if (updatedDoc.status == ContributionStatus.verified) {
          ref.invalidate(verifiedSpotsProvider);
        }
      });

      setState(() {
        _isSubmitting = false;
        _uploadStatusMessage = null;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _isSubmitting = false;
        _submissionError = e.toString();
        _uploadStatusMessage = null;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Submission failed: $e'),
          backgroundColor: Colors.red.shade800,
        ),
      );
    }
  }

  void _resetForm() {
    _pipelineSubscription?.cancel();
    ref.read(activeContributionProvider.notifier).state = null;
    ref.read(isTrackingPipelineProvider.notifier).state = false;

    _mapsLinkController.clear();
    _paragraphController.clear();
    setState(() {
      _encodedPhotos.clear();
      _localPhotoPaths.clear();
      _recordedAudioPath = null;
      _selectedLanguageCode = 'en';
      _submissionError = null;
      _isSubmitting = false;
      _uploadProgress = 0.0;
      _uploadStatusMessage = null;
    });
  }

  @override
  Widget build(BuildContext context) {
    final profile = ref.watch(contributorProfileProvider);
    final activeContribution = ref.watch(activeContributionProvider);
    final isTracking = ref.watch(isTrackingPipelineProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Add a Local Gem'),
        actions: [
          if (activeContribution != null)
            IconButton(
              icon: const Icon(Icons.refresh),
              onPressed: _resetForm,
              tooltip: 'Submit Another Spot',
            ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Requirement 1 & 8: Contributor onboarding & attribution
            ContributorOnboardingCard(profile: profile),
            const SizedBox(height: 16),

            // Live Media Upload Progress Feedback
            if (_isSubmitting && _uploadStatusMessage != null) ...[
              Card(
                color: Colors.teal.shade50,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                  side: BorderSide(color: Colors.teal.shade200),
                ),
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          const SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Text(
                              _uploadStatusMessage!,
                              style: const TextStyle(
                                fontWeight: FontWeight.bold,
                                fontSize: 13,
                              ),
                            ),
                          ),
                        ],
                      ),
                      if (_uploadProgress > 0) ...[
                        const SizedBox(height: 10),
                        LinearProgressIndicator(
                          value: _uploadProgress,
                          backgroundColor: Colors.teal.shade100,
                        ),
                      ],
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 16),
            ],

            // Requirement 6: Upload and processing status tracker
            if (activeContribution != null && isTracking) ...[
              ContributionStatusTracker(
                contribution: activeContribution,
                onRetry: () {
                  final input = activeContribution.submission;
                  _executeSubmission(input);
                },
                onReset: _resetForm,
              ),
              const SizedBox(height: 16),
            ] else ...[
              // Contributor submission form
              Form(
                key: _formKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const Text(
                      'Location & Authenticity Story',
                      style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                    ),
                    const SizedBox(height: 8),
                    TextFormField(
                      controller: _mapsLinkController,
                      decoration: const InputDecoration(
                        labelText: 'Google Maps Link',
                        hintText: 'e.g. https://maps.app.goo.gl/...',
                        border: OutlineInputBorder(),
                        prefixIcon: Icon(Icons.location_on_outlined),
                      ),
                      validator: (value) {
                        if (value == null || value.trim().isEmpty) {
                          return 'Please paste a Google Maps link';
                        }
                        if (!value.trim().contains('google') &&
                            !value.trim().contains('maps')) {
                          return 'Enter a valid Google Maps URL';
                        }
                        return null;
                      },
                    ),
                    const SizedBox(height: 12),
                    TextFormField(
                      controller: _paragraphController,
                      maxLines: 3,
                      decoration: const InputDecoration(
                        labelText: 'Short Story (3 to 4 lines)',
                        hintText:
                        'What makes this spot special, what to order, and why locals love it...',
                        border: OutlineInputBorder(),
                        alignLabelWithHint: true,
                      ),
                      validator: (value) {
                        if (value == null || value.trim().length < 15) {
                          return 'Add a short story (at least 15 characters)';
                        }
                        return null;
                      },
                    ),
                    const SizedBox(height: 16),

                    // Requirement 4: Regional-language selection
                    const Text(
                      'Native Language (for Cultural Audio Cue)',
                      style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold),
                    ),
                    const SizedBox(height: 8),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: RegionalLanguage.supportedLanguages.map((lang) {
                        final isSelected = _selectedLanguageCode == lang.code;
                        return ChoiceChip(
                          label: Text('${lang.name} (${lang.nativeLabel})'),
                          selected: isSelected,
                          onSelected: (_) {
                            setState(() => _selectedLanguageCode = lang.code);
                          },
                        );
                      }).toList(),
                    ),
                    const SizedBox(height: 16),

                    // Requirement 2: Voice recording with permissions & preview
                    VoiceRecorderTile(
                      onRecordingComplete: (filePath) {
                        setState(() => _recordedAudioPath = filePath);
                      },
                      onRecordingDeleted: () {
                        setState(() => _recordedAudioPath = null);
                      },
                    ),
                    const SizedBox(height: 16),

                    // Requirement 3: Photo attachment with permissions
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          'Street Photos (${_encodedPhotos.length}/2)',
                          style: const TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        Row(
                          children: [
                            OutlinedButton.icon(
                              onPressed: () => _addPhoto(ImageSource.gallery),
                              icon: const Icon(Icons.photo_library, size: 16),
                              label: const Text('Gallery'),
                            ),
                            const SizedBox(width: 8),
                            OutlinedButton.icon(
                              onPressed: () => _addPhoto(ImageSource.camera),
                              icon: const Icon(Icons.camera_alt, size: 16),
                              label: const Text('Camera'),
                            ),
                          ],
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    if (_encodedPhotos.isNotEmpty)
                      SizedBox(
                        height: 110,
                        child: ListView.separated(
                          scrollDirection: Axis.horizontal,
                          itemCount: _encodedPhotos.length,
                          separatorBuilder: (context, index) =>
                          const SizedBox(width: 10),
                          itemBuilder: (context, index) {
                            return Stack(
                              children: [
                                ClipRRect(
                                  borderRadius: BorderRadius.circular(8),
                                  child: PhotoHelper.buildPhotoWidget(
                                    _encodedPhotos[index],
                                    height: 110,
                                    width: 130,
                                  ),
                                ),
                                Positioned(
                                  top: 4,
                                  right: 4,
                                  child: GestureDetector(
                                    onTap: () {
                                      setState(
                                              () => _encodedPhotos.removeAt(index));
                                    },
                                    child: const CircleAvatar(
                                      radius: 12,
                                      backgroundColor: Colors.black54,
                                      child: Icon(
                                        Icons.close,
                                        size: 14,
                                        color: Colors.white,
                                      ),
                                    ),
                                  ),
                                ),
                              ],
                            );
                          },
                        ),
                      ),
                    const SizedBox(height: 16),

                    // Requirement 7: Error and retry display
                    if (_submissionError != null) ...[
                      Container(
                        padding: const EdgeInsets.all(12),
                        margin: const EdgeInsets.only(bottom: 12),
                        decoration: BoxDecoration(
                          color: Colors.red.shade50,
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: Colors.red.shade200),
                        ),
                        child: Row(
                          children: [
                            const Icon(Icons.error_outline,
                                color: Colors.red, size: 20),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                _submissionError!,
                                style: TextStyle(
                                  fontSize: 12,
                                  color: Colors.red.shade900,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],

                    // Requirement 5: Contribution preview button
                    FilledButton.icon(
                      onPressed: _isSubmitting ? null : _openPreviewSheet,
                      icon: _isSubmitting
                          ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                          : const Icon(Icons.preview),
                      label: Text(
                        _isSubmitting
                            ? 'Uploading...'
                            : 'Preview & Submit Discovery',
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
