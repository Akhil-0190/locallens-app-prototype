/**
 * Groups Controller — Firebase Callable Functions
 * Task A4 — Preferences, Groups, Capacity, and Scheduling Backend
 *
 * Exports:
 *   - createGroupSession  — Host creates a new group session
 *   - joinGroupSession    — Member joins session with 6-char code
 *   - leaveGroupSession   — Member leaves a group session
 *   - getGroupSession     — Fetches group session details (enforces membership)
 *   - saveConsensusBlend  — Persists AI matching consensus result (B2/Admin/Host)
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as logger from 'firebase-functions/logger';
import { randomUUID } from 'node:crypto';
import {
  ConsensusBlendOutputSchema,
  ApiSuccessResponse,
} from '../types/contracts/index.js';
import {
  createGroupSession as createSession,
  joinGroupSession as joinSession,
  leaveGroupSession as leaveSession,
  getGroupSessionById,
  saveConsensusBlend as persistBlend,
} from './groups-service.js';

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
 * Callable: createGroupSession
 */
export const createGroupSession = onCall(async (request) => {
  const startMs = Date.now();
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated.');
  }

  const { neighborhood, displayName, vibes, dietaryRestrictions, maxBudgetAmount, weighting } =
    (request.data as Record<string, unknown>) || {};

  if (!neighborhood || typeof neighborhood !== 'string') {
    throw new HttpsError('invalid-argument', 'Neighborhood must be a non-empty string.');
  }

  try {
    const session = await createSession(request.auth.uid, neighborhood, {
      displayName: (displayName as string) || 'Host Traveler',
      vibes: Array.isArray(vibes) ? vibes : [],
      dietaryRestrictions: Array.isArray(dietaryRestrictions) ? dietaryRestrictions : [],
      maxBudgetAmount: typeof maxBudgetAmount === 'number' ? maxBudgetAmount : 500,
      weighting: typeof weighting === 'number' ? weighting : 1.0,
    });

    logger.info('Group session created', {
      sessionId: session.sessionId,
      sessionCode: session.sessionCode,
      hostUserId: request.auth.uid,
    });

    return successEnvelope(session, startMs);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error('Failed to create group session', { error: msg });
    throw new HttpsError('invalid-argument', msg);
  }
});

/**
 * Callable: joinGroupSession
 */
export const joinGroupSession = onCall(async (request) => {
  const startMs = Date.now();
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated.');
  }

  const { sessionCode, displayName, vibes, dietaryRestrictions, maxBudgetAmount, weighting } =
    (request.data as Record<string, unknown>) || {};

  if (!sessionCode || typeof sessionCode !== 'string') {
    throw new HttpsError('invalid-argument', 'Valid 6-character session code required.');
  }

  try {
    const session = await joinSession(request.auth.uid, sessionCode, {
      displayName: (displayName as string) || 'Fellow Traveler',
      vibes: Array.isArray(vibes) ? vibes : [],
      dietaryRestrictions: Array.isArray(dietaryRestrictions) ? dietaryRestrictions : [],
      maxBudgetAmount: typeof maxBudgetAmount === 'number' ? maxBudgetAmount : 500,
      weighting: typeof weighting === 'number' ? weighting : 1.0,
    });

    logger.info('Member joined group session', {
      sessionId: session.sessionId,
      userId: request.auth.uid,
      totalMembers: session.members.length,
    });

    return successEnvelope(session, startMs);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error('Failed to join group session', { error: msg });
    throw new HttpsError('invalid-argument', msg);
  }
});

/**
 * Callable: leaveGroupSession
 */
export const leaveGroupSession = onCall(async (request) => {
  const startMs = Date.now();
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated.');
  }

  const { sessionId } = (request.data as Record<string, unknown>) || {};
  if (!sessionId || typeof sessionId !== 'string') {
    throw new HttpsError('invalid-argument', 'Session ID required.');
  }

  try {
    const res = await leaveSession(request.auth.uid, sessionId);
    return successEnvelope(res, startMs);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new HttpsError('invalid-argument', msg);
  }
});

/**
 * Callable: getGroupSession
 */
export const getGroupSession = onCall(async (request) => {
  const startMs = Date.now();
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated.');
  }

  const { sessionId } = (request.data as Record<string, unknown>) || {};
  if (!sessionId || typeof sessionId !== 'string') {
    throw new HttpsError('invalid-argument', 'Session ID required.');
  }

  const session = await getGroupSessionById(sessionId);
  if (!session) {
    throw new HttpsError('not-found', `Group session ${sessionId} not found.`);
  }

  // Verify caller is a member or host
  const isMember = session.members.some((m) => m.userId === request.auth?.uid);
  if (!isMember && session.hostUserId !== request.auth.uid) {
    throw new HttpsError('permission-denied', 'Only session members may access details.');
  }

  return successEnvelope(session, startMs);
});

/**
 * Callable: saveConsensusBlend
 * Used by Developer B's AI service or authorized host to persist AI taste matching output.
 */
export const saveConsensusBlend = onCall(async (request) => {
  const startMs = Date.now();
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated.');
  }

  const { sessionId, blend, recommendedSpotIds } =
    (request.data as Record<string, unknown>) || {};

  if (!sessionId || typeof sessionId !== 'string') {
    throw new HttpsError('invalid-argument', 'Session ID required.');
  }

  // Authorization check: Caller must be session host, session member, or administrator
  const session = await getGroupSessionById(sessionId);
  if (!session) {
    throw new HttpsError('not-found', `Group session ${sessionId} not found.`);
  }

  const tokenRole = String(request.auth.token?.role || '').toUpperCase();
  const isAdmin = request.auth.token?.admin === true || tokenRole === 'ADMIN' || tokenRole === 'MODERATOR';
  const isHost = session.hostUserId === request.auth.uid;
  const isMember = session.members.some((m) => m.userId === request.auth?.uid);

  if (!isAdmin && !isHost && !isMember) {
    throw new HttpsError(
      'permission-denied',
      'Permission denied: Only group session host, members, or administrators may save consensus blends.'
    );
  }

  try {
    const validatedBlend = ConsensusBlendOutputSchema.parse(blend);
    const spotIds = Array.isArray(recommendedSpotIds) ? (recommendedSpotIds as string[]) : [];

    const updated = await persistBlend(sessionId, validatedBlend, spotIds);
    return successEnvelope(updated, startMs);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error('Failed to save consensus blend', { error: msg });
    throw new HttpsError('invalid-argument', msg);
  }
});
