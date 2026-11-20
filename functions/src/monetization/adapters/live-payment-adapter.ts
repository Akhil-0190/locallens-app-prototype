/**
 * Live Production Payment Gateway Adapter (Razorpay Live Provider)
 * Task A6 — Release-Readiness Preparation & Live Payment Completion
 *
 * Implements actual Razorpay REST API order creation, payment verification,
 * and refund processing with strict fail-closed semantics, HMAC-SHA256 signature
 * validation, and remote payment status confirmation.
 */

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
import { createHmac } from 'node:crypto';
import { db } from '../../config/firebase.js';

export interface RazorpayOrderResponse {
  id: string;
  entity: string;
  amount: number;
  amount_paid: number;
  amount_due: number;
  currency: string;
  receipt?: string;
  status: string;
  created_at: number;
  error?: {
    code: string;
    description: string;
    source?: string;
    step?: string;
    reason?: string;
  };
}

export interface RazorpayPaymentResponse {
  id: string;
  entity: string;
  amount: number;
  currency: string;
  status: 'created' | 'authorized' | 'captured' | 'refunded' | 'failed';
  order_id: string;
  invoice_id?: string | null;
  international: boolean;
  method: string;
  amount_refunded: number;
  refund_status?: string | null;
  captured: boolean;
  description?: string;
  error_code?: string | null;
  error_description?: string | null;
  error_reason?: string | null;
}

export interface RazorpayRefundResponse {
  id: string;
  entity: string;
  amount: number;
  currency: string;
  payment_id: string;
  receipt?: string;
  status: 'processed' | 'pending' | 'failed';
  created_at: number;
}

export interface CanonicalTransaction {
  transactionId: string;
  collectionName: string;
  payerUserId: string;
  amountInr: number;
  currency: string;
  type: 'tip' | 'pass' | 'subscription' | 'guidance';
  docData: Record<string, any>;
}

export interface LivePaymentGatewayAdapterOptions {
  customFetch?: typeof fetch;
  baseUrl?: string;
  transactionLookup?: (transactionId: string) => Promise<CanonicalTransaction | null>;
}

export class LivePaymentGatewayAdapter implements PaymentGatewayAdapter {
  private readonly mode: PaymentMode = 'LIVE';
  private readonly customFetch?: typeof fetch;
  private readonly customTransactionLookup?: (transactionId: string) => Promise<CanonicalTransaction | null>;
  private readonly baseUrl: string = 'https://api.razorpay.com/v1';

  constructor(options?: LivePaymentGatewayAdapterOptions) {
    this.customFetch = options?.customFetch;
    this.customTransactionLookup = options?.transactionLookup;
    if (options?.baseUrl) {
      this.baseUrl = options.baseUrl;
    }
  }

  public getMode(): PaymentMode {
    return this.mode;
  }

  /**
   * Resolves server-side Secret Manager credentials.
   * Fails closed if keys are unconfigured.
   */
  private getLiveCredentials(): { keyId: string; keySecret: string; webhookSecret?: string } {
    const keyId = process.env.RAZORPAY_KEY_ID?.trim();
    const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim();
    const webhookSecret = process.env.PAYMENT_WEBHOOK_SECRET?.trim();

    if (!keyId || !keySecret) {
      throw new Error(
        'Fail-closed: Production payment credentials (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET) are unconfigured. Live payment operations cannot execute.'
      );
    }

    return { keyId, keySecret, webhookSecret };
  }

  private getAuthHeader(keyId: string, keySecret: string): string {
    const authString = `${keyId}:${keySecret}`;
    return `Basic ${Buffer.from(authString).toString('base64')}`;
  }

  private getFetchFn(): typeof fetch {
    return this.customFetch || globalThis.fetch;
  }

  /**
   * Retrieves the canonical transaction document from Firestore to enforce
   * server-side ownership, amount, and currency verification.
   */
  public async getCanonicalTransaction(transactionId: string): Promise<CanonicalTransaction | null> {
    if (this.customTransactionLookup) {
      return this.customTransactionLookup(transactionId);
    }

    try {
      let collectionName = '';
      let type: 'tip' | 'pass' | 'subscription' | 'guidance' = 'tip';

      if (transactionId.startsWith('tip_')) {
        collectionName = 'tips';
        type = 'tip';
      } else if (transactionId.startsWith('pass_')) {
        collectionName = 'passes';
        type = 'pass';
      } else if (transactionId.startsWith('sub_')) {
        collectionName = 'subscriptions';
        type = 'subscription';
      } else if (transactionId.startsWith('guidance_')) {
        collectionName = 'guidance_bookings';
        type = 'guidance';
      } else {
        return null;
      }

      const snap = await db.collection(collectionName).doc(transactionId).get();
      if (!snap.exists) {
        return null;
      }

      const data = (snap.data() || {}) as Record<string, any>;
      let payerUserId = '';
      let amountInr = 0;
      const currency = data.currency || 'INR';

      switch (type) {
        case 'tip':
          payerUserId = data.payerUserId || '';
          amountInr = Number(data.amountInr || 0);
          break;
        case 'pass':
          payerUserId = data.userId || '';
          amountInr = Number(data.pricePaidInr || 0);
          break;
        case 'subscription':
          payerUserId = data.ownerUserId || data.merchantPlaceId || '';
          amountInr = data.subscriptionPlan === 'FEATURED_HERITAGE'
            ? 2499
            : (data.subscriptionPlan === 'VERIFIED_PARTNER' ? 999 : Number(data.priceInr || 0));
          break;
        case 'guidance':
          payerUserId = data.travelerUserId || '';
          amountInr = Number(data.priceInr || 0);
          break;
      }

      return {
        transactionId,
        collectionName,
        payerUserId,
        amountInr,
        currency,
        type,
        docData: data,
      };
    } catch {
      return null;
    }
  }

  /**
   * Creates an outbound Razorpay order via the official REST API (POST /v1/orders).
   */
  public async createPaymentIntent(
    params: CreatePaymentIntentParams
  ): Promise<PaymentIntentResult> {
    // 1. Strict input validation
    if (typeof params.amountInr !== 'number' || !Number.isFinite(params.amountInr) || params.amountInr <= 0) {
      throw new Error('Invalid payment amount: Amount must be a positive finite number.');
    }
    if (params.currency !== 'INR') {
      throw new Error(`Invalid currency: Razorpay live integration supports INR only (received: ${params.currency}).`);
    }

    // Ensure production payment credentials are configured (fail-closed)
    const credentials = this.getLiveCredentials();

    // 2. Canonical Transaction Verification & Client Amount Override Protection
    const canonical = await this.getCanonicalTransaction(params.transactionId);
    if (!canonical) {
      throw new Error(
        `Fail-closed: Missing canonical transaction record for '${params.transactionId}'. Orders cannot be created with unverified caller-supplied data.`
      );
    }

    // Caller Ownership Validation: Client caller must match canonical transaction payer
    if (params.payerUserId && canonical.payerUserId && params.payerUserId !== canonical.payerUserId) {
      throw new Error(
        `Unauthorized payment intent: Caller '${params.payerUserId}' does not match canonical transaction owner '${canonical.payerUserId}'.`
      );
    }
    // Client Amount Override Protection: Reject any attempt to supply a different amount than canonical record
    if (params.amountInr !== canonical.amountInr) {
      throw new Error(
        `Security violation: Client-supplied amount ₹${params.amountInr} does not match canonical transaction amount ₹${canonical.amountInr}. Client amount overrides are strictly rejected.`
      );
    }

    const amountToChargeInr = canonical.amountInr;
    const currencyToCharge = canonical.currency;
    const payerToCharge = canonical.payerUserId;

    // Razorpay amounts are in smallest currency sub-unit (paise). Minimum ₹1.00 = 100 paise.
    const amountPaise = Math.round(amountToChargeInr * 100);
    if (amountPaise < 100) {
      throw new Error('Invalid order amount: Minimum amount is ₹1.00 (100 paise).');
    }

    const fetchFn = this.getFetchFn();

    const orderPayload = {
      amount: amountPaise,
      currency: currencyToCharge,
      receipt: params.transactionId,
      notes: {
        transactionId: params.transactionId,
        payerUserId: payerToCharge,
        recipientUserId: params.recipientUserId || '',
        description: params.description || '',
        ...(params.metadata || {}),
      },
    };

    let orderResponse: RazorpayOrderResponse;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    timeoutId.unref?.();

    try {
      const response = await fetchFn(`${this.baseUrl}/orders`, {
        method: 'POST',
        headers: {
          'Authorization': this.getAuthHeader(credentials.keyId, credentials.keySecret),
          'Content-Type': 'application/json',
          'User-Agent': 'NeighborhoodGuide-Backend/1.0',
        },
        body: JSON.stringify(orderPayload),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorBody = (await response.json().catch(() => ({}))) as RazorpayOrderResponse;
        const errMsg = errorBody.error?.description || `HTTP ${response.status} ${response.statusText}`;
        throw new Error(`Razorpay order creation rejected by provider: ${errMsg}`);
      }

      orderResponse = (await response.json()) as RazorpayOrderResponse;
    } catch (err: unknown) {
      if ((err as Error)?.name === 'AbortError') {
        throw new Error('Razorpay provider order creation timed out after 15 seconds.');
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }

    const providerOrderId = orderResponse.id;
    if (!providerOrderId || !providerOrderId.startsWith('order_')) {
      throw new Error('Invalid response from payment provider: Missing valid provider order ID.');
    }

    // Persist provider order ID against the internal transaction document in Firestore
    await this.persistProviderOrderId(params.transactionId, providerOrderId);

    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    return {
      gatewayReference: providerOrderId,
      orderId: providerOrderId,
      paymentMode: this.mode,
      intentUrl: `https://api.razorpay.com/v1/checkout/${providerOrderId}?key_id=${credentials.keyId}`,
      expiresAt,
      isSimulated: false,
    };
  }

  /**
   * Verifies live payment evidence:
   * 1. Cryptographic HMAC-SHA256 signature verification.
   * 2. Remote provider verification via Razorpay REST API (GET /v1/payments/{payment_id}).
   * 3. Order ID, currency, and captured status verification.
   */
  public async verifyPayment(
    params: VerifyPaymentParams
  ): Promise<PaymentVerificationResult> {
    // 1. Strict prohibition of simulated outcomes in live mode
    if (params.simulatedOutcome !== undefined) {
      throw new Error(
        'Security violation: Simulated outcomes are strictly prohibited in LIVE payment mode.'
      );
    }

    // 2. Reject sandbox gateway references
    if (params.gatewayReference.startsWith('sandbox_sim_')) {
      return {
        verified: false,
        gatewayReference: params.gatewayReference,
        paymentMode: this.mode,
        amountInr: 0,
        feeInr: 0,
        netInr: 0,
        failureReason: 'Security violation: Sandbox reference cannot be verified in LIVE payment mode.',
        isSimulated: false,
      };
    }

    // 3. Ensure live credentials are configured
    const credentials = this.getLiveCredentials();

    // 4. Require genuine provider evidence
    if (!params.providerPaymentId || !params.providerSignature) {
      return {
        verified: false,
        gatewayReference: params.gatewayReference,
        paymentMode: this.mode,
        amountInr: 0,
        feeInr: 0,
        netInr: 0,
        failureReason: 'Missing verified provider evidence: providerPaymentId and providerSignature are required in LIVE mode.',
        isSimulated: false,
      };
    }

    // 5. Cryptographic signature verification:
    // Razorpay standard: HMAC-SHA256(order_id + "|" + payment_id, key_secret) === signature
    const signaturePayload = `${params.gatewayReference}|${params.providerPaymentId}`;
    const expectedSignature = createHmac('sha256', credentials.keySecret)
      .update(signaturePayload)
      .digest('hex');

    if (params.providerSignature !== expectedSignature) {
      return {
        verified: false,
        gatewayReference: params.gatewayReference,
        paymentMode: this.mode,
        amountInr: 0,
        feeInr: 0,
        netInr: 0,
        failureReason: 'Cryptographic signature verification failed for live payment confirmation.',
        isSimulated: false,
      };
    }

    // 6. Remote provider payment lookup (GET /v1/payments/{payment_id})
    const fetchFn = this.getFetchFn();
    let paymentData: RazorpayPaymentResponse;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    timeoutId.unref?.();

    try {
      const response = await fetchFn(`${this.baseUrl}/payments/${params.providerPaymentId}`, {
        method: 'GET',
        headers: {
          'Authorization': this.getAuthHeader(credentials.keyId, credentials.keySecret),
          'Accept': 'application/json',
          'User-Agent': 'NeighborhoodGuide-Backend/1.0',
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        return {
          verified: false,
          gatewayReference: params.gatewayReference,
          paymentMode: this.mode,
          amountInr: 0,
          feeInr: 0,
          netInr: 0,
          failureReason: `Remote payment lookup failed on provider with HTTP ${response.status}.`,
          isSimulated: false,
        };
      }

      paymentData = (await response.json()) as RazorpayPaymentResponse;
    } catch (err: unknown) {
      return {
        verified: false,
        gatewayReference: params.gatewayReference,
        paymentMode: this.mode,
        amountInr: 0,
        feeInr: 0,
        netInr: 0,
        failureReason: `Provider payment verification network error: ${(err as Error)?.message || 'Connection failed'}`,
        isSimulated: false,
      };
    } finally {
      clearTimeout(timeoutId);
    }

    // 7. Verify provider response consistency
    if (paymentData.order_id !== params.gatewayReference) {
      return {
        verified: false,
        gatewayReference: params.gatewayReference,
        paymentMode: this.mode,
        amountInr: 0,
        feeInr: 0,
        netInr: 0,
        failureReason: `Order ID mismatch: Expected ${params.gatewayReference}, provider reported ${paymentData.order_id}.`,
        isSimulated: false,
      };
    }

    if (paymentData.currency !== 'INR') {
      return {
        verified: false,
        gatewayReference: params.gatewayReference,
        paymentMode: this.mode,
        amountInr: 0,
        feeInr: 0,
        netInr: 0,
        failureReason: `Currency mismatch: Expected INR, provider reported ${paymentData.currency}.`,
        isSimulated: false,
      };
    }

    // 1. Explicit distinction between authorized and captured:
    // Authorized status represents a hold/authorization only. Settlement and activation strictly require captured status.
    if (paymentData.status === 'authorized') {
      return {
        verified: false,
        gatewayReference: params.gatewayReference,
        paymentMode: this.mode,
        amountInr: 0,
        feeInr: 0,
        netInr: 0,
        failureReason: 'Payment is authorized but not yet captured by banking provider; settlement requires captured status.',
        isSimulated: false,
      };
    }

    if (paymentData.status !== 'captured') {
      return {
        verified: false,
        gatewayReference: params.gatewayReference,
        paymentMode: this.mode,
        amountInr: 0,
        feeInr: 0,
        netInr: 0,
        failureReason: `Payment status is not captured (provider status: ${paymentData.status}).`,
        isSimulated: false,
      };
    }

    const verifiedAmountInr = paymentData.amount / 100;

    // 2. Amount and order binding verification: Compare provider data against canonical transaction stored in Firestore
    const canonical = await this.getCanonicalTransaction(params.transactionId);
    if (!canonical) {
      return {
        verified: false,
        gatewayReference: params.gatewayReference,
        paymentMode: this.mode,
        amountInr: 0,
        feeInr: 0,
        netInr: 0,
        failureReason: `Fail-closed: Missing canonical transaction record for '${params.transactionId}'. Payment cannot be verified without stored transaction reference.`,
        isSimulated: false,
      };
    }

    // Verify provider order ID binding against the stored canonical transaction
    const storedOrderId = canonical.docData.paymentGatewayReference || canonical.docData.providerOrderId;
    if (!storedOrderId) {
      return {
        verified: false,
        gatewayReference: params.gatewayReference,
        paymentMode: this.mode,
        amountInr: 0,
        feeInr: 0,
        netInr: 0,
        failureReason: `Order binding missing: Canonical transaction '${params.transactionId}' does not have a recorded provider order ID. Payment cannot be verified without stored order binding.`,
        isSimulated: false,
      };
    }

    if (storedOrderId !== paymentData.order_id) {
      return {
        verified: false,
        gatewayReference: params.gatewayReference,
        paymentMode: this.mode,
        amountInr: 0,
        feeInr: 0,
        netInr: 0,
        failureReason: `Order binding mismatch: Canonical transaction '${params.transactionId}' is bound to provider order '${storedOrderId}', but payment is associated with '${paymentData.order_id}'. Cross-transaction payment substitution is rejected.`,
        isSimulated: false,
      };
    }

    if (canonical.currency !== paymentData.currency) {
      return {
        verified: false,
        gatewayReference: params.gatewayReference,
        paymentMode: this.mode,
        amountInr: 0,
        feeInr: 0,
        netInr: 0,
        failureReason: `Currency mismatch: Canonical transaction requires '${canonical.currency}', but provider reported '${paymentData.currency}'.`,
        isSimulated: false,
      };
    }

    if (canonical.amountInr !== verifiedAmountInr) {
      return {
        verified: false,
        gatewayReference: params.gatewayReference,
        paymentMode: this.mode,
        amountInr: 0,
        feeInr: 0,
        netInr: 0,
        failureReason: `Transaction amount mismatch: Stored canonical transaction requires ₹${canonical.amountInr}, but provider reported ₹${verifiedAmountInr}.`,
        isSimulated: false,
      };
    }

    return {
      verified: true,
      gatewayReference: params.gatewayReference,
      paymentMode: this.mode,
      amountInr: verifiedAmountInr,
      feeInr: 0,
      netInr: verifiedAmountInr,
      settledAt: new Date().toISOString(),
      isSimulated: false,
    };
  }

  /**
   * Processes live payment refund via REST API (POST /v1/payments/{payment_id}/refund).
   */
  public async refundPayment(
    params: RefundPaymentParams
  ): Promise<PaymentRefundResult> {
    if (!params.idempotencyKey || !params.idempotencyKey.trim()) {
      throw new Error('Idempotency key is strictly required for live refunds (fail-closed).');
    }
    if (typeof params.amountInr !== 'number' || params.amountInr <= 0) {
      throw new Error('Refund amount must be a positive number.');
    }

    const credentials = this.getLiveCredentials();
    const fetchFn = this.getFetchFn();

    const refundPayload = {
      amount: Math.round(params.amountInr * 100),
      receipt: params.idempotencyKey,
      notes: {
        transactionId: params.transactionId,
        idempotencyKey: params.idempotencyKey,
        reason: params.reason || 'User requested refund',
      },
    };

    try {
      const response = await fetchFn(`${this.baseUrl}/payments/${params.gatewayReference}/refund`, {
        method: 'POST',
        headers: {
          'Authorization': this.getAuthHeader(credentials.keyId, credentials.keySecret),
          'Content-Type': 'application/json',
          'User-Agent': 'NeighborhoodGuide-Backend/1.0',
        },
        body: JSON.stringify(refundPayload),
      });

      if (!response.ok) {
        const errorBody = (await response.json().catch(() => ({}))) as RazorpayOrderResponse;
        const msg = errorBody.error?.description || `HTTP ${response.status}`;
        return {
          refunded: false,
          refundReference: `failed_refund_${params.idempotencyKey}`,
          paymentMode: this.mode,
          amountInr: params.amountInr,
          failureReason: `Provider refund rejected: ${msg}`,
          isSimulated: false,
        };
      }

      const refundData = (await response.json()) as RazorpayRefundResponse;

      // 5. Refund correctness: Do not mark refund completed if status is pending
      if (refundData.status === 'pending') {
        return {
          refunded: false,
          refundReference: refundData.id,
          paymentMode: this.mode,
          amountInr: refundData.amount / 100,
          failureReason: 'Refund accepted by provider but is currently pending bank processing. Final settlement requires refund.processed confirmation.',
          isSimulated: false,
        };
      }

      if (refundData.status !== 'processed') {
        return {
          refunded: false,
          refundReference: refundData.id,
          paymentMode: this.mode,
          amountInr: refundData.amount / 100,
          failureReason: `Refund not completed: Provider reported status '${refundData.status}'.`,
          isSimulated: false,
        };
      }

      return {
        refunded: true,
        refundReference: refundData.id,
        paymentMode: this.mode,
        amountInr: refundData.amount / 100,
        refundedAt: new Date().toISOString(),
        isSimulated: false,
      };
    } catch (err: unknown) {
      return {
        refunded: false,
        refundReference: `failed_refund_${params.idempotencyKey}`,
        paymentMode: this.mode,
        amountInr: params.amountInr,
        failureReason: `Provider refund network error: ${(err as Error)?.message || 'Connection failed'}`,
        isSimulated: false,
      };
    }
  }

  /**
   * Helper to persist provider order ID against the internal transaction document.
   */
  private async persistProviderOrderId(transactionId: string, providerOrderId: string): Promise<void> {
    try {
      let collectionName = '';
      if (transactionId.startsWith('tip_')) collectionName = 'tips';
      else if (transactionId.startsWith('pass_')) collectionName = 'passes';
      else if (transactionId.startsWith('sub_')) collectionName = 'subscriptions';
      else if (transactionId.startsWith('guidance_')) collectionName = 'guidance_bookings';

      if (!collectionName) return;

      const docRef = db.collection(collectionName).doc(transactionId);
      const snap = await docRef.get();
      if (snap.exists) {
        await docRef.update({
          providerOrderId,
          paymentGatewayReference: providerOrderId,
          paymentMode: 'LIVE',
          updatedAt: new Date().toISOString(),
        });
      }
    } catch {
      // Non-blocking if doc doesn't exist yet (e.g. before initial set)
    }
  }
}
