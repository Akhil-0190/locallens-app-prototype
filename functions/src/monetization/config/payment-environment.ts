/**
 * Fail-Closed Server-Side Payment Environment Configuration
 * Task A5 — Contributor Ecosystem & Monetization Backend
 *
 * Enforces strict, fail-closed payment environment boundaries.
 * Prevents deployed production Firebase environments from accidentally
 * treating transactions as sandbox or permitting simulated balance minting.
 */

import { PaymentMode } from '../../types/contracts/index.js';

export type PaymentEnvironment = 'SANDBOX' | 'LIVE';

export interface SettlementValidationParams {
  transactionPaymentMode: PaymentMode;
  isSimulationRequested: boolean;
}

/**
 * Validates that settlement is permitted under the current server environment configuration.
 * Fails closed on missing, unexpected, or inconsistent environment variables.
 */
export function validateSettlementEnvironment(params: SettlementValidationParams): void {
  const rawPaymentEnv = process.env.PAYMENT_ENV?.trim().toUpperCase();
  const rawNodeEnv = process.env.NODE_ENV?.trim().toLowerCase();
  const isCloudRuntime = Boolean(
    process.env.K_SERVICE || process.env.FUNCTION_TARGET || process.env.FIREBASE_CONFIG
  );

  // 1. Explicit LIVE environment check
  if (rawPaymentEnv === 'LIVE') {
    if (params.transactionPaymentMode !== 'LIVE') {
      throw new Error(
        'Inconsistent configuration: Cannot settle a SANDBOX transaction in an explicit LIVE payment environment.'
      );
    }
    if (params.isSimulationRequested) {
      throw new Error(
        'Security violation: Simulated outcomes are strictly prohibited in an explicit LIVE payment environment.'
      );
    }
    return;
  }

  // 2. Explicit SANDBOX environment check
  if (rawPaymentEnv === 'SANDBOX') {
    // Fail closed: In a deployed cloud runtime (K_SERVICE, etc.) or production NODE_ENV,
    // PAYMENT_ENV cannot be set to SANDBOX (fail-closed). Do not rely solely on NODE_ENV.
    if (rawNodeEnv === 'production' || isCloudRuntime) {
      throw new Error(
        'Security violation: PAYMENT_ENV cannot be set to SANDBOX in deployed cloud runtime or production NODE_ENV (fail-closed).'
      );
    }
    if (params.transactionPaymentMode !== 'SANDBOX') {
      throw new Error(
        'Inconsistent configuration: Cannot settle a LIVE transaction in an explicit SANDBOX payment environment.'
      );
    }
    return;
  }

  // 3. PAYMENT_ENV is missing or unset
  if (!rawPaymentEnv) {
    // Only permit local development or unit test runners (where NODE_ENV is explicitly 'development' or 'test')
    // and not running inside deployed cloud infrastructure.
    if ((rawNodeEnv === 'test' || rawNodeEnv === 'development') && !isCloudRuntime) {
      if (params.transactionPaymentMode !== 'SANDBOX') {
        throw new Error(
          'Inconsistent configuration: Live transactions cannot be settled in local development without explicit LIVE configuration.'
        );
      }
      return;
    }

    // Deployed, production, or unknown runtime with missing PAYMENT_ENV -> FAIL CLOSED!
    throw new Error(
      'Fail-closed security check: Missing explicit PAYMENT_ENV configuration in deployed or production runtime. Settlement is rejected.'
    );
  }

  // 4. Unexpected / invalid PAYMENT_ENV value -> FAIL CLOSED!
  throw new Error(
    `Fail-closed security check: Unrecognized PAYMENT_ENV="${rawPaymentEnv}". Allowed values are "SANDBOX" or "LIVE". Settlement is rejected.`
  );
}
