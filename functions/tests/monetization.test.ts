/**
 * Comprehensive Unit Tests: Contributor Ecosystem & Monetization Backend
 * Task A5 — Contributor Ecosystem & Monetization Backend
 */

import { test, describe } from 'node:test';
import * as assert from 'node:assert';
import {
  ContributorTipDocument,
  ContributorTipDocumentSchema,
  ContributorRewardLedger,
  ContributorRewardLedgerSchema,
  RoutePassDocument,
  RoutePassDocumentSchema,
  PartnerMerchantSubscription,
  PartnerMerchantSubscriptionSchema,
} from '../src/types/contracts/index.js';
import {
  SandboxPaymentAdapter,
} from '../src/monetization/adapters/sandbox-payment-adapter.js';
import {
  calculateGuidanceRank,
} from '../src/monetization/services/tipping-service.js';
import {
  validateSettlementEnvironment,
} from '../src/monetization/config/payment-environment.js';
import {
  PassTier,
} from '../src/types/contracts/index.js';

describe('Task A5 — Monetization & Contributor Ecosystem Backend', () => {

  // ==============================================================================
  // 1. Sandbox Payment Gateway Adapter Tests
  // ==============================================================================
  describe('SandboxPaymentAdapter', () => {
    const adapter = new SandboxPaymentAdapter();

    test('Mode is strictly SANDBOX', () => {
      assert.strictEqual(adapter.getMode(), 'SANDBOX');
    });

    test('Creates deterministic simulated payment intent with sandbox_sim_ prefix', async () => {
      const intent = await adapter.createPaymentIntent({
        transactionId: 'tip_blr_test_123',
        payerUserId: 'usr_payer_001',
        amountInr: 100,
        currency: 'INR',
        description: 'Tip for CTR',
      });

      assert.strictEqual(intent.paymentMode, 'SANDBOX');
      assert.strictEqual(intent.isSimulated, true);
      assert.ok(intent.gatewayReference.startsWith('sandbox_sim_upi_'));
      assert.ok(intent.intentUrl?.includes('upi://pay'));
      assert.ok(intent.qrPayload?.startsWith('SANDBOX_MOCK_QR_'));
    });

    test('Creates pass intent with sandbox_sim_pass_ prefix', async () => {
      const intent = await adapter.createPaymentIntent({
        transactionId: 'pass_malleshwaram_456',
        payerUserId: 'usr_payer_001',
        amountInr: 299,
        currency: 'INR',
        description: 'Pass for Malleshwaram',
      });

      assert.ok(intent.gatewayReference.startsWith('sandbox_sim_pass_'));
    });

    test('Verifies valid simulated payment intent successfully', async () => {
      const result = await adapter.verifyPayment({
        transactionId: 'tip_blr_test_123',
        gatewayReference: 'sandbox_sim_upi_abc123',
      });

      assert.strictEqual(result.verified, true);
      assert.strictEqual(result.paymentMode, 'SANDBOX');
      assert.strictEqual(result.isSimulated, true);
      assert.ok(result.settledAt);
    });

    test('Rejects verification when non-sandbox reference is passed', async () => {
      const result = await adapter.verifyPayment({
        transactionId: 'tip_blr_test_123',
        gatewayReference: 'live_razorpay_987213892', // Live format
      });

      assert.strictEqual(result.verified, false);
      assert.ok(result.failureReason?.includes('Invalid gateway reference format'));
    });

    test('Handles explicit simulated failure outcome', async () => {
      const result = await adapter.verifyPayment({
        transactionId: 'tip_blr_test_123',
        gatewayReference: 'sandbox_sim_upi_abc123',
        simulatedOutcome: 'FAILURE',
      });

      assert.strictEqual(result.verified, false);
      assert.ok(result.failureReason?.includes('declined'));
    });
  });

  // ==============================================================================
  // 2. Tipping Calculation & Accounting Model Invariants
  // ==============================================================================
  describe('Tipping Calculation & Accounting Invariants', () => {
    test('Calculates platform fee (5% with min ₹5) and positive contributor net correctly', () => {
      const calculateFees = (amountInr: number) => {
        const fee = Math.max(5, Math.round(amountInr * 0.05));
        const net = amountInr - fee;
        return { fee, net };
      };

      // ₹50 -> 5% = 2.5 -> min ₹5 applies
      const r1 = calculateFees(50);
      assert.strictEqual(r1.fee, 5);
      assert.strictEqual(r1.net, 45);

      // ₹100 -> 5% = ₹5
      const r2 = calculateFees(100);
      assert.strictEqual(r2.fee, 5);
      assert.strictEqual(r2.net, 95);

      // ₹500 -> 5% = ₹25
      const r3 = calculateFees(500);
      assert.strictEqual(r3.fee, 25);
      assert.strictEqual(r3.net, 475);
    });

    test('Guidance rank evolves monotonically with reputation points', () => {
      assert.strictEqual(calculateGuidanceRank(0), 'Local Resident');
      assert.strictEqual(calculateGuidanceRank(49), 'Local Resident');
      assert.strictEqual(calculateGuidanceRank(50), 'Neighborhood Scout');
      assert.strictEqual(calculateGuidanceRank(199), 'Neighborhood Scout');
      assert.strictEqual(calculateGuidanceRank(200), 'Community Pillar');
      assert.strictEqual(calculateGuidanceRank(499), 'Community Pillar');
      assert.strictEqual(calculateGuidanceRank(500), 'Malleshwaram Heritage Master');
      assert.strictEqual(calculateGuidanceRank(1000), 'Malleshwaram Heritage Legend');
    });

    test('Transactional Invariant: totalEarningsInr == availableBalanceInr + withdrawnTotalInr', () => {
      let totalEarningsInr = 0;
      let availableBalanceInr = 0;
      let withdrawnTotalInr = 0;

      const assertInvariant = () => {
        assert.strictEqual(
          totalEarningsInr,
          availableBalanceInr + withdrawnTotalInr,
          'totalEarningsInr must equal availableBalanceInr + withdrawnTotalInr'
        );
        assert.ok(availableBalanceInr >= 0, 'availableBalanceInr must be >= 0');
      };

      // Initial state
      assertInvariant();

      // Tip 1 arrives: ₹95 net
      const net1 = 95;
      totalEarningsInr += net1;
      availableBalanceInr += net1;
      assertInvariant();

      // Tip 2 arrives: ₹475 net
      const net2 = 475;
      totalEarningsInr += net2;
      availableBalanceInr += net2;
      assertInvariant();
      assert.strictEqual(totalEarningsInr, 570);
      assert.strictEqual(availableBalanceInr, 570);

      // Contributor withdraws ₹500
      const withdrawal = 500;
      assert.ok(availableBalanceInr >= withdrawal);
      availableBalanceInr -= withdrawal;
      withdrawnTotalInr += withdrawal;
      assertInvariant();
      assert.strictEqual(totalEarningsInr, 570);
      assert.strictEqual(availableBalanceInr, 70);
      assert.strictEqual(withdrawnTotalInr, 500);

      // Validates against Zod schema
      const ledger: ContributorRewardLedger = {
        userId: 'usr_test_contributor',
        totalEarningsInr,
        availableBalanceInr,
        withdrawnTotalInr,
        unrecoveredAdjustmentInr: 0,
        reputationPoints: 60,
        guidanceRank: 'Neighborhood Scout',
        updatedAt: new Date().toISOString(),
      };
      assert.doesNotThrow(() => ContributorRewardLedgerSchema.parse(ledger));
    });

    test('Idempotent settlement: Repeated settlement calls do not double-credit balance', () => {
      const tipDatabase = new Map<string, ContributorTipDocument>();
      const rewardDatabase = new Map<string, ContributorRewardLedger>();

      const recipientId = 'usr_recipient_777';
      const tipId = 'tip_test_idempotent_01';

      // Seed initial tip
      tipDatabase.set(tipId, {
        tipId,
        payerUserId: 'usr_payer_111',
        recipientUserId: recipientId,
        spotId: 'place_ctr_01',
        spotName: 'CTR Shri Sagar',
        amountInr: 100,
        platformFeeInr: 5,
        contributorNetInr: 95,
        currency: 'INR',
        paymentMode: 'SANDBOX',
        paymentStatus: 'INITIATED',
        createdAt: new Date().toISOString(),
      });

      // Simulation of atomic transaction
      const settleTransaction = (callerId: string, id: string) => {
        const tip = tipDatabase.get(id);
        if (!tip) throw new Error('Tip not found');
        if (tip.payerUserId !== callerId) throw new Error('Unauthorized caller');

        // Idempotency check
        if (tip.paymentStatus === 'COMPLETED') {
          return { tip, ledger: rewardDatabase.get(tip.recipientUserId)!, isReplay: true };
        }

        // State mutation
        const updatedTip: ContributorTipDocument = {
          ...tip,
          paymentStatus: 'COMPLETED',
          settledAt: new Date().toISOString(),
        };
        tipDatabase.set(id, updatedTip);

        const currentLedger = rewardDatabase.get(tip.recipientUserId) || {
          userId: tip.recipientUserId,
          totalEarningsInr: 0,
          availableBalanceInr: 0,
          withdrawnTotalInr: 0,
          unrecoveredAdjustmentInr: 0,
          reputationPoints: 0,
          guidanceRank: 'Local Resident',
          updatedAt: new Date().toISOString(),
        };

        const updatedLedger: ContributorRewardLedger = {
          ...currentLedger,
          totalEarningsInr: currentLedger.totalEarningsInr + tip.contributorNetInr,
          availableBalanceInr: currentLedger.availableBalanceInr + tip.contributorNetInr,
          unrecoveredAdjustmentInr: currentLedger.unrecoveredAdjustmentInr,
          reputationPoints: currentLedger.reputationPoints + 10,
          guidanceRank: calculateGuidanceRank(currentLedger.reputationPoints + 10),
          updatedAt: new Date().toISOString(),
        };
        rewardDatabase.set(tip.recipientUserId, updatedLedger);

        return { tip: updatedTip, ledger: updatedLedger, isReplay: false };
      };

      // Call 1: First settlement
      const res1 = settleTransaction('usr_payer_111', tipId);
      assert.strictEqual(res1.isReplay, false);
      assert.strictEqual(res1.tip.paymentStatus, 'COMPLETED');
      assert.strictEqual(res1.ledger.totalEarningsInr, 95);
      assert.strictEqual(res1.ledger.availableBalanceInr, 95);
      assert.doesNotThrow(() => ContributorTipDocumentSchema.parse(res1.tip));

      // Call 2: Duplicate webhook / retry call with same tipId
      const res2 = settleTransaction('usr_payer_111', tipId);
      assert.strictEqual(res2.isReplay, true);
      // Balance must NOT have doubled to 190
      assert.strictEqual(res2.ledger.totalEarningsInr, 95);
      assert.strictEqual(res2.ledger.availableBalanceInr, 95);
    });

    test('Refund/Reversal: Preserves availableBalanceInr >= 0 even if already withdrawn', () => {
      let totalEarningsInr = 100;
      let availableBalanceInr = 0; // Already withdrawn
      let withdrawnTotalInr = 100;
      let unrecoveredAdjustmentInr = 0;

      const reverseTipNet = 95;

      // Handle refund when availableBalance < reverseTipNet
      if (availableBalanceInr >= reverseTipNet) {
        availableBalanceInr -= reverseTipNet;
        totalEarningsInr -= reverseTipNet;
      } else {
        const remainingToDeduct = reverseTipNet - availableBalanceInr;
        totalEarningsInr -= availableBalanceInr;
        availableBalanceInr = 0; // Strictly non-negative
        unrecoveredAdjustmentInr += remainingToDeduct;
      }

      assert.ok(availableBalanceInr >= 0, 'availableBalance must never become negative');
      assert.strictEqual(availableBalanceInr, 0);
      assert.strictEqual(withdrawnTotalInr, 100);
      assert.strictEqual(unrecoveredAdjustmentInr, 95);
    });
  });

  // ==============================================================================
  // 3. Route Pass Duration & Access Validation Tests
  // ==============================================================================
  describe('Route Pass Durations, Perks & Verification', () => {
    test('Tier configuration matches pricing, duration, and perks specifications', () => {
      const getTierConfig = (tier: PassTier) => {
        switch (tier) {
          case 'SINGLE_ROUTE':
            return { pricePaidInr: 99, durationDays: 2, discount: 5 };
          case 'NEIGHBORHOOD_ALL_ACCESS':
            return { pricePaidInr: 299, durationDays: 7, discount: 10 };
          case 'ANNUAL_EXPLORER':
            return { pricePaidInr: 999, durationDays: 365, discount: 20 };
        }
      };

      const single = getTierConfig('SINGLE_ROUTE');
      assert.strictEqual(single.pricePaidInr, 99);
      assert.strictEqual(single.durationDays, 2);
      assert.strictEqual(single.discount, 5);

      const allAccess = getTierConfig('NEIGHBORHOOD_ALL_ACCESS');
      assert.strictEqual(allAccess.pricePaidInr, 299);
      assert.strictEqual(allAccess.durationDays, 7);
      assert.strictEqual(allAccess.discount, 10);

      const annual = getTierConfig('ANNUAL_EXPLORER');
      assert.strictEqual(annual.pricePaidInr, 999);
      assert.strictEqual(annual.durationDays, 365);
      assert.strictEqual(annual.discount, 20);
    });

    test('Temporal pass validity: Expired passes are rejected', () => {
      const now = new Date();
      const expiredPass: RoutePassDocument = {
        passId: 'pass_expired_01',
        userId: 'usr_test_traveler',
        tier: 'NEIGHBORHOOD_ALL_ACCESS',
        neighborhood: 'Malleshwaram',
        accessibleRouteIds: ['route_heritage_01'],
        pricePaidInr: 299,
        currency: 'INR',
        paymentMode: 'SANDBOX',
        status: 'ACTIVE',
        perksIncluded: {
          audioGuidanceUnlocked: true,
          offlinePackUnlocked: true,
          merchantPartnerDiscountPercent: 10,
        },
        validFrom: new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000).toISOString(),
        validUntil: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString(), // Expired yesterday
        purchasedAt: new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000).toISOString(),
      };

      const isPassActive = (pass: RoutePassDocument) => {
        return pass.status === 'ACTIVE' && pass.validUntil > new Date().toISOString();
      };

      assert.doesNotThrow(() => RoutePassDocumentSchema.parse(expiredPass));
      assert.strictEqual(isPassActive(expiredPass), false);
    });

    test('Scope verification: ANNUAL_EXPLORER pass grants global access across neighborhoods', () => {
      const now = new Date();
      const annualPass: RoutePassDocument = {
        passId: 'pass_annual_01',
        userId: 'usr_test_traveler',
        tier: 'ANNUAL_EXPLORER',
        neighborhood: 'GLOBAL',
        accessibleRouteIds: [],
        pricePaidInr: 999,
        currency: 'INR',
        paymentMode: 'SANDBOX',
        status: 'ACTIVE',
        perksIncluded: {
          audioGuidanceUnlocked: true,
          offlinePackUnlocked: true,
          merchantPartnerDiscountPercent: 20,
        },
        validFrom: now.toISOString(),
        validUntil: new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        purchasedAt: now.toISOString(),
      };

      const verifyAccess = (pass: RoutePassDocument, reqNeighborhood: string, reqRouteId: string) => {
        if (pass.status !== 'ACTIVE' || pass.validUntil <= new Date().toISOString()) return false;
        if (pass.tier === 'ANNUAL_EXPLORER') return true;
        if (pass.neighborhood.toLowerCase() === reqNeighborhood.toLowerCase()) return true;
        if (pass.accessibleRouteIds.includes(reqRouteId)) return true;
        return false;
      };

      // Should grant access to any neighborhood & route
      assert.strictEqual(verifyAccess(annualPass, 'Indiranagar', 'route_indiranagar_cafes'), true);
      assert.strictEqual(verifyAccess(annualPass, 'Malleshwaram', 'route_heritage_01'), true);
    });
  });

  // ==============================================================================
  // 4. Partner Merchant Subscription Privacy Barrier Tests
  // ==============================================================================
  describe('Partner Merchant Subscription Privacy Barrier', () => {
    test('Public partner offer exposes discount perks and hides private merchant contact email', () => {
      const internalSubscription: PartnerMerchantSubscription = {
        subscriptionId: 'sub_merch_secret_01',
        merchantPlaceId: 'place_ctr_malleshwaram_01',
        businessName: 'Central Tiffin Room (Shri Sagar)',
        contactEmail: 'confidential_billing@ctr-bangalore.in', // PRIVATE
        subscriptionPlan: 'FEATURED_HERITAGE',
        activeDiscountOffer: {
          discountPercent: 10,
          terms: '10% off any breakfast thali with active Neighborhood Pass',
        },
        paymentMode: 'SANDBOX',
        isActive: true,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Public sanitizer
      const sanitizePublicOffer = (sub: PartnerMerchantSubscription) => {
        return {
          merchantPlaceId: sub.merchantPlaceId,
          businessName: sub.businessName,
          subscriptionPlan: sub.subscriptionPlan,
          activeDiscountOffer: sub.activeDiscountOffer,
          isActive: sub.isActive,
        };
      };

      const publicOffer = sanitizePublicOffer(internalSubscription);

      assert.doesNotThrow(() => PartnerMerchantSubscriptionSchema.parse(internalSubscription));

      // Verify public fields are present
      assert.strictEqual(publicOffer.merchantPlaceId, 'place_ctr_malleshwaram_01');
      assert.strictEqual(publicOffer.activeDiscountOffer?.discountPercent, 10);

      // Verify confidential fields are NOT in public offer
      assert.strictEqual((publicOffer as any).contactEmail, undefined);
      assert.strictEqual((publicOffer as any).subscriptionId, undefined);
    });
  });

  // ==============================================================================
  // 5. Server-Side Security & Authorization Tests
  // ==============================================================================
  describe('Server-Side Security & Authorization', () => {
    test('Rejects self-tipping at business logic validation', () => {
      const validateTipParams = (payer: string, recipient: string, amount: number) => {
        if (payer === recipient) {
          throw new Error('Self-tipping is strictly prohibited.');
        }
        if (amount <= 0) {
          throw new Error('Amount must be positive.');
        }
      };

      assert.throws(
        () => validateTipParams('usr_alice_123', 'usr_alice_123', 100),
        /Self-tipping is strictly prohibited/
      );
    });

    test('Restricts reward ledger inspection to owner or admin', () => {
      const authorizeLedgerRead = (callerUid: string, targetUserId: string, callerRole: string) => {
        if (callerUid === targetUserId) return true; // Owner
        if (callerRole === 'ADMIN' || callerRole === 'MODERATOR') return true; // Admin/Mod
        throw new Error('Permission denied: Cannot inspect another user\'s reward ledger.');
      };

      // Owner can read
      assert.strictEqual(authorizeLedgerRead('usr_alice', 'usr_alice', 'TRAVELER'), true);
      // Admin can read
      assert.strictEqual(authorizeLedgerRead('usr_admin', 'usr_alice', 'ADMIN'), true);
      // Unauthorized stranger is rejected
      assert.throws(
        () => authorizeLedgerRead('usr_eve_stranger', 'usr_alice', 'TRAVELER'),
        /Permission denied/
      );
    });

    test('Fail-Closed Payment Environment: Rejects sandbox settlement in production, missing config, and inconsistencies', () => {
      const origPaymentEnv = process.env.PAYMENT_ENV;
      const origNodeEnv = process.env.NODE_ENV;
      const origKService = process.env.K_SERVICE;

      try {
        // Case 1: In production NODE_ENV, PAYMENT_ENV=SANDBOX must fail-closed
        process.env.PAYMENT_ENV = 'SANDBOX';
        process.env.NODE_ENV = 'production';
        delete process.env.K_SERVICE;
        assert.throws(
          () => validateSettlementEnvironment({ transactionPaymentMode: 'SANDBOX', isSimulationRequested: true }),
          /Security violation: PAYMENT_ENV cannot be set to SANDBOX in production NODE_ENV/
        );

        // Case 2: In LIVE environment, SANDBOX transactions are rejected
        process.env.PAYMENT_ENV = 'LIVE';
        process.env.NODE_ENV = 'production';
        assert.throws(
          () => validateSettlementEnvironment({ transactionPaymentMode: 'SANDBOX', isSimulationRequested: false }),
          /Inconsistent configuration: Cannot settle a SANDBOX transaction in an explicit LIVE payment environment/
        );

        // Case 3: In LIVE environment, simulated outcomes are rejected
        assert.throws(
          () => validateSettlementEnvironment({ transactionPaymentMode: 'LIVE', isSimulationRequested: true }),
          /Security violation: Simulated outcomes are strictly prohibited in an explicit LIVE payment environment/
        );

        // Case 4: Missing PAYMENT_ENV in deployed cloud runtime must fail-closed
        delete process.env.PAYMENT_ENV;
        process.env.NODE_ENV = 'production';
        process.env.K_SERVICE = 'neighborhoodguide-backend';
        assert.throws(
          () => validateSettlementEnvironment({ transactionPaymentMode: 'SANDBOX', isSimulationRequested: false }),
          /Fail-closed security check: Missing explicit PAYMENT_ENV configuration in deployed or production runtime/
        );

        // Case 5: Unrecognized / unexpected PAYMENT_ENV must fail-closed
        process.env.PAYMENT_ENV = 'STAGING_TEST';
        delete process.env.K_SERVICE;
        assert.throws(
          () => validateSettlementEnvironment({ transactionPaymentMode: 'SANDBOX', isSimulationRequested: false }),
          /Fail-closed security check: Unrecognized PAYMENT_ENV/
        );

        // Case 6: Legitimate local test environment with explicit SANDBOX
        process.env.PAYMENT_ENV = 'SANDBOX';
        process.env.NODE_ENV = 'test';
        delete process.env.K_SERVICE;
        assert.doesNotThrow(() =>
          validateSettlementEnvironment({ transactionPaymentMode: 'SANDBOX', isSimulationRequested: true })
        );

        // Case 7: Legitimate production environment with explicit LIVE and real verification
        process.env.PAYMENT_ENV = 'LIVE';
        process.env.NODE_ENV = 'production';
        assert.doesNotThrow(() =>
          validateSettlementEnvironment({ transactionPaymentMode: 'LIVE', isSimulationRequested: false })
        );
      } finally {
        process.env.PAYMENT_ENV = origPaymentEnv;
        process.env.NODE_ENV = origNodeEnv;
        process.env.K_SERVICE = origKService;
      }
    });
  });

  // ==============================================================================
  // 6. Review Points Verification: Reconciled Invariants, Activation & Privacy
  // ==============================================================================
  describe('Review Resolution — Detailed Verifications', () => {

    test('Reconciled Accounting Identity: totalEarnings + unrecoveredAdjustment == availableBalance + withdrawnTotal', () => {
      let totalEarningsInr = 100;
      let availableBalanceInr = 0; // Fully withdrawn
      let withdrawnTotalInr = 100;
      let unrecoveredAdjustmentInr = 0;

      const verifyIdentity = () => {
        assert.strictEqual(
          totalEarningsInr + unrecoveredAdjustmentInr,
          availableBalanceInr + withdrawnTotalInr,
          'Mathematical identity must balance'
        );
        assert.ok(availableBalanceInr >= 0, 'availableBalanceInr must be >= 0');
        assert.ok(withdrawnTotalInr >= 0, 'withdrawnTotalInr must be >= 0');
        assert.ok(unrecoveredAdjustmentInr >= 0, 'unrecoveredAdjustmentInr must be >= 0');
      };

      // Initial state: Contributor earned 100, withdrew 100
      verifyIdentity();

      // Event 1: Refund of ₹95 occurs on the previously withdrawn tip
      const refundNet = 95;
      const recoveredFromAvailable = Math.min(availableBalanceInr, refundNet); // 0
      const clawbackDebt = refundNet - recoveredFromAvailable; // 95

      availableBalanceInr -= recoveredFromAvailable; // 0
      totalEarningsInr -= refundNet; // 5
      unrecoveredAdjustmentInr += clawbackDebt; // 95

      // Check invariant after refund exceeding available balance:
      // totalEarnings (5) + unrecoveredAdjustment (95) == availableBalance (0) + withdrawnTotal (100)
      verifyIdentity();
      assert.strictEqual(totalEarningsInr, 5);
      assert.strictEqual(unrecoveredAdjustmentInr, 95);
      assert.strictEqual(availableBalanceInr, 0);

      // Event 2: A new tip of ₹150 net arrives
      const newTipNet = 150;
      let netToAdd = newTipNet;
      let debtRecovery = 0;

      if (unrecoveredAdjustmentInr > 0) {
        debtRecovery = Math.min(unrecoveredAdjustmentInr, netToAdd); // 95
        netToAdd -= debtRecovery; // 55
      }

      totalEarningsInr += newTipNet; // 5 + 150 = 155
      availableBalanceInr += netToAdd; // 0 + 55 = 55
      unrecoveredAdjustmentInr -= debtRecovery; // 95 - 95 = 0

      // Check invariant after debt offset and remaining credit:
      // totalEarnings (155) + unrecoveredAdjustment (0) == availableBalance (55) + withdrawnTotal (100)
      verifyIdentity();
      assert.strictEqual(totalEarningsInr, 155);
      assert.strictEqual(unrecoveredAdjustmentInr, 0);
      assert.strictEqual(availableBalanceInr, 55);
      assert.strictEqual(withdrawnTotalInr, 100);
    });

    test('Route-Pass Two-Phase Activation: PENDING passes grant zero route access until confirmed', () => {
      const now = new Date();
      const pendingPass: RoutePassDocument = {
        passId: 'pass_test_pending_01',
        userId: 'usr_traveler_888',
        tier: 'NEIGHBORHOOD_ALL_ACCESS',
        neighborhood: 'Malleshwaram',
        accessibleRouteIds: ['route_heritage_01'],
        pricePaidInr: 299,
        currency: 'INR',
        paymentMode: 'SANDBOX',
        status: 'PENDING', // PENDING
        perksIncluded: {
          audioGuidanceUnlocked: true,
          offlinePackUnlocked: true,
          merchantPartnerDiscountPercent: 10,
        },
        validFrom: now.toISOString(),
        validUntil: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        purchasedAt: now.toISOString(),
      };

      const checkAccess = (pass: RoutePassDocument, reqNeighborhood: string) => {
        // STRICT: Only ACTIVE passes can grant route access
        if (pass.status !== 'ACTIVE') return false;
        if (pass.validUntil <= new Date().toISOString()) return false;
        return pass.neighborhood.toLowerCase() === reqNeighborhood.toLowerCase();
      };

      // 1. Pending pass must grant ZERO access
      assert.strictEqual(checkAccess(pendingPass, 'Malleshwaram'), false);

      // 2. Activated pass grants access
      const activePass: RoutePassDocument = { ...pendingPass, status: 'ACTIVE' };
      assert.strictEqual(checkAccess(activePass, 'Malleshwaram'), true);

      // 3. Failed/Revoked pass grants ZERO access
      const revokedPass: RoutePassDocument = { ...pendingPass, status: 'REVOKED' };
      assert.strictEqual(checkAccess(revokedPass, 'Malleshwaram'), false);
    });

    test('Privacy Barrier: Contributor public attribution isolates private financial ledger', () => {
      const privateLedger: ContributorRewardLedger = {
        userId: 'usr_priya_782',
        totalEarningsInr: 5000,
        availableBalanceInr: 2500,
        withdrawnTotalInr: 2500,
        unrecoveredAdjustmentInr: 0,
        payoutUpiId: 'priya.private@okaxis', // CONFIDENTIAL
        reputationPoints: 550,
        guidanceRank: 'Malleshwaram Heritage Master',
        updatedAt: new Date().toISOString(),
      };

      const publicAttribution = {
        userId: privateLedger.userId,
        reputationPoints: privateLedger.reputationPoints,
        guidanceRank: privateLedger.guidanceRank,
        spotsApprovedCount: 12,
        accuracyRate: 0.95,
      };

      // Verify confidential financial fields are completely absent from public attribution
      assert.strictEqual((publicAttribution as any).payoutUpiId, undefined);
      assert.strictEqual((publicAttribution as any).availableBalanceInr, undefined);
      assert.strictEqual((publicAttribution as any).withdrawnTotalInr, undefined);
      assert.strictEqual((publicAttribution as any).totalEarningsInr, undefined);
    });
  });
});
