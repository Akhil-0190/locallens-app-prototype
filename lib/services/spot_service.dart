import 'package:cloud_firestore/cloud_firestore.dart';
import '../models/spot_card.dart';
import '../mock/sample_spots.dart';

class SpotService {
  // FLIP TO FALSE AT CHECKPOINT 1 TO USE LIVE FIREBASE
  static const bool useMockData = true;

  Future<List<SpotCard>> getVerifiedSpots() async {
    if (useMockData) {
      return mockSampleSpots;
    }
    final snapshot = await FirebaseFirestore.instance
        .collection('spots')
        .where('isTouristTrap', isEqualTo: false)
        .get();
    return snapshot.docs
        .map((doc) => SpotCard.fromMap(doc.id, doc.data()))
        .toList();
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