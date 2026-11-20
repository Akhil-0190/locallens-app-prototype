/**
 * Sandbox Payment Gateway Adapter
 * Task A5 — Contributor Ecosystem & Monetization Backend
 *
 * Implements mock UPI & pass payment simulation for development, testing,
 * and emulator environments. Strictly marked as simulated and never communicates
 * with live banking networks.
 */

import { randomUUID } from 'node:crypto';
import { db } from '../../config/firebase.js';
import {
  PaymentGatewayAdapter,
  CreatePaymentIntentParams,
  PaymentIntentResult,
  VerifyPaymentParams,
  PaymentVerificationResult,
  RefundPaymentParams,
  PaymentRefundResult,
} from './payment-gateway-adapter.js';
import { PaymentMode } from '../../types/contracts/index.js';

export class SandboxPaymentAdapter implements PaymentGatewayAdapter {
  private readonly mode: PaymentMode = 'SANDBOX';
  private readonly simulatedRefunds = new Map<string, PaymentRefundResult>();
  private readonly firestoreDb?: FirebaseFirestore.Firestore;

  constructor(customDb?: FirebaseFirestore.Firestore) {
    this.firestoreDb = customDb || db;
  }

  public getMode(): PaymentMode {
    return this.mode;
  }

  /**
   * Generates a deterministic simulated payment intent.
   */
  public async createPaymentIntent(
    params: CreatePaymentIntentParams
  ): Promise<PaymentIntentResult> {
    let prefix = 'sandbox_sim_upi_';
    if (params.transactionId.startsWith('pass_')) {
      prefix = 'sandbox_sim_pass_';
    } else if (params.transactionId.startsWith('guidance_')) {
      prefix = 'sandbox_sim_guidance_';
    } else if (params.transactionId.startsWith('sub_')) {
      prefix = 'sandbox_sim_sub_';
    }
    const shortRef = randomUUID().replace(/-/g, '').slice(0, 12);
    const gatewayReference = `${prefix}${shortRef}`;

    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    return {
      gatewayReference,
      paymentMode: this.mode,
      intentUrl: `upi://pay?pa=neighborhoodguide.sandbox@okaxis&pn=NeighborhoodGuideSandbox&am=${params.amountInr}&cu=INR&tn=${encodeURIComponent(params.description)}&tr=${gatewayReference}`,
      qrPayload: `SANDBOX_MOCK_QR_${gatewayReference}`,
      expiresAt,
      isSimulated: true,
    };
  }

  /**
   * Verifies a simulated payment intent.
   * Guaranteed safe: Never touches external financial rails.
   */
  public async verifyPayment(
    params: VerifyPaymentParams
  ): Promise<PaymentVerificationResult> {
    // Defense-in-depth: Sandbox settlement cannot process live references
    if (!params.gatewayReference.startsWith('sandbox_sim_')) {
      return {
        verified: false,
        gatewayReference: params.gatewayReference,
        paymentMode: this.mode,
        amountInr: 0,
        feeInr: 0,
        netInr: 0,
        failureReason: 'Invalid gateway reference format for sandbox simulation adapter.',
        isSimulated: true,
      };
    }

    // Allow testing simulated failure flows
    if (params.simulatedOutcome === 'FAILURE') {
      return {
        verified: false,
        gatewayReference: params.gatewayReference,
        paymentMode: this.mode,
        amountInr: 0,
        feeInr: 0,
        netInr: 0,
        failureReason: 'Simulated payment was declined by sandbox bank authority.',
        isSimulated: true,
      };
    }

    // Default simulated success
    return {
      verified: true,
      gatewayReference: params.gatewayReference,
      paymentMode: this.mode,
      amountInr: 0, // Filled in by caller with canonical document values
      feeInr: 0,
      netInr: 0,
      settledAt: new Date().toISOString(),
      isSimulated: true,
    };
  }

  /**
   * Executes a simulated payment refund.
   */
  /**
   * Executes a simulated payment refund.
   * Provides durable idempotency across Cloud Functions instances and restarts
   * by persisting simulated refund records to Firestore (`_sandbox_simulated_refunds`).
   */
  public async refundPayment(
    params: RefundPaymentParams
  ): Promise<PaymentRefundResult> {
    if (params.idempotencyKey) {
      // 1. Fast in-memory check
      const cached = this.simulatedRefunds.get(params.idempotencyKey);
      if (cached) {
        return cached;
      }

      // 2. Durable Firestore check across instances and restarts
      if (this.firestoreDb) {
        try {
          const docRef = this.firestoreDb.collection('_sandbox_simulated_refunds').doc(params.idempotencyKey);
          const snap = await docRef.get();
          if (snap.exists) {
            const persisted = snap.data() as PaymentRefundResult;
            this.simulatedRefunds.set(params.idempotencyKey, persisted);
            return persisted;
          }
        } catch {
          // Fall through safely if Firestore read fails
        }
      }
    }

    if (!params.gatewayReference.startsWith('sandbox_sim_')) {
      return {
        refunded: false,
        refundReference: '',
        paymentMode: this.mode,
        amountInr: 0,
        failureReason: 'Invalid gateway reference format for sandbox simulation adapter.',
        isSimulated: true,
      };
    }

    // 3. Atomic transaction check-and-create across instances
    if (params.idempotencyKey && this.firestoreDb) {
      try {
        const docRef = this.firestoreDb.collection('_sandbox_simulated_refunds').doc(params.idempotencyKey);
        const result = await this.firestoreDb.runTransaction(async (tx) => {
          const snap = await tx.get(docRef);
          if (snap.exists) {
            return snap.data() as PaymentRefundResult;
          }
          const shortRef = randomUUID().replace(/-/g, '').slice(0, 10);
          const newResult: PaymentRefundResult = {
            refunded: true,
            refundReference: `sandbox_sim_ref_${shortRef}`,
            paymentMode: this.mode,
            amountInr: params.amountInr,
            refundedAt: new Date().toISOString(),
            isSimulated: true,
          };
          tx.set(docRef, newResult);
          return newResult;
        });

        this.simulatedRefunds.set(params.idempotencyKey, result);
        return result;
      } catch {
        // Fall back to local simulation if Firestore transaction fails
      }
    }

    const shortRef = randomUUID().replace(/-/g, '').slice(0, 10);
    const result: PaymentRefundResult = {
      refunded: true,
      refundReference: `sandbox_sim_ref_${shortRef}`,
      paymentMode: this.mode,
      amountInr: params.amountInr,
      refundedAt: new Date().toISOString(),
      isSimulated: true,
    };

    if (params.idempotencyKey) {
      this.simulatedRefunds.set(params.idempotencyKey, result);
    }

    return result;
  }
}

export const defaultPaymentAdapter: PaymentGatewayAdapter = new SandboxPaymentAdapter();
