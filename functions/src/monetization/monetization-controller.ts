/**
 * Monetization & Contributor Ecosystem Controller — Firebase Callable Functions
 * Task A5 — Contributor Ecosystem & Monetization Backend
 *
 * Exports:
 *   - initiateTip                    — Start micro-tip payment process
 *   - settleTip                      — Confirm payment & credit contributor balance transactionally
 *   - getContributorRewardSummary    — Query contributor earnings, balance, and guidance rank
 *   - purchaseRoutePass              — Buy walking route pass (single route, neighborhood, annual)
 *   - verifyRoutePassAccess          — Verify audio/offline access for a route
 *   - listUserPasses                 — Retrieve caller's passes
 *   - getPublicPartnerMerchantOffer  — Retrieve sanitized partner stall perks
 *   - getContributorAttribution      — Retrieve public badges and reputation
 */

import { onCall, onRequest, HttpsError } from 'firebase-functions/v2/https';
import * as logger from 'firebase-functions/logger';
import { randomUUID, createHmac } from 'node:crypto';
import { db } from '../config/firebase.js';
import {
  razorpayKeyId,
  razorpayKeySecret,
  paymentWebhookSecret,
} from '../config/secrets.js';
import { ApiSuccessResponse, PassTier, MerchantPlanTier } from '../types/contracts/index.js';

const monetizationCallableOptions = {
  secrets: [razorpayKeyId, razorpayKeySecret],
};
import { TippingService } from './services/tipping-service.js';
import { PassService } from './services/pass-service.js';
import { MerchantSubscriptionService } from './services/merchant-subscription-service.js';
import { ContributorProfileService } from './services/contributor-service.js';
import { GuidanceService } from './services/guidance-service.js';
import { getPaymentAdapter } from './adapters/payment-adapter-factory.js';

let _paymentAdapter: any = null;
let _tippingService: TippingService | null = null;
let _passService: PassService | null = null;
let _merchantService: MerchantSubscriptionService | null = null;
let _guidanceService: GuidanceService | null = null;
const contributorService = new ContributorProfileService();

function getAdapter() {
  if (!_paymentAdapter) {
    try {
      _paymentAdapter = getPaymentAdapter();
    } catch {
      _paymentAdapter = getPaymentAdapter('SANDBOX');
    }
  }
  return _paymentAdapter;
}

function getTippingService(): TippingService {
  if (!_tippingService) _tippingService = new TippingService(getAdapter());
  return _tippingService;
}
function getPassService(): PassService {
  if (!_passService) _passService = new PassService(getAdapter());
  return _passService;
}
function getMerchantService(): MerchantSubscriptionService {
  if (!_merchantService) _merchantService = new MerchantSubscriptionService(getAdapter());
  return _merchantService;
}
function getGuidanceService(): GuidanceService {
  if (!_guidanceService) _guidanceService = new GuidanceService(getAdapter());
  return _guidanceService;
}

function requestId(): string {
  return randomUUID().replace(/-/g, '').slice(0, 12);
}

function successEnvelope<T>(data: T, startMs: number): ApiSuccessResponse {
  return {
    success: true,
    data: data as Record<string, unknown>,
    metadata: {
      requestId: requestId(),
      timestamp: new Date().toISOString(),
      executionDurationMs: Date.now() - startMs,
      version: 'A5',
    },
  };
}

/**
 * Callable: initiateTip
 * Traveler sends a micro-tip to a local contributor.
 */
export const initiateTip = onCall(monetizationCallableOptions, async (request) => {
  const startMs = Date.now();
  const isGuest = (request.data as any)?.isGuestAccess === true;
  const callerUid = request.auth?.uid || (isGuest ? ((request.data as any)?.userId || 'guest_traveler') : undefined);
  if (!callerUid) {
    throw new HttpsError('unauthenticated', 'User must be authenticated.');
  }

  const { recipientUserId, spotId, spotName, amountInr, personalNote } =
    (request.data as Record<string, unknown>) || {};

  if (!recipientUserId || typeof recipientUserId !== 'string') {
    throw new HttpsError('invalid-argument', 'Valid recipientUserId is required.');
  }
  if (!spotId || typeof spotId !== 'string') {
    throw new HttpsError('invalid-argument', 'Valid spotId is required.');
  }
  if (!spotName || typeof spotName !== 'string') {
    throw new HttpsError('invalid-argument', 'Valid spotName is required.');
  }
  if (typeof amountInr !== 'number' || amountInr <= 0) {
    throw new HttpsError('invalid-argument', 'amountInr must be a positive number.');
  }

  try {
    const result = await getTippingService().initiateTip({
      payerUserId: callerUid,
      recipientUserId,
      spotId,
      spotName,
      amountInr,
      personalNote: typeof personalNote === 'string' ? personalNote : undefined,
    });

    logger.info('Tip initiated successfully', {
      tipId: result.tip.tipId,
      payer: callerUid,
      recipient: recipientUserId,
      amount: amountInr,
    });

    return successEnvelope(result, startMs);
  } catch (err: unknown) {
    logger.error('Error initiating tip', { error: err });
    throw new HttpsError('invalid-argument', (err as Error).message || 'Failed to initiate tip.');
  }
});

/**
 * Callable: settleTip
 * Confirms payment and credits contributor reward ledger transactionally.
 */
export const settleTip = onCall(monetizationCallableOptions, async (request) => {
  const startMs = Date.now();
  const isGuest = (request.data as any)?.isGuestAccess === true;
  const callerUid = request.auth?.uid || (isGuest ? ((request.data as any)?.userId || 'guest_traveler') : undefined);
  if (!callerUid) {
    throw new HttpsError('unauthenticated', 'User must be authenticated.');
  }

  const data = (request.data as Record<string, unknown>) || {};
  const { tipId, simulatedOutcome } = data;
  const providerPaymentId =
    typeof data.providerPaymentId === 'string'
      ? data.providerPaymentId
      : typeof data.razorpayPaymentId === 'string'
        ? data.razorpayPaymentId
        : undefined;
  const providerSignature =
    typeof data.providerSignature === 'string'
      ? data.providerSignature
      : typeof data.razorpaySignature === 'string'
        ? data.razorpaySignature
        : undefined;
  const parsedSimulatedOutcome =
    simulatedOutcome === 'SUCCESS' || simulatedOutcome === 'FAILURE'
      ? (simulatedOutcome as 'SUCCESS' | 'FAILURE')
      : undefined;

  if (!tipId || typeof tipId !== 'string') {
    throw new HttpsError('invalid-argument', 'Valid tipId string is required.');
  }

  try {
    const result = await getTippingService().settleTip({
      tipId,
      callerUserId: callerUid,
      simulatedOutcome: parsedSimulatedOutcome,
      providerPaymentId,
      providerSignature,
    });

    logger.info('Tip settled', {
      tipId,
      isReplay: result.isIdempotentReplay,
      settledAt: result.tip.settledAt,
    });

    return successEnvelope(result, startMs);
  } catch (err: unknown) {
    logger.error('Error settling tip', { error: err });
    throw new HttpsError('failed-precondition', (err as Error).message || 'Failed to settle tip.');
  }
});

/**
 * Callable: getContributorRewardSummary
 * Contributor checks their earnings, available balance, and community guidance rank.
 */
export const getContributorRewardSummary = onCall(monetizationCallableOptions, async (request) => {
  const startMs = Date.now();
  const isGuest = (request.data as any)?.isGuestAccess === true;
  const callerUid = request.auth?.uid || (isGuest ? ((request.data as any)?.userId || 'guest_traveler') : undefined);
  if (!callerUid) {
    throw new HttpsError('unauthenticated', 'User must be authenticated.');
  }

  const { userId } = (request.data as Record<string, unknown>) || {};
  const targetUserId = typeof userId === 'string' ? userId : callerUid;

  // Authorization check: Only owner or admin may view private financial ledger
  if (targetUserId !== callerUid) {
    const role = (request.auth?.token?.role as string) || '';
    if (role !== 'ADMIN' && role !== 'MODERATOR') {
      throw new HttpsError('permission-denied', 'Cannot inspect another user\'s reward ledger.');
    }
  }

  try {
    const ledger = await getTippingService().getRewardLedger(targetUserId);
    return successEnvelope(ledger, startMs);
  } catch (err: unknown) {
    logger.error('Error getting reward ledger', { error: err });
    throw new HttpsError('internal', (err as Error).message || 'Failed to get reward ledger.');
  }
});

/**
 * Callable: purchaseRoutePass
 * Traveler purchases a route pass.
 */
export const purchaseRoutePass = onCall(monetizationCallableOptions, async (request) => {
  const startMs = Date.now();
  const isGuest = (request.data as any)?.isGuestAccess === true;
  const callerUid = request.auth?.uid || (isGuest ? ((request.data as any)?.userId || 'guest_traveler') : undefined);
  if (!callerUid) {
    throw new HttpsError('unauthenticated', 'User must be authenticated.');
  }

  const { tier, neighborhood, accessibleRouteIds } = (request.data as Record<string, unknown>) || {};

  if (!tier || typeof tier !== 'string') {
    throw new HttpsError('invalid-argument', 'Valid pass tier is required.');
  }
  if (!neighborhood || typeof neighborhood !== 'string') {
    throw new HttpsError('invalid-argument', 'Valid neighborhood is required.');
  }

  try {
    const result = await getPassService().purchaseRoutePass({
      userId: callerUid,
      tier: tier as PassTier,
      neighborhood,
      accessibleRouteIds: Array.isArray(accessibleRouteIds) ? (accessibleRouteIds as string[]) : undefined,
    });

    logger.info('Route pass purchased (pending payment)', {
      passId: result.pass.passId,
      userId: callerUid,
      tier,
      status: result.pass.status,
    });

    return successEnvelope(result, startMs);
  } catch (err: unknown) {
    logger.error('Error purchasing route pass', { error: err });
    throw new HttpsError('invalid-argument', (err as Error).message || 'Failed to purchase pass.');
  }
});

/**
 * Callable: confirmPassPayment
 * Confirms payment and activates a pending route pass.
 */
export const confirmPassPayment = onCall(monetizationCallableOptions, async (request) => {
  const startMs = Date.now();
  const isGuest = (request.data as any)?.isGuestAccess === true;
  const callerUid = request.auth?.uid || (isGuest ? ((request.data as any)?.userId || 'guest_traveler') : undefined);
  if (!callerUid) {
    throw new HttpsError('unauthenticated', 'User must be authenticated.');
  }

  const data = (request.data as Record<string, unknown>) || {};
  const { passId, simulatedOutcome } = data;
  const providerPaymentId =
    typeof data.providerPaymentId === 'string'
      ? data.providerPaymentId
      : typeof data.razorpayPaymentId === 'string'
        ? data.razorpayPaymentId
        : undefined;
  const providerSignature =
    typeof data.providerSignature === 'string'
      ? data.providerSignature
      : typeof data.razorpaySignature === 'string'
        ? data.razorpaySignature
        : undefined;
  const parsedSimulatedOutcome =
    simulatedOutcome === 'SUCCESS' || simulatedOutcome === 'FAILURE'
      ? (simulatedOutcome as 'SUCCESS' | 'FAILURE')
      : undefined;

  if (!passId || typeof passId !== 'string') {
    throw new HttpsError('invalid-argument', 'Valid passId string is required.');
  }

  try {
    const result = await getPassService().confirmPassPayment({
      passId,
      callerUserId: callerUid,
      simulatedOutcome: parsedSimulatedOutcome,
      providerPaymentId,
      providerSignature,
    });

    logger.info('Route pass payment confirmed', {
      passId,
      isReplay: result.isIdempotentReplay,
      status: result.pass.status,
    });

    return successEnvelope(result, startMs);
  } catch (err: unknown) {
    logger.error('Error confirming pass payment', { error: err });
    throw new HttpsError('failed-precondition', (err as Error).message || 'Failed to confirm pass payment.');
  }
});

/**
 * Callable: verifyRoutePassAccess
 * Checks if traveler has active route pass granting audio or offline access.
 */
export const verifyRoutePassAccess = onCall(monetizationCallableOptions, async (request) => {
  const startMs = Date.now();
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated.');
  }

  const { routeId, neighborhood } = (request.data as Record<string, unknown>) || {};

  try {
    const result = await getPassService().verifyRoutePassAccess({
      userId: request.auth.uid,
      routeId: typeof routeId === 'string' ? routeId : undefined,
      neighborhood: typeof neighborhood === 'string' ? neighborhood : undefined,
    });

    return successEnvelope(result, startMs);
  } catch (err: unknown) {
    logger.error('Error verifying pass access', { error: err });
    throw new HttpsError('internal', (err as Error).message || 'Failed to verify pass access.');
  }
});

/**
 * Callable: getContributorRevenueShares
 * Lists contributor revenue-share payouts earned from neighborhood Route Passes.
 */
export const getContributorRevenueShares = onCall(monetizationCallableOptions, async (request) => {
  const startMs = Date.now();
  const isGuest = (request.data as any)?.isGuestAccess === true;
  const callerUid = request.auth?.uid || (isGuest ? ((request.data as any)?.userId || 'guest_traveler') : undefined);
  if (!callerUid) {
    throw new HttpsError('unauthenticated', 'User must be authenticated.');
  }

  const { userId } = (request.data as Record<string, unknown>) || {};
  const targetUserId = typeof userId === 'string' && userId.trim().length > 0 ? userId : callerUid;

  if (targetUserId !== callerUid) {
    const role = String(request.auth?.token?.role || '').toUpperCase();
    if (role !== 'ADMIN' && role !== 'MODERATOR') {
      throw new HttpsError('permission-denied', 'Cannot inspect another contributor\'s revenue shares.');
    }
  }

  try {
    const entries = await getPassService().listContributorRevenueShares(targetUserId);
    const totalRevenueShareInr = entries.reduce((sum, e) => sum + Number(e.shareAmountInr || 0), 0);
    return successEnvelope(
      {
        contributorUserId: targetUserId,
        totalRevenueShareInr,
        entries,
      },
      startMs
    );
  } catch (err: unknown) {
    logger.error('Error listing contributor revenue shares', { error: err });
    throw new HttpsError('internal', (err as Error).message || 'Failed to list revenue shares.');
  }
});

/**
 * Callable: listUserPasses
 * Returns all passes owned by the authenticated caller.
 */
export const listUserPasses = onCall(monetizationCallableOptions, async (request) => {
  const startMs = Date.now();
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated.');
  }

  try {
    const passes = await getPassService().listUserPasses(request.auth.uid);
    return successEnvelope(passes, startMs);
  } catch (err: unknown) {
    logger.error('Error listing user passes', { error: err });
    throw new HttpsError('internal', (err as Error).message || 'Failed to list passes.');
  }
});

/**
 * Callable: getPublicPartnerMerchantOffer
 * Returns sanitized discount perks for a merchant place without leaking billing details.
 */
export const getPublicPartnerMerchantOffer = onCall(monetizationCallableOptions, async (request) => {
  const startMs = Date.now();
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated.');
  }

  const { merchantPlaceId } = (request.data as Record<string, unknown>) || {};
  if (!merchantPlaceId || typeof merchantPlaceId !== 'string') {
    throw new HttpsError('invalid-argument', 'Valid merchantPlaceId is required.');
  }

  try {
    const offer = await getMerchantService().getPublicPartnerOffer(merchantPlaceId);
    return successEnvelope(offer, startMs);
  } catch (err: unknown) {
    logger.error('Error fetching partner offer', { error: err });
    throw new HttpsError('internal', (err as Error).message || 'Failed to fetch partner offer.');
  }
});

/**
 * Callable: getContributorAttribution
 * Returns public badges, reputation tier, and approved gem counts for spot cards.
 */
export const getContributorAttribution = onCall(monetizationCallableOptions, async (request) => {
  const startMs = Date.now();
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated.');
  }

  const { userId } = (request.data as Record<string, unknown>) || {};
  if (!userId || typeof userId !== 'string') {
    throw new HttpsError('invalid-argument', 'Valid userId is required.');
  }

  try {
    const attribution = await contributorService.getContributorAttribution(userId);
    return successEnvelope(attribution, startMs);
  } catch (err: unknown) {
    logger.error('Error fetching contributor attribution', { error: err });
    throw new HttpsError('internal', (err as Error).message || 'Failed to fetch attribution.');
  }
});

/**
 * Callable: registerPartnerSubscription (A5-V-04)
 * Registers a merchant partner subscription.
 */
export const registerPartnerSubscription = onCall(monetizationCallableOptions, async (request) => {
  const startMs = Date.now();
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated.');
  }

  const {
    merchantPlaceId,
    businessName,
    contactEmail,
    subscriptionPlan,
    activeDiscountOffer,
    durationDays,
  } = (request.data as Record<string, unknown>) || {};

  if (!merchantPlaceId || typeof merchantPlaceId !== 'string') {
    throw new HttpsError('invalid-argument', 'Valid merchantPlaceId is required.');
  }
  if (!businessName || typeof businessName !== 'string') {
    throw new HttpsError('invalid-argument', 'Valid businessName is required.');
  }
  if (!contactEmail || typeof contactEmail !== 'string' || !contactEmail.includes('@')) {
    throw new HttpsError('invalid-argument', 'Valid contactEmail is required.');
  }
  if (
    !subscriptionPlan ||
    !['COMMUNITY_FREE', 'VERIFIED_PARTNER', 'FEATURED_HERITAGE'].includes(subscriptionPlan as string)
  ) {
    throw new HttpsError('invalid-argument', 'Valid subscriptionPlan is required.');
  }

  if (activeDiscountOffer) {
    const offer = activeDiscountOffer as Record<string, unknown>;
    if (
      typeof offer.discountPercent !== 'number' ||
      offer.discountPercent < 1 ||
      offer.discountPercent > 100
    ) {
      throw new HttpsError('invalid-argument', 'discountPercent must be between 1 and 100.');
    }
    if (typeof offer.terms !== 'string' || offer.terms.trim().length === 0) {
      throw new HttpsError('invalid-argument', 'Valid terms string is required for discount offer.');
    }
  }

  try {
    const result = await getMerchantService().registerPartnerSubscription({
      ownerUserId: request.auth.uid, // Strictly bound to authenticated caller
      merchantPlaceId,
      businessName,
      contactEmail,
      subscriptionPlan: subscriptionPlan as MerchantPlanTier,
      activeDiscountOffer: activeDiscountOffer as
        | { discountPercent: number; terms: string }
        | undefined,
      durationDays: typeof durationDays === 'number' ? durationDays : 365,
    });

    logger.info('Partner merchant subscription registered', {
      subscriptionId: result.subscription.subscriptionId,
      merchantPlaceId,
      plan: subscriptionPlan,
      isPendingPayment: result.isPendingPayment,
    });

    return successEnvelope(result, startMs);
  } catch (err: unknown) {
    logger.error('Error registering partner subscription', { error: err });
    throw new HttpsError('invalid-argument', (err as Error).message || 'Failed to register subscription.');
  }
});

/**
 * Callable: confirmPartnerSubscriptionPayment (A5-V-04)
 * Confirms payment for a paid merchant partner subscription.
 */
export const confirmPartnerSubscriptionPayment = onCall(monetizationCallableOptions, async (request) => {
  const startMs = Date.now();
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated.');
  }

  const data = (request.data as Record<string, unknown>) || {};
  const { subscriptionId, simulatedOutcome } = data;
  const providerPaymentId =
    typeof data.providerPaymentId === 'string'
      ? data.providerPaymentId
      : typeof data.razorpayPaymentId === 'string'
        ? data.razorpayPaymentId
        : undefined;
  const providerSignature =
    typeof data.providerSignature === 'string'
      ? data.providerSignature
      : typeof data.razorpaySignature === 'string'
        ? data.razorpaySignature
        : undefined;
  if (!subscriptionId || typeof subscriptionId !== 'string') {
    throw new HttpsError('invalid-argument', 'Valid subscriptionId is required.');
  }

  try {
    const tokenRole = String(request.auth.token?.role || '').toUpperCase();
    const isAdmin =
      request.auth.token?.admin === true ||
      tokenRole === 'ADMIN' ||
      tokenRole === 'MODERATOR';
    const outcome =
      simulatedOutcome === 'SUCCESS' || simulatedOutcome === 'FAILURE'
        ? (simulatedOutcome as 'SUCCESS' | 'FAILURE')
        : undefined;

    const result = await getMerchantService().confirmPartnerSubscriptionPayment({
      subscriptionId,
      callerUserId: request.auth.uid,
      simulatedOutcome: outcome,
      providerPaymentId,
      providerSignature,
      isAdminOverride: isAdmin,
    });

    logger.info('Partner subscription payment confirmed', {
      subscriptionId,
      merchantPlaceId: result.subscription.merchantPlaceId,
      isIdempotentReplay: result.isIdempotentReplay,
    });

    return successEnvelope(result, startMs);
  } catch (err: unknown) {
    logger.error('Error confirming partner subscription payment', { error: err });
    throw new HttpsError('failed-precondition', (err as Error).message || 'Failed to confirm partner subscription payment.');
  }
});

/**
 * Callable: registerGuidanceOffering (A5-V-01)
 * Local guide creates a 1-on-1 guidance offering.
 */
export const registerGuidanceOffering = onCall(monetizationCallableOptions, async (request) => {
  const startMs = Date.now();
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated.');
  }

  const {
    neighborhood,
    title,
    description,
    durationMinutes,
    priceInr,
    meetingPoint,
    languages,
  } = (request.data as Record<string, unknown>) || {};

  if (!neighborhood || typeof neighborhood !== 'string') {
    throw new HttpsError('invalid-argument', 'Valid neighborhood is required.');
  }
  if (!title || typeof title !== 'string') {
    throw new HttpsError('invalid-argument', 'Valid title is required.');
  }
  if (typeof priceInr !== 'number' || priceInr < 100 || priceInr > 10000) {
    throw new HttpsError('invalid-argument', 'priceInr must be between ₹100 and ₹10,000.');
  }
  if (typeof durationMinutes !== 'number' || durationMinutes < 15 || durationMinutes > 480) {
    throw new HttpsError('invalid-argument', 'durationMinutes must be between 15 and 480.');
  }
  if (!meetingPoint || typeof meetingPoint !== 'string') {
    throw new HttpsError('invalid-argument', 'Valid meetingPoint is required.');
  }

  try {
    const offering = await getGuidanceService().registerOffering({
      guideUserId: request.auth.uid,
      neighborhood,
      title,
      description: typeof description === 'string' ? description : '',
      durationMinutes,
      priceInr,
      meetingPoint,
      languages: Array.isArray(languages) ? (languages as string[]) : ['English'],
    });

    return successEnvelope(offering, startMs);
  } catch (err: unknown) {
    logger.error('Error registering guidance offering', { error: err });
    throw new HttpsError('invalid-argument', (err as Error).message || 'Failed to register offering.');
  }
});

/**
 * Callable: listGuidanceOfferings (A5-V-01)
 * Browse available local guidance offerings.
 */
export const listGuidanceOfferings = onCall(monetizationCallableOptions, async (request) => {
  const startMs = Date.now();
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated.');
  }

  const { neighborhood } = (request.data as Record<string, unknown>) || {};

  try {
    const offerings = await getGuidanceService().listOfferings(
      typeof neighborhood === 'string' ? neighborhood : undefined
    );
    return successEnvelope(offerings, startMs);
  } catch (err: unknown) {
    logger.error('Error listing guidance offerings', { error: err });
    throw new HttpsError('internal', (err as Error).message || 'Failed to list offerings.');
  }
});

/**
 * Callable: requestLocalGuidance (A5-V-01)
 * Traveler books a 1-on-1 guidance session.
 */
export const requestLocalGuidance = onCall(monetizationCallableOptions, async (request) => {
  const startMs = Date.now();
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated.');
  }

  const { offeringId, scheduledDateTime, specialNotes } =
    (request.data as Record<string, unknown>) || {};

  if (!offeringId || typeof offeringId !== 'string') {
    throw new HttpsError('invalid-argument', 'Valid offeringId is required.');
  }
  if (!scheduledDateTime || typeof scheduledDateTime !== 'string') {
    throw new HttpsError('invalid-argument', 'Valid scheduledDateTime ISO string is required.');
  }

  try {
    const result = await getGuidanceService().requestLocalGuidance({
      travelerUserId: request.auth.uid,
      offeringId,
      scheduledDateTime,
      specialNotes: typeof specialNotes === 'string' ? specialNotes : undefined,
    });

    return successEnvelope(result, startMs);
  } catch (err: unknown) {
    logger.error('Error requesting local guidance', { error: err });
    throw new HttpsError('invalid-argument', (err as Error).message || 'Failed to request guidance.');
  }
});

/**
 * Callable: confirmGuidancePayment (A5-V-01)
 * Traveler confirms payment for a guidance booking.
 */
export const confirmGuidancePayment = onCall(monetizationCallableOptions, async (request) => {
  const startMs = Date.now();
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated.');
  }

  const data = (request.data as Record<string, unknown>) || {};
  const { bookingId, simulatedOutcome } = data;
  const providerPaymentId =
    typeof data.providerPaymentId === 'string'
      ? data.providerPaymentId
      : typeof data.razorpayPaymentId === 'string'
        ? data.razorpayPaymentId
        : undefined;
  const providerSignature =
    typeof data.providerSignature === 'string'
      ? data.providerSignature
      : typeof data.razorpaySignature === 'string'
        ? data.razorpaySignature
        : undefined;
  const parsedSimulatedOutcome =
    simulatedOutcome === 'SUCCESS' || simulatedOutcome === 'FAILURE'
      ? (simulatedOutcome as 'SUCCESS' | 'FAILURE')
      : undefined;

  if (!bookingId || typeof bookingId !== 'string') {
    throw new HttpsError('invalid-argument', 'Valid bookingId is required.');
  }

  try {
    const result = await getGuidanceService().confirmGuidancePayment({
      bookingId,
      callerUserId: request.auth.uid,
      simulatedOutcome: parsedSimulatedOutcome,
      providerPaymentId,
      providerSignature,
    });

    return successEnvelope(result, startMs);
  } catch (err: unknown) {
    logger.error('Error confirming guidance payment', { error: err });
    throw new HttpsError('failed-precondition', (err as Error).message || 'Failed to confirm guidance payment.');
  }
});

/**
 * Callable: acceptGuidanceRequest (A5-V-01)
 * Guide accepts a booking request.
 */
export const acceptGuidanceRequest = onCall(monetizationCallableOptions, async (request) => {
  const startMs = Date.now();
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated.');
  }

  const { bookingId } = (request.data as Record<string, unknown>) || {};
  if (!bookingId || typeof bookingId !== 'string') {
    throw new HttpsError('invalid-argument', 'Valid bookingId is required.');
  }

  try {
    const booking = await getGuidanceService().acceptGuidanceRequest({
      bookingId,
      callerUserId: request.auth.uid,
    });
    return successEnvelope(booking, startMs);
  } catch (err: unknown) {
    logger.error('Error accepting guidance request', { error: err });
    throw new HttpsError('failed-precondition', (err as Error).message || 'Failed to accept guidance request.');
  }
});

/**
 * Callable: rejectGuidanceRequest (A5-V-01)
 * Guide rejects a booking request.
 */
export const rejectGuidanceRequest = onCall(monetizationCallableOptions, async (request) => {
  const startMs = Date.now();
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated.');
  }

  const { bookingId, reason } = (request.data as Record<string, unknown>) || {};
  if (!bookingId || typeof bookingId !== 'string') {
    throw new HttpsError('invalid-argument', 'Valid bookingId is required.');
  }

  try {
    const booking = await getGuidanceService().rejectGuidanceRequest({
      bookingId,
      callerUserId: request.auth.uid,
      reason: typeof reason === 'string' ? reason : undefined,
    });
    return successEnvelope(booking, startMs);
  } catch (err: unknown) {
    logger.error('Error rejecting guidance request', { error: err });
    throw new HttpsError('failed-precondition', (err as Error).message || 'Failed to reject guidance request.');
  }
});

/**
 * Callable: cancelGuidanceBooking (A5-V-01)
 * Traveler or guide cancels a booking.
 */
export const cancelGuidanceBooking = onCall(monetizationCallableOptions, async (request) => {
  const startMs = Date.now();
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated.');
  }

  const { bookingId, reason } = (request.data as Record<string, unknown>) || {};
  if (!bookingId || typeof bookingId !== 'string') {
    throw new HttpsError('invalid-argument', 'Valid bookingId is required.');
  }

  try {
    const booking = await getGuidanceService().cancelGuidanceBooking({
      bookingId,
      callerUserId: request.auth.uid,
      reason: typeof reason === 'string' ? reason : undefined,
    });
    return successEnvelope(booking, startMs);
  } catch (err: unknown) {
    logger.error('Error cancelling guidance booking', { error: err });
    throw new HttpsError('failed-precondition', (err as Error).message || 'Failed to cancel guidance booking.');
  }
});

/**
 * Callable: completeGuidanceBooking (A5-V-01)
 * Completes session and disburses escrow net to guide reward ledger.
 */
export const completeGuidanceBooking = onCall(monetizationCallableOptions, async (request) => {
  const startMs = Date.now();
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated.');
  }

  const { bookingId } = (request.data as Record<string, unknown>) || {};
  if (!bookingId || typeof bookingId !== 'string') {
    throw new HttpsError('invalid-argument', 'Valid bookingId is required.');
  }

  try {
    const result = await getGuidanceService().completeGuidanceBooking({
      bookingId,
      callerUserId: request.auth.uid,
    });
    return successEnvelope(result, startMs);
  } catch (err: unknown) {
    logger.error('Error completing guidance booking', { error: err });
    throw new HttpsError('failed-precondition', (err as Error).message || 'Failed to complete guidance booking.');
  }
});

/**
 * Callable: getGuidanceBooking (A5-V-01)
 * Fetches guidance booking details.
 */
export const getGuidanceBooking = onCall(monetizationCallableOptions, async (request) => {
  const startMs = Date.now();
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated.');
  }

  const { bookingId } = (request.data as Record<string, unknown>) || {};
  if (!bookingId || typeof bookingId !== 'string') {
    throw new HttpsError('invalid-argument', 'Valid bookingId is required.');
  }

  try {
    const role = (request.auth.token?.role as string) || undefined;
    const booking = await getGuidanceService().getGuidanceBooking(bookingId, request.auth.uid, role);
    return successEnvelope(booking, startMs);
  } catch (err: unknown) {
    logger.error('Error getting guidance booking', { error: err });
    throw new HttpsError('permission-denied', (err as Error).message || 'Failed to get guidance booking.');
  }
});

/**
 * Callable: listMyGuidanceBookings (A5-V-01)
 * Lists guidance bookings for the authenticated user as traveler or guide.
 */
export const listMyGuidanceBookings = onCall(monetizationCallableOptions, async (request) => {
  const startMs = Date.now();
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated.');
  }

  const { role } = (request.data as Record<string, unknown>) || {};
  const queryRole = role === 'guide' ? 'guide' : 'traveler';

  try {
    const bookings = await getGuidanceService().listMyGuidanceBookings(request.auth.uid, queryRole);
    return successEnvelope(bookings, startMs);
  } catch (err: unknown) {
    logger.error('Error listing user guidance bookings', { error: err });
    throw new HttpsError('internal', (err as Error).message || 'Failed to list guidance bookings.');
  }
});

/**
 * Callable: submitVerificationRequest
 * Persists a resident/contributor KYC verification request in Firestore with status PENDING_REVIEW.
 */
export const submitVerificationRequest = onCall(async (request) => {
  const startMs = Date.now();
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated to submit ID verification.');
  }

  const data = (request.data as Record<string, unknown>) || {};
  const documentType = typeof data.documentType === 'string' ? data.documentType.trim() : '';
  const documentStoragePath = typeof data.documentStoragePath === 'string' ? data.documentStoragePath.trim() : undefined;
  const neighborhood = typeof data.neighborhood === 'string' ? data.neighborhood.trim() : undefined;
  const fullName = typeof data.fullName === 'string' ? data.fullName.trim() : undefined;
  const notes = typeof data.notes === 'string' ? data.notes.trim() : undefined;

  if (!documentType) {
    throw new HttpsError('invalid-argument', 'Valid documentType is required.');
  }

  try {
    const uid = request.auth.uid;
    const now = new Date().toISOString();
    const requestId = `vrf_${randomUUID().slice(0, 12)}`;

    const payload = {
      requestId,
      userId: uid,
      documentType,
      documentStoragePath: documentStoragePath || null,
      neighborhood: neighborhood || null,
      fullName: fullName || null,
      notes: notes || null,
      status: 'PENDING_REVIEW',
      submittedAt: now,
      updatedAt: now,
    };

    const batch = db.batch();
    batch.set(db.collection('verification_requests').doc(requestId), payload);
    batch.set(
      db.collection('users').doc(uid),
      {
        verificationStatus: 'PENDING_REVIEW',
        latestVerificationRequestId: requestId,
        verificationSubmittedAt: now,
      },
      { merge: true }
    );
    await batch.commit();

    return successEnvelope(
      {
        requestId,
        status: 'PENDING_REVIEW',
        submittedAt: now,
      },
      startMs
    );
  } catch (err: unknown) {
    logger.error('Error submitting ID verification request', { error: err });
    throw new HttpsError('internal', (err as Error).message || 'Failed to submit verification request.');
  }
});

/**
 * Inbound HTTP Webhook: handlePaymentWebhook
 * Handles payment gateway webhooks with HMAC signature verification and idempotency protection.
 */
export const handlePaymentWebhook = onRequest(
  { secrets: [razorpayKeyId, razorpayKeySecret, paymentWebhookSecret] },
  async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  const webhookSecret = process.env.PAYMENT_WEBHOOK_SECRET?.trim();
  if (!webhookSecret) {
    logger.error('PAYMENT_WEBHOOK_SECRET is not configured. Webhook rejected fail-closed.');
    res.status(500).json({ error: 'Webhook processing unconfigured' });
    return;
  }

  const signature = (req.headers['x-razorpay-signature'] || req.headers['x-webhook-signature']) as string | undefined;
  if (!signature) {
    logger.warn('Webhook request missing signature header');
    res.status(401).json({ error: 'Missing webhook signature' });
    return;
  }

  // Strictly require the actual Firebase req.rawBody Buffer directly from the network socket.
  // Reconstructing raw bytes via JSON.stringify is strictly forbidden as it introduces serialization variances and security risks.
  if (!req.rawBody || !Buffer.isBuffer(req.rawBody)) {
    logger.warn('Webhook request missing genuine rawBody Buffer');
    res.status(400).json({ error: 'Missing genuine raw request body buffer' });
    return;
  }

  const expectedSig = createHmac('sha256', webhookSecret).update(req.rawBody).digest('hex');

  if (signature !== expectedSig) {
    logger.warn('Webhook signature mismatch');
    res.status(401).json({ error: 'Invalid webhook signature' });
    return;
  }

  const eventPayload = (req.body as Record<string, any>) || {};
  // Requirement 4: Use Razorpay's actual x-razorpay-event-id header or req.body.event_id for deduplication
  const eventId = (
    req.headers['x-razorpay-event-id'] ||
    eventPayload.event_id ||
    eventPayload.id
  ) as string | undefined;

  if (!eventId || typeof eventId !== 'string') {
    res.status(400).json({ error: 'Missing valid event ID (x-razorpay-event-id or event_id required)' });
    return;
  }

  const eventRef = db.collection('webhook_events').doc(eventId);
  try {
    const alreadyProcessed = await db.runTransaction(async (transaction) => {
      const snap = await transaction.get(eventRef);
      if (snap.exists) {
        return true;
      }
      transaction.set(eventRef, {
        eventId,
        receivedAt: new Date().toISOString(),
        eventType: eventPayload.event || 'unknown',
        processed: true,
      });
      return false;
    });

    if (alreadyProcessed) {
      logger.info('Duplicate webhook event received; returning 200 OK idempotently', { eventId });
      res.status(200).json({ status: 'duplicate_ignored', eventId });
      return;
    }

    const eventType = eventPayload.event || 'unknown';
    logger.info('Verified webhook event recorded', { eventId, eventType });

    // 4. Reconcile transaction state based on event type
    const paymentEntity = eventPayload.payload?.payment?.entity;
    const transactionId = (paymentEntity?.notes?.transactionId || paymentEntity?.description || '') as string;

    if (transactionId && (eventType === 'payment.captured' || eventType === 'order.paid')) {
      const now = new Date().toISOString();
      const paymentId = String(paymentEntity?.id || '');

      // Verify currency is INR and amount matches
      if (paymentEntity?.currency === 'INR' && typeof paymentEntity?.amount === 'number') {
        const amountInr = paymentEntity.amount / 100;

        if (transactionId.startsWith('tip_')) {
          const tipRef = db.collection('tips').doc(transactionId);
          await db.runTransaction(async (t) => {
            const tipSnap = await t.get(tipRef);
            if (!tipSnap.exists) return;
            const tip = tipSnap.data() as any;
            if (tip.paymentStatus === 'COMPLETED') return; // Idempotent ignore
            if (tip.amountInr !== amountInr) {
              logger.warn('Amount mismatch in webhook for tip', { expected: tip.amountInr, received: amountInr });
              return;
            }

            t.update(tipRef, {
              paymentStatus: 'COMPLETED',
              providerPaymentId: paymentId,
              paymentReference: paymentId,
              updatedAt: now,
            });

            // Credit recipient reward ledger
            const ledgerRef = db.collection('contributor_rewards').doc(tip.recipientUserId);
            const ledgerSnap = await t.get(ledgerRef);
            const currentBalance = ledgerSnap.exists ? (ledgerSnap.data()?.availableBalanceInr || 0) : 0;
            const currentTotal = ledgerSnap.exists ? (ledgerSnap.data()?.totalTipsEarnedInr || 0) : 0;
            const currentPoints = ledgerSnap.exists ? (ledgerSnap.data()?.reputationPoints || 0) : 0;

            t.set(ledgerRef, {
              contributorId: tip.recipientUserId,
              availableBalanceInr: currentBalance + tip.contributorNetInr,
              totalTipsEarnedInr: currentTotal + tip.contributorNetInr,
              reputationPoints: currentPoints + Math.max(1, Math.floor(tip.amountInr / 50)),
              updatedAt: now,
            }, { merge: true });
          });
        } else if (transactionId.startsWith('pass_')) {
          const passRef = db.collection('passes').doc(transactionId);
          let activatedPassForRevShare: any = null;
          await db.runTransaction(async (t) => {
            const passSnap = await t.get(passRef);
            if (!passSnap.exists) return;
            const pass = passSnap.data() as any;
            if (pass.status === 'ACTIVE' || pass.paymentStatus === 'COMPLETED') return;
            const expectedPrice = Number(pass.pricePaidInr ?? pass.priceInr ?? 0);
            if (expectedPrice !== amountInr) return;

            t.update(passRef, {
              status: 'ACTIVE',
              paymentStatus: 'COMPLETED',
              providerPaymentId: paymentId,
              paymentReference: paymentId,
              updatedAt: now,
            });
            activatedPassForRevShare = { ...pass, status: 'ACTIVE' };
          });
          if (activatedPassForRevShare) {
            await getPassService().distributeContributorRevenueShare(activatedPassForRevShare);
          }
        } else if (transactionId.startsWith('sub_')) {
          const subRef = db.collection('subscriptions').doc(transactionId);
          await db.runTransaction(async (t) => {
            const subSnap = await t.get(subRef);
            if (!subSnap.exists) return;
            const sub = subSnap.data() as any;
            if (sub.status === 'ACTIVE' || sub.paymentStatus === 'COMPLETED') return;
            if (sub.priceInr !== amountInr) return;

            t.update(subRef, {
              status: 'ACTIVE',
              paymentStatus: 'COMPLETED',
              providerPaymentId: paymentId,
              paymentReference: paymentId,
              updatedAt: now,
            });
          });
        } else if (transactionId.startsWith('guidance_')) {
          const bookingRef = db.collection('guidance_bookings').doc(transactionId);
          await db.runTransaction(async (t) => {
            const bookingSnap = await t.get(bookingRef);
            if (!bookingSnap.exists) return;
            const booking = bookingSnap.data() as any;
            if (booking.paymentStatus === 'COMPLETED') return;
            if (booking.priceInr !== amountInr) return;

            const newStatus = booking.status === 'ACCEPTED' ? 'CONFIRMED' : 'REQUESTED';
            t.update(bookingRef, {
              status: newStatus,
              paymentStatus: 'COMPLETED',
              providerPaymentId: paymentId,
              paymentReference: paymentId,
              updatedAt: now,
            });
          });
        }
      }
    } else if (transactionId && eventType === 'payment.failed') {
      const collectionName = transactionId.startsWith('tip_')
        ? 'tips'
        : transactionId.startsWith('pass_')
          ? 'passes'
          : transactionId.startsWith('sub_')
            ? 'subscriptions'
            : transactionId.startsWith('guidance_')
              ? 'guidance_bookings'
              : '';

      if (collectionName) {
        const docRef = db.collection(collectionName).doc(transactionId);
        await db.runTransaction(async (t) => {
          const snap = await t.get(docRef);
          if (!snap.exists) return;
          const data = snap.data() as any;
          // Out of order safety: never mark a COMPLETED or REFUNDED transaction as FAILED
          if (data.paymentStatus === 'COMPLETED' || data.paymentStatus === 'REFUNDED') return;

          t.update(docRef, {
            paymentStatus: 'FAILED',
            failureReason: paymentEntity?.error_description || 'Payment rejected by bank authority',
            updatedAt: new Date().toISOString(),
          });
        });
      }
    } else if (transactionId && eventType === 'refund.processed') {
      const refundEntity = eventPayload.payload?.refund?.entity;
      const refundId = String(refundEntity?.id || `rfnd_${eventId}`);
      const refundAmountInr = typeof refundEntity?.amount === 'number'
        ? refundEntity.amount / 100
        : 0;

      if (transactionId.startsWith('guidance_')) {
        const bookingRef = db.collection('guidance_bookings').doc(transactionId);
        await db.runTransaction(async (t) => {
          const snap = await t.get(bookingRef);
          if (!snap.exists) return;
          const data = snap.data() as any;

          // Deduplication: prevent duplicate refund processing
          const existingRefundRefs: string[] = Array.isArray(data.refundReferences) ? data.refundReferences : [];
          if (existingRefundRefs.includes(refundId)) {
            logger.info('Duplicate refund webhook event ignored for booking', { transactionId, refundId });
            return;
          }

          const currentTotalRefunded = Number(data.totalRefundedInr || 0);
          const newTotalRefunded = currentTotalRefunded + refundAmountInr;
          const originalPrice = Number(data.priceInr || 0);
          const isFullyRefunded = originalPrice > 0 && newTotalRefunded >= originalPrice;

          t.update(bookingRef, {
            paymentStatus: isFullyRefunded ? 'REFUNDED' : 'PARTIALLY_REFUNDED',
            refundStatus: isFullyRefunded ? 'COMPLETED' : 'PARTIALLY_COMPLETED',
            refundReference: refundId,
            refundReferences: [...existingRefundRefs, refundId],
            totalRefundedInr: Math.min(newTotalRefunded, originalPrice || newTotalRefunded),
            updatedAt: new Date().toISOString(),
          });
        });
      } else if (transactionId.startsWith('tip_')) {
        const tipRef = db.collection('tips').doc(transactionId);
        await db.runTransaction(async (t) => {
          const snap = await t.get(tipRef);
          if (!snap.exists) return;
          const tip = snap.data() as any;

          const existingRefundRefs: string[] = Array.isArray(tip.refundReferences) ? tip.refundReferences : [];
          if (existingRefundRefs.includes(refundId)) {
            logger.info('Duplicate refund webhook event ignored for tip', { transactionId, refundId });
            return;
          }

          const currentTotalRefunded = Number(tip.totalRefundedInr || 0);
          const newTotalRefunded = currentTotalRefunded + refundAmountInr;
          const originalPrice = Number(tip.amountInr || 0);
          const isFullyRefunded = originalPrice > 0 && newTotalRefunded >= originalPrice;

          t.update(tipRef, {
            paymentStatus: isFullyRefunded ? 'REFUNDED' : 'PARTIALLY_REFUNDED',
            refundReference: refundId,
            refundReferences: [...existingRefundRefs, refundId],
            totalRefundedInr: Math.min(newTotalRefunded, originalPrice || newTotalRefunded),
            updatedAt: new Date().toISOString(),
          });

          // Ledger reversal: deduct refunded portion of net earnings safely without negative balance
          const ledgerRef = db.collection('contributor_rewards').doc(tip.recipientUserId);
          const ledgerSnap = await t.get(ledgerRef);
          if (ledgerSnap.exists) {
            const ledger = ledgerSnap.data() as any;
            const maxNetEarning = Number(tip.contributorNetInr || originalPrice);
            const previouslyRefunded = currentTotalRefunded;
            const previouslyDeducted = Math.min(previouslyRefunded, maxNetEarning);
            const remainingNet = Math.max(0, maxNetEarning - previouslyDeducted);
            const deductionInr = Math.min(refundAmountInr, remainingNet);

            const currentBal = Number(ledger.availableBalanceInr || 0);
            const newBal = Math.max(0, currentBal - deductionInr);
            const unrecovered = currentBal < deductionInr ? (deductionInr - currentBal) : 0;

            t.set(ledgerRef, {
              availableBalanceInr: newBal,
              unrecoveredAdjustmentInr: Number(ledger.unrecoveredAdjustmentInr || 0) + unrecovered,
              updatedAt: new Date().toISOString(),
            }, { merge: true });
          }
        });
      }
    }

    res.status(200).json({ status: 'success', eventId, eventType });
  } catch (err: unknown) {
    logger.error('Error processing webhook event', { error: err });
    res.status(500).json({ error: 'Internal processing failure' });
  }
});
