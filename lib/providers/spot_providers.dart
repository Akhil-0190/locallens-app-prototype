import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/spot_card.dart';
import '../services/spot_service.dart';

final spotServiceProvider = Provider<SpotService>((ref) => SpotService());

final verifiedSpotsProvider = FutureProvider<List<SpotCard>>((ref) async {
  return ref.read(spotServiceProvider).getVerifiedSpots();
});

final selectedVibesProvider = StateProvider<Set<String>>(
      (ref) => {'Street Food', 'Heritage'},
);

final groupSizeProvider = StateProvider<int>((ref) => 1);