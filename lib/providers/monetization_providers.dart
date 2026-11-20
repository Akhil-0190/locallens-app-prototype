import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/contribution.dart';
import '../models/monetization.dart';
import '../providers/spot_providers.dart';
import '../services/contribution_service.dart';
import '../services/monetization_service.dart';

/// Monetization service provider.
final monetizationServiceProvider = Provider<MonetizationService>((ref) {
  final isTest = ref.watch(isTestModeProvider);
  return MonetizationService(isTestMode: isTest);
});

/// Contribution service provider (supporting listMyContributions & pipeline tracking).
final contributionServiceProvider = Provider<ContributionService>((ref) {
  final isTest = ref.watch(isTestModeProvider);
  return ContributionService(isTestMode: isTest);
});

/// Public attribution provider for a contributor by userId.
final contributorAttributionProvider =
    FutureProvider.family<ContributorAttribution, String>((ref, userId) async {
  final service = ref.watch(monetizationServiceProvider);
  return service.getContributorAttribution(userId: userId);
});

/// Materialized reward summary provider for a contributor.
final contributorRewardSummaryProvider =
    FutureProvider.family<ContributorRewardLedger, String?>((ref, userId) async {
  final service = ref.watch(monetizationServiceProvider);
  return service.getContributorRewardSummary(userId: userId);
});

/// Lists all contributions authored by the current authenticated user.
final myContributionsProvider =
    FutureProvider.autoDispose<List<ContributionDocument>>((ref) async {
  final service = ref.watch(contributionServiceProvider);
  return service.listMyContributions();
});

/// Lists all route passes owned by the current authenticated user.
final userPassesProvider =
    FutureProvider.autoDispose<List<RoutePass>>((ref) async {
  final service = ref.watch(monetizationServiceProvider);
  return service.listUserPasses();
});

/// Query record for route pass access verification.
class RouteAccessQuery {
  final String? routeId;
  final String? neighborhood;
  const RouteAccessQuery({this.routeId, this.neighborhood});

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is RouteAccessQuery &&
          runtimeType == other.runtimeType &&
          routeId == other.routeId &&
          neighborhood == other.neighborhood;

  @override
  int get hashCode => Object.hash(routeId, neighborhood);
}

/// Verifies whether the traveler holds an active route pass for a given route/neighborhood.
final routePassAccessProvider =
    FutureProvider.family<RoutePassAccessResult, RouteAccessQuery>((ref, query) async {
  final service = ref.watch(monetizationServiceProvider);
  return service.verifyRoutePassAccess(
    routeId: query.routeId,
    neighborhood: query.neighborhood,
  );
});

/// Public sanitized merchant partner perks provider.
final publicPartnerOfferProvider =
    FutureProvider.family<PublicPartnerOffer?, String>((ref, merchantPlaceId) async {
  final service = ref.watch(monetizationServiceProvider);
  return service.getPublicPartnerOffer(merchantPlaceId: merchantPlaceId);
});

/// State representation for monetization interactions (Tipping, Checkout, Drafts).
class MonetizationUiState {
  final bool isLoading;
  final String? errorMessage;
  final String? successMessage;
  final PaymentIntent? pendingPaymentIntent;
  final ContributorTip? pendingTip;
  final RoutePass? pendingPass;
  final ContributorTip? lastSettledTip;
  final RoutePass? lastActivatedPass;

  const MonetizationUiState({
    this.isLoading = false,
    this.errorMessage,
    this.successMessage,
    this.pendingPaymentIntent,
    this.pendingTip,
    this.pendingPass,
    this.lastSettledTip,
    this.lastActivatedPass,
  });

  MonetizationUiState copyWith({
    bool? isLoading,
    String? errorMessage,
    String? successMessage,
    PaymentIntent? pendingPaymentIntent,
    ContributorTip? pendingTip,
    RoutePass? pendingPass,
    ContributorTip? lastSettledTip,
    RoutePass? lastActivatedPass,
    bool clearPendingIntent = false,
    bool clearError = false,
    bool clearSuccess = false,
  }) {
    return MonetizationUiState(
      isLoading: isLoading ?? this.isLoading,
      errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
      successMessage: clearSuccess ? null : (successMessage ?? this.successMessage),
      pendingPaymentIntent: clearPendingIntent ? null : (pendingPaymentIntent ?? this.pendingPaymentIntent),
      pendingTip: clearPendingIntent ? null : (pendingTip ?? this.pendingTip),
      pendingPass: clearPendingIntent ? null : (pendingPass ?? this.pendingPass),
      lastSettledTip: lastSettledTip ?? this.lastSettledTip,
      lastActivatedPass: lastActivatedPass ?? this.lastActivatedPass,
    );
  }
}

/// State notifier managing active payment flows and draft submissions.
class MonetizationNotifier extends StateNotifier<MonetizationUiState> {
  final MonetizationService _service;
  final Ref _ref;

  MonetizationNotifier(this._service, this._ref) : super(const MonetizationUiState());

  void clearMessages() {
    state = state.copyWith(clearError: true, clearSuccess: true);
  }

  /// Initiates a micro-tip. Sets pending state with generated PaymentIntent.
  Future<bool> initiateTip({
    required String recipientUserId,
    required String spotId,
    required String spotName,
    required double amountInr,
    String? personalNote,
  }) async {
    state = state.copyWith(isLoading: true, clearError: true, clearSuccess: true);
    try {
      final result = await _service.initiateTip(
        recipientUserId: recipientUserId,
        spotId: spotId,
        spotName: spotName,
        amountInr: amountInr,
        personalNote: personalNote,
      );
      state = state.copyWith(
        isLoading: false,
        pendingTip: result.tip,
        pendingPaymentIntent: result.paymentIntent,
      );
      return true;
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        errorMessage: 'Failed to initiate tip: $e',
      );
      return false;
    }
  }

  /// Settles a tip transaction. Requires backend confirmation.
  Future<bool> settleTip({
    required String tipId,
    String? simulatedOutcome,
  }) async {
    state = state.copyWith(isLoading: true, clearError: true, clearSuccess: true);
    try {
      final result = await _service.settleTip(
        tipId: tipId,
        simulatedOutcome: simulatedOutcome,
      );
      state = state.copyWith(
        isLoading: false,
        lastSettledTip: result.tip,
        successMessage: 'Tip of ₹${result.tip.amountInr.toStringAsFixed(0)} successfully settled! Thank you for supporting local contributors.',
        clearPendingIntent: true,
      );
      // Invalidate reward summary so balance updates reactively
      _ref.invalidate(contributorRewardSummaryProvider);
      return true;
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        errorMessage: 'Tip settlement failed: $e',
      );
      return false;
    }
  }

  /// Initiates a Route Pass purchase in PENDING status.
  Future<bool> purchaseRoutePass({
    required PassTier tier,
    required String neighborhood,
    List<String>? accessibleRouteIds,
  }) async {
    state = state.copyWith(isLoading: true, clearError: true, clearSuccess: true);
    try {
      final result = await _service.purchaseRoutePass(
        tier: tier,
        neighborhood: neighborhood,
        accessibleRouteIds: accessibleRouteIds,
      );
      state = state.copyWith(
        isLoading: false,
        pendingPass: result.pass,
        pendingPaymentIntent: result.paymentIntent,
      );
      return true;
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        errorMessage: 'Failed to initiate pass purchase: $e',
      );
      return false;
    }
  }

  /// Confirms Route Pass payment and activates pass via Monetization-confirmPassPayment.
  Future<bool> confirmPassPayment({
    required String passId,
    String? simulatedOutcome,
  }) async {
    state = state.copyWith(isLoading: true, clearError: true, clearSuccess: true);
    try {
      final result = await _service.confirmPassPayment(
        passId: passId,
        simulatedOutcome: simulatedOutcome,
      );
      state = state.copyWith(
        isLoading: false,
        lastActivatedPass: result.pass,
        successMessage: '${result.pass.tier.displayName} is now ACTIVE! Audio guidance and offline maps unlocked.',
        clearPendingIntent: true,
      );
      _ref.invalidate(userPassesProvider);
      return true;
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        errorMessage: 'Pass activation failed: $e',
      );
      return false;
    }
  }

  /// Saves ID verification request strictly as a local draft.
  void saveIdVerificationDraft(LocalIdVerificationDraft draft) {
    _service.saveIdVerificationDraft(draft);
    state = state.copyWith(
      successMessage: 'ID verification draft saved locally. (Backend submission callable pending Developer A)',
    );
  }

  /// Saves 1-on-1 guidance request strictly as a local draft.
  void saveGuidanceRequestDraft(LocalGuidanceRequestDraft draft) {
    _service.saveGuidanceRequestDraft(draft);
    state = state.copyWith(
      successMessage: '1-on-1 guidance request saved locally. (Dispatch callable pending Developer A)',
    );
  }

  /// Saves partner registration inquiry strictly as a local draft.
  void savePartnerInquiryDraft(LocalPartnerInquiryDraft draft) {
    _service.savePartnerInquiryDraft(draft);
    state = state.copyWith(
      successMessage: 'Partner inquiry draft saved locally. (Registration callable pending Developer A)',
    );
  }
}

final monetizationNotifierProvider =
    StateNotifierProvider<MonetizationNotifier, MonetizationUiState>((ref) {
  final service = ref.watch(monetizationServiceProvider);
  return MonetizationNotifier(service, ref);
});
