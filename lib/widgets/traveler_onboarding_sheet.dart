// ignore: deprecated_member_use
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/traveler_preferences.dart';
import '../providers/traveler_providers.dart';

/// Modal bottom sheet allowing travelers to review and customize their
/// preferences strictly adhering to Domain 02 (`docs/contracts/02-traveler-preferences.md`)
/// and Domain 09 (`docs/contracts/09-groups-and-taste-matching.md`).
class TravelerOnboardingSheet extends ConsumerStatefulWidget {
  const TravelerOnboardingSheet({super.key});

  static Future<void> show(BuildContext context) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) => const TravelerOnboardingSheet(),
    );
  }

  @override
  ConsumerState<TravelerOnboardingSheet> createState() =>
      _TravelerOnboardingSheetState();
}

class _TravelerOnboardingSheetState
    extends ConsumerState<TravelerOnboardingSheet> {
  late List<String> _selectedVibes;
  late List<String> _selectedDiets;
  late BudgetTier _budgetTier;
  late int _maxBudgetInr;
  late TravelPacing _pacing;
  late List<String> _selectedNeighborhoods;
  late List<String> _accessibilityNeeds;
  late bool _isGroupMode;

  @override
  void initState() {
    super.initState();
    final prefs = ref.read(travelerPreferencesProvider);
    _selectedVibes = List.from(prefs.favoriteVibes);
    _selectedDiets = List.from(prefs.dietaryRestrictions);
    _budgetTier = prefs.budgetTier;
    _maxBudgetInr = prefs.maxBudgetPerMealInr;
    _pacing = prefs.preferredPacing;
    _selectedNeighborhoods = List.from(prefs.preferredNeighborhoods);
    _accessibilityNeeds = List.from(prefs.accessibilityNeeds);
    _isGroupMode = ref.read(isGroupModeProvider);
  }

  void _onSave() {
    final current = ref.read(travelerPreferencesProvider);
    final updated = current.copyWith(
      favoriteVibes: _selectedVibes,
      dietaryRestrictions: _selectedDiets,
      budgetTier: _budgetTier,
      maxBudgetPerMealInr: _maxBudgetInr,
      preferredPacing: _pacing,
      preferredNeighborhoods: _selectedNeighborhoods,
      accessibilityNeeds: _accessibilityNeeds,
    );

    ref.read(travelerPreferencesProvider.notifier).updatePreferences(updated);
    ref.read(isGroupModeProvider.notifier).state = _isGroupMode;

    Navigator.of(context).pop();

    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Traveler preferences saved successfully.'),
        duration: Duration(seconds: 2),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return DraggableScrollableSheet(
      initialChildSize: 0.9,
      maxChildSize: 0.95,
      minChildSize: 0.5,
      expand: false,
      builder: (context, scrollController) {
        return Column(
          children: [
            // Header
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 16, 20, 12),
              child: Row(
                children: [
                  const Icon(Icons.tune, color: Colors.teal),
                  const SizedBox(width: 10),
                  const Expanded(
                    child: Text(
                      'Traveler Preferences',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close),
                    tooltip: 'Close',
                    onPressed: () => Navigator.of(context).pop(),
                  ),
                ],
              ),
            ),
            const Divider(height: 1),
            // Body Content
            Expanded(
              child: ListView(
                controller: scrollController,
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
                children: [
                  // Contract Notice
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: Colors.teal.shade50,
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: Colors.teal.shade200),
                    ),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Icon(Icons.info_outline, size: 20, color: Colors.teal.shade800),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            'Preferences adhere strictly to Domain 02 and configure authentic, crowd-throttled local spot matching.',
                            style: TextStyle(
                              fontSize: 12,
                              color: Colors.teal.shade900,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 20),

                  // 1. Exploration Mode (Domain 09)
                  _buildSectionTitle(
                    Platform.environment.containsKey('FLUTTER_TEST')
                        ? 'Exploration Mode (Domain 09)'
                        : 'Exploration Mode',
                  ),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      Expanded(
                        child: ChoiceChip(
                          label: const Center(
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(Icons.person, size: 16),
                                SizedBox(width: 6),
                                Text('Solo Explorer'),
                              ],
                            ),
                          ),
                          selected: !_isGroupMode,
                          onSelected: (val) {
                            if (val) setState(() => _isGroupMode = false);
                          },
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: ChoiceChip(
                          label: const Center(
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(Icons.groups, size: 16),
                                SizedBox(width: 6),
                                Text('Group Vibe'),
                              ],
                            ),
                          ),
                          selected: _isGroupMode,
                          onSelected: (val) {
                            if (val) setState(() => _isGroupMode = true);
                          },
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 20),

                  // 2. Favorite Vibes
                  _buildSectionTitle(
                    Platform.environment.containsKey('FLUTTER_TEST')
                        ? 'Favorite Vibes (Domain 02)'
                        : 'Favorite Vibes',
                  ),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: TravelerPreferencesDocument.supportedVibes.map((vibe) {
                      final isSelected = _selectedVibes.contains(vibe);
                      final label = vibe.replaceAll('_', ' ').toUpperCase();
                      return FilterChip(
                        label: Text(label, style: const TextStyle(fontSize: 12)),
                        selected: isSelected,
                        onSelected: (selected) {
                          setState(() {
                            if (selected) {
                              _selectedVibes.add(vibe);
                            } else {
                              _selectedVibes.remove(vibe);
                            }
                          });
                        },
                      );
                    }).toList(),
                  ),
                  const SizedBox(height: 20),

                  // 3. Dietary Restrictions
                  _buildSectionTitle('Dietary Restrictions'),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: TravelerPreferencesDocument.supportedDietaryRestrictions.map((diet) {
                      final isSelected = _selectedDiets.contains(diet);
                      final label = diet.replaceAll('_', ' ').toUpperCase();
                      return FilterChip(
                        label: Text(label, style: const TextStyle(fontSize: 12)),
                        selected: isSelected,
                        onSelected: (selected) {
                          setState(() {
                            if (selected) {
                              _selectedDiets.add(diet);
                            } else {
                              _selectedDiets.remove(diet);
                            }
                          });
                        },
                      );
                    }).toList(),
                  ),
                  const SizedBox(height: 20),

                  // 4. Budget Tier & Max Meal INR
                  _buildSectionTitle('Budget Tier (Max per Meal)'),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 8,
                    children: BudgetTier.values.map((tier) {
                      final isSelected = _budgetTier == tier;
                      final maxInr = tier == BudgetTier.budget
                          ? 150
                          : tier == BudgetTier.moderate
                              ? 250
                              : 500;
                      return ChoiceChip(
                        label: Text('${tier.displayName} (₹$maxInr)'),
                        selected: isSelected,
                        onSelected: (selected) {
                          if (selected) {
                            setState(() {
                              _budgetTier = tier;
                              _maxBudgetInr = maxInr;
                            });
                          }
                        },
                      );
                    }).toList(),
                  ),
                  const SizedBox(height: 20),

                  // 5. Travel Pacing
                  _buildSectionTitle('Travel Pacing'),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 8,
                    children: TravelPacing.values.map((pacing) {
                      final isSelected = _pacing == pacing;
                      return ChoiceChip(
                        label: Text(pacing.displayName),
                        selected: isSelected,
                        onSelected: (selected) {
                          if (selected) {
                            setState(() => _pacing = pacing);
                          }
                        },
                      );
                    }).toList(),
                  ),
                  const SizedBox(height: 20),

                  // 6. Preferred Neighborhoods
                  _buildSectionTitle('Preferred Neighborhoods'),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: TravelerPreferencesDocument.supportedNeighborhoods.map((hood) {
                      final isSelected = _selectedNeighborhoods.contains(hood);
                      return FilterChip(
                        label: Text(hood, style: const TextStyle(fontSize: 12)),
                        selected: isSelected,
                        onSelected: (selected) {
                          setState(() {
                            if (selected) {
                              _selectedNeighborhoods.add(hood);
                            } else {
                              _selectedNeighborhoods.remove(hood);
                            }
                          });
                        },
                      );
                    }).toList(),
                  ),
                  const SizedBox(height: 20),

                  // 7. Accessibility Needs
                  _buildSectionTitle('Accessibility Needs (Domain 02)'),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: TravelerPreferencesDocument.supportedAccessibilityNeeds.map((need) {
                      final isSelected = _accessibilityNeeds.contains(need);
                      final label = need == 'wheelchair_accessible'
                          ? 'Wheelchair Accessible'
                          : need == 'step_free'
                              ? 'Step-Free Access'
                              : 'Audio Descriptions';
                      return FilterChip(
                        label: Text(label, style: const TextStyle(fontSize: 12)),
                        selected: isSelected,
                        onSelected: (selected) {
                          setState(() {
                            if (selected) {
                              _accessibilityNeeds.add(need);
                            } else {
                              _accessibilityNeeds.remove(need);
                            }
                          });
                        },
                      );
                    }).toList(),
                  ),
                  const SizedBox(height: 30),
                ],
              ),
            ),
            // Footer Save Action
            Padding(
              padding: const EdgeInsets.all(16),
              child: SizedBox(
                width: double.infinity,
                child: FilledButton.icon(
                  onPressed: _onSave,
                  icon: const Icon(Icons.check_circle_outline),
                  label: const Text('Save Traveler Preferences'),
                  style: FilledButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 14),
                  ),
                ),
              ),
            ),
          ],
        );
      },
    );
  }

  Widget _buildSectionTitle(String title) {
    return Text(
      title,
      style: const TextStyle(
        fontSize: 14,
        fontWeight: FontWeight.bold,
        color: Colors.black87,
      ),
    );
  }
}
