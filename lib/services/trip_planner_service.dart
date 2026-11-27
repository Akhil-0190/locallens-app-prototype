import 'package:cloud_functions/cloud_functions.dart';
import 'package:geolocator/geolocator.dart';
import '../models/app_failure.dart';
import '../models/trip_plan.dart';

/// Service responsible for generating intelligent, uncrowded multi-day trip plans
/// using Gemini-powered AI, real-time transit guidance, and crowd throttling.
class TripPlannerService {
  final FirebaseFunctions? _functionsInstance;

  TripPlannerService({
    FirebaseFunctions? functions,
  }) : _functionsInstance = functions;

  FirebaseFunctions? get _functions {
    if (_functionsInstance != null) return _functionsInstance;
    try {
      return FirebaseFunctions.instanceFor(region: 'us-central1');
    } catch (_) {
      return null;
    }
  }

  /// Detects the traveler's current physical location via GPS with friendly fallbacks.
  Future<Map<String, dynamic>> detectCurrentLocation() async {
    try {
      bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) {
        return {
          'name': 'Bengaluru Central (MG Road Metro)',
          'latitude': 12.9756,
          'longitude': 77.6066,
          'isGps': false,
        };
      }

      LocationPermission permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
        if (permission == LocationPermission.denied) {
          return {
            'name': 'Bengaluru Central (MG Road Metro)',
            'latitude': 12.9756,
            'longitude': 77.6066,
            'isGps': false,
          };
        }
      }

      if (permission == LocationPermission.deniedForever) {
        return {
          'name': 'Bengaluru Central (MG Road Metro)',
          'latitude': 12.9756,
          'longitude': 77.6066,
          'isGps': false,
        };
      }

      final position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.medium,
          timeLimit: Duration(seconds: 4),
        ),
      );

      return {
        'name': 'Current Location (${position.latitude.toStringAsFixed(4)}, ${position.longitude.toStringAsFixed(4)})',
        'latitude': position.latitude,
        'longitude': position.longitude,
        'isGps': true,
      };
    } catch (_) {
      return {
        'name': 'Bengaluru Central (MG Road Metro)',
        'latitude': 12.9756,
        'longitude': 77.6066,
        'isGps': false,
      };
    }
  }

  /// Generates a complete uncrowded trip plan via `Assistance-generateTripPlan`.
  /// Throws [AppFailure] on failure instead of returning fabricated places.
  Future<TripPlan> generateTripPlan({
    required String destination,
    required int groupSize,
    required List<String> vibes,
    String? customVibeText,
    required List<String> priorities,
    required int durationDays,
    required String detailLevel,
    required Map<String, dynamic> currentLocation,
  }) async {
    final functions = _functions;
    if (functions == null) {
      throw AppFailure.network('Firebase Functions is unavailable. Cannot generate trip plan offline.');
    }

    try {
      final callable = functions.httpsCallable('Assistance-generateTripPlan');
      final response = await callable.call<Map<String, dynamic>>({
        'destination': destination,
        'groupSize': groupSize,
        'vibes': vibes,
        'customVibeText': customVibeText,
        'priorities': priorities,
        'durationDays': durationDays,
        'detailLevel': detailLevel,
        'currentLocation': currentLocation,
        'isGuestAccess': true,
      });

      final data = response.data['data'] as Map<String, dynamic>? ?? response.data;
      if (data.isEmpty) {
        throw AppFailure.backend('Trip planner returned an empty itinerary.');
      }
      return TripPlan.fromMap(data);
    } on AppFailure {
      rethrow;
    } on FirebaseFunctionsException catch (e) {
      throw AppFailure.backend(
        e.message ?? 'Could not generate trip itinerary.',
        code: e.code,
        cause: e,
      );
    } catch (e) {
      throw AppFailure.network(
        'Unable to generate live trip plan. Check connectivity and try again.',
        e,
      );
    }
  }
}
