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

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as logger from 'firebase-functions/logger';
import { randomUUID } from 'node:crypto';
import { ApiSuccessResponse, PassTier } from '../types/contracts/index.js';
import { TippingService } from './services/tipping-service.js';
import { PassService } from './services/pass-service.js';
import { MerchantSubscriptionService } from './services/merchant-subscription-service.js';
import { ContributorProfileService } from './services/contributor-service.js';
import { defaultPaymentAdapter } from './adapters/sandbox-payment-adapter.js';

const tippingService = new TippingService(defaultPaymentAdapter);
const passService = new PassService(defaultPaymentAdapter);
const merchantService = new MerchantSubscriptionService();
const contributorService = new ContributorProfileService();

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
export const initiateTip = onCall(async (request) => {
  const startMs = Date.now();
  if (!request.auth) {
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
    const result = await tippingService.initiateTip({
      payerUserId: request.auth.uid,
      recipientUserId,
      spotId,
      spotName,
      amountInr,
      personalNote: typeof personalNote === 'string' ? personalNote : undefined,
    });

    logger.info('Tip initiated successfully', {
      tipId: result.tip.tipId,
      payer: request.auth.uid,
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
export const settleTip = onCall(async (request) => {
  const startMs = Date.now();
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated.');
  }

  const { tipId, simulatedOutcome } = (request.data as Record<string, unknown>) || {};

  if (!tipId || typeof tipId !== 'string') {
    throw new HttpsError('invalid-argument', 'Valid tipId string is required.');
  }

  try {
    const result = await tippingService.settleTip({
      tipId,
      callerUserId: request.auth.uid,
      simulatedOutcome: simulatedOutcome === 'FAILURE' ? 'FAILURE' : 'SUCCESS',
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
export const getContributorRewardSummary = onCall(async (request) => {
  const startMs = Date.now();
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated.');
  }

  const { userId } = (request.data as Record<string, unknown>) || {};
  const targetUserId = typeof userId === 'string' ? userId : request.auth.uid;

  // Authorization check: Only owner or admin may view private financial ledger
  if (targetUserId !== request.auth.uid) {
    const role = (request.auth.token?.role as string) || '';
    if (role !== 'ADMIN' && role !== 'MODERATOR') {
      throw new HttpsError('permission-denied', 'Cannot inspect another user\'s reward ledger.');
    }
  }

  try {
    const ledger = await tippingService.getRewardLedger(targetUserId);
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
export const purchaseRoutePass = onCall(async (request) => {
  const startMs = Date.now();
  if (!request.auth) {
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
    const result = await passService.purchaseRoutePass({
      userId: request.auth.uid,
      tier: tier as PassTier,
      neighborhood,
      accessibleRouteIds: Array.isArray(accessibleRouteIds) ? (accessibleRouteIds as string[]) : undefined,
    });

    logger.info('Route pass purchased (pending payment)', {
      passId: result.pass.passId,
      userId: request.auth.uid,
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
export const confirmPassPayment = onCall(async (request) => {
  const startMs = Date.now();
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated.');
  }

  const { passId, simulatedOutcome } = (request.data as Record<string, unknown>) || {};
  if (!passId || typeof passId !== 'string') {
    throw new HttpsError('invalid-argument', 'Valid passId string is required.');
  }

  try {
    const result = await passService.confirmPassPayment({
      passId,
      callerUserId: request.auth.uid,
      simulatedOutcome: simulatedOutcome === 'FAILURE' ? 'FAILURE' : 'SUCCESS',
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
export const verifyRoutePassAccess = onCall(async (request) => {
  const startMs = Date.now();
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated.');
  }

  const { routeId, neighborhood } = (request.data as Record<string, unknown>) || {};

  try {
    const result = await passService.verifyRoutePassAccess({
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
 * Callable: listUserPasses
 * Returns all passes owned by the authenticated caller.
 */
export const listUserPasses = onCall(async (request) => {
  const startMs = Date.now();
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated.');
  }

  try {
    const passes = await passService.listUserPasses(request.auth.uid);
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
export const getPublicPartnerMerchantOffer = onCall(async (request) => {
  const startMs = Date.now();
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated.');
  }

  const { merchantPlaceId } = (request.data as Record<string, unknown>) || {};
  if (!merchantPlaceId || typeof merchantPlaceId !== 'string') {
    throw new HttpsError('invalid-argument', 'Valid merchantPlaceId is required.');
  }

  try {
    const offer = await merchantService.getPublicPartnerOffer(merchantPlaceId);
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
export const getContributorAttribution = onCall(async (request) => {
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
