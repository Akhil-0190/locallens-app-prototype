import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import '../models/spot_card.dart';
import '../services/photo_helper.dart';
import '../services/spot_service.dart';

class AddGemScreen extends StatefulWidget {
  const AddGemScreen({super.key});

  @override
  State<AddGemScreen> createState() => _AddGemScreenState();
}

class _AddGemScreenState extends State<AddGemScreen> {
  final _formKey = GlobalKey<FormState>();
  final _mapsLinkController = TextEditingController();
  final _paragraphController = TextEditingController();

  final List<String> _encodedPhotos = [];
  bool _isSubmitting = false;

  Future<void> _addPhoto(ImageSource source) async {
    if (_encodedPhotos.length >= 2) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Maximum 2 street photos allowed per spot.')),
      );
      return;
    }

    try {
      final base64Photo = await PhotoHelper.pickAndCompressPhoto(source: source);
      if (base64Photo != null && mounted) {
        setState(() {
          _encodedPhotos.add(base64Photo);
        });
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(e.toString())),
        );
      }
    }
  }

  Future<void> _submitSpot() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _isSubmitting = true);

    final newSpot = SpotCard(
      id: DateTime.now().millisecondsSinceEpoch.toString(),
      mapsLink: _mapsLinkController.text.trim(),
      infoParagraph: _paragraphController.text.trim(),
      photoUrls: List<String>.from(_encodedPhotos),
      spotName: 'New Local Gem (Preview)',
      openHours: 'Verifying hours...',
      practicalTips: 'Submitted by local resident',
      greetingCard: 'Vanakkam! / Namaste!',
    );

    try {
      await SpotService().submitNewSpot(newSpot);
      if (!mounted) return;

      _mapsLinkController.clear();
      _paragraphController.clear();
      setState(() {
        _encodedPhotos.clear();
        _isSubmitting = false;
      });

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Local gem submitted! Check Pocket Guide.')),
      );
    } catch (e) {
      if (mounted) {
        setState(() => _isSubmitting = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Submission failed: $e')),
        );
      }
    }
  }

  @override
  void dispose() {
    _mapsLinkController.dispose();
    _paragraphController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Add a Local Gem')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text(
                'Location & Story',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 8),
              TextFormField(
                controller: _mapsLinkController,
                decoration: const InputDecoration(
                  labelText: 'Google Maps Link',
                  hintText: 'Paste shared Google Maps URL',
                  border: OutlineInputBorder(),
                  prefixIcon: Icon(Icons.location_on_outlined),
                ),
                validator: (value) {
                  if (value == null || value.trim().isEmpty) {
                    return 'Please paste a Google Maps link';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _paragraphController,
                maxLines: 4,
                decoration: const InputDecoration(
                  labelText: 'Short Info Paragraph (3 to 4 lines)',
                  hintText: 'What makes this spot special, what to order, and best time to visit...',
                  border: OutlineInputBorder(),
                  alignLabelWithHint: true,
                ),
                validator: (value) {
                  if (value == null || value.trim().length < 15) {
                    return 'Add a short description (at least 15 characters)';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 20),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'Street Photos (${_encodedPhotos.length}/2)',
                    style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                  ),
                  Row(
                    children: [
                      OutlinedButton.icon(
                        onPressed: () => _addPhoto(ImageSource.gallery),
                        icon: const Icon(Icons.photo_library, size: 18),
                        label: const Text('Gallery'),
                      ),
                      const SizedBox(width: 8),
                      OutlinedButton.icon(
                        onPressed: () => _addPhoto(ImageSource.camera),
                        icon: const Icon(Icons.camera_alt, size: 18),
                        label: const Text('Camera'),
                      ),
                    ],
                  ),
                ],
              ),
              const SizedBox(height: 12),
              if (_encodedPhotos.isNotEmpty)
                SizedBox(
                  height: 120,
                  child: ListView.separated(
                    scrollDirection: Axis.horizontal,
                    itemCount: _encodedPhotos.length,
                    separatorBuilder: (_, __) => const SizedBox(width: 12),
                    itemBuilder: (context, index) {
                      return Stack(
                        children: [
                          ClipRRect(
                            borderRadius: BorderRadius.circular(8),
                            child: PhotoHelper.buildPhotoWidget(
                              _encodedPhotos[index],
                              height: 120,
                              width: 140,
                            ),
                          ),
                          Positioned(
                            top: 4,
                            right: 4,
                            child: GestureDetector(
                              onTap: () {
                                setState(() => _encodedPhotos.removeAt(index));
                              },
                              child: const CircleAvatar(
                                radius: 12,
                                backgroundColor: Colors.black54,
                                child: Icon(Icons.close, size: 14, color: Colors.white),
                              ),
                            ),
                          ),
                        ],
                      );
                    },
                  ),
                ),
              const SizedBox(height: 24),
              FilledButton.icon(
                onPressed: _isSubmitting ? null : _submitSpot,
                icon: _isSubmitting
                    ? const SizedBox(
                  width: 18,
                  height: 18,
                  child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                )
                    : const Icon(Icons.check_circle_outline),
                label: Text(_isSubmitting ? 'Saving...' : 'Submit Local Gem'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}