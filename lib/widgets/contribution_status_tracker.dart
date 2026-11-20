// ignore: deprecated_member_use
import 'package:flutter/material.dart';
import '../models/contribution.dart';
import '../models/spot_card.dart';
import 'spot_card_tile.dart';

/// Visual tracker for the 4-stage contribution pipeline conforming to Domain 03 & 04.
class ContributionStatusTracker extends StatelessWidget {
  final ContributionDocument contribution;
  final VoidCallback? onRetry;
  final VoidCallback? onReset;

  const ContributionStatusTracker({
    super.key,
    required this.contribution,
    this.onRetry,
    this.onReset,
  });

  void _showStructuredSpotCard(BuildContext context, SpotCard spot) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) {
        return DraggableScrollableSheet(
          initialChildSize: 0.85,
          maxChildSize: 0.95,
          minChildSize: 0.6,
          expand: false,
          builder: (context, scrollController) {
            return ListView(
              controller: scrollController,
              padding: const EdgeInsets.all(20),
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
                    const Icon(Icons.check_circle, color: Colors.teal, size: 24),
                    const SizedBox(width: 8),
                    const Text(
                      'Published Spot Card View',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                Text(
                  'This is how travelers will experience your discovery in the Pocket Guide.',
                  style: TextStyle(fontSize: 13, color: Colors.grey.shade600),
                ),
                const SizedBox(height: 16),
                SpotCardTile(
                  spot: spot,
                  statusText: '${spot.currentVisitors}/${spot.hourlyLimit}',
                  actions: [
                    FilledButton.icon(
                      onPressed: () {},
                      icon: const Icon(Icons.directions, size: 16),
                      label: const Text('Open in Maps'),
                    ),
                  ],
                ),
              ],
            );
          },
        );
      },
    );
  }

  Widget _buildStepItem({
    required int stepNumber,
    required String title,
    required String subtitle,
    required bool isComplete,
    required bool isInProgress,
    required bool isFailed,
  }) {
    Widget leading;

    if (isFailed) {
      leading = const Icon(Icons.cancel, color: Colors.red, size: 22);
    } else if (isComplete) {
      leading = const Icon(Icons.check_circle, color: Colors.teal, size: 22);
    } else if (isInProgress) {
      leading = const SizedBox(
        width: 18,
        height: 18,
        child: CircularProgressIndicator(strokeWidth: 2.5),
      );
    } else {
      leading = CircleAvatar(
        radius: 11,
        backgroundColor: Colors.grey.shade200,
        child: Text(
          '$stepNumber',
          style: TextStyle(fontSize: 11, color: Colors.grey.shade600),
        ),
      );
    }

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          leading,
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight:
                    isComplete || isInProgress ? FontWeight.bold : FontWeight.w500,
                    color: isComplete || isInProgress ? Colors.black87 : Colors.grey.shade600,
                  ),
                ),
                Text(
                  subtitle,
                  style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final status = contribution.status;

    final isUploadComplete = true; // Once doc exists, upload succeeded
    final isAiComplete = status == ContributionStatus.aiAnalyzed ||
        status == ContributionStatus.mapsGrounded ||
        status == ContributionStatus.verified;
    final isMapsComplete = status == ContributionStatus.mapsGrounded ||
        status == ContributionStatus.verified;
    final isVerifiedComplete = status == ContributionStatus.verified;
    final isFailed = status == ContributionStatus.rejected;

    return Card(
      margin: const EdgeInsets.only(top: 16),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: BorderSide(color: Colors.teal.shade200),
      ),
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    const Icon(Icons.stream, color: Colors.teal, size: 20),
                    const SizedBox(width: 8),
                    const Text(
                      'Pipeline Ingestion Status',
                      style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                    ),
                  ],
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: isVerifiedComplete
                        ? Colors.green.shade50
                        : Colors.orange.shade50,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(
                      color: isVerifiedComplete
                          ? Colors.green.shade300
                          : Colors.orange.shade300,
                    ),
                  ),
                  child: Text(
                    status.displayName,
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.bold,
                      color: isVerifiedComplete
                          ? Colors.green.shade900
                          : Colors.orange.shade900,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 6),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: Colors.grey.shade100,
                borderRadius: BorderRadius.circular(6),
              ),
              child: const Text(
                'Sample/Mock Simulation (Awaiting A3 Storage & B2 Gemini Deployments)',
                style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: Colors.blueGrey),
              ),
            ),
            const SizedBox(height: 14),
            _buildStepItem(
              stepNumber: 1,
              title: 'Asset Upload to Cloud Storage (A3)',
              subtitle: 'Photos and native voice note securely buffered.',
              isComplete: isUploadComplete,
              isInProgress: false,
              isFailed: false,
            ),
            _buildStepItem(
              stepNumber: 2,
              title: 'Gemini Multimodal Analysis (B2)',
              subtitle: 'Extracting cultural tips, hours, and regional greeting.',
              isComplete: isAiComplete,
              isInProgress: status == ContributionStatus.submitted,
              isFailed: isFailed,
            ),
            _buildStepItem(
              stepNumber: 3,
              title: 'Google Maps Place Grounding (C1/C2)',
              subtitle: 'Resolving verified placeId and neighborhood boundaries.',
              isComplete: isMapsComplete,
              isInProgress: status == ContributionStatus.aiAnalyzed,
              isFailed: isFailed,
            ),
            _buildStepItem(
              stepNumber: 4,
              title: 'Publication & Contributor Attribution',
              subtitle: 'Awarding +25 reputation points and rendering Spot Card.',
              isComplete: isVerifiedComplete,
              isInProgress: status == ContributionStatus.mapsGrounded,
              isFailed: isFailed,
            ),
            const SizedBox(height: 16),
            if (isVerifiedComplete && contribution.generatedSpotCard != null) ...[
              FilledButton.icon(
                onPressed: () => _showStructuredSpotCard(
                  context,
                  contribution.generatedSpotCard!,
                ),
                icon: const Icon(Icons.visibility),
                label: const Text('View Resulting Structured Spot Card'),
              ),
              const SizedBox(height: 8),
            ],
            if (isFailed && onRetry != null) ...[
              FilledButton.tonalIcon(
                onPressed: onRetry,
                icon: const Icon(Icons.refresh),
                label: const Text('Retry Processing'),
              ),
              const SizedBox(height: 8),
            ],
            if (onReset != null)
              OutlinedButton.icon(
                onPressed: onReset,
                icon: const Icon(Icons.add),
                label: const Text('Submit Another Local Gem'),
              ),
          ],
        ),
      ),
    );
  }
}
