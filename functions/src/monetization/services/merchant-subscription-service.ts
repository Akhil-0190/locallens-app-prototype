/**
 * Partner Merchant Subscription Service
 * Task A5 — Contributor Ecosystem & Monetization Backend
 *
 * Manages local merchant partner perks and subscriptions.
 * Enforces strict privacy separation: public discount perks are accessible,
 * while contact emails and billing records remain private.
 */

import { randomUUID } from 'node:crypto';
import { db } from '../../config/firebase.js';
import {
  PartnerMerchantSubscription,
  PartnerMerchantSubscriptionSchema,
  MerchantPlanTier,
} from '../../types/contracts/index.js';
import {
  PaymentGatewayAdapter,
  PaymentIntentResult,
} from '../adapters/payment-gateway-adapter.js';
import { defaultPaymentAdapter } from '../adapters/sandbox-payment-adapter.js';
import { validateSettlementEnvironment } from '../config/payment-environment.js';

export interface CreateSubscriptionInput {
  ownerUserId: string; // Authenticated Firebase UID
  merchantPlaceId: string;
  businessName: string;
  contactEmail: string;
  subscriptionPlan: MerchantPlanTier;
  activeDiscountOffer?: {
    discountPercent: number;
    terms: string;
  };
  durationDays?: number;
}

export interface RegisterSubscriptionOutput {
  subscription: PartnerMerchantSubscription;
  paymentIntent?: PaymentIntentResult;
  isPendingPayment: boolean;
}

export interface ConfirmSubscriptionPaymentInput {
  subscriptionId: string;
  callerUserId: string;
  simulatedOutcome?: 'SUCCESS' | 'FAILURE';
  isAdminOverride?: boolean;
}

export interface PublicPartnerOffer {
  merchantPlaceId: string;
  businessName: string;
  subscriptionPlan: MerchantPlanTier;
  activeDiscountOffer?: {
    discountPercent: number;
    terms: string;
  };
  isActive: boolean;
}

export class MerchantSubscriptionService {
  constructor(private readonly paymentAdapter: PaymentGatewayAdapter = defaultPaymentAdapter) {}

  /**
   * Registers a merchant partner subscription.
   * COMMUNITY_FREE activates immediately.
   * Paid tiers (VERIFIED_PARTNER, FEATURED_HERITAGE) remain INACTIVE (isActive: false)
   * until confirmed by trusted payment verification.
   */
  public async registerPartnerSubscription(
    input: CreateSubscriptionInput
  ): Promise<RegisterSubscriptionOutput> {
    const subscriptionId = `sub_merch_${input.merchantPlaceId}_${randomUUID().slice(0, 6)}`;
    const now = new Date();
    const durationDays = input.durationDays || 365;
    const expiresAt = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000).toISOString();

    const isFreeTier = input.subscriptionPlan === 'COMMUNITY_FREE';
    let paymentIntent: PaymentIntentResult | undefined;
    let paymentGatewayReference: string | undefined;

    const subscription: PartnerMerchantSubscription = {
      subscriptionId,
      ownerUserId: input.ownerUserId,
      merchantPlaceId: input.merchantPlaceId,
      businessName: input.businessName,
      contactEmail: input.contactEmail,
      subscriptionPlan: input.subscriptionPlan,
      activeDiscountOffer: input.activeDiscountOffer,
      paymentMode: this.paymentAdapter.getMode(),
      paymentGatewayReference,
      isActive: isFreeTier, // Strictly false for paid tiers until confirmed
      expiresAt,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    PartnerMerchantSubscriptionSchema.parse(subscription);

    // Save initial transaction so canonical record exists before gateway intent creation
    await db.collection('subscriptions').doc(subscriptionId).set(subscription);

    if (!isFreeTier) {
      const priceInr = input.subscriptionPlan === 'FEATURED_HERITAGE' ? 2499 : 999;
      paymentIntent = await this.paymentAdapter.createPaymentIntent({
        transactionId: subscriptionId,
        payerUserId: input.merchantPlaceId,
        amountInr: priceInr,
        currency: 'INR',
        description: `Partner Subscription: ${input.subscriptionPlan} for ${input.businessName}`,
      });
      paymentGatewayReference = paymentIntent.gatewayReference;
      subscription.paymentGatewayReference = paymentGatewayReference;
      await db.collection('subscriptions').doc(subscriptionId).update({
        paymentGatewayReference,
      });
    }
    return {
      subscription,
      paymentIntent,
      isPendingPayment: !isFreeTier,
    };
  }

  /**
   * Confirms payment and activates a paid partner subscription.
   * Enforces server environment checks, adapter verification, and idempotent activation.
   */
  public async confirmPartnerSubscriptionPayment(
    input: ConfirmSubscriptionPaymentInput
  ): Promise<{ subscription: PartnerMerchantSubscription; isIdempotentReplay: boolean }> {
    const subRef = db.collection('subscriptions').doc(input.subscriptionId);
    const snap = await subRef.get();

    if (!snap.exists) {
      throw new Error(`Subscription ${input.subscriptionId} not found.`);
    }

    const sub = snap.data() as PartnerMerchantSubscription;

    // Authorization: Caller must be verified subscription owner or administrator
    if (!sub.ownerUserId) {
      if (!input.isAdminOverride) {
        throw new Error(
          'Unauthorized: Subscription lacks a verified owner association. An administrator must verify and migrate this legacy record.'
        );
      }
    } else if (sub.ownerUserId !== input.callerUserId && !input.isAdminOverride) {
      throw new Error('Unauthorized: Only the merchant subscription owner or administrator may confirm payment.');
    }

    // Fail-Closed Server Environment Configuration Guard
    validateSettlementEnvironment({
      transactionPaymentMode: sub.paymentMode,
      isSimulationRequested: input.simulatedOutcome !== undefined,
    });

    if (sub.isActive) {
      return { subscription: sub, isIdempotentReplay: true };
    }

    // Verify confirmation via payment adapter
    const verification = await this.paymentAdapter.verifyPayment({
      transactionId: sub.subscriptionId,
      gatewayReference: sub.paymentGatewayReference || '',
      simulatedOutcome: input.simulatedOutcome,
    });

    if (!verification.verified) {
      throw new Error(`Payment verification failed: ${verification.failureReason || 'Declined'}`);
    }

    const now = new Date().toISOString();
    const activatedSub: PartnerMerchantSubscription = {
      ...sub,
      isActive: true,
      updatedAt: now,
    };

    PartnerMerchantSubscriptionSchema.parse(activatedSub);
    await subRef.set(activatedSub);

    return { subscription: activatedSub, isIdempotentReplay: false };
  }

  /**
   * Retrieves sanitized public partner offer for spot cards or route pass holders.
   * Private billing emails and credentials are stripped.
   */
  public async getPublicPartnerOffer(merchantPlaceId: string): Promise<PublicPartnerOffer | null> {
    const snap = await db
      .collection('subscriptions')
      .where('merchantPlaceId', '==', merchantPlaceId)
      .where('isActive', '==', true)
      .limit(1)
      .get();

    if (snap.empty) {
      return null;
    }

    const sub = snap.docs[0].data() as PartnerMerchantSubscription;

    // Temporal validity check
    if (sub.expiresAt <= new Date().toISOString()) {
      return null;
    }

    return {
      merchantPlaceId: sub.merchantPlaceId,
      businessName: sub.businessName,
      subscriptionPlan: sub.subscriptionPlan,
      activeDiscountOffer: sub.activeDiscountOffer,
      isActive: sub.isActive,
    };
  }
}
