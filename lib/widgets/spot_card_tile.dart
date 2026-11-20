import 'package:flutter/material.dart';
import '../models/spot_card.dart';
import '../services/photo_helper.dart';

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

  @override
  Widget build(BuildContext context) {
    final badgeBg = highlightStatusAsWarning
        ? Colors.orange.shade50
        : Colors.teal.shade50;
    final badgeFg = highlightStatusAsWarning
        ? Colors.orange.shade900
        : Colors.teal.shade900;

    return Card(
      clipBehavior: Clip.antiAlias,
      margin: const EdgeInsets.only(bottom: 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (spot.photoUrls.isNotEmpty)
            PhotoHelper.buildPhotoWidget(spot.photoUrls.first, height: 170),
          Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
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
                const SizedBox(height: 8),
                Text(
                  _safeText(spot.infoParagraph, maxLength: 350),
                  maxLines: 4,
                  overflow: TextOverflow.ellipsis,
                ),
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
                if (actions.isNotEmpty) ...[
                  const SizedBox(height: 12),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: actions,
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