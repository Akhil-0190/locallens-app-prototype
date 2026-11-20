// ignore: deprecated_member_use
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import 'package:image_picker/image_picker.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:url_launcher/url_launcher.dart';

import '../models/walking_route.dart';
import '../providers/route_providers.dart';
import '../services/street_assistance_service.dart';
import '../utils/polyline_decoder.dart';
import '../widgets/app_async_states.dart';

/// D4: Route and Street-Ready Traveler Experience Screen
///
/// Features:
/// - Route overview (distance, duration, stops) matching C3 CanonicalRouteDocument.
/// - Interactive GoogleMap with decoded Polyline and stop markers.
/// - Ordered stop sequence with Domain 07 venue capacity constraint indicators.
/// - Plan-B alternative rerouting action.
/// - Local Audio Guidance controls (Play / Pause / Stop) using device TTS.
/// - Street Assistance panel: Greetings & Ordering Cards, Conversational Q&A, Camera Sign Translation.
class WalkingRouteScreen extends ConsumerStatefulWidget {
  const WalkingRouteScreen({super.key});

  @override
  ConsumerState<WalkingRouteScreen> createState() => _WalkingRouteScreenState();
}

class _WalkingRouteScreenState extends ConsumerState<WalkingRouteScreen> {
  GoogleMapController? _mapController;
  int _activeStepIndex = 0;
  late final StreetAssistanceService _streetAssistanceService;

  @override
  void initState() {
    super.initState();
    _streetAssistanceService = ref.read(streetAssistanceServiceProvider);
  }

  @override
  void dispose() {
    _streetAssistanceService.stopAudioPrompt();
    super.dispose();
  }

  void _onMapCreated(GoogleMapController controller) {
    _mapController = controller;
  }

  Future<void> _speakCurrentStep(RouteStep step) async {
    final tts = ref.read(streetAssistanceServiceProvider);
    ref.read(isAudioPlayingProvider.notifier).state = true;
    await tts.speakAudioPrompt(step.instruction);
  }

  Future<void> _stopAudio() async {
    final tts = ref.read(streetAssistanceServiceProvider);
    await tts.stopAudioPrompt();
    ref.read(isAudioPlayingProvider.notifier).state = false;
  }

  Future<void> _openExternalDirections(WalkingRoute route) async {
    final url =
        'https://www.google.com/maps/dir/?api=1&origin=${route.origin.latitude},${route.origin.longitude}&destination=${route.destination.latitude},${route.destination.longitude}&travelmode=walking';
    final uri = Uri.tryParse(url);
    if (uri != null) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  void _openStreetAssistanceSheet(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) => const _StreetAssistanceSheet(),
    );
  }

  Set<Polyline> _buildPolylines(WalkingRoute route) {
    final points = PolylineDecoder.decode(route.encodedPolyline);
    return {
      Polyline(
        polylineId: PolylineId(route.routeId),
        points: points,
        color: Colors.teal.shade700,
        width: 5,
        startCap: Cap.roundCap,
        endCap: Cap.roundCap,
      ),
    };
  }

  Set<Marker> _buildMarkers(WalkingRoute route) {
    final markers = <Marker>{};

    // Origin
    markers.add(
      Marker(
        markerId: const MarkerId('origin'),
        position: LatLng(route.origin.latitude, route.origin.longitude),
        infoWindow: InfoWindow(title: 'Start: ${route.title}'),
        icon: BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueGreen),
      ),
    );

    // Waypoints
    for (int i = 0; i < route.waypoints.length; i++) {
      final wp = route.waypoints[i];
      markers.add(
        Marker(
          markerId: MarkerId('waypoint_$i'),
          position: LatLng(wp.latitude, wp.longitude),
          infoWindow: InfoWindow(
            title: 'Stop ${i + 1}',
            snippet: route.waypointPlaceIds.length > i
                ? route.waypointPlaceIds[i]
                : null,
          ),
          icon: BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueAzure),
        ),
      );
    }

    // Destination
    markers.add(
      Marker(
        markerId: const MarkerId('destination'),
        position: LatLng(route.destination.latitude, route.destination.longitude),
        infoWindow: const InfoWindow(title: 'Destination'),
        icon: BitmapDescriptor.defaultMarkerWithHue(BitmapDescriptor.hueRed),
      ),
    );

    return markers;
  }

  @override
  Widget build(BuildContext context) {
    final routeAsync = ref.watch(activeRouteProvider);
    final disruptionsAsync = ref.watch(activeDisruptionsProvider);
    final isAudioPlaying = ref.watch(isAudioPlayingProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Street Walking Tour'),
        actions: [
          IconButton(
            icon: const Icon(Icons.record_voice_over),
            tooltip: 'Street Assistant & Ordering',
            onPressed: () => _openStreetAssistanceSheet(context),
          ),
          IconButton(
            icon: const Icon(Icons.refresh),
            tooltip: 'Reset Route',
            onPressed: () {
              ref.read(activeRouteProvider.notifier).loadDefaultRoute();
            },
          ),
        ],
      ),
      body: routeAsync.when(
        loading: () => const AppLoadingIndicator(
          message: 'Loading walking route and stops...',
        ),
        error: (e, _) => AppErrorStateWidget(
          message: 'Unable to load route: $e',
          onRetry: () =>
              ref.read(activeRouteProvider.notifier).loadDefaultRoute(),
        ),
        data: (route) {
          final allSteps =
              route.legs.expand((leg) => leg.steps).toList();
          final currentStep = allSteps.isNotEmpty &&
                  _activeStepIndex < allSteps.length
              ? allSteps[_activeStepIndex]
              : null;

          return Column(
            children: [
              // 1. Route Overview & Sample Disclosure Banner
              Container(
                color: Colors.amber.shade50,
                padding:
                    const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                child: Row(
                  children: [
                    Icon(Icons.info_outline,
                        size: 16, color: Colors.amber.shade900),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        '[Sample Route Data: C3 Routes API integration pending]',
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

              // 2. Interactive GoogleMap Widget (Height constrained)
              SizedBox(
                height: 230,
                child: Stack(
                  children: [
                    GoogleMap(
                      onMapCreated: _onMapCreated,
                      initialCameraPosition: CameraPosition(
                        target: LatLng(
                          route.origin.latitude,
                          route.origin.longitude,
                        ),
                        zoom: 15.0,
                      ),
                      polylines: _buildPolylines(route),
                      markers: _buildMarkers(route),
                      myLocationButtonEnabled: false,
                      zoomControlsEnabled: true,
                    ),
                    Positioned(
                      top: 10,
                      left: 10,
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 10, vertical: 5),
                        decoration: BoxDecoration(
                          color: Colors.black87,
                          borderRadius: BorderRadius.circular(16),
                        ),
                        child: Text(
                          '${route.formattedDistance} • ${route.formattedDuration}',
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 12,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),

              // 3. Domain 07 Venue Disruption & Plan-B Banner
              disruptionsAsync.when(
                data: (disruptions) {
                  if (disruptions.isEmpty) return const SizedBox.shrink();
                  final alert = disruptions.first;
                  return Container(
                    margin: const EdgeInsets.fromLTRB(16, 12, 16, 0),
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: Colors.red.shade50,
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: Colors.red.shade200),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Icon(Icons.warning_amber_rounded,
                                color: Colors.red.shade800, size: 20),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                'Venue Alert: High Crowd Capacity',
                                style: TextStyle(
                                  fontWeight: FontWeight.bold,
                                  fontSize: 13,
                                  color: Colors.red.shade900,
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 6),
                        Text(
                          alert.description,
                          style: TextStyle(
                            fontSize: 12,
                            color: Colors.red.shade900,
                          ),
                        ),
                        const SizedBox(height: 8),
                        FilledButton.tonalIcon(
                          style: FilledButton.styleFrom(
                            backgroundColor: Colors.red.shade100,
                            foregroundColor: Colors.red.shade900,
                          ),
                          onPressed: () {
                            ref
                                .read(activeRouteProvider.notifier)
                                .applyPlanB(alert.impactedPlaceId);
                          },
                          icon: const Icon(Icons.alt_route, size: 16),
                          label: const Text('Request Plan-B Reroute'),
                        ),
                      ],
                    ),
                  );
                },
                loading: () => const SizedBox.shrink(),
                error: (e, _) => const SizedBox.shrink(),
              ),

              // 4. Ordered Stop Sequence & Turn-by-Turn Steps
              Expanded(
                child: ListView(
                  padding: const EdgeInsets.all(16),
                  children: [
                    // Route Summary Title
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Expanded(
                          child: Text(
                            route.title,
                            style: const TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                        OutlinedButton.icon(
                          onPressed: () => _openExternalDirections(route),
                          icon: const Icon(Icons.navigation, size: 16),
                          label: const Text('Directions'),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),

                    // Stops Header
                    Text(
                      'Ordered Stops (${route.waypointPlaceIds.length})',
                      style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.bold,
                        color: Colors.teal,
                      ),
                    ),
                    const SizedBox(height: 8),

                    // Stop Cards List
                    ...List.generate(route.waypointPlaceIds.length, (idx) {
                      final placeId = route.waypointPlaceIds[idx];
                      final isConstrained =
                          placeId == 'place_ctr_malleshwaram_01';

                      return Card(
                        elevation: 1,
                        margin: const EdgeInsets.only(bottom: 8),
                        child: ListTile(
                          leading: CircleAvatar(
                            backgroundColor: Colors.teal.shade50,
                            child: Text(
                              '${idx + 1}',
                              style: TextStyle(
                                fontWeight: FontWeight.bold,
                                color: Colors.teal.shade900,
                              ),
                            ),
                          ),
                          title: Text(
                            placeId.replaceAll('_', ' ').toUpperCase(),
                            style: const TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          subtitle: isConstrained
                              ? Text(
                                  '[Sample C4: Throttled — Redirecting to Plan-B alternative]',
                                  style: TextStyle(
                                    fontSize: 11,
                                    color: Colors.red.shade700,
                                    fontWeight: FontWeight.bold,
                                  ),
                                )
                              : const Text(
                                  '[Sample C4: Spacious & authentic (4/12 visitors)]',
                                  style: TextStyle(
                                    fontSize: 11,
                                    color: Colors.green,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                          trailing: const Icon(Icons.chevron_right, size: 18),
                          onTap: () {
                            if (_mapController != null &&
                                idx < route.waypoints.length) {
                              final wp = route.waypoints[idx];
                              _mapController!.animateCamera(
                                CameraUpdate.newLatLng(
                                  LatLng(wp.latitude, wp.longitude),
                                ),
                              );
                            }
                          },
                        ),
                      );
                    }),

                    const SizedBox(height: 16),
                    // Turn-by-Turn Instruction Stepper
                    const Text(
                      'Turn-by-Turn Walking Prompts',
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.bold,
                        color: Colors.teal,
                      ),
                    ),
                    const SizedBox(height: 8),

                    if (allSteps.isEmpty)
                      const Text('No detailed turn steps available.')
                    else
                      ...List.generate(allSteps.length, (sIdx) {
                        final step = allSteps[sIdx];
                        final isCurrent = sIdx == _activeStepIndex;

                        return Container(
                          margin: const EdgeInsets.only(bottom: 8),
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: isCurrent
                                ? Colors.teal.shade50
                                : Colors.grey.shade50,
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(
                              color: isCurrent
                                  ? Colors.teal.shade400
                                  : Colors.grey.shade300,
                            ),
                          ),
                          child: Row(
                            children: [
                              Icon(
                                isCurrent
                                    ? Icons.directions_walk
                                    : Icons.circle_outlined,
                                size: 20,
                                color: isCurrent
                                    ? Colors.teal
                                    : Colors.grey.shade600,
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment:
                                      CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      step.instruction,
                                      style: TextStyle(
                                        fontSize: 13,
                                        fontWeight: isCurrent
                                            ? FontWeight.bold
                                            : FontWeight.normal,
                                      ),
                                    ),
                                    Text(
                                      '${step.distanceMeters} m • ~${step.durationSeconds ~/ 60} min',
                                      style: TextStyle(
                                        fontSize: 11,
                                        color: Colors.grey.shade600,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                              IconButton(
                                icon: const Icon(Icons.volume_up, size: 20),
                                tooltip: 'Listen prompt',
                                onPressed: () {
                                  setState(() => _activeStepIndex = sIdx);
                                  _speakCurrentStep(step);
                                },
                              ),
                            ],
                          ),
                        );
                      }),
                  ],
                ),
              ),

              // 5. Audio Guidance Bottom Bar
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                decoration: BoxDecoration(
                  color: Colors.teal.shade900,
                  boxShadow: const [
                    BoxShadow(
                      color: Colors.black12,
                      blurRadius: 4,
                      offset: Offset(0, -2),
                    ),
                  ],
                ),
                child: Row(
                  children: [
                    Icon(
                      isAudioPlaying ? Icons.volume_up : Icons.headphones,
                      color: Colors.white,
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Text(
                            'Local Audio Walking Guide',
                            style: TextStyle(
                              color: Colors.white,
                              fontSize: 12,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          Text(
                            currentStep != null
                                ? currentStep.instruction
                                : 'Select a step to listen',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              color: Colors.teal.shade100,
                              fontSize: 11,
                            ),
                          ),
                        ],
                      ),
                    ),
                    IconButton(
                      icon: Icon(
                        isAudioPlaying
                            ? Icons.pause_circle_filled
                            : Icons.play_circle_fill,
                        color: Colors.white,
                        size: 32,
                      ),
                      tooltip: isAudioPlaying ? 'Pause Audio' : 'Play Audio',
                      onPressed: () {
                        if (currentStep != null) {
                          if (isAudioPlaying) {
                            _stopAudio();
                          } else {
                            _speakCurrentStep(currentStep);
                          }
                        }
                      },
                    ),
                  ],
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

/// Street Assistance Bottom Sheet: Greetings, Vendor Q&A & Camera Translation
class _StreetAssistanceSheet extends ConsumerStatefulWidget {
  const _StreetAssistanceSheet();

  @override
  ConsumerState<_StreetAssistanceSheet> createState() =>
      _StreetAssistanceSheetState();
}

class _StreetAssistanceSheetState
    extends ConsumerState<_StreetAssistanceSheet>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  final TextEditingController _queryController = TextEditingController();
  final ImagePicker _picker = ImagePicker();

  String? _conversationResponse;
  bool _isAskingAI = false;

  CameraTranslationResult? _cameraResult;
  bool _isTranslatingCamera = false;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    _queryController.dispose();
    super.dispose();
  }

  Future<void> _askLocalGuide() async {
    final query = _queryController.text.trim();
    if (query.isEmpty) return;

    setState(() => _isAskingAI = true);
    final service = ref.read(streetAssistanceServiceProvider);
    final response = await service.askStreetCopilot(query);
    if (!mounted) return;

    setState(() {
      _conversationResponse = response;
      _isAskingAI = false;
    });
  }

  Future<void> _captureAndTranslate(ImageSource source) async {
    setState(() => _isTranslatingCamera = true);

    try {
      final status = await Permission.camera.request();
      if (status.isDenied && mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Camera permission denied.')),
        );
        setState(() => _isTranslatingCamera = false);
        return;
      }

      final file = await _picker.pickImage(source: source);
      if (file == null) {
        if (mounted) setState(() => _isTranslatingCamera = false);
        return;
      }

      final service = ref.read(streetAssistanceServiceProvider);
      final result = await service.translateStreetImage(file.path);
      if (!mounted) return;

      setState(() {
        _cameraResult = result;
        _isTranslatingCamera = false;
      });
    } catch (e) {
      if (mounted) {
        setState(() => _isTranslatingCamera = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Camera capture error: $e')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final assistanceService = ref.read(streetAssistanceServiceProvider);
    final orderingCards = assistanceService.getCulturalOrderingCards();

    return DraggableScrollableSheet(
      initialChildSize: 0.85,
      maxChildSize: 0.95,
      minChildSize: 0.5,
      expand: false,
      builder: (context, scrollController) {
        return Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
              child: Row(
                children: [
                  const Icon(Icons.streetview, color: Colors.teal),
                  const SizedBox(width: 8),
                  const Expanded(
                    child: Text(
                      'Street-Ready Assistance',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close),
                    onPressed: () => Navigator.of(context).pop(),
                  ),
                ],
              ),
            ),
            TabBar(
              controller: _tabController,
              labelColor: Colors.teal,
              indicatorColor: Colors.teal,
              tabs: const [
                Tab(icon: Icon(Icons.restaurant_menu), text: 'Ordering'),
                Tab(icon: Icon(Icons.forum), text: 'Ask Guide'),
                Tab(icon: Icon(Icons.camera_alt), text: 'Translate'),
              ],
            ),
            Expanded(
              child: TabBarView(
                controller: _tabController,
                children: [
                  // Tab 1: Regional Greetings & Food Ordering
                  ListView.builder(
                    controller: scrollController,
                    padding: const EdgeInsets.all(16),
                    itemCount: orderingCards.length,
                    itemBuilder: (context, idx) {
                      final card = orderingCards[idx];
                      return Card(
                        margin: const EdgeInsets.only(bottom: 12),
                        child: Padding(
                          padding: const EdgeInsets.all(14),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                card.phraseRegional,
                                style: const TextStyle(
                                  fontSize: 16,
                                  fontWeight: FontWeight.bold,
                                  color: Colors.teal,
                                ),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                card.phonetic,
                                style: TextStyle(
                                  fontSize: 12,
                                  fontStyle: FontStyle.italic,
                                  color: Colors.grey.shade700,
                                ),
                              ),
                              const SizedBox(height: 6),
                              Text(
                                card.englishMeaning,
                                style: const TextStyle(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                              const SizedBox(height: 8),
                              Row(
                                mainAxisAlignment:
                                    MainAxisAlignment.spaceBetween,
                                children: [
                                  Expanded(
                                    child: Text(
                                      card.usageTip,
                                      style: TextStyle(
                                        fontSize: 11,
                                        color: Colors.grey.shade600,
                                      ),
                                    ),
                                  ),
                                  IconButton(
                                    icon: const Icon(Icons.volume_up,
                                        size: 18),
                                    onPressed: () {
                                      assistanceService.speakAudioPrompt(
                                          card.phraseRegional);
                                    },
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                      );
                    },
                  ),

                  // Tab 2: Conversational Guide Q&A (Simulated B5)
                  ListView(
                    controller: scrollController,
                    padding: const EdgeInsets.all(16),
                    children: [
                      Container(
                        padding: const EdgeInsets.all(10),
                        margin: const EdgeInsets.only(bottom: 12),
                        decoration: BoxDecoration(
                          color: Colors.blue.shade50,
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: Colors.blue.shade200),
                        ),
                        child: Row(
                          children: [
                            Icon(Icons.smart_toy_outlined,
                                size: 16, color: Colors.blue.shade800),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                '[Sample AI: Simulated B5 response]',
                                style: TextStyle(
                                  fontSize: 11,
                                  color: Colors.blue.shade900,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                      Row(
                        children: [
                          Expanded(
                            child: TextField(
                              controller: _queryController,
                              decoration: const InputDecoration(
                                hintText: 'Ask about stalls, coffee, etiquette...',
                                border: OutlineInputBorder(),
                                contentPadding: EdgeInsets.symmetric(
                                    horizontal: 12, vertical: 10),
                              ),
                              onSubmitted: (_) => _askLocalGuide(),
                            ),
                          ),
                          const SizedBox(width: 8),
                          FilledButton(
                            onPressed: _isAskingAI ? null : _askLocalGuide,
                            child: _isAskingAI
                                ? const SizedBox(
                                    width: 16,
                                    height: 16,
                                    child: CircularProgressIndicator(
                                      strokeWidth: 2,
                                      color: Colors.white,
                                    ),
                                  )
                                : const Text('Ask'),
                          ),
                        ],
                      ),
                      const SizedBox(height: 16),
                      if (_conversationResponse != null)
                        Card(
                          color: Colors.teal.shade50,
                          child: Padding(
                            padding: const EdgeInsets.all(14),
                            child: Text(
                              _conversationResponse!,
                              style: const TextStyle(fontSize: 13),
                            ),
                          ),
                        ),
                    ],
                  ),

                  // Tab 3: Camera Street Sign Translation (Simulated B5)
                  ListView(
                    controller: scrollController,
                    padding: const EdgeInsets.all(16),
                    children: [
                      Container(
                        padding: const EdgeInsets.all(10),
                        margin: const EdgeInsets.only(bottom: 12),
                        decoration: BoxDecoration(
                          color: Colors.blue.shade50,
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: Colors.blue.shade200),
                        ),
                        child: Row(
                          children: [
                            Icon(Icons.camera_alt_outlined,
                                size: 16, color: Colors.blue.shade800),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                '[Sample AI: Simulated B5 response]',
                                style: TextStyle(
                                  fontSize: 11,
                                  color: Colors.blue.shade900,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                      Row(
                        children: [
                          Expanded(
                            child: OutlinedButton.icon(
                              onPressed: _isTranslatingCamera
                                  ? null
                                  : () =>
                                      _captureAndTranslate(ImageSource.camera),
                              icon: const Icon(Icons.camera_alt),
                              label: const Text('Capture Sign'),
                            ),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: OutlinedButton.icon(
                              onPressed: _isTranslatingCamera
                                  ? null
                                  : () =>
                                      _captureAndTranslate(ImageSource.gallery),
                              icon: const Icon(Icons.photo_library),
                              label: const Text('Select Photo'),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 16),
                      if (_isTranslatingCamera)
                        const Center(child: CircularProgressIndicator())
                      else if (_cameraResult != null)
                        Card(
                          elevation: 2,
                          child: Padding(
                            padding: const EdgeInsets.all(16),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  mainAxisAlignment:
                                      MainAxisAlignment.spaceBetween,
                                  children: [
                                    Text(
                                      _cameraResult!.detectedScript,
                                      style: const TextStyle(
                                        fontSize: 12,
                                        fontWeight: FontWeight.bold,
                                        color: Colors.teal,
                                      ),
                                    ),
                                    const Text(
                                      'Simulated B5',
                                      style: TextStyle(
                                        fontSize: 11,
                                        color: Colors.grey,
                                      ),
                                    ),
                                  ],
                                ),
                                const Divider(height: 16),
                                Text(
                                  _cameraResult!.originalText,
                                  style: const TextStyle(
                                    fontSize: 16,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                                const SizedBox(height: 6),
                                Text(
                                  'Translation: ${_cameraResult!.translatedText}',
                                  style: const TextStyle(
                                    fontSize: 14,
                                    fontWeight: FontWeight.w600,
                                    color: Colors.teal,
                                  ),
                                ),
                                const SizedBox(height: 8),
                                Text(
                                  'Context: ${_cameraResult!.culturalContext}',
                                  style: TextStyle(
                                    fontSize: 12,
                                    color: Colors.grey.shade700,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        );
      },
    );
  }
}
