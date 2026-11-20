/// Monetization & Contributor Ecosystem Models
/// Task D6 — Contributor Ecosystem & Monetization UI
/// Conforms to Domain 05, Domain 11, and Domain 12 Backend Contracts.
library;

export 'spot_card.dart' show ContributorAttribution;

enum PaymentMode {
  sandbox,
  live,
}

extension PaymentModeX on PaymentMode {
  String get value => this == PaymentMode.sandbox ? 'SANDBOX' : 'LIVE';

  static PaymentMode fromString(String? val) {
    if (val?.toUpperCase() == 'LIVE') return PaymentMode.live;
    return PaymentMode.sandbox;
  }
}

enum TipPaymentStatus {
  initiated,
  completed,
  failed,
  disbursed,
}

extension TipPaymentStatusX on TipPaymentStatus {
  String get value {
    switch (this) {
      case TipPaymentStatus.initiated:
        return 'INITIATED';
      case TipPaymentStatus.completed:
        return 'COMPLETED';
      case TipPaymentStatus.failed:
        return 'FAILED';
      case TipPaymentStatus.disbursed:
        return 'DISBURSED';
    }
  }

  static TipPaymentStatus fromString(String? val) {
    switch (val?.toUpperCase()) {
      case 'COMPLETED':
        return TipPaymentStatus.completed;
      case 'FAILED':
        return TipPaymentStatus.failed;
      case 'DISBURSED':
        return TipPaymentStatus.disbursed;
      case 'INITIATED':
      default:
        return TipPaymentStatus.initiated;
    }
  }
}

/// Contributor Micro-Tip Document
/// Conforms to Domain 11 `ContributorTipDocument`
class ContributorTip {
  final String tipId;
  final String payerUserId;
  final String recipientUserId;
  final String spotId;
  final String spotName;
  final double amountInr;
  final double platformFeeInr;
  final double contributorNetInr;
  final String currency;
  final PaymentMode paymentMode;
  final TipPaymentStatus paymentStatus;
  final String? paymentGatewayReference;
  final String? personalNote;
  final DateTime createdAt;
  final DateTime? settledAt;

  const ContributorTip({
    required this.tipId,
    required this.payerUserId,
    required this.recipientUserId,
    required this.spotId,
    required this.spotName,
    required this.amountInr,
    required this.platformFeeInr,
    required this.contributorNetInr,
    this.currency = 'INR',
    this.paymentMode = PaymentMode.sandbox,
    this.paymentStatus = TipPaymentStatus.initiated,
    this.paymentGatewayReference,
    this.personalNote,
    required this.createdAt,
    this.settledAt,
  });

  factory ContributorTip.fromMap(Map<String, dynamic> map) {
    return ContributorTip(
      tipId: map['tipId'] as String? ?? '',
      payerUserId: map['payerUserId'] as String? ?? '',
      recipientUserId: map['recipientUserId'] as String? ?? '',
      spotId: map['spotId'] as String? ?? '',
      spotName: map['spotName'] as String? ?? 'Local Spot',
      amountInr: (map['amountInr'] as num?)?.toDouble() ?? 0.0,
      platformFeeInr: (map['platformFeeInr'] as num?)?.toDouble() ?? 0.0,
      contributorNetInr: (map['contributorNetInr'] as num?)?.toDouble() ?? 0.0,
      currency: map['currency'] as String? ?? 'INR',
      paymentMode: PaymentModeX.fromString(map['paymentMode'] as String?),
      paymentStatus: TipPaymentStatusX.fromString(map['paymentStatus'] as String?),
      paymentGatewayReference: map['paymentGatewayReference'] as String?,
      personalNote: map['personalNote'] as String?,
      createdAt: map['createdAt'] != null
          ? DateTime.tryParse(map['createdAt'] as String) ?? DateTime.now()
          : DateTime.now(),
      settledAt: map['settledAt'] != null
          ? DateTime.tryParse(map['settledAt'] as String)
          : null,
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'tipId': tipId,
      'payerUserId': payerUserId,
      'recipientUserId': recipientUserId,
      'spotId': spotId,
      'spotName': spotName,
      'amountInr': amountInr,
      'platformFeeInr': platformFeeInr,
      'contributorNetInr': contributorNetInr,
      'currency': currency,
      'paymentMode': paymentMode.value,
      'paymentStatus': paymentStatus.value,
      if (paymentGatewayReference != null) 'paymentGatewayReference': paymentGatewayReference,
      if (personalNote != null) 'personalNote': personalNote,
      'createdAt': createdAt.toIso8601String(),
      if (settledAt != null) 'settledAt': settledAt!.toIso8601String(),
    };
  }
}

/// Payment Gateway Intent Result
/// Conforms to A5 `PaymentIntentResult`
class PaymentIntent {
  final String transactionId;
  final String gatewayReference;
  final double amountInr;
  final String currency;
  final PaymentMode mode;
  final String? qrPayload;
  final String? deeplinkUrl;

  const PaymentIntent({
    required this.transactionId,
    required this.gatewayReference,
    required this.amountInr,
    this.currency = 'INR',
    this.mode = PaymentMode.sandbox,
    this.qrPayload,
    this.deeplinkUrl,
  });

  factory PaymentIntent.fromMap(Map<String, dynamic> map) {
    return PaymentIntent(
      transactionId: map['transactionId'] as String? ?? '',
      gatewayReference: map['gatewayReference'] as String? ?? '',
      amountInr: (map['amountInr'] as num?)?.toDouble() ?? 0.0,
      currency: map['currency'] as String? ?? 'INR',
      mode: PaymentModeX.fromString(map['mode'] as String?),
      qrPayload: map['qrPayload'] as String?,
      deeplinkUrl: map['deeplinkUrl'] as String?,
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'transactionId': transactionId,
      'gatewayReference': gatewayReference,
      'amountInr': amountInr,
      'currency': currency,
      'mode': mode.value,
      if (qrPayload != null) 'qrPayload': qrPayload,
      if (deeplinkUrl != null) 'deeplinkUrl': deeplinkUrl,
    };
  }
}

/// Contributor Materialized Reward Ledger
/// Conforms to Domain 11 `ContributorRewardLedger`
class ContributorRewardLedger {
  final String userId;
  final double totalEarningsInr;
  final double availableBalanceInr;
  final double withdrawnTotalInr;
  final double unrecoveredAdjustmentInr;
  final String? payoutUpiId;
  final int reputationPoints;
  final String guidanceRank;
  final DateTime? lastPayoutAt;
  final DateTime updatedAt;

  const ContributorRewardLedger({
    required this.userId,
    required this.totalEarningsInr,
    required this.availableBalanceInr,
    required this.withdrawnTotalInr,
    this.unrecoveredAdjustmentInr = 0.0,
    this.payoutUpiId,
    required this.reputationPoints,
    required this.guidanceRank,
    this.lastPayoutAt,
    required this.updatedAt,
  });

  factory ContributorRewardLedger.fromMap(Map<String, dynamic> map) {
    return ContributorRewardLedger(
      userId: map['userId'] as String? ?? '',
      totalEarningsInr: (map['totalEarningsInr'] as num?)?.toDouble() ?? 0.0,
      availableBalanceInr: (map['availableBalanceInr'] as num?)?.toDouble() ?? 0.0,
      withdrawnTotalInr: (map['withdrawnTotalInr'] as num?)?.toDouble() ?? 0.0,
      unrecoveredAdjustmentInr: (map['unrecoveredAdjustmentInr'] as num?)?.toDouble() ?? 0.0,
      payoutUpiId: map['payoutUpiId'] as String?,
      reputationPoints: (map['reputationPoints'] as num?)?.toInt() ?? 0,
      guidanceRank: map['guidanceRank'] as String? ?? 'Community Scout',
      lastPayoutAt: map['lastPayoutAt'] != null
          ? DateTime.tryParse(map['lastPayoutAt'] as String)
          : null,
      updatedAt: map['updatedAt'] != null
          ? DateTime.tryParse(map['updatedAt'] as String) ?? DateTime.now()
          : DateTime.now(),
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'userId': userId,
      'totalEarningsInr': totalEarningsInr,
      'availableBalanceInr': availableBalanceInr,
      'withdrawnTotalInr': withdrawnTotalInr,
      'unrecoveredAdjustmentInr': unrecoveredAdjustmentInr,
      if (payoutUpiId != null) 'payoutUpiId': payoutUpiId,
      'reputationPoints': reputationPoints,
      'guidanceRank': guidanceRank,
      if (lastPayoutAt != null) 'lastPayoutAt': lastPayoutAt!.toIso8601String(),
      'updatedAt': updatedAt.toIso8601String(),
    };
  }
}



enum PassTier {
  singleRoute,
  neighborhoodAllAccess,
  annualExplorer,
}

extension PassTierX on PassTier {
  String get value {
    switch (this) {
      case PassTier.singleRoute:
        return 'SINGLE_ROUTE';
      case PassTier.neighborhoodAllAccess:
        return 'NEIGHBORHOOD_ALL_ACCESS';
      case PassTier.annualExplorer:
        return 'ANNUAL_EXPLORER';
    }
  }

  String get displayName {
    switch (this) {
      case PassTier.singleRoute:
        return 'Single Route Pass';
      case PassTier.neighborhoodAllAccess:
        return 'Neighborhood Explorer';
      case PassTier.annualExplorer:
        return 'Annual Global Pass';
    }
  }

  String get durationLabel {
    switch (this) {
      case PassTier.singleRoute:
        return '48 Hours Access';
      case PassTier.neighborhoodAllAccess:
        return '7 Days Access';
      case PassTier.annualExplorer:
        return '365 Days Access';
    }
  }

  static PassTier fromString(String? val) {
    switch (val?.toUpperCase()) {
      case 'NEIGHBORHOOD_ALL_ACCESS':
        return PassTier.neighborhoodAllAccess;
      case 'ANNUAL_EXPLORER':
        return PassTier.annualExplorer;
      case 'SINGLE_ROUTE':
      default:
        return PassTier.singleRoute;
    }
  }
}

enum PassStatus {
  pending,
  active,
  expired,
  revoked,
}

extension PassStatusX on PassStatus {
  String get value {
    switch (this) {
      case PassStatus.pending:
        return 'PENDING';
      case PassStatus.active:
        return 'ACTIVE';
      case PassStatus.expired:
        return 'EXPIRED';
      case PassStatus.revoked:
        return 'REVOKED';
    }
  }

  static PassStatus fromString(String? val) {
    switch (val?.toUpperCase()) {
      case 'ACTIVE':
        return PassStatus.active;
      case 'EXPIRED':
        return PassStatus.expired;
      case 'REVOKED':
        return PassStatus.revoked;
      case 'PENDING':
      default:
        return PassStatus.pending;
    }
  }
}

/// Perks Included in Route Pass
class RoutePassPerks {
  final bool audioGuidanceUnlocked;
  final bool offlinePackUnlocked;
  final int merchantPartnerDiscountPercent;

  const RoutePassPerks({
    required this.audioGuidanceUnlocked,
    required this.offlinePackUnlocked,
    required this.merchantPartnerDiscountPercent,
  });

  factory RoutePassPerks.fromMap(Map<String, dynamic> map) {
    return RoutePassPerks(
      audioGuidanceUnlocked: map['audioGuidanceUnlocked'] as bool? ?? false,
      offlinePackUnlocked: map['offlinePackUnlocked'] as bool? ?? false,
      merchantPartnerDiscountPercent:
          (map['merchantPartnerDiscountPercent'] as num?)?.toInt() ?? 0,
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'audioGuidanceUnlocked': audioGuidanceUnlocked,
      'offlinePackUnlocked': offlinePackUnlocked,
      'merchantPartnerDiscountPercent': merchantPartnerDiscountPercent,
    };
  }
}

/// Route Pass Document
/// Conforms to Domain 12 `RoutePassDocument`
class RoutePass {
  final String passId;
  final String userId;
  final PassTier tier;
  final String neighborhood;
  final List<String> accessibleRouteIds;
  final double pricePaidInr;
  final String currency;
  final PaymentMode paymentMode;
  final String? paymentGatewayReference;
  final PassStatus status;
  final RoutePassPerks perksIncluded;
  final DateTime validFrom;
  final DateTime validUntil;
  final DateTime purchasedAt;

  const RoutePass({
    required this.passId,
    required this.userId,
    required this.tier,
    required this.neighborhood,
    required this.accessibleRouteIds,
    required this.pricePaidInr,
    this.currency = 'INR',
    this.paymentMode = PaymentMode.sandbox,
    this.paymentGatewayReference,
    required this.status,
    required this.perksIncluded,
    required this.validFrom,
    required this.validUntil,
    required this.purchasedAt,
  });

  bool get isCurrentlyValid =>
      status == PassStatus.active &&
      DateTime.now().isBefore(validUntil) &&
      DateTime.now().isAfter(validFrom.subtract(const Duration(seconds: 10)));

  factory RoutePass.fromMap(Map<String, dynamic> map) {
    return RoutePass(
      passId: map['passId'] as String? ?? '',
      userId: map['userId'] as String? ?? '',
      tier: PassTierX.fromString(map['tier'] as String?),
      neighborhood: map['neighborhood'] as String? ?? '',
      accessibleRouteIds: List<String>.from(map['accessibleRouteIds'] as List? ?? []),
      pricePaidInr: (map['pricePaidInr'] as num?)?.toDouble() ?? 0.0,
      currency: map['currency'] as String? ?? 'INR',
      paymentMode: PaymentModeX.fromString(map['paymentMode'] as String?),
      paymentGatewayReference: map['paymentGatewayReference'] as String?,
      status: PassStatusX.fromString(map['status'] as String?),
      perksIncluded: RoutePassPerks.fromMap(
        Map<String, dynamic>.from(map['perksIncluded'] as Map? ?? {}),
      ),
      validFrom: map['validFrom'] != null
          ? DateTime.tryParse(map['validFrom'] as String) ?? DateTime.now()
          : DateTime.now(),
      validUntil: map['validUntil'] != null
          ? DateTime.tryParse(map['validUntil'] as String) ?? DateTime.now()
          : DateTime.now(),
      purchasedAt: map['purchasedAt'] != null
          ? DateTime.tryParse(map['purchasedAt'] as String) ?? DateTime.now()
          : DateTime.now(),
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'passId': passId,
      'userId': userId,
      'tier': tier.value,
      'neighborhood': neighborhood,
      'accessibleRouteIds': accessibleRouteIds,
      'pricePaidInr': pricePaidInr,
      'currency': currency,
      'paymentMode': paymentMode.value,
      if (paymentGatewayReference != null) 'paymentGatewayReference': paymentGatewayReference,
      'status': status.value,
      'perksIncluded': perksIncluded.toMap(),
      'validFrom': validFrom.toIso8601String(),
      'validUntil': validUntil.toIso8601String(),
      'purchasedAt': purchasedAt.toIso8601String(),
    };
  }
}

/// Access Verification Output
/// Conforms to A5 `verifyRoutePassAccess` response
class RoutePassAccessResult {
  final bool hasAccess;
  final bool unlockedAudio;
  final bool unlockedOfflinePack;
  final int partnerDiscountPercent;
  final String? grantingPassId;

  const RoutePassAccessResult({
    required this.hasAccess,
    required this.unlockedAudio,
    required this.unlockedOfflinePack,
    required this.partnerDiscountPercent,
    this.grantingPassId,
  });

  factory RoutePassAccessResult.fromMap(Map<String, dynamic> map) {
    return RoutePassAccessResult(
      hasAccess: map['hasAccess'] as bool? ?? false,
      unlockedAudio: map['unlockedAudio'] as bool? ?? false,
      unlockedOfflinePack: map['unlockedOfflinePack'] as bool? ?? false,
      partnerDiscountPercent: (map['partnerDiscountPercent'] as num?)?.toInt() ?? 0,
      grantingPassId: map['grantingPassId'] as String?,
    );
  }
}

/// Sanitized Public Partner Offer
/// Conforms to A5 `PublicPartnerOffer`
class PublicPartnerOffer {
  final String merchantPlaceId;
  final String businessName;
  final String subscriptionPlan;
  final int? discountPercent;
  final String? discountTerms;
  final bool isActive;

  const PublicPartnerOffer({
    required this.merchantPlaceId,
    required this.businessName,
    required this.subscriptionPlan,
    this.discountPercent,
    this.discountTerms,
    required this.isActive,
  });

  factory PublicPartnerOffer.fromMap(Map<String, dynamic> map) {
    final discountMap = map['activeDiscountOffer'] as Map<String, dynamic>?;
    return PublicPartnerOffer(
      merchantPlaceId: map['merchantPlaceId'] as String? ?? '',
      businessName: map['businessName'] as String? ?? 'Partner Merchant',
      subscriptionPlan: map['subscriptionPlan'] as String? ?? 'COMMUNITY_FREE',
      discountPercent: (discountMap?['discountPercent'] as num?)?.toInt(),
      discountTerms: discountMap?['terms'] as String?,
      isActive: map['isActive'] as bool? ?? false,
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'merchantPlaceId': merchantPlaceId,
      'businessName': businessName,
      'subscriptionPlan': subscriptionPlan,
      if (discountPercent != null || discountTerms != null)
        'activeDiscountOffer': {
          if (discountPercent != null) 'discountPercent': discountPercent,
          if (discountTerms != null) 'terms': discountTerms,
        },
      'isActive': isActive,
    };
  }
}

/// Local Draft Model: ID Verification
/// Stored locally because no backend upload endpoint currently exists.
class LocalIdVerificationDraft {
  final String neighborhood;
  final String documentType;
  final String documentDescription;
  final DateTime createdAt;

  const LocalIdVerificationDraft({
    required this.neighborhood,
    required this.documentType,
    required this.documentDescription,
    required this.createdAt,
  });

  Map<String, dynamic> toMap() => {
        'neighborhood': neighborhood,
        'documentType': documentType,
        'documentDescription': documentDescription,
        'createdAt': createdAt.toIso8601String(),
      };

  factory LocalIdVerificationDraft.fromMap(Map<String, dynamic> map) =>
      LocalIdVerificationDraft(
        neighborhood: map['neighborhood'] as String? ?? '',
        documentType: map['documentType'] as String? ?? '',
        documentDescription: map['documentDescription'] as String? ?? '',
        createdAt: map['createdAt'] != null
            ? DateTime.tryParse(map['createdAt'] as String) ?? DateTime.now()
            : DateTime.now(),
      );
}

/// Local Draft Model: 1-on-1 Guidance Request
/// Stored locally because no dispatch/booking callable currently exists.
class LocalGuidanceRequestDraft {
  final String guideUserId;
  final String preferredDate;
  final String timeOfDay;
  final String neighborhood;
  final String culturalFocus;
  final String notes;
  final DateTime createdAt;

  const LocalGuidanceRequestDraft({
    required this.guideUserId,
    required this.preferredDate,
    required this.timeOfDay,
    required this.neighborhood,
    required this.culturalFocus,
    required this.notes,
    required this.createdAt,
  });

  Map<String, dynamic> toMap() => {
        'guideUserId': guideUserId,
        'preferredDate': preferredDate,
        'timeOfDay': timeOfDay,
        'neighborhood': neighborhood,
        'culturalFocus': culturalFocus,
        'notes': notes,
        'createdAt': createdAt.toIso8601String(),
      };

  factory LocalGuidanceRequestDraft.fromMap(Map<String, dynamic> map) =>
      LocalGuidanceRequestDraft(
        guideUserId: map['guideUserId'] as String? ?? '',
        preferredDate: map['preferredDate'] as String? ?? '',
        timeOfDay: map['timeOfDay'] as String? ?? 'Morning',
        neighborhood: map['neighborhood'] as String? ?? '',
        culturalFocus: map['culturalFocus'] as String? ?? 'General',
        notes: map['notes'] as String? ?? '',
        createdAt: map['createdAt'] != null
            ? DateTime.tryParse(map['createdAt'] as String) ?? DateTime.now()
            : DateTime.now(),
      );
}

/// Local Draft Model: Partner Subscription Registration
/// Stored locally because no partner self-service callable currently exists.
class LocalPartnerInquiryDraft {
  final String businessName;
  final String propertyType; // 'HOTEL' | 'HOMESTAY' | 'HOSTEL'
  final String neighborhood;
  final String contactEmail;
  final String proposedPerk;
  final String selectedPlanTier; // 'COMMUNITY_FREE' | 'VERIFIED_PARTNER' | 'FEATURED_HERITAGE'
  final DateTime createdAt;

  const LocalPartnerInquiryDraft({
    required this.businessName,
    required this.propertyType,
    required this.neighborhood,
    required this.contactEmail,
    required this.proposedPerk,
    required this.selectedPlanTier,
    required this.createdAt,
  });

  Map<String, dynamic> toMap() => {
        'businessName': businessName,
        'propertyType': propertyType,
        'neighborhood': neighborhood,
        'contactEmail': contactEmail,
        'proposedPerk': proposedPerk,
        'selectedPlanTier': selectedPlanTier,
        'createdAt': createdAt.toIso8601String(),
      };

  factory LocalPartnerInquiryDraft.fromMap(Map<String, dynamic> map) =>
      LocalPartnerInquiryDraft(
        businessName: map['businessName'] as String? ?? '',
        propertyType: map['propertyType'] as String? ?? 'HOTEL',
        neighborhood: map['neighborhood'] as String? ?? '',
        contactEmail: map['contactEmail'] as String? ?? '',
        proposedPerk: map['proposedPerk'] as String? ?? '',
        selectedPlanTier: map['selectedPlanTier'] as String? ?? 'COMMUNITY_FREE',
        createdAt: map['createdAt'] != null
            ? DateTime.tryParse(map['createdAt'] as String) ?? DateTime.now()
            : DateTime.now(),
      );
}
