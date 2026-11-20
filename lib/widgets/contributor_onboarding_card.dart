// ignore: deprecated_member_use
import 'package:flutter/material.dart';
import '../models/contribution.dart';

/// Contributor onboarding header and guidelines modal.
class ContributorOnboardingCard extends StatelessWidget {
  final ContributorVerificationProfile profile;

  const ContributorOnboardingCard({
    super.key,
    required this.profile,
  });

  void _showGuidelinesSheet(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) {
        return DraggableScrollableSheet(
          initialChildSize: 0.75,
          maxChildSize: 0.95,
          minChildSize: 0.5,
          expand: false,
          builder: (context, scrollController) {
            return ListView(
              controller: scrollController,
              padding: const EdgeInsets.all(24),
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
                    Icon(Icons.verified, color: Colors.teal.shade700, size: 28),
                    const SizedBox(width: 12),
                    const Expanded(
                      child: Text(
                        'Contributor Guidelines',
                        style: TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                    IconButton(
                      icon: const Icon(Icons.close),
                      onPressed: () => Navigator.pop(context),
                      tooltip: 'Close',
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                Text(
                  'As a verified resident of ${profile.neighborhoodOfResidency}, your local knowledge helps travelers bypass tourist traps and support authentic local heritage.',
                  style: TextStyle(fontSize: 14, color: Colors.grey.shade800, height: 1.4),
                ),
                const SizedBox(height: 20),
                _buildGuideStep(
                  step: '1',
                  title: 'Exact Location & Authentic Story',
                  desc: 'Paste a Google Maps link and write a 3-4 line narrative explaining what makes this spot unique, what to order, and best time to visit.',
                ),
                const SizedBox(height: 14),
                _buildGuideStep(
                  step: '2',
                  title: 'Native Voice Notes',
                  desc: 'Record a 15-60 second voice note in your native language (Kannada, Tamil, Hindi, etc.). Gemini AI will transcribe and translate it into a cultural greeting card.',
                ),
                const SizedBox(height: 14),
                _buildGuideStep(
                  step: '3',
                  title: 'Street Signage & Storefront Photos',
                  desc: 'Attach up to 2 street-level photos. Signage helps our multimodal pipeline verify authentic ownership.',
                ),
                const SizedBox(height: 14),
                _buildGuideStep(
                  step: '4',
                  title: 'Earn Reputation & Attribution',
                  desc: 'Approved gems award +25 reputation points, unlock insider badges, and feature your name on the traveler pocket guide.',
                ),
                const SizedBox(height: 24),
                FilledButton(
                  onPressed: () => Navigator.pop(context),
                  child: const Text('Got it, let\'s add a gem!'),
                ),
              ],
            );
          },
        );
      },
    );
  }

  Widget _buildGuideStep({
    required String step,
    required String title,
    required String desc,
  }) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        CircleAvatar(
          radius: 14,
          backgroundColor: Colors.teal.shade100,
          child: Text(
            step,
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.bold,
              color: Colors.teal.shade900,
            ),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: const TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                desc,
                style: TextStyle(fontSize: 13, color: Colors.grey.shade700),
              ),
            ],
          ),
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 0,
      color: Colors.teal.shade50,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: BorderSide(color: Colors.teal.shade200),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                CircleAvatar(
                  radius: 20,
                  backgroundColor: Colors.teal.shade200,
                  child: Icon(Icons.person, color: Colors.teal.shade900, size: 22),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Flexible(
                            child: Text(
                              profile.displayName,
                              style: const TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.bold,
                              ),
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          if (profile.isVerifiedResident) ...[
                            const SizedBox(width: 6),
                            const Icon(Icons.verified, size: 16, color: Colors.teal),
                          ],
                        ],
                      ),
                      Text(
                        '${profile.tierDisplayName} • ${profile.neighborhoodOfResidency}',
                        style: TextStyle(
                          fontSize: 12,
                          color: Colors.teal.shade900,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: Colors.teal.shade200),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.stars, color: Colors.amber, size: 16),
                      const SizedBox(width: 4),
                      Text(
                        '${profile.reputationPoints} pts',
                        style: const TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  '${profile.spotsApprovedCount} gems verified (${(profile.accuracyRate * 100).toInt()}% approval)',
                  style: TextStyle(fontSize: 12, color: Colors.grey.shade700),
                ),
                TextButton.icon(
                  onPressed: () => _showGuidelinesSheet(context),
                  icon: const Icon(Icons.info_outline, size: 16),
                  label: const Text('Guidelines', style: TextStyle(fontSize: 12)),
                  style: TextButton.styleFrom(
                    visualDensity: VisualDensity.compact,
                    padding: EdgeInsets.zero,
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
