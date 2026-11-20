/**
 * Traveler Preferences Controller — Firebase Callable Functions
 * Task A4 — Preferences, Groups, Capacity, and Scheduling Backend
 *
 * Exports:
 *   - getPreferences   — Retrieves the authenticated user's preferences (or returns default)
 *   - updatePreferences — Updates the authenticated user's preferences
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as logger from 'firebase-functions/logger';
import { randomUUID } from 'node:crypto';
import { ApiSuccessResponse } from '../types/contracts/index.js';
import {
  getPreferences as fetchPreferences,
  savePreferences,
  getDefaultPreferences,
} from './preferences-service.js';

function requestId(): string {
  return randomUUID().replace(/-/g, '').slice(0, 12);
}

function successEnvelope<T>(data: T, startMs: number): ApiSuccessResponse {
  return {
    success: true,
    data: data as Record<string, unknown>,
    metadata: {
      requestId: requestId(),
      timestamp: new Date().toISOString(),
      executionDurationMs: Date.now() - startMs,
      version: 'A4',
    },
  };
}

/**
 * Callable: getPreferences
 * Returns the preferences for the authenticated user, or defaults if not saved yet.
 */
export const getPreferences = onCall(async (request) => {
  const startMs = Date.now();

  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated.');
  }

  const userId = request.auth.uid;
  try {
    const preferences = await fetchPreferences(userId);
    const result = preferences || getDefaultPreferences(userId);
    return successEnvelope(result, startMs);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error('Failed to get preferences', { userId, error: msg });
    throw new HttpsError('internal', msg);
  }
});

/**
 * Callable: updatePreferences
 * Validates and saves preferences for the authenticated user.
 */
export const updatePreferences = onCall(async (request) => {
  const startMs = Date.now();

  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated.');
  }

  const userId = request.auth.uid;
  const rawData = request.data as Record<string, unknown>;

  if (!rawData || typeof rawData !== 'object') {
    throw new HttpsError('invalid-argument', 'Payload must be a valid preferences object.');
  }

  try {
    // Partial validation / merge with schema
    const updated = await savePreferences(userId, rawData);
    logger.info('Traveler preferences updated', { userId, vibesCount: updated.favoriteVibes.length });
    return successEnvelope(updated, startMs);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error('Failed to update preferences', { userId, error: msg });
    throw new HttpsError('invalid-argument', `Validation failed: ${msg}`);
  }
});
