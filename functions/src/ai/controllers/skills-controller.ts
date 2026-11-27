/**
 * Startup Buildathon 2026 — Neighborhood Guide App
 * Task B7: Agent Skills & Continue in Gemini Controller — Firebase Callable Functions
 * Developer B — AI & Multimodal Lead
 * 
 * Exports callable Cloud Functions for the four committed Agent Skills & Continue in Gemini Handoff:
 * 1. executeVoiceNoteExtractionSkill: Regional multimodal transcription & practical entity extraction
 * 2. executeTrapFilteringSkill: Maps-grounded authenticity assessment & tourist trap filtering
 * 3. executeGroupBlendingSkill: Multi-party preference harmonization & strict dietary union
 * 4. executePlanBReroutingSkill: Dynamic walking itinerary adaptation for weather, closures, and crowds
 * 5. executeGeminiHandoffSkill: Two-phase cryptographic Continue in Gemini deep-link handoff
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as logger from 'firebase-functions/logger';
import { randomUUID } from 'node:crypto';
import { geminiApiKey, mapsApiKey } from '../../config/secrets.js';
import { ApiSuccessResponse } from '../../types/contracts/index.js';

const skillsCallableOptions = {
  secrets: [geminiApiKey, mapsApiKey],
  memory: '512MiB' as const,
};
import { assertRateLimit } from '../utils/rate-limiter.js';
import {
  executeVoiceNoteExtractionSkill,
  VoicePhotoExtractionInputSchema,
} from '../skills/skill-voice-extraction.js';
import {
  executeTrapFilteringSkill,
  TrapFilterSkillInputSchema,
} from '../skills/skill-trap-filtering.js';
import {
  executeGroupBlendingSkill,
  GroupBlendingSkillInputSchema,
} from '../skills/skill-group-blending.js';
import {
  executePlanBReroutingSkill,
  PlanBReroutingSkillInputSchema,
} from '../skills/skill-plan-b-rerouting.js';
import {
  executeGeminiHandoff,
  GeminiHandoffExecutionInputSchema,
} from '../skills/gemini-handoff.js';

import { checkAppCheckIfEnforced } from './local-ai-controller.js';

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
      version: 'B7',
    },
  };
}

/**
 * Callable: executeVoiceNoteExtractionSkill
 */
export const executeVoiceNoteExtraction = onCall(skillsCallableOptions, async (request) => {
  const startMs = Date.now();
  checkAppCheckIfEnforced(request);
  const isGuest = (request.data as any)?.isGuestAccess === true;
  const callerUid = request.auth?.uid || (isGuest ? ((request.data as any)?.userId || 'guest_traveler') : undefined);
  if (!callerUid) {
    throw new HttpsError('unauthenticated', 'User must be authenticated to invoke Voice-Note Extraction Skill.');
  }
  await assertRateLimit(callerUid, 'executeVoiceNoteExtraction');

  const parseResult = VoicePhotoExtractionInputSchema.safeParse(request.data);
  if (!parseResult.success) {
    throw new HttpsError('invalid-argument', `Skill input validation failed: ${parseResult.error.message}`);
  }

  try {
    const result = await executeVoiceNoteExtractionSkill(parseResult.data);
    return successEnvelope(result, startMs);
  } catch (err: any) {
    logger.error('executeVoiceNoteExtraction error', { err });
    throw new HttpsError('internal', err.message || 'Voice-note extraction skill execution failed.');
  }
});

/**
 * Callable: executeTrapFilteringSkill
 */
export const executeTrapFiltering = onCall(skillsCallableOptions, async (request) => {
  const startMs = Date.now();
  checkAppCheckIfEnforced(request);
  const isGuest = (request.data as any)?.isGuestAccess === true;
  const callerUid = request.auth?.uid || (isGuest ? ((request.data as any)?.userId || 'guest_traveler') : undefined);
  if (!callerUid) {
    throw new HttpsError('unauthenticated', 'User must be authenticated to invoke Trap Filtering Skill.');
  }
  await assertRateLimit(callerUid, 'executeTrapFiltering');

  const parseResult = TrapFilterSkillInputSchema.safeParse(request.data);
  if (!parseResult.success) {
    throw new HttpsError('invalid-argument', `Skill input validation failed: ${parseResult.error.message}`);
  }

  try {
    const result = await executeTrapFilteringSkill(parseResult.data);
    return successEnvelope(result, startMs);
  } catch (err: any) {
    logger.error('executeTrapFiltering error', { err });
    throw new HttpsError('internal', err.message || 'Trap filtering skill execution failed.');
  }
});

/**
 * Callable: executeGroupBlendingSkill
 */
export const executeGroupBlending = onCall(skillsCallableOptions, async (request) => {
  const startMs = Date.now();
  checkAppCheckIfEnforced(request);
  const isGuest = (request.data as any)?.isGuestAccess === true;
  const callerUid = request.auth?.uid || (isGuest ? ((request.data as any)?.userId || 'guest_traveler') : undefined);
  if (!callerUid) {
    throw new HttpsError('unauthenticated', 'User must be authenticated to invoke Group Blending Skill.');
  }
  await assertRateLimit(callerUid, 'executeGroupBlending');

  const parseResult = GroupBlendingSkillInputSchema.safeParse(request.data);
  if (!parseResult.success) {
    throw new HttpsError('invalid-argument', `Skill input validation failed: ${parseResult.error.message}`);
  }

  try {
    const result = await executeGroupBlendingSkill(parseResult.data);
    return successEnvelope(result, startMs);
  } catch (err: any) {
    logger.error('executeGroupBlending error', { err });
    throw new HttpsError('internal', err.message || 'Group blending skill execution failed.');
  }
});

/**
 * Callable: executePlanBReroutingSkill
 */
export const executePlanBRerouting = onCall(skillsCallableOptions, async (request) => {
  const startMs = Date.now();
  checkAppCheckIfEnforced(request);
  const isGuest = (request.data as any)?.isGuestAccess === true;
  const callerUid = request.auth?.uid || (isGuest ? ((request.data as any)?.userId || 'guest_traveler') : undefined);
  if (!callerUid) {
    throw new HttpsError('unauthenticated', 'User must be authenticated to invoke Plan-B Rerouting Skill.');
  }
  await assertRateLimit(callerUid, 'executePlanBRerouting');

  const parseResult = PlanBReroutingSkillInputSchema.safeParse(request.data);
  if (!parseResult.success) {
    throw new HttpsError('invalid-argument', `Skill input validation failed: ${parseResult.error.message}`);
  }

  try {
    const result = await executePlanBReroutingSkill(parseResult.data);
    return successEnvelope(result, startMs);
  } catch (err: any) {
    logger.error('executePlanBRerouting error', { err });
    throw new HttpsError('internal', err.message || 'Plan-B rerouting skill execution failed.');
  }
});

/**
 * Callable: executeGeminiHandoffSkill
 */
export const executeGeminiHandoffCallable = onCall(skillsCallableOptions, async (request) => {
  const startMs = Date.now();
  checkAppCheckIfEnforced(request);
  const isGuest = (request.data as any)?.isGuestAccess === true;
  const callerUid = request.auth?.uid || (isGuest ? ((request.data as any)?.userId || 'guest_traveler') : undefined);
  if (!callerUid) {
    throw new HttpsError('unauthenticated', 'User must be authenticated to initiate Continue in Gemini handoff.');
  }
  await assertRateLimit(callerUid, 'executeGeminiHandoff');

  const parseResult = GeminiHandoffExecutionInputSchema.safeParse(request.data);
  if (!parseResult.success) {
    throw new HttpsError('invalid-argument', `Handoff validation failed: ${parseResult.error.message}`);
  }

  try {
    const result = await executeGeminiHandoff(parseResult.data);
    return successEnvelope(result, startMs);
  } catch (err: any) {
    logger.error('executeGeminiHandoffCallable error', { err });
    throw new HttpsError('internal', err.message || 'Continue in Gemini handoff failed.');
  }
});
