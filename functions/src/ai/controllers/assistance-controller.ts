/**
 * Street Assistance Controller — Firebase Callable Functions
 * Task B5 — Gemini Live, Translation, and Street-Ready AI Assistance
 * Developer B — AI & Model Integration Lead
 * 
 * Exports callable Cloud Functions for Developer D's Flutter application:
 * - initializeLiveSession: Mints ephemeral session tokens for Gemini 3.8 Live WebSocket
 * - askStreetCopilot: Conversational Q&A dialogue with neighborhood context
 * - translateText: Real-time translation preserving quantities, prices, dietary cues
 * - getOrderingPhrases: Authentic cultural ordering phrases for street stalls
 * - getEtiquetteGuidance: Contextual temple, eatery, and market etiquette
 * - translateCameraSignage: OCR & translation for signs, menu boards, notice plaques
 * - generateAudioGuidance: Concise (< 60 words) spoken prompts for device TTS
 * - explainPlanBReroute: Consumes Developer C's PlanBExplanationContext
 * - formatGeminiHandoff: Deep-link context preparation for Continue in Gemini
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as logger from 'firebase-functions/logger';
import { randomUUID } from 'node:crypto';
import { ApiSuccessResponse } from '../../types/contracts/index.js';
import {
  assertRateLimit,
  assertLiveSessionTokenIssuance,
} from '../utils/rate-limiter.js';
import {
  initializeLiveSession as serviceInitLiveSession,
  askStreetCopilot as serviceAskCopilot,
  translateText as serviceTranslateText,
  getOrderingPhrases as serviceGetOrdering,
  getEtiquetteGuidance as serviceGetEtiquette,
  translateCameraSignage as serviceTranslateSignage,
  generateAudioGuidance as serviceGenerateAudio,
  explainPlanBReroute as serviceExplainPlanB,
  formatGeminiHandoffContext as serviceFormatHandoff,
} from '../services/live-assistance-service.js';
import {
  LiveSessionTokenRequestSchema,
  StreetCopilotRequestSchema,
  TranslationRequestSchema,
  OrderingAssistanceRequestSchema,
  EtiquetteGuidanceRequestSchema,
  CameraVisualTranslationRequestSchema,
  AudioGuidanceContentRequestSchema,
  PlanBExplanationRequestSchema,
  GeminiHandoffContextSchema,
} from '../schemas/assistance-schemas.js';

function requestId(): string {
  return randomUUID().replace(/-/g, '').slice(0, 12);
}

function checkAppCheckIfEnforced(request: any) {
  if (process.env.ENFORCE_APP_CHECK === 'true' && !request.app) {
    throw new HttpsError('failed-precondition', 'Firebase App Check token is missing or invalid.');
  }
}

function successEnvelope<T>(data: T, startMs: number): ApiSuccessResponse {
  return {
    success: true,
    data: data as Record<string, unknown>,
    metadata: {
      requestId: requestId(),
      timestamp: new Date().toISOString(),
      executionDurationMs: Date.now() - startMs,
      version: 'B5',
    },
  };
}

/**
 * Callable: initializeLiveSession
 * Mints an ephemeral session token for Gemini 3.8 Live WebSocket connection.
 */
export const initializeLiveSession = onCall(async (request) => {
  const startMs = Date.now();
  checkAppCheckIfEnforced(request);
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated to start a Live session.');
  }
  assertLiveSessionTokenIssuance(request.auth.uid);

  const parseResult = LiveSessionTokenRequestSchema.safeParse(request.data);
  if (!parseResult.success) {
    throw new HttpsError('invalid-argument', `Validation failed: ${parseResult.error.message}`);
  }

  try {
    const result = await serviceInitLiveSession(parseResult.data);
    return successEnvelope(result, startMs);
  } catch (err: any) {
    logger.error('initializeLiveSession error', { err });
    throw new HttpsError('internal', err.message || 'Failed to initialize Live session.');
  }
});

/**
 * Callable: askStreetCopilot
 * Interactive conversational Q&A for walking guidance.
 */
export const askStreetCopilot = onCall(async (request) => {
  const startMs = Date.now();
  checkAppCheckIfEnforced(request);
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated to use Street Copilot.');
  }
  assertRateLimit(request.auth.uid, 'askStreetCopilot');

  const parseResult = StreetCopilotRequestSchema.safeParse(request.data);
  if (!parseResult.success) {
    throw new HttpsError('invalid-argument', `Validation failed: ${parseResult.error.message}`);
  }

  try {
    const result = await serviceAskCopilot(parseResult.data);
    return successEnvelope(result, startMs);
  } catch (err: any) {
    logger.error('askStreetCopilot error', { err });
    throw new HttpsError('internal', err.message || 'Failed to query Street Copilot.');
  }
});

/**
 * Callable: translateText
 * Real-time translation between regional scripts and English.
 */
export const translateText = onCall(async (request) => {
  const startMs = Date.now();
  checkAppCheckIfEnforced(request);
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated to translate text.');
  }
  assertRateLimit(request.auth.uid, 'translateText');

  const parseResult = TranslationRequestSchema.safeParse(request.data);
  if (!parseResult.success) {
    throw new HttpsError('invalid-argument', `Validation failed: ${parseResult.error.message}`);
  }

  try {
    const result = await serviceTranslateText(parseResult.data);
    return successEnvelope(result, startMs);
  } catch (err: any) {
    logger.error('translateText error', { err });
    throw new HttpsError('internal', err.message || 'Failed to translate text.');
  }
});

/**
 * Callable: getOrderingPhrases
 * Returns cultural ordering cards for street vendors and eateries.
 * Public curated reference with strict payload bounds.
 */
export const getOrderingPhrases = onCall(async (request) => {
  const startMs = Date.now();
  if (JSON.stringify(request.data || {}).length > 4096) {
    throw new HttpsError('invalid-argument', 'Payload exceeds maximum allowed size.');
  }

  const parseResult = OrderingAssistanceRequestSchema.safeParse(request.data || {});
  if (!parseResult.success) {
    throw new HttpsError('invalid-argument', `Validation failed: ${parseResult.error.message}`);
  }

  try {
    const result = await serviceGetOrdering(parseResult.data);
    return successEnvelope(result, startMs);
  } catch (err: any) {
    logger.error('getOrderingPhrases error', { err });
    throw new HttpsError('internal', err.message || 'Failed to retrieve ordering phrases.');
  }
});

/**
 * Callable: getEtiquetteGuidance
 * Explains contextual temple, dining, and market decorum.
 * Public curated reference with strict payload bounds.
 */
export const getEtiquetteGuidance = onCall(async (request) => {
  const startMs = Date.now();
  if (JSON.stringify(request.data || {}).length > 4096) {
    throw new HttpsError('invalid-argument', 'Payload exceeds maximum allowed size.');
  }

  const parseResult = EtiquetteGuidanceRequestSchema.safeParse(request.data);
  if (!parseResult.success) {
    throw new HttpsError('invalid-argument', `Validation failed: ${parseResult.error.message}`);
  }

  try {
    const result = await serviceGetEtiquette(parseResult.data);
    return successEnvelope(result, startMs);
  } catch (err: any) {
    logger.error('getEtiquetteGuidance error', { err });
    throw new HttpsError('internal', err.message || 'Failed to get etiquette guidance.');
  }
});

/**
 * Callable: translateCameraSignage
 * Multimodal image OCR & translation for signage and menus.
 */
export const translateCameraSignage = onCall(async (request) => {
  const startMs = Date.now();
  checkAppCheckIfEnforced(request);
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated to use visual translation.');
  }
  assertRateLimit(request.auth.uid, 'translateCameraSignage');

  const parseResult = CameraVisualTranslationRequestSchema.safeParse(request.data);
  if (!parseResult.success) {
    throw new HttpsError('invalid-argument', `Validation failed: ${parseResult.error.message}`);
  }

  try {
    const result = await serviceTranslateSignage(parseResult.data);
    return successEnvelope(result, startMs);
  } catch (err: any) {
    logger.error('translateCameraSignage error', { err });
    throw new HttpsError('internal', err.message || 'Failed to translate camera signage.');
  }
});

/**
 * Callable: generateAudioGuidance
 * Generates spoken walking cues under 60 words for device TTS.
 * Externally billed AI operation: requires authentication.
 */
export const generateAudioGuidance = onCall(async (request) => {
  const startMs = Date.now();
  checkAppCheckIfEnforced(request);
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated to generate audio guidance.');
  }
  assertRateLimit(request.auth.uid, 'generateAudioGuidance');

  const parseResult = AudioGuidanceContentRequestSchema.safeParse(request.data);
  if (!parseResult.success) {
    throw new HttpsError('invalid-argument', `Validation failed: ${parseResult.error.message}`);
  }

  try {
    const result = await serviceGenerateAudio(parseResult.data);
    return successEnvelope(result, startMs);
  } catch (err: any) {
    logger.error('generateAudioGuidance error', { err });
    throw new HttpsError('internal', err.message || 'Failed to generate audio guidance.');
  }
});

/**
 * Callable: explainPlanBReroute
 * Explains dynamic walking reroutes using Developer C's PlanBExplanationContext.
 * Requires authenticated traveler session.
 */
export const explainPlanBReroute = onCall(async (request) => {
  const startMs = Date.now();
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated to explain Plan-B reroutes.');
  }
  assertRateLimit(request.auth.uid, 'explainPlanBReroute');

  const parseResult = PlanBExplanationRequestSchema.safeParse(request.data);
  if (!parseResult.success) {
    throw new HttpsError('invalid-argument', `Validation failed: ${parseResult.error.message}`);
  }

  try {
    const result = await serviceExplainPlanB(parseResult.data);
    return successEnvelope(result, startMs);
  } catch (err: any) {
    logger.error('explainPlanBReroute error', { err });
    throw new HttpsError('internal', err.message || 'Failed to explain Plan-B reroute.');
  }
});

/**
 * Callable: formatGeminiHandoff
 * Exports traveler context for Continue in Gemini.
 */
export const formatGeminiHandoff = onCall(async (request) => {
  const startMs = Date.now();
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated to initiate Gemini handoff.');
  }
  assertRateLimit(request.auth.uid, 'formatGeminiHandoff');

  const parseResult = GeminiHandoffContextSchema.safeParse(request.data);
  if (!parseResult.success) {
    throw new HttpsError('invalid-argument', `Validation failed: ${parseResult.error.message}`);
  }

  try {
    const result = serviceFormatHandoff(parseResult.data);
    return successEnvelope(result, startMs);
  } catch (err: any) {
    logger.error('formatGeminiHandoff error', { err });
    throw new HttpsError('internal', err.message || 'Failed to format Gemini handoff.');
  }
});
