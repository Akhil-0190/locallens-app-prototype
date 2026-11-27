import 'dart:async';
import 'package:cloud_functions/cloud_functions.dart';
import 'package:firebase_auth/firebase_auth.dart';
import '../models/app_failure.dart';
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
/// Connects to Cloud Functions `Monetization-*` in `us-central1`.
class MonetizationService {
  final FirebaseFunctions? _functionsInstance;
  final FirebaseAuth? _authInstance;

  MonetizationService({
    FirebaseFunctions? functions,
    FirebaseAuth? auth,
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
    final functions = _functions;
    if (functions == null) {
      throw AppFailure.network('Contributor attribution requires cloud connectivity.');
    }
    final callable = functions.httpsCallable('Monetization-getContributorAttribution');
    try {
      final result = await callable.call<Map<String, dynamic>>({
        'userId': userId,
        'isGuestAccess': true,
      });
      final responseMap = Map<String, dynamic>.from(result.data);
      final dataMap = Map<String, dynamic>.from(responseMap['data'] as Map? ?? {});
      if (dataMap.isEmpty) {
        throw AppFailure.notFound('No attribution profile found for contributor.');
      }
      return ContributorAttribution.fromMap(dataMap);
    } on AppFailure {
      rethrow;
    } on FirebaseFunctionsException catch (e) {
      throw AppFailure.backend(
        e.message ?? 'Could not load contributor attribution.',
        code: e.code,
        cause: e,
      );
    } catch (e) {
      throw AppFailure.network('Failed to fetch contributor attribution.', e);
    }
  }

  /// Fetches materialized reward balance ledger for a contributor.
  /// Calls `Monetization-getContributorRewardSummary`.
  Future<ContributorRewardLedger> getContributorRewardSummary({
    String? userId,
  }) async {
    final functions = _functions;
    if (functions == null) {
      throw AppFailure.network('Contributor rewards require cloud connectivity.');
    }
    final callable = functions.httpsCallable('Monetization-getContributorRewardSummary');
    final payload = userId != null ? {'userId': userId} : <String, dynamic>{};
    payload['isGuestAccess'] = true;
    try {
      final result = await callable.call<Map<String, dynamic>>(payload);
      final responseMap = Map<String, dynamic>.from(result.data);
      final dataMap = Map<String, dynamic>.from(responseMap['data'] as Map? ?? {});
      return ContributorRewardLedger.fromMap(dataMap);
    } on FirebaseFunctionsException catch (e) {
      throw AppFailure.backend(
        e.message ?? 'Could not load contributor reward summary.',
        code: e.code,
        cause: e,
      );
    } catch (e) {
      throw AppFailure.network('Failed to fetch contributor reward ledger.', e);
    }
  }

  // ===========================================================================
  // 2. Micro-Tipping Flow
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

    final functions = _functions;
    if (functions != null) {
      final callable = functions.httpsCallable('Monetization-initiateTip');
      final payload = <String, dynamic>{
        'recipientUserId': recipientUserId,
        'spotId': spotId,
        'spotName': spotName,
        'amountInr': amountInr,
        'isGuestAccess': true,
        'userId': currentUserId ?? 'usr_blr_guest',
        'payerUserId': currentUserId ?? 'usr_blr_guest',
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

    throw PaymentSettlementException(
      'Unable to reach payment backend to create Razorpay order.',
    );
  }

  /// Settles a tip transaction via `Monetization-settleTip` with verified Razorpay payment evidence.
  Future<({ContributorTip tip, ContributorRewardLedger rewardLedger, bool isIdempotentReplay})>
      settleTip({
    required String tipId,
    String? simulatedOutcome,
    String? providerPaymentId,
    String? providerSignature,
  }) async {
    final functions = _functions;
    if (functions != null) {
      final callable = functions.httpsCallable('Monetization-settleTip');
      final payload = <String, dynamic>{
        'tipId': tipId,
        'isGuestAccess': true,
        'userId': currentUserId ?? 'usr_blr_guest',
        'callerUserId': currentUserId ?? 'usr_blr_guest',
      };
      if (providerPaymentId != null && providerPaymentId.isNotEmpty) {
        payload['providerPaymentId'] = providerPaymentId;
        payload['razorpayPaymentId'] = providerPaymentId;
      }
      if (providerSignature != null && providerSignature.isNotEmpty) {
        payload['providerSignature'] = providerSignature;
        payload['razorpaySignature'] = providerSignature;
      }
      if (simulatedOutcome != null && providerPaymentId == null) {
        payload['simulatedOutcome'] = simulatedOutcome;
      }
      try {
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
      } on FirebaseFunctionsException catch (e) {
        throw PaymentSettlementException(
          e.message ?? 'Payment verification failed on server.',
          transactionId: tipId,
        );
      }
    }

    throw PaymentSettlementException(
      'Payment backend unavailable. Cannot verify tip settlement.',
      transactionId: tipId,
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
    final functions = _functions;
    if (functions != null) {
      final callable = functions.httpsCallable('Monetization-purchaseRoutePass');
      final payload = <String, dynamic>{
        'tier': tier.value,
        'neighborhood': neighborhood,
        'isGuestAccess': true,
        'userId': currentUserId ?? 'usr_blr_guest',
      };
      if (accessibleRouteIds != null) payload['accessibleRouteIds'] = accessibleRouteIds;
      final result = await callable.call<Map<String, dynamic>>(payload);
      final responseMap = Map<String, dynamic>.from(result.data);
      final dataMap = Map<String, dynamic>.from(responseMap['data'] as Map? ?? {});
      final passMap = Map<String, dynamic>.from(dataMap['pass'] as Map? ?? {});
      final intentMap = Map<String, dynamic>.from(dataMap['paymentIntent'] as Map? ?? {});

      final pass = RoutePass.fromMap(passMap);
      _inMemoryPasses.add(pass);
      return (
        pass: pass,
        paymentIntent: PaymentIntent.fromMap(intentMap),
      );
    }

    throw PaymentSettlementException(
      'Unable to reach payment backend to initiate Route Pass order.',
    );
  }

  /// Confirms payment and activates a pending route pass via `Monetization-confirmPassPayment`.
  Future<({RoutePass pass, bool isIdempotentReplay})> confirmPassPayment({
    required String passId,
    String? simulatedOutcome,
    String? providerPaymentId,
    String? providerSignature,
  }) async {
    final functions = _functions;
    if (functions != null) {
      final callable = functions.httpsCallable('Monetization-confirmPassPayment');
      final payload = <String, dynamic>{
        'passId': passId,
        'isGuestAccess': true,
        'userId': currentUserId ?? 'usr_blr_guest',
        'callerUserId': currentUserId ?? 'usr_blr_guest',
      };
      if (providerPaymentId != null && providerPaymentId.isNotEmpty) {
        payload['providerPaymentId'] = providerPaymentId;
        payload['razorpayPaymentId'] = providerPaymentId;
      }
      if (providerSignature != null && providerSignature.isNotEmpty) {
        payload['providerSignature'] = providerSignature;
        payload['razorpaySignature'] = providerSignature;
      }
      if (simulatedOutcome != null && providerPaymentId == null) {
        payload['simulatedOutcome'] = simulatedOutcome;
      }
      try {
        final result = await callable.call<Map<String, dynamic>>(payload);
        final responseMap = Map<String, dynamic>.from(result.data);
        final dataMap = Map<String, dynamic>.from(responseMap['data'] as Map? ?? {});
        final passMap = Map<String, dynamic>.from(dataMap['pass'] as Map? ?? {});
        final isReplay = dataMap['isIdempotentReplay'] as bool? ?? false;

        final pass = RoutePass.fromMap(passMap);
        final existingIndex = _inMemoryPasses.indexWhere((p) => p.passId == passId);
        if (existingIndex != -1) {
          _inMemoryPasses[existingIndex] = pass;
        } else {
          _inMemoryPasses.add(pass);
        }
        return (
          pass: pass,
          isIdempotentReplay: isReplay,
        );
      } on FirebaseFunctionsException catch (e) {
        throw PaymentSettlementException(
          e.message ?? 'Pass payment verification failed on server.',
          transactionId: passId,
        );
      }
    }

    throw PaymentSettlementException(
      'Payment backend unavailable. Cannot verify pass payment.',
      transactionId: passId,
    );
  }

  /// Fetches contributor revenue share payouts earned from Route Passes.
  Future<List<RevenueShareEntry>> getContributorRevenueShares({String? userId}) async {
    final functions = _functions;
    if (functions == null) {
      throw AppFailure.network('Revenue share history requires cloud connectivity.');
    }
    try {
      final callable = functions.httpsCallable('Monetization-getContributorRevenueShares');
      final result = await callable.call<Map<String, dynamic>>({
        if (userId != null) 'userId': userId,
        'isGuestAccess': true,
      });
      final responseMap = Map<String, dynamic>.from(result.data);
      final dataMap = Map<String, dynamic>.from(responseMap['data'] as Map? ?? {});
      final rawEntries = dataMap['entries'] as List<dynamic>? ?? const [];
      return rawEntries
          .whereType<Map>()
          .map((e) => RevenueShareEntry.fromMap(Map<String, dynamic>.from(e)))
          .toList();
    } on FirebaseFunctionsException catch (e) {
      throw AppFailure.backend(
        e.message ?? 'Could not fetch revenue shares.',
        code: e.code,
        cause: e,
      );
    } catch (e) {
      throw AppFailure.network('Unable to load contributor revenue shares.', e);
    }
  }

  /// Lists all route passes owned by the current authenticated user.
  /// Calls `Monetization-listUserPasses`.
  Future<List<RoutePass>> listUserPasses() async {
    final functions = _functions;
    if (functions == null) {
      if (_inMemoryPasses.isNotEmpty) return List.unmodifiable(_inMemoryPasses);
      throw AppFailure.network('Route passes require cloud connectivity.');
    }

    final callable = functions.httpsCallable('Monetization-listUserPasses');
    try {
      final result = await callable.call<Map<String, dynamic>>({});
      final responseMap = Map<String, dynamic>.from(result.data);
      final dataList = responseMap['data'] as List? ?? [];

      return dataList
          .map((raw) => RoutePass.fromMap(Map<String, dynamic>.from(raw as Map)))
          .toList();
    } on FirebaseFunctionsException catch (e) {
      if (_inMemoryPasses.isNotEmpty) return List.unmodifiable(_inMemoryPasses);
      throw AppFailure.backend(
        e.message ?? 'Could not load your route passes.',
        code: e.code,
        cause: e,
      );
    } catch (e) {
      if (_inMemoryPasses.isNotEmpty) return List.unmodifiable(_inMemoryPasses);
      throw AppFailure.network('Failed to load your route passes.', e);
    }
  }

  /// Verifies whether the traveler has active route pass access.
  /// Calls `Monetization-verifyRoutePassAccess`.
  Future<RoutePassAccessResult> verifyRoutePassAccess({
    String? routeId,
    String? neighborhood,
  }) async {
    final functions = _functions;
    if (functions != null) {
      final callable = functions.httpsCallable('Monetization-verifyRoutePassAccess');
      final payload = <String, dynamic>{};
      if (routeId != null) payload['routeId'] = routeId;
      if (neighborhood != null) payload['neighborhood'] = neighborhood;
      try {
        final result = await callable.call<Map<String, dynamic>>(payload);
        final responseMap = Map<String, dynamic>.from(result.data);
        final dataMap = Map<String, dynamic>.from(responseMap['data'] as Map? ?? {});
        return RoutePassAccessResult.fromMap(dataMap);
      } catch (_) {}
    }

    final validPasses = _inMemoryPasses.where((p) => p.isCurrentlyValid).toList();
    final hasActive = validPasses.isNotEmpty;
    return RoutePassAccessResult(
      hasAccess: hasActive,
      unlockedAudio: hasActive,
      unlockedOfflinePack: hasActive,
      partnerDiscountPercent: hasActive ? 10 : 0,
      grantingPassId: hasActive ? validPasses.first.passId : null,
    );
  }

  // ===========================================================================
  // 4. Partner Merchant Perks & Public Offers
  // ===========================================================================

  /// Fetches sanitized public partner offer for a place.
  /// Calls `Monetization-getPublicPartnerMerchantOffer`.
  Future<PublicPartnerOffer?> getPublicPartnerMerchantOffer({
    required String merchantPlaceId,
  }) async {
    final functions = _functions;
    if (functions == null) {
      return null;
    }

    final callable = functions.httpsCallable('Monetization-getPublicPartnerMerchantOffer');
    try {
      final result = await callable.call<Map<String, dynamic>>({
        'merchantPlaceId': merchantPlaceId,
      });
      final responseMap = Map<String, dynamic>.from(result.data);
      final data = responseMap['data'];
      if (data != null) {
        return PublicPartnerOffer.fromMap(Map<String, dynamic>.from(data as Map));
      }
      return null;
    } catch (_) {
      return null;
    }
  }

  // ===========================================================================
  // 5. Live Guidance Booking, Partner Merchant Dispatch & KYC Verification
  // ===========================================================================

  /// Submits resident/contributor KYC verification request via `Monetization-submitVerificationRequest`.
  Future<Map<String, dynamic>> submitVerificationRequest({
    required String documentType,
    String? documentStoragePath,
    String? neighborhood,
    String? fullName,
    String? notes,
  }) async {
    final functions = _functions;
    if (functions == null) {
      throw AppFailure.network('Verification submission requires cloud connectivity.');
    }

    final callable = functions.httpsCallable('Monetization-submitVerificationRequest');
    final result = await callable.call<Map<String, dynamic>>({
      'documentType': documentType,
      if (documentStoragePath != null) 'documentStoragePath': documentStoragePath,
      if (neighborhood != null) 'neighborhood': neighborhood,
      if (fullName != null) 'fullName': fullName,
      if (notes != null) 'notes': notes,
    });
    final responseMap = Map<String, dynamic>.from(result.data);
    return Map<String, dynamic>.from(responseMap['data'] as Map? ?? {});
  }

  /// Submits a 1-on-1 local guidance booking request to backend callable `Monetization-requestLocalGuidance`.
  Future<Map<String, dynamic>> requestLocalGuidance({
    required String offeringId,
    required String scheduledDateTime,
    String? specialNotes,
  }) async {
    final functions = _functions;
    if (functions == null) {
      throw AppFailure.network('Guidance booking requires cloud connectivity.');
    }

    final callable = functions.httpsCallable('Monetization-requestLocalGuidance');
    final payload = {
      'offeringId': offeringId,
      'scheduledDateTime': scheduledDateTime,
      ...?specialNotes != null && specialNotes.isNotEmpty ? {'specialNotes': specialNotes} : null,
    };

    final result = await callable.call<Map<String, dynamic>>(payload);
    final responseMap = Map<String, dynamic>.from(result.data);
    return Map<String, dynamic>.from(responseMap['data'] as Map? ?? {});
  }

  /// Confirms guidance booking payment via callable `Monetization-confirmGuidancePayment`.
  Future<Map<String, dynamic>> confirmGuidancePayment({
    required String bookingId,
    String? simulatedOutcome,
  }) async {
    final functions = _functions;
    if (functions == null) {
      throw AppFailure.network('Guidance payment confirmation requires cloud connectivity.');
    }

    final callable = functions.httpsCallable('Monetization-confirmGuidancePayment');
    final payload = {
      'bookingId': bookingId,
      ...?simulatedOutcome != null ? {'simulatedOutcome': simulatedOutcome} : null,
    };

    final result = await callable.call<Map<String, dynamic>>(payload);
    final responseMap = Map<String, dynamic>.from(result.data);
    return Map<String, dynamic>.from(responseMap['data'] as Map? ?? {});
  }

  /// Registers a merchant partner subscription via callable `Monetization-registerPartnerSubscription`.
  Future<Map<String, dynamic>> registerPartnerSubscription({
    required String merchantPlaceId,
    required String businessName,
    required String contactEmail,
    required String subscriptionPlan,
    Map<String, dynamic>? activeDiscountOffer,
    int durationDays = 365,
  }) async {
    final functions = _functions;
    if (functions == null) {
      throw AppFailure.network('Partner registration requires cloud connectivity.');
    }

    final callable = functions.httpsCallable('Monetization-registerPartnerSubscription');
    final payload = {
      'merchantPlaceId': merchantPlaceId,
      'businessName': businessName,
      'contactEmail': contactEmail,
      'subscriptionPlan': subscriptionPlan,
      ...?activeDiscountOffer != null ? {'activeDiscountOffer': activeDiscountOffer} : null,
      'durationDays': durationDays,
    };

    final result = await callable.call<Map<String, dynamic>>(payload);
    final responseMap = Map<String, dynamic>.from(result.data);
    return Map<String, dynamic>.from(responseMap['data'] as Map? ?? {});
  }

  /// Confirms partner subscription payment via callable `Monetization-confirmPartnerSubscriptionPayment`.
  Future<Map<String, dynamic>> confirmPartnerSubscriptionPayment({
    required String subscriptionId,
    String? simulatedOutcome,
  }) async {
    final functions = _functions;
    if (functions == null) {
      throw AppFailure.network('Partner payment confirmation requires cloud connectivity.');
    }

    final callable = functions.httpsCallable('Monetization-confirmPartnerSubscriptionPayment');
    final payload = {
      'subscriptionId': subscriptionId,
      ...?simulatedOutcome != null ? {'simulatedOutcome': simulatedOutcome} : null,
    };

    final result = await callable.call<Map<String, dynamic>>(payload);
    final responseMap = Map<String, dynamic>.from(result.data);
    return Map<String, dynamic>.from(responseMap['data'] as Map? ?? {});
  }

  // ===========================================================================
  // 6. Local Drafts & Offline Recovery
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
