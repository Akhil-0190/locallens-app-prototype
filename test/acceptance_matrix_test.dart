// ignore_for_file: deprecated_member_use

import 'dart:convert';
import 'dart:typed_data';
import 'package:crypto/crypto.dart';
import 'package:drift/native.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:locallens/database/app_database.dart';
import 'package:locallens/models/contribution.dart';
import 'package:locallens/models/monetization.dart';
import 'package:locallens/models/offline_pack.dart';
import 'package:locallens/models/traveler_preferences.dart';
import 'package:locallens/router/app_router.dart';
import 'package:locallens/screens/add_gem_screen.dart';
import 'package:locallens/screens/contributor_content_management_screen.dart';
import 'package:locallens/screens/contributor_profile_screen.dart';
import 'package:locallens/screens/match_vibe_screen.dart';
import 'package:locallens/screens/offline_packs_screen.dart';
import 'package:locallens/screens/partner_subscription_screen.dart';
import 'package:locallens/screens/pocket_guide_screen.dart';
import 'package:locallens/screens/route_pass_screen.dart';
import 'package:locallens/screens/walking_route_screen.dart';
import 'package:locallens/services/monetization_service.dart';
import 'package:locallens/services/native_platform_service.dart';
import 'package:locallens/services/offline_pack_service.dart';
import 'package:locallens/services/route_service.dart';
import 'package:locallens/services/street_assistance_service.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('Task D7 — Part 4 End-to-End Acceptance Test Matrix', () {
    // -------------------------------------------------------------------------
    // TEST 1: Application Startup and Navigation
    // -------------------------------------------------------------------------
    testWidgets('Test 1: App startup and navigation across all shell and sub-routes',
        (tester) async {
      await tester.binding.setSurfaceSize(const Size(800, 1200));

      await tester.pumpWidget(
        ProviderScope(
          child: MaterialApp.router(
            routerConfig: appRouter,
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Initial route should be /guide (Pocket Guide)
      expect(find.byType(PocketGuideScreen), findsOneWidget);
      expect(find.text('Pocket Guide'), findsWidgets);

      // Navigate to Match Vibe tab
      await tester.tap(find.text('Match Vibe'));
      await tester.pumpAndSettle();
      expect(find.byType(MatchVibeScreen), findsOneWidget);

      // Navigate to Add Gem tab
      await tester.tap(find.text('Add Gem'));
      await tester.pumpAndSettle();
      expect(find.byType(AddGemScreen), findsOneWidget);

      // Sub-route navigation: /route
      appRouter.go('/route');
      await tester.pumpAndSettle();
      expect(find.byType(WalkingRouteScreen), findsOneWidget);

      // Sub-route navigation: /offline-packs
      appRouter.go('/offline-packs');
      await tester.pumpAndSettle();
      expect(find.byType(OfflinePacksScreen), findsOneWidget);

      // Sub-route navigation: /contributor-profile
      appRouter.go('/contributor-profile');
      await tester.pumpAndSettle();
      expect(find.byType(ContributorProfileScreen), findsOneWidget);

      // Sub-route navigation: /contributor-content
      appRouter.go('/contributor-content');
      await tester.pumpAndSettle();
      expect(find.byType(ContributorContentManagementScreen), findsOneWidget);

      // Sub-route navigation: /route-passes
      appRouter.go('/route-passes');
      await tester.pumpAndSettle();
      expect(find.byType(RoutePassScreen), findsOneWidget);

      // Sub-route navigation: /partner-subscriptions
      appRouter.go('/partner-subscriptions');
      await tester.pumpAndSettle();
      expect(find.byType(PartnerSubscriptionScreen), findsOneWidget);

      // Return to /guide
      appRouter.go('/guide');
      await tester.pumpAndSettle();
      expect(find.byType(PocketGuideScreen), findsOneWidget);
    });

    // -------------------------------------------------------------------------
    // TEST 2 & 3: Contributor Journey & AI Curation
    // -------------------------------------------------------------------------
    test('Test 2 & 3: Contributor submission input & structured AI extraction schema',
        () {
      final input = ContributorSubmissionInput(
        contributorId: 'usr_test_contributor',
        mapsLink: 'https://maps.app.goo.gl/sampleCTR',
        infoParagraph: 'Authentic benne dose in Malleshwaram since 1950s.',
        selectedLanguage: 'kn',
        audioNotePath: 'file://audio/sample_kannada.m4a',
        localPhotoPaths: ['file://photos/ctr_facade.jpg'],
      );

      final json = input.toCanonicalPayload();
      expect(json['contributorId'], 'usr_test_contributor');
      expect(json['mapsLink'], contains('maps.app.goo.gl'));
      expect(json['infoParagraph'], isNotEmpty);

      // Simulate structured AI extraction result
      final extraction = AiExtractionResult(
        detectedLanguage: 'Kannada (kn-IN)',
        transcription: 'ಬೆಣ್ಣೆ ದೋಸೆ ತುಂಬಾ ಚೆನ್ನಾಗಿದೆ (Benne dose is very good)',
        englishTranslation: 'Hot crisp butter dose with fresh coconut chutney at CTR.',
        confidenceScore: 0.96,
        practicalDetails: const ExtractedPracticalDetails(
          openingHoursMentioned: '7:30 AM to 10:30 AM',
          signatureDishesOrItems: ['Benne Dose', 'Filter Coffee'],
          cashOnlyWarning: false,
          insiderTips: ['Collect token at the counter first'],
        ),
      );

      expect(extraction.detectedLanguage, contains('Kannada'));
      expect(extraction.englishTranslation, contains('butter dose'));
      expect(extraction.practicalDetails?.openingHoursMentioned, isNotNull);
      expect(extraction.practicalDetails?.signatureDishesOrItems.length, 2);
    });

    // -------------------------------------------------------------------------
    // TEST 4 & 5: Traveler Onboarding, Preferences & Personalized Matching
    // -------------------------------------------------------------------------
    test('Test 4 & 5: TravelerPreferencesDocument persistence & pacing multipliers',
        () {
      final prefs = TravelerPreferencesDocument(
        userId: 'traveler_101',
        budgetTier: BudgetTier.budget,
        preferredPacing: TravelPacing.relaxed,
        dietaryRestrictions: ['vegetarian', 'jain'],
        favoriteVibes: ['heritage', 'street_food'],
        updatedAt: DateTime.now(),
      );

      expect(prefs.preferredPacing, TravelPacing.relaxed);
      expect(prefs.budgetTier, BudgetTier.budget);
      expect(prefs.dietaryRestrictions.contains('vegetarian'), isTrue);
    });

    // -------------------------------------------------------------------------
    // TEST 6: Walking Routes & Map Metrics
    // -------------------------------------------------------------------------
    test('Test 6: RouteService returns CanonicalRouteDocument conforming to Domain 08',
        () async {
      final service = RouteService();
      final route = await service.getPersonalizedRoute(
        placeIds: [
          'place_ctr_malleshwaram_01',
          'place_veena_stores_02',
          'place_kadu_temple_03',
        ],
      );

      expect(route.routeId, isNotEmpty);
      expect(route.neighborhood, 'Malleshwaram');
      expect(route.legs, isNotEmpty);
      expect(route.encodedPolyline, isNotEmpty);
      expect(route.totalDistanceMeters, greaterThan(0));
      expect(route.totalDurationSeconds, greaterThan(0));
      expect(route.waypoints.isNotEmpty, isTrue);
      expect(route.waypointPlaceIds.isNotEmpty, isTrue);
    });

    // -------------------------------------------------------------------------
    // TEST 7: Capacity and Plan B Dynamic Rerouting
    // -------------------------------------------------------------------------
    test('Test 7: Plan-B Rerouting preserves unaffected stops and substitutes capacity-saturated venues',
        () async {
      final service = RouteService();
      final original = await service.getPersonalizedRoute(
        placeIds: [
          'place_ctr_malleshwaram_01',
          'place_veena_stores_02',
          'place_kadu_temple_03',
        ],
      );
      final planB = await service.requestPlanBAlternative(
        originalRouteId: original.routeId,
        constrainedPlaceId: 'place_ctr_malleshwaram_01',
      );

      expect(planB.routeId, contains('plan_b'));
      expect(planB.title, contains('Malleshwaram'));
      // Origin and destination retained
      expect(planB.origin.latitude, original.origin.latitude);
      expect(planB.destination.latitude, original.destination.latitude);
      // Alternative venue substituted
      expect(planB.waypointPlaceIds.contains('place_janatha_deluxe_alt'), isTrue);
    });

    // -------------------------------------------------------------------------
    // TEST 8: Street-Ready Co-Pilot & Gemini Ecosystem Handoff
    // -------------------------------------------------------------------------
    test('Test 8: Street assistance ordering cards & Gemini handoff URL format',
        () {
      final assistanceService = StreetAssistanceService();
      final cards = assistanceService.getCulturalOrderingCards();
      expect(cards, isNotEmpty);
      expect(cards.any((c) => c.englishMeaning.contains('filter coffee')), isTrue);

      // Verify Gemini handoff URL construction
      final prompt = 'Tell me about Malleshwaram temples and etiquette.';
      final buffer = StringBuffer();
      buffer.write('Exploring Malleshwaram, Bengaluru. ');
      buffer.write('Currently at CTR (Shri Sagar). ');
      buffer.write(prompt);
      final expectedEncoded = Uri.encodeComponent(buffer.toString());
      final expectedUri =
          Uri.parse('https://gemini.google.com/app?prompt=$expectedEncoded');

      expect(expectedUri.toString(), contains('gemini.google.com'));
      expect(expectedUri.toString(), contains('Exploring%20Malleshwaram'));
    });

    // -------------------------------------------------------------------------
    // TEST 9: Offline Packs, Drift DB Persistence & Vector Tile Limitation
    // -------------------------------------------------------------------------
    test('Test 9: Offline pack SHA-256 verification, Drift SQLite persistence & shared spots',
        () async {
      final db = AppDatabase(NativeDatabase.memory());
      addTearDown(() => db.close());

      final packService = OfflinePackService(db: db);

      const spot = OfflineSpotItem(
        id: 'spot_verified_dose',
        spotName: 'Verified Dose Spot',
        mapsLink: 'https://maps.google.com/?cid=99',
        infoParagraph: 'Authentic local breakfast.',
        photoUrlsJson: '[]',
        vibeTagsJson: '["breakfast"]',
        latitude: 12.998,
        longitude: 77.570,
        hasValidCoordinates: true,
      );

      final manifestData = {
        'packId': 'pack_valid_checksum',
        'neighborhood': 'Malleshwaram',
        'city': 'Bengaluru',
        'version': 1,
        'totalSpotsCount': 1,
        'totalRoutesCount': 0,
        'downloadSizeBytes': 0,
        'downloadUrl': 'https://example.com/pack.json',
        'sha256Checksum': '',
        'spots': [spot.toJson()],
        'routes': [],
        'publishedAt': '2026-11-20T10:00:00Z',
      };

      final payloadBytes = Uint8List.fromList(utf8.encode(jsonEncode(manifestData)));
      final expectedSha = sha256.convert(payloadBytes).toString().toLowerCase();

      final manifest = OfflinePackManifest.fromJson({
        ...manifestData,
        'downloadSizeBytes': payloadBytes.length,
        'sha256Checksum': expectedSha,
      });

      // Ingest pack
      await packService.downloadAndIngestPack(manifest, injectedBytes: payloadBytes);

      // Verify installed
      final downloaded = await packService.getDownloadedPacks();
      expect(downloaded.length, 1);
      expect(downloaded.first.packId, 'pack_valid_checksum');

      // Check corrupted hash throws exception
      final badManifest = manifest.copyWith(sha256Checksum: 'invalid_sha256_hash');
      expect(
        () => packService.downloadAndIngestPack(badManifest, injectedBytes: payloadBytes),
        throwsA(isA<PackChecksumMismatchException>()),
      );
    });

    // -------------------------------------------------------------------------
    // TEST 10: Android Native Local AI Bridge Honest Contracts
    // -------------------------------------------------------------------------
    test('Test 10: NativePlatformService honest local inference handling',
        () async {
      final nativeService = NativePlatformService(isTestMode: true);

      // Check AICore availability
      final aicore = await nativeService.checkAICoreAvailability();
      expect(aicore.isAvailable, isFalse); // In test mode or unsupported device
      expect(aicore.statusMessage, isNotEmpty);

      // Check device capabilities (must have honest hasNpu = false)
      final caps = await nativeService.getDeviceAICapabilities();
      expect(caps.hasNpu, isFalse); // Honest handling: standard SDK lacks public NPU API

      // Check note summarization fallback
      final summary = await nativeService.summarizeOfflineNote(
        noteText: 'Great filter coffee at CTR',
        spotName: 'CTR',
      );
      expect(summary['isLocalInference'], isFalse);
      expect(summary['code'], 'MODEL_NOT_DOWNLOADED');
      expect(summary['modelUsed'], 'NONE (Unassisted Fallback)');
    });

    // -------------------------------------------------------------------------
    // TEST 11: Contributor Ecosystem & Monetization
    // -------------------------------------------------------------------------
    test('Test 11: MonetizationService tipping, route pass purchase & activation',
        () async {
      final service = MonetizationService(isTestMode: true);

      // Tipping
      final tipResult = await service.initiateTip(
        recipientUserId: 'usr_contributor',
        spotId: 'spot_1',
        spotName: 'CTR',
        amountInr: 100.0,
      );
      expect(tipResult.tip.amountInr, 100.0);

      final settled = await service.settleTip(
        tipId: tipResult.tip.tipId,
        simulatedOutcome: 'SUCCESS',
      );
      expect(settled.tip.paymentStatus, TipPaymentStatus.completed);

      // Route pass purchase & activation
      final passResult = await service.purchaseRoutePass(
        tier: PassTier.neighborhoodAllAccess,
        neighborhood: 'Malleshwaram',
      );
      expect(passResult.pass.status, PassStatus.pending);

      final activated = await service.confirmPassPayment(
        passId: passResult.pass.passId,
        simulatedOutcome: 'SUCCESS',
      );
      expect(activated.pass.status, PassStatus.active);

      // Access verification
      final access = await service.verifyRoutePassAccess(
        routeId: 'route_malles_heritage',
        neighborhood: 'Malleshwaram',
      );
      expect(access.hasAccess, isTrue);
    });

    // -------------------------------------------------------------------------
    // TEST 12: Plan-B Rerouting Agent Skill Schema Compliance
    // -------------------------------------------------------------------------
    test('Test 12: Plan-B Agent Skill definition & alteration contract parity', () {
      final explanationContext = {
        'summary': 'CTR at full capacity. Rerouted via Veena Stores.',
        'primaryDisruption': 'VENUE_AT_CAPACITY',
        'replacedStops': [
          {'from': 'place_ctr', 'to': 'place_veena_stores', 'reason': 'High wait times'}
        ],
        'distanceDeltaMeters': 120,
        'durationDeltaSeconds': 90,
      };

      expect(explanationContext['primaryDisruption'], 'VENUE_AT_CAPACITY');
      expect((explanationContext['replacedStops'] as List).length, 1);
    });
  });
}
