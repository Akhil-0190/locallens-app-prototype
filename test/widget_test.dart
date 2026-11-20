import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:locallens/main.dart';

void main() {
  testWidgets('Full app navigation smoke test across all 3 shell destinations',
      (WidgetTester tester) async {
    // Build app within Riverpod ProviderScope
    await tester.pumpWidget(
      const ProviderScope(
        child: NeighborhoodGuideApp(),
      ),
    );

    await tester.pumpAndSettle();

    // 1. Initial destination should be Pocket Guide (/guide)
    expect(find.text('Street Pocket Guide'), findsOneWidget);
    expect(find.byIcon(Icons.explore), findsOneWidget);
    expect(find.byIcon(Icons.map), findsOneWidget);
    expect(find.byIcon(Icons.add_location_alt), findsOneWidget);

    // 2. Tap on "Match Vibe" destination
    await tester.tap(find.byIcon(Icons.explore));
    await tester.pumpAndSettle();

    // Verify Match Vibe screen rendered
    expect(find.text('Match Your Vibe'), findsOneWidget);
    expect(find.text('Build 3-Stop Uncrowded Route'), findsOneWidget);

    // 3. Tap on "Add Gem" destination
    await tester.tap(find.byIcon(Icons.add_location_alt));
    await tester.pumpAndSettle();

    // Verify Add Gem screen rendered
    expect(find.text('Add a Local Gem'), findsOneWidget);
    expect(find.text('Preview & Submit Discovery'), findsOneWidget);

    // 4. Tap back on "Pocket Guide" destination
    await tester.tap(find.byIcon(Icons.map));
    await tester.pumpAndSettle();

    // Verify Pocket Guide screen is active again
    expect(find.text('Street Pocket Guide'), findsOneWidget);
  });

  testWidgets(
      'D2 Contributor Experience: onboarding, regional language, preview, and submission flow',
      (WidgetTester tester) async {
    await tester.pumpWidget(
      const ProviderScope(
        child: NeighborhoodGuideApp(),
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
    await tester.pumpAndSettle();

    // Verify pipeline status tracker is rendered
    expect(find.text('Pipeline Ingestion Status'), findsOneWidget);
    expect(find.text('Asset Upload to Cloud Storage (A3)'), findsOneWidget);
    expect(find.text('Gemini Multimodal Analysis (B2)'), findsOneWidget);
    expect(find.text('Google Maps Place Grounding (C1/C2)'), findsOneWidget);
  });
}
