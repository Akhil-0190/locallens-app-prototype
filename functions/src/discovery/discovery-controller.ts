/**
 * Discovery & Vector Matchmaking Controller — Firebase Callable Functions
 * Stage 2 (Promises #7, #8, #9, #10):
 *   - Discovery-matchSoloSpots:
 *       Uses Gemini Embedding 2 (`gemini-embedding-2`) semantic/multimodal vector similarity,
 *       live Google Weather API rules, live venue open-status, and real-time Firestore
 *       hourly crowd caps to rank authentic local spots for a solo traveler.
 *   - Discovery-matchGroupSpots:
 *       Loads live Firestore `group_sessions/{sessionId}`, blends all members' tastes &
 *       strict dietary/budget/pace constraints via `executeGroupBlendingSkill` + centroid
 *       `gemini-embedding-2` vectors, checks group-sized hourly capacity slots, and returns
 *       consensus-ranked spots.
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { FieldValue } from 'firebase-admin/firestore';
import * as logger from 'firebase-functions/logger';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { db } from '../config/firebase.js';
import { geminiApiKey, mapsApiKey } from '../config/secrets.js';
import { ApiSuccessResponse } from '../types/contracts/index.js';
import {
  generateMultimodalEmbedding,
  computeCosineSimilarity,
  FIRESTORE_VECTOR_DIMENSIONS,
} from '../ai/services/embedding-service.js';
import { getPreferences, getDefaultPreferences } from '../preferences/preferences-service.js';
import { getGroupSessionById, saveConsensusBlend } from '../groups/groups-service.js';
import { deriveSlotId, getHourlyCapacity } from '../capacity/capacity-service.js';
import { WeatherService } from '../maps/services/weather.service.js';
import { CrowdManagementService } from '../maps/services/crowd-management.service.js';
import { executeGroupBlendingSkill } from '../ai/skills/skill-group-blending.js';

const discoveryCallableOptions = {
  secrets: [geminiApiKey, mapsApiKey],
  memory: '512MiB' as const,
};

const weatherService = new WeatherService();

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
      version: 'STAGE2-DISCOVERY',
    },
  };
}

const MatchSoloInputSchema = z.object({
  neighborhood: z.string().optional(),
  coordinate: z
    .object({
      latitude: z.number(),
      longitude: z.number(),
    })
    .optional(),
  queryText: z.string().optional(),
  vibes: z.array(z.string()).optional(),
  dietaryRestrictions: z.array(z.string()).optional(),
  maxBudgetPerMealInr: z.number().optional(),
  intendedVisitTimeIso: z.string().optional(),
  partySize: z.number().int().min(1).max(20).default(1),
});

const MatchGroupInputSchema = z.object({
  sessionId: z.string().min(1),
  neighborhood: z.string().optional(),
  coordinate: z
    .object({
      latitude: z.number(),
      longitude: z.number(),
    })
    .optional(),
  intendedVisitTimeIso: z.string().optional(),
});

interface LoadedCandidatePlace {
  id: string;
  raw: Record<string, any>;
  embeddingValues?: number[];
}

async function loadCandidatePlaces(neighborhood?: string): Promise<LoadedCandidatePlace[]> {
  const results = new Map<string, LoadedCandidatePlace>();

  for (const col of ['places', 'spots']) {
    let query: FirebaseFirestore.Query = db.collection(col);
    if (neighborhood && neighborhood.trim().length > 0) {
      query = query.where('neighborhood', '==', neighborhood.trim());
    }
    const snap = await query.limit(60).get();
    for (const doc of snap.docs) {
      if (!results.has(doc.id)) {
        const data = doc.data();
        const embValues = Array.isArray(data.embeddingValues)
          ? (data.embeddingValues as number[])
          : undefined;
        results.set(doc.id, { id: doc.id, raw: data, embeddingValues: embValues });
      }
    }
  }

  // If neighborhood filter returned 0 exact matches, try broader load and filter case-insensitively
  if (results.size === 0 && neighborhood && neighborhood.trim().length > 0) {
    const hoodLower = neighborhood.trim().toLowerCase();
    for (const col of ['places', 'spots']) {
      const snap = await db.collection(col).limit(60).get();
      for (const doc of snap.docs) {
        if (results.has(doc.id)) continue;
        const data = doc.data();
        const addr = String(data.formattedAddress || '').toLowerCase();
        const hood = String(data.neighborhood || '').toLowerCase();
        if (addr.includes(hoodLower) || hood.includes(hoodLower)) {
          const embValues = Array.isArray(data.embeddingValues)
            ? (data.embeddingValues as number[])
            : undefined;
          results.set(doc.id, { id: doc.id, raw: data, embeddingValues: embValues });
        }
      }
    }
  }

  return Array.from(results.values());
}

async function ensurePlaceEmbedding(candidate: LoadedCandidatePlace): Promise<number[]> {
  if (candidate.embeddingValues && candidate.embeddingValues.length > 0) {
    return candidate.embeddingValues;
  }

  const r = candidate.raw;
  const vibes = Array.isArray(r.authenticity?.vibeTags)
    ? r.authenticity.vibeTags.join(', ')
    : Array.isArray(r.vibeTags)
    ? r.vibeTags.join(', ')
    : '';
  const mustTry = Array.isArray(r.mustTryItems) ? r.mustTryItems.join(', ') : '';
  const text = `${r.spotName || r.name || candidate.id}. ${r.infoParagraph || ''}. Category: ${r.primaryCategory || ''}. Must try: ${mustTry}. Vibes: ${vibes}. Address: ${r.formattedAddress || ''}`;

  const emb = await generateMultimodalEmbedding({
    text,
    outputDimensionality: FIRESTORE_VECTOR_DIMENSIONS,
    allowTestAdapterFallback: true,
  });

  // Lazily cache vector back into Firestore so subsequent searches are instant
  if (!emb.isOfflineMock && emb.values.length === FIRESTORE_VECTOR_DIMENSIONS) {
    const vectorPatch = {
      embeddingVector: FieldValue.vector(emb.values),
      embeddingValues: emb.values,
    };
    db.collection('places').doc(candidate.id).set(vectorPatch, { merge: true }).catch(() => {});
  }

  return emb.values;
}

function isOutdoorExposed(place: Record<string, any>): boolean {
  const tags: string[] = [
    String(place.primaryCategory || ''),
    ...(Array.isArray(place.categories) ? place.categories : []),
    ...(Array.isArray(place.authenticity?.vibeTags) ? place.authenticity.vibeTags : []),
  ].map((s) => s.toLowerCase());

  return tags.some(
    (t) =>
      t.includes('park') ||
      t.includes('garden') ||
      t.includes('outdoor') ||
      t.includes('market') ||
      t.includes('walk') ||
      t.includes('tank')
  );
}

/**
 * Callable: Discovery-matchSoloSpots
 */
export const matchSoloSpots = onCall(discoveryCallableOptions, async (request) => {
  const startMs = Date.now();
  const callerUid = request.auth?.uid;
  if (!callerUid) {
    throw new HttpsError('unauthenticated', 'Authentication required for AI taste matching.');
  }

  const parsed = MatchSoloInputSchema.safeParse(request.data || {});
  if (!parsed.success) {
    throw new HttpsError('invalid-argument', `Invalid solo match input: ${parsed.error.message}`);
  }
  const input = parsed.data;
  const intendedVisitIso = input.intendedVisitTimeIso || new Date().toISOString();
  const slotHourIso = CrowdManagementService.normalizeHourSlot(intendedVisitIso);
  const slotId = deriveSlotId(slotHourIso);

  // 1. Load saved user preferences from Firestore (or defaults)
  const savedPrefs = (await getPreferences(callerUid)) || getDefaultPreferences(callerUid);
  const vibes = input.vibes && input.vibes.length > 0 ? input.vibes : savedPrefs.favoriteVibes;
  const diets =
    input.dietaryRestrictions && input.dietaryRestrictions.length > 0
      ? input.dietaryRestrictions
      : savedPrefs.dietaryRestrictions;
  const budget = input.maxBudgetPerMealInr ?? savedPrefs.maxBudgetPerMealInr;

  // 2. Live Weather API check
  const coord = input.coordinate || { latitude: 12.9982, longitude: 77.5695 };
  const weather = await weatherService.getWeatherCondition({
    location: coord,
    intendedVisitTime: intendedVisitIso,
    allowMockFallback: false,
  });

  // 3. Build Gemini Embedding 2 query vector
  const queryPrompt = [
    input.queryText || '',
    `Vibes: ${vibes.join(', ')}`,
    diets.length > 0 ? `Dietary requirements: ${diets.join(', ')}` : '',
    `Budget up to INR ${budget}`,
    input.neighborhood ? `Neighborhood: ${input.neighborhood}` : '',
    weather.isWalkingImpaired ? 'Prefer indoor sheltered cafes and covered eateries due to weather' : '',
  ]
    .filter(Boolean)
    .join('. ');

  const queryEmbedding = await generateMultimodalEmbedding({
    text: queryPrompt || 'authentic local neighborhood gem',
    outputDimensionality: FIRESTORE_VECTOR_DIMENSIONS,
    allowTestAdapterFallback: true,
  });

  // 4. Load Firestore places & score via Gemini Embedding 2 cosine similarity + live hourly capacity + weather rules
  const candidates = await loadCandidatePlaces(input.neighborhood);
  const scoredSpots = [];

  for (const cand of candidates) {
    const r = cand.raw;
    const isTrap = Boolean(r.authenticity?.isTouristTrap ?? r.isTouristTrap);
    if (isTrap) continue;

    const placeVec = await ensurePlaceEmbedding(cand);
    const similarity = computeCosineSimilarity(queryEmbedding.values, placeVec);

    // Live hourly capacity check from Firestore `places/{id}/hourly_capacities/{slotId}`
    let hourlyLimit = Number(r.capacity?.hourlyLimit ?? r.hourlyLimit ?? 10);
    let currentVisitors = Number(r.capacity?.currentVisitors ?? r.currentVisitors ?? 0);
    let remainingSlots = Math.max(0, hourlyLimit - currentVisitors);
    let crowdLevel = String(r.capacity?.crowdLevel ?? r.crowdLevel ?? 'LOW');
    let isThrottled = Boolean(r.capacity?.isThrottled ?? false);

    try {
      const liveCap = await getHourlyCapacity(cand.id, slotId);
      if (liveCap) {
        hourlyLimit = liveCap.maxCapacity;
        currentVisitors = liveCap.currentVisitorsCount;
        remainingSlots = liveCap.remainingCapacity;
        crowdLevel = liveCap.level;
        isThrottled = liveCap.isThrottled || remainingSlots < input.partySize;
      }
    } catch {
      // Retain place document capacity snapshot if no hourly slot document exists yet
    }

    // Apply live weather rule penalty if outdoor & weather is impaired
    let weatherPenalty = 0;
    const outdoor = isOutdoorExposed(r);
    if (weather.isWalkingImpaired && outdoor) {
      weatherPenalty = 0.25;
    }

    // Venue closure rule penalty
    const isClosedNow = r.isOpenNow === false;
    const closurePenalty = isClosedNow ? 0.35 : 0;
    const capacityPenalty = isThrottled ? 0.3 : 0;

    const finalScore = Math.max(0, Math.min(1, similarity - weatherPenalty - closurePenalty - capacityPenalty));
    const matchPercent = Math.round(finalScore * 100);

    const reasons: string[] = [`${Math.round(similarity * 100)}% Gemini Embedding 2 taste similarity`];
    if (weather.isWalkingImpaired && !outdoor) {
      reasons.push('Indoor/sheltered pick suited for current weather');
    } else if (weather.isWalkingImpaired && outdoor) {
      reasons.push(`Weather caution (${weather.condition})`);
    }
    if (isClosedNow) {
      reasons.push('Currently closed per Google Maps hours');
    }
    if (!isThrottled) {
      reasons.push(`${remainingSlots}/${hourlyLimit} hourly slots open`);
    } else {
      reasons.push('Hourly crowd cap reached');
    }

    scoredSpots.push({
      spot: {
        ...r,
        id: cand.id,
        placeId: cand.id,
        capacity: {
          ...(r.capacity || {}),
          hourlyLimit,
          currentVisitors,
          remainingCapacity: remainingSlots,
          crowdLevel,
          isThrottled,
          lastUpdatedSlot: slotHourIso,
        },
        isMockData: false,
      },
      embeddingSimilarityScore: Number(similarity.toFixed(4)),
      finalMatchPercent: matchPercent,
      remainingHourlySlots: remainingSlots,
      hourlyCapacityCap: hourlyLimit,
      slotId,
      isOpenNow: r.isOpenNow ?? null,
      whyMatched: reasons.join(' • '),
    });
  }

  scoredSpots.sort((a, b) => b.finalMatchPercent - a.finalMatchPercent);

  logger.info('Discovery-matchSoloSpots completed', {
    uid: callerUid,
    candidateCount: candidates.length,
    returnedCount: scoredSpots.length,
    model: queryEmbedding.model,
    weatherCondition: weather.condition,
  });

  return successEnvelope(
    {
      modelUsed: queryEmbedding.model,
      slotId,
      weatherContext: {
        condition: weather.condition,
        isWalkingImpaired: weather.isWalkingImpaired,
        temperatureCelsius: weather.temperatureCelsius,
        advisory: weather.advisory || null,
      },
      spots: scoredSpots,
    },
    startMs
  );
});

/**
 * Callable: Discovery-matchGroupSpots
 */
export const matchGroupSpots = onCall(discoveryCallableOptions, async (request) => {
  const startMs = Date.now();
  const callerUid = request.auth?.uid;
  if (!callerUid) {
    throw new HttpsError('unauthenticated', 'Authentication required for Group Taste Matchmaking.');
  }

  const parsed = MatchGroupInputSchema.safeParse(request.data || {});
  if (!parsed.success) {
    throw new HttpsError('invalid-argument', `Invalid group match input: ${parsed.error.message}`);
  }
  const input = parsed.data;

  // 1. Load live Group Session from Firestore & verify membership
  const session = await getGroupSessionById(input.sessionId);
  if (!session) {
    throw new HttpsError('not-found', `Group session ${input.sessionId} not found.`);
  }
  const isMember =
    session.hostUserId === callerUid || session.members.some((m) => m.userId === callerUid);
  if (!isMember) {
    throw new HttpsError('permission-denied', 'Only group members may run group matchmaking.');
  }

  const intendedVisitIso = input.intendedVisitTimeIso || new Date().toISOString();
  const slotHourIso = CrowdManagementService.normalizeHourSlot(intendedVisitIso);
  const slotId = deriveSlotId(slotHourIso);
  const targetNeighborhood = input.neighborhood || session.neighborhood;

  // 2. Run Group Blending Skill (strict dietary union + budget/pace harmony + Gemini Embedding 2 cohesion)
  const blendResult = await executeGroupBlendingSkill({
    sessionId: session.sessionId,
    sessionCode: session.sessionCode,
    members: session.members.map((m) => ({
      userId: m.userId,
      displayName: m.displayName,
      vibes: m.vibes,
      dietaryRestrictions: m.dietaryRestrictions,
      maxBudgetAmount: m.maxBudgetAmount,
      budgetTier:
        m.maxBudgetAmount <= 300 ? 'BUDGET' : m.maxBudgetAmount >= 1000 ? 'PREMIUM' : 'MODERATE',
      preferredPace: 'MODERATE',
    })),
  });

  // 3. Compute centroid Gemini Embedding 2 vector across all group members
  const memberVectors = await Promise.all(
    session.members.map((m) =>
      generateMultimodalEmbedding({
        text: `Vibes: ${m.vibes.join(', ')}. Dietary: ${m.dietaryRestrictions.join(', ')}. Budget INR ${m.maxBudgetAmount}. Neighborhood: ${targetNeighborhood}`,
        outputDimensionality: FIRESTORE_VECTOR_DIMENSIONS,
        allowTestAdapterFallback: true,
      })
    )
  );

  const dims = memberVectors[0]?.values.length || FIRESTORE_VECTOR_DIMENSIONS;
  const centroid = new Array<number>(dims).fill(0);
  for (const mv of memberVectors) {
    for (let i = 0; i < dims; i++) {
      centroid[i] += (mv.values[i] || 0) / memberVectors.length;
    }
  }

  // 4. Live Weather check
  const coord = input.coordinate || { latitude: 12.9982, longitude: 77.5695 };
  const weather = await weatherService.getWeatherCondition({
    location: coord,
    intendedVisitTime: intendedVisitIso,
    allowMockFallback: false,
  });

  // 5. Rank spots against group centroid + party-size hourly crowd cap + weather + dietary union
  const candidates = await loadCandidatePlaces(targetNeighborhood);
  const partySize = Math.max(1, session.members.length);
  const scoredSpots = [];

  for (const cand of candidates) {
    const r = cand.raw;
    const isTrap = Boolean(r.authenticity?.isTouristTrap ?? r.isTouristTrap);
    if (isTrap) continue;

    const placeVec = await ensurePlaceEmbedding(cand);
    const consensusSim = computeCosineSimilarity(centroid, placeVec);

    const perMemberFit: Record<string, number> = {};
    session.members.forEach((m, idx) => {
      const mVec = memberVectors[idx]?.values || centroid;
      perMemberFit[m.userId] = Math.round(computeCosineSimilarity(mVec, placeVec) * 100);
    });

    let hourlyLimit = Number(r.capacity?.hourlyLimit ?? r.hourlyLimit ?? 10);
    let currentVisitors = Number(r.capacity?.currentVisitors ?? r.currentVisitors ?? 0);
    let remainingSlots = Math.max(0, hourlyLimit - currentVisitors);
    let crowdLevel = String(r.capacity?.crowdLevel ?? r.crowdLevel ?? 'LOW');
    let isThrottled = remainingSlots < partySize;

    try {
      const liveCap = await getHourlyCapacity(cand.id, slotId);
      if (liveCap) {
        hourlyLimit = liveCap.maxCapacity;
        currentVisitors = liveCap.currentVisitorsCount;
        remainingSlots = liveCap.remainingCapacity;
        crowdLevel = liveCap.level;
        isThrottled = liveCap.isThrottled || remainingSlots < partySize;
      }
    } catch {
      // Keep snapshot capacity
    }

    const outdoor = isOutdoorExposed(r);
    const weatherPenalty = weather.isWalkingImpaired && outdoor ? 0.25 : 0;
    const capacityPenalty = isThrottled ? 0.35 : 0;
    const finalScore = Math.max(0, Math.min(1, consensusSim - weatherPenalty - capacityPenalty));

    scoredSpots.push({
      spot: {
        ...r,
        id: cand.id,
        placeId: cand.id,
        capacity: {
          ...(r.capacity || {}),
          hourlyLimit,
          currentVisitors,
          remainingCapacity: remainingSlots,
          crowdLevel,
          isThrottled,
          lastUpdatedSlot: slotHourIso,
        },
        isMockData: false,
      },
      groupConsensusScore: Math.round(finalScore * 100),
      perMemberFit,
      remainingHourlySlots: remainingSlots,
      hourlyCapacityCap: hourlyLimit,
      slotId,
      isOpenNow: r.isOpenNow ?? null,
      whyMatched: `${Math.round(consensusSim * 100)}% squad consensus across ${partySize} profiles • ${remainingSlots}/${hourlyLimit} slots open`,
    });
  }

  scoredSpots.sort((a, b) => b.groupConsensusScore - a.groupConsensusScore);

  // Persist consensus blend back to Firestore `group_sessions/{sessionId}`
  try {
    await saveConsensusBlend(
      session.sessionId,
      {
        consensusAtmosphere: blendResult.consensusBlend.consensusAtmosphere,
        dietaryConstraintsUnion: blendResult.consensusBlend.dietaryConstraintsUnion,
        budgetConsensusRange: blendResult.consensusBlend.budgetConsensusRange,
        individualWeightings: blendResult.consensusBlend.individualWeightings,
        compromiseFactors: blendResult.consensusBlend.compromiseFactors,
        recommendedCategoryFocus: blendResult.consensusBlend.recommendedCategoryFocus,
      },
      scoredSpots.slice(0, 10).map((s) => s.spot.id)
    );
  } catch {
    // Non-blocking save
  }

  return successEnvelope(
    {
      sessionId: session.sessionId,
      sessionCode: session.sessionCode,
      memberCount: partySize,
      groupCohesionScore: blendResult.groupCohesionScore,
      blendedVibeSummary: blendResult.explanationSummary,
      dietaryUnion: blendResult.consensusBlend.dietaryUnion,
      conflictWarnings: blendResult.conflictWarnings,
      slotId,
      weatherContext: {
        condition: weather.condition,
        isWalkingImpaired: weather.isWalkingImpaired,
        temperatureCelsius: weather.temperatureCelsius,
        advisory: weather.advisory || null,
      },
      spots: scoredSpots,
    },
    startMs
  );
});
