// ignore: deprecated_member_use
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_tts/flutter_tts.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';
import '../models/spot_card.dart';
import '../providers/spot_providers.dart';
import '../widgets/app_async_states.dart';
import '../widgets/spot_card_tile.dart';
import '../widgets/tipping_modal_sheet.dart';

class PocketGuideScreen extends ConsumerStatefulWidget {
  const PocketGuideScreen({super.key});

  @override
  ConsumerState<PocketGuideScreen> createState() => _PocketGuideScreenState();
}

class _PocketGuideScreenState extends ConsumerState<PocketGuideScreen> {
  final FlutterTts _tts = FlutterTts();

  @override
  void dispose() {
    _tts.stop();
    super.dispose();
  }

  void _refreshSpots() {
    ref.invalidate(verifiedSpotsProvider);
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
    final spotsAsync = ref.watch(verifiedSpotsProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Street Pocket Guide'),
        actions: [
          IconButton(
            icon: const Icon(Icons.confirmation_number_outlined),
            onPressed: () => context.push('/route-passes'),
            tooltip: 'Route Passes',
          ),
          IconButton(
            icon: const Icon(Icons.person_outline),
            onPressed: () => context.push('/contributor-profile'),
            tooltip: 'Contributor Profile & Earnings',
          ),
          IconButton(
            icon: const Icon(Icons.offline_pin_outlined),
            onPressed: () => context.push('/offline-packs'),
            tooltip: 'Offline Neighborhood Packs',
          ),
          IconButton(
            icon: const Icon(Icons.alt_route),
            onPressed: () => context.push('/route'),
            tooltip: 'Walking Route Tour',
          ),
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _refreshSpots,
            tooltip: 'Refresh Spots',
          ),
        ],
      ),
      body: spotsAsync.when(
        loading: () => const AppLoadingIndicator(
          message: 'Loading verified spots...',
        ),
        error: (error, _) => AppErrorStateWidget(
          message: 'Error loading spots: $error',
          onRetry: _refreshSpots,
        ),
        data: (spots) {
          if (spots.isEmpty) {
            return const AppEmptyStateWidget(
              title: 'No spots available yet',
              subtitle: 'Add a new spot in Add Gem to get started!',
              icon: Icons.place_outlined,
            );
          }

          return ListView.builder(
            padding: const EdgeInsets.all(16),
            itemCount: spots.length,
            itemBuilder: (context, index) {
              final spot = spots[index];
              return SpotCardTile(
                spot: spot,
                statusText: '${spot.currentVisitors}/${spot.hourlyLimit}',
                actions: [
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
                  OutlinedButton.icon(
                    onPressed: () {
                      showModalBottomSheet(
                        context: context,
                        isScrollControlled: true,
                        builder: (ctx) => TippingModalSheet(
                          recipientUserId: spot.contributedBy?.userId ?? 'usr_blr_782914',
                          recipientName: spot.contributedBy?.displayName ?? 'Local Contributor',
                          spotId: spot.id,
                          spotName: spot.spotName,
                        ),
                      );
                    },
                    icon: const Icon(Icons.volunteer_activism_outlined, size: 18),
                    label: const Text('Tip'),
                  ),
                ],
              );
            },
          );
        },
      ),
    );
  }
}
