import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';
import '../models/spot_card.dart';
import '../providers/spot_providers.dart';
import '../widgets/app_async_states.dart';
import '../widgets/vibe_chip_selector.dart';

class MatchVibeScreen extends ConsumerStatefulWidget {
  const MatchVibeScreen({super.key});

  @override
  ConsumerState<MatchVibeScreen> createState() => _MatchVibeScreenState();
}

class _MatchVibeScreenState extends ConsumerState<MatchVibeScreen> {
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
    if (uri == null) return;

    final launched = await launchUrl(uri, mode: LaunchMode.externalApplication);
    if (!launched && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Could not open Google Maps link.')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final selectedVibes = ref.watch(selectedVibesProvider);
    final groupSize = ref.watch(groupSizeProvider);
    final matchedRoute = ref.watch(matchedRouteProvider);
    final crowdedOrTrapSpots = ref.watch(crowdedSpotsProvider);
    final isLoading = ref.watch(isGeneratingRouteProvider);
    final hasGenerated = ref.watch(hasGeneratedRouteProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Match Your Vibe')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          const Text(
            'Group Size (Crowd-Cap Check)',
            style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            children: [1, 2, 3, 4].map((count) {
              return ChoiceChip(
                label: Text(count == 1 ? 'Solo (1)' : '$count Travelers'),
                selected: groupSize == count,
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
            selectedVibes: selectedVibes,
            onVibeToggled: (vibe) {
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
            onPressed: isLoading ? null : _generateRankedRoute,
            icon: const Icon(Icons.route),
            label: const Text('Build 3-Stop Uncrowded Route'),
          ),
          const SizedBox(height: 20),
          if (isLoading)
            const AppLoadingIndicator(message: 'Generating uncrowded route...')
          else if (hasGenerated) ...[
            const Text(
              'Recommended Uncrowded Route',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 10),
            if (matchedRoute.isEmpty)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 16),
                child: Text(
                  'No uncrowded spots fit this group size right now. You can still pick from the crowded spots below.',
                ),
              )
            else
              ...matchedRoute.asMap().entries.map((entry) {
                final stopIndex = entry.key + 1;
                final spot = entry.value;
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
                        const SizedBox(height: 10),
                        Wrap(
                          spacing: 6,
                          runSpacing: 6,
                          children: spot.vibeTags.map((tag) {
                            final isMatch = selectedVibes.contains(tag);
                            return Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 8,
                                vertical: 3,
                              ),
                              decoration: BoxDecoration(
                                color: isMatch
                                    ? Colors.teal.shade100
                                    : Colors.grey.shade200,
                                borderRadius: BorderRadius.circular(10),
                              ),
                              child: Text(
                                tag,
                                style: TextStyle(
                                  fontSize: 11,
                                  fontWeight: isMatch
                                      ? FontWeight.w600
                                      : FontWeight.normal,
                                  color: isMatch
                                      ? Colors.teal.shade900
                                      : Colors.black87,
                                ),
                              ),
                            );
                          }).toList(),
                        ),
                        const SizedBox(height: 10),
                        Align(
                          alignment: Alignment.centerRight,
                          child: TextButton.icon(
                            onPressed: () => _openMapsLink(spot.mapsLink),
                            icon: const Icon(Icons.directions, size: 18),
                            label: const Text('Preview in Maps'),
                          ),
                        ),
                      ],
                    ),
                  ),
                );
              }),
            if (crowdedOrTrapSpots.isNotEmpty) ...[
              const SizedBox(height: 12),
              const Divider(),
              const SizedBox(height: 8),
              Row(
                children: [
                  Icon(
                    Icons.groups_outlined,
                    size: 20,
                    color: Colors.orange.shade900,
                  ),
                  const SizedBox(width: 8),
                  const Expanded(
                    child: Text(
                      'Crowded & High-Footfall Areas',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 4),
              Text(
                'These spots exceed your group capacity or draw heavy tourist crowds. Tap "Add to Route" if you still want to include them.',
                style: TextStyle(
                  fontSize: 12,
                  color: Colors.grey.shade700,
                ),
              ),
              const SizedBox(height: 12),
              ...crowdedOrTrapSpots.map((spot) {
                return Card(
                  color: Colors.orange.shade50.withAlpha(90),
                  margin: const EdgeInsets.only(bottom: 12),
                  child: Padding(
                    padding: const EdgeInsets.all(14),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Expanded(
                              child: Text(
                                spot.spotName,
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(
                                  fontSize: 15,
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
                                color: Colors.orange.shade100,
                                borderRadius: BorderRadius.circular(10),
                              ),
                              child: Text(
                                _crowdStatusLabel(spot),
                                style: TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w600,
                                  color: Colors.orange.shade900,
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 6),
                        Text(
                          spot.infoParagraph,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(fontSize: 13),
                        ),
                        const SizedBox(height: 8),
                        Wrap(
                          spacing: 6,
                          runSpacing: 6,
                          children: spot.vibeTags.map((tag) {
                            final isMatch = selectedVibes.contains(tag);
                            return Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 8,
                                vertical: 3,
                              ),
                              decoration: BoxDecoration(
                                color: isMatch
                                    ? Colors.orange.shade200
                                    : Colors.grey.shade200,
                                borderRadius: BorderRadius.circular(10),
                              ),
                              child: Text(
                                tag,
                                style: TextStyle(
                                  fontSize: 11,
                                  fontWeight: isMatch
                                      ? FontWeight.w600
                                      : FontWeight.normal,
                                  color: Colors.black87,
                                ),
                              ),
                            );
                          }).toList(),
                        ),
                        const SizedBox(height: 10),
                        Wrap(
                          spacing: 8,
                          runSpacing: 8,
                          alignment: WrapAlignment.end,
                          children: [
                            OutlinedButton.icon(
                              onPressed: () => _addCrowdedSpotToRoute(spot),
                              icon: const Icon(Icons.add, size: 18),
                              label: const Text('Add to Route'),
                            ),
                            TextButton.icon(
                              onPressed: () => _openMapsLink(spot.mapsLink),
                              icon: const Icon(Icons.directions, size: 18),
                              label: const Text('Preview in Maps'),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                );
              }),
            ],
          ],
        ],
      ),
    );
  }
}
