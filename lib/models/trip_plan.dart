class TransitGuidance {
  final String fromLocation;
  final String toDestination;
  final String distance;
  final String estimatedDuration;
  final String recommendedMode;
  final List<String> stepByStepInstructions;

  const TransitGuidance({
    required this.fromLocation,
    required this.toDestination,
    required this.distance,
    required this.estimatedDuration,
    required this.recommendedMode,
    required this.stepByStepInstructions,
  });

  factory TransitGuidance.fromMap(Map<String, dynamic> map) {
    return TransitGuidance(
      fromLocation: map['fromLocation'] as String? ?? 'Your Current Location',
      toDestination: map['toDestination'] as String? ?? 'Target Neighborhood',
      distance: map['distance'] as String? ?? '8.5 km',
      estimatedDuration: map['estimatedDuration'] as String? ?? '25 mins',
      recommendedMode: map['recommendedMode'] as String? ?? 'Metro / Quick Cab',
      stepByStepInstructions: (map['stepByStepInstructions'] as List<dynamic>?)
              ?.map((e) => e.toString())
              .toList() ??
          const ['Head towards nearest metro/transit line towards destination'],
    );
  }

  Map<String, dynamic> toMap() => {
        'fromLocation': fromLocation,
        'toDestination': toDestination,
        'distance': distance,
        'estimatedDuration': estimatedDuration,
        'recommendedMode': recommendedMode,
        'stepByStepInstructions': stepByStepInstructions,
      };
}

class TripStop {
  final String name;
  final String timeSlot;
  final String category;
  final String whyLocalsLoveIt;
  final String genZTip;
  final String crowdStatus;
  final String estimatedDistance;
  final String walkingTime;
  final String googleMapsQuery;
  final String photoUrl;

  const TripStop({
    required this.name,
    required this.timeSlot,
    required this.category,
    required this.whyLocalsLoveIt,
    required this.genZTip,
    required this.crowdStatus,
    required this.estimatedDistance,
    required this.walkingTime,
    required this.googleMapsQuery,
    required this.photoUrl,
  });

  factory TripStop.fromMap(Map<String, dynamic> map) {
    return TripStop(
      name: map['name'] as String? ?? 'Authentic Local Spot',
      timeSlot: map['timeSlot'] as String? ?? 'Morning Slot',
      category: map['category'] as String? ?? 'Hidden Gem',
      whyLocalsLoveIt: map['whyLocalsLoveIt'] as String? ?? 'Authentic family-run eatery beloved by residents.',
      genZTip: map['genZTip'] as String? ?? 'Order the specialty kapi and ask for the courtyard window seat.',
      crowdStatus: map['crowdStatus'] as String? ?? 'Low crowd (2/6 capacity)',
      estimatedDistance: map['estimatedDistance'] as String? ?? '400m',
      walkingTime: map['walkingTime'] as String? ?? '5 min walk',
      googleMapsQuery: map['googleMapsQuery'] as String? ?? map['name'] as String? ?? '',
      photoUrl: map['photoUrl'] as String? ??
          'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=600&auto=format&fit=crop&q=80',
    );
  }

  Map<String, dynamic> toMap() => {
        'name': name,
        'timeSlot': timeSlot,
        'category': category,
        'whyLocalsLoveIt': whyLocalsLoveIt,
        'genZTip': genZTip,
        'crowdStatus': crowdStatus,
        'estimatedDistance': estimatedDistance,
        'walkingTime': walkingTime,
        'googleMapsQuery': googleMapsQuery,
        'photoUrl': photoUrl,
      };
}

class TripDay {
  final int dayNumber;
  final String theme;
  final List<TripStop> stops;

  const TripDay({
    required this.dayNumber,
    required this.theme,
    required this.stops,
  });

  factory TripDay.fromMap(Map<String, dynamic> map) {
    return TripDay(
      dayNumber: map['dayNumber'] as int? ?? 1,
      theme: map['theme'] as String? ?? 'Cultural Discovery & Bites',
      stops: (map['stops'] as List<dynamic>?)
              ?.map((s) => TripStop.fromMap(Map<String, dynamic>.from(s as Map)))
              .toList() ??
          [],
    );
  }

  Map<String, dynamic> toMap() => {
        'dayNumber': dayNumber,
        'theme': theme,
        'stops': stops.map((s) => s.toMap()).toList(),
      };
}

class TripPlan {
  final String destination;
  final int groupSize;
  final int durationDays;
  final String detailLevel;
  final TransitGuidance transit;
  final String overallSummary;
  final List<TripDay> days;
  final bool isAIGenerated;

  const TripPlan({
    required this.destination,
    required this.groupSize,
    required this.durationDays,
    required this.detailLevel,
    required this.transit,
    required this.overallSummary,
    required this.days,
    this.isAIGenerated = true,
  });

  factory TripPlan.fromMap(Map<String, dynamic> map) {
    return TripPlan(
      destination: map['destination'] as String? ?? 'Neighborhood Trail',
      groupSize: map['groupSize'] as int? ?? 1,
      durationDays: map['durationDays'] as int? ?? 1,
      detailLevel: map['detailLevel'] as String? ?? 'detailed',
      transit: map['transitGuidance'] != null
          ? TransitGuidance.fromMap(Map<String, dynamic>.from(map['transitGuidance'] as Map))
          : const TransitGuidance(
              fromLocation: 'Current Location',
              toDestination: 'Target Neighborhood',
              distance: 'Approx 5 km',
              estimatedDuration: '20 mins',
              recommendedMode: 'Direct Auto / Metro',
              stepByStepInstructions: ['Head towards destination via main avenue.'],
            ),
      overallSummary: map['overallSummary'] as String? ?? 'Personalized uncrowded walking plan.',
      days: (map['days'] as List<dynamic>?)
              ?.map((d) => TripDay.fromMap(Map<String, dynamic>.from(d as Map)))
              .toList() ??
          [],
      isAIGenerated: map['isAIGenerated'] as bool? ?? true,
    );
  }

  Map<String, dynamic> toMap() => {
        'destination': destination,
        'groupSize': groupSize,
        'durationDays': durationDays,
        'detailLevel': detailLevel,
        'transitGuidance': transit.toMap(),
        'overallSummary': overallSummary,
        'days': days.map((d) => d.toMap()).toList(),
        'isAIGenerated': isAIGenerated,
      };
}
