/**
 * Route Pass Service
 * Task A5 — Contributor Ecosystem & Monetization Backend
 *
 * Governs purchasing, payment confirmation, duration tracking, perks allocation,
 * and route access validation for neighborhood walking passes.
 * Enforces two-phase activation: a pass is created as PENDING and only becomes
 * ACTIVE after verified payment confirmation.
 */

import { randomUUID } from 'node:crypto';
import { db } from '../../config/firebase.js';
import {
  RoutePassDocument,
  RoutePassDocumentSchema,
  PassTier,
} from '../../types/contracts/index.js';
import {
  PaymentGatewayAdapter,
  PaymentIntentResult,
} from '../adapters/payment-gateway-adapter.js';
import { defaultPaymentAdapter } from '../adapters/sandbox-payment-adapter.js';
import { validateSettlementEnvironment } from '../config/payment-environment.js';

export interface PurchasePassInput {
  userId: string;
  tier: PassTier;
  neighborhood: string;
  accessibleRouteIds?: string[];
}

export interface PurchasePassOutput {
  pass: RoutePassDocument;
  paymentIntent: PaymentIntentResult;
}

export interface ConfirmPassPaymentInput {
  passId: string;
  callerUserId: string;
  simulatedOutcome?: 'SUCCESS' | 'FAILURE';
  isAdminOverride?: boolean;
}

export interface ConfirmPassPaymentOutput {
  pass: RoutePassDocument;
  isIdempotentReplay: boolean;
}

export interface VerifyRoutePassAccessInput {
  userId: string;
  routeId?: string;
  neighborhood?: string;
}

export interface VerifyRoutePassAccessOutput {
  hasAccess: boolean;
  unlockedAudio: boolean;
  unlockedOfflinePack: boolean;
  partnerDiscountPercent: number;
  grantingPassId?: string;
}

export class PassService {
  constructor(private readonly paymentAdapter: PaymentGatewayAdapter = defaultPaymentAdapter) {}

  /**
   * Initiates a Route Pass purchase in PENDING status.
   * Access is NOT granted until payment confirmation.
   */
  public async purchaseRoutePass(input: PurchasePassInput): Promise<PurchasePassOutput> {
    if (!input.neighborhood || input.neighborhood.trim().length === 0) {
      throw new Error('Neighborhood name is required to purchase a route pass.');
    }

    let pricePaidInr = 0;
    let durationDays = 0;
    let discountPercent = 0;
    let finalRouteIds = input.accessibleRouteIds || [];

    switch (input.tier) {
      case 'SINGLE_ROUTE':
        pricePaidInr = 99;
        durationDays = 2; // 48 hours
        discountPercent = 5;
        if (finalRouteIds.length === 0) {
          throw new Error('SINGLE_ROUTE pass tier requires at least one accessible route ID.');
        }
        break;
      case 'NEIGHBORHOOD_ALL_ACCESS':
        pricePaidInr = 299;
        durationDays = 7; // 1 week
        discountPercent = 10;
        break;
      case 'ANNUAL_EXPLORER':
        pricePaidInr = 999;
        durationDays = 365; // 1 year
        discountPercent = 20;
        break;
      default:
        throw new Error(`Unsupported pass tier: ${input.tier}`);
    }

    const passId = `pass_${input.neighborhood.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}_${randomUUID().slice(0, 6)}`;
    const now = new Date();
    const validFrom = now.toISOString();
    const validUntil = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000).toISOString();

    const paymentIntent = await this.paymentAdapter.createPaymentIntent({
      transactionId: passId,
      payerUserId: input.userId,
      amountInr: pricePaidInr,
      currency: 'INR',
      description: `${input.tier} Pass for ${input.neighborhood}`,
    });

    const passDocument: RoutePassDocument = {
      passId,
      userId: input.userId,
      tier: input.tier,
      neighborhood: input.neighborhood,
      accessibleRouteIds: finalRouteIds,
      pricePaidInr,
      currency: 'INR',
      paymentMode: this.paymentAdapter.getMode(),
      paymentGatewayReference: paymentIntent.gatewayReference,
      status: 'PENDING', // STRICT: Pending payment confirmation
      perksIncluded: {
        audioGuidanceUnlocked: true,
        offlinePackUnlocked: true,
        merchantPartnerDiscountPercent: discountPercent,
      },
      validFrom,
      validUntil,
      purchasedAt: validFrom,
    };

    RoutePassDocumentSchema.parse(passDocument);

    await db.collection('passes').doc(passId).set(passDocument);

    return {
      pass: passDocument,
      paymentIntent,
    };
  }

  /**
   * Confirms payment and activates a Route Pass.
   * Enforces server environment checks, adapter verification, and idempotent activation.
   */
  public async confirmPassPayment(input: ConfirmPassPaymentInput): Promise<ConfirmPassPaymentOutput> {
    const passRef = db.collection('passes').doc(input.passId);
    const passSnap = await passRef.get();

    if (!passSnap.exists) {
      throw new Error(`Pass ${input.passId} not found.`);
    }

    const passData = passSnap.data() as RoutePassDocument;

    // Authorization: Caller must be buyer or admin
    if (passData.userId !== input.callerUserId && !input.isAdminOverride) {
      throw new Error('Unauthorized: Only the buyer or an administrator may confirm pass payment.');
    }

    // Fail-Closed Server Environment Configuration Guard
    validateSettlementEnvironment({
      transactionPaymentMode: passData.paymentMode,
      isSimulationRequested: input.simulatedOutcome !== undefined,
    });

    // Idempotency: If already ACTIVE, return existing without re-activating
    if (passData.status === 'ACTIVE') {
      return {
        pass: passData,
        isIdempotentReplay: true,
      };
    }

    if (passData.status === 'REVOKED' || passData.status === 'EXPIRED') {
      throw new Error(`Cannot confirm payment for pass with status ${passData.status}.`);
    }

    // Verify confirmation via payment adapter
    const verification = await this.paymentAdapter.verifyPayment({
      transactionId: input.passId,
      gatewayReference: passData.paymentGatewayReference || '',
      simulatedOutcome: input.simulatedOutcome,
    });

    if (!verification.verified) {
      await passRef.update({
        status: 'REVOKED',
      });
      throw new Error(`Payment verification failed: ${verification.failureReason || 'Declined'}`);
    }

    // Payment confirmed: Activate pass
    const now = new Date();
    let durationDays = 7;
    if (passData.tier === 'SINGLE_ROUTE') durationDays = 2;
    else if (passData.tier === 'ANNUAL_EXPLORER') durationDays = 365;

    const activatedPass: RoutePassDocument = {
      ...passData,
      status: 'ACTIVE',
      validFrom: now.toISOString(),
      validUntil: new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000).toISOString(),
      purchasedAt: now.toISOString(),
    };

    RoutePassDocumentSchema.parse(activatedPass);

    await passRef.set(activatedPass);

    return {
      pass: activatedPass,
      isIdempotentReplay: false,
    };
  }

  /**
   * Verifies whether a traveler has valid access to a route or neighborhood.
   * Strictly matches only 'ACTIVE' passes.
   */
  public async verifyRoutePassAccess(input: VerifyRoutePassAccessInput): Promise<VerifyRoutePassAccessOutput> {
    const passesSnap = await db
      .collection('passes')
      .where('userId', '==', input.userId)
      .where('status', '==', 'ACTIVE')
      .get();

    const now = new Date().toISOString();
    let maxDiscountPercent = 0;
    let grantingPass: RoutePassDocument | undefined;

    for (const doc of passesSnap.docs) {
      const pass = doc.data() as RoutePassDocument;

      // Check temporal validity
      if (pass.validUntil <= now) {
        continue;
      }

      // Check scope eligibility
      const isAnnual = pass.tier === 'ANNUAL_EXPLORER';
      const isNeighborhoodMatch = input.neighborhood && pass.neighborhood.toLowerCase() === input.neighborhood.toLowerCase();
      const isRouteMatch = input.routeId && pass.accessibleRouteIds.includes(input.routeId);

      if (isAnnual || isNeighborhoodMatch || isRouteMatch) {
        if (!grantingPass || pass.perksIncluded.merchantPartnerDiscountPercent > maxDiscountPercent) {
          grantingPass = pass;
          maxDiscountPercent = pass.perksIncluded.merchantPartnerDiscountPercent;
        }
      }
    }

    if (!grantingPass) {
      return {
        hasAccess: false,
        unlockedAudio: false,
        unlockedOfflinePack: false,
        partnerDiscountPercent: 0,
      };
    }

    return {
      hasAccess: true,
      unlockedAudio: grantingPass.perksIncluded.audioGuidanceUnlocked,
      unlockedOfflinePack: grantingPass.perksIncluded.offlinePackUnlocked,
      partnerDiscountPercent: maxDiscountPercent,
      grantingPassId: grantingPass.passId,
    };
  }

  /**
   * Lists all passes for a given user.
   */
  public async listUserPasses(userId: string): Promise<RoutePassDocument[]> {
    const snap = await db.collection('passes').where('userId', '==', userId).get();
    return snap.docs.map((doc) => doc.data() as RoutePassDocument);
  }
}
