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

export interface CreateSubscriptionInput {
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
  /**
   * Registers or updates a merchant partner subscription.
   */
  public async registerPartnerSubscription(input: CreateSubscriptionInput): Promise<PartnerMerchantSubscription> {
    const subscriptionId = `sub_merch_${input.merchantPlaceId}_${randomUUID().slice(0, 6)}`;
    const now = new Date();
    const durationDays = input.durationDays || 365;
    const expiresAt = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000).toISOString();

    const subscription: PartnerMerchantSubscription = {
      subscriptionId,
      merchantPlaceId: input.merchantPlaceId,
      businessName: input.businessName,
      contactEmail: input.contactEmail,
      subscriptionPlan: input.subscriptionPlan,
      activeDiscountOffer: input.activeDiscountOffer,
      paymentMode: 'SANDBOX',
      isActive: true,
      expiresAt,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    PartnerMerchantSubscriptionSchema.parse(subscription);

    await db.collection('subscriptions').doc(subscriptionId).set(subscription);
    return subscription;
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
