/**
 * Community Signals & Safety/Hygiene Verification Controller
 * Stage 1 (Promises #5 & #6):
 *   - Persistent Firestore-backed Community Crowdsource Signal Engine (`community_signals`)
 *     capturing regional dialect phrases, local pronunciations, crowd density taps,
 *     and peer-corroborated safety & hygiene checks.
 *   - Multi-signal Safety & Hygiene Verification (`safety_verifications/{placeId}`)
 *     promoting spots from UNVERIFIED -> AI_EVIDENCE_CHECKED -> COMMUNITY_VERIFIED
 *     only when >= 2 corroborating signals exist.
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as logger from 'firebase-functions/logger';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { db } from '../config/firebase.js';
import { geminiApiKey, mapsApiKey } from '../config/secrets.js';
import {
  ApiSuccessResponse,
  CrowdLevelSchema,
  CommunityDialectPhrase,
  PlaceSafetyHygieneState,
  SafetyVerificationTier,
} from '../types/contracts/index.js';
import { CrowdManagementService } from '../maps/services/crowd-management.service.js';

const communityCallableOptions = {
  secrets: [geminiApiKey, mapsApiKey],
};

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
      version: 'STAGE1-COMMUNITY',
    },
  };
}

export const SubmitPlaceSignalInputSchema = z.object({
  placeId: z.string().min(1),
  signalType: z.enum(['CROWD', 'DIALECT', 'SAFETY_HYGIENE']),
  crowdLevel: CrowdLevelSchema.optional(),
  estimatedWaitMinutes: z.number().int().min(0).max(240).optional(),
  dialectNote: z
    .object({
      language: z.string().min(1),
      script: z.string().min(1),
      transliteration: z.string().min(1),
      meaning: z.string().optional(),
    })
    .optional(),
  hygieneChecks: z
    .object({
      cleanPrepArea: z.boolean(),
      safeAccess: z.boolean(),
      fairLocalPricing: z.boolean(),
      soloTravelerSafe: z.boolean().optional(),
    })
    .optional(),
  note: z.string().max(400).optional(),
});

export type SubmitPlaceSignalInput = z.infer<typeof SubmitPlaceSignalInputSchema>;

/**
 * Computes the canonical Safety & Hygiene verification tier and earned badges
 * from AI baseline checks and distinct community peer endorsements.
 */
export function computeSafetyHygieneState(params: {
  aiEvidenceChecked: boolean;
  hasExplicitConcerns: boolean;
  endorserUids: string[];
  cleanPrepAreaCount: number;
  safeAccessCount: number;
  fairPricingCount: number;
  soloSafeCount: number;
  observations: string[];
  nowIso: string;
}): PlaceSafetyHygieneState {
  const endorsementCount = params.endorserUids.length;
  const totalCorroboratingSignals = (params.aiEvidenceChecked ? 1 : 0) + endorsementCount;

  let verificationTier: SafetyVerificationTier = 'UNVERIFIED';
  if (!params.hasExplicitConcerns) {
    if (totalCorroboratingSignals >= 2 && params.cleanPrepAreaCount >= 1 && params.safeAccessCount >= 1) {
      verificationTier = 'COMMUNITY_VERIFIED';
    } else if (params.aiEvidenceChecked || endorsementCount >= 1) {
      verificationTier = 'AI_EVIDENCE_CHECKED';
    }
  }

  const badges: string[] = [];
  if (!params.hasExplicitConcerns) {
    if (params.cleanPrepAreaCount >= 1) badges.push('CLEAN_KITCHEN_VISIBLE');
    if (params.safeAccessCount >= 1) badges.push('DAYTIME_SAFE');
    if (params.fairPricingCount >= 1) badges.push('FAIR_LOCAL_PRICING');
    if (params.soloSafeCount >= 1) badges.push('SOLO_FRIENDLY');
  }

  return {
    verificationTier,
    badges,
    endorsementCount,
    hasExplicitConcerns: params.hasExplicitConcerns,
    observations: params.observations.slice(0, 6),
    lastVerifiedAt: params.nowIso,
  };
}

/**
 * Callable: Community-submitPlaceSignal
 * Persists a community dialect phrase, safety/hygiene peer verification, or live crowd signal
 * into Firestore `community_signals` and updates `places/{placeId}` & `spots/{placeId}`.
 */
export const submitPlaceSignal = onCall(communityCallableOptions, async (request) => {
  const startMs = Date.now();
  const callerUid = request.auth?.uid;
  if (!callerUid) {
    throw new HttpsError('unauthenticated', 'Authentication required to submit community place signals.');
  }

  const parsed = SubmitPlaceSignalInputSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new HttpsError('invalid-argument', `Invalid signal payload: ${parsed.error.message}`);
  }

  const input = parsed.data;
  const nowIso = new Date().toISOString();
  const signalId = `csig_${randomUUID().replace(/-/g, '').slice(0, 12)}`;

  // 1. Handle CROWD signal via CrowdManagementService (which also persists to community_signals)
  if (input.signalType === 'CROWD') {
    if (!input.crowdLevel) {
      throw new HttpsError('invalid-argument', 'crowdLevel is required when signalType is CROWD.');
    }
    const crowdRes = await CrowdManagementService.submitCommunityCrowdSignal({
      placeId: input.placeId,
      crowdLevel: input.crowdLevel,
      estimatedWaitMinutes: input.estimatedWaitMinutes,
      travelerId: callerUid,
      note: input.note,
      allowMockFallback: false,
    });

    return successEnvelope(
      {
        signalId: crowdRes.signal.reportId,
        signalType: 'CROWD',
        placeId: input.placeId,
        updatedCrowdSummary: crowdRes.synthesizedEvaluation,
        rewardPointsEarned: crowdRes.rewardPointsEarned,
      },
      startMs
    );
  }

  // 2. Persist DIALECT or SAFETY_HYGIENE signal document
  const signalDoc = {
    signalId,
    placeId: input.placeId,
    signalType: input.signalType,
    reporterUid: callerUid,
    dialectNote: input.dialectNote ?? null,
    hygieneChecks: input.hygieneChecks ?? null,
    note: input.note ?? null,
    createdAt: nowIso,
  };
  await db.collection('community_signals').doc(signalId).set(signalDoc);

  // 3. Transactionally aggregate into safety_verifications/{placeId}, places/{placeId}, and spots/{placeId}
  const placeRef = db.collection('places').doc(input.placeId);
  const spotRef = db.collection('spots').doc(input.placeId);
  const safetyRef = db.collection('safety_verifications').doc(input.placeId);

  let updatedSafetyState: PlaceSafetyHygieneState | undefined;
  let updatedDialectPhrases: CommunityDialectPhrase[] | undefined;

  await db.runTransaction(async (tx) => {
    const [placeSnap, spotSnap, safetySnap] = await Promise.all([
      tx.get(placeRef),
      tx.get(spotRef),
      tx.get(safetyRef),
    ]);

    const placeData = (placeSnap.exists ? placeSnap.data() : spotSnap.exists ? spotSnap.data() : {}) || {};

    if (input.signalType === 'DIALECT') {
      if (!input.dialectNote) {
        throw new HttpsError('invalid-argument', 'dialectNote is required when signalType is DIALECT.');
      }
      const existingPhrases: CommunityDialectPhrase[] = Array.isArray(
        placeData?.communitySignals?.dialectPhrases
      )
        ? [...placeData.communitySignals.dialectPhrases]
        : [];

      const matchIdx = existingPhrases.findIndex(
        (p) =>
          p.transliteration.toLowerCase() === input.dialectNote!.transliteration.toLowerCase() ||
          p.script === input.dialectNote!.script
      );

      if (matchIdx >= 0) {
        const curr = existingPhrases[matchIdx]!;
        existingPhrases[matchIdx] = {
          ...curr,
          verifiedByCount: (curr.verifiedByCount || 1) + 1,
        };
      } else {
        existingPhrases.unshift({
          language: input.dialectNote.language,
          script: input.dialectNote.script,
          transliteration: input.dialectNote.transliteration,
          ...(input.dialectNote.meaning ? { meaning: input.dialectNote.meaning } : {}),
          verifiedByCount: 1,
        });
      }

      updatedDialectPhrases = existingPhrases.slice(0, 12);
      const patch = {
        communitySignals: {
          ...(placeData.communitySignals || {}),
          dialectPhrases: updatedDialectPhrases,
          activeReportsCount: ((placeData.communitySignals?.activeReportsCount as number) || 0) + 1,
        },
        updatedAt: nowIso,
      };
      if (placeSnap.exists) tx.set(placeRef, patch, { merge: true });
      if (spotSnap.exists) tx.set(spotRef, patch, { merge: true });
    } else if (input.signalType === 'SAFETY_HYGIENE') {
      if (!input.hygieneChecks) {
        throw new HttpsError('invalid-argument', 'hygieneChecks is required when signalType is SAFETY_HYGIENE.');
      }

      const safetyData = safetySnap.exists ? safetySnap.data() || {} : {};
      const endorserUids = new Set<string>(
        Array.isArray(safetyData.endorserUids) ? safetyData.endorserUids : []
      );
      const isNewEndorser = !endorserUids.has(callerUid);
      if (input.hygieneChecks.cleanPrepArea && input.hygieneChecks.safeAccess) {
        endorserUids.add(callerUid);
      }

      const cleanPrepAreaCount =
        (Number(safetyData.cleanPrepAreaCount) || 0) +
        (isNewEndorser && input.hygieneChecks.cleanPrepArea ? 1 : 0);
      const safeAccessCount =
        (Number(safetyData.safeAccessCount) || 0) +
        (isNewEndorser && input.hygieneChecks.safeAccess ? 1 : 0);
      const fairPricingCount =
        (Number(safetyData.fairPricingCount) || 0) +
        (isNewEndorser && input.hygieneChecks.fairLocalPricing ? 1 : 0);
      const soloSafeCount =
        (Number(safetyData.soloSafeCount) || 0) +
        (isNewEndorser && input.hygieneChecks.soloTravelerSafe ? 1 : 0);

      const aiEvidenceChecked = Boolean(
        safetyData.aiEvidenceChecked ??
          (placeData?.safetyHygiene?.verificationTier &&
            placeData.safetyHygiene.verificationTier !== 'UNVERIFIED')
      );
      const hasExplicitConcerns = Boolean(
        safetyData.hasExplicitConcerns ?? placeData?.safetyHygiene?.hasExplicitConcerns
      );
      const observations: string[] = Array.isArray(safetyData.observations)
        ? [...safetyData.observations]
        : Array.isArray(placeData?.safetyHygiene?.observations)
        ? [...placeData.safetyHygiene.observations]
        : [];
      if (input.note && input.note.trim().length > 0) {
        observations.unshift(input.note.trim());
      }

      updatedSafetyState = computeSafetyHygieneState({
        aiEvidenceChecked,
        hasExplicitConcerns,
        endorserUids: Array.from(endorserUids),
        cleanPrepAreaCount,
        safeAccessCount,
        fairPricingCount,
        soloSafeCount,
        observations,
        nowIso,
      });

      tx.set(
        safetyRef,
        {
          placeId: input.placeId,
          aiEvidenceChecked,
          hasExplicitConcerns,
          endorserUids: Array.from(endorserUids),
          cleanPrepAreaCount,
          safeAccessCount,
          fairPricingCount,
          soloSafeCount,
          observations: updatedSafetyState.observations,
          verificationTier: updatedSafetyState.verificationTier,
          badges: updatedSafetyState.badges,
          updatedAt: nowIso,
        },
        { merge: true }
      );

      const placePatch = {
        safetyHygiene: updatedSafetyState,
        isVerified:
          updatedSafetyState.verificationTier === 'COMMUNITY_VERIFIED' || Boolean(placeData.isVerified),
        updatedAt: nowIso,
      };
      if (placeSnap.exists) tx.set(placeRef, placePatch, { merge: true });
      if (spotSnap.exists) tx.set(spotRef, placePatch, { merge: true });
    }
  });

  logger.info('Community place signal recorded', {
    signalId,
    placeId: input.placeId,
    signalType: input.signalType,
    callerUid,
  });

  return successEnvelope(
    {
      signalId,
      placeId: input.placeId,
      signalType: input.signalType,
      updatedVerificationTier: updatedSafetyState?.verificationTier,
      updatedSafetyHygiene: updatedSafetyState,
      updatedDialectPhrases,
    },
    startMs
  );
});

/**
 * Callable: Community-getPlaceSignals
 * Retrieves aggregated community dialect phrases, safety/hygiene verification tier,
 * and recent community signals for a venue.
 */
export const getPlaceSignals = onCall(communityCallableOptions, async (request) => {
  const startMs = Date.now();
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'Authentication required.');
  }

  const placeId = (request.data as Record<string, unknown>)?.placeId;
  if (!placeId || typeof placeId !== 'string') {
    throw new HttpsError('invalid-argument', 'Valid placeId is required.');
  }

  const [safetySnap, signalsSnap] = await Promise.all([
    db.collection('safety_verifications').doc(placeId).get(),
    db
      .collection('community_signals')
      .where('placeId', '==', placeId)
      .orderBy('createdAt', 'desc')
      .limit(20)
      .get(),
  ]);

  const safetyVerification = safetySnap.exists ? safetySnap.data() : null;
  const recentSignals = signalsSnap.docs.map((d) => {
    const raw = d.data();
    // Strip reporterUid from public list to protect contributor privacy
    const { reporterUid: _omit, ...publicSignal } = raw;
    return publicSignal;
  });

  return successEnvelope(
    {
      placeId,
      safetyVerification,
      recentSignals,
    },
    startMs
  );
});
