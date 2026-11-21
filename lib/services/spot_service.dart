import 'package:cloud_firestore/cloud_firestore.dart';
import '../database/app_database.dart';
import '../models/spot_card.dart';
import '../mock/sample_spots.dart';

class SpotService {
  final AppDatabase? db;

  SpotService({this.db});

  // FLIP TO FALSE AT CHECKPOINT 1 TO USE LIVE FIREBASE
  static const bool useMockData = false;

  Future<List<SpotCard>> getVerifiedSpots({String? neighborhood}) async {
    // 1. If Drift SQLite has cached spots from offline packs, prefer them when offline
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
                photoUrls: [],
                openHours: r.openHours,
                practicalTips: r.practicalTips,
                greetingCard: r.greetingCard,
                isTouristTrap: r.isTouristTrap,
                hourlyLimit: r.hourlyLimit,
                currentVisitors: r.currentVisitors,
                vibeTags: [],
                latitude: r.latitude,
                longitude: r.longitude,
              )).toList();
        }
      } catch (_) {}
    }

    if (!useMockData) {
      try {
        Query query = FirebaseFirestore.instance
            .collection('spots')
            .where('isTouristTrap', isEqualTo: false);
        if (neighborhood != null && neighborhood.isNotEmpty) {
          query = query.where('neighborhood', isEqualTo: neighborhood);
        }
        final snapshot = await query.get();
        if (snapshot.docs.isNotEmpty) {
          return snapshot.docs
              .map((doc) => SpotCard.fromMap(doc.id, doc.data() as Map<String, dynamic>))
              .toList();
        }
      } catch (_) {
        // Fall back gracefully to rich curated spots
      }
    }

    // Curated rich spots across supported neighborhoods
    if (neighborhood != null && neighborhood.isNotEmpty) {
      final matching = mockSampleSpots.where((s) =>
          s.mapsLink.toLowerCase().contains(neighborhood.toLowerCase()) ||
          s.infoParagraph.toLowerCase().contains(neighborhood.toLowerCase()) ||
          s.spotName.toLowerCase().contains(neighborhood.toLowerCase())).toList();
      if (matching.isNotEmpty) return matching;
    }

    return mockSampleSpots;
  }

  Future<void> submitNewSpot(SpotCard spot) async {
    if (useMockData) {
      mockSampleSpots.add(spot);
      return;
    }
    await FirebaseFirestore.instance
        .collection('spots')
        .add(spot.toSubmissionMap());
  }
}