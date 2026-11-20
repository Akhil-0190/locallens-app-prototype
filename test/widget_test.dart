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

    // Initial pump & settle
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
    expect(find.text('Submit Local Gem'), findsOneWidget);

    // 4. Tap back on "Pocket Guide" destination
    await tester.tap(find.byIcon(Icons.map));
    await tester.pumpAndSettle();

    // Verify Pocket Guide screen is active again
    expect(find.text('Street Pocket Guide'), findsOneWidget);
  });
}
