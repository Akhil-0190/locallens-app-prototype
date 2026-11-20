// ignore: deprecated_member_use
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';
import '../models/spot_card.dart';
import '../models/traveler_preferences.dart';
import '../providers/spot_providers.dart';
import '../providers/traveler_providers.dart';
import '../widgets/app_async_states.dart';
import '../widgets/spot_card_tile.dart';
import '../widgets/traveler_preference_summary_card.dart';
import '../widgets/vibe_chip_selector.dart';

/// Traveler Discovery Screen (Task D3 & Domain 06/02/09)
///
/// Integrates:
/// - Domain 02: Traveler Onboarding & Preference Profile
/// - Domain 09: Solo vs Group Exploration Mode
/// - Domain 06: Places & Spot Cards with Authenticity Scoring and Crowd Caps
/// - Preserves D1 Uncrowded Route Generation capability
class MatchVibeScreen extends ConsumerStatefulWidget {
  const MatchVibeScreen({super.key});

  @override
  ConsumerState<MatchVibeScreen> createState() => _MatchVibeScreenState();
}

class _MatchVibeScreenState extends ConsumerState<MatchVibeScreen> {
  // 0 = Curated Spot Cards (Domain 06), 1 = 3-Stop Route Builder (D1)
  int _selectedViewIndex = 0;

  static const List<String> _availableVibes = [
    'Street Food',
    'Local Coffee',
    'Local Crafts',
    'Heritage',
    'Quiet Walk',
    'Slow Pace',
  ];

  Future<void> _generateRankedRoute() async {
    ref.read(isGeneratingRouteProvider.notifier).state = true;
    ref.read(hasGeneratedRouteProvider.notifier).state = true;
    ref.read(matchedRouteProvider.notifier).state = [];
    ref.read(crowdedSpotsProvider.notifier).state = [];

    final selectedVibes = ref.read(selectedVibesProvider);
    final groupSize = ref.read(groupSizeProvider);
    final allSpots = await ref.read(spotServiceProvider).getVerifiedSpots();

    final sortedSpots = List<SpotCard>.from(allSpots)
      ..sort((a, b) {
        final scoreA = selectedVibes.isEmpty
            ? 0
            : a.vibeTags.where((tag) => selectedVibes.contains(tag)).length;
        final scoreB = selectedVibes.isEmpty
            ? 0
            : b.vibeTags.where((tag) => selectedVibes.contains(tag)).length;

        if (scoreB != scoreA) {
          return scoreB.compareTo(scoreA);
        }

        final ratioA =
            a.hourlyLimit > 0 ? a.currentVisitors / a.hourlyLimit : 1.0;
        final ratioB =
            b.hourlyLimit > 0 ? b.currentVisitors / b.hourlyLimit : 1.0;
        return ratioA.compareTo(ratioB);
      });

    final uncrowdedValid = <SpotCard>[];
    final crowdedOrTraps = <SpotCard>[];

    for (final spot in sortedSpots) {
      final remainingCapacity = spot.hourlyLimit - spot.currentVisitors;
      if (spot.isTouristTrap || remainingCapacity < groupSize) {
        crowdedOrTraps.add(spot);
      } else {
        uncrowdedValid.add(spot);
      }
    }

    if (!mounted) return;
    ref.read(matchedRouteProvider.notifier).state =
        uncrowdedValid.take(3).toList();
    ref.read(crowdedSpotsProvider.notifier).state = crowdedOrTraps;
    ref.read(isGeneratingRouteProvider.notifier).state = false;
  }

  void _addCrowdedSpotToRoute(SpotCard spot) {
    final currentCrowded = List<SpotCard>.from(ref.read(crowdedSpotsProvider));
    final currentRoute = List<SpotCard>.from(ref.read(matchedRouteProvider));

    currentCrowded.removeWhere((s) => s.id == spot.id);
    currentRoute.add(spot);

    ref.read(crowdedSpotsProvider.notifier).state = currentCrowded;
    ref.read(matchedRouteProvider.notifier).state = currentRoute;

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('${spot.spotName} added to your route.'),
        duration: const Duration(seconds: 2),
      ),
    );
  }

  String _crowdStatusLabel(SpotCard spot) {
    if (spot.isTouristTrap) {
      return 'Tourist Hotspot';
    }
    final slotsLeft = spot.hourlyLimit - spot.currentVisitors;
    if (slotsLeft <= 0) {
      return 'Full (${spot.currentVisitors}/${spot.hourlyLimit})';
    }
    return 'Only $slotsLeft slot(s) left';
  }

  Future<void> _openMapsLink(String url) async {
    final uri = Uri.tryParse(url);
    if (uri == null || url.isEmpty) return;

    final launched = await launchUrl(uri, mode: LaunchMode.externalApplication);
    if (!launched && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Could not open Google Maps link.')),
      );
    }
  }

  void _showGreetingDialog(SpotCard spot) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Row(
          children: [
            const Icon(Icons.record_voice_over, color: Colors.teal),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                'Greeting Card: ${spot.spotName}',
                style: const TextStyle(fontSize: 16),
              ),
            ),
          ],
        ),
        content: Text(
          spot.greetingCard.isNotEmpty
              ? spot.greetingCard
              : 'No greeting message available for this spot.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Close'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final discoveryAsync = ref.watch(discoverySpotsProvider);
    final selectedNeighborhood = ref.watch(selectedNeighborhoodFilterProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Match Your Vibe'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            tooltip: 'Refresh Discovery',
            onPressed: () => ref.refresh(discoverySpotsProvider),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // 1. Prominent Contract & Sample Data Disclosure Banner
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            margin: const EdgeInsets.only(bottom: 12),
            decoration: BoxDecoration(
              color: Colors.amber.shade50,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: Colors.amber.shade400),
            ),
            child: Row(
              children: [
                Icon(Icons.info_outline, size: 18, color: Colors.amber.shade900),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    '[Sample Discovery Data: Illustrative sample results — live integrations pending]',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.bold,
                      color: Colors.amber.shade900,
                    ),
                  ),
                ),
              ],
            ),
          ),

          // 2. Domain 02 Traveler Preference Summary Card
          const TravelerPreferenceSummaryCard(),
          const SizedBox(height: 16),

          // 3. Segmented Navigation (Curated Spots vs Route Builder)
          SegmentedButton<int>(
            segments: const [
              ButtonSegment<int>(
                value: 0,
                icon: Icon(Icons.place_outlined),
                label: Text('Curated Spots'),
              ),
              ButtonSegment<int>(
                value: 1,
                icon: Icon(Icons.route_outlined),
                label: Text('Route Builder'),
              ),
            ],
            selected: {_selectedViewIndex},
            onSelectionChanged: (newSelection) {
              setState(() {
                _selectedViewIndex = newSelection.first;
              });
            },
          ),
          const SizedBox(height: 16),

          // 4. View Mode: Curated Spots (D3 Primary)
          if (_selectedViewIndex == 0) ...[
            // Neighborhood Filter Chips
            const Text(
              'Filter by Neighborhood',
              style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: [
                  ChoiceChip(
                    label: const Text('All Neighborhoods'),
                    selected: selectedNeighborhood == null,
                    onSelected: (selected) {
                      if (selected) {
                        ref.read(selectedNeighborhoodFilterProvider.notifier).state =
                            null;
                      }
                    },
                  ),
                  const SizedBox(width: 8),
                  ...TravelerPreferencesDocument.supportedNeighborhoods.map((hood) {
                    final isSelected = selectedNeighborhood == hood;
                    return Padding(
                      padding: const EdgeInsets.only(right: 8),
                      child: ChoiceChip(
                        label: Text(hood),
                        selected: isSelected,
                        onSelected: (selected) {
                          ref.read(selectedNeighborhoodFilterProvider.notifier).state =
                              selected ? hood : null;
                        },
                      ),
                    );
                  }),
                ],
              ),
            ),
            const SizedBox(height: 16),

            // Async State Display for Discovered Places
            discoveryAsync.when(
              loading: () => const Padding(
                padding: EdgeInsets.symmetric(vertical: 32),
                child: AppLoadingIndicator(
                  message: 'Curating authentic spots matching your taste profile...',
                ),
              ),
              error: (err, stack) => AppErrorStateWidget(
                message: 'Unable to Load Discovery: $err',
                onRetry: () => ref.refresh(discoverySpotsProvider),
              ),
              data: (spots) {
                if (spots.isEmpty) {
                  return AppEmptyStateWidget(
                    title: 'No Matching Spots Found',
                    subtitle:
                        'No local gems currently match this neighborhood and preference filter. Try clearing the filter or adjusting your dietary/budget preferences.',
                    action: OutlinedButton(
                      onPressed: () {
                        ref.read(selectedNeighborhoodFilterProvider.notifier).state =
                            null;
                      },
                      child: const Text('Reset Neighborhood Filter'),
                    ),
                  );
                }

                return Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          '${spots.length} Verified Spot${spots.length > 1 ? 's' : ''} Found',
                          style: const TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.bold,
                            color: Colors.blueGrey,
                          ),
                        ),
                        Text(
                          'Domain 06 Canonical Places',
                          style: TextStyle(
                            fontSize: 11,
                            color: Colors.grey.shade600,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),
                    ...spots.map(
                      (spot) => SpotCardTile(
                        spot: spot,
                        onGreetingTap: () => _showGreetingDialog(spot),
                      ),
                    ),
                  ],
                );
              },
            ),
          ] else ...[
            // 5. View Mode: D1 Route Builder
            const Text(
              'Group Size (Crowd-Cap Check)',
              style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              children: [1, 2, 3, 4].map((count) {
                final currentGroupSize = ref.watch(groupSizeProvider);
                return ChoiceChip(
                  label: Text(count == 1 ? 'Solo (1)' : '$count Travelers'),
                  selected: currentGroupSize == count,
                  onSelected: (_) {
                    ref.read(groupSizeProvider.notifier).state = count;
                  },
                );
              }).toList(),
            ),
            const SizedBox(height: 16),
            const Text(
              'Select Your Interests',
              style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            VibeChipSelector(
              availableVibes: _availableVibes,
              selectedVibes: ref.watch(selectedVibesProvider),
              onVibeToggled: (vibe) {
                final selectedVibes = ref.read(selectedVibesProvider);
                final newVibes = Set<String>.from(selectedVibes);
                if (newVibes.contains(vibe)) {
                  newVibes.remove(vibe);
                } else {
                  newVibes.add(vibe);
                }
                ref.read(selectedVibesProvider.notifier).state = newVibes;
              },
            ),
            const SizedBox(height: 18),
            FilledButton.icon(
              onPressed: ref.watch(isGeneratingRouteProvider)
                  ? null
                  : _generateRankedRoute,
              icon: const Icon(Icons.route),
              label: const Text('Build 3-Stop Uncrowded Route'),
            ),
            const SizedBox(height: 20),
            if (ref.watch(isGeneratingRouteProvider))
              const AppLoadingIndicator(message: 'Generating uncrowded route...')
            else if (ref.watch(hasGeneratedRouteProvider)) ...[
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'Recommended Uncrowded Route',
                    style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
                  ),
                  FilledButton.tonalIcon(
                    onPressed: () => context.push('/route'),
                    icon: const Icon(Icons.map, size: 16),
                    label: const Text('Start Walking Tour'),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              if (ref.watch(matchedRouteProvider).isEmpty)
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 16),
                  child: Text(
                    'No uncrowded spots fit this group size right now. You can still pick from the crowded spots below.',
                  ),
                )
              else
                ...ref.watch(matchedRouteProvider).asMap().entries.map((entry) {
                  final stopIndex = entry.key + 1;
                  final spot = entry.value;
                  final groupSize = ref.watch(groupSizeProvider);
                  final slotsLeft = spot.hourlyLimit - spot.currentVisitors;
                  final isCrowdedChoice =
                      spot.isTouristTrap || slotsLeft < groupSize;

                  return Card(
                    margin: const EdgeInsets.only(bottom: 14),
                    child: Padding(
                      padding: const EdgeInsets.all(14),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              CircleAvatar(
                                radius: 14,
                                backgroundColor: isCrowdedChoice
                                    ? Colors.orange.shade700
                                    : Colors.teal.shade700,
                                child: Text(
                                  '$stopIndex',
                                  style: const TextStyle(
                                    fontSize: 13,
                                    fontWeight: FontWeight.bold,
                                    color: Colors.white,
                                  ),
                                ),
                              ),
                              const SizedBox(width: 10),
                              Expanded(
                                child: Text(
                                  spot.spotName,
                                  maxLines: 2,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(
                                    fontSize: 16,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                              ),
                              const SizedBox(width: 8),
                              Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 8,
                                  vertical: 4,
                                ),
                                decoration: BoxDecoration(
                                  color: isCrowdedChoice
                                      ? Colors.orange.shade50
                                      : Colors.teal.shade50,
                                  borderRadius: BorderRadius.circular(10),
                                ),
                                child: Text(
                                  isCrowdedChoice
                                      ? _crowdStatusLabel(spot)
                                      : '$slotsLeft slots left',
                                  style: TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.w600,
                                    color: isCrowdedChoice
                                        ? Colors.orange.shade900
                                        : Colors.teal.shade900,
                                  ),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 8),
                          Text(
                            spot.infoParagraph,
                            maxLines: 3,
                            overflow: TextOverflow.ellipsis,
                          ),
                          if (spot.greetingCard.isNotEmpty) ...[
                            const SizedBox(height: 8),
                            InkWell(
                              onTap: () => _showGreetingDialog(spot),
                              child: Text(
                                'Greeting: ${spot.greetingCard}',
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(
                                  fontSize: 12,
                                  color: Colors.teal.shade800,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ),
                          ],
                          const SizedBox(height: 10),
                          Wrap(
                            spacing: 8,
                            children: [
                              if (spot.mapsLink.isNotEmpty)
                                TextButton.icon(
                                  onPressed: () => _openMapsLink(spot.mapsLink),
                                  icon: const Icon(Icons.navigation, size: 16),
                                  label: const Text('Maps'),
                                ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  );
                }),
              if (ref.watch(crowdedSpotsProvider).isNotEmpty) ...[
                const SizedBox(height: 16),
                const Text(
                  'Crowded Spots / Traps (Excluded by Default)',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 10),
                ...ref.watch(crowdedSpotsProvider).map((spot) {
                  return Card(
                    color: Colors.grey.shade50,
                    margin: const EdgeInsets.only(bottom: 12),
                    child: Padding(
                      padding: const EdgeInsets.all(12),
                      child: Row(
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  spot.spotName,
                                  style: const TextStyle(fontWeight: FontWeight.bold),
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  _crowdStatusLabel(spot),
                                  style: TextStyle(
                                    fontSize: 12,
                                    color: Colors.orange.shade900,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          OutlinedButton(
                            onPressed: () => _addCrowdedSpotToRoute(spot),
                            child: const Text('Add Anyway'),
                          ),
                        ],
                      ),
                    ),
                  );
                }),
              ],
            ],
          ],
        ],
      ),
    );
  }
}
