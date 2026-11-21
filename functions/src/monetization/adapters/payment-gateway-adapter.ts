/**
 * Payment Gateway Adapter Interface
 * Task A5 — Contributor Ecosystem & Monetization Backend
 *
 * Provides a strict contract isolating payment gateway interactions (intents,
 * verification, signatures) from core business logic.
 */

import { PaymentMode } from '../../types/contracts/index.js';

export interface CreatePaymentIntentParams {
  transactionId: string;
  payerUserId: string;
  recipientUserId?: string;
  amountInr: number;
  currency: string;
  description: string;
  metadata?: Record<string, string>;
}

export interface PaymentIntentResult {
  gatewayReference: string; // Genuine Razorpay order_id (e.g. 'order_...')
  orderId?: string; // Direct provider order ID for mobile Checkout SDK
  paymentMode: PaymentMode;
  intentUrl?: string;
  qrPayload?: string;
  expiresAt: string;
  isSimulated: boolean;
}

export interface VerifyPaymentParams {
  transactionId: string;
  gatewayReference: string;
  simulatedOutcome?: 'SUCCESS' | 'FAILURE';
  providerPaymentId?: string;
  providerSignature?: string;
  webhookPayload?: Record<string, unknown>;
  webhookSignature?: string;
}

export interface PaymentVerificationResult {
  verified: boolean;
  gatewayReference: string;
  paymentMode: PaymentMode;
  amountInr: number;
  feeInr: number;
  netInr: number;
  settledAt?: string;
  failureReason?: string;
  isSimulated: boolean;
}

export interface RefundPaymentParams {
  transactionId: string;
  gatewayReference: string;
  amountInr: number;
  reason?: string;
  idempotencyKey?: string;
}

export interface PaymentRefundResult {
  refunded: boolean;
  refundReference: string;
  paymentMode: PaymentMode;
  amountInr: number;
  refundedAt?: string;
  failureReason?: string;
  isSimulated: boolean;
}

export interface PaymentGatewayAdapter {
  getMode(): PaymentMode;
  createPaymentIntent(params: CreatePaymentIntentParams): Promise<PaymentIntentResult>;
  verifyPayment(params: VerifyPaymentParams): Promise<PaymentVerificationResult>;
  refundPayment(params: RefundPaymentParams): Promise<PaymentRefundResult>;
}
