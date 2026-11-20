/**
 * Tipping & Reward Settlement Service
 * Task A5 — Contributor Ecosystem & Monetization Backend
 *
 * Implements micro-tipping transactions, payment verification, idempotent settlement,
 * server-side production environment guards, and strict reward ledger invariant enforcement.
 */

import { randomUUID } from 'node:crypto';
import { db } from '../../config/firebase.js';
import {
  ContributorTipDocument,
  ContributorTipDocumentSchema,
  ContributorRewardLedger,
  ContributorRewardLedgerSchema,
} from '../../types/contracts/index.js';
import {
  PaymentGatewayAdapter,
  PaymentIntentResult,
} from '../adapters/payment-gateway-adapter.js';
import { defaultPaymentAdapter } from '../adapters/sandbox-payment-adapter.js';
import { validateSettlementEnvironment } from '../config/payment-environment.js';

export function isProductionEnvironment(): boolean {
  return (
    process.env.NODE_ENV === 'production' ||
    process.env.PAYMENT_ENV === 'production' ||
    process.env.PAYMENT_ENV === 'LIVE' ||
    Boolean(process.env.K_SERVICE || process.env.FUNCTION_TARGET || process.env.FIREBASE_CONFIG)
  );
}

export interface InitiateTipInput {
  payerUserId: string;
  recipientUserId: string;
  spotId: string;
  spotName: string;
  amountInr: number;
  personalNote?: string;
}

export interface InitiateTipOutput {
  tip: ContributorTipDocument;
  paymentIntent: PaymentIntentResult;
}

export interface SettleTipInput {
  tipId: string;
  callerUserId: string;
  simulatedOutcome?: 'SUCCESS' | 'FAILURE';
  isAdminOverride?: boolean;
}

export interface SettleTipOutput {
  tip: ContributorTipDocument;
  rewardLedger: ContributorRewardLedger;
  isIdempotentReplay: boolean;
}

export interface RefundTipInput {
  tipId: string;
  callerUserId: string;
  isAdminOverride?: boolean;
  reason?: string;
}

export interface RefundTipOutput {
  tip: ContributorTipDocument;
  rewardLedger: ContributorRewardLedger;
}

export function calculateGuidanceRank(points: number): string {
  if (points >= 1000) return 'Malleshwaram Heritage Legend';
  if (points >= 500) return 'Malleshwaram Heritage Master';
  if (points >= 200) return 'Community Pillar';
  if (points >= 50) return 'Neighborhood Scout';
  return 'Local Resident';
}

export class TippingService {
  constructor(private readonly paymentAdapter: PaymentGatewayAdapter = defaultPaymentAdapter) {}

  /**
   * Initiates a micro-tip with calculated platform fees and intent generation.
   */
  public async initiateTip(input: InitiateTipInput): Promise<InitiateTipOutput> {
    if (input.payerUserId === input.recipientUserId) {
      throw new Error('Self-tipping is strictly prohibited.');
    }

    if (input.amountInr < 10 || input.amountInr > 5000) {
      throw new Error('Tip amount must be between ₹10 and ₹5,000.');
    }

    // Platform fee: 5%, minimum ₹5
    const platformFeeInr = Math.max(5, Math.round(input.amountInr * 0.05));
    const contributorNetInr = input.amountInr - platformFeeInr;

    if (contributorNetInr <= 0) {
      throw new Error('Contributor net amount must be strictly greater than zero.');
    }

    const tipId = `tip_blr_${Date.now()}_${randomUUID().slice(0, 6)}`;
    const now = new Date().toISOString();

    const paymentIntent = await this.paymentAdapter.createPaymentIntent({
      transactionId: tipId,
      payerUserId: input.payerUserId,
      recipientUserId: input.recipientUserId,
      amountInr: input.amountInr,
      currency: 'INR',
      description: `Tip for ${input.spotName}`,
      metadata: {
        spotId: input.spotId,
        spotName: input.spotName,
      },
    });

    const tipDocument: ContributorTipDocument = {
      tipId,
      payerUserId: input.payerUserId,
      recipientUserId: input.recipientUserId,
      spotId: input.spotId,
      spotName: input.spotName,
      amountInr: input.amountInr,
      platformFeeInr,
      contributorNetInr,
      currency: 'INR',
      paymentMode: this.paymentAdapter.getMode(),
      paymentStatus: 'INITIATED',
      paymentGatewayReference: paymentIntent.gatewayReference,
      personalNote: input.personalNote,
      createdAt: now,
    };

    // Strict contract validation
    ContributorTipDocumentSchema.parse(tipDocument);

    // Save initial transaction
    await db.collection('tips').doc(tipId).set(tipDocument);

    return {
      tip: tipDocument,
      paymentIntent,
    };
  }

  /**
   * Settles a tip transactionally with strict idempotency and ledger invariant preservation.
   */
  public async settleTip(input: SettleTipInput): Promise<SettleTipOutput> {
    const tipRef = db.collection('tips').doc(input.tipId);

    // Step 1: Pre-check tip existence outside transaction for fast feedback
    const tipSnap = await tipRef.get();
    if (!tipSnap.exists) {
      throw new Error(`Tip document ${input.tipId} not found.`);
    }

    const tipData = tipSnap.data() as ContributorTipDocument;

    // Authorization: Only payer or admin can trigger settlement
    if (tipData.payerUserId !== input.callerUserId && !input.isAdminOverride) {
      throw new Error('Unauthorized: Only the payer or administrator may settle this tip.');
    }

    // Fail-Closed Server Environment Configuration Guard
    validateSettlementEnvironment({
      transactionPaymentMode: tipData.paymentMode,
      isSimulationRequested: input.simulatedOutcome !== undefined,
    });

    // Step 2: Idempotency check — if already completed, return existing data without re-crediting
    if (tipData.paymentStatus === 'COMPLETED') {
      const ledgerSnap = await db.collection('contributor_rewards').doc(tipData.recipientUserId).get();
      const existingLedger = ledgerSnap.exists
        ? (ledgerSnap.data() as ContributorRewardLedger)
        : this.createEmptyLedger(tipData.recipientUserId);

      return {
        tip: tipData,
        rewardLedger: existingLedger,
        isIdempotentReplay: true,
      };
    }

    if (tipData.paymentStatus === 'FAILED') {
      throw new Error('Cannot settle a tip that has previously failed.');
    }

    // Step 3: Verify confirmation from configured payment adapter
    const verification = await this.paymentAdapter.verifyPayment({
      transactionId: input.tipId,
      gatewayReference: tipData.paymentGatewayReference || '',
      simulatedOutcome: input.simulatedOutcome,
    });

    if (!verification.verified) {
      // Mark as FAILED on verification rejection
      await tipRef.update({
        paymentStatus: 'FAILED',
        settledAt: new Date().toISOString(),
      });
      throw new Error(`Payment verification failed: ${verification.failureReason || 'Declined'}`);
    }

    // Step 4: Atomic Firestore Transaction enforcing ledger invariants
    const rewardRef = db.collection('contributor_rewards').doc(tipData.recipientUserId);

    const result = await db.runTransaction(async (transaction) => {
      const liveTipSnap = await transaction.get(tipRef);
      if (!liveTipSnap.exists) throw new Error('Tip document not found during transaction.');
      const currentTip = liveTipSnap.data() as ContributorTipDocument;

      // Double-check idempotency inside transaction lock
      if (currentTip.paymentStatus === 'COMPLETED') {
        const liveLedgerSnap = await transaction.get(rewardRef);
        return {
          tip: currentTip,
          rewardLedger: liveLedgerSnap.data() as ContributorRewardLedger,
          isIdempotentReplay: true,
        };
      }

      const now = new Date().toISOString();
      const updatedTip: ContributorTipDocument = {
        ...currentTip,
        paymentStatus: 'COMPLETED',
        settledAt: now,
      };

      const ledgerSnap = await transaction.get(rewardRef);
      let ledger: ContributorRewardLedger;

      if (!ledgerSnap.exists) {
        const repPoints = Math.floor(currentTip.amountInr / 10);
        ledger = {
          userId: currentTip.recipientUserId,
          totalEarningsInr: currentTip.contributorNetInr,
          availableBalanceInr: currentTip.contributorNetInr,
          withdrawnTotalInr: 0,
          unrecoveredAdjustmentInr: 0,
          reputationPoints: repPoints,
          guidanceRank: calculateGuidanceRank(repPoints),
          updatedAt: now,
        };
      } else {
        const existing = ledgerSnap.data() as ContributorRewardLedger;
        const currentUnrecovered = existing.unrecoveredAdjustmentInr || 0;
        let debtRecovery = 0;
        let netToAdd = currentTip.contributorNetInr;

        // If contributor owes clawback from prior refunds, offset debt first
        if (currentUnrecovered > 0) {
          debtRecovery = Math.min(currentUnrecovered, netToAdd);
          netToAdd -= debtRecovery;
        }

        const newTotal = existing.totalEarningsInr + currentTip.contributorNetInr;
        const newAvailable = existing.availableBalanceInr + netToAdd;
        const newUnrecovered = currentUnrecovered - debtRecovery;
        const newRepPoints = existing.reputationPoints + Math.floor(currentTip.amountInr / 10);

        ledger = {
          ...existing,
          totalEarningsInr: newTotal,
          availableBalanceInr: newAvailable,
          unrecoveredAdjustmentInr: newUnrecovered,
          reputationPoints: newRepPoints,
          guidanceRank: calculateGuidanceRank(newRepPoints),
          updatedAt: now,
        };
      }

      // Strict Invariant Enforcement: totalEarnings + unrecoveredAdjustment === availableBalance + withdrawnTotal
      if (ledger.availableBalanceInr < 0) {
        throw new Error('Accounting invariant violated: availableBalanceInr cannot be negative.');
      }
      if (ledger.totalEarningsInr + ledger.unrecoveredAdjustmentInr !== ledger.availableBalanceInr + ledger.withdrawnTotalInr) {
        throw new Error('Accounting invariant violated: totalEarnings + unrecoveredAdjustment must equal availableBalance + withdrawnTotal.');
      }

      ContributorRewardLedgerSchema.parse(ledger);

      transaction.set(tipRef, updatedTip);
      transaction.set(rewardRef, ledger);

      return {
        tip: updatedTip,
        rewardLedger: ledger,
        isIdempotentReplay: false,
      };
    });

    return result;
  }

  /**
   * Reverses/refunds a tip, maintaining mathematical ledger invariants even if funds were already withdrawn.
   */
  public async refundTip(input: RefundTipInput): Promise<RefundTipOutput> {
    const tipRef = db.collection('tips').doc(input.tipId);
    const tipSnap = await tipRef.get();
    if (!tipSnap.exists) {
      throw new Error(`Tip document ${input.tipId} not found.`);
    }

    const tipData = tipSnap.data() as ContributorTipDocument;

    if (!input.isAdminOverride && input.callerUserId !== tipData.payerUserId) {
      throw new Error('Unauthorized: Only an administrator or the original payer can request a refund.');
    }

    if (tipData.paymentStatus !== 'COMPLETED') {
      throw new Error(`Cannot refund tip in status ${tipData.paymentStatus}. Must be COMPLETED.`);
    }

    const rewardRef = db.collection('contributor_rewards').doc(tipData.recipientUserId);

    const result = await db.runTransaction(async (transaction) => {
      const liveTipSnap = await transaction.get(tipRef);
      if (!liveTipSnap.exists) throw new Error('Tip document not found.');
      const currentTip = liveTipSnap.data() as ContributorTipDocument;

      if (currentTip.paymentStatus === 'FAILED') {
        throw new Error('Tip has already been refunded or failed.');
      }

      const ledgerSnap = await transaction.get(rewardRef);
      if (!ledgerSnap.exists) throw new Error('Recipient reward ledger not found.');
      const existing = ledgerSnap.data() as ContributorRewardLedger;

      // Handle deduction:
      // If availableBalance >= net: deduct from availableBalance
      // If availableBalance < net: availableBalance drops to 0, remaining delta becomes unrecoveredAdjustmentInr
      const available = existing.availableBalanceInr;
      const netToClawback = currentTip.contributorNetInr;
      const recoveredFromAvailable = Math.min(available, netToClawback);
      const clawbackDebt = netToClawback - recoveredFromAvailable;

      const newAvailable = available - recoveredFromAvailable;
      const newTotal = existing.totalEarningsInr - netToClawback;
      const newUnrecovered = (existing.unrecoveredAdjustmentInr || 0) + clawbackDebt;
      const now = new Date().toISOString();

      const updatedLedger: ContributorRewardLedger = {
        ...existing,
        totalEarningsInr: newTotal,
        availableBalanceInr: newAvailable,
        unrecoveredAdjustmentInr: newUnrecovered,
        updatedAt: now,
      };

      // Strict Invariant Enforcement
      if (updatedLedger.availableBalanceInr < 0) {
        throw new Error('Accounting invariant violated: availableBalanceInr cannot be negative.');
      }
      if (updatedLedger.totalEarningsInr + updatedLedger.unrecoveredAdjustmentInr !== updatedLedger.availableBalanceInr + updatedLedger.withdrawnTotalInr) {
        throw new Error('Accounting invariant violated: totalEarnings + unrecoveredAdjustment must equal availableBalance + withdrawnTotal.');
      }

      ContributorRewardLedgerSchema.parse(updatedLedger);

      const updatedTip: ContributorTipDocument = {
        ...currentTip,
        paymentStatus: 'FAILED',
        settledAt: now,
      };

      transaction.set(tipRef, updatedTip);
      transaction.set(rewardRef, updatedLedger);

      return {
        tip: updatedTip,
        rewardLedger: updatedLedger,
      };
    });

    return result;
  }

  /**
   * Retrieves a contributor's reward ledger.
   */
  public async getRewardLedger(userId: string): Promise<ContributorRewardLedger> {
    const snap = await db.collection('contributor_rewards').doc(userId).get();
    if (!snap.exists) {
      return this.createEmptyLedger(userId);
    }
    return snap.data() as ContributorRewardLedger;
  }

  private createEmptyLedger(userId: string): ContributorRewardLedger {
    return {
      userId,
      totalEarningsInr: 0,
      availableBalanceInr: 0,
      withdrawnTotalInr: 0,
      unrecoveredAdjustmentInr: 0,
      reputationPoints: 0,
      guidanceRank: 'Local Resident',
      updatedAt: new Date().toISOString(),
    };
  }
}
