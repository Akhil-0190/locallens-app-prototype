// ignore: deprecated_member_use
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import 'package:locallens/main.dart';
import 'package:locallens/screens/walking_route_screen.dart';
import 'package:locallens/services/route_service.dart';
import 'package:locallens/services/street_assistance_service.dart';
import 'package:locallens/utils/polyline_decoder.dart';

void main() {
  group('Task D4 Route & Street-Ready Assistance Test Suite', () {
    test('1. PolylineDecoder correctly extracts LatLng points from Google encoded polyline', () {
      const sampleEncoded = '_{znAw`~xMg@g@eAo@m@e@u@o@_Am@wA}@y@w@u@aAk@q@k@_Am@g@';
      final points = PolylineDecoder.decode(sampleEncoded);

      expect(points.isNotEmpty, isTrue);
      expect(points.first.latitude, closeTo(13.086, 0.01));
      expect(points.first.longitude, closeTo(77.655, 0.01));
    });

    test('2. RouteService provides canonical walking route matching Domain 08 schema', () async {
      final service = RouteService();
      final route = await service.getPersonalizedRoute(placeIds: ['place_1', 'place_2']);

      expect(route.routeId, equals('route_malleshwaram_heritage_01'));
      expect(route.formattedDistance, equals('1.1 km'));
      expect(route.formattedDuration, equals('15 mins'));
      expect(route.legs.length, equals(2));
      expect(route.isMockData, isTrue);

      // Verify Plan-B alternative route contract
      final planB = await service.requestPlanBAlternative(
        originalRouteId: route.routeId,
        constrainedPlaceId: 'place_ctr_malleshwaram_01',
      );
      expect(planB.routeId, equals('route_malleshwaram_plan_b_02'));
      expect(planB.formattedDistance, equals('950 m'));
      expect(planB.waypointPlaceIds.contains('place_janatha_deluxe_alt'), isTrue);
    });

    test('3. StreetAssistanceService cultural ordering phrases and simulated B5 adapter', () async {
      final service = StreetAssistanceService();
      final cards = service.getCulturalOrderingCards();

      expect(cards.length, greaterThanOrEqualTo(5));
      expect(cards.first.phraseRegional, contains('ಫಿಲ್ಟರ್ ಕಾಫಿ'));
      expect(cards.first.phonetic, contains('Namaskara'));

      final answer = await service.askStreetCopilot('Where can I get filter coffee?');
      expect(answer, contains('[Sample AI: Simulated B5 response]'));
      expect(answer, contains('CTR'));

      final cameraResult = await service.translateStreetImage('dummy_path.jpg');
      expect(cameraResult.isSimulated, isTrue);
      expect(cameraResult.detectedScript, contains('Kannada'));
    });

    testWidgets('4. WalkingRouteScreen renders route overview, GoogleMap, stops, and Plan-B action',
        (WidgetTester tester) async {
      // Set test screen size
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 2.0;
      addTearDown(() => tester.view.resetPhysicalSize());

      await tester.pumpWidget(
        const ProviderScope(
          child: MaterialApp(
            home: WalkingRouteScreen(),
          ),
        ),
      );

      // Settle async loading
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 500));
      await tester.pumpAndSettle();

      // 1. Verify Sample Route Data disclaimer
      expect(
        find.text('[Sample Route Data: C3 Routes API integration pending]'),
        findsOneWidget,
      );

      // 2. Verify GoogleMap widget presence
      expect(find.byType(GoogleMap), findsOneWidget);

      // 3. Verify Route Overview Distance and Duration from supplied data
      expect(find.text('1.1 km • 15 mins'), findsOneWidget);
      expect(find.text('Malleshwaram Heritage & Coffee Trail'), findsOneWidget);

      // 4. Verify Ordered Stop Sequence
      expect(find.textContaining('Ordered Stops'), findsOneWidget);
      expect(find.textContaining('PLACE CTR MALLESHWARAM 01'), findsOneWidget);
      expect(find.textContaining('PLACE VEENA STORES 02'), findsOneWidget);

      // 5. Verify Domain 07 Venue Capacity Warning & Plan-B Action
      expect(find.text('Venue Alert: High Crowd Capacity'), findsOneWidget);
      expect(find.text('Request Plan-B Reroute'), findsOneWidget);
      expect(
        find.text('[Sample C4: Throttled — Redirecting to Plan-B alternative]'),
        findsOneWidget,
      );

      // 6. Verify Local Audio Guidance floating bar
      expect(find.text('Local Audio Walking Guide'), findsOneWidget);
      expect(find.byIcon(Icons.play_circle_fill), findsOneWidget);

      // 7. Tap Plan-B button to trigger alternative route
      await tester.tap(find.text('Request Plan-B Reroute'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 500));
      await tester.pumpAndSettle();

      // Verify updated route title and stop
      expect(find.text('Malleshwaram Uncrowded Garden & Coffee Bypass'), findsOneWidget);
      expect(find.textContaining('PLACE JANATHA DELUXE ALT'), findsOneWidget);
      expect(find.text('950 m • 12 mins'), findsOneWidget);
    });

    testWidgets('5. Street Assistance Modal Sheet renders Ordering Cards, Ask Guide Q&A, and Camera Translation',
        (WidgetTester tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 2.0;
      addTearDown(() => tester.view.resetPhysicalSize());

      await tester.pumpWidget(
        const ProviderScope(
          child: MaterialApp(
            home: WalkingRouteScreen(),
          ),
        ),
      );

      await tester.pump();
      await tester.pump(const Duration(milliseconds: 500));
      await tester.pumpAndSettle();

      // Open Street Assistance Bottom Sheet
      final assistantBtn = find.byTooltip('Street Assistant & Ordering');
      expect(assistantBtn, findsOneWidget);
      await tester.tap(assistantBtn);
      await tester.pumpAndSettle();

      // Verify Sheet Header and Tabs
      expect(find.text('Street-Ready Assistance'), findsOneWidget);
      expect(find.text('Ordering'), findsOneWidget);
      expect(find.text('Ask Guide'), findsOneWidget);
      expect(find.text('Translate'), findsOneWidget);

      // Verify Tab 1: Ordering cards
      expect(find.textContaining('Namaskara'), findsOneWidget);
      expect(find.byIcon(Icons.volume_up), findsWidgets);

      // Switch to Tab 2: Ask Guide (Simulated B5 Q&A)
      await tester.tap(find.text('Ask Guide'));
      await tester.pumpAndSettle();

      expect(
        find.text('[Sample AI: Simulated B5 response]'),
        findsOneWidget,
      );
      expect(find.byType(TextField), findsOneWidget);

      // Enter question and submit
      await tester.enterText(find.byType(TextField), 'Where can I find filter coffee?');
      await tester.tap(find.text('Ask'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 500));
      await tester.pumpAndSettle();

      expect(find.textContaining('[Sample AI: Simulated B5 response] Shri Sagar'), findsOneWidget);

      // Switch to Tab 3: Camera Street Sign Translation
      await tester.tap(find.text('Translate'));
      await tester.pumpAndSettle();

      expect(
        find.text('[Sample AI: Simulated B5 response]'),
        findsOneWidget,
      );
      expect(find.text('Capture Sign'), findsOneWidget);
      expect(find.text('Select Photo'), findsOneWidget);
    });

    testWidgets('6. App navigation smoke test reaches Walking Route Screen via Pocket Guide & Match Vibe',
        (WidgetTester tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 2.0;
      addTearDown(() => tester.view.resetPhysicalSize());

      await tester.pumpWidget(
        const ProviderScope(
          child: NeighborhoodGuideApp(),
        ),
      );
      await tester.pumpAndSettle();

      // From Pocket Guide (/guide), tap the Walking Route Tour action in AppBar
      final routeTourIcon = find.byTooltip('Walking Route Tour');
      expect(routeTourIcon, findsOneWidget);
      await tester.tap(routeTourIcon);
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 500));
      await tester.pumpAndSettle();

      // Verify WalkingRouteScreen is displayed
      expect(find.text('Street Walking Tour'), findsOneWidget);
      expect(find.text('[Sample Route Data: C3 Routes API integration pending]'), findsOneWidget);
    });
  });
}
