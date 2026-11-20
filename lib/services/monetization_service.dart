import 'dart:async';
import 'package:cloud_functions/cloud_functions.dart';
import 'package:firebase_auth/firebase_auth.dart';
import '../models/monetization.dart';

/// Exception thrown when settlement or payment confirmation fails on the backend.
class PaymentSettlementException implements Exception {
  final String message;
  final String? transactionId;
  const PaymentSettlementException(this.message, {this.transactionId});
  @override
  String toString() => 'PaymentSettlementException: $message (tx: $transactionId)';
}

/// Service managing Contributor Ecosystem and Monetization operations.
/// Connects to Developer A's A5 Cloud Functions in `us-central1`.
class MonetizationService {
  final FirebaseFunctions? _functionsInstance;
  final FirebaseAuth? _authInstance;

  /// Test mode flag for isolated deterministic tests.
  final bool isTestMode;

  MonetizationService({
    FirebaseFunctions? functions,
    FirebaseAuth? auth,
    this.isTestMode = false,
  })  : _functionsInstance = functions,
        _authInstance = auth;

  FirebaseFunctions? get _functions {
    if (_functionsInstance != null) return _functionsInstance;
    try {
      return FirebaseFunctions.instanceFor(region: 'us-central1');
    } catch (_) {
      return null;
    }
  }

  FirebaseAuth? get _auth {
    if (_authInstance != null) return _authInstance;
    try {
      return FirebaseAuth.instance;
    } catch (_) {
      return null;
    }
  }

  /// Current authenticated user ID.
  String? get currentUserId => _auth?.currentUser?.uid;

  // In-memory collections for local drafts & test mode
  final List<RoutePass> _inMemoryPasses = [];
  final List<LocalIdVerificationDraft> _idVerificationDrafts = [];
  final List<LocalGuidanceRequestDraft> _guidanceDrafts = [];
  final List<LocalPartnerInquiryDraft> _partnerDrafts = [];

  // ===========================================================================
  // 1. Contributor Attribution & Rewards
  // ===========================================================================

  /// Fetches public attribution for a contributor.
  /// Calls `Monetization-getContributorAttribution`.
  Future<ContributorAttribution> getContributorAttribution({
    required String userId,
  }) async {
    if (isTestMode) {
      return ContributorAttribution(
        userId: userId,
        displayName: 'Aravinth S (Local Resident)',
        reputationTier: 'HERITAGE_SAGE',
        badgeTitle: 'Neighborhood Insider',
        approvedGemsCount: 5,
        isVerifiedResident: true,
      );
    }

    final functions = _functions;
    if (functions == null) {
      throw Exception('Firebase Functions unavailable.');
    }

    final callable = functions.httpsCallable('Monetization-getContributorAttribution');
    final result = await callable.call<Map<String, dynamic>>({'userId': userId});
    final responseMap = Map<String, dynamic>.from(result.data);
    final dataMap = Map<String, dynamic>.from(responseMap['data'] as Map? ?? {});
    return ContributorAttribution.fromMap(dataMap);
  }

  /// Fetches materialized reward balance ledger for a contributor.
  /// Calls `Monetization-getContributorRewardSummary`.
  Future<ContributorRewardLedger> getContributorRewardSummary({
    String? userId,
  }) async {
    if (isTestMode) {
      return ContributorRewardLedger(
        userId: userId ?? 'usr_test_contributor',
        totalEarningsInr: 1250.0,
        availableBalanceInr: 850.0,
        withdrawnTotalInr: 400.0,
        unrecoveredAdjustmentInr: 0.0,
        payoutUpiId: 'aravinth@okhdfcbank',
        reputationPoints: 340,
        guidanceRank: 'Malleshwaram Heritage Master',
        updatedAt: DateTime.now().subtract(const Duration(hours: 4)),
      );
    }

    final functions = _functions;
    if (functions == null) {
      throw Exception('Firebase Functions unavailable.');
    }

    final callable = functions.httpsCallable('Monetization-getContributorRewardSummary');
    final payload = userId != null ? {'userId': userId} : <String, dynamic>{};
    final result = await callable.call<Map<String, dynamic>>(payload);
    final responseMap = Map<String, dynamic>.from(result.data);
    final dataMap = Map<String, dynamic>.from(responseMap['data'] as Map? ?? {});
    return ContributorRewardLedger.fromMap(dataMap);
  }

  // ===========================================================================
  // 2. Micro-Tipping Flow (Sandbox Simulation)
  // ===========================================================================

  /// Initiates a micro-tip to a local contributor.
  /// Calls `Monetization-initiateTip`.
  Future<({ContributorTip tip, PaymentIntent paymentIntent})> initiateTip({
    required String recipientUserId,
    required String spotId,
    required String spotName,
    required double amountInr,
    String? personalNote,
  }) async {
    if (amountInr <= 0) {
      throw ArgumentError('Tip amount must be positive.');
    }

    if (isTestMode) {
      final tipId = 'tip_test_${DateTime.now().millisecondsSinceEpoch}';
      final platformFee = (amountInr * 0.05).roundToDouble();
      final netEarnings = amountInr - platformFee;
      final tip = ContributorTip(
        tipId: tipId,
        payerUserId: 'usr_test_payer',
        recipientUserId: recipientUserId,
        spotId: spotId,
        spotName: spotName,
        amountInr: amountInr,
        platformFeeInr: platformFee,
        contributorNetInr: netEarnings,
        paymentMode: PaymentMode.sandbox,
        paymentStatus: TipPaymentStatus.initiated,
        paymentGatewayReference: 'sandbox_sim_upi_${DateTime.now().millisecondsSinceEpoch}',
        personalNote: personalNote,
        createdAt: DateTime.now(),
      );
      final intent = PaymentIntent(
        transactionId: tipId,
        gatewayReference: tip.paymentGatewayReference!,
        amountInr: amountInr,
        currency: 'INR',
        mode: PaymentMode.sandbox,
        qrPayload: 'upi://pay?pa=sandbox@upi&am=$amountInr&tn=$tipId',
      );
      return (tip: tip, paymentIntent: intent);
    }

    final functions = _functions;
    if (functions == null) {
      throw Exception('Firebase Functions unavailable.');
    }

    final callable = functions.httpsCallable('Monetization-initiateTip');
    final payload = <String, dynamic>{
      'recipientUserId': recipientUserId,
      'spotId': spotId,
      'spotName': spotName,
      'amountInr': amountInr,
    };
    if (personalNote != null) payload['personalNote'] = personalNote;
    final result = await callable.call<Map<String, dynamic>>(payload);

    final responseMap = Map<String, dynamic>.from(result.data);
    final dataMap = Map<String, dynamic>.from(responseMap['data'] as Map? ?? {});
    final tipMap = Map<String, dynamic>.from(dataMap['tip'] as Map? ?? {});
    final intentMap = Map<String, dynamic>.from(dataMap['paymentIntent'] as Map? ?? {});

    return (
      tip: ContributorTip.fromMap(tipMap),
      paymentIntent: PaymentIntent.fromMap(intentMap),
    );
  }

  /// Settles a tip transaction.
  /// Calls `Monetization-settleTip`.
  /// Only a backend-confirmed response constitutes verified settlement.
  Future<({ContributorTip tip, ContributorRewardLedger rewardLedger, bool isIdempotentReplay})>
      settleTip({
    required String tipId,
    String? simulatedOutcome, // 'SUCCESS' | 'FAILURE'
  }) async {
    if (isTestMode) {
      if (simulatedOutcome == 'FAILURE') {
        throw PaymentSettlementException(
          'Simulated payment failure: payment was declined by sandbox banking rails.',
          transactionId: tipId,
        );
      }
      final settledTip = ContributorTip(
        tipId: tipId,
        payerUserId: 'usr_test_payer',
        recipientUserId: 'usr_test_contributor',
        spotId: 'spot_101',
        spotName: 'CTR Shri Sagar',
        amountInr: 100.0,
        platformFeeInr: 5.0,
        contributorNetInr: 95.0,
        paymentMode: PaymentMode.sandbox,
        paymentStatus: TipPaymentStatus.completed,
        paymentGatewayReference: 'sandbox_sim_upi_settled_$tipId',
        createdAt: DateTime.now().subtract(const Duration(minutes: 1)),
        settledAt: DateTime.now(),
      );
      final ledger = ContributorRewardLedger(
        userId: 'usr_test_contributor',
        totalEarningsInr: 1345.0,
        availableBalanceInr: 945.0,
        withdrawnTotalInr: 400.0,
        unrecoveredAdjustmentInr: 0.0,
        reputationPoints: 350,
        guidanceRank: 'Malleshwaram Heritage Master',
        updatedAt: DateTime.now(),
      );
      return (tip: settledTip, rewardLedger: ledger, isIdempotentReplay: false);
    }

    final functions = _functions;
    if (functions == null) {
      throw Exception('Firebase Functions unavailable.');
    }

    final callable = functions.httpsCallable('Monetization-settleTip');
    final payload = <String, dynamic>{
      'tipId': tipId,
    };
    if (simulatedOutcome != null) payload['simulatedOutcome'] = simulatedOutcome;
    final result = await callable.call<Map<String, dynamic>>(payload);

    final responseMap = Map<String, dynamic>.from(result.data);
    final dataMap = Map<String, dynamic>.from(responseMap['data'] as Map? ?? {});
    final tipMap = Map<String, dynamic>.from(dataMap['tip'] as Map? ?? {});
    final ledgerMap = Map<String, dynamic>.from(dataMap['rewardLedger'] as Map? ?? {});
    final isReplay = dataMap['isIdempotentReplay'] as bool? ?? false;

    return (
      tip: ContributorTip.fromMap(tipMap),
      rewardLedger: ContributorRewardLedger.fromMap(ledgerMap),
      isIdempotentReplay: isReplay,
    );
  }

  // ===========================================================================
  // 3. Route Passes (Purchase, Activation & Verification)
  // ===========================================================================

  /// Initiates a Route Pass purchase in PENDING status.
  /// Calls `Monetization-purchaseRoutePass`.
  Future<({RoutePass pass, PaymentIntent paymentIntent})> purchaseRoutePass({
    required PassTier tier,
    required String neighborhood,
    List<String>? accessibleRouteIds,
  }) async {
    if (isTestMode) {
      final passId = 'pass_${neighborhood.toLowerCase()}_${DateTime.now().millisecondsSinceEpoch}';
      final pass = RoutePass(
        passId: passId,
        userId: 'usr_test_buyer',
        tier: tier,
        neighborhood: neighborhood,
        accessibleRouteIds: accessibleRouteIds ?? ['route_malleshwaram_heritage_01'],
        pricePaidInr: 0.0, // Commercial pricing pending confirmation
        currency: 'INR',
        paymentMode: PaymentMode.sandbox,
        paymentGatewayReference: 'sandbox_sim_pass_$passId',
        status: PassStatus.pending,
        perksIncluded: const RoutePassPerks(
          audioGuidanceUnlocked: true,
          offlinePackUnlocked: true,
          merchantPartnerDiscountPercent: 10,
        ),
        validFrom: DateTime.now(),
        validUntil: DateTime.now().add(const Duration(days: 7)),
        purchasedAt: DateTime.now(),
      );
      final intent = PaymentIntent(
        transactionId: passId,
        gatewayReference: pass.paymentGatewayReference!,
        amountInr: 0.0,
        currency: 'INR',
        mode: PaymentMode.sandbox,
        qrPayload: 'upi://pay?pa=sandbox@upi&tn=$passId',
      );
      _inMemoryPasses.add(pass);
      return (pass: pass, paymentIntent: intent);
    }

    final functions = _functions;
    if (functions == null) {
      throw Exception('Firebase Functions unavailable.');
    }

    final callable = functions.httpsCallable('Monetization-purchaseRoutePass');
    final payload = <String, dynamic>{
      'tier': tier.value,
      'neighborhood': neighborhood,
    };
    if (accessibleRouteIds != null) payload['accessibleRouteIds'] = accessibleRouteIds;
    final result = await callable.call<Map<String, dynamic>>(payload);

    final responseMap = Map<String, dynamic>.from(result.data);
    final dataMap = Map<String, dynamic>.from(responseMap['data'] as Map? ?? {});
    final passMap = Map<String, dynamic>.from(dataMap['pass'] as Map? ?? {});
    final intentMap = Map<String, dynamic>.from(dataMap['paymentIntent'] as Map? ?? {});

    return (
      pass: RoutePass.fromMap(passMap),
      paymentIntent: PaymentIntent.fromMap(intentMap),
    );
  }

  /// Confirms payment and activates a pending route pass.
  /// Calls `Monetization-confirmPassPayment`.
  /// Only a backend-verified success activates the pass.
  Future<({RoutePass pass, bool isIdempotentReplay})> confirmPassPayment({
    required String passId,
    String? simulatedOutcome, // 'SUCCESS' | 'FAILURE'
  }) async {
    if (isTestMode) {
      if (simulatedOutcome == 'FAILURE') {
        throw PaymentSettlementException(
          'Payment verification failed: Declined by sandbox payment adapter.',
          transactionId: passId,
        );
      }
      final existingIndex = _inMemoryPasses.indexWhere((p) => p.passId == passId);
      final activePass = RoutePass(
        passId: passId,
        userId: 'usr_test_buyer',
        tier: PassTier.neighborhoodAllAccess,
        neighborhood: 'Malleshwaram',
        accessibleRouteIds: const ['route_malleshwaram_heritage_01'],
        pricePaidInr: 0.0,
        paymentMode: PaymentMode.sandbox,
        status: PassStatus.active,
        perksIncluded: const RoutePassPerks(
          audioGuidanceUnlocked: true,
          offlinePackUnlocked: true,
          merchantPartnerDiscountPercent: 10,
        ),
        validFrom: DateTime.now(),
        validUntil: DateTime.now().add(const Duration(days: 7)),
        purchasedAt: DateTime.now(),
      );
      if (existingIndex != -1) {
        _inMemoryPasses[existingIndex] = activePass;
      } else {
        _inMemoryPasses.add(activePass);
      }
      return (pass: activePass, isIdempotentReplay: false);
    }

    final functions = _functions;
    if (functions == null) {
      throw Exception('Firebase Functions unavailable.');
    }

    final callable = functions.httpsCallable('Monetization-confirmPassPayment');
    final payload = <String, dynamic>{
      'passId': passId,
    };
    if (simulatedOutcome != null) payload['simulatedOutcome'] = simulatedOutcome;
    final result = await callable.call<Map<String, dynamic>>(payload);

    final responseMap = Map<String, dynamic>.from(result.data);
    final dataMap = Map<String, dynamic>.from(responseMap['data'] as Map? ?? {});
    final passMap = Map<String, dynamic>.from(dataMap['pass'] as Map? ?? {});
    final isReplay = dataMap['isIdempotentReplay'] as bool? ?? false;

    return (
      pass: RoutePass.fromMap(passMap),
      isIdempotentReplay: isReplay,
    );
  }

  /// Lists all route passes owned by the current authenticated user.
  /// Calls `Monetization-listUserPasses`.
  Future<List<RoutePass>> listUserPasses() async {
    if (isTestMode) {
      if (_inMemoryPasses.isNotEmpty) return List.unmodifiable(_inMemoryPasses);
      return [
        RoutePass(
          passId: 'pass_sample_active_01',
          userId: 'usr_test_buyer',
          tier: PassTier.neighborhoodAllAccess,
          neighborhood: 'Malleshwaram',
          accessibleRouteIds: const ['route_malleshwaram_heritage_01'],
          pricePaidInr: 0.0,
          paymentMode: PaymentMode.sandbox,
          status: PassStatus.active,
          perksIncluded: const RoutePassPerks(
            audioGuidanceUnlocked: true,
            offlinePackUnlocked: true,
            merchantPartnerDiscountPercent: 10,
          ),
          validFrom: DateTime.now().subtract(const Duration(days: 1)),
          validUntil: DateTime.now().add(const Duration(days: 6)),
          purchasedAt: DateTime.now().subtract(const Duration(days: 1)),
        ),
      ];
    }

    final functions = _functions;
    if (functions == null) {
      throw Exception('Firebase Functions unavailable.');
    }

    final callable = functions.httpsCallable('Monetization-listUserPasses');
    final result = await callable.call<Map<String, dynamic>>({});
    final responseMap = Map<String, dynamic>.from(result.data);
    final dataList = responseMap['data'] as List? ?? [];

    return dataList
        .map((raw) => RoutePass.fromMap(Map<String, dynamic>.from(raw as Map)))
        .toList();
  }

  /// Verifies whether the traveler has active route pass access.
  /// Calls `Monetization-verifyRoutePassAccess`.
  Future<RoutePassAccessResult> verifyRoutePassAccess({
    String? routeId,
    String? neighborhood,
  }) async {
    if (isTestMode) {
      final hasActive = _inMemoryPasses.any((p) => p.isCurrentlyValid);
      return RoutePassAccessResult(
        hasAccess: hasActive,
        unlockedAudio: hasActive,
        unlockedOfflinePack: hasActive,
        partnerDiscountPercent: hasActive ? 10 : 0,
        grantingPassId: hasActive ? 'pass_sample_active_01' : null,
      );
    }

    final functions = _functions;
    if (functions == null) {
      throw Exception('Firebase Functions unavailable.');
    }

    final callable = functions.httpsCallable('Monetization-verifyRoutePassAccess');
    final payload = <String, dynamic>{};
    if (routeId != null) payload['routeId'] = routeId;
    if (neighborhood != null) payload['neighborhood'] = neighborhood;
    final result = await callable.call<Map<String, dynamic>>(payload);

    final responseMap = Map<String, dynamic>.from(result.data);
    final dataMap = Map<String, dynamic>.from(responseMap['data'] as Map? ?? {});
    return RoutePassAccessResult.fromMap(dataMap);
  }

  // ===========================================================================
  // 4. Partner Merchant Perks & Public Offers
  // ===========================================================================

  /// Fetches sanitized public partner offer for a place.
  /// Calls `Monetization-getPublicPartnerMerchantOffer`.
  Future<PublicPartnerOffer?> getPublicPartnerMerchantOffer({
    required String merchantPlaceId,
  }) async {
    if (isTestMode) {
      return PublicPartnerOffer(
        merchantPlaceId: merchantPlaceId,
        businessName: 'Veena Stores Malleshwaram',
        subscriptionPlan: 'VERIFIED_PARTNER',
        discountPercent: 10,
        discountTerms: '10% discount on coffee with breakfast thali for route pass holders.',
        isActive: true,
      );
    }

    final functions = _functions;
    if (functions == null) {
      throw Exception('Firebase Functions unavailable.');
    }

    final callable = functions.httpsCallable('Monetization-getPublicPartnerMerchantOffer');
    final result = await callable.call<Map<String, dynamic>>({
      'merchantPlaceId': merchantPlaceId,
    });

    final responseMap = Map<String, dynamic>.from(result.data);
    final data = responseMap['data'];
    if (data == null) return null;
    return PublicPartnerOffer.fromMap(Map<String, dynamic>.from(data as Map));
  }

  // ===========================================================================
  // 5. Local Drafts (No Backend Callables Implemented Yet)
  // ===========================================================================

  /// Saves ID verification request strictly as a local draft.
  /// Discloses: Backend submission callable pending Developer A.
  void saveIdVerificationDraft(LocalIdVerificationDraft draft) {
    _idVerificationDrafts.add(draft);
  }

  LocalIdVerificationDraft? getLatestIdVerificationDraft() {
    if (_idVerificationDrafts.isEmpty) return null;
    return _idVerificationDrafts.last;
  }

  /// Saves 1-on-1 guidance request strictly as a local draft.
  /// Discloses: Dispatch callable pending Developer A.
  void saveGuidanceRequestDraft(LocalGuidanceRequestDraft draft) {
    _guidanceDrafts.add(draft);
  }

  List<LocalGuidanceRequestDraft> getGuidanceRequestDrafts() {
    return List.unmodifiable(_guidanceDrafts);
  }

  /// Saves partner registration inquiry strictly as a local draft.
  /// Discloses: Partner self-serve registration callable pending Developer A.
  void savePartnerInquiryDraft(LocalPartnerInquiryDraft draft) {
    _partnerDrafts.add(draft);
  }

  List<LocalPartnerInquiryDraft> getPartnerInquiryDrafts() {
    return List.unmodifiable(_partnerDrafts);
  }
}
