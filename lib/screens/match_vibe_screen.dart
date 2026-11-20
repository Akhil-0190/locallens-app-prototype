import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../models/spot_card.dart';
import '../services/spot_service.dart';

class MatchVibeScreen extends StatefulWidget {
  const MatchVibeScreen({super.key});

  @override
  State<MatchVibeScreen> createState() => _MatchVibeScreenState();
}

class _MatchVibeScreenState extends State<MatchVibeScreen> {
  final List<String> _availableVibes = const [
    'Street Food',
    'Local Coffee',
    'Local Crafts',
    'Heritage',
    'Quiet Walk',
    'Slow Pace',
  ];

  final Set<String> _selectedVibes = {'Street Food', 'Heritage'};
  int _groupSize = 1;
  List<SpotCard> _matchedRoute = [];
  List<SpotCard> _crowdedOrTrapSpots = [];
  bool _isLoading = false;
  bool _hasGenerated = false;

  Future<void> _generateRankedRoute() async {
    setState(() {
      _isLoading = true;
      _hasGenerated = true;
      _matchedRoute = [];
      _crowdedOrTrapSpots = [];
    });

    final allSpots = await SpotService().getVerifiedSpots();

    final sortedSpots = List<SpotCard>.from(allSpots)
      ..sort((a, b) {
        final scoreA = _selectedVibes.isEmpty
            ? 0
            : a.vibeTags.where((tag) => _selectedVibes.contains(tag)).length;
        final scoreB = _selectedVibes.isEmpty
            ? 0
            : b.vibeTags.where((tag) => _selectedVibes.contains(tag)).length;

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
      if (spot.isTouristTrap || remainingCapacity < _groupSize) {
        crowdedOrTraps.add(spot);
      } else {
        uncrowdedValid.add(spot);
      }
    }

    if (!mounted) return;
    setState(() {
      _matchedRoute = uncrowdedValid.take(3).toList();
      _crowdedOrTrapSpots = crowdedOrTraps;
      _isLoading = false;
    });
  }

  void _addCrowdedSpotToRoute(SpotCard spot) {
    setState(() {
      _crowdedOrTrapSpots.removeWhere((s) => s.id == spot.id);
      _matchedRoute.add(spot);
    });
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
                selected: _groupSize == count,
                onSelected: (_) {
                  setState(() => _groupSize = count);
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
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: _availableVibes.map((vibe) {
              final isSelected = _selectedVibes.contains(vibe);
              return FilterChip(
                label: Text(vibe),
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
          const SizedBox(height: 18),
          FilledButton.icon(
            onPressed: _isLoading ? null : _generateRankedRoute,
            icon: const Icon(Icons.route),
            label: const Text('Build 3-Stop Uncrowded Route'),
          ),
          const SizedBox(height: 20),
          if (_isLoading)
            const Center(child: CircularProgressIndicator())
          else if (_hasGenerated) ...[
            const Text(
              'Recommended Uncrowded Route',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 10),
            if (_matchedRoute.isEmpty)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 16),
                child: Text(
                  'No uncrowded spots fit this group size right now. You can still pick from the crowded spots below.',
                ),
              )
            else
              ..._matchedRoute.asMap().entries.map((entry) {
                final stopIndex = entry.key + 1;
                final spot = entry.value;
                final slotsLeft = spot.hourlyLimit - spot.currentVisitors;
                final isCrowdedChoice =
                    spot.isTouristTrap || slotsLeft < _groupSize;

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
                            final isMatch = _selectedVibes.contains(tag);
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
            if (_crowdedOrTrapSpots.isNotEmpty) ...[
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
              ..._crowdedOrTrapSpots.map((spot) {
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
                            final isMatch = _selectedVibes.contains(tag);
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