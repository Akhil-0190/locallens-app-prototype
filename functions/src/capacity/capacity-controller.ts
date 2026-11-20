/**
 * Capacity & Scheduling Controller — Firebase Callable & Scheduled Functions
 * Task A4 — Preferences, Groups, Capacity, and Scheduling Backend
 *
 * Exports:
 *   - getHourlyCapacity       — Query real-time crowd and capacity status for a venue slot
 *   - bookScheduledVisit      — Transactional booking with deterministic idempotency
 *   - cancelScheduledVisit    — Transactional cancellation releasing capacity
 *   - checkInScheduledVisit   — Proximity / QR check-in
 *   - reconcileExpiredVisits  — Scheduled reconciliation trigger for expired un-checked-in slots
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as logger from 'firebase-functions/logger';
import { randomUUID } from 'node:crypto';
import { ApiSuccessResponse } from '../types/contracts/index.js';
import {
  getHourlyCapacity as fetchHourlyCapacity,
  bookScheduledVisit as reserveVisit,
  cancelScheduledVisit as releaseVisit,
  checkInScheduledVisit as verifyCheckIn,
  reconcileScheduledVisits as processReconciliation,
} from './capacity-service.js';

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
 * Callable: getHourlyCapacity
 * Retrieves capacity status and suggested alternatives for a place at a given hour slot.
 */
export const getHourlyCapacity = onCall(async (request) => {
  const startMs = Date.now();
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated.');
  }

  const { placeId, slotId } = (request.data as Record<string, unknown>) || {};

  if (!placeId || typeof placeId !== 'string' || !slotId || typeof slotId !== 'string') {
    throw new HttpsError('invalid-argument', 'placeId and slotId are required.');
  }

  const capacity = await fetchHourlyCapacity(placeId, slotId);
  if (!capacity) {
    throw new HttpsError('not-found', `Hourly capacity not found for ${placeId} / ${slotId}`);
  }

  return successEnvelope(capacity, startMs);
});

/**
 * Callable: bookScheduledVisit
 * Transactionally books a visit slot for a solo traveler or group.
 */
export const bookScheduledVisit = onCall(async (request) => {
  const startMs = Date.now();
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated.');
  }

  const { placeId, slotId, partySize, idempotencyKey, groupSessionId, memberUserIds } =
    (request.data as Record<string, unknown>) || {};

  if (!placeId || typeof placeId !== 'string') {
    throw new HttpsError('invalid-argument', 'placeId is required.');
  }
  if (!slotId || typeof slotId !== 'string') {
    throw new HttpsError('invalid-argument', 'slotId is required.');
  }
  if (!idempotencyKey || typeof idempotencyKey !== 'string') {
    throw new HttpsError('invalid-argument', 'idempotencyKey is required.');
  }
  const size = typeof partySize === 'number' ? partySize : 1;

  try {
    const reservation = await reserveVisit({
      placeId,
      slotId,
      partySize: size,
      idempotencyKey,
      travelerId: request.auth.uid,
      groupSessionId: typeof groupSessionId === 'string' ? groupSessionId : null,
      memberUserIds: Array.isArray(memberUserIds) ? (memberUserIds as string[]) : undefined,
    });

    logger.info('Scheduled visit booked', {
      visitId: reservation.visitId,
      placeId,
      slotId,
      partySize: reservation.partySize,
      travelerId: request.auth.uid,
    });

    return successEnvelope(reservation, startMs);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error('Failed to book scheduled visit', { error: msg, travelerId: request.auth.uid });
    if (msg.includes('previously used with different booking parameters')) {
      throw new HttpsError('already-exists', msg);
    }
    if (msg.includes('Insufficient capacity')) {
      throw new HttpsError('resource-exhausted', msg);
    }
    if (msg.includes('lacks verified timezone')) {
      throw new HttpsError('failed-precondition', msg);
    }
    throw new HttpsError('invalid-argument', msg);
  }
});

/**
 * Callable: cancelScheduledVisit
 * Transactionally cancels a reservation and releases capacity before the slot begins.
 */
export const cancelScheduledVisit = onCall(async (request) => {
  const startMs = Date.now();
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated.');
  }

  const { visitId } = (request.data as Record<string, unknown>) || {};
  if (!visitId || typeof visitId !== 'string') {
    throw new HttpsError('invalid-argument', 'visitId is required.');
  }

  try {
    const cancelled = await releaseVisit({
      visitId,
      callerUserId: request.auth.uid,
    });

    logger.info('Scheduled visit cancelled', { visitId, travelerId: request.auth.uid });
    return successEnvelope(cancelled, startMs);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error('Failed to cancel scheduled visit', { error: msg, visitId });
    if (msg.includes('Only the traveler')) {
      throw new HttpsError('permission-denied', msg);
    }
    if (msg.includes('after the scheduled slot has started')) {
      throw new HttpsError('failed-precondition', msg);
    }
    throw new HttpsError('invalid-argument', msg);
  }
});

/**
 * Callable: checkInScheduledVisit
 * Validates physical proximity or QR code and marks visit COMPLETED.
 */
export const checkInScheduledVisit = onCall(async (request) => {
  const startMs = Date.now();
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated.');
  }

  const { visitId, travelerCoordinate, qrToken } =
    (request.data as Record<string, unknown>) || {};

  if (!visitId || typeof visitId !== 'string') {
    throw new HttpsError('invalid-argument', 'visitId is required.');
  }

  try {
    const checkedIn = await verifyCheckIn({
      visitId,
      callerUserId: request.auth.uid,
      travelerCoordinate: travelerCoordinate as { latitude: number; longitude: number } | undefined,
      qrToken: typeof qrToken === 'string' ? qrToken : undefined,
    });

    logger.info('Scheduled visit checked in', { visitId, callerUserId: request.auth.uid });
    return successEnvelope(checkedIn, startMs);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error('Failed to check in scheduled visit', { error: msg, visitId });
    if (msg.includes('Proximity check failed')) {
      throw new HttpsError('failed-precondition', msg);
    }
    if (msg.includes('active slot window')) {
      throw new HttpsError('failed-precondition', msg);
    }
    throw new HttpsError('invalid-argument', msg);
  }
});

/**
 * Scheduled Cloud Function: reconcileExpiredVisits
 * Runs every hour to mark expired un-checked-in slots COMPLETED.
 */
export const reconcileExpiredVisits = onSchedule('every 1 hours', async () => {
  logger.info('Starting hourly scheduled visit reconciliation');
  const result = await processReconciliation(2); // 2-hour buffer
  logger.info('Scheduled visit reconciliation finished', { reconciledCount: result.reconciledCount });
});
