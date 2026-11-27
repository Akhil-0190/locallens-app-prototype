import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:cloud_functions/cloud_functions.dart';
import '../config/app_config.dart';
import '../database/app_database.dart';
import '../models/app_failure.dart';
import '../models/spot_card.dart';

class SpotService {
  final AppDatabase? db;

  SpotService({this.db});

  Future<List<SpotCard>> getVerifiedSpots({String? neighborhood}) async {
    Object? firestoreError;
    // 1. Live Firestore query across `spots` and `places` collections
    try {
      for (final collectionName in const ['spots', 'places']) {
        Query<Map<String, dynamic>> query =
            FirebaseFirestore.instance.collection(collectionName);
        if (neighborhood != null && neighborhood.isNotEmpty) {
          query = query.where('neighborhood', isEqualTo: neighborhood);
        }
        final snapshot = await query.get();
        if (snapshot.docs.isNotEmpty) {
          final loaded = snapshot.docs
              .map((doc) => SpotCard.fromMap(doc.id, doc.data()))
              .where((s) => !s.isTouristTrap)
              .toList();
          if (loaded.isNotEmpty) {
            return loaded;
          }
        }
      }
    } catch (e) {
      firestoreError = e;
    }

    // 2. Local SQLite Drift cache (downloaded offline neighborhood packs)
    final localDb = db;
    if (localDb != null) {
      try {
        final localSpots = await (localDb.select(localDb.localSpots)
              ..where((s) => s.hasValidCoordinates.equals(true)))
            .get();
        if (localSpots.isNotEmpty) {
          return localSpots.map((r) => SpotCard(
                id: r.id,
                spotName: r.spotName,
                mapsLink: r.mapsLink,
                infoParagraph: r.infoParagraph,
                photoUrls: const [],
                openHours: r.openHours,
                practicalTips: r.practicalTips,
                greetingCard: r.greetingCard,
                isTouristTrap: r.isTouristTrap,
                hourlyLimit: r.hourlyLimit,
                currentVisitors: r.currentVisitors,
                vibeTags: const [],
                latitude: r.latitude,
                longitude: r.longitude,
                isMockData: false,
              )).toList();
        }
      } catch (_) {}
    }

    if (firestoreError != null) {
      throw AppFailure.network(
        'Unable to reach live neighborhood spots and no offline pack is downloaded yet.',
        firestoreError,
      );
    }

    return const [];
  }

  Future<void> submitNewSpot(SpotCard spot) async {
    await FirebaseFirestore.instance
        .collection('spots')
        .add(spot.toSubmissionMap());
  }

  /// Submits a persistent community signal (SAFETY_HYGIENE, DIALECT, or CROWD)
  /// to the `Community-submitPlaceSignal` Cloud Function.
  Future<Map<String, dynamic>> submitCommunityPlaceSignal({
    required String placeId,
    required String signalType, // 'SAFETY_HYGIENE' | 'DIALECT' | 'CROWD'
    String? crowdLevel,
    Map<String, dynamic>? dialectNote,
    Map<String, dynamic>? hygieneChecks,
    String? note,
  }) async {
    final functions = FirebaseFunctions.instanceFor(region: AppConfig.apiRegion);
    final callable = functions.httpsCallable('Community-submitPlaceSignal');
    final result = await callable.call<Map<String, dynamic>>({
      'placeId': placeId,
      'signalType': signalType,
      'crowdLevel': ?crowdLevel,
      'dialectNote': ?dialectNote,
      'hygieneChecks': ?hygieneChecks,
      if (note != null && note.trim().isNotEmpty) 'note': note.trim(),
    });
    final data = Map<String, dynamic>.from(result.data['data'] as Map? ?? {});
    return data;
  }
}