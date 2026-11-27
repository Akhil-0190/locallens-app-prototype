// ignore: deprecated_member_use
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_tts/flutter_tts.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';
import '../models/spot_card.dart';
import '../models/traveler_preferences.dart';
import '../providers/route_providers.dart';
import '../providers/spot_providers.dart';
import '../services/street_assistance_service.dart';
import '../widgets/app_async_states.dart';
import '../widgets/live_voice_translator_sheet.dart';
import '../widgets/spot_card_tile.dart';
import '../widgets/tipping_modal_sheet.dart';

class PocketGuideScreen extends ConsumerStatefulWidget {
  const PocketGuideScreen({super.key});

  @override
  ConsumerState<PocketGuideScreen> createState() => _PocketGuideScreenState();
}

class _PocketGuideScreenState extends ConsumerState<PocketGuideScreen> {
  final FlutterTts _tts = FlutterTts();
  String? _playingSpotId;
  String _selectedNeighborhood = 'All';
  String _selectedVibe = 'All';
  final TextEditingController _customLocationController = TextEditingController();
  final Map<String, SpotCard> _planBSwaps = {};
  final Map<String, String> _planBReasons = {};

  @override
  void initState() {
    super.initState();
    _tts.setCompletionHandler(() {
      if (mounted) setState(() => _playingSpotId = null);
    });
    _tts.setCancelHandler(() {
      if (mounted) setState(() => _playingSpotId = null);
    });
  }

  @override
  void dispose() {
    _tts.stop();
    _customLocationController.dispose();
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

  Future<void> _openInMaps(SpotCard spot) async {
    final neighborhoodStr = _selectedNeighborhood != 'All'
        ? _selectedNeighborhood
        : (spot.formattedAddress.isNotEmpty ? spot.formattedAddress : 'Bengaluru');
    final query = Uri.encodeComponent('${spot.spotName} $neighborhoodStr');
    final uri = Uri.parse('https://www.google.com/maps/search/?api=1&query=$query');
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  void _openLiveVoiceTranslator({SpotCard? spot}) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => LiveVoiceTranslatorSheet(
        neighborhood: _selectedNeighborhood != 'All'
            ? _selectedNeighborhood
            : (spot?.formattedAddress.isNotEmpty == true
                ? spot!.formattedAddress
                : 'Malleshwaram'),
        spotId: spot?.id,
        spotName: spot?.spotName,
      ),
    );
  }

  void _showLocalPhraseDialog(SpotCard spot) {
    final neighborhood = _selectedNeighborhood != 'All'
        ? _selectedNeighborhood
        : (spot.formattedAddress.isNotEmpty ? spot.formattedAddress : 'Malleshwaram');
    showDialog(
      context: context,
      builder: (ctx) => _DynamicOrderCardDialog(
        spot: spot,
        neighborhood: neighborhood,
        assistanceService: ref.read(streetAssistanceServiceProvider),
        onOpenLiveVoice: () {
          Navigator.pop(ctx);
          _openLiveVoiceTranslator(spot: spot);
        },
      ),
    );
  }

  Future<void> _handlePlanB(SpotCard spot, List<SpotCard> allSpots) async {
    // Select a real, uncrowded verified alternative spot (preferring overlapping vibe tags)
    final excludedIds = <String>{
      spot.id,
      ..._planBSwaps.values.map((s) => s.id),
    };
    final candidates = allSpots
        .where((s) => !excludedIds.contains(s.id))
        .toList()
      ..sort((a, b) {
        final aRatio = a.hourlyLimit > 0 ? a.currentVisitors / a.hourlyLimit : 1.0;
        final bRatio = b.hourlyLimit > 0 ? b.currentVisitors / b.hourlyLimit : 1.0;
        final aVibeOverlap =
            a.vibeTags.where((t) => spot.vibeTags.contains(t)).length;
        final bVibeOverlap =
            b.vibeTags.where((t) => spot.vibeTags.contains(t)).length;
        final aScore = (1.0 - aRatio) + aVibeOverlap * 0.25;
        final bScore = (1.0 - bRatio) + bVibeOverlap * 0.25;
        return bScore.compareTo(aScore);
      });

    if (candidates.isEmpty) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'No quieter verified alternative is currently available for ${spot.spotName}.',
          ),
          backgroundColor: Colors.orange.shade800,
          behavior: SnackBarBehavior.floating,
        ),
      );
      return;
    }

    final replacement = candidates.first;
    final originalKey = _planBSwaps.entries
        .firstWhere(
          (e) => e.value.id == spot.id,
          orElse: () => MapEntry(spot.id, spot),
        )
        .key;

    setState(() {
      _planBSwaps[originalKey] = replacement;
      _planBReasons[originalKey] =
          'Plan-B swapped from ${spot.spotName} (${spot.currentVisitors}/${spot.hourlyLimit}) → '
          '${replacement.spotName} (${replacement.currentVisitors}/${replacement.hourlyLimit})';
    });

    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Row(
          children: [
            const Icon(Icons.alt_route, color: Colors.white, size: 18),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                'Plan B Applied: Replaced ${spot.spotName} with quieter ${replacement.spotName} (${replacement.currentVisitors}/${replacement.hourlyLimit}).',
                style: const TextStyle(fontSize: 12),
              ),
            ),
          ],
        ),
        action: SnackBarAction(
          label: 'Undo',
          textColor: Colors.amber.shade200,
          onPressed: () {
            if (mounted) {
              setState(() {
                _planBSwaps.remove(originalKey);
                _planBReasons.remove(originalKey);
              });
            }
          },
        ),
        backgroundColor: const Color(0xFF0F766E),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  Future<void> _toggleAudioCue(SpotCard spot) async {
    if (_playingSpotId == spot.id) {
      await _tts.stop();
      if (mounted) setState(() => _playingSpotId = null);
      return;
    }
    await _tts.stop();
    setState(() => _playingSpotId = spot.id);
    final cueText =
        '${_safeText(spot.spotName, maxLength: 80)}. ${_safeText(spot.infoParagraph, maxLength: 250)} ${_safeText(spot.practicalTips, maxLength: 150)}';
    await _tts.speak(cueText);
  }

  List<SpotCard> _filterSpots(List<SpotCard> spots) {
    return spots.where((spot) {
      // Neighborhood check
      if (_selectedNeighborhood != 'All') {
        final hood = _selectedNeighborhood.toLowerCase();
        final matchesHood = spot.mapsLink.toLowerCase().contains(hood) ||
            spot.infoParagraph.toLowerCase().contains(hood) ||
            spot.spotName.toLowerCase().contains(hood);
        if (!matchesHood) return false;
      }
      // Vibe check
      if (_selectedVibe != 'All') {
        if (!spot.vibeTags.any((t) => t.toLowerCase().contains(_selectedVibe.toLowerCase()))) {
          return false;
        }
      }
      return true;
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    final spotsAsync = ref.watch(verifiedSpotsProvider);
    final groupSize = ref.watch(groupSizeProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Street Pocket Guide'),
        actions: [
          IconButton(
            icon: const Icon(Icons.interpreter_mode),
            onPressed: () => _openLiveVoiceTranslator(),
            tooltip: 'Live Voice Translator (Gemini 3.8 Live)',
          ),
          IconButton(
            icon: const Icon(Icons.alt_route),
            onPressed: () => context.push('/route'),
            tooltip: 'Walking Route Tour',
          ),
          IconButton(
            icon: const Icon(Icons.offline_pin_outlined),
            onPressed: () => context.push('/offline-packs'),
            tooltip: 'Offline Neighborhood Packs',
          ),
          IconButton(
            icon: const Icon(Icons.person_outline),
            onPressed: () => context.push('/contributor-profile'),
            tooltip: 'Contributor Profile & Earnings',
          ),
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _refreshSpots,
            tooltip: 'Refresh Spots',
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // -------------------------------------------------------------
          // 1. HERO CARD: Plan Your Uncrowded Route (The Core Value Prop)
          // -------------------------------------------------------------
          Card(
            elevation: 3,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(16),
              side: BorderSide(color: Colors.teal.shade200, width: 1.5),
            ),
            child: Container(
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(16),
                gradient: LinearGradient(
                  colors: [Colors.teal.shade50, Colors.white],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
              ),
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(8),
                        decoration: BoxDecoration(
                          color: Colors.teal.shade100,
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: const Icon(Icons.auto_awesome, color: Colors.teal, size: 22),
                      ),
                      const SizedBox(width: 10),
                      const Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Uncrowded Route Planner',
                              style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                            ),
                            Text(
                              'Crowd-throttled walking tours built by everyday locals',
                              style: TextStyle(fontSize: 12, color: Colors.black54),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 14),

                  // A. Traveler Group Size
                  const Text(
                    'Traveler Group Mode (Crowd-Cap Matchmaking)',
                    style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.black87),
                  ),
                  const SizedBox(height: 6),
                  Wrap(
                    spacing: 8,
                    children: [
                      1, 2, 3, 4
                    ].map((count) {
                      final isSelected = groupSize == count;
                      return ChoiceChip(
                        label: Text(count == 1 ? 'Solo (1)' : '$count Travelers'),
                        selected: isSelected,
                        onSelected: (_) {
                          ref.read(groupSizeProvider.notifier).state = count;
                        },
                      );
                    }).toList(),
                  ),
                  const SizedBox(height: 12),

                  // B. Neighborhood & Location Selection
                  const Text(
                    'Select or Search Any Location / Neighborhood',
                    style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.black87),
                  ),
                  const SizedBox(height: 6),
                  SingleChildScrollView(
                    scrollDirection: Axis.horizontal,
                    child: Row(
                      children: [
                        'All',
                        ...TravelerPreferencesDocument.supportedNeighborhoods,
                      ].map((hood) {
                        final isSelected = _selectedNeighborhood == hood;
                        return Padding(
                          padding: const EdgeInsets.only(right: 6),
                          child: ChoiceChip(
                            label: Text(hood),
                            selected: isSelected,
                            onSelected: (selected) {
                              if (selected) {
                                setState(() => _selectedNeighborhood = hood);
                              }
                            },
                          ),
                        );
                      }).toList(),
                    ),
                  ),
                  const SizedBox(height: 10),

                  // Custom location text input for ANY city/neighborhood
                  TextField(
                    controller: _customLocationController,
                    decoration: InputDecoration(
                      hintText: 'Or type any city/area (e.g., Koramangala, Old Delhi, Fort Kochi)',
                      prefixIcon: const Icon(Icons.search, size: 18),
                      suffixIcon: _customLocationController.text.isNotEmpty
                          ? IconButton(
                              icon: const Icon(Icons.clear, size: 18),
                              onPressed: () {
                                _customLocationController.clear();
                                setState(() => _selectedNeighborhood = 'All');
                              },
                            )
                          : null,
                      contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                      isDense: true,
                    ),
                    onSubmitted: (val) {
                      if (val.trim().isNotEmpty) {
                        setState(() => _selectedNeighborhood = val.trim());
                      }
                    },
                  ),
                  const SizedBox(height: 12),

                  // C. Vibe Filters
                  const Text(
                    'Filter by Cultural Palate & Vibe',
                    style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.black87),
                  ),
                  const SizedBox(height: 6),
                  SingleChildScrollView(
                    scrollDirection: Axis.horizontal,
                    child: Row(
                      children: [
                        'All',
                        'Street Food',
                        'Local Coffee',
                        'Heritage',
                        'Local Crafts',
                        'Quiet Walk',
                        'Slow Pace',
                      ].map((vibe) {
                        final isSelected = _selectedVibe == vibe;
                        return Padding(
                          padding: const EdgeInsets.only(right: 6),
                          child: ChoiceChip(
                            label: Text(vibe),
                            selected: isSelected,
                            onSelected: (selected) {
                              if (selected) {
                                setState(() => _selectedVibe = vibe);
                              }
                            },
                          ),
                        );
                      }).toList(),
                    ),
                  ),
                  const SizedBox(height: 16),

                  // D. Launch Action Buttons
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton.icon(
                      style: FilledButton.styleFrom(
                        backgroundColor: const Color(0xFF0F766E),
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                      ),
                      onPressed: () => context.push('/planner'),
                      icon: const Icon(Icons.auto_awesome, size: 18),
                      label: const Text(
                        '✨ Plan Multi-Day Trip with AI (Solo / Squad)',
                        style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                      ),
                    ),
                  ),
                  const SizedBox(height: 8),
                  SizedBox(
                    width: double.infinity,
                    child: OutlinedButton.icon(
                      style: OutlinedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        side: BorderSide(color: Colors.teal.shade700),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                      ),
                      onPressed: () => context.push('/route'),
                      icon: const Icon(Icons.navigation, size: 18),
                      label: Text(
                        'Start Walking Tour (${groupSize == 1 ? "Solo" : "$groupSize Travelers"})',
                        style: TextStyle(fontWeight: FontWeight.bold, color: Colors.teal.shade800),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),

          // -------------------------------------------------------------
          // 2. SPOTS SECTION HEADER & DISCOVERY
          // -------------------------------------------------------------
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Text(
                  _selectedNeighborhood == 'All'
                      ? 'Verified Local Spots'
                      : 'Spots in $_selectedNeighborhood',
                  style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: Colors.green.shade50,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: Colors.green.shade300),
                ),
                child: Row(
                  children: [
                    Icon(Icons.check_circle, size: 12, color: Colors.green.shade700),
                    const SizedBox(width: 4),
                    Text(
                      'Crowd-Throttled',
                      style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Colors.green.shade800),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),

          // 3. Spots List
          spotsAsync.when(
            loading: () => const Padding(
              padding: EdgeInsets.symmetric(vertical: 32),
              child: AppLoadingIndicator(message: 'Loading verified spots...'),
            ),
            error: (error, _) => AppErrorStateWidget(
              message: 'Error loading spots: $error',
              onRetry: _refreshSpots,
            ),
            data: (spots) {
              final filtered = _filterSpots(spots);
              if (filtered.isEmpty) {
                return AppEmptyStateWidget(
                  title: 'No matching spots in $_selectedNeighborhood',
                  subtitle: 'Try switching to All Neighborhoods or submit a new gem!',
                  icon: Icons.place_outlined,
                  action: OutlinedButton(
                    onPressed: () {
                      setState(() {
                        _selectedNeighborhood = 'All';
                        _selectedVibe = 'All';
                        _customLocationController.clear();
                      });
                    },
                    child: const Text('Reset Location & Vibe Filter'),
                  ),
                );
              }

              return Column(
                children: filtered.map((originalSpot) {
                  final spot = _planBSwaps[originalSpot.id] ?? originalSpot;
                  final swapBanner = _planBReasons[originalSpot.id];
                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      if (swapBanner != null)
                        Container(
                          margin: const EdgeInsets.only(bottom: 4),
                          padding: const EdgeInsets.symmetric(
                            horizontal: 10,
                            vertical: 6,
                          ),
                          decoration: BoxDecoration(
                            color: Colors.teal.shade50,
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(color: Colors.teal.shade200),
                          ),
                          child: Row(
                            children: [
                              const Icon(Icons.alt_route, size: 14, color: Color(0xFF0F766E)),
                              const SizedBox(width: 6),
                              Expanded(
                                child: Text(
                                  swapBanner,
                                  style: const TextStyle(
                                    fontSize: 11,
                                    fontWeight: FontWeight.w600,
                                    color: Color(0xFF0F766E),
                                  ),
                                ),
                              ),
                              TextButton(
                                onPressed: () => setState(() {
                                  _planBSwaps.remove(originalSpot.id);
                                  _planBReasons.remove(originalSpot.id);
                                }),
                                style: TextButton.styleFrom(
                                  visualDensity: VisualDensity.compact,
                                  padding: const EdgeInsets.symmetric(horizontal: 6),
                                ),
                                child: const Text('Revert', style: TextStyle(fontSize: 11)),
                              ),
                            ],
                          ),
                        ),
                      SpotCardTile(
                        spot: spot,
                        statusText: '${spot.currentVisitors}/${spot.hourlyLimit}',
                        actions: [
                          FilledButton.tonalIcon(
                            onPressed: () => _openInMaps(spot),
                            icon: const Icon(Icons.directions, size: 15),
                            label: const Text('Directions', style: TextStyle(fontSize: 12)),
                            style: FilledButton.styleFrom(
                              visualDensity: VisualDensity.compact,
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                            ),
                          ),
                          OutlinedButton.icon(
                            onPressed: () => _toggleAudioCue(spot),
                            icon: Icon(
                              _playingSpotId == spot.id ? Icons.stop : Icons.headphones,
                              size: 15,
                              color: _playingSpotId == spot.id ? Colors.red : null,
                            ),
                            label: Text(
                              _playingSpotId == spot.id ? 'Stop Audio' : 'Audio Cue',
                              style: const TextStyle(fontSize: 12),
                            ),
                            style: OutlinedButton.styleFrom(
                              visualDensity: VisualDensity.compact,
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                            ),
                          ),
                          OutlinedButton.icon(
                            onPressed: () => _showLocalPhraseDialog(spot),
                            icon: const Icon(Icons.translate, size: 15),
                            label: const Text('Order Card', style: TextStyle(fontSize: 12)),
                            style: OutlinedButton.styleFrom(
                              visualDensity: VisualDensity.compact,
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                            ),
                          ),
                          OutlinedButton.icon(
                            onPressed: () => _handlePlanB(spot, spots),
                            icon: const Icon(Icons.alt_route, size: 15),
                            label: const Text('Plan B', style: TextStyle(fontSize: 12)),
                            style: OutlinedButton.styleFrom(
                              visualDensity: VisualDensity.compact,
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                            ),
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
                            icon: const Icon(Icons.volunteer_activism_outlined, size: 15),
                            label: const Text('Tip', style: TextStyle(fontSize: 12)),
                            style: OutlinedButton.styleFrom(
                              visualDensity: VisualDensity.compact,
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                            ),
                          ),
                        ],
                      ),
                    ],
                  );
                }).toList(),
              );
            },
          ),
        ],
      ),
    );
  }
}

class _DynamicOrderCardDialog extends StatefulWidget {
  final SpotCard spot;
  final String neighborhood;
  final StreetAssistanceService assistanceService;
  final VoidCallback onOpenLiveVoice;

  const _DynamicOrderCardDialog({
    required this.spot,
    required this.neighborhood,
    required this.assistanceService,
    required this.onOpenLiveVoice,
  });

  @override
  State<_DynamicOrderCardDialog> createState() => _DynamicOrderCardDialogState();
}

class _DynamicOrderCardDialogState extends State<_DynamicOrderCardDialog> {
  static const List<({String code, String label})> _languages = [
    (code: 'kn-IN', label: 'Kannada'),
    (code: 'hi-IN', label: 'Hindi'),
    (code: 'ta-IN', label: 'Tamil'),
    (code: 'te-IN', label: 'Telugu'),
    (code: 'mr-IN', label: 'Marathi'),
  ];

  String _selectedLang = 'kn-IN';
  bool _isLoading = true;
  DynamicOrderingCardsResult? _result;

  @override
  void initState() {
    super.initState();
    _loadCards();
  }

  Future<void> _loadCards() async {
    setState(() => _isLoading = true);
    final res = await widget.assistanceService.fetchDynamicOrderingCards(
      spotId: widget.spot.id,
      spotName: widget.spot.spotName,
      neighborhood: widget.neighborhood,
      targetLanguage: _selectedLang,
      menuHints: [
        if (widget.spot.greetingCard.isNotEmpty) widget.spot.greetingCard,
        ...widget.spot.vibeTags,
      ],
    );
    if (!mounted) return;
    setState(() {
      _result = res;
      _isLoading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    final cards = _result?.cards ?? const <OrderingCard>[];
    return AlertDialog(
      title: Row(
        children: [
          const Icon(Icons.translate, color: Color(0xFF0F766E)),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Order Cards • ${widget.spot.spotName}',
                  style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                if (_result != null)
                  Text(
                    _result!.isLiveAi
                        ? 'Powered by ${_result!.modelUsed}'
                        : 'Offline Local Phrasebook',
                    style: TextStyle(fontSize: 10, color: Colors.grey.shade600),
                  ),
              ],
            ),
          ),
        ],
      ),
      content: SizedBox(
        width: double.maxFinite,
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: Row(
                  children: _languages.map((lang) {
                    return Padding(
                      padding: const EdgeInsets.only(right: 6),
                      child: ChoiceChip(
                        label: Text(lang.label, style: const TextStyle(fontSize: 11)),
                        selected: _selectedLang == lang.code,
                        visualDensity: VisualDensity.compact,
                        onSelected: (selected) {
                          if (!selected || _selectedLang == lang.code) return;
                          setState(() => _selectedLang = lang.code);
                          _loadCards();
                        },
                      ),
                    );
                  }).toList(),
                ),
              ),
              const SizedBox(height: 10),
              if (_isLoading)
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 28),
                  child: Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        CircularProgressIndicator(),
                        SizedBox(height: 8),
                        Text(
                          'Generating local vendor order cards...',
                          style: TextStyle(fontSize: 12),
                        ),
                      ],
                    ),
                  ),
                )
              else
                ...cards.map((card) => Container(
                      width: double.infinity,
                      margin: const EdgeInsets.only(bottom: 10),
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: const Color(0xFFCCFBF1),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: const Color(0xFF14B8A6)),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Expanded(
                                child: Text(
                                  card.phraseRegional,
                                  style: const TextStyle(
                                    fontSize: 15,
                                    fontWeight: FontWeight.bold,
                                    color: Color(0xFF0F766E),
                                  ),
                                ),
                              ),
                              IconButton(
                                icon: const Icon(
                                  Icons.volume_up,
                                  size: 18,
                                  color: Color(0xFF0F766E),
                                ),
                                visualDensity: VisualDensity.compact,
                                tooltip: 'Pronounce',
                                onPressed: () => widget.assistanceService
                                    .speakAudioPrompt(card.phraseRegional),
                              ),
                            ],
                          ),
                          Text(
                            card.phonetic,
                            style: TextStyle(
                              fontSize: 12,
                              fontStyle: FontStyle.italic,
                              color: Colors.teal.shade900,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            card.englishMeaning,
                            style: const TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          if (card.usageTip.isNotEmpty) ...[
                            const SizedBox(height: 4),
                            Text(
                              card.usageTip,
                              style: TextStyle(
                                fontSize: 11,
                                color: Colors.grey.shade800,
                              ),
                            ),
                          ],
                        ],
                      ),
                    )),
            ],
          ),
        ),
      ),
      actions: [
        TextButton.icon(
          onPressed: widget.onOpenLiveVoice,
          icon: const Icon(Icons.interpreter_mode, size: 16),
          label: const Text('Live Voice'),
        ),
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('Close'),
        ),
      ],
    );
  }
}
