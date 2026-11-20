// ignore: deprecated_member_use
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../providers/monetization_providers.dart';
import '../widgets/guidance_request_sheet.dart';
import '../widgets/id_verification_modal_sheet.dart';
import '../widgets/tipping_modal_sheet.dart';

/// Contributor Profile & Economics Dashboard Screen.
/// Displays reputation badges, approved gems, materialized balance ledger,
/// and provides navigation to content management and action sheets.
class ContributorProfileScreen extends ConsumerWidget {
  final String userId;

  const ContributorProfileScreen({
    super.key,
    this.userId = 'usr_blr_782914',
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final attributionAsync = ref.watch(contributorAttributionProvider(userId));
    final rewardAsync = ref.watch(contributorRewardSummaryProvider(userId));

    return Scaffold(
      appBar: AppBar(
        title: const Text('Contributor Profile'),
        actions: [
          IconButton(
            icon: const Icon(Icons.inventory_2_outlined),
            tooltip: 'My Contributions',
            onPressed: () => context.push('/contributor-content'),
          ),
          IconButton(
            icon: const Icon(Icons.confirmation_number_outlined),
            tooltip: 'Route Passes',
            onPressed: () => context.push('/route-passes'),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(contributorAttributionProvider(userId));
          ref.invalidate(contributorRewardSummaryProvider(userId));
        },
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(16.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // 1. Attribution Header
              attributionAsync.when(
                loading: () => const Center(child: Padding(
                  padding: EdgeInsets.all(24.0),
                  child: CircularProgressIndicator(),
                )),
                error: (err, _) => Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.red.shade50,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text('Attribution load error: $err', style: const TextStyle(color: Colors.red)),
                ),
                data: (attr) => _buildAttributionCard(context, attr),
              ),
              const SizedBox(height: 16),

              // 2. Action Buttons Row (Tipping & Guidance)
              Row(
                children: [
                  Expanded(
                    child: ElevatedButton.icon(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.deepPurple,
                        foregroundColor: Colors.white,
                      ),
                      icon: const Icon(Icons.volunteer_activism_outlined),
                      label: const Text('Send Tip'),
                      onPressed: () {
                        showModalBottomSheet(
                          context: context,
                          isScrollControlled: true,
                          builder: (ctx) => TippingModalSheet(
                            recipientUserId: userId,
                            recipientName: attributionAsync.value?.displayName ?? 'Local Contributor',
                            spotId: 'spot_ctr_shri_sagar',
                            spotName: 'CTR Shri Sagar Malleshwaram',
                          ),
                        );
                      },
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: OutlinedButton.icon(
                      icon: const Icon(Icons.person_pin_circle_outlined),
                      label: const Text('1-on-1 Guidance'),
                      onPressed: () {
                        showModalBottomSheet(
                          context: context,
                          isScrollControlled: true,
                          builder: (ctx) => GuidanceRequestSheet(
                            guideUserId: userId,
                            guideName: attributionAsync.value?.displayName ?? 'Local Contributor',
                            neighborhood: 'Malleshwaram',
                          ),
                        );
                      },
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 20),

              // 3. Materialized Balance & Rewards Ledger Card
              rewardAsync.when(
                loading: () => const Center(child: CircularProgressIndicator()),
                error: (err, _) => Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.red.shade50,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text('Reward ledger error: $err', style: const TextStyle(color: Colors.red)),
                ),
                data: (ledger) => _buildRewardLedgerCard(ledger),
              ),
              const SizedBox(height: 20),

              // 4. Content Management Shortcut
              Card(
                elevation: 1,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                child: ListTile(
                  leading: const CircleAvatar(
                    backgroundColor: Colors.indigo,
                    child: Icon(Icons.assignment_outlined, color: Colors.white),
                  ),
                  title: const Text('Manage Submitted Gems', style: TextStyle(fontWeight: FontWeight.bold)),
                  subtitle: const Text('View processing statuses, approvals, and AI extraction results'),
                  trailing: const Icon(Icons.arrow_forward_ios, size: 16),
                  onTap: () => context.push('/contributor-content'),
                ),
              ),
              const SizedBox(height: 10),

              // 5. Partner Accommodation Subscriptions Shortcut
              Card(
                elevation: 1,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                child: ListTile(
                  leading: const CircleAvatar(
                    backgroundColor: Colors.teal,
                    child: Icon(Icons.hotel_outlined, color: Colors.white),
                  ),
                  title: const Text('Partner Subscriptions', style: TextStyle(fontWeight: FontWeight.bold)),
                  subtitle: const Text('Hotel, Homestay & Hostel onboarding and perks'),
                  trailing: const Icon(Icons.arrow_forward_ios, size: 16),
                  onTap: () => context.push('/partner-subscriptions'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildAttributionCard(BuildContext context, dynamic attr) {
    return Card(
      elevation: 2,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                CircleAvatar(
                  radius: 28,
                  backgroundColor: Colors.deepPurple.shade100,
                  child: Icon(Icons.person, size: 36, color: Colors.deepPurple.shade700),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        attr.displayName,
                        style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                      ),
                      const SizedBox(height: 2),
                      Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                            decoration: BoxDecoration(
                              color: Colors.amber.shade100,
                              borderRadius: BorderRadius.circular(4),
                            ),
                            child: Text(
                              attr.badgeTitle,
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.bold,
                                color: Colors.amber.shade900,
                              ),
                            ),
                          ),
                          const SizedBox(width: 6),
                          Text(
                            attr.reputationTier,
                            style: TextStyle(fontSize: 11, color: Colors.grey.shade600),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const Divider(height: 24),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: [
                _buildStatColumn('Approved Gems', '${attr.approvedGemsCount}'),
                _buildStatColumn(
                  'Resident Status',
                  attr.isVerifiedResident ? 'Verified' : 'Unverified',
                  color: attr.isVerifiedResident ? Colors.green : Colors.grey,
                ),
              ],
            ),
            const SizedBox(height: 12),
            // ID Verification Entry Point
            OutlinedButton.icon(
              style: OutlinedButton.styleFrom(
                minimumSize: const Size.fromHeight(36),
                side: BorderSide(
                  color: attr.isVerifiedResident ? Colors.green : Colors.amber.shade700,
                ),
              ),
              icon: Icon(
                attr.isVerifiedResident ? Icons.check_circle : Icons.badge_outlined,
                size: 16,
                color: attr.isVerifiedResident ? Colors.green : Colors.amber.shade800,
              ),
              label: Text(
                attr.isVerifiedResident
                    ? 'Verified Local Resident (ID Confirmed)'
                    : 'Submit Residency Proof (Local Draft)',
                style: TextStyle(
                  fontSize: 12,
                  color: attr.isVerifiedResident ? Colors.green : Colors.amber.shade900,
                ),
              ),
              onPressed: () {
                showModalBottomSheet(
                  context: context,
                  isScrollControlled: true,
                  builder: (ctx) => IdVerificationModalSheet(
                    isVerified: attr.isVerifiedResident,
                  ),
                );
              },
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildRewardLedgerCard(dynamic ledger) {
    return Card(
      elevation: 2,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Expanded(
                  child: Text(
                    'Community Earnings & Rewards',
                    style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                  ),
                ),
                const SizedBox(width: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: Colors.blue.shade50,
                    borderRadius: BorderRadius.circular(6),
                    border: Border.all(color: Colors.blue.shade200),
                  ),
                  child: Text(
                    ledger.guidanceRank,
                    style: TextStyle(fontSize: 11, color: Colors.blue.shade900, fontWeight: FontWeight.bold),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),
            Row(
              children: [
                Expanded(
                  child: Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: Colors.green.shade50,
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: Colors.green.shade200),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('Available Balance', style: TextStyle(fontSize: 11, color: Colors.green)),
                        const SizedBox(height: 4),
                        Text(
                          '₹${ledger.availableBalanceInr.toStringAsFixed(0)}',
                          style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: Colors.green.shade800),
                        ),
                        const SizedBox(height: 2),
                        const Text('Withdrawable', style: TextStyle(fontSize: 10, color: Colors.grey)),
                      ],
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: Colors.grey.shade50,
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: Colors.grey.shade200),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('Total Earnings', style: TextStyle(fontSize: 11, color: Colors.black54)),
                        const SizedBox(height: 4),
                        Text(
                          '₹${ledger.totalEarningsInr.toStringAsFixed(0)}',
                          style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: Colors.black87),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          'Withdrawn: ₹${ledger.withdrawnTotalInr.toStringAsFixed(0)}',
                          style: const TextStyle(fontSize: 10, color: Colors.grey),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'Reputation Points: ${ledger.reputationPoints} pts',
                  style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
                ),
                if (ledger.payoutUpiId != null)
                  Text(
                    'UPI: ${ledger.payoutUpiId}',
                    style: TextStyle(fontSize: 11, color: Colors.grey.shade700, fontFamily: 'monospace'),
                  ),
              ],
            ),
            if (ledger.unrecoveredAdjustmentInr > 0) ...[
              const SizedBox(height: 6),
              Text(
                'Unrecovered Refund Balance: ₹${ledger.unrecoveredAdjustmentInr.toStringAsFixed(0)} (offset against future tips)',
                style: const TextStyle(fontSize: 11, color: Colors.orange),
              ),
            ],
          ],
        ),
      ),
    );
  }

  static Widget _buildStatColumn(String label, String value, {Color? color}) {
    return Column(
      children: [
        Text(
          value,
          style: TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.bold,
            color: color ?? Colors.black87,
          ),
        ),
        const SizedBox(height: 2),
        Text(
          label,
          style: const TextStyle(fontSize: 11, color: Colors.grey),
        ),
      ],
    );
  }
}
