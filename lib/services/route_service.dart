import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:cloud_functions/cloud_functions.dart';
import 'package:firebase_auth/firebase_auth.dart';
import '../database/app_database.dart';
import '../models/app_failure.dart';
import '../models/spot_card.dart';
import '../models/walking_route.dart';

/// Client route service providing walking routes and alternative (Plan-B) paths.
///
/// Calls `Maps-computeCapacityAwareRoute`, `Maps-computePlanBReroute`,
/// `Maps-reportVenueCrowd`, and `Maps-evaluateVenueCapacity`, with Drift SQLite
/// offline route cache fallback when downloaded packs exist.
class RouteService {
  final FirebaseFunctions? _functionsInstance;
  final AppDatabase? _db;

  RouteService({
    FirebaseFunctions? functions,
    AppDatabase? db,
  })  : _functionsInstance = functions,
        _db = db;

  FirebaseFunctions? get _functions {
    if (_functionsInstance != null) return _functionsInstance;
    try {
      return FirebaseFunctions.instanceFor(region: 'us-central1');
    } catch (_) {
      return null;
    }
  }

  String get _callerUid {
    try {
      return FirebaseAuth.instance.currentUser?.uid ?? 'guest_traveler';
    } catch (_) {
      return 'guest_traveler';
    }
  }

  Future<void> _cacheRouteLocally(WalkingRoute route) async {
    if (_db == null) return;
    try {
      await _db.into(_db.localRoutes).insertOnConflictUpdate(route.toCompanion());
    } catch (_) {}
  }

  /// Resolves real Firestore coordinates for stops when SpotCards are not explicitly supplied.
  Future<List<Map<String, dynamic>>> _resolveStopsPayload({
    required List<String> placeIds,
    List<SpotCard>? spots,
  }) async {
    if (spots != null && spots.length >= 2) {
      final valid = spots
          .where((s) => s.latitude != null && s.longitude != null)
          .map((s) => {
                'placeId': s.id,
                'spotName': s.spotName,
                'coordinate': {
                  'latitude': s.latitude!,
                  'longitude': s.longitude!,
                },
              })
          .toList();
      if (valid.length >= 2) return valid;
    }

    // Query live verified places from Firestore if coordinates aren't already in memory
    final resolved = <Map<String, dynamic>>[];
    try {
      final firestore = FirebaseFirestore.instance;
      for (final id in placeIds) {
        final placeDoc = await firestore.collection('places').doc(id).get();
        Map<String, dynamic>? data = placeDoc.exists ? placeDoc.data() : null;
        if (data == null) {
          final spotDoc = await firestore.collection('spots').doc(id).get();
          data = spotDoc.exists ? spotDoc.data() : null;
        }
        if (data != null) {
          final coords = data['coordinates'] is Map
              ? Map<String, dynamic>.from(data['coordinates'] as Map)
              : null;
          final lat = (coords?['latitude'] ?? data['latitude']) as num?;
          final lng = (coords?['longitude'] ?? data['longitude']) as num?;
          if (lat != null && lng != null) {
            resolved.add({
              'placeId': id,
              'spotName': (data['spotName'] ?? data['name'] ?? id).toString(),
              'coordinate': {
                'latitude': lat.toDouble(),
                'longitude': lng.toDouble(),
              },
            });
          }
        }
      }

      // If requested placeIds weren't in Firestore yet, fetch top verified places with real coordinates
      if (resolved.length < 2) {
        final topSnap = await firestore.collection('places').limit(6).get();
        for (final doc in topSnap.docs) {
          final data = doc.data();
          final coords = data['coordinates'] is Map
              ? Map<String, dynamic>.from(data['coordinates'] as Map)
              : null;
          final lat = (coords?['latitude'] ?? data['latitude']) as num?;
          final lng = (coords?['longitude'] ?? data['longitude']) as num?;
          if (lat != null && lng != null) {
            resolved.add({
              'placeId': doc.id,
              'spotName': (data['spotName'] ?? data['name'] ?? doc.id).toString(),
              'coordinate': {
                'latitude': lat.toDouble(),
                'longitude': lng.toDouble(),
              },
            });
            if (resolved.length >= 3) break;
          }
        }
      }
    } catch (_) {
      // Firestore unavailable in isolated test environment
    }

    return resolved;
  }

  /// Calls `Maps-computeCapacityAwareRoute` with full stop coordinates, caching
  /// successful routes into Drift `LocalRoutes`. Falls back strictly to cached
  /// SQLite offline routes if offline; throws [AppFailure] if unavailable.
  Future<WalkingRoute> getPersonalizedRoute({
    required List<String> placeIds,
    List<SpotCard>? spots,
    String routeTitle = 'Walking Trail',
    String neighborhood = 'Malleshwaram',
  }) async {
    Object? remoteError;
    final functions = _functions;
    if (functions != null) {
      try {
        final stopsPayload = await _resolveStopsPayload(
          placeIds: placeIds,
          spots: spots,
        );
        if (stopsPayload.length >= 2) {
          final callable = functions.httpsCallable('Maps-computeCapacityAwareRoute');
          final response = await callable.call<Map<String, dynamic>>({
            'title': routeTitle,
            'neighborhood': neighborhood,
            'stops': stopsPayload,
            'optimizeStopOrder': true,
            'walkingPace': 'MODERATE',
            'autoSubstituteFullStops': true,
            'allowMockFallback': false,
            'isGuestAccess': true,
            'userId': _callerUid,
          });

          final envelope = Map<String, dynamic>.from(response.data);
          final inner = envelope['data'] is Map
              ? Map<String, dynamic>.from(envelope['data'] as Map)
              : envelope;
          if (inner['route'] is Map) {
            final liveRoute = WalkingRoute.fromMap(
              Map<String, dynamic>.from(inner['route'] as Map),
            );
            await _cacheRouteLocally(liveRoute);
            return liveRoute;
          } else if (inner.containsKey('routeId')) {
            final liveRoute = WalkingRoute.fromMap(inner);
            await _cacheRouteLocally(liveRoute);
            return liveRoute;
          }
        }
      } catch (e) {
        remoteError = e;
      }
    }

    // Read cached route directly from Drift SQLite `LocalRoutes` when offline
    if (_db != null) {
      try {
        final rows = await _db.select(_db.localRoutes).get();
        if (rows.isNotEmpty) {
          final hoodLower = neighborhood.toLowerCase();
          final matched = rows.firstWhere(
            (r) => r.neighborhood.toLowerCase().contains(hoodLower),
            orElse: () => rows.first,
          );
          return WalkingRoute.fromLocalRoute(matched);
        }
      } catch (_) {}
    }

    throw AppFailure.network(
      'No live route or offline pack route available for $neighborhood. Check connectivity or download an offline pack.',
      remoteError,
    );
  }

  /// Requests a live 1-tap Plan-B alternative route via `Maps-computePlanBReroute`.
  Future<WalkingRoute> requestPlanBAlternative({
    required String originalRouteId,
    required String constrainedPlaceId,
    WalkingRoute? originalRoute,
    String disruptionType = 'VENUE_OVERCROWDED',
    String? disruptionDescription,
    bool preferIndoorAlternatives = false,
  }) async {
    final functions = _functions;
    if (functions == null || originalRoute == null) {
      throw AppFailure.network(
        'Cannot compute live Plan-B detour without network connectivity and an active route.',
      );
    }

    try {
      final callable = functions.httpsCallable('Maps-computePlanBReroute');
      final response = await callable.call<Map<String, dynamic>>({
        'originalRoute': originalRoute.toMap(),
        'disruptions': [
          {
            'type': disruptionType,
            'affectedPlaceId': constrainedPlaceId,
            'description': disruptionDescription ??
                '1-tap Plan B requested because venue is crowded or disrupted.',
            'severity': 'MODERATE',
            'signalTimestamp': DateTime.now().toUtc().toIso8601String(),
          },
        ],
        'preferredIndoorAlternatives': preferIndoorAlternatives,
        'allowMockFallback': false,
        'isGuestAccess': true,
        'userId': _callerUid,
      });

      final envelope = Map<String, dynamic>.from(response.data);
      final inner = envelope['data'] is Map
          ? Map<String, dynamic>.from(envelope['data'] as Map)
          : envelope;
      if (inner['updatedRoute'] is Map) {
        final alt = WalkingRoute.fromMap(
          Map<String, dynamic>.from(inner['updatedRoute'] as Map),
        );
        await _cacheRouteLocally(alt);
        return alt;
      } else if (inner['route'] is Map) {
        final alt = WalkingRoute.fromMap(
          Map<String, dynamic>.from(inner['route'] as Map),
        );
        await _cacheRouteLocally(alt);
        return alt;
      } else if (inner.containsKey('routeId')) {
        final alt = WalkingRoute.fromMap(inner);
        await _cacheRouteLocally(alt);
        return alt;
      }
      throw AppFailure.backend('Plan-B service did not return an updated route.');
    } on AppFailure {
      rethrow;
    } on FirebaseFunctionsException catch (e) {
      throw AppFailure.backend(
        e.message ?? 'Plan-B rerouting failed on server.',
        code: e.code,
        cause: e,
      );
    } catch (e) {
      throw AppFailure.network(
        'Unable to reach Plan-B routing service. Try again when online.',
        e,
      );
    }
  }

  /// Reports real-time venue crowd level via `Maps-reportVenueCrowd`.
  Future<Map<String, dynamic>> reportVenueCrowd({
    required String placeId,
    required String crowdLevel, // 'LOW', 'MODERATE', 'HIGH', 'AT_CAPACITY'
    int estimatedWaitMinutes = 0,
    bool isVerifiedResident = false,
  }) async {
    final functions = _functions;
    if (functions == null) {
      throw AppFailure.network('Crowd reporting requires an active network connection.');
    }

    try {
      final callable = functions.httpsCallable('Maps-reportVenueCrowd');
      final response = await callable.call<Map<String, dynamic>>({
        'placeId': placeId,
        'crowdLevel': crowdLevel,
        'estimatedWaitMinutes': estimatedWaitMinutes,
        'reporterType': isVerifiedResident ? 'LOCAL_RESIDENT' : 'VISITING_TRAVELER',
        'isGuestAccess': true,
        'userId': _callerUid,
      });
      final envelope = Map<String, dynamic>.from(response.data);
      final inner = envelope['data'] is Map
          ? Map<String, dynamic>.from(envelope['data'] as Map)
          : envelope;
      return {
        ...inner,
        'pointsAwarded': inner['rewardPointsEarned'] ?? inner['pointsAwarded'] ?? 10,
      };
    } on FirebaseFunctionsException catch (e) {
      throw AppFailure.backend(
        e.message ?? 'Failed to submit crowd report.',
        code: e.code,
        cause: e,
      );
    } catch (e) {
      throw AppFailure.network('Could not submit crowd report.', e);
    }
  }

  /// Queries live venue capacity & throttling disruptions for active route stops via
  /// `Maps-evaluateVenueCapacity`. Returns empty list when offline or all stops are clear.
  Future<List<DisruptionAlert>> getActiveDisruptions({
    WalkingRoute? route,
  }) async {
    if (_functions != null && route != null && route.waypointPlaceIds.isNotEmpty) {
      final alerts = <DisruptionAlert>[];
      final nowIso = DateTime.now().toUtc().toIso8601String();
      final expiresIso = DateTime.now().toUtc().add(const Duration(hours: 1)).toIso8601String();
      final callable = _functions!.httpsCallable('Maps-evaluateVenueCapacity');

      for (final placeId in route.waypointPlaceIds) {
        try {
          final response = await callable.call<Map<String, dynamic>>({
            'placeId': placeId,
            'intendedVisitTime': nowIso,
            'partySize': 1,
            'allowMockFallback': false,
            'isGuestAccess': true,
            'userId': _callerUid,
          });
          final envelope = Map<String, dynamic>.from(response.data);
          final eval = envelope['data'] is Map
              ? Map<String, dynamic>.from(envelope['data'] as Map)
              : envelope;
          final status = eval['status']?.toString() ?? '';
          final isThrottled = eval['isThrottled'] == true;
          final crowdLevel = eval['crowdLevel']?.toString() ?? '';

          if (isThrottled || status == 'AT_CAPACITY' || crowdLevel == 'HIGH') {
            final current = eval['currentVisitorsCount'] ?? 0;
            final max = eval['maxCapacity'] ?? 15;
            alerts.add(DisruptionAlert(
              disruptionId: 'live_crowd_${placeId}_${DateTime.now().millisecondsSinceEpoch}',
              impactedPlaceId: placeId,
              impactedRouteIds: [route.routeId],
              type: 'OVERCROWDED_THROTTLED',
              severity: isThrottled ? 'REROUTE_RECOMMENDED' : 'WARNING',
              description: eval['notes']?.toString() ??
                  '${placeId.replaceAll('_', ' ')} is currently busy ($current/$max visitors). Tap Plan-B to swap to a quieter nearby spot.',
              alternativeOptions: const [],
              activeFrom: nowIso,
              expiresAt: expiresIso,
            ));
          }
        } catch (_) {
          // Non-fatal per-stop check: continue evaluating remaining stops
        }
      }
      return alerts;
    }

    return const [];
  }
}
