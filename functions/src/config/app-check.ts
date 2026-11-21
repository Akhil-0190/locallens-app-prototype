/**
 * Firebase App Check Configuration and Verification Utility
 * Task A6 — Security, Integration, Deployment and Release
 *
 * Provides utilities for auditing, inspecting, and conditionally enforcing
 * Firebase App Check across Cloud Functions callable endpoints.
 */

import { CallableRequest, HttpsError } from 'firebase-functions/v2/https';
import * as logger from 'firebase-functions/logger';

export interface AppCheckVerificationResult {
  isVerified: boolean;
  appId?: string;
  isEnforced: boolean;
  reason?: string;
}

/**
 * Inspects the App Check verification status of an incoming callable request.
 *
 * Current rollout status:
 * - Flutter / Android clients have the firebase_app_check package in pubspec,
 *   but Play Integrity / debug providers are not yet activated in client bootstrap (main.dart).
 * - Therefore, App Check enforcement is PREPARED but NOT set to hard-fail by default,
 *   preventing legitimate mobile users from being blocked during development/staging.
 */
export function inspectAppCheck(
  request: CallableRequest,
  options?: { enforce?: boolean }
): AppCheckVerificationResult {
  const shouldEnforce = options?.enforce ?? false;
  const app = request.app;

  if (app) {
    logger.info('App Check token verified', {
      appId: app.appId,
      alreadyConsumed: app.alreadyConsumed,
    });
    return {
      isVerified: true,
      appId: app.appId,
      isEnforced: shouldEnforce,
    };
  }

  // No valid App Check token present on request
  const reason = 'Request lacks a verified Firebase App Check attestation token.';

  if (shouldEnforce) {
    logger.warn('App Check enforcement blocked unverified request', {
      uid: request.auth?.uid,
      enforced: true,
    });
    throw new HttpsError(
      'unauthenticated',
      'App Check verification failed: Valid client attestation token required.'
    );
  }

  return {
    isVerified: false,
    isEnforced: false,
    reason,
  };
}
