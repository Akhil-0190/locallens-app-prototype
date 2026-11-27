// ignore: deprecated_member_use
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:locallens/main.dart';
import 'fakes/fake_services.dart';

void main() {
  testWidgets('Full app navigation smoke test across all 3 shell destinations',
      (WidgetTester tester) async {
    // Build app within Riverpod ProviderScope using clean test fakes
    await tester.pumpWidget(
      ProviderScope(
        overrides: buildTestProviderOverrides(),
        child: const NeighborhoodGuideApp(),
      ),
    );

    await tester.pumpAndSettle();

    // 1. Initial destination should be Pocket Guide (/guide)
    expect(find.text('Street Pocket Guide'), findsOneWidget);
    expect(find.widgetWithIcon(NavigationDestination, Icons.explore), findsOneWidget);
    expect(find.widgetWithIcon(NavigationDestination, Icons.map), findsOneWidget);
    expect(find.widgetWithIcon(NavigationDestination, Icons.add_location_alt), findsOneWidget);

    // 2. Tap on "Match Vibe" destination
    await tester.tap(find.widgetWithIcon(NavigationDestination, Icons.explore));
    await tester.pumpAndSettle();

    // Verify Match Vibe screen rendered with Curated Spots and Route Builder segments
    expect(find.text('Match Your Vibe'), findsOneWidget);
    expect(find.text('Curated Spots'), findsOneWidget);
    expect(find.text('Route Builder'), findsOneWidget);

    // Tap Route Builder segment to verify D1 feature
    final routeBuilderSegment = find.text('Route Builder');
    await tester.ensureVisible(routeBuilderSegment);
    await tester.pumpAndSettle();
    await tester.tap(routeBuilderSegment);
    await tester.pumpAndSettle();

    final buildRouteBtn = find.text('Build 3-Stop Uncrowded Route');
    await tester.ensureVisible(buildRouteBtn);
    await tester.pumpAndSettle();
    expect(buildRouteBtn, findsOneWidget);

    // 3. Tap on "Add Gem" destination
    await tester.tap(find.widgetWithIcon(NavigationDestination, Icons.add_location_alt));
    await tester.pumpAndSettle();

    // Verify Add Gem screen rendered
    expect(find.text('Add a Local Gem'), findsOneWidget);
    expect(find.text('Preview & Submit Discovery'), findsOneWidget);

    // 4. Tap back on "Pocket Guide" destination
    await tester.tap(find.widgetWithIcon(NavigationDestination, Icons.map));
    await tester.pumpAndSettle();

    // Verify Pocket Guide screen is active again
    expect(find.text('Street Pocket Guide'), findsOneWidget);
  });

  testWidgets(
      'D2 Contributor Experience: onboarding, regional language, preview, and submission flow',
      (WidgetTester tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: buildTestProviderOverrides(),
        child: const NeighborhoodGuideApp(),
      ),
    );
    await tester.pumpAndSettle();

    // Navigate to Add Gem (Contributor screen)
    await tester.tap(find.byIcon(Icons.add_location_alt));
    await tester.pumpAndSettle();

    // 1. Verify Contributor Onboarding Header & Attribution
    expect(find.text('Aravinth S (Local Resident)'), findsOneWidget);
    expect(find.text('Guidelines'), findsOneWidget);

    // Open Guidelines Sheet
    await tester.tap(find.text('Guidelines'));
    await tester.pumpAndSettle();
    expect(find.text('Contributor Guidelines'), findsOneWidget);
    expect(find.text('Exact Location & Authentic Story'), findsOneWidget);
    expect(find.text('Native Voice Notes'), findsOneWidget);

    // Close guidelines
    await tester.tap(find.byTooltip('Close'));
    await tester.pumpAndSettle();

    // 2. Verify Regional Language Selection Chips
    expect(find.text('English (English)'), findsOneWidget);
    expect(find.text('Kannada (ಕನ್ನಡ)'), findsOneWidget);
    expect(find.text('Tamil (தமிழ்)'), findsOneWidget);

    // Tap Kannada chip
    await tester.tap(find.text('Kannada (ಕನ್ನಡ)'));
    await tester.pumpAndSettle();

    // 3. Verify Voice Recorder and Street Photos UI
    expect(find.text('Voice Note (Regional or English)'), findsOneWidget);
    expect(find.text('Start Voice Recording (Mic)'), findsOneWidget);
    expect(find.text('Street Photos (0/2)'), findsOneWidget);
    expect(find.text('Gallery'), findsOneWidget);
    expect(find.text('Camera'), findsOneWidget);

    // 4. Form Validation: Tap submit without filling fields
    final submitBtn = find.text('Preview & Submit Discovery');
    await tester.ensureVisible(submitBtn);
    await tester.pumpAndSettle();
    await tester.tap(submitBtn);
    await tester.pumpAndSettle();
    expect(find.text('Please paste a Google Maps link'), findsOneWidget);

    // Fill valid inputs
    await tester.enterText(
      find.byType(TextFormField).first,
      'https://maps.app.goo.gl/sampleGem123',
    );
    await tester.enterText(
      find.byType(TextFormField).last,
      'Authentic local filter coffee and soft podi idli spot in Malleshwaram 8th Cross.',
    );
    await tester.pumpAndSettle();

    // 5. Open Preview Sheet
    await tester.ensureVisible(submitBtn);
    await tester.pumpAndSettle();
    await tester.tap(submitBtn);
    await tester.pumpAndSettle();

    expect(find.text('Contribution Preview'), findsOneWidget);
    expect(find.text('Attributed to: Aravinth S (Local Resident)'), findsOneWidget);
    expect(find.text('Kannada (ಕನ್ನಡ)'), findsNWidgets(2));
    expect(find.text('Confirm & Submit'), findsOneWidget);

    // 6. Confirm & Submit
    await tester.tap(find.text('Confirm & Submit'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 300));

    // Verify pipeline status tracker is rendered
    expect(find.text('Pipeline Ingestion Status'), findsOneWidget);
    expect(find.text('Asset Upload to Cloud Storage (A3)'), findsOneWidget);
    expect(find.text('Gemini Multimodal Analysis (B2)'), findsOneWidget);
    expect(find.text('Google Maps Place Grounding'), findsOneWidget);
  });

  testWidgets(
      'D3 Traveler Discovery: preferences onboarding sheet, solo/group mode, live banner, spot cards and authenticity badges',
      (WidgetTester tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: buildTestProviderOverrides(),
        child: const NeighborhoodGuideApp(),
      ),
    );
    await tester.pumpAndSettle();

    // Navigate to Match Vibe (Traveler Discovery Screen)
    await tester.tap(find.byIcon(Icons.explore));
    await tester.pumpAndSettle();

    // 1. Verify Live Discovery Banner
    expect(
      find.text(
          'Live & Verified Local Culture • Grounded via Google Maps & Everyday Insiders'),
      findsOneWidget,
    );

    // 2. Verify Traveler Preference Summary Card
    expect(find.text('Solo Explorer'), findsOneWidget);
    expect(find.text('Curated Palate'), findsOneWidget);
    expect(find.text('Preferences'), findsOneWidget);

    // 3. Open Preferences Onboarding Sheet
    await tester.tap(find.text('Preferences'));
    await tester.pumpAndSettle();

    // Verify Sheet sections
    expect(find.text('Traveler Preferences'), findsOneWidget);
    expect(find.text('Exploration Mode'), findsOneWidget);
    expect(find.text('Favorite Vibes'), findsOneWidget);
    expect(find.text('Save Traveler Preferences'), findsOneWidget);

    // Switch to Group Vibe mode
    await tester.tap(find.text('Group Vibe'));
    await tester.pumpAndSettle();

    // Save preferences
    await tester.tap(find.text('Save Traveler Preferences'));
    await tester.pumpAndSettle();

    // Verify Summary Card updated to Group Taste Matching
    expect(find.text('Group Taste Matching'), findsOneWidget);
    expect(find.text('Squad Match'), findsOneWidget);

    // 4. Verify Discovered Spot Cards
    expect(find.text('Central Tiffin Room (CTR / Shri Sagar)'), findsAtLeastNWidgets(1));
    expect(find.text('96% Authentic Local Spot'), findsOneWidget);
    expect(find.text('MODERATE Crowd (4/12 visitors)'), findsAtLeastNWidgets(1));
    expect(find.text('Discovered by Priya Sharma'), findsAtLeastNWidgets(1));

    // 5. Test Neighborhood Filter
    expect(find.text('Filter by Neighborhood'), findsOneWidget);
    final basavanagudiChip = find.widgetWithText(ChoiceChip, 'Basavanagudi');
    await tester.ensureVisible(basavanagudiChip);
    await tester.pumpAndSettle();
    await tester.tap(basavanagudiChip);
    await tester.pumpAndSettle();

    // Verify filtered spot card: Brahmin's Coffee Bar
    expect(find.text("Brahmin's Coffee Bar"), findsAtLeastNWidgets(1));
    expect(find.text('97% Authentic Local Spot'), findsOneWidget);
    expect(find.text('Discovered by Priya Sharma'), findsAtLeastNWidgets(1));
  });
}
