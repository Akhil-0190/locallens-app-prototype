import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/monetization.dart';
import '../providers/monetization_providers.dart';
import '../widgets/pass_checkout_sheet.dart';

/// Screen presenting Walking Route Passes, active user passes,
/// and sandbox pass checkout workflows.
/// All pricing is explicitly labeled as pending commercial confirmation.
class RoutePassScreen extends ConsumerWidget {
  const RoutePassScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final passesAsync = ref.watch(userPassesProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Walking Route Passes'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () => ref.invalidate(userPassesProvider),
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Mandatory Sandbox Banner
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.deepPurple.shade50,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: Colors.deepPurple.shade200),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(Icons.shield_outlined, color: Colors.deepPurple.shade700, size: 20),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      '[Sandbox Mode: Simulated Payment - No Real Money Charged]\n'
                      'Route passes unlock audio walking co-pilot, curated offline maps, and artisan merchant discounts via backend simulation.',
                      style: TextStyle(
                        fontSize: 12,
                        color: Colors.deepPurple.shade900,
                        height: 1.3,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),

            // Section 1: My Active Passes
            const Text(
              'My Passes',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            passesAsync.when(
              loading: () => const Center(child: Padding(
                padding: EdgeInsets.all(16.0),
                child: CircularProgressIndicator(),
              )),
              error: (err, _) => Text('Failed to load passes: $err', style: const TextStyle(color: Colors.red)),
              data: (passes) {
                if (passes.isEmpty) {
                  return Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: Colors.grey.shade100,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      'No route passes purchased yet. Choose a pass below to unlock walking navigation.',
                      style: TextStyle(color: Colors.grey.shade600, fontSize: 13),
                    ),
                  );
                }
                return Column(
                  children: passes.map((p) => _buildActivePassCard(p)).toList(),
                );
              },
            ),
            const SizedBox(height: 24),

            // Section 2: Pass Tier Catalog
            const Text(
              'Available Pass Tiers',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 4),
            Text(
              'Commercial pricing is pending official confirmation with local merchant and heritage partners.',
              style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
            ),
            const SizedBox(height: 12),

            _buildTierCard(
              context: context,
              tier: PassTier.singleRoute,
              description: 'Access 1 curated walking route for 48 hours. Includes audio walking co-pilot and offline map.',
              neighborhood: 'Malleshwaram',
            ),
            const SizedBox(height: 12),

            _buildTierCard(
              context: context,
              tier: PassTier.neighborhoodAllAccess,
              description: 'Unlimited access to all walking routes and curated food trails in a neighborhood for 7 days. Includes 10% partner merchant discounts.',
              neighborhood: 'Malleshwaram',
              isPopular: true,
            ),
            const SizedBox(height: 12),

            _buildTierCard(
              context: context,
              tier: PassTier.annualExplorer,
              description: 'Annual global pass unlocking every neighborhood route, all offline map packs, and exclusive artisan discounts across Bangalore.',
              neighborhood: 'All Bangalore Neighborhoods',
            ),
            const SizedBox(height: 24),
          ],
        ),
      ),
    );
  }

  Widget _buildActivePassCard(RoutePass pass) {
    final isActive = pass.isCurrentlyValid;
    final color = isActive ? Colors.green : Colors.grey;

    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      elevation: 2,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      child: Padding(
        padding: const EdgeInsets.all(14.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  pass.tier.displayName,
                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(
                    color: color.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(4),
                    border: Border.all(color: color.withValues(alpha: 0.4)),
                  ),
                  child: Text(
                    isActive ? 'ACTIVE' : pass.status.value,
                    style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: color),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 4),
            Text('Neighborhood: ${pass.neighborhood}', style: const TextStyle(fontSize: 12, color: Colors.grey)),
            const Divider(height: 16),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'Valid until: ${pass.validUntil.day}/${pass.validUntil.month}/${pass.validUntil.year}',
                  style: const TextStyle(fontSize: 11, color: Colors.black87),
                ),
                Row(
                  children: [
                    if (pass.perksIncluded.audioGuidanceUnlocked)
                      const Padding(
                        padding: EdgeInsets.only(left: 4),
                        child: Icon(Icons.headphones, size: 16, color: Colors.deepPurple),
                      ),
                    if (pass.perksIncluded.offlinePackUnlocked)
                      const Padding(
                        padding: EdgeInsets.only(left: 4),
                        child: Icon(Icons.offline_pin, size: 16, color: Colors.blue),
                      ),
                    if (pass.perksIncluded.merchantPartnerDiscountPercent > 0)
                      Padding(
                        padding: const EdgeInsets.only(left: 4),
                        child: Text(
                          '${pass.perksIncluded.merchantPartnerDiscountPercent}% OFF',
                          style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Colors.green),
                        ),
                      ),
                  ],
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildTierCard({
    required BuildContext context,
    required PassTier tier,
    required String description,
    required String neighborhood,
    bool isPopular = false,
  }) {
    return Card(
      elevation: isPopular ? 3 : 1,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: isPopular
            ? const BorderSide(color: Colors.deepPurple, width: 1.5)
            : BorderSide(color: Colors.grey.shade300),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  tier.displayName,
                  style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                ),
                if (isPopular)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                    decoration: BoxDecoration(
                      color: Colors.deepPurple,
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: const Text(
                      'RECOMMENDED',
                      style: TextStyle(fontSize: 9, fontWeight: FontWeight.bold, color: Colors.white),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 4),
            Text(
              tier.durationLabel,
              style: TextStyle(fontSize: 12, color: Colors.grey.shade700, fontWeight: FontWeight.w500),
            ),
            const SizedBox(height: 8),
            Text(description, style: const TextStyle(fontSize: 12, height: 1.3)),
            const SizedBox(height: 12),

            // Pricing Pending Confirmation Notice (No hardcoded rates)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              decoration: BoxDecoration(
                color: Colors.amber.shade50,
                borderRadius: BorderRadius.circular(6),
                border: Border.all(color: Colors.amber.shade200),
              ),
              child: const Row(
                children: [
                  Icon(Icons.info_outline, size: 14, color: Colors.amber),
                  SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      'Pricing: Pending Commercial Confirmation',
                      style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Colors.black87),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),

            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                icon: const Icon(Icons.shopping_cart_outlined, size: 16),
                label: const Text('Purchase Pass (Sandbox)'),
                onPressed: () {
                  showModalBottomSheet(
                    context: context,
                    isScrollControlled: true,
                    builder: (ctx) => PassCheckoutSheet(
                      tier: tier,
                      neighborhood: neighborhood,
                    ),
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}
