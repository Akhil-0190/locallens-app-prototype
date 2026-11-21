/**
 * Payment Adapter Factory
 * Task A6 — Release-Readiness Preparation
 *
 * Selects the appropriate payment gateway adapter based on server configuration.
 * Strictly guarantees fail-closed behavior: production environments can never
 * silently fall back to sandbox mode.
 */

import { PaymentGatewayAdapter } from './payment-gateway-adapter.js';
import { SandboxPaymentAdapter } from './sandbox-payment-adapter.js';
import { LivePaymentGatewayAdapter } from './live-payment-adapter.js';

/**
 * Returns the appropriate payment adapter for the environment.
 * Enforces strict fail-closed boundaries:
 * - In LIVE mode: returns LivePaymentGatewayAdapter.
 * - In deployed cloud runtime (K_SERVICE, FUNCTION_TARGET) or production NODE_ENV:
 *   strictly rejects SANDBOX mode and rejects missing PAYMENT_ENV (fail-closed).
 * - In local development and testing: defaults to SandboxPaymentAdapter.
 */
export function getPaymentAdapter(customEnv?: string): PaymentGatewayAdapter {
  const env = (customEnv ?? process.env.PAYMENT_ENV ?? '').trim().toUpperCase();
  const rawNodeEnv = (process.env.NODE_ENV ?? '').trim().toLowerCase();
  const isCloudRuntime = Boolean(
    process.env.K_SERVICE || process.env.FUNCTION_TARGET
  );
  const isProduction = rawNodeEnv === 'production' || isCloudRuntime;

  // 1. Explicit LIVE mode
  if (env === 'LIVE') {
    return new LivePaymentGatewayAdapter();
  }

  // 2. Production or Cloud Runtime must FAIL CLOSED if not explicitly LIVE
  if (isProduction) {
    if (env === 'SANDBOX') {
      throw new Error(
        'Security violation: PAYMENT_ENV cannot be set to SANDBOX in deployed cloud runtime or production NODE_ENV (fail-closed).'
      );
    }
    throw new Error(
      'Fail-closed security check: Missing explicit PAYMENT_ENV configuration in deployed or production runtime.'
    );
  }

  // 3. Invalid custom value in non-production environment
  if (env && env !== 'SANDBOX') {
    throw new Error(
      `Fail-closed security check: Unrecognized PAYMENT_ENV="${env}". Allowed values are "SANDBOX" or "LIVE".`
    );
  }

  // 4. Local development / testing default
  return new SandboxPaymentAdapter();
}
