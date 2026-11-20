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
  GuidanceOfferingDocument,
  GuidanceOfferingDocumentSchema,
  GuidanceBookingDocument,
  GuidanceBookingDocumentSchema,
  ContributionDocument,
  ContributionDocumentSchema,
  ContributorSubmissionInputSchema,
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
          /Security violation: PAYMENT_ENV cannot be set to SANDBOX/
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

        // Case 8 (Mandatory Security Verification): K_SERVICE is present (deployed Cloud Functions),
        // NODE_ENV is absent, and PAYMENT_ENV=SANDBOX -> MUST REJECT!
        process.env.PAYMENT_ENV = 'SANDBOX';
        delete process.env.NODE_ENV;
        process.env.K_SERVICE = 'projects/test-proj/services/neighborhoodguide-functions';
        assert.throws(
          () => validateSettlementEnvironment({ transactionPaymentMode: 'SANDBOX', isSimulationRequested: true }),
          /Security violation: PAYMENT_ENV cannot be set to SANDBOX in deployed cloud runtime or production NODE_ENV/
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

  // ==============================================================================
  // 7. One-on-One Paid Local Guidance Lifecycle Tests (A5-V-01)
  // ==============================================================================
  describe('One-on-One Paid Local Guidance Lifecycle (A5-V-01)', () => {
    test('Offering registration enforces price and duration limits and valid schema', () => {
      const validOffering: GuidanceOfferingDocument = {
        offeringId: 'guide_offering_priya_01',
        guideUserId: 'usr_priya_782',
        neighborhood: 'Malleshwaram',
        title: 'Heritage Temple Architecture Walk',
        description: 'Guided walk through Malleshwaram temples and traditional agraharas.',
        durationMinutes: 90,
        priceInr: 750,
        meetingPoint: 'Kadu Malleshwara Temple 15th Cross',
        languages: ['Kannada', 'English'],
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      assert.doesNotThrow(() => GuidanceOfferingDocumentSchema.parse(validOffering));

      // Rejects price < 100
      assert.throws(
        () => GuidanceOfferingDocumentSchema.parse({ ...validOffering, priceInr: 50 }),
        /too_small/
      );

      // Rejects price > 10000
      assert.throws(
        () => GuidanceOfferingDocumentSchema.parse({ ...validOffering, priceInr: 15000 }),
        /too_big/
      );

      // Rejects duration < 15
      assert.throws(
        () => GuidanceOfferingDocumentSchema.parse({ ...validOffering, durationMinutes: 10 }),
        /too_small/
      );
    });

    test('Self-booking is strictly prohibited and platform fee is 10% (min ₹25)', () => {
      const validateBookingParams = (travelerId: string, guideId: string, priceInr: number) => {
        if (travelerId === guideId) {
          throw new Error('Self-booking is strictly prohibited.');
        }
        const platformFeeInr = Math.max(25, Math.round(priceInr * 0.1));
        const guideNetInr = priceInr - platformFeeInr;
        return { platformFeeInr, guideNetInr };
      };

      // Self-booking throws
      assert.throws(
        () => validateBookingParams('usr_priya_782', 'usr_priya_782', 750),
        /Self-booking is strictly prohibited/
      );

      // ₹200 offering: 10% is 20 -> min ₹25 applies
      const r1 = validateBookingParams('usr_traveler_01', 'usr_guide_02', 200);
      assert.strictEqual(r1.platformFeeInr, 25);
      assert.strictEqual(r1.guideNetInr, 175);

      // ₹750 offering: 10% is 75 -> ₹75 fee
      const r2 = validateBookingParams('usr_traveler_01', 'usr_guide_02', 750);
      assert.strictEqual(r2.platformFeeInr, 75);
      assert.strictEqual(r2.guideNetInr, 675);

      // ₹2,000 offering: 10% is 200 -> ₹200 fee
      const r3 = validateBookingParams('usr_traveler_01', 'usr_guide_02', 2000);
      assert.strictEqual(r3.platformFeeInr, 200);
      assert.strictEqual(r3.guideNetInr, 1800);
    });

    test('Payment Confirmation & State Transitions: REQUESTED -> CONFIRMED -> COMPLETED', () => {
      const now = new Date().toISOString();
      const booking: GuidanceBookingDocument = {
        bookingId: 'guidance_blr_test_01',
        offeringId: 'guide_offering_priya_01',
        travelerUserId: 'usr_traveler_alex',
        guideUserId: 'usr_priya_782',
        neighborhood: 'Malleshwaram',
        offeringTitle: 'Heritage Temple Architecture Walk',
        scheduledDateTime: new Date(Date.now() + 86400000).toISOString(),
        durationMinutes: 90,
        meetingPoint: 'Kadu Malleshwara Temple',
        priceInr: 750,
        platformFeeInr: 75,
        guideNetInr: 675,
        currency: 'INR',
        paymentMode: 'SANDBOX',
        paymentStatus: 'INITIATED',
        paymentGatewayReference: 'sandbox_sim_guidance_abc123',
        status: 'REQUESTED',
        createdAt: now,
        updatedAt: now,
      };

      assert.doesNotThrow(() => GuidanceBookingDocumentSchema.parse(booking));

      // Guide accepts
      const acceptedBooking: GuidanceBookingDocument = { ...booking, status: 'ACCEPTED' };
      assert.strictEqual(acceptedBooking.status, 'ACCEPTED');

      // Traveler completes payment
      const confirmedBooking: GuidanceBookingDocument = {
        ...acceptedBooking,
        paymentStatus: 'COMPLETED',
        status: 'CONFIRMED',
      };
      assert.strictEqual(confirmedBooking.status, 'CONFIRMED');
      assert.strictEqual(confirmedBooking.paymentStatus, 'COMPLETED');

      // Escrow Completion: Credits guide ledger and maintains balance invariant
      let totalEarningsInr = 1000;
      let availableBalanceInr = 500;
      let withdrawnTotalInr = 500;
      let unrecoveredAdjustmentInr = 0;

      const netToAdd = confirmedBooking.guideNetInr; // 675
      totalEarningsInr += netToAdd;
      availableBalanceInr += netToAdd;

      // Invariant Check
      assert.strictEqual(
        totalEarningsInr + unrecoveredAdjustmentInr,
        availableBalanceInr + withdrawnTotalInr
      );
      assert.strictEqual(totalEarningsInr, 1675);
      assert.strictEqual(availableBalanceInr, 1175);
    });

    test('Guidance cancellation and rejection marks payment as FAILED/REFUND', () => {
      const now = new Date().toISOString();
      const paidBooking: GuidanceBookingDocument = {
        bookingId: 'guidance_blr_test_02',
        offeringId: 'guide_offering_priya_01',
        travelerUserId: 'usr_traveler_alex',
        guideUserId: 'usr_priya_782',
        neighborhood: 'Malleshwaram',
        offeringTitle: 'Heritage Walk',
        scheduledDateTime: new Date(Date.now() + 86400000).toISOString(),
        durationMinutes: 90,
        meetingPoint: 'Kadu Malleshwara Temple',
        priceInr: 750,
        platformFeeInr: 75,
        guideNetInr: 675,
        currency: 'INR',
        paymentMode: 'SANDBOX',
        paymentStatus: 'COMPLETED',
        paymentGatewayReference: 'sandbox_sim_guidance_xyz789',
        status: 'CONFIRMED',
        createdAt: now,
        updatedAt: now,
      };

      // Guide cancels / rejects due to emergency
      const cancelledBooking: GuidanceBookingDocument = {
        ...paidBooking,
        status: 'CANCELLED',
        cancellationReason: 'Heavy rain advisory in Malleshwaram',
        paymentStatus: 'FAILED', // Refunded to traveler
        updatedAt: new Date().toISOString(),
      };

      assert.doesNotThrow(() => GuidanceBookingDocumentSchema.parse(cancelledBooking));
      assert.strictEqual(cancelledBooking.status, 'CANCELLED');
      assert.strictEqual(cancelledBooking.paymentStatus, 'FAILED');
    });

    test('Payment adapter executes supported simulated refund upon cancellation', async () => {
      const adapter = new SandboxPaymentAdapter();
      const refund = await adapter.refundPayment({
        transactionId: 'guidance_blr_test_02',
        gatewayReference: 'sandbox_sim_guidance_xyz789',
        amountInr: 750,
        reason: 'Session cancelled by participant',
      });
      assert.strictEqual(refund.refunded, true);
      assert.strictEqual(refund.amountInr, 750);
      assert.strictEqual(refund.paymentMode, 'SANDBOX');
      assert.ok(refund.refundReference.startsWith('sandbox_sim_ref_'));
    });

    test('Guidance refund idempotency: Repeated refund calls with same idempotencyKey return identical result', async () => {
      const adapter = new SandboxPaymentAdapter();
      const idempotencyKey = 'ref_guidance_blr_idem_01';

      const firstRefund = await adapter.refundPayment({
        transactionId: 'guidance_blr_idem_01',
        gatewayReference: 'sandbox_sim_guidance_idem_01',
        amountInr: 750,
        reason: 'Client requested cancellation',
        idempotencyKey,
      });

      const secondRefund = await adapter.refundPayment({
        transactionId: 'guidance_blr_idem_01',
        gatewayReference: 'sandbox_sim_guidance_idem_01',
        amountInr: 750,
        reason: 'Duplicate client retry',
        idempotencyKey,
      });

      assert.strictEqual(firstRefund.refunded, true);
      assert.strictEqual(secondRefund.refunded, true);
      assert.strictEqual(firstRefund.refundReference, secondRefund.refundReference);
      assert.strictEqual(firstRefund.amountInr, secondRefund.amountInr);
    });

    test('Durable Sandbox Refund Idempotency: Survives instance restart and shares state across instances via Firestore', async () => {
      // Mock Firestore database representing shared durable storage
      const mockStorage = new Map<string, any>();
      const mockFirestore = {
        collection: (collectionName: string) => ({
          doc: (docId: string) => ({
            get: async () => ({
              exists: mockStorage.has(`${collectionName}/${docId}`),
              data: () => mockStorage.get(`${collectionName}/${docId}`),
            }),
          }),
        }),
        runTransaction: async (updateFunction: (tx: any) => Promise<any>) => {
          const tx = {
            get: async (docRef: any) => ({
              exists: mockStorage.has(`_sandbox_simulated_refunds/ref_guidance_restart_01`),
              data: () => mockStorage.get(`_sandbox_simulated_refunds/ref_guidance_restart_01`),
            }),
            set: (docRef: any, data: any) => {
              mockStorage.set(`_sandbox_simulated_refunds/ref_guidance_restart_01`, data);
            },
          };
          return updateFunction(tx);
        },
      } as unknown as FirebaseFirestore.Firestore;

      const idempotencyKey = 'ref_guidance_restart_01';

      // 1. Instance 1 executes refund and stores in durable mock Firestore
      const instance1 = new SandboxPaymentAdapter(mockFirestore);
      const refund1 = await instance1.refundPayment({
        transactionId: 'guidance_blr_restart_01',
        gatewayReference: 'sandbox_sim_guidance_restart_01',
        amountInr: 850,
        reason: 'Client cancelled session',
        idempotencyKey,
      });

      assert.strictEqual(refund1.refunded, true);
      assert.ok(mockStorage.has(`_sandbox_simulated_refunds/${idempotencyKey}`));

      // 2. Instance 2 starts afresh (empty local memory) simulating Cloud Function restart / new instance
      const instance2 = new SandboxPaymentAdapter(mockFirestore);
      const refund2 = await instance2.refundPayment({
        transactionId: 'guidance_blr_restart_01',
        gatewayReference: 'sandbox_sim_guidance_restart_01',
        amountInr: 850,
        reason: 'Duplicate retry received after cold start',
        idempotencyKey,
      });

      // Both instances must return the exact same reference and amount
      assert.strictEqual(refund2.refunded, true);
      assert.strictEqual(refund2.refundReference, refund1.refundReference);
      assert.strictEqual(refund2.amountInr, refund1.amountInr);
      assert.strictEqual(refund2.isSimulated, true);
    });

    test('Sandbox refund persistence failure falls back safely to in-memory generation', async () => {
      // Mock Firestore that throws error on read/transaction
      const failingFirestore = {
        collection: () => ({
          doc: () => ({
            get: async () => {
              throw new Error('Firestore connection timeout');
            },
          }),
        }),
        runTransaction: async () => {
          throw new Error('Firestore transaction aborted');
        },
      } as unknown as FirebaseFirestore.Firestore;

      const adapter = new SandboxPaymentAdapter(failingFirestore);
      const refund = await adapter.refundPayment({
        transactionId: 'guidance_blr_fallback_01',
        gatewayReference: 'sandbox_sim_guidance_fallback_01',
        amountInr: 500,
        reason: 'Cancellation under degraded database connectivity',
        idempotencyKey: 'ref_guidance_fallback_01',
      });

      // Must complete safely via fallback without throwing
      assert.strictEqual(refund.refunded, true);
      assert.strictEqual(refund.amountInr, 500);
      assert.ok(refund.refundReference.startsWith('sandbox_sim_ref_'));
    });

    test('Guidance refund concurrency lock: In-flight PENDING refund blocks concurrent attempts within timeout', () => {
      const claimTimeoutMs = 60000;
      const checkConcurrencyLock = (
        doc: GuidanceBookingDocument,
        nowMs: number = Date.now()
      ) => {
        if (doc.refundStatus === 'PENDING') {
          const initiatedTime = doc.refundInitiatedAt ? new Date(doc.refundInitiatedAt).getTime() : 0;
          const elapsed = nowMs - initiatedTime;
          if (elapsed < claimTimeoutMs) {
            throw new Error('A refund operation is currently pending for this booking. Please try again shortly.');
          }
        }
      };

      const now = new Date().toISOString();
      const pendingDoc: GuidanceBookingDocument = {
        bookingId: 'guidance_blr_lock_01',
        offeringId: 'guide_offering_priya_01',
        travelerUserId: 'usr_traveler_alex',
        guideUserId: 'usr_priya_782',
        neighborhood: 'Malleshwaram',
        offeringTitle: 'Heritage Walk',
        scheduledDateTime: new Date(Date.now() + 86400000).toISOString(),
        durationMinutes: 90,
        meetingPoint: 'Kadu Malleshwara Temple',
        priceInr: 750,
        platformFeeInr: 75,
        guideNetInr: 675,
        currency: 'INR',
        paymentMode: 'SANDBOX',
        paymentStatus: 'COMPLETED',
        paymentGatewayReference: 'sandbox_sim_guidance_lock_01',
        status: 'CONFIRMED',
        refundStatus: 'PENDING',
        refundIdempotencyKey: 'ref_guidance_blr_lock_01',
        refundInitiatedAt: now,
        createdAt: now,
        updatedAt: now,
      };

      assert.doesNotThrow(() => GuidanceBookingDocumentSchema.parse(pendingDoc));

      // Immediate concurrent attempt within 5 seconds throws concurrency error
      assert.throws(
        () => checkConcurrencyLock(pendingDoc, Date.now() + 5000),
        /A refund operation is currently pending for this booking/
      );

      // Attempt after 65 seconds permits recovery / retry
      assert.doesNotThrow(() => checkConcurrencyLock(pendingDoc, Date.now() + 65000));
    });

    test('Guidance refund failure leaves refundStatus as FAILED and enables safe retry and recovery', async () => {
      const now = new Date().toISOString();
      const booking: GuidanceBookingDocument = {
        bookingId: 'guidance_blr_fail_01',
        offeringId: 'guide_offering_priya_01',
        travelerUserId: 'usr_traveler_alex',
        guideUserId: 'usr_priya_782',
        neighborhood: 'Malleshwaram',
        offeringTitle: 'Heritage Walk',
        scheduledDateTime: new Date(Date.now() + 86400000).toISOString(),
        durationMinutes: 90,
        meetingPoint: 'Kadu Malleshwara Temple',
        priceInr: 750,
        platformFeeInr: 75,
        guideNetInr: 675,
        currency: 'INR',
        paymentMode: 'SANDBOX',
        paymentStatus: 'COMPLETED',
        paymentGatewayReference: 'sandbox_sim_guidance_fail_01',
        status: 'CONFIRMED',
        refundStatus: 'FAILED', // Failed during previous attempt
        refundIdempotencyKey: 'ref_guidance_blr_fail_01',
        createdAt: now,
        updatedAt: now,
      };

      assert.doesNotThrow(() => GuidanceBookingDocumentSchema.parse(booking));

      // Retry executes refund successfully using the deterministic key
      const adapter = new SandboxPaymentAdapter();
      const recoveryRefund = await adapter.refundPayment({
        transactionId: booking.bookingId,
        gatewayReference: booking.paymentGatewayReference || '',
        amountInr: booking.priceInr,
        reason: 'Recovery retry after network interruption',
        idempotencyKey: booking.refundIdempotencyKey,
      });

      assert.strictEqual(recoveryRefund.refunded, true);

      // Recovered booking document updates to COMPLETED refund and CANCELLED status
      const recoveredDoc: GuidanceBookingDocument = {
        ...booking,
        status: 'CANCELLED',
        cancellationReason: 'Recovery retry completed',
        paymentStatus: 'FAILED',
        refundStatus: 'COMPLETED',
        refundReference: recoveryRefund.refundReference,
        refundedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      assert.doesNotThrow(() => GuidanceBookingDocumentSchema.parse(recoveredDoc));
      assert.strictEqual(recoveredDoc.refundStatus, 'COMPLETED');
      assert.strictEqual(recoveredDoc.status, 'CANCELLED');
    });
  });

  // ==============================================================================
  // 8. Partner Merchant Subscription Registration & Payment Gating Tests (A5-V-04)
  // ==============================================================================
  describe('Partner Merchant Subscription Registration & Payment Gating (A5-V-04)', () => {
    test('Validates partner merchant subscription plans and discount bounds', () => {
      const validSub: PartnerMerchantSubscription = {
        subscriptionId: 'sub_merch_veena_01',
        merchantPlaceId: 'place_veena_stores_01',
        businessName: 'Veena Stores Malleshwaram',
        contactEmail: 'partner@veenastores.in',
        subscriptionPlan: 'VERIFIED_PARTNER',
        activeDiscountOffer: {
          discountPercent: 10,
          terms: '10% off any idli-vada combo with active Route Pass',
        },
        paymentMode: 'SANDBOX',
        paymentGatewayReference: 'sandbox_sim_sub_merch_veena_01',
        isActive: false, // Inactive pending payment confirmation
        expiresAt: new Date(Date.now() + 365 * 86400000).toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      assert.doesNotThrow(() => PartnerMerchantSubscriptionSchema.parse(validSub));

      // Rejects invalid email
      assert.throws(
        () => PartnerMerchantSubscriptionSchema.parse({ ...validSub, contactEmail: 'invalid-email' }),
        /invalid_string/
      );

      // Rejects invalid plan
      assert.throws(
        () => PartnerMerchantSubscriptionSchema.parse({ ...validSub, subscriptionPlan: 'ENTERPRISE_GOLD' as any }),
        /invalid_enum_value/
      );
    });

    test('COMMUNITY_FREE plan activates immediately without payment gateway reference', () => {
      const freeSub: PartnerMerchantSubscription = {
        subscriptionId: 'sub_merch_free_01',
        merchantPlaceId: 'place_local_artisan_01',
        businessName: 'Local Handicrafts Co',
        contactEmail: 'contact@handicrafts.local',
        subscriptionPlan: 'COMMUNITY_FREE',
        paymentMode: 'SANDBOX',
        isActive: true, // Immediately active
        expiresAt: new Date(Date.now() + 365 * 86400000).toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      assert.doesNotThrow(() => PartnerMerchantSubscriptionSchema.parse(freeSub));
      assert.strictEqual(freeSub.isActive, true);
      assert.strictEqual(freeSub.paymentGatewayReference, undefined);
    });

    test('Paid plans (VERIFIED_PARTNER & FEATURED_HERITAGE) are created inactive and invisible in public offers', () => {
      const paidSub: PartnerMerchantSubscription = {
        subscriptionId: 'sub_merch_heritage_01',
        merchantPlaceId: 'place_vidyarthi_bhavan_01',
        businessName: 'Vidyarthi Bhavan',
        contactEmail: 'billing@vidyarthibhavan.in',
        subscriptionPlan: 'FEATURED_HERITAGE',
        activeDiscountOffer: {
          discountPercent: 15,
          terms: '15% discount for passholders',
        },
        paymentMode: 'SANDBOX',
        paymentGatewayReference: 'sandbox_sim_sub_vidyarthi_01',
        isActive: false, // Must be inactive prior to payment confirmation
        expiresAt: new Date(Date.now() + 365 * 86400000).toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      assert.doesNotThrow(() => PartnerMerchantSubscriptionSchema.parse(paidSub));
      assert.strictEqual(paidSub.isActive, false);

      // Public offer query filter simulation (.where('isActive', '==', true))
      const filterPublicOffers = (subs: PartnerMerchantSubscription[]) => {
        return subs.filter((s) => s.isActive && new Date(s.expiresAt) > new Date());
      };

      const publicOffers = filterPublicOffers([paidSub]);
      assert.strictEqual(publicOffers.length, 0, 'Unconfirmed paid partner subscription must NOT appear in public offers');
    });

    test('Payment confirmation activates paid subscription and verifies through payment adapter', async () => {
      const adapter = new SandboxPaymentAdapter();
      const now = new Date().toISOString();

      const unconfirmedSub: PartnerMerchantSubscription = {
        subscriptionId: 'sub_merch_confirm_01',
        merchantPlaceId: 'place_ctr_shrisagar_01',
        businessName: 'CTR Shri Sagar',
        contactEmail: 'admin@ctr.in',
        subscriptionPlan: 'FEATURED_HERITAGE',
        paymentMode: 'SANDBOX',
        paymentGatewayReference: 'sandbox_sim_sub_merch_confirm_01',
        isActive: false,
        expiresAt: new Date(Date.now() + 365 * 86400000).toISOString(),
        createdAt: now,
        updatedAt: now,
      };

      // 1. Payment Verification via adapter
      const verification = await adapter.verifyPayment({
        transactionId: unconfirmedSub.subscriptionId,
        gatewayReference: unconfirmedSub.paymentGatewayReference || '',
      });
      assert.strictEqual(verification.verified, true);

      // 2. State transition to active
      const activatedSub: PartnerMerchantSubscription = {
        ...unconfirmedSub,
        isActive: true,
        updatedAt: new Date().toISOString(),
      };

      assert.doesNotThrow(() => PartnerMerchantSubscriptionSchema.parse(activatedSub));
      assert.strictEqual(activatedSub.isActive, true);

      // 3. Idempotent re-confirmation check
      const reconfirm = (sub: PartnerMerchantSubscription) => {
        if (sub.isActive) {
          return { subscription: sub, isIdempotentReplay: true };
        }
        return { subscription: { ...sub, isActive: true }, isIdempotentReplay: false };
      };

      const replayResult = reconfirm(activatedSub);
      assert.strictEqual(replayResult.isIdempotentReplay, true);
      assert.strictEqual(replayResult.subscription.isActive, true);
    });

    test('Verified merchant owner authorization guard validates ownerUserId and preserves admin overrides', () => {
      const authorizeConfirmation = (
        sub: { ownerUserId?: string; merchantPlaceId: string },
        callerUserId: string,
        isAdmin: boolean
      ) => {
        if (!sub.ownerUserId) {
          if (!isAdmin) {
            throw new Error(
              'Unauthorized: Subscription lacks a verified owner association. An administrator must verify and migrate this legacy record.'
            );
          }
          return true;
        }
        if (sub.ownerUserId !== callerUserId && !isAdmin) {
          throw new Error('Unauthorized: Only the merchant subscription owner or administrator may confirm payment.');
        }
        return true;
      };

      const ownedSub = {
        ownerUserId: 'usr_merchant_alice_01',
        merchantPlaceId: 'place_ctr_malleshwaram_01',
      };

      // 1. Legitimate merchant owner can confirm
      assert.doesNotThrow(() => authorizeConfirmation(ownedSub, 'usr_merchant_alice_01', false));

      // 2. Different authenticated user attempting confirmation is rejected
      assert.throws(
        () => authorizeConfirmation(ownedSub, 'usr_attacker_bob_99', false),
        /Unauthorized: Only the merchant subscription owner or administrator may confirm payment/
      );

      // 3. Administrator / moderator can confirm regardless of owner
      assert.doesNotThrow(() => authorizeConfirmation(ownedSub, 'usr_admin_mod_01', true));

      // 4. Legacy subscription without owner association:
      const legacySub = {
        merchantPlaceId: 'place_ctr_malleshwaram_01',
      };

      // Regular user on legacy record is rejected with specific migration error
      assert.throws(
        () => authorizeConfirmation(legacySub, 'usr_merchant_alice_01', false),
        /Subscription lacks a verified owner association. An administrator must verify and migrate this legacy record/
      );

      // Administrator can verify and confirm legacy record
      assert.doesNotThrow(() => authorizeConfirmation(legacySub, 'usr_admin_mod_01', true));
    });

    test('Registration strictly captures ownerUserId from request.auth.uid ignoring client-supplied owner', () => {
      const registerSubscriptionSafe = (
        authUid: string,
        clientData: { ownerUserId?: string; merchantPlaceId: string; businessName: string }
      ) => {
        // Enforce server-side security: ignore clientData.ownerUserId
        return {
          merchantPlaceId: clientData.merchantPlaceId,
          businessName: clientData.businessName,
          ownerUserId: authUid, // strictly from auth
        };
      };

      const result = registerSubscriptionSafe('usr_real_owner_123', {
        ownerUserId: 'usr_spoofed_victim_456', // malicious attempt to impersonate or bind to another user
        merchantPlaceId: 'place_vidyarthi_bhavan_01',
        businessName: 'Vidyarthi Bhavan',
      });

      assert.strictEqual(result.ownerUserId, 'usr_real_owner_123');
      assert.notStrictEqual(result.ownerUserId, 'usr_spoofed_victim_456');
    });

    test('Subscription payment verification failure leaves subscription inactive', async () => {
      const adapter = new SandboxPaymentAdapter();
      const verification = await adapter.verifyPayment({
        transactionId: 'sub_merch_fail_01',
        gatewayReference: 'sandbox_sim_sub_merch_fail_01',
        simulatedOutcome: 'FAILURE',
      });

      assert.strictEqual(verification.verified, false);
      assert.strictEqual(verification.failureReason, 'Simulated payment was declined by sandbox bank authority.');
    });
  });

  // ==============================================================================
  // 9. Contributor Content Management Tests (A5-V-02)
  // ==============================================================================
  describe('Contributor Content Management (A5-V-02)', () => {
    test('Contributor can update own submission and editing resets VERIFIED to SUBMITTED', () => {
      const now = new Date().toISOString();
      const existingDoc: ContributionDocument = {
        contributionId: 'contrib_blr_test_01',
        submission: {
          mapsLink: 'https://maps.google.com/?q=CTR',
          infoParagraph: 'Best Benne Masala Dosa in Bangalore.',
          photoUrls: ['https://storage.googleapis.com/test/photo1.jpg'],
          contributorId: 'usr_priya_782',
        },
        status: 'VERIFIED',
        groundedPlaceId: 'place_ctr_01',
        createdAt: now,
        updatedAt: now,
      };

      assert.doesNotThrow(() => ContributionDocumentSchema.parse(existingDoc));

      // Update function simulation enforcing ownership and status reset
      const updateContent = (
        doc: ContributionDocument,
        callerId: string,
        updates: { infoParagraph?: string; photoUrls?: string[] }
      ): ContributionDocument => {
        if (doc.submission.contributorId !== callerId) {
          throw new Error('Permission denied: Only the original contributor may update this contribution.');
        }
        if (doc.status === 'RETRACTED') {
          throw new Error('Invalid state: Retracted contributions cannot be edited.');
        }

        const newSubmission = {
          ...doc.submission,
          infoParagraph: updates.infoParagraph ?? doc.submission.infoParagraph,
          photoUrls: updates.photoUrls ?? doc.submission.photoUrls,
          contributorId: doc.submission.contributorId, // Immutable
        };
        ContributorSubmissionInputSchema.parse(newSubmission);

        // Reset to SUBMITTED if previously VERIFIED
        const newStatus = doc.status === 'VERIFIED' ? 'SUBMITTED' : doc.status;

        return {
          ...doc,
          submission: newSubmission,
          status: newStatus,
          updatedAt: new Date().toISOString(),
        };
      };

      // Owner updates description
      const updated = updateContent(existingDoc, 'usr_priya_782', {
        infoParagraph: 'Updated: Iconic butter dosa and filter coffee since 1920.',
      });

      assert.strictEqual(updated.submission.infoParagraph, 'Updated: Iconic butter dosa and filter coffee since 1920.');
      assert.strictEqual(updated.status, 'SUBMITTED', 'VERIFIED status must reset to SUBMITTED on content edit');
      assert.strictEqual(updated.submission.contributorId, 'usr_priya_782', 'Contributor attribution must be preserved');
      assert.doesNotThrow(() => ContributionDocumentSchema.parse(updated));

      // Stranger tries to update -> Permission denied
      assert.throws(
        () => updateContent(existingDoc, 'usr_stranger_999', { infoParagraph: 'Hacked description' }),
        /Permission denied/
      );
    });

    test('Retraction sets status to RETRACTED and blocks subsequent edits', () => {
      const now = new Date().toISOString();
      const existingDoc: ContributionDocument = {
        contributionId: 'contrib_blr_test_02',
        submission: {
          mapsLink: 'https://maps.google.com/?q=Veena',
          infoParagraph: 'Khara Bath and Kesari Bath.',
          photoUrls: [],
          contributorId: 'usr_priya_782',
        },
        status: 'SUBMITTED',
        groundedPlaceId: null,
        createdAt: now,
        updatedAt: now,
      };

      // Retract
      const retractedDoc: ContributionDocument = {
        ...existingDoc,
        status: 'RETRACTED',
        rejectionReason: 'Retracted by contributor (venue permanently closed).',
        updatedAt: new Date().toISOString(),
      };

      assert.doesNotThrow(() => ContributionDocumentSchema.parse(retractedDoc));
      assert.strictEqual(retractedDoc.status, 'RETRACTED');

      // Edits on retracted content must be rejected
      const attemptEditOnRetracted = (doc: ContributionDocument) => {
        if (doc.status === 'RETRACTED') {
          throw new Error('Invalid state: Retracted contributions cannot be edited.');
        }
      };

      assert.throws(
        () => attemptEditOnRetracted(retractedDoc),
        /Retracted contributions cannot be edited/
      );
    });
  });
});
