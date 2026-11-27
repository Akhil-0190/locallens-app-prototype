import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';
import '../models/trip_plan.dart';
import '../services/trip_planner_service.dart';
import '../providers/route_providers.dart';
import '../providers/spot_providers.dart';

final tripPlannerServiceProvider = Provider<TripPlannerService>((ref) {
  return TripPlannerService();
});

class TripPlannerScreen extends ConsumerStatefulWidget {
  const TripPlannerScreen({super.key});

  @override
  ConsumerState<TripPlannerScreen> createState() => _TripPlannerScreenState();
}

class _TripPlannerScreenState extends ConsumerState<TripPlannerScreen> {
  // Input Form States
  int _selectedGroupSize = 2; // Solo, 2, 3, 4, 5, 6, 7+
  int _durationDays = 2; // 1 to 7
  String _detailLevel = 'detailed'; // 'flexible' or 'detailed'
  bool _surpriseMeMode = false;
  bool _isKeepScheduleFlexible = false;

  final TextEditingController _destinationController =
      TextEditingController(text: 'Malleshwaram, Bengaluru');
  final TextEditingController _currentLocationController =
      TextEditingController(text: 'Bengaluru Central (MG Road Metro)');
  final TextEditingController _customVibeController = TextEditingController();

  Map<String, dynamic> _currentLocationData = {
    'name': 'Bengaluru Central (MG Road Metro)',
    'latitude': 12.9756,
    'longitude': 77.6066,
    'isGps': false,
  };

  final Set<String> _selectedVibes = {
    '☕ Aesthetic Cafes',
    '🌙 Late-Night Street Food',
    '🏛️ Vintage & Heritage',
  };

  final Set<String> _selectedPriorities = {
    'Food First',
    'Photography / Aesthetics',
  };

  final List<String> _vibePresets = [
    '☕ Aesthetic Cafes',
    '🌿 Hidden Courtyards',
    '🌙 Late-Night Street Food',
    '🌅 Sunset & Golden Hour',
    '🏛️ Vintage & Heritage',
    '🎨 Cultural Crafts',
    '⚡ High Energy Bazaars',
    '🎧 Chill & Slow Walk',
  ];

  final List<String> _priorityPresets = [
    'Food First',
    'Sightseeing & Alleys',
    'Photography / Aesthetics',
    'Chill Walk (Short Dist)',
    'Budget Friendly',
  ];

  final List<String> _popularDestinations = [
    'Malleshwaram, Bengaluru',
    'Basavanagudi, Bengaluru',
    'Indiranagar, Bengaluru',
    'Fort Kochi, Kerala',
    'Old Delhi, Delhi',
    'Bandra West, Mumbai',
    'Mylapore, Chennai',
  ];

  // Execution states
  bool _isDetectingLocation = false;
  bool _isGenerating = false;
  TripPlan? _generatedPlan;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _detectLocationOnLaunch();
  }

  @override
  void dispose() {
    _destinationController.dispose();
    _currentLocationController.dispose();
    _customVibeController.dispose();
    super.dispose();
  }

  Future<void> _detectLocationOnLaunch() async {
    setState(() => _isDetectingLocation = true);
    final service = ref.read(tripPlannerServiceProvider);
    final loc = await service.detectCurrentLocation();
    if (mounted) {
      setState(() {
        _currentLocationData = loc;
        _currentLocationController.text = loc['name'] as String? ?? 'Your Current Location';
        _isDetectingLocation = false;
      });
    }
  }

  Future<void> _generatePlan() async {
    setState(() {
      _isGenerating = true;
      _errorMessage = null;
    });

    try {
      final service = ref.read(tripPlannerServiceProvider);

      final vibesList = _surpriseMeMode
          ? ['Local Hidden Secrets', 'Aesthetic Street Bites', 'Offbeat Courtyards']
          : _selectedVibes.toList();

      final plan = await service.generateTripPlan(
        destination: _destinationController.text.trim().isNotEmpty
            ? _destinationController.text.trim()
            : 'Malleshwaram, Bengaluru',
        groupSize: _selectedGroupSize,
        vibes: vibesList,
        customVibeText: _customVibeController.text.trim().isNotEmpty
            ? _customVibeController.text.trim()
            : null,
        priorities: _selectedPriorities.toList(),
        durationDays: _durationDays,
        detailLevel: _isKeepScheduleFlexible ? 'flexible' : _detailLevel,
        currentLocation: _currentLocationData,
      );

      if (mounted) {
        setState(() {
          _generatedPlan = plan;
          _isGenerating = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _errorMessage = 'Failed to generate plan: $e';
          _isGenerating = false;
        });
      }
    }
  }

  Future<void> _openGoogleMapsQuery(String query) async {
    final encoded = Uri.encodeComponent(query);
    final uri = Uri.parse('https://www.google.com/maps/search/?api=1&query=$encoded');
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  Future<void> _startWalkingTour(TripDay day) async {
    if (day.stops.isEmpty) return;

    final destinationText = _destinationController.text.trim();
    final neighborhoodQuery = destinationText.split(',').first.trim();

    try {
      final spots = await ref.read(spotServiceProvider).getVerifiedSpots(
            neighborhood: neighborhoodQuery.isNotEmpty ? neighborhoodQuery : null,
          );
      final groundedSpots = spots
          .where((s) => s.latitude != null && s.longitude != null)
          .take(4)
          .toList();

      if (groundedSpots.length < 2) {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text(
              'Need at least 2 grounded neighborhood spots with verified coordinates to build a live walking route.',
            ),
            behavior: SnackBarBehavior.floating,
          ),
        );
        return;
      }

      final liveRoute = await ref.read(routeServiceProvider).getPersonalizedRoute(
            placeIds: groundedSpots.map((s) => s.id).toList(),
            spots: groundedSpots,
            routeTitle: day.theme,
            neighborhood: neighborhoodQuery.isNotEmpty ? neighborhoodQuery : destinationText,
          );

      ref.read(activeRouteProvider.notifier).setActiveRoute(liveRoute);
      if (!mounted) return;

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Loaded "${day.theme}" into Walking Tour!'),
          backgroundColor: Colors.teal.shade800,
          behavior: SnackBarBehavior.floating,
        ),
      );
      Navigator.of(context).pop();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Could not compute live walking tour: $e'),
          backgroundColor: Colors.red.shade700,
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      backgroundColor: const Color(0xFFF8F9FA),
      appBar: AppBar(
        title: const Text(
          'AI Trip Planner',
          style: TextStyle(fontWeight: FontWeight.bold),
        ),
        elevation: 0,
        backgroundColor: Colors.white,
        foregroundColor: Colors.black87,
        actions: [
          if (_generatedPlan != null)
            IconButton(
              icon: const Icon(Icons.refresh),
              tooltip: 'New Plan',
              onPressed: () {
                setState(() => _generatedPlan = null);
              },
            ),
        ],
      ),
      body: _isGenerating
          ? _buildLoadingState()
          : _generatedPlan != null
              ? _buildPlanResultView()
              : _buildPlannerInputForm(theme),
    );
  }

  Widget _buildLoadingState() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32.0),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const CircularProgressIndicator(
              valueColor: AlwaysStoppedAnimation<Color>(Color(0xFF0F766E)),
              strokeWidth: 3,
            ),
            const SizedBox(height: 24),
            const Text(
              'Curating Your Uncrowded Trip Plan...',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
                color: Color(0xFF0F766E),
              ),
            ),
            const SizedBox(height: 10),
            Text(
              'Computing transit from ${_currentLocationController.text} to ${_destinationController.text}, scanning local vibe spots, and throttling crowd bottlenecks.',
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 13, color: Colors.black54, height: 1.4),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPlannerInputForm(ThemeData theme) {
    return ListView(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 20),
      children: [
        // Hero Tagline
        Container(
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [Color(0xFF0F766E), Color(0xFF14B8A6)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            borderRadius: BorderRadius.circular(16),
            boxShadow: [
              BoxShadow(
                color: const Color(0xFF0F766E).withOpacity(0.2),
                blurRadius: 10,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: Colors.white.withOpacity(0.2),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(Icons.explore, color: Colors.white, size: 22),
                  ),
                  const SizedBox(width: 12),
                  const Expanded(
                    child: Text(
                      'AI Neighborhood Trip Co-Pilot',
                      style: TextStyle(
                        fontSize: 17,
                        fontWeight: FontWeight.bold,
                        color: Colors.white,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              const Text(
                'Tell us where you are, who you\'re with, and your vibe. We\'ll map your transit and build an uncrowded, insider itinerary.',
                style: TextStyle(fontSize: 13, color: Colors.white, height: 1.3),
              ),
            ],
          ),
        ),

        const SizedBox(height: 24),

        // SECTION 1: MANDATORY STARTING & TARGET LOCATION
        _buildSectionHeader('1. Locations & Transit Gateway', Icons.near_me),
        const SizedBox(height: 10),
        Card(
          elevation: 0,
          color: Colors.white,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
            side: BorderSide(color: Colors.grey.shade200),
          ),
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Starting Location
                Row(
                  children: [
                    const Icon(Icons.my_location, color: Color(0xFF0F766E), size: 20),
                    const SizedBox(width: 8),
                    const Text(
                      'Where are you starting from?',
                      style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold),
                    ),
                    const Spacer(),
                    if (_isDetectingLocation)
                      const SizedBox(
                        width: 14,
                        height: 14,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    else
                      TextButton.icon(
                        style: TextButton.styleFrom(
                          padding: EdgeInsets.zero,
                          minimumSize: const Size(50, 30),
                          tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                        ),
                        onPressed: _detectLocationOnLaunch,
                        icon: const Icon(Icons.gps_fixed, size: 14, color: Color(0xFF0F766E)),
                        label: const Text(
                          'Detect GPS',
                          style: TextStyle(fontSize: 12, color: Color(0xFF0F766E)),
                        ),
                      ),
                  ],
                ),
                const SizedBox(height: 6),
                TextField(
                  controller: _currentLocationController,
                  decoration: InputDecoration(
                    hintText: 'e.g. Indiranagar Metro / Delhi Airport',
                    isDense: true,
                    filled: true,
                    fillColor: Colors.grey.shade50,
                    contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(8),
                      borderSide: BorderSide(color: Colors.grey.shade300),
                    ),
                  ),
                ),

                const SizedBox(height: 16),

                // Destination
                const Row(
                  children: [
                    Icon(Icons.location_on, color: Colors.deepOrange, size: 20),
                    SizedBox(width: 8),
                    Text(
                      'Target Destination / Neighborhood',
                      style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                TextField(
                  controller: _destinationController,
                  decoration: InputDecoration(
                    hintText: 'e.g. Malleshwaram, Bengaluru',
                    isDense: true,
                    filled: true,
                    fillColor: Colors.grey.shade50,
                    contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(8),
                      borderSide: BorderSide(color: Colors.grey.shade300),
                    ),
                  ),
                ),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 6,
                  runSpacing: 4,
                  children: _popularDestinations.map((dest) {
                    final isSelected = _destinationController.text.trim().toLowerCase() ==
                        dest.trim().toLowerCase();
                    return ActionChip(
                      label: Text(dest, style: TextStyle(fontSize: 11, color: isSelected ? Colors.white : Colors.black87)),
                      backgroundColor: isSelected ? const Color(0xFF0F766E) : Colors.grey.shade100,
                      padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 0),
                      onPressed: () {
                        setState(() => _destinationController.text = dest);
                      },
                    );
                  }).toList(),
                ),
              ],
            ),
          ),
        ),

        const SizedBox(height: 20),

        // SECTION 2: SQUAD SIZE (Solo, 2, 3, 4, 5, 6, 7+)
        _buildSectionHeader('2. Group Size & Squad', Icons.group),
        const SizedBox(height: 10),
        Card(
          elevation: 0,
          color: Colors.white,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
            side: BorderSide(color: Colors.grey.shade200),
          ),
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Who is traveling?',
                  style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Colors.black87),
                ),
                const SizedBox(height: 10),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    _buildGroupSizeChip('Solo (1)', 1, Icons.person),
                    _buildGroupSizeChip('2 Explorers', 2, Icons.people),
                    _buildGroupSizeChip('3 Friends', 3, Icons.people_outline),
                    _buildGroupSizeChip('4 Squad', 4, Icons.group),
                    _buildGroupSizeChip('5 Squad', 5, Icons.groups),
                    _buildGroupSizeChip('6 Group', 6, Icons.groups_2),
                    _buildGroupSizeChip('7+ Large Squad', 8, Icons.diversity_3),
                  ],
                ),
              ],
            ),
          ),
        ),

        const SizedBox(height: 20),

        // SECTION 3: VIBE SELECTION & GEN Z CUSTOM CHAT
        _buildSectionHeader('3. Match Your Vibe (Gen Z Presets & Custom)', Icons.auto_awesome),
        const SizedBox(height: 10),
        Card(
          elevation: 0,
          color: Colors.white,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
            side: BorderSide(color: Colors.grey.shade200),
          ),
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Surprise Me Switch
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text(
                      'Surprise Me / You Decide Mode',
                      style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold),
                    ),
                    Switch.adaptive(
                      value: _surpriseMeMode,
                      activeColor: const Color(0xFF0F766E),
                      onChanged: (val) {
                        setState(() => _surpriseMeMode = val);
                      },
                    ),
                  ],
                ),
                if (!_surpriseMeMode) ...[
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: _vibePresets.map((vibe) {
                      final isSelected = _selectedVibes.contains(vibe);
                      return FilterChip(
                        label: Text(vibe, style: TextStyle(fontSize: 12, fontWeight: isSelected ? FontWeight.bold : FontWeight.normal)),
                        selected: isSelected,
                        selectedColor: const Color(0xFFCCFBF1),
                        checkmarkColor: const Color(0xFF0F766E),
                        backgroundColor: Colors.grey.shade100,
                        onSelected: (selected) {
                          setState(() {
                            if (selected) {
                              _selectedVibes.add(vibe);
                            } else {
                              if (_selectedVibes.length > 1) {
                                _selectedVibes.remove(vibe);
                              }
                            }
                          });
                        },
                      );
                    }).toList(),
                  ),
                  const SizedBox(height: 14),
                  const Text(
                    'Or tell us in your own words:',
                    style: TextStyle(fontSize: 12, color: Colors.black54),
                  ),
                  const SizedBox(height: 6),
                  TextField(
                    controller: _customVibeController,
                    maxLines: 2,
                    decoration: InputDecoration(
                      hintText: 'e.g. "Vintage vinyl shops, quiet reading courtyards, and spicy butter dosa stalls"',
                      isDense: true,
                      filled: true,
                      fillColor: Colors.grey.shade50,
                      contentPadding: const EdgeInsets.all(10),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(8),
                        borderSide: BorderSide(color: Colors.grey.shade300),
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),

        const SizedBox(height: 20),

        // SECTION 4: PRIORITIES & FLEXIBILITY
        _buildSectionHeader('4. Priorities & Itinerary Duration', Icons.tune),
        const SizedBox(height: 10),
        Card(
          elevation: 0,
          color: Colors.white,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
            side: BorderSide(color: Colors.grey.shade200),
          ),
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'What should we prioritize?',
                  style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
                ),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: _priorityPresets.map((priority) {
                    final isSelected = _selectedPriorities.contains(priority);
                    return FilterChip(
                      label: Text(priority, style: const TextStyle(fontSize: 12)),
                      selected: isSelected,
                      selectedColor: const Color(0xFFFEF3C7),
                      checkmarkColor: Colors.amber.shade900,
                      backgroundColor: Colors.grey.shade100,
                      onSelected: (selected) {
                        setState(() {
                          if (selected) {
                            _selectedPriorities.add(priority);
                          } else {
                            if (_selectedPriorities.length > 1) {
                              _selectedPriorities.remove(priority);
                            }
                          }
                        });
                      },
                    );
                  }).toList(),
                ),

                const SizedBox(height: 16),

                // Trip Duration (1 to 7 Days)
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text(
                      'Trip Duration:',
                      style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: const Color(0xFF0F766E).withOpacity(0.1),
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Text(
                        '$_durationDays Day${_durationDays > 1 ? 's' : ''}',
                        style: const TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.bold,
                          color: Color(0xFF0F766E),
                        ),
                      ),
                    ),
                  ],
                ),
                Slider(
                  value: _durationDays.toDouble(),
                  min: 1,
                  max: 7,
                  divisions: 6,
                  activeColor: const Color(0xFF0F766E),
                  label: '$_durationDays Days',
                  onChanged: (val) {
                    setState(() => _durationDays = val.round());
                  },
                ),

                const SizedBox(height: 8),

                // Detail Level (Flexible vs Detailed)
                const Text(
                  'Detail Level:',
                  style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    Expanded(
                      child: ChoiceChip(
                        label: const Center(
                          child: Text('Detailed Itinerary\n(Hour-by-hour + walking)', textAlign: TextAlign.center, style: TextStyle(fontSize: 11)),
                        ),
                        selected: _detailLevel == 'detailed',
                        selectedColor: const Color(0xFFCCFBF1),
                        onSelected: (val) {
                          if (val) setState(() => _detailLevel = 'detailed');
                        },
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: ChoiceChip(
                        label: const Center(
                          child: Text('Flexible Plan\n(Spot list & crowd caps)', textAlign: TextAlign.center, style: TextStyle(fontSize: 11)),
                        ),
                        selected: _detailLevel == 'flexible',
                        selectedColor: const Color(0xFFCCFBF1),
                        onSelected: (val) {
                          if (val) setState(() => _detailLevel = 'flexible');
                        },
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),

        const SizedBox(height: 24),

        if (_errorMessage != null)
          Container(
            padding: const EdgeInsets.all(12),
            margin: const EdgeInsets.only(bottom: 16),
            decoration: BoxDecoration(
              color: Colors.red.shade50,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: Colors.red.shade200),
            ),
            child: Text(
              _errorMessage!,
              style: TextStyle(fontSize: 12, color: Colors.red.shade900),
            ),
          ),

        // SUBMIT BUTTON
        ElevatedButton(
          style: ElevatedButton.styleFrom(
            backgroundColor: const Color(0xFF0F766E),
            foregroundColor: Colors.white,
            padding: const EdgeInsets.symmetric(vertical: 16),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            elevation: 2,
          ),
          onPressed: _generatePlan,
          child: const Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.auto_awesome, size: 20),
              SizedBox(width: 10),
              Text(
                'Generate Uncrowded Plan with AI',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
              ),
            ],
          ),
        ),

        const SizedBox(height: 32),
      ],
    );
  }

  Widget _buildGroupSizeChip(String label, int size, IconData icon) {
    final isSelected = _selectedGroupSize == size;
    return ChoiceChip(
      avatar: Icon(icon, size: 16, color: isSelected ? Colors.white : Colors.black54),
      label: Text(label, style: TextStyle(fontSize: 12, fontWeight: isSelected ? FontWeight.bold : FontWeight.normal)),
      selected: isSelected,
      selectedColor: const Color(0xFF0F766E),
      labelStyle: TextStyle(color: isSelected ? Colors.white : Colors.black87),
      backgroundColor: Colors.grey.shade100,
      onSelected: (selected) {
        if (selected) setState(() => _selectedGroupSize = size);
      },
    );
  }

  Widget _buildSectionHeader(String title, IconData icon) {
    return Row(
      children: [
        Icon(icon, size: 18, color: const Color(0xFF0F766E)),
        const SizedBox(width: 8),
        Text(
          title,
          style: const TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.bold,
            color: Color(0xFF0F766E),
            letterSpacing: 0.3,
          ),
        ),
      ],
    );
  }

  // RESULT VIEW
  Widget _buildPlanResultView() {
    final plan = _generatedPlan!;

    return ListView(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
      children: [
        // Destination Header Card
        Container(
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [Color(0xFF0F766E), Color(0xFF115E59)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            borderRadius: BorderRadius.circular(16),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: Colors.white.withOpacity(0.2),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text(
                      '${plan.durationDays} Day${plan.durationDays > 1 ? 's' : ''} • ${plan.groupSize == 1 ? 'Solo' : '${plan.groupSize} Travelers'}',
                      style: const TextStyle(fontSize: 12, color: Colors.white, fontWeight: FontWeight.bold),
                    ),
                  ),
                  const Spacer(),
                  const Icon(Icons.verified, color: Colors.tealAccent, size: 18),
                  const SizedBox(width: 4),
                  const Text(
                    'AI Grounded',
                    style: TextStyle(fontSize: 12, color: Colors.tealAccent, fontWeight: FontWeight.bold),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Text(
                plan.destination,
                style: const TextStyle(
                  fontSize: 22,
                  fontWeight: FontWeight.bold,
                  color: Colors.white,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                plan.overallSummary,
                style: const TextStyle(fontSize: 13, color: Colors.white70, height: 1.3),
              ),
            ],
          ),
        ),

        const SizedBox(height: 16),

        // MANDATORY TRANSIT GUIDANCE CARD
        Card(
          elevation: 0,
          color: const Color(0xFFFEF3C7),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
            side: BorderSide(color: Colors.amber.shade300),
          ),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Icon(Icons.directions_subway, color: Colors.amber.shade900, size: 20),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'Transit Guide: How to Get There',
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.bold,
                          color: Colors.amber.shade900,
                        ),
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: Colors.amber.shade400),
                      ),
                      child: Text(
                        '${plan.transit.distance} • ${plan.transit.estimatedDuration}',
                        style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Colors.amber.shade900),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Text(
                  'Recommended Mode: ${plan.transit.recommendedMode}',
                  style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.brown.shade800),
                ),
                const SizedBox(height: 8),
                const Divider(height: 1, color: Colors.black12),
                const SizedBox(height: 8),
                ...plan.transit.stepByStepInstructions.map(
                  (step) => Padding(
                    padding: const EdgeInsets.symmetric(vertical: 3),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Icon(Icons.arrow_right, size: 18, color: Colors.brown),
                        const SizedBox(width: 4),
                        Expanded(
                          child: Text(
                            step,
                            style: const TextStyle(fontSize: 12, color: Colors.brown, height: 1.3),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),

        const SizedBox(height: 16),

        // DAILY ITINERARIES
        ...plan.days.map((day) => _buildDayCard(day)),

        const SizedBox(height: 24),

        // Bottom Action Bar
        Row(
          children: [
            Expanded(
              child: OutlinedButton.icon(
                style: OutlinedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  side: const BorderSide(color: Color(0xFF0F766E)),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                ),
                onPressed: () {
                  setState(() => _generatedPlan = null);
                },
                icon: const Icon(Icons.tune, color: Color(0xFF0F766E), size: 18),
                label: const Text(
                  'Adjust Preferences',
                  style: TextStyle(color: Color(0xFF0F766E), fontWeight: FontWeight.bold),
                ),
              ),
            ),
          ],
        ),

        const SizedBox(height: 32),
      ],
    );
  }

  Widget _buildDayCard(TripDay day) {
    return Container(
      margin: const EdgeInsets.only(bottom: 20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Colors.grey.shade200),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.04),
            blurRadius: 6,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Day Title Bar
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            decoration: BoxDecoration(
              color: Colors.grey.shade50,
              borderRadius: const BorderRadius.vertical(top: Radius.circular(14)),
              border: Border.all(color: Colors.grey.shade200),
            ),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: const Color(0xFF0F766E),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(
                    'Day ${day.dayNumber}',
                    style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.white),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    day.theme,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Colors.black87),
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.directions_walk, color: Color(0xFF0F766E)),
                  tooltip: 'Start Walking Tour for Day ${day.dayNumber}',
                  onPressed: () => _startWalkingTour(day),
                ),
              ],
            ),
          ),

          // Day Stops
          ListView.separated(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            padding: const EdgeInsets.all(14),
            itemCount: day.stops.length,
            separatorBuilder: (context, index) => const Divider(height: 24, color: Colors.black12),
            itemBuilder: (context, index) {
              final stop = day.stops[index];
              return _buildStopItem(stop, index + 1);
            },
          ),
        ],
      ),
    );
  }

  Widget _buildStopItem(TripStop stop, int stopIndex) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Stop Number Badge
            Container(
              width: 24,
              height: 24,
              alignment: Alignment.center,
              decoration: const BoxDecoration(
                color: Color(0xFF0F766E),
                shape: BoxShape.circle,
              ),
              child: Text(
                '$stopIndex',
                style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold),
              ),
            ),
            const SizedBox(width: 10),
            // Stop Details
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          stop.name,
                          style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: Colors.black87),
                        ),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: Colors.grey.shade100,
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(
                          stop.timeSlot,
                          style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Colors.black54),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    stop.category,
                    style: TextStyle(fontSize: 12, color: Colors.teal.shade800, fontWeight: FontWeight.w500),
                  ),
                ],
              ),
            ),
          ],
        ),

        const SizedBox(height: 10),

        // Why Locals Love It
        Container(
          padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(
            color: Colors.grey.shade50,
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: Colors.grey.shade200),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  const Icon(Icons.favorite, size: 14, color: Colors.redAccent),
                  const SizedBox(width: 6),
                  Text(
                    'Why Locals Love It:',
                    style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Colors.grey.shade800),
                  ),
                ],
              ),
              const SizedBox(height: 4),
              Text(
                stop.whyLocalsLoveIt,
                style: const TextStyle(fontSize: 12, color: Colors.black87, height: 1.3),
              ),
              const SizedBox(height: 6),
              Row(
                children: [
                  const Icon(Icons.tips_and_updates, size: 14, color: Colors.amber),
                  const SizedBox(width: 6),
                  Text(
                    'Gen Z Insider Tip: ',
                    style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Colors.amber.shade900),
                  ),
                  Expanded(
                    child: Text(
                      stop.genZTip,
                      style: TextStyle(fontSize: 11, color: Colors.amber.shade900, fontStyle: FontStyle.italic),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),

        const SizedBox(height: 10),

        // Crowd Status & Walking Time
        Row(
          children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(
                color: const Color(0xFFCCFBF1),
                borderRadius: BorderRadius.circular(6),
              ),
              child: Row(
                children: [
                  const Icon(Icons.speed, size: 13, color: Color(0xFF0F766E)),
                  const SizedBox(width: 4),
                  Text(
                    stop.crowdStatus,
                    style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF0F766E)),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            Text(
              '${stop.estimatedDistance} (${stop.walkingTime})',
              style: const TextStyle(fontSize: 11, color: Colors.black54),
            ),
            const Spacer(),
            // Open in Google Maps
            TextButton.icon(
              style: TextButton.styleFrom(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                minimumSize: const Size(50, 30),
                tapTargetSize: MaterialTapTargetSize.shrinkWrap,
              ),
              onPressed: () => _openGoogleMapsQuery(stop.googleMapsQuery),
              icon: const Icon(Icons.map, size: 14, color: Color(0xFF0F766E)),
              label: const Text(
                'Open in Maps',
                style: TextStyle(fontSize: 11, color: Color(0xFF0F766E), fontWeight: FontWeight.bold),
              ),
            ),
          ],
        ),
      ],
    );
  }
}
