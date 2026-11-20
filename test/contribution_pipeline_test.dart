// ignore: deprecated_member_use
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:locallens/models/contribution.dart';
import 'package:locallens/models/spot_card.dart';
import 'package:locallens/services/contribution_service.dart';
import 'package:locallens/widgets/contribution_status_tracker.dart';

void main() {
  group('Task D2 Live Contribution Pipeline & Contract Parity Suite', () {
    test('1. ContributorSubmissionInput canonical payload conforms to Domain 03 schema', () {
      const input = ContributorSubmissionInput(
        mapsLink: 'https://maps.app.goo.gl/sampleSpot123',
        infoParagraph: 'Authentic 40-year old South Indian filter coffee stall.',
        contributorId: 'usr_blr_782914',
        selectedLanguage: 'kn-IN',
      );

      final payload = input.toCanonicalPayload();

      // Canonical schema verification
      expect(payload['mapsLink'], 'https://maps.app.goo.gl/sampleSpot123');
      expect(payload['infoParagraph'], 'Authentic 40-year old South Indian filter coffee stall.');
      expect(payload['contributorId'], 'usr_blr_782914');
      // Reconciled: photoUrls must be an empty list initially prior to storage upload
      expect(payload['photoUrls'], isEmpty);
      expect(payload['photoUrls'], isA<List>());
      expect(payload.containsKey('audioNoteUrl'), isFalse);
    });

    test('2. VoicePhotoAsset and AiExtractionResult null-safety (B2 defect defense)', () {
      // Test with completely null or absent extraction results (simulating B2 model unavailability)
      final nullResult = AiExtractionResult.fromMap(null);
      expect(nullResult.detectedLanguage, isNull);
      expect(nullResult.transcription, isNull);
      expect(nullResult.practicalDetails, isNull);
      expect(nullResult.ocrDetectedText, isEmpty);
      expect(nullResult.confidenceScore, isNull);

      // Test with partial extraction (practicalDetails with null opening hours and missing items)
      final partialResult = AiExtractionResult.fromMap({
        'detectedLanguage': 'kn-IN',
        'transcription': 'Coffee stall on 8th cross',
        'practicalDetails': {
          'cashOnlyWarning': true,
          'signatureDishesOrItems': ['Filter Coffee'],
        },
      });

      expect(partialResult.detectedLanguage, 'kn-IN');
      expect(partialResult.practicalDetails?.cashOnlyWarning, isTrue);
      expect(partialResult.practicalDetails?.openingHoursMentioned, isNull);
      expect(partialResult.practicalDetails?.signatureDishesOrItems, ['Filter Coffee']);

      // Test VoicePhotoAsset parsing
      final asset = VoicePhotoAsset.fromMap({
        'assetId': 'asset_test_123',
        'contributionId': 'contrib_test_456',
        'assetType': 'AUDIO_VOICE_NOTE',
        'storagePath': 'contributions/contrib_test_456/audio/voice.m4a',
        'downloadUrl': 'https://firebasestorage.googleapis.com/test?token=abc',
        'mimeType': 'audio/x-m4a',
        'fileSizeBytes': 128000,
        'processingStatus': 'COMPLETED',
        'aiExtractionResult': partialResult.toMap(),
        'createdAt': '2026-11-20T10:00:00.000Z',
        'updatedAt': '2026-11-20T10:00:05.000Z',
      });

      expect(asset.assetId, 'asset_test_123');
      expect(asset.assetType, 'AUDIO_VOICE_NOTE');
      expect(asset.aiExtractionResult?.practicalDetails?.cashOnlyWarning, isTrue);
    });

    test('3. ContributionService authentication guard enforcement in production', () async {
      // In production mode (isTestMode: false), verifyContributorAuthorization throws AuthenticationRequiredException if no user is signed in
      final service = ContributionService(isTestMode: false);
      expect(
        () => service.verifyContributorAuthorization(),
        throwsA(isA<AuthenticationRequiredException>()),
      );
    });

    testWidgets('4. ContributionStatusTracker renders SUBMITTED state without premature verified card',
        (WidgetTester tester) async {
      final doc = ContributionDocument(
        contributionId: 'contrib_sub_1',
        submission: const ContributorSubmissionInput(
          mapsLink: 'https://maps.app.goo.gl/spot1',
          infoParagraph: 'Local tea stall',
          contributorId: 'usr_blr_782914',
        ),
        status: ContributionStatus.submitted,
        createdAt: DateTime.now(),
        updatedAt: DateTime.now(),
      );

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: SingleChildScrollView(
              child: ContributionStatusTracker(contribution: doc),
            ),
          ),
        ),
      );
      // Use pump() rather than pumpAndSettle() because CircularProgressIndicator has an infinite animation during SUBMITTED status
      await tester.pump();

      expect(find.text('Pipeline Ingestion Status'), findsOneWidget);
      expect(find.text('Submitted to Backend'), findsOneWidget);
      expect(find.text('Asset Upload to Cloud Storage (A3)'), findsOneWidget);
      expect(find.text('Gemini Multimodal Analysis (B2)'), findsOneWidget);
      expect(find.textContaining('Downstream C2 Integration Pending'), findsOneWidget);
      // Ensure no fake SpotCard is displayed at SUBMITTED stage
      expect(find.text('View Resulting Structured Spot Card'), findsNothing);
    });

    testWidgets('5. ContributionStatusTracker renders Provisional AI Insights Card upon AI_ANALYZED',
        (WidgetTester tester) async {
      final doc = ContributionDocument(
        contributionId: 'contrib_ai_2',
        submission: const ContributorSubmissionInput(
          mapsLink: 'https://maps.app.goo.gl/spot2',
          infoParagraph: 'Traditional Idli Stall',
          contributorId: 'usr_blr_782914',
        ),
        status: ContributionStatus.aiAnalyzed,
        assets: [
          VoicePhotoAsset(
            assetId: 'asset_voice_1',
            contributionId: 'contrib_ai_2',
            assetType: 'AUDIO_VOICE_NOTE',
            storagePath: 'contributions/contrib_ai_2/audio/note.m4a',
            downloadUrl: 'https://storage.googleapis.com/bucket/note.m4a',
            mimeType: 'audio/x-m4a',
            fileSizeBytes: 210000,
            processingStatus: 'COMPLETED',
            aiExtractionResult: const AiExtractionResult(
              detectedLanguage: 'kn-IN',
              transcription: 'Best soft podi idli served from 7am to 11am with spicy chutney.',
              practicalDetails: ExtractedPracticalDetails(
                openingHoursMentioned: '7:00 AM – 11:00 AM',
                signatureDishesOrItems: ['Podi Idli', 'Filter Coffee'],
                cashOnlyWarning: true,
                insiderTips: ['Come early before podi idli runs out'],
              ),
            ),
            createdAt: DateTime.now(),
            updatedAt: DateTime.now(),
          ),
        ],
        createdAt: DateTime.now(),
        updatedAt: DateTime.now(),
      );

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: SingleChildScrollView(
              child: ContributionStatusTracker(contribution: doc),
            ),
          ),
        ),
      );
      // Use pump() rather than pumpAndSettle() because CircularProgressIndicator has an infinite animation during SUBMITTED status
      await tester.pump();

      // Verify Provisional AI Insights Card is rendered
      expect(find.text('Provisional AI Insights (Extracted by Gemini B2)'), findsOneWidget);
      expect(find.text('Pending Grounding'), findsOneWidget);
      expect(find.textContaining('Best soft podi idli served from 7am to 11am'), findsOneWidget);
      expect(find.text('Hours: 7:00 AM – 11:00 AM'), findsOneWidget);
      expect(find.text('Payment: Cash / UPI Only (Warning Detected)'), findsOneWidget);
      expect(find.text('Podi Idli'), findsOneWidget);
      expect(find.text('Filter Coffee'), findsOneWidget);
      expect(find.text('Come early before podi idli runs out'), findsOneWidget);

      // Verify Maps Grounding is accurately disclosed as pending downstream integration
      expect(find.textContaining('[Downstream C2 Integration Pending]'), findsOneWidget);

      // Spot card must NOT be displayed yet because place is not verified
      expect(find.text('View Resulting Structured Spot Card'), findsNothing);
    });

    testWidgets('6. ContributionStatusTracker renders Rejection Reason and Retry button',
        (WidgetTester tester) async {
      bool retried = false;
      final doc = ContributionDocument(
        contributionId: 'contrib_rej_3',
        submission: const ContributorSubmissionInput(
          mapsLink: 'https://maps.app.goo.gl/spot3',
          infoParagraph: 'Commercial chain franchise',
          contributorId: 'usr_blr_782914',
        ),
        status: ContributionStatus.rejected,
        rejectionReason: 'Spot identified as commercial franchise, not authentic local heritage.',
        createdAt: DateTime.now(),
        updatedAt: DateTime.now(),
      );

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: SingleChildScrollView(
              child: ContributionStatusTracker(
                contribution: doc,
                onRetry: () => retried = true,
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Rejected'), findsOneWidget);
      expect(find.textContaining('commercial franchise'), findsOneWidget);
      expect(find.text('Retry Submission'), findsOneWidget);

      await tester.tap(find.text('Retry Submission'));
      await tester.pumpAndSettle();
      expect(retried, isTrue);
    });

    testWidgets('7. ContributionStatusTracker renders verified Spot Card view ONLY when formally verified',
        (WidgetTester tester) async {
      final verifiedSpot = SpotCard(
        id: 'place_blr_malleshwaram_ctroast',
        mapsLink: 'https://maps.google.com/?cid=123',
        infoParagraph: 'Traditional coffee roast house',
        photoUrls: ['https://example.com/photo.jpg'],
        spotName: 'Central Tiffin Room (CTR)',
        openHours: '7:00 AM – 9:30 PM',
        practicalTips: 'Must try Benne Dosa',
      );

      final doc = ContributionDocument(
        contributionId: 'contrib_ver_4',
        submission: const ContributorSubmissionInput(
          mapsLink: 'https://maps.google.com/?cid=123',
          infoParagraph: 'Traditional coffee roast house',
          contributorId: 'usr_blr_782914',
        ),
        status: ContributionStatus.verified,
        groundedPlaceId: 'place_blr_malleshwaram_ctroast',
        generatedSpotCard: verifiedSpot,
        createdAt: DateTime.now(),
        updatedAt: DateTime.now(),
      );

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: SingleChildScrollView(
              child: ContributionStatusTracker(contribution: doc),
            ),
          ),
        ),
      );
      // Use pump() rather than pumpAndSettle() because CircularProgressIndicator has an infinite animation during SUBMITTED status
      await tester.pump();

      expect(find.text('Verified & Published'), findsOneWidget);
      expect(find.text('View Resulting Structured Spot Card'), findsOneWidget);

      // Tap to open sheet
      await tester.tap(find.text('View Resulting Structured Spot Card'));
      await tester.pumpAndSettle();

      expect(find.text('Published Spot Card View'), findsOneWidget);
      expect(find.text('Central Tiffin Room (CTR)'), findsOneWidget);
    });
  });
}
