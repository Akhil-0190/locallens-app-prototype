import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../models/spot_card.dart';
import '../services/photo_helper.dart';

/// Reusable Spot Card conforming to Domain 06 (`docs/contracts/06-places-and-spot-cards.md`).
/// Displays authenticity scoring, crowd & capacity throttling, contributor attribution,
/// address, recommended timing, and interactive greeting cards.
class SpotCardTile extends StatelessWidget {
  final SpotCard spot;
  final Widget? leadingBadge;
  final String? statusText;
  final bool highlightStatusAsWarning;
  final Set<String> highlightedVibes;
  final List<Widget> actions;
  final VoidCallback? onGreetingTap;

  const SpotCardTile({
    super.key,
    required this.spot,
    this.leadingBadge,
    this.statusText,
    this.highlightStatusAsWarning = false,
    this.highlightedVibes = const {},
    this.actions = const [],
    this.onGreetingTap,
  });

  String _safeText(String input, {int maxLength = 300}) {
    final trimmed = input.trim();
    if (trimmed.length <= maxLength) return trimmed;
    return '${trimmed.substring(0, maxLength)}...';
  }

  Future<void> _launchMaps(BuildContext context, String url) async {
    final uri = Uri.tryParse(url);
    if (uri == null || url.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('No Google Maps link provided for this spot.')),
      );
      return;
    }
    final launched = await launchUrl(uri, mode: LaunchMode.externalApplication);
    if (!launched && context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Could not open Google Maps link.')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final isTrap = spot.isTouristTrap ||
        spot.touristTrapLikelihood == 'HIGH' ||
        spot.touristTrapLikelihood == 'SEVERE';

    final badgeBg = highlightStatusAsWarning || isTrap
        ? Colors.orange.shade50
        : Colors.teal.shade50;
    final badgeFg = highlightStatusAsWarning || isTrap
        ? Colors.orange.shade900
        : Colors.teal.shade900;

    return Card(
      clipBehavior: Clip.antiAlias,
      margin: const EdgeInsets.only(bottom: 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // 1. Photo with fallback
          if (spot.photoUrls.isNotEmpty)
            PhotoHelper.buildPhotoWidget(spot.photoUrls.first, height: 170)
          else
            Container(
              height: 120,
              width: double.infinity,
              color: Colors.grey.shade200,
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.photo_outlined, size: 36, color: Colors.grey.shade400),
                  const SizedBox(height: 6),
                  Text(
                    'No street photo attached yet',
                    style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
                  ),
                ],
              ),
            ),

          Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // 2. Header: Leading Badge, Name, Status Badge
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (leadingBadge != null) ...[
                      leadingBadge!,
                      const SizedBox(width: 10),
                    ],
                    Expanded(
                      child: Text(
                        _safeText(spot.spotName, maxLength: 80),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                    if (statusText != null) ...[
                      const SizedBox(width: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 8,
                          vertical: 4,
                        ),
                        decoration: BoxDecoration(
                          color: badgeBg,
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Text(
                          statusText!,
                          maxLines: 1,
                          softWrap: false,
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            color: badgeFg,
                          ),
                        ),
                      ),
                    ],
                  ],
                ),

                // 3. Address and Primary Category
                if (spot.formattedAddress.isNotEmpty) ...[
                  const SizedBox(height: 6),
                  Row(
                    children: [
                      Icon(Icons.location_on, size: 14, color: Colors.grey.shade600),
                      const SizedBox(width: 4),
                      Expanded(
                        child: Text(
                          spot.formattedAddress,
                          style: TextStyle(
                            fontSize: 12,
                            color: Colors.grey.shade700,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
                ],

                // 4. Domain 06 Authenticity & Crowd Badges Row
                const SizedBox(height: 8),
                Wrap(
                  spacing: 6,
                  runSpacing: 6,
                  children: [
                    // Authenticity Score
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: isTrap ? Colors.red.shade50 : Colors.teal.shade50,
                        borderRadius: BorderRadius.circular(6),
                        border: Border.all(
                          color: isTrap ? Colors.red.shade200 : Colors.teal.shade200,
                        ),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(
                            isTrap ? Icons.warning_amber_rounded : Icons.verified_user,
                            size: 13,
                            color: isTrap ? Colors.red.shade800 : Colors.teal.shade800,
                          ),
                          const SizedBox(width: 4),
                          Text(
                            isTrap
                                ? 'Tourist Trap Warning (${spot.touristTrapLikelihood})'
                                : '${spot.authenticityScore}% Authentic Local Spot',
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.bold,
                              color: isTrap ? Colors.red.shade900 : Colors.teal.shade900,
                            ),
                          ),
                        ],
                      ),
                    ),
                    // Crowd & Capacity Level
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: spot.isThrottled
                            ? Colors.red.shade50
                            : Colors.blueGrey.shade50,
                        borderRadius: BorderRadius.circular(6),
                        border: Border.all(
                          color: spot.isThrottled
                              ? Colors.red.shade200
                              : Colors.blueGrey.shade200,
                        ),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(
                            Icons.people,
                            size: 13,
                            color: spot.isThrottled
                                ? Colors.red.shade800
                                : Colors.blueGrey.shade800,
                          ),
                          const SizedBox(width: 4),
                          Text(
                            spot.isThrottled
                                ? 'Crowd-Throttled (${spot.currentVisitors}/${spot.hourlyLimit})'
                                : '${spot.crowdLevel} Crowd (${spot.currentVisitors}/${spot.hourlyLimit} visitors)',
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w600,
                              color: spot.isThrottled
                                  ? Colors.red.shade900
                                  : Colors.blueGrey.shade900,
                            ),
                          ),
                        ],
                      ),
                    ),
                    // Sample Data Badge
                    if (spot.isMockData)
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: Colors.amber.shade50,
                          borderRadius: BorderRadius.circular(6),
                          border: Border.all(color: Colors.amber.shade300),
                        ),
                        child: Text(
                          'Sample Data (Domain 06)',
                          style: TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.w600,
                            color: Colors.amber.shade900,
                          ),
                        ),
                      ),
                  ],
                ),

                // 5. Local Resident's Story / Info
                const SizedBox(height: 10),
                Text(
                  _safeText(spot.infoParagraph, maxLength: 350),
                  maxLines: 4,
                  overflow: TextOverflow.ellipsis,
                ),

                // 6. Practical Tips
                if (spot.practicalTips.isNotEmpty) ...[
                  const SizedBox(height: 8),
                  Text(
                    'Tip: ${_safeText(spot.practicalTips, maxLength: 150)}',
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 13,
                      color: Colors.teal.shade800,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ],

                // 7. Recommended Timing
                if (spot.recommendedTiming.isNotEmpty) ...[
                  const SizedBox(height: 6),
                  Row(
                    children: [
                      Icon(Icons.schedule, size: 14, color: Colors.blueGrey.shade600),
                      const SizedBox(width: 4),
                      Expanded(
                        child: Text(
                          'Best timing: ${_safeText(spot.recommendedTiming, maxLength: 100)}',
                          style: TextStyle(
                            fontSize: 12,
                            color: Colors.blueGrey.shade700,
                            fontStyle: FontStyle.italic,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
                ],

                // 8. Greeting Card
                if (spot.greetingCard.isNotEmpty) ...[
                  const SizedBox(height: 10),
                  InkWell(
                    onTap: onGreetingTap,
                    borderRadius: BorderRadius.circular(8),
                    child: Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: Colors.teal.shade50,
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Row(
                        children: [
                          Icon(
                            Icons.translate,
                            size: 18,
                            color: Colors.teal.shade800,
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              _safeText(spot.greetingCard, maxLength: 150),
                              maxLines: 3,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w600,
                                color: Colors.teal.shade900,
                              ),
                            ),
                          ),
                          if (onGreetingTap != null) ...[
                            const SizedBox(width: 6),
                            Icon(
                              Icons.open_in_full,
                              size: 15,
                              color: Colors.teal.shade700,
                            ),
                          ],
                        ],
                      ),
                    ),
                  ),
                ],

                // 9. Vibe Tags
                if (spot.vibeTags.isNotEmpty) ...[
                  const SizedBox(height: 10),
                  Wrap(
                    spacing: 6,
                    runSpacing: 6,
                    children: spot.vibeTags.map((tag) {
                      final isMatch = highlightedVibes.contains(tag);
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
                          _safeText(tag, maxLength: 30),
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight:
                                isMatch ? FontWeight.w600 : FontWeight.normal,
                            color: isMatch ? Colors.teal.shade900 : Colors.black87,
                          ),
                        ),
                      );
                    }).toList(),
                  ),
                ],

                // 10. Contributor Attribution
                if (spot.contributedBy != null) ...[
                  const SizedBox(height: 10),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                    decoration: BoxDecoration(
                      color: Colors.teal.shade50.withValues(alpha: 0.7),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: Colors.teal.shade100),
                    ),
                    child: Row(
                      children: [
                        CircleAvatar(
                          radius: 11,
                          backgroundColor: Colors.teal.shade200,
                          child: Icon(Icons.person, size: 13, color: Colors.teal.shade900),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            'Discovered by ${spot.contributedBy!.displayName}',
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                              color: Colors.teal.shade900,
                            ),
                          ),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: Colors.amber.shade100,
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Text(
                            spot.contributedBy!.badgeTitle,
                            style: TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.bold,
                              color: Colors.amber.shade900,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],

                // 11. Actions & Google Maps Link
                const SizedBox(height: 12),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    if (spot.mapsLink.isNotEmpty)
                      OutlinedButton.icon(
                        onPressed: () => _launchMaps(context, spot.mapsLink),
                        icon: const Icon(Icons.map, size: 14),
                        label: const Text('Open Maps', style: TextStyle(fontSize: 12)),
                        style: OutlinedButton.styleFrom(
                          visualDensity: VisualDensity.compact,
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                        ),
                      )
                    else
                      const SizedBox.shrink(),
                    if (actions.isNotEmpty)
                      Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: actions,
                      ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
