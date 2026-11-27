// ignore: deprecated_member_use
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../models/contribution.dart';
import '../models/spot_card.dart';
import 'spot_card_tile.dart';

/// Visual tracker for the live 4-stage contribution pipeline conforming to Domain 03 & 04.
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
                      onPressed: () async {
                        final link = spot.mapsLink.isNotEmpty
                            ? spot.mapsLink
                            : 'https://www.google.com/maps/search/?api=1&query=${Uri.encodeComponent('${spot.spotName} ${spot.formattedAddress}')}';
                        final uri = Uri.tryParse(link);
                        if (uri != null) {
                          await launchUrl(uri, mode: LaunchMode.externalApplication);
                        }
                      },
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
    bool isPendingExternal = false,
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
    } else if (isPendingExternal) {
      leading = CircleAvatar(
        radius: 11,
        backgroundColor: Colors.amber.shade100,
        child: Icon(Icons.hourglass_empty, size: 12, color: Colors.amber.shade900),
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
                    color: isComplete || isInProgress
                        ? Colors.black87
                        : isPendingExternal
                            ? Colors.blueGrey.shade800
                            : Colors.grey.shade600,
                  ),
                ),
                Text(
                  subtitle,
                  style: TextStyle(
                    fontSize: 12,
                    color: isPendingExternal ? Colors.amber.shade900 : Colors.grey.shade600,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildProvisionalAiCard(BuildContext context) {
    // Collect all practical details and transcriptions across all assets
    final practicalList = contribution.assets
        .map((a) => a.aiExtractionResult?.practicalDetails)
        .whereType<ExtractedPracticalDetails>()
        .toList();

    final transcriptions = contribution.assets
        .map((a) => a.aiExtractionResult?.transcription)
        .where((t) => t != null && t.isNotEmpty)
        .cast<String>()
        .toList();

    final ocrTexts = contribution.assets
        .expand((a) => a.aiExtractionResult?.ocrDetectedText ?? <String>[])
        .toList();

    final dishes = practicalList
        .expand((p) => p.signatureDishesOrItems)
        .toSet()
        .toList();

    final tips = practicalList
        .expand((p) => p.insiderTips)
        .toSet()
        .toList();

    final openingHours = practicalList
        .map((p) => p.openingHoursMentioned)
        .firstWhere((h) => h != null && h.isNotEmpty, orElse: () => null);

    final isCashOnly = practicalList.any((p) => p.cashOnlyWarning);

    return Container(
      margin: const EdgeInsets.only(top: 16),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.teal.shade50.withAlpha(128),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.teal.shade300),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.auto_awesome, color: Colors.teal, size: 20),
              const SizedBox(width: 8),
              const Expanded(
                child: Text(
                  'Provisional AI Insights (Extracted by Gemini B2)',
                  style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold),
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: Colors.teal.shade100,
                  borderRadius: BorderRadius.circular(4),
                ),
                child: const Text(
                  'Pending Grounding',
                  style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Colors.teal),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          const Text(
            'Extracted from your uploaded photos and voice notes. Final place card will be published upon Maps grounding.',
            style: TextStyle(fontSize: 11, color: Colors.blueGrey),
          ),
          const Divider(height: 16),
          if (transcriptions.isNotEmpty) ...[
            const Text(
              'Voice Note Transcription:',
              style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Colors.black87),
            ),
            const SizedBox(height: 2),
            Text(
              '"${transcriptions.first}"',
              style: const TextStyle(fontSize: 12, fontStyle: FontStyle.italic, color: Colors.black87),
            ),
            const SizedBox(height: 8),
          ],
          if (openingHours != null) ...[
            Row(
              children: [
                const Icon(Icons.access_time, size: 14, color: Colors.teal),
                const SizedBox(width: 6),
                Text(
                  'Hours: $openingHours',
                  style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
                ),
              ],
            ),
            const SizedBox(height: 6),
          ],
          if (isCashOnly) ...[
            Row(
              children: [
                const Icon(Icons.payments_outlined, size: 14, color: Colors.orange),
                const SizedBox(width: 6),
                const Text(
                  'Payment: Cash / UPI Only (Warning Detected)',
                  style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Colors.orange),
                ),
              ],
            ),
            const SizedBox(height: 6),
          ],
          if (dishes.isNotEmpty) ...[
            const SizedBox(height: 4),
            const Text(
              'Signature Items:',
              style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 4),
            Wrap(
              spacing: 6,
              runSpacing: 4,
              children: dishes
                  .map((dish) => Chip(
                        visualDensity: VisualDensity.compact,
                        label: Text(dish, style: const TextStyle(fontSize: 11)),
                        backgroundColor: Colors.white,
                      ))
                  .toList(),
            ),
          ],
          if (tips.isNotEmpty) ...[
            const SizedBox(height: 6),
            const Text(
              'Insider Tip:',
              style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 2),
            Text(
              tips.first,
              style: const TextStyle(fontSize: 12, color: Colors.black87),
            ),
          ],
          if (ocrTexts.isNotEmpty) ...[
            const SizedBox(height: 6),
            Row(
              children: [
                const Icon(Icons.text_fields, size: 14, color: Colors.blueGrey),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    'OCR Signage: ${ocrTexts.take(2).join(', ')}',
                    style: const TextStyle(fontSize: 11, color: Colors.blueGrey),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final status = contribution.status;

    final isUploadComplete = true; // Contribution document exists in Firestore
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
                        : isFailed
                            ? Colors.red.shade50
                            : Colors.orange.shade50,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(
                      color: isVerifiedComplete
                          ? Colors.green.shade300
                          : isFailed
                              ? Colors.red.shade300
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
                          : isFailed
                              ? Colors.red.shade900
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
                color: isFailed ? Colors.red.shade50 : Colors.teal.shade50,
                borderRadius: BorderRadius.circular(6),
              ),
              child: Text(
                isFailed
                    ? 'Submission Rejected: ${contribution.rejectionReason ?? 'Moderation review flagged this submission.'}'
                    : isAiComplete
                        ? 'Live AI Analysis Complete: Extracted cultural insights pending C2 Maps Grounding.'
                        : 'Live Backend Pipeline: Ingestion stub created; AI analysis in progress.',
                style: TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.w600,
                  color: isFailed ? Colors.red.shade800 : Colors.teal.shade900,
                ),
              ),
            ),
            const SizedBox(height: 14),
            _buildStepItem(
              stepNumber: 1,
              title: 'Asset Upload to Cloud Storage (A3)',
              subtitle: 'Photos and native voice note securely buffered and registered.',
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
              title: 'Google Maps Place Grounding',
              subtitle: isMapsComplete
                  ? 'Resolved Google Place ID, opening hours, and review sentiment.'
                  : 'Queued for Google Maps Platform grounding after AI extraction completes.',
              isComplete: isMapsComplete,
              isInProgress: status == ContributionStatus.aiAnalyzed,
              isFailed: isFailed,
              isPendingExternal: !isMapsComplete,
            ),
            _buildStepItem(
              stepNumber: 4,
              title: 'Publication & Contributor Attribution',
              subtitle: isVerifiedComplete
                  ? 'Awarded +25 reputation points and published Spot Card.'
                  : 'Pending final verification & place publication.',
              isComplete: isVerifiedComplete,
              isInProgress: status == ContributionStatus.mapsGrounded,
              isFailed: isFailed,
            ),
            if (isAiComplete) ...[
              _buildProvisionalAiCard(context),
            ],
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
                label: const Text('Retry Submission'),
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
