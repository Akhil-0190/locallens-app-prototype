import 'package:flutter/material.dart';
import 'package:flutter_tts/flutter_tts.dart';
import 'package:url_launcher/url_launcher.dart';
import '../models/spot_card.dart';
import '../services/photo_helper.dart';
import '../services/spot_service.dart';

class PocketGuideScreen extends StatefulWidget {
  const PocketGuideScreen({super.key});

  @override
  State<PocketGuideScreen> createState() => _PocketGuideScreenState();
}

class _PocketGuideScreenState extends State<PocketGuideScreen> {
  late Future<List<SpotCard>> _spotsFuture;
  final FlutterTts _tts = FlutterTts();

  @override
  void initState() {
    super.initState();
    _spotsFuture = SpotService().getVerifiedSpots();
  }

  @override
  void dispose() {
    _tts.stop();
    super.dispose();
  }

  void _refreshSpots() {
    setState(() {
      _spotsFuture = SpotService().getVerifiedSpots();
    });
  }

  String _safeText(String input, {int maxLength = 300}) {
    final trimmed = input.trim();
    if (trimmed.length <= maxLength) return trimmed;
    return '${trimmed.substring(0, maxLength)}...';
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

  Future<void> _playAudioCue(SpotCard spot) async {
    await _tts.stop();
    final cueText =
        '${_safeText(spot.spotName, maxLength: 80)}. ${_safeText(spot.infoParagraph, maxLength: 250)} ${_safeText(spot.practicalTips, maxLength: 150)}';
    await _tts.speak(cueText);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Street Pocket Guide'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _refreshSpots,
            tooltip: 'Refresh Spots',
          ),
        ],
      ),
      body: FutureBuilder<List<SpotCard>>(
        future: _spotsFuture,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snapshot.hasError) {
            return Center(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Text('Error loading spots: ${snapshot.error}'),
              ),
            );
          }

          final spots = snapshot.data ?? [];
          if (spots.isEmpty) {
            return const Center(
              child: Text('No spots available yet. Add one in Add Gem!'),
            );
          }

          return ListView.builder(
            padding: const EdgeInsets.all(16),
            itemCount: spots.length,
            itemBuilder: (context, index) {
              final spot = spots[index];
              return Card(
                clipBehavior: Clip.antiAlias,
                margin: const EdgeInsets.only(bottom: 16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (spot.photoUrls.isNotEmpty)
                      PhotoHelper.buildPhotoWidget(
                        spot.photoUrls.first,
                        height: 170,
                      ),
                    Padding(
                      padding: const EdgeInsets.all(14),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Expanded(
                                child: Text(
                                  _safeText(spot.spotName, maxLength: 80),
                                  maxLines: 2,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(
                                    fontSize: 17,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                              ),
                              const SizedBox(width: 8),
                              Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 10,
                                  vertical: 4,
                                ),
                                decoration: BoxDecoration(
                                  color: Colors.teal.shade50,
                                  borderRadius: BorderRadius.circular(12),
                                  border: Border.all(
                                    color: Colors.teal.shade200,
                                  ),
                                ),
                                child: Text(
                                  '${spot.currentVisitors}/${spot.hourlyLimit}',
                                  maxLines: 1,
                                  softWrap: false,
                                  style: TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.w600,
                                    color: Colors.teal.shade900,
                                  ),
                                ),
                              ),
                            ],
                          ),
                          if (spot.openHours.isNotEmpty) ...[
                            const SizedBox(height: 6),
                            Row(
                              children: [
                                const Icon(
                                  Icons.access_time,
                                  size: 15,
                                  color: Colors.grey,
                                ),
                                const SizedBox(width: 6),
                                Expanded(
                                  child: Text(
                                    _safeText(spot.openHours, maxLength: 60),
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: TextStyle(
                                      fontSize: 13,
                                      color: Colors.grey.shade700,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ],
                          const SizedBox(height: 8),
                          Text(
                            _safeText(spot.infoParagraph, maxLength: 350),
                            maxLines: 5,
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
                            Container(
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
                                      _safeText(
                                        spot.greetingCard,
                                        maxLength: 150,
                                      ),
                                      maxLines: 3,
                                      overflow: TextOverflow.ellipsis,
                                      style: TextStyle(
                                        fontSize: 13,
                                        fontWeight: FontWeight.w600,
                                        color: Colors.teal.shade900,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                          if (spot.vibeTags.isNotEmpty) ...[
                            const SizedBox(height: 10),
                            Wrap(
                              spacing: 6,
                              runSpacing: 6,
                              children: spot.vibeTags
                                  .map(
                                    (tag) => Container(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 10,
                                    vertical: 4,
                                  ),
                                  decoration: BoxDecoration(
                                    color: Colors.grey.shade200,
                                    borderRadius: BorderRadius.circular(12),
                                  ),
                                  child: Text(
                                    _safeText(tag, maxLength: 30),
                                    style: const TextStyle(fontSize: 12),
                                  ),
                                ),
                              )
                                  .toList(),
                            ),
                          ],
                          const SizedBox(height: 12),
                          Wrap(
                            spacing: 8,
                            runSpacing: 8,
                            children: [
                              FilledButton.icon(
                                onPressed: () => _openMapsLink(spot.mapsLink),
                                icon: const Icon(Icons.directions, size: 18),
                                label: const Text('Open in Maps'),
                              ),
                              OutlinedButton.icon(
                                onPressed: () => _playAudioCue(spot),
                                icon: const Icon(Icons.headphones, size: 18),
                                label: const Text('Audio Cue'),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              );
            },
          );
        },
      ),
    );
  }
}