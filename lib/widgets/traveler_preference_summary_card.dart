import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../providers/traveler_providers.dart';
import 'traveler_onboarding_sheet.dart';

/// Interactive summary card displayed on the Discovery screen.
/// Summarizes active Domain 02 traveler preferences & Domain 09 exploration mode,
/// and allows opening the preferences customization sheet.
class TravelerPreferenceSummaryCard extends ConsumerWidget {
  const TravelerPreferenceSummaryCard({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final prefs = ref.watch(travelerPreferencesProvider);
    final isGroupMode = ref.watch(isGroupModeProvider);

    return Card(
      elevation: 0,
      color: Colors.teal.shade50.withValues(alpha: 0.6),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: Colors.teal.shade200),
      ),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                CircleAvatar(
                  radius: 14,
                  backgroundColor: Colors.teal.shade700,
                  child: const Icon(Icons.person_pin, size: 16, color: Colors.white),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Text(
                            isGroupMode ? 'Group Taste Matching' : 'Solo Explorer',
                            style: const TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          const SizedBox(width: 6),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                            decoration: BoxDecoration(
                              color: isGroupMode ? Colors.indigo.shade100 : Colors.teal.shade100,
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Text(
                              isGroupMode ? 'Domain 09' : 'Domain 02',
                              style: TextStyle(
                                fontSize: 10,
                                fontWeight: FontWeight.bold,
                                color: isGroupMode ? Colors.indigo.shade900 : Colors.teal.shade900,
                              ),
                            ),
                          ),
                        ],
                      ),
                      Text(
                        '${prefs.budgetTier.displayName} • Max ₹${prefs.maxBudgetPerMealInr} • ${prefs.preferredPacing.displayName}',
                        style: TextStyle(
                          fontSize: 12,
                          color: Colors.grey.shade700,
                        ),
                      ),
                    ],
                  ),
                ),
                OutlinedButton.icon(
                  onPressed: () => TravelerOnboardingSheet.show(context),
                  icon: const Icon(Icons.tune, size: 15),
                  label: const Text('Preferences', style: TextStyle(fontSize: 12)),
                  style: OutlinedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                    visualDensity: VisualDensity.compact,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: [
                ...prefs.favoriteVibes.map((v) => Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: Colors.teal.shade100,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Text(
                        '#${v.replaceAll('_', ' ')}',
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          color: Colors.teal.shade900,
                        ),
                      ),
                    )),
                ...prefs.dietaryRestrictions.map((d) => Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: Colors.green.shade100,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Text(
                        d.toUpperCase(),
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          color: Colors.green.shade900,
                        ),
                      ),
                    )),
                if (prefs.accessibilityNeeds.isNotEmpty)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: Colors.purple.shade100,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.accessible, size: 12, color: Colors.purple.shade900),
                        const SizedBox(width: 4),
                        Text(
                          '${prefs.accessibilityNeeds.length} accessibility need(s)',
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                            color: Colors.purple.shade900,
                          ),
                        ),
                      ],
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
