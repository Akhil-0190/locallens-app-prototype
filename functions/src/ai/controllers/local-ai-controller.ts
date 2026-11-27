/**
 * Startup Buildathon 2026 — Neighborhood Guide App
 * Task B6: Local AI & On-Device Telemetry Controller — Firebase Callable Functions
 * Developer B — AI & Model Integration Lead
 * 
 * Exports callable Cloud Functions for Developer D's Flutter application:
 * - evaluateAICoreReadiness: Dynamic readiness evaluation for Android AICore / ML Kit GenAI
 * - evaluateGemmaReadiness: Dynamic readiness evaluation for Gemma 4 E2B Unsloth GGUF
 * - executeCloudFallbackInference: Secure backend cloud fallback for on-device inference
 *   (Strictly requires explicit user opt-in consent and network connectivity)
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as logger from 'firebase-functions/logger';
import { randomUUID } from 'node:crypto';
import { geminiApiKey, mapsApiKey } from '../../config/secrets.js';
import { ApiSuccessResponse } from '../../types/contracts/index.js';
import { assertRateLimit } from '../utils/rate-limiter.js';
import {
  getGemmaModelManifest,
  buildNeighborhoodOfflinePack,
} from '../../offline/pack-builder-controller.js';
import {
  evaluateAICoreReadiness,
  evaluateGemmaGGUFReadiness,
  orchestrateLocalInference,
  defaultCloudInferenceExecutor,
} from '../services/local-ai-service.js';
import {
  DeviceAICapabilitiesSchema,
  LocalInferenceRequestSchema,
  LocalInferenceResponse,
} from '../schemas/local-ai-schemas.js';

function requestId(): string {
  return randomUUID().replace(/-/g, '').slice(0, 12);
}

export function checkAppCheckIfEnforced(request: any): void {
  if (process.env.ENFORCE_APP_CHECK === 'true') {
    if (!request.app || typeof request.app.appId !== 'string' || request.app.appId.trim().length === 0) {
      throw new HttpsError('failed-precondition', 'Firebase App Check token is missing or invalid.');
    }
    if (request.app.alreadyConsumed) {
      throw new HttpsError('failed-precondition', 'Firebase App Check token has already been consumed.');
    }
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
      version: 'B6',
    },
  };
}

/**
 * Callable: evaluateAICoreReadiness
 * Evaluates dynamic readiness for Google ML Kit GenAI / Android AICore.
 */
export const evaluateAICoreReadinessCallable = onCall(async (request) => {
  const startMs = Date.now();
  checkAppCheckIfEnforced(request);

  const parseResult = DeviceAICapabilitiesSchema.safeParse(request.data?.deviceCapabilities || request.data);
  if (!parseResult.success) {
    throw new HttpsError('invalid-argument', `Telemetry validation failed: ${parseResult.error.message}`);
  }

  const taskType = request.data?.taskType || 'SUMMARIZATION';
  const dynamicStatus = request.data?.dynamicStatus || 'DOWNLOADABLE';
  const language = request.data?.language || 'en';

  const evaluation = evaluateAICoreReadiness(parseResult.data, taskType, dynamicStatus, language);
  return successEnvelope(evaluation, startMs);
});

/**
 * Callable: evaluateGemmaReadiness
 * Evaluates dynamic system capability for Gemma 4 E2B Unsloth GGUF execution via llama.cpp.
 */
export const evaluateGemmaReadinessCallable = onCall(async (request) => {
  const startMs = Date.now();
  checkAppCheckIfEnforced(request);

  const parseResult = DeviceAICapabilitiesSchema.safeParse(request.data?.deviceCapabilities || request.data);
  if (!parseResult.success) {
    throw new HttpsError('invalid-argument', `Telemetry validation failed: ${parseResult.error.message}`);
  }

  const runtimeBinaryPresent = Boolean(request.data?.runtimeBinaryPresent);
  const modelFilePresent = Boolean(request.data?.modelFilePresent);

  const evaluation = evaluateGemmaGGUFReadiness(parseResult.data, runtimeBinaryPresent, modelFilePresent);
  return successEnvelope(evaluation, startMs);
});

/**
 * Callable: executeCloudFallbackInference
 * Secure backend cloud fallback for on-device inference when local models are unavailable.
 * Strict Governance Rules:
 * 1. Must be authenticated.
 * 2. Rate-limited to prevent quota abuse.
 * 3. Enforces user opt-in consent (userConsentCloudFallback: true). If withheld, throws permission-denied.
 * 4. Strictly tagged with provenance: 'CLOUD_FALLBACK', isLocalInference: false, executionEnvironment: 'BACKEND_CLOUD_FUNCTIONS'.
 */
export const executeCloudFallbackInference = onCall(
  { secrets: [geminiApiKey], memory: '512MiB' },
  async (request) => {
  const startMs = Date.now();
  checkAppCheckIfEnforced(request);

  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated for AI assistance.');
  }

  await assertRateLimit(request.auth.uid, 'executeCloudFallbackInference');

  const parseResult = LocalInferenceRequestSchema.safeParse(request.data);
  if (!parseResult.success) {
    throw new HttpsError('invalid-argument', `Inference request validation failed: ${parseResult.error.message}`);
  }

  const reqData = parseResult.data;

  // Enforce Privacy Invariant: Cloud fallback strictly forbidden if user consent was not granted
  if (!reqData.userConsentCloudFallback) {
    throw new HttpsError(
      'permission-denied',
      'Cloud fallback rejected: User consent for remote cloud processing was not granted.'
    );
  }

  // Enforce Privacy Invariant: If requested offlineOnly, refuse cloud execution
  if (reqData.offlineOnly || reqData.connectivity === 'OFFLINE') {
    throw new HttpsError(
      'failed-precondition',
      'Cloud fallback rejected: Request specified offlineOnly or OFFLINE connectivity.'
    );
  }

  try {
    const response: LocalInferenceResponse = await orchestrateLocalInference(reqData, {
      cloudExecutor: defaultCloudInferenceExecutor,
    });

    return successEnvelope(response, startMs);
  } catch (err: any) {
    logger.error('executeCloudFallbackInference error', { err });
    throw new HttpsError('internal', err.message || 'Cloud fallback inference failed.');
  }
});

/**
 * Callable: getModelManifest
 * Returns the canonical Gemma 4 E2B LiteRT-LM on-device model manifest and hardware thresholds.
 */
export const getModelManifest = onCall(async (request) => {
  const startMs = Date.now();
  checkAppCheckIfEnforced(request);
  const manifest = getGemmaModelManifest();
  return successEnvelope(manifest, startMs);
});

/**
 * Callable: generateNeighborhoodPack
 * Compiles verified Firestore places/spots, walking routes, and tile bounding boxes
 * into a SHA-256 verified offline pack uploaded to Storage and indexed in `offline_packs`.
 */
export const generateNeighborhoodPack = onCall(
  { secrets: [mapsApiKey, geminiApiKey], memory: '512MiB' },
  async (request) => {
    const startMs = Date.now();
    checkAppCheckIfEnforced(request);

    const data = (request.data as Record<string, unknown>) || {};
    const neighborhood =
      typeof data.neighborhood === 'string' && data.neighborhood.trim().length > 0
        ? data.neighborhood.trim()
        : '';
    const city = typeof data.city === 'string' ? data.city.trim() : 'Bengaluru';

    if (!neighborhood) {
      throw new HttpsError('invalid-argument', 'A valid neighborhood name is required.');
    }

    try {
      const pack = await buildNeighborhoodOfflinePack({ neighborhood, city });
      return successEnvelope(pack, startMs);
    } catch (err: any) {
      logger.error('generateNeighborhoodPack error', { err });
      throw new HttpsError('internal', err.message || 'Failed to build offline neighborhood pack.');
    }
  }
);
