import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/contribution.dart';
import '../providers/monetization_providers.dart';

/// Contributor Content Management Screen.
/// Lists submissions authored by the current authenticated user via `Contributions-listMyContributions`.
/// Organizes gems into canonical status categories (Pending, Approved, Rejected).
class ContributorContentManagementScreen extends ConsumerWidget {
  const ContributorContentManagementScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final contributionsAsync = ref.watch(myContributionsProvider);

    return DefaultTabController(
      length: 4,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('My Contributed Gems'),
          bottom: const TabBar(
            isScrollable: true,
            tabs: [
              Tab(text: 'All'),
              Tab(text: 'Pending Review'),
              Tab(text: 'Approved & Live'),
              Tab(text: 'Needs Attention'),
            ],
          ),
          actions: [
            IconButton(
              icon: const Icon(Icons.refresh),
              onPressed: () => ref.invalidate(myContributionsProvider),
            ),
          ],
        ),
        body: contributionsAsync.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (err, stack) => Center(
            child: Padding(
              padding: const EdgeInsets.all(20.0),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.error_outline, size: 48, color: Colors.red),
                  const SizedBox(height: 12),
                  Text('Failed to load contributions: $err', textAlign: TextAlign.center),
                  const SizedBox(height: 12),
                  ElevatedButton(
                    onPressed: () => ref.invalidate(myContributionsProvider),
                    child: const Text('Retry'),
                  ),
                ],
              ),
            ),
          ),
          data: (contributions) {
            final pending = contributions.where((c) =>
                c.status == ContributionStatus.submitted ||
                c.status == ContributionStatus.aiAnalyzed ||
                c.status == ContributionStatus.mapsGrounded).toList();

            final approved = contributions.where((c) =>
                c.status == ContributionStatus.verified).toList();

            final rejected = contributions.where((c) =>
                c.status == ContributionStatus.rejected).toList();

            return TabBarView(
              children: [
                _buildContributionsList(context, ref, contributions, 'No contributions submitted yet.'),
                _buildContributionsList(context, ref, pending, 'No contributions currently pending review.'),
                _buildContributionsList(context, ref, approved, 'No approved gems live yet.'),
                _buildContributionsList(context, ref, rejected, 'No rejected gems. Great job!'),
              ],
            );
          },
        ),
      ),
    );
  }

  Widget _buildContributionsList(
    BuildContext context,
    WidgetRef ref,
    List<ContributionDocument> list,
    String emptyMessage,
  ) {
    if (list.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(32.0),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.inbox_outlined, size: 48, color: Colors.grey.shade400),
              const SizedBox(height: 12),
              Text(
                emptyMessage,
                textAlign: TextAlign.center,
                style: TextStyle(color: Colors.grey.shade600, fontSize: 14),
              ),
            ],
          ),
        ),
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.all(12),
      itemCount: list.length,
      itemBuilder: (context, index) {
        final item = list[index];
        return _buildContributionCard(context, ref, item);
      },
    );
  }

  Widget _buildContributionCard(
    BuildContext context,
    WidgetRef ref,
    ContributionDocument item,
  ) {
    Color statusColor;
    String statusLabel;

    switch (item.status) {
      case ContributionStatus.verified:
        statusColor = Colors.green;
        statusLabel = 'VERIFIED & LIVE';
        break;
      case ContributionStatus.aiAnalyzed:
        statusColor = Colors.orange;
        statusLabel = 'AI ANALYZED';
        break;
      case ContributionStatus.mapsGrounded:
        statusColor = Colors.blue;
        statusLabel = 'MAPS GROUNDED';
        break;
      case ContributionStatus.rejected:
        statusColor = Colors.red;
        statusLabel = 'REJECTED';
        break;
      case ContributionStatus.submitted:
        statusColor = Colors.grey;
        statusLabel = 'SUBMITTED';
        break;
    }

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      elevation: 1,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      child: Padding(
        padding: const EdgeInsets.all(14.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(
                  child: Text(
                    'ID: ${item.contributionId}',
                    style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, fontFamily: 'monospace'),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: statusColor.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(4),
                    border: Border.all(color: statusColor.withValues(alpha: 0.4)),
                  ),
                  child: Text(
                    statusLabel,
                    style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: statusColor),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              item.submission.infoParagraph,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontSize: 13, height: 1.3),
            ),
            const SizedBox(height: 6),
            Row(
              children: [
                const Icon(Icons.link, size: 14, color: Colors.blue),
                const SizedBox(width: 4),
                Expanded(
                  child: Text(
                    item.submission.mapsLink,
                    style: const TextStyle(fontSize: 11, color: Colors.blue),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
            if (item.status == ContributionStatus.rejected && item.rejectionReason != null) ...[
              const SizedBox(height: 8),
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: Colors.red.shade50,
                  borderRadius: BorderRadius.circular(6),
                  border: Border.all(color: Colors.red.shade200),
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Icon(Icons.warning_amber_rounded, size: 16, color: Colors.red.shade700),
                    const SizedBox(width: 6),
                    Expanded(
                      child: Text(
                        'Reason: ${item.rejectionReason}',
                        style: TextStyle(fontSize: 11, color: Colors.red.shade900),
                      ),
                    ),
                  ],
                ),
              ),
            ],
            if (item.status == ContributionStatus.verified && item.groundedPlaceId != null) ...[
              const SizedBox(height: 8),
              Row(
                children: [
                  const Icon(Icons.check_circle, size: 14, color: Colors.green),
                  const SizedBox(width: 4),
                  Text(
                    'Published Place: ${item.groundedPlaceId}',
                    style: const TextStyle(fontSize: 11, color: Colors.green, fontWeight: FontWeight.w600),
                  ),
                ],
              ),
            ],
            const Divider(height: 18),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'Submitted: ${item.createdAt.day}/${item.createdAt.month}/${item.createdAt.year}',
                  style: TextStyle(fontSize: 11, color: Colors.grey.shade600),
                ),
                TextButton(
                  onPressed: () => _showContributionDetails(context, item),
                  child: const Text('View Details', style: TextStyle(fontSize: 12)),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  void _showContributionDetails(BuildContext context, ContributionDocument item) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (ctx) {
        return DraggableScrollableSheet(
          expand: false,
          initialChildSize: 0.65,
          maxChildSize: 0.9,
          builder: (_, scrollController) {
            return Padding(
              padding: const EdgeInsets.all(20),
              child: ListView(
                controller: scrollController,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text(
                        'Contribution Details',
                        style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                      ),
                      IconButton(
                        icon: const Icon(Icons.close),
                        onPressed: () => Navigator.of(ctx).pop(),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Text('ID: ${item.contributionId}', style: const TextStyle(fontFamily: 'monospace', fontSize: 12)),
                  const SizedBox(height: 8),
                  Text('Status: ${item.status.value}', style: const TextStyle(fontWeight: FontWeight.bold)),
                  const Divider(height: 20),
                  const Text('Info Paragraph:', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                  const SizedBox(height: 4),
                  Text(item.submission.infoParagraph, style: const TextStyle(fontSize: 13)),
                  const SizedBox(height: 12),
                  const Text('Google Maps Reference:', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                  const SizedBox(height: 4),
                  Text(item.submission.mapsLink, style: const TextStyle(fontSize: 12, color: Colors.blue)),
                  const SizedBox(height: 16),
                  if (item.assets.isNotEmpty) ...[
                    Text('Attached Assets (${item.assets.length}):', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                    const SizedBox(height: 6),
                    ...item.assets.map((a) => ListTile(
                          contentPadding: EdgeInsets.zero,
                          dense: true,
                          leading: Icon(a.assetType == 'STREET_PHOTO' ? Icons.photo : Icons.mic),
                          title: Text(a.assetType),
                          subtitle: Text(a.mimeType),
                        )),
                  ],
                ],
              ),
            );
          },
        );
      },
    );
  }
}
