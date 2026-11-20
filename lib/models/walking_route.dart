// Domain 08: Routes & Route Stops and Domain 07: Venue Capacity & Alternatives
// Reference: docs/contracts/08-routes-and-route-stops.md & docs/contracts/07-venue-capacity-and-alternatives.md

class NormalizedCoordinate {
  final double latitude;
  final double longitude;
  final int precision;
  final String formatted;
  final bool isValid;

  const NormalizedCoordinate({
    required this.latitude,
    required this.longitude,
    this.precision = 6,
    required this.formatted,
    this.isValid = true,
  });

  factory NormalizedCoordinate.fromMap(Map<String, dynamic> map) {
    return NormalizedCoordinate(
      latitude: (map['latitude'] as num?)?.toDouble() ?? 0.0,
      longitude: (map['longitude'] as num?)?.toDouble() ?? 0.0,
      precision: (map['precision'] as num?)?.toInt() ?? 6,
      formatted: map['formatted']?.toString() ??
          '${map['latitude']}, ${map['longitude']}',
      isValid: map['isValid'] as bool? ?? true,
    );
  }

  Map<String, dynamic> toMap() => {
        'latitude': latitude,
        'longitude': longitude,
        'precision': precision,
        'formatted': formatted,
        'isValid': isValid,
      };
}

class RouteStep {
  final String instruction;
  final int distanceMeters;
  final int durationSeconds;
  final NormalizedCoordinate startCoordinate;
  final NormalizedCoordinate endCoordinate;

  const RouteStep({
    required this.instruction,
    required this.distanceMeters,
    required this.durationSeconds,
    required this.startCoordinate,
    required this.endCoordinate,
  });

  factory RouteStep.fromMap(Map<String, dynamic> map) {
    return RouteStep(
      instruction: map['instruction']?.toString() ?? '',
      distanceMeters: (map['distanceMeters'] as num?)?.toInt() ?? 0,
      durationSeconds: (map['durationSeconds'] as num?)?.toInt() ?? 0,
      startCoordinate: NormalizedCoordinate.fromMap(
        Map<String, dynamic>.from(map['startCoordinate'] ?? {}),
      ),
      endCoordinate: NormalizedCoordinate.fromMap(
        Map<String, dynamic>.from(map['endCoordinate'] ?? {}),
      ),
    );
  }

  Map<String, dynamic> toMap() => {
        'instruction': instruction,
        'distanceMeters': distanceMeters,
        'durationSeconds': durationSeconds,
        'startCoordinate': startCoordinate.toMap(),
        'endCoordinate': endCoordinate.toMap(),
      };
}

class RouteLeg {
  final String? startPlaceId;
  final String? endPlaceId;
  final int distanceMeters;
  final int durationSeconds;
  final NormalizedCoordinate startCoordinate;
  final NormalizedCoordinate endCoordinate;
  final List<RouteStep> steps;

  const RouteLeg({
    this.startPlaceId,
    this.endPlaceId,
    required this.distanceMeters,
    required this.durationSeconds,
    required this.startCoordinate,
    required this.endCoordinate,
    required this.steps,
  });

  factory RouteLeg.fromMap(Map<String, dynamic> map) {
    final rawSteps = map['steps'] as List<dynamic>? ?? [];
    return RouteLeg(
      startPlaceId: map['startPlaceId']?.toString(),
      endPlaceId: map['endPlaceId']?.toString(),
      distanceMeters: (map['distanceMeters'] as num?)?.toInt() ?? 0,
      durationSeconds: (map['durationSeconds'] as num?)?.toInt() ?? 0,
      startCoordinate: NormalizedCoordinate.fromMap(
        Map<String, dynamic>.from(map['startCoordinate'] ?? {}),
      ),
      endCoordinate: NormalizedCoordinate.fromMap(
        Map<String, dynamic>.from(map['endCoordinate'] ?? {}),
      ),
      steps: rawSteps
          .map((s) => RouteStep.fromMap(Map<String, dynamic>.from(s)))
          .toList(),
    );
  }

  Map<String, dynamic> toMap() => {
        if (startPlaceId != null) 'startPlaceId': startPlaceId,
        if (endPlaceId != null) 'endPlaceId': endPlaceId,
        'distanceMeters': distanceMeters,
        'durationSeconds': durationSeconds,
        'startCoordinate': startCoordinate.toMap(),
        'endCoordinate': endCoordinate.toMap(),
        'steps': steps.map((s) => s.toMap()).toList(),
      };
}

class WalkingRoute {
  final String routeId;
  final String title;
  final String neighborhood;
  final String theme;
  final NormalizedCoordinate origin;
  final NormalizedCoordinate destination;
  final List<NormalizedCoordinate> waypoints;
  final List<String> waypointPlaceIds;
  final List<int> optimizedWaypointOrder;
  final int totalDistanceMeters;
  final int totalDurationSeconds;
  final String formattedDistance;
  final String formattedDuration;
  final String encodedPolyline;
  final List<RouteLeg> legs;
  final bool isMockData;
  final String createdAt;
  final String updatedAt;

  const WalkingRoute({
    required this.routeId,
    required this.title,
    required this.neighborhood,
    required this.theme,
    required this.origin,
    required this.destination,
    required this.waypoints,
    required this.waypointPlaceIds,
    required this.optimizedWaypointOrder,
    required this.totalDistanceMeters,
    required this.totalDurationSeconds,
    required this.formattedDistance,
    required this.formattedDuration,
    required this.encodedPolyline,
    required this.legs,
    this.isMockData = true,
    required this.createdAt,
    required this.updatedAt,
  });

  factory WalkingRoute.fromMap(Map<String, dynamic> map) {
    final rawWaypoints = map['waypoints'] as List<dynamic>? ?? [];
    final rawPlaceIds = map['waypointPlaceIds'] as List<dynamic>? ?? [];
    final rawOrder = map['optimizedWaypointOrder'] as List<dynamic>? ?? [];
    final rawLegs = map['legs'] as List<dynamic>? ?? [];

    return WalkingRoute(
      routeId: map['routeId']?.toString() ?? '',
      title: map['title']?.toString() ?? 'Walking Tour',
      neighborhood: map['neighborhood']?.toString() ?? 'Neighborhood',
      theme: map['theme']?.toString() ?? 'Walking Trail',
      origin: NormalizedCoordinate.fromMap(
        Map<String, dynamic>.from(map['origin'] ?? {}),
      ),
      destination: NormalizedCoordinate.fromMap(
        Map<String, dynamic>.from(map['destination'] ?? {}),
      ),
      waypoints: rawWaypoints
          .map((w) => NormalizedCoordinate.fromMap(Map<String, dynamic>.from(w)))
          .toList(),
      waypointPlaceIds: rawPlaceIds.map((p) => p.toString()).toList(),
      optimizedWaypointOrder:
          rawOrder.map((o) => (o as num).toInt()).toList(),
      totalDistanceMeters:
          (map['totalDistanceMeters'] as num?)?.toInt() ?? 0,
      totalDurationSeconds:
          (map['totalDurationSeconds'] as num?)?.toInt() ?? 0,
      formattedDistance: map['formattedDistance']?.toString() ?? '1.1 km',
      formattedDuration: map['formattedDuration']?.toString() ?? '15 mins',
      encodedPolyline: map['encodedPolyline']?.toString() ?? '',
      legs: rawLegs
          .map((l) => RouteLeg.fromMap(Map<String, dynamic>.from(l)))
          .toList(),
      isMockData: map['isMockData'] as bool? ?? true,
      createdAt: map['createdAt']?.toString() ?? DateTime.now().toIso8601String(),
      updatedAt: map['updatedAt']?.toString() ?? DateTime.now().toIso8601String(),
    );
  }

  Map<String, dynamic> toMap() => {
        'routeId': routeId,
        'title': title,
        'neighborhood': neighborhood,
        'theme': theme,
        'origin': origin.toMap(),
        'destination': destination.toMap(),
        'waypoints': waypoints.map((w) => w.toMap()).toList(),
        'waypointPlaceIds': waypointPlaceIds,
        'optimizedWaypointOrder': optimizedWaypointOrder,
        'totalDistanceMeters': totalDistanceMeters,
        'totalDurationSeconds': totalDurationSeconds,
        'formattedDistance': formattedDistance,
        'formattedDuration': formattedDuration,
        'encodedPolyline': encodedPolyline,
        'legs': legs.map((l) => l.toMap()).toList(),
        'isMockData': isMockData,
        'createdAt': createdAt,
        'updatedAt': updatedAt,
      };
}

/// Domain 07: Disruption and Alternative Options
class AlternativeOption {
  final String alternativePlaceId;
  final String alternativePlaceName;
  final int detourDistanceMeters;
  final bool indoorAlternative;

  const AlternativeOption({
    required this.alternativePlaceId,
    required this.alternativePlaceName,
    required this.detourDistanceMeters,
    required this.indoorAlternative,
  });

  factory AlternativeOption.fromMap(Map<String, dynamic> map) {
    return AlternativeOption(
      alternativePlaceId: map['alternativePlaceId']?.toString() ?? '',
      alternativePlaceName: map['alternativePlaceName']?.toString() ?? '',
      detourDistanceMeters:
          (map['detourDistanceMeters'] as num?)?.toInt() ?? 0,
      indoorAlternative: map['indoorAlternative'] as bool? ?? false,
    );
  }
}

class DisruptionAlert {
  final String disruptionId;
  final String impactedPlaceId;
  final List<String> impactedRouteIds;
  final String type;
  final String severity;
  final String description;
  final List<AlternativeOption> alternativeOptions;
  final String activeFrom;
  final String expiresAt;

  const DisruptionAlert({
    required this.disruptionId,
    required this.impactedPlaceId,
    this.impactedRouteIds = const [],
    required this.type,
    required this.severity,
    required this.description,
    this.alternativeOptions = const [],
    required this.activeFrom,
    required this.expiresAt,
  });

  factory DisruptionAlert.fromMap(Map<String, dynamic> map) {
    final rawOptions = map['alternativeOptions'] as List<dynamic>? ?? [];
    final rawRouteIds = map['impactedRouteIds'] as List<dynamic>? ?? [];
    return DisruptionAlert(
      disruptionId: map['disruptionId']?.toString() ?? '',
      impactedPlaceId: map['impactedPlaceId']?.toString() ?? '',
      impactedRouteIds: rawRouteIds.map((r) => r.toString()).toList(),
      type: map['type']?.toString() ?? 'OVERCROWDED_THROTTLED',
      severity: map['severity']?.toString() ?? 'REROUTE_RECOMMENDED',
      description: map['description']?.toString() ?? '',
      alternativeOptions: rawOptions
          .map((o) => AlternativeOption.fromMap(Map<String, dynamic>.from(o)))
          .toList(),
      activeFrom: map['activeFrom']?.toString() ?? '',
      expiresAt: map['expiresAt']?.toString() ?? '',
    );
  }
}
