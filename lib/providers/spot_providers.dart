import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../database/app_database.dart';
import '../models/spot_card.dart';
import '../services/spot_service.dart';

/// Database provider for offline SQLite/Drift storage.
final appDatabaseProvider = Provider<AppDatabase>((ref) {
  final db = AppDatabase();
  ref.onDispose(() => db.close());
  return db;
});

/// Service provider for spot queries (mock or live Firestore).
final spotServiceProvider = Provider<SpotService>((ref) => SpotService());

/// Asynchronously provides verified spots from SpotService.
final verifiedSpotsProvider = FutureProvider<List<SpotCard>>((ref) async {
  return ref.watch(spotServiceProvider).getVerifiedSpots();
});

/// Traveler preference: selected vibes.
final selectedVibesProvider = StateProvider<Set<String>>(
  (ref) => {'Street Food', 'Heritage'},
);

/// Traveler preference: group size.
final groupSizeProvider = StateProvider<int>((ref) => 1);

/// Matched route spots state managed via Riverpod.
final matchedRouteProvider = StateProvider<List<SpotCard>>((ref) => []);

/// Crowded spots state managed via Riverpod.
final crowdedSpotsProvider = StateProvider<List<SpotCard>>((ref) => []);

/// State flag indicating route generation in progress.
final isGeneratingRouteProvider = StateProvider<bool>((ref) => false);

/// State flag indicating whether route matching has been executed.
final hasGeneratedRouteProvider = StateProvider<bool>((ref) => false);
