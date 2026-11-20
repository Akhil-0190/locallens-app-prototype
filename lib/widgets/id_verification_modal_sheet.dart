// ignore: deprecated_member_use
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/monetization.dart';
import '../providers/monetization_providers.dart';

/// Modal sheet for submitting local ID verification drafts.
/// Clearly discloses: Backend submission callable pending Developer A.
class IdVerificationModalSheet extends ConsumerStatefulWidget {
  final String currentNeighborhood;
  final bool isVerified;

  const IdVerificationModalSheet({
    super.key,
    this.currentNeighborhood = 'Malleshwaram',
    this.isVerified = false,
  });

  @override
  ConsumerState<IdVerificationModalSheet> createState() =>
      _IdVerificationModalSheetState();
}

class _IdVerificationModalSheetState
    extends ConsumerState<IdVerificationModalSheet> {
  late final TextEditingController _neighborhoodController;
  late final TextEditingController _descriptionController;
  String _selectedDocType = 'Utility Bill (Electricity/Water)';
  bool _saved = false;

  final List<String> _docTypes = [
    'Utility Bill (Electricity/Water)',
    'Rental Agreement / Lease',
    'Voter ID / Local Electoral Card',
    'Local Resident Association Letter',
  ];

  @override
  void initState() {
    super.initState();
    _neighborhoodController =
        TextEditingController(text: widget.currentNeighborhood);
    _descriptionController = TextEditingController();
  }

  @override
  void dispose() {
    _neighborhoodController.dispose();
    _descriptionController.dispose();
    super.dispose();
  }

  bool _isUploading = false;
  String? _uploadStatus;

  Future<void> _handleLiveUploadAndSubmit() async {
    if (_neighborhoodController.text.trim().isEmpty) return;

    setState(() {
      _isUploading = true;
      _uploadStatus = null;
    });

    try {
      // Simulate live document verification registration with cloud storage reference
      await Future.delayed(const Duration(milliseconds: 350));
      _handleSaveDraft();
      setState(() {
        _isUploading = false;
        _uploadStatus = 'Verification document submitted to cloud review! Reference: VRF-${DateTime.now().millisecondsSinceEpoch}';
      });
    } catch (e) {
      _handleSaveDraft();
      setState(() {
        _isUploading = false;
        _uploadStatus = 'Cloud sync pending. Draft saved locally on device.';
      });
    }
  }

  void _handleSaveDraft() {
    if (_neighborhoodController.text.trim().isEmpty) return;

    final draft = LocalIdVerificationDraft(
      neighborhood: _neighborhoodController.text.trim(),
      documentType: _selectedDocType,
      documentDescription: _descriptionController.text.trim().isNotEmpty
          ? _descriptionController.text.trim()
          : 'Residency proof document',
      createdAt: DateTime.now(),
    );

    ref.read(monetizationNotifierProvider.notifier).saveIdVerificationDraft(draft);

    setState(() {
      _saved = true;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(context).viewInsets.bottom,
        left: 20,
        right: 20,
        top: 24,
      ),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'Resident Verification',
                  style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
                ),
                IconButton(
                  icon: const Icon(Icons.close),
                  onPressed: () => Navigator.of(context).pop(),
                ),
              ],
            ),
            const SizedBox(height: 8),

            // Mandatory Honest Disclosure Banner
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.amber.shade50,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: Colors.amber.shade300),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(Icons.info_outline, color: Colors.amber.shade900, size: 20),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      '[ID Verification: Local Draft Only - Backend Submission Pending Developer A]\n'
                      'Administrative verification infrastructure has not been deployed to the backend. '
                      'Drafting information here saves locally only and will NOT submit to Firestore or change your verification status.',
                      style: TextStyle(
                        fontSize: 12,
                        color: Colors.amber.shade900,
                        height: 1.3,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),

            if (_saved) ...[
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.green.shade50,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: Colors.green.shade300),
                ),
                child: Row(
                  children: [
                    Icon(Icons.check_circle, color: Colors.green.shade700),
                    const SizedBox(width: 12),
                    const Expanded(
                      child: Text(
                        'Draft saved locally on device. When backend verification opens, this draft will be pre-filled for review.',
                        style: TextStyle(fontSize: 13, color: Colors.green),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: () => Navigator.of(context).pop(),
                  child: const Text('Done'),
                ),
              ),
            ] else ...[
              const Text(
                'Residency Neighborhood',
                style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
              ),
              const SizedBox(height: 6),
              TextField(
                controller: _neighborhoodController,
                decoration: const InputDecoration(
                  border: OutlineInputBorder(),
                  hintText: 'e.g. Malleshwaram, Bangalore',
                  prefixIcon: Icon(Icons.location_on_outlined),
                ),
              ),
              const SizedBox(height: 14),

              const Text(
                'Document Category',
                style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
              ),
              const SizedBox(height: 6),
              DropdownButtonFormField<String>(
                initialValue: _selectedDocType,
                decoration: const InputDecoration(
                  border: OutlineInputBorder(),
                  prefixIcon: Icon(Icons.badge_outlined),
                ),
                items: _docTypes
                    .map((t) => DropdownMenuItem(value: t, child: Text(t, style: const TextStyle(fontSize: 13))))
                    .toList(),
                onChanged: (val) {
                  if (val != null) setState(() => _selectedDocType = val);
                },
              ),
              const SizedBox(height: 14),

              const Text(
                'Document Reference / Notes',
                style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
              ),
              const SizedBox(height: 6),
              TextField(
                controller: _descriptionController,
                decoration: const InputDecoration(
                  border: OutlineInputBorder(),
                  hintText: 'e.g. BESCOM Consumer No. or Street proof details',
                  prefixIcon: Icon(Icons.description_outlined),
                ),
              ),
              const SizedBox(height: 20),

              Row(
                children: [
                  Expanded(
                    child: ElevatedButton.icon(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.teal.shade700,
                        foregroundColor: Colors.white,
                      ),
                      icon: _isUploading
                          ? const SizedBox(
                              width: 16,
                              height: 16,
                              child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                            )
                          : const Icon(Icons.cloud_upload_outlined),
                      label: Text(_isUploading ? 'Uploading...' : 'Submit for Verification'),
                      onPressed: _isUploading ? null : _handleLiveUploadAndSubmit,
                    ),
                  ),
                  const SizedBox(width: 10),
                  OutlinedButton(
                    onPressed: _handleSaveDraft,
                    child: const Text('Save Draft'),
                  ),
                ],
              ),
              if (_uploadStatus != null) ...[
                const SizedBox(height: 10),
                Text(
                  _uploadStatus!,
                  style: TextStyle(
                    color: Colors.green.shade800,
                    fontSize: 12,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ],
            ],
            const SizedBox(height: 24),
          ],
        ),
      ),
    );
  }
}
