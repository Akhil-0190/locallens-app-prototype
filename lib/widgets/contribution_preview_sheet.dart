// ignore: deprecated_member_use
import 'package:flutter/material.dart';
import '../models/contribution.dart';
import '../services/photo_helper.dart';

/// Pre-submission preview sheet displaying all contribution inputs and public attribution.
class ContributionPreviewSheet extends StatelessWidget {
  final ContributorSubmissionInput input;
  final ContributorVerificationProfile profile;
  final VoidCallback onConfirmSubmit;

  const ContributionPreviewSheet({
    super.key,
    required this.input,
    required this.profile,
    required this.onConfirmSubmit,
  });

  @override
  Widget build(BuildContext context) {
    final language = RegionalLanguage.supportedLanguages.firstWhere(
          (l) => l.code == input.selectedLanguage,
      orElse: () => RegionalLanguage.supportedLanguages.first,
    );

    return Container(
      padding: const EdgeInsets.all(24),
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Center(
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: Colors.grey.shade300,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                Icon(Icons.preview_outlined, color: Colors.teal.shade800, size: 24),
                const SizedBox(width: 8),
                const Text(
                  'Contribution Preview',
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            // Attribution Preview Banner
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.teal.shade50,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: Colors.teal.shade200),
              ),
              child: Row(
                children: [
                  CircleAvatar(
                    radius: 16,
                    backgroundColor: Colors.teal.shade200,
                    child: Icon(Icons.person, size: 18, color: Colors.teal.shade900),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Attributed to: ${profile.displayName}',
                          style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.bold,
                            color: Colors.teal.shade900,
                          ),
                        ),
                        Text(
                          '${profile.tierDisplayName} • Verified Resident of ${profile.neighborhoodOfResidency}',
                          style: TextStyle(fontSize: 11, color: Colors.teal.shade800),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            const Text(
              'Location (Google Maps)',
              style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 4),
            Text(
              input.mapsLink,
              style: TextStyle(fontSize: 13, color: Colors.blue.shade800),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
            const SizedBox(height: 12),
            const Text(
              'Local Story',
              style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 4),
            Text(
              input.infoParagraph,
              style: const TextStyle(fontSize: 13, height: 1.4),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                const Text(
                  'Selected Language: ',
                  style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(
                    color: Colors.teal.shade50,
                    borderRadius: BorderRadius.circular(6),
                    border: Border.all(color: Colors.teal.shade200),
                  ),
                  child: Text(
                    '${language.name} (${language.nativeLabel})',
                    style: TextStyle(fontSize: 12, color: Colors.teal.shade900, fontWeight: FontWeight.w600),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            if (input.audioNotePath != null) ...[
              Row(
                children: [
                  const Icon(Icons.mic, size: 16, color: Colors.teal),
                  const SizedBox(width: 6),
                  const Text(
                    'Voice Note Attached',
                    style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    '(Ready for AI Transcription)',
                    style: TextStyle(fontSize: 11, color: Colors.grey.shade600),
                  ),
                ],
              ),
              const SizedBox(height: 12),
            ],
            if (input.photoUrls.isNotEmpty) ...[
              Text(
                'Street Photos (${input.photoUrls.length}/2)',
                style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 8),
              SizedBox(
                height: 80,
                child: ListView.separated(
                  scrollDirection: Axis.horizontal,
                  itemCount: input.photoUrls.length,
                  separatorBuilder: (context, index) => const SizedBox(width: 8),
                  itemBuilder: (context, index) {
                    return ClipRRect(
                      borderRadius: BorderRadius.circular(8),
                      child: PhotoHelper.buildPhotoWidget(
                        input.photoUrls[index],
                        height: 80,
                        width: 100,
                      ),
                    );
                  },
                ),
              ),
              const SizedBox(height: 16),
            ],
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: () => Navigator.pop(context),
                    child: const Text('Edit Details'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: FilledButton(
                    onPressed: () {
                      Navigator.pop(context);
                      onConfirmSubmit();
                    },
                    child: const Text('Confirm & Submit'),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
