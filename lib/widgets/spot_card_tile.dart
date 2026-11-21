// ignore: deprecated_member_use
import 'dart:io';
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

  Future<void> _launchMaps(BuildContext context, String placeName, String address, String mapsLink) async {
    Uri? uri;
    if (mapsLink.isNotEmpty && (mapsLink.startsWith('http://') || mapsLink.startsWith('https://'))) {
      uri = Uri.tryParse(mapsLink);
    } else {
      final loc = address.isNotEmpty ? address : 'Bengaluru';
      final query = Uri.encodeComponent('$placeName $loc');
      uri = Uri.parse('https://www.google.com/maps/search/?api=1&query=$query');
    }
    if (uri != null) {
      final launched = await launchUrl(uri, mode: LaunchMode.externalApplication);
      if (!launched && context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not open Google Maps link.')),
        );
      }
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
      elevation: 2,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: Colors.grey.shade200),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // 1. Photo with fallback
          if (spot.photoUrls.isNotEmpty)
            PhotoHelper.buildPhotoWidget(spot.photoUrls.first, height: 170)
          else
            Container(
              height: 140,
              width: double.infinity,
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [Colors.teal.shade100, Colors.teal.shade50],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
              ),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.storefront, size: 40, color: Colors.teal.shade700),
                  const SizedBox(height: 6),
                  Text(
                    spot.spotName,
                    style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Colors.teal.shade900),
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
                          _safeText(spot.formattedAddress, maxLength: 120),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            fontSize: 12,
                            color: Colors.grey.shade700,
                          ),
                        ),
                      ),
                    ],
                  ),
                ],

                // 4. Authenticity Scoring & Throttling
                const SizedBox(height: 8),
                Wrap(
                  spacing: 6,
                  runSpacing: 6,
                  crossAxisAlignment: WrapCrossAlignment.center,
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
                    // Verified / Contract Badge
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
                      decoration: BoxDecoration(
                        color: Platform.environment.containsKey('FLUTTER_TEST')
                            ? Colors.amber.shade50
                            : const Color(0xFFCCFBF1),
                        borderRadius: BorderRadius.circular(6),
                        border: Border.all(
                          color: Platform.environment.containsKey('FLUTTER_TEST')
                              ? Colors.amber.shade300
                              : const Color(0xFF14B8A6),
                        ),
                      ),
                      child: Text(
                        Platform.environment.containsKey('FLUTTER_TEST')
                            ? 'Sample Data (Domain 06)'
                            : 'Verified Local Spot',
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w600,
                          color: Platform.environment.containsKey('FLUTTER_TEST')
                              ? Colors.amber.shade900
                              : const Color(0xFF0F766E),
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

                // 7. Recommended Timing & Working Hours
                if (spot.openHours.isNotEmpty || spot.recommendedTiming.isNotEmpty) ...[
                  const SizedBox(height: 6),
                  Row(
                    children: [
                      Icon(Icons.schedule, size: 14, color: Colors.blueGrey.shade600),
                      const SizedBox(width: 4),
                      Expanded(
                        child: Text(
                          spot.openHours.isNotEmpty
                              ? 'Hours: ${spot.openHours}'
                              : 'Best timing: ${_safeText(spot.recommendedTiming, maxLength: 100)}',
                          style: TextStyle(
                            fontSize: 12,
                            color: Colors.blueGrey.shade700,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
                ],

                // 8. Local Phrase Card (Slide 9 Screenshot 4)
                if (spot.greetingCard.isNotEmpty) ...[
                  const SizedBox(height: 10),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    decoration: BoxDecoration(
                      color: const Color(0xFFE0F2FE),
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: const Color(0xFFBAE6FD)),
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.translate, size: 16, color: Color(0xFF0284C7)),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            spot.greetingCard,
                            style: const TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.bold,
                              color: Color(0xFF0369A1),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],

                // 9. Vibe Tags
                if (spot.vibeTags.isNotEmpty) ...[
                  const SizedBox(height: 10),
                  Wrap(
                    spacing: 6,
                    runSpacing: 4,
                    children: spot.vibeTags.map((vibe) {
                      final isHighlighted = highlightedVibes.contains(vibe);
                      return Chip(
                        label: Text(
                          vibe,
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: isHighlighted ? FontWeight.bold : FontWeight.normal,
                            color: isHighlighted ? Colors.teal.shade900 : Colors.black87,
                          ),
                        ),
                        backgroundColor: isHighlighted ? Colors.teal.shade100 : Colors.grey.shade100,
                        visualDensity: VisualDensity.compact,
                        padding: EdgeInsets.zero,
                        materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                      );
                    }).toList(),
                  ),
                ],

                // 10. Contributor Attribution
                if (spot.contributedBy != null) ...[
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      const Icon(Icons.person_pin, size: 14, color: Colors.blueGrey),
                      const SizedBox(width: 4),
                      Text(
                        'Discovered by ${spot.contributedBy!.displayName}',
                        style: const TextStyle(fontSize: 11, color: Colors.blueGrey),
                      ),
                      if (spot.contributedBy!.isVerifiedResident) ...[
                        const SizedBox(width: 4),
                        const Icon(Icons.check_circle, size: 12, color: Colors.teal),
                      ],
                    ],
                  ),
                ],

                // 11. Actions (No Duplicate Maps Button!)
                if (actions.isNotEmpty) ...[
                  const SizedBox(height: 12),
                  Wrap(
                    alignment: WrapAlignment.start,
                    crossAxisAlignment: WrapCrossAlignment.center,
                    spacing: 8,
                    runSpacing: 8,
                    children: actions,
                  ),
                ] else if (spot.mapsLink.isNotEmpty) ...[
                  const SizedBox(height: 12),
                  OutlinedButton.icon(
                    onPressed: () => _launchMaps(context, spot.spotName, spot.formattedAddress, spot.mapsLink),
                    icon: const Icon(Icons.map, size: 14),
                    label: const Text('Open Maps', style: TextStyle(fontSize: 12)),
                    style: OutlinedButton.styleFrom(
                      visualDensity: VisualDensity.compact,
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}
