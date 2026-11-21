// ignore: deprecated_member_use
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:locallens/models/contribution.dart';
import 'package:locallens/models/monetization.dart';
import 'package:locallens/providers/monetization_providers.dart';
import 'package:locallens/providers/spot_providers.dart';
import 'package:locallens/screens/contributor_content_management_screen.dart';
import 'package:locallens/screens/contributor_profile_screen.dart';
import 'package:locallens/screens/partner_subscription_screen.dart';
import 'package:locallens/screens/route_pass_screen.dart';
import 'package:locallens/services/contribution_service.dart';
import 'package:locallens/services/monetization_service.dart';
import 'package:locallens/widgets/guidance_request_sheet.dart';
import 'package:locallens/widgets/id_verification_modal_sheet.dart';
import 'package:locallens/widgets/pass_checkout_sheet.dart';
import 'package:locallens/widgets/tipping_modal_sheet.dart';

void main() {
  group('Task D6 — Monetization Models JSON Serialization & Contracts', () {
    test('ContributorTip serialization & calculations', () {
      final now = DateTime.now();
      final tip = ContributorTip(
        tipId: 'tip_blr_101',
        payerUserId: 'usr_traveler_1',
        recipientUserId: 'usr_contributor_1',
        spotId: 'spot_ctr_1',
        spotName: 'CTR Shri Sagar',
        amountInr: 100.0,
        platformFeeInr: 5.0,
        contributorNetInr: 95.0,
        paymentMode: PaymentMode.sandbox,
        paymentStatus: TipPaymentStatus.completed,
        paymentGatewayReference: 'sandbox_sim_upi_12345',
        personalNote: 'Best benne dose in Malleshwaram!',
        createdAt: now,
        settledAt: now,
      );

      final map = tip.toMap();
      expect(map['tipId'], 'tip_blr_101');
      expect(map['amountInr'], 100.0);
      expect(map['platformFeeInr'], 5.0);
      expect(map['contributorNetInr'], 95.0);
      expect(map['paymentMode'], 'SANDBOX');
      expect(map['paymentStatus'], 'COMPLETED');

      final fromMap = ContributorTip.fromMap(map);
      expect(fromMap.tipId, tip.tipId);
      expect(fromMap.contributorNetInr, 95.0);
      expect(fromMap.paymentStatus, TipPaymentStatus.completed);
      expect(fromMap.paymentGatewayReference, 'sandbox_sim_upi_12345');
    });

    test('PaymentIntent serialization', () {
      final intent = PaymentIntent(
        transactionId: 'tx_999',
        gatewayReference: 'sandbox_sim_upi_999',
        amountInr: 50.0,
        currency: 'INR',
        mode: PaymentMode.sandbox,
        qrPayload: 'upi://pay?pa=sandbox@upi&am=50',
      );

      final map = intent.toMap();
      expect(map['transactionId'], 'tx_999');
      expect(map['gatewayReference'], 'sandbox_sim_upi_999');
      expect(map['mode'], 'SANDBOX');

      final parsed = PaymentIntent.fromMap(map);
      expect(parsed.transactionId, 'tx_999');
      expect(parsed.amountInr, 50.0);
      expect(parsed.mode, PaymentMode.sandbox);
    });

    test('ContributorRewardLedger serialization', () {
      final ledger = ContributorRewardLedger(
        userId: 'usr_contributor_1',
        totalEarningsInr: 2500.0,
        availableBalanceInr: 1800.0,
        withdrawnTotalInr: 700.0,
        unrecoveredAdjustmentInr: 0.0,
        payoutUpiId: 'localhero@upi',
        reputationPoints: 450,
        guidanceRank: 'Malleshwaram Heritage Master',
        updatedAt: DateTime.now(),
      );

      final map = ledger.toMap();
      expect(map['userId'], 'usr_contributor_1');
      expect(map['totalEarningsInr'], 2500.0);
      expect(map['availableBalanceInr'], 1800.0);
      expect(map['guidanceRank'], 'Malleshwaram Heritage Master');

      final parsed = ContributorRewardLedger.fromMap(map);
      expect(parsed.userId, ledger.userId);
      expect(parsed.availableBalanceInr, 1800.0);
      expect(parsed.reputationPoints, 450);
    });

    test('RoutePass serialization & validity checks', () {
      final now = DateTime.now();
      final pass = RoutePass(
        passId: 'pass_sample_01',
        userId: 'usr_traveler_1',
        tier: PassTier.neighborhoodAllAccess,
        neighborhood: 'Malleshwaram',
        accessibleRouteIds: ['route_1', 'route_2'],
        pricePaidInr: 0.0, // Commercial pricing pending
        paymentMode: PaymentMode.sandbox,
        status: PassStatus.active,
        perksIncluded: const RoutePassPerks(
          audioGuidanceUnlocked: true,
          offlinePackUnlocked: true,
          merchantPartnerDiscountPercent: 10,
        ),
        validFrom: now.subtract(const Duration(hours: 1)),
        validUntil: now.add(const Duration(days: 7)),
        purchasedAt: now.subtract(const Duration(hours: 1)),
      );

      expect(pass.isCurrentlyValid, isTrue);

      final map = pass.toMap();
      expect(map['tier'], 'NEIGHBORHOOD_ALL_ACCESS');
      expect(map['status'], 'ACTIVE');
      expect(map['neighborhood'], 'Malleshwaram');

      final parsed = RoutePass.fromMap(map);
      expect(parsed.tier, PassTier.neighborhoodAllAccess);
      expect(parsed.status, PassStatus.active);
      expect(parsed.perksIncluded.audioGuidanceUnlocked, isTrue);
      expect(parsed.perksIncluded.merchantPartnerDiscountPercent, 10);
    });

    test('Local Draft Models serialization', () {
      final idDraft = LocalIdVerificationDraft(
        neighborhood: 'Malleshwaram',
        documentType: 'Utility Bill',
        documentDescription: 'BESCOM bill meter #1234',
        createdAt: DateTime.now(),
      );
      final idMap = idDraft.toMap();
      expect(idMap['neighborhood'], 'Malleshwaram');
      expect(LocalIdVerificationDraft.fromMap(idMap).documentType, 'Utility Bill');

      final guidanceDraft = LocalGuidanceRequestDraft(
        guideUserId: 'usr_guide_1',
        preferredDate: '2026-11-25',
        timeOfDay: 'Morning',
        neighborhood: 'Malleshwaram',
        culturalFocus: 'Heritage Walk',
        notes: 'Interested in old temple architecture',
        createdAt: DateTime.now(),
      );
      final gMap = guidanceDraft.toMap();
      expect(gMap['guideUserId'], 'usr_guide_1');
      expect(LocalGuidanceRequestDraft.fromMap(gMap).culturalFocus, 'Heritage Walk');

      final partnerDraft = LocalPartnerInquiryDraft(
        businessName: 'Malleshwaram Heritage Homestay',
        propertyType: 'HOMESTAY',
        neighborhood: 'Malleshwaram',
        contactEmail: 'homestay@example.com',
        proposedPerk: '10% discount on dining',
        selectedPlanTier: 'VERIFIED_PARTNER',
        createdAt: DateTime.now(),
      );
      final pMap = partnerDraft.toMap();
      expect(pMap['propertyType'], 'HOMESTAY');
      expect(LocalPartnerInquiryDraft.fromMap(pMap).businessName, 'Malleshwaram Heritage Homestay');
    });
  });

  group('Task D6 — MonetizationService Backend Lifecycle Operations', () {
    late MonetizationService service;

    setUp(() {
      service = MonetizationService(isTestMode: true);
    });

    test('getContributorAttribution returns correct profile', () async {
      final attr = await service.getContributorAttribution(userId: 'usr_test_1');
      expect(attr.userId, 'usr_test_1');
      expect(attr.isVerifiedResident, isTrue);
      expect(attr.approvedGemsCount, 5);
    });

    test('getContributorRewardSummary returns ledger', () async {
      final ledger = await service.getContributorRewardSummary();
      expect(ledger.availableBalanceInr, 850.0);
      expect(ledger.totalEarningsInr, 1250.0);
      expect(ledger.guidanceRank, 'Malleshwaram Heritage Master');
    });

    test('initiateTip validates positive amount and returns PaymentIntent', () async {
      expect(
        () => service.initiateTip(
          recipientUserId: 'usr_contributor',
          spotId: 'spot_1',
          spotName: 'CTR',
          amountInr: 0,
        ),
        throwsArgumentError,
      );

      final result = await service.initiateTip(
        recipientUserId: 'usr_contributor',
        spotId: 'spot_1',
        spotName: 'CTR',
        amountInr: 100.0,
      );
      expect(result.tip.amountInr, 100.0);
      expect(result.tip.platformFeeInr, 5.0);
      expect(result.tip.contributorNetInr, 95.0);
      expect(result.tip.paymentMode, PaymentMode.sandbox);
      expect(result.paymentIntent.gatewayReference, startsWith('sandbox_sim_upi_'));
    });

    test('settleTip handles success and failure outcomes', () async {
      // Success
      final success = await service.settleTip(
        tipId: 'tip_test_123',
        simulatedOutcome: 'SUCCESS',
      );
      expect(success.tip.paymentStatus, TipPaymentStatus.completed);
      expect(success.rewardLedger.availableBalanceInr, greaterThan(0));

      // Failure
      expect(
        () => service.settleTip(
          tipId: 'tip_test_123',
          simulatedOutcome: 'FAILURE',
        ),
        throwsA(isA<PaymentSettlementException>()),
      );
    });

    test('purchaseRoutePass and confirmPassPayment lifecycle', () async {
      final purchase = await service.purchaseRoutePass(
        tier: PassTier.neighborhoodAllAccess,
        neighborhood: 'Malleshwaram',
      );
      expect(purchase.pass.status, PassStatus.pending);
      expect(purchase.pass.tier, PassTier.neighborhoodAllAccess);
      expect(purchase.paymentIntent.gatewayReference, startsWith('sandbox_sim_pass_'));

      // Confirm payment success -> ACTIVE
      final activated = await service.confirmPassPayment(
        passId: purchase.pass.passId,
        simulatedOutcome: 'SUCCESS',
      );
      expect(activated.pass.status, PassStatus.active);
      expect(activated.pass.perksIncluded.audioGuidanceUnlocked, isTrue);

      // Confirm payment failure -> throws PaymentSettlementException
      expect(
        () => service.confirmPassPayment(
          passId: 'pass_fail_test',
          simulatedOutcome: 'FAILURE',
        ),
        throwsA(isA<PaymentSettlementException>()),
      );
    });

    test('local draft persistence', () {
      service.saveIdVerificationDraft(
        LocalIdVerificationDraft(
          neighborhood: 'Malleshwaram',
          documentType: 'Rental Agreement',
          documentDescription: 'Lease deed',
          createdAt: DateTime.now(),
        ),
      );
      expect(service.getLatestIdVerificationDraft()?.documentType, 'Rental Agreement');

      service.saveGuidanceRequestDraft(
        LocalGuidanceRequestDraft(
          guideUserId: 'usr_guide',
          preferredDate: '2026-11-26',
          timeOfDay: 'Sunset',
          neighborhood: 'Basavanagudi',
          culturalFocus: 'Filter Coffee Trail',
          notes: 'Special request',
          createdAt: DateTime.now(),
        ),
      );
      expect(service.getGuidanceRequestDrafts().length, 1);

      service.savePartnerInquiryDraft(
        LocalPartnerInquiryDraft(
          businessName: 'Bangalore Homestay',
          propertyType: 'HOMESTAY',
          neighborhood: 'Indiranagar',
          contactEmail: 'info@bangalorehomestay.com',
          proposedPerk: 'Complimentary traditional breakfast',
          selectedPlanTier: 'FEATURED_HERITAGE',
          createdAt: DateTime.now(),
        ),
      );
      expect(service.getPartnerInquiryDrafts().length, 1);
    });

    test('MonetizationNotifier state transitions', () async {
      final container = ProviderContainer(
        overrides: [
          isTestModeProvider.overrideWith((ref) => true),
        ],
      );
      addTearDown(container.dispose);

      final notifier = container.read(monetizationNotifierProvider.notifier);
      expect(container.read(monetizationNotifierProvider).isLoading, isFalse);

      final tipSuccess = await notifier.initiateTip(
        recipientUserId: 'usr_contributor',
        spotId: 'spot_1',
        spotName: 'CTR Shri Sagar',
        amountInr: 100.0,
      );
      expect(tipSuccess, isTrue);
      expect(container.read(monetizationNotifierProvider).pendingTip?.amountInr, 100.0);

      final passSuccess = await notifier.purchaseRoutePass(
        tier: PassTier.singleRoute,
        neighborhood: 'Malleshwaram',
      );
      expect(passSuccess, isTrue);
      expect(container.read(monetizationNotifierProvider).pendingPass?.tier, PassTier.singleRoute);
    });
  });

  group('Task D6 — ContributionService Content Management Operations', () {
    late ContributionService contributionService;

    setUp(() {
      contributionService = ContributionService(isTestMode: true);
    });

    test('listMyContributions returns user-authored contributions', () async {
      final list = await contributionService.listMyContributions();
      expect(list.length, greaterThanOrEqualTo(3));
      expect(list.any((c) => c.status == ContributionStatus.verified), isTrue);
      expect(list.any((c) => c.status == ContributionStatus.aiAnalyzed), isTrue);
      expect(list.any((c) => c.status == ContributionStatus.rejected), isTrue);
    });

    test('getContributionStatus returns details', () async {
      final doc = await contributionService.getContributionStatus('contrib_sample_1');
      expect(doc.contributionId, 'contrib_sample_1');
    });
  });

  group('Task D6 — UI Screen & Modal Sheet Widget Tests', () {
    Widget buildTestApp(Widget child) {
      return ProviderScope(
        overrides: [
          isTestModeProvider.overrideWith((ref) => true),
        ],
        child: MaterialApp(
          home: child,
        ),
      );
    }

    testWidgets('ContributorProfileScreen renders attribution, balance & actions', (tester) async {
      await tester.pumpWidget(buildTestApp(const ContributorProfileScreen(userId: 'usr_test_contributor')));
      await tester.pumpAndSettle();

      expect(find.text('Contributor Profile'), findsOneWidget);
      expect(find.text('Aravinth S (Local Resident)'), findsOneWidget);
      expect(find.text('Neighborhood Insider'), findsOneWidget);
      expect(find.text('Send Tip'), findsOneWidget);
      expect(find.text('1-on-1 Guidance'), findsOneWidget);
      expect(find.text('Community Earnings & Rewards'), findsOneWidget);
      expect(find.text('Available Balance'), findsOneWidget);
      expect(find.text('Manage Submitted Gems'), findsOneWidget);
      expect(find.text('Partner Subscriptions'), findsOneWidget);
    });

    testWidgets('TippingModalSheet displays sandbox mode notice & fee breakdown', (tester) async {
      await tester.pumpWidget(buildTestApp(
        Scaffold(
          body: TippingModalSheet(
            recipientUserId: 'usr_contributor',
            recipientName: 'Aravinth S',
            spotId: 'spot_ctr',
            spotName: 'CTR Shri Sagar',
          ),
        ),
      ));
      await tester.pumpAndSettle();

      expect(find.text('Tip Aravinth S'), findsOneWidget);
      expect(find.textContaining('[Sandbox Mode: Simulated Payment'), findsOneWidget);
      expect(find.text('₹50'), findsOneWidget);
      expect(find.text('₹100'), findsOneWidget);
      expect(find.text('₹200'), findsOneWidget);
      expect(find.textContaining('Minimum ₹10, maximum ₹5,000'), findsOneWidget);
    });

    testWidgets('RoutePassScreen renders passes and Pricing: Pending Commercial Confirmation', (tester) async {
      await tester.pumpWidget(buildTestApp(const RoutePassScreen()));
      await tester.pumpAndSettle();

      expect(find.text('Walking Route Passes'), findsOneWidget);
      expect(find.textContaining('[Sandbox Mode: Simulated Payment'), findsOneWidget);
      expect(find.text('My Passes'), findsOneWidget);
      expect(find.text('Available Pass Tiers'), findsOneWidget);
      expect(find.textContaining('SINGLE_ROUTE'), findsWidgets);
      expect(find.textContaining('NEIGHBORHOOD_ALL_ACCESS'), findsWidgets);
      expect(find.textContaining('ANNUAL_EXPLORER'), findsOneWidget);

      // Verify that no hardcoded prices (₹99 / ₹299 / ₹999) appear in the catalog
      expect(find.textContaining('Pricing: Pending Commercial Confirmation'), findsWidgets);
      expect(find.text('₹99'), findsNothing);
      expect(find.text('₹299'), findsNothing);
      expect(find.text('₹999'), findsNothing);
    });

    testWidgets('PassCheckoutSheet displays pending pricing & initiates checkout', (tester) async {
      await tester.pumpWidget(buildTestApp(
        Scaffold(
          body: PassCheckoutSheet(
            tier: PassTier.neighborhoodAllAccess,
            neighborhood: 'Malleshwaram',
          ),
        ),
      ));
      await tester.pumpAndSettle();

      expect(find.textContaining('NEIGHBORHOOD_ALL_ACCESS'), findsOneWidget);
      expect(find.textContaining('[Sandbox Mode: Simulated Payment'), findsOneWidget);
      expect(find.text('Pricing: Pending Commercial Confirmation'), findsOneWidget);
      expect(find.text('Initiate Pass Purchase (Sandbox)'), findsOneWidget);

      // Tap initiate pass purchase
      final initiateBtn = find.text('Initiate Pass Purchase (Sandbox)');
      await tester.ensureVisible(initiateBtn);
      await tester.tap(initiateBtn);
      await tester.pumpAndSettle();

      // Expect pass confirmation step
      expect(find.text('Complete Sandbox Payment (Activate Pass)'), findsOneWidget);
      expect(find.text('Simulate Payment Failure'), findsOneWidget);

      // Tap complete sandbox payment
      final activateBtn = find.text('Complete Sandbox Payment (Activate Pass)');
      await tester.ensureVisible(activateBtn);
      await tester.tap(activateBtn);
      await tester.pumpAndSettle();

      expect(find.text('Route Pass Activated!'), findsOneWidget);
      expect(find.text('Done'), findsOneWidget);
    });

    testWidgets('IdVerificationModalSheet displays local draft notice and saves draft', (tester) async {
      await tester.pumpWidget(buildTestApp(
        const Scaffold(
          body: IdVerificationModalSheet(),
        ),
      ));
      await tester.pumpAndSettle();

      expect(find.text('Resident Verification'), findsOneWidget);
      expect(find.text('Submit for Verification'), findsOneWidget);
      expect(find.text('Save Draft'), findsOneWidget);

      final saveDraftBtn = find.text('Save Draft');
      await tester.ensureVisible(saveDraftBtn);
      await tester.tap(saveDraftBtn);
      await tester.pumpAndSettle();

      expect(find.textContaining('Draft saved locally on device'), findsOneWidget);
    });

    testWidgets('GuidanceRequestSheet displays dispatch pending notice and saves draft', (tester) async {
      await tester.pumpWidget(buildTestApp(
        const Scaffold(
          body: GuidanceRequestSheet(
            guideUserId: 'usr_guide_1',
            guideName: 'Aravinth S',
          ),
        ),
      ));
      await tester.pumpAndSettle();

      expect(find.text('1-on-1 Local Guidance'), findsOneWidget);
      expect(find.text('Book 1-on-1 Guidance'), findsOneWidget);
      expect(find.text('Save Draft'), findsOneWidget);

      final saveGuidanceBtn = find.text('Save Draft');
      await tester.ensureVisible(saveGuidanceBtn);
      await tester.tap(saveGuidanceBtn);
      await tester.pumpAndSettle();

      expect(find.textContaining('Guidance request drafted locally!'), findsOneWidget);
    });

    test('MonetizationService handles live Cloud Function dispatches gracefully with fallback', () async {
      final service = MonetizationService();

      // Test live requestLocalGuidance dispatch
      final guidanceResult = await service.requestLocalGuidance(
        offeringId: 'offering_malleshwaram_heritage_walk',
        scheduledDateTime: '2026-11-25',
        specialNotes: 'Need early morning guidance',
      );
      // Since Firebase app isn't initialized in pure unit test, it returns local fallback gracefully
      expect(guidanceResult['bookingId'], isNotNull);
      expect(guidanceResult['status'], isIn(['PENDING_PAYMENT', 'pending_escrow', 'local_draft']));

      // Test live registerPartnerSubscription dispatch
      final partnerResult = await service.registerPartnerSubscription(
        merchantPlaceId: 'place_ctr_malleshwaram_01',
        businessName: 'CTR Heritage Cafe',
        contactEmail: 'contact@ctr.in',
        subscriptionPlan: 'VERIFIED_PARTNER',
      );
      expect(partnerResult['subscription'], isNotNull);
      final sub = partnerResult['subscription'] as Map<String, dynamic>;
      expect(sub['subscriptionId'], isNotNull);
      expect(sub['status'], isIn(['PENDING_PAYMENT', 'pending_payment', 'local_draft', 'ACTIVE']));
    });

    testWidgets('PartnerSubscriptionScreen displays local draft notice and accommodation tiers', (tester) async {
      await tester.pumpWidget(buildTestApp(const PartnerSubscriptionScreen()));
      await tester.pumpAndSettle();

      expect(find.text('Partner Subscriptions'), findsOneWidget);
      expect(find.text('Hospitality Partner Tiers'), findsOneWidget);
      expect(find.text('Community Free'), findsOneWidget);
      expect(find.text('Verified Partner'), findsOneWidget);
      expect(find.text('Featured Heritage'), findsOneWidget);
      expect(find.textContaining('Pricing: Pending Commercial Confirmation'), findsWidgets);
    });

    testWidgets('ContributorContentManagementScreen renders tabs and contributions list', (tester) async {
      await tester.pumpWidget(buildTestApp(const ContributorContentManagementScreen()));
      await tester.pumpAndSettle();

      expect(find.text('My Contributed Gems'), findsOneWidget);
      expect(find.text('All'), findsOneWidget);
      expect(find.text('Pending Review'), findsOneWidget);
      expect(find.text('Approved & Live'), findsOneWidget);
      expect(find.text('Needs Attention'), findsOneWidget);

      expect(find.text('ID: contrib_sample_1'), findsOneWidget);
      expect(find.text('VERIFIED & LIVE'), findsOneWidget);
      expect(find.text('ID: contrib_sample_2'), findsOneWidget);
      expect(find.text('AI ANALYZED'), findsOneWidget);
      expect(find.text('ID: contrib_sample_3'), findsOneWidget);
      expect(find.text('REJECTED'), findsOneWidget);
    });
  });
}
