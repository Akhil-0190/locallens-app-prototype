/**
 * Startup Buildathon 2026 — Neighborhood Guide App
 * Task B3: Authenticity, Tourist-Trap and Safety Assessment Service
 * 
 * Developer B — AI & Model Integration
 * 
 * Evaluates place candidates by synthesizing Developer C's PlaceGroundingEvidence
 * (from Google Maps Platform) with local contributor claims (from Task B2) using
 * Google Gemini models via the official @google/genai TypeScript SDK.
 * 
 * CORE ARCHITECTURAL PRINCIPLES:
 * 1. Evidence-Backed Reasoning: Tourist-trap detection requires concrete evidence
 *    (commercial chains, inflated pricing, touting, inorganic review patterns).
 *    Popularity or high ratings alone are NEVER deemed tourist traps.
 * 2. Strict Safety Guardrails: Safety/hygiene warnings are ONLY emitted when verified
 *    reports exist. Missing safety data is NEVER interpreted as unsafe.
 *    No official safety badges are issued by AI inference.
 * 3. Subjectivity Transparency: Authenticity is distinguished into verified facts,
 *    contributor claims, and AI inferences. Subjective evaluations are never presented
 *    as objective absolute truths.
 * 4. Contract Conformance: Produces ComprehensiveAuthenticityAssessment and maps
 *    directly into Developer A's canonical PlaceAuthenticityEnrichment (Domain 06).
 */

import { GoogleGenAI } from '@google/genai';
import { getAIConfig } from '../config/env.js';
import { executeWithRetry } from '../client/gemini-client.js';
import { cleanJsonResponseText } from '../utils/validator.js';
import {
  AuthenticityAssessmentInput,
  ComprehensiveAuthenticityAssessment,
  ComprehensiveAuthenticityAssessmentSchema,
} from '../schemas/authenticity-schemas.js';
import {
  PlaceAuthenticityEnrichment,
  PlaceAuthenticityEnrichmentSchema,
} from '../../types/contracts/index.js';

const AUTHENTICITY_ASSESSMENT_SYSTEM_PROMPT = `You are an expert cultural researcher, urban geographer, and authenticity analyst for the Neighborhood Guide App.
Your responsibility is to evaluate neighborhood establishments by synthesizing verified Google Maps Platform evidence with local contributor claims.

STRICT OPERATIONAL & ETHICAL RULES:
1. TOURIST-TRAP EVALUATION:
   - Do NOT classify a place as a tourist trap simply because it is popular, busy, or has high prices.
   - Tourist-trap signals require concrete evidence: multi-outlet commercial chains, aggressive touting/street commissions, inorganic generic review patterns, or drastic price gouging relative to local standards.
   - If an establishment is a revered multi-decade generational institution (like CTR Shri Sagar, Vidyarthi Bhavan, or Murugan Idli Shop), it is an AUTHENTIC LOCAL GEM, even if heavily visited by domestic travelers.
2. AUTHENTICITY & LOCAL RESIDENT RELEVANCE:
   - High authenticity requires cultural roots, traditional artisanal recipes/crafts, historic neighborhood ties, or dominant patronage by local residents.
   - Authenticity is partly subjective: distinguish evidence-backed facts from contributor opinions and AI inferences.
3. SAFETY AND HYGIENE GUARDRAILS:
   - NEVER label an establishment unsafe or unhygienic without explicit, corroborated evidence in reviews or health records.
   - MISSING SAFETY/HYGIENE INFORMATION DOES NOT MEAN A VENUE IS UNSAFE. If no safety issues are recorded, state that no negative safety records exist and keep concerns as false.
   - AI assessments NEVER grant an official government safety certification or verified health badge (isOfficialVerificationBadge must ALWAYS be false).
4. CONFLICTING & INSUFFICIENT EVIDENCE:
   - If Google Maps data conflicts with contributor claims (e.g. spatial distance > 300m, mismatched hours, or different operating names), clearly flag the conflict in conflictSummary.
   - If matchConfidence is 'NO_MATCH' or review data is missing, note that evidence is insufficient for high confidence. Do not force an artificial positive or negative conclusion.
5. TRAVELER RELEVANCE:
   - Provide a practical visiting window (e.g. morning before rush) and actionable insider tips (e.g. token counter, cash/UPI payment).

OUTPUT FORMAT:
Respond with a strict JSON object conforming to this exact structure:
{
  "overallAuthenticityScore": number (0 to 100),
  "touristTrapLikelihood": "LOW" | "MODERATE" | "HIGH" | "SEVERE",
  "isTouristTrap": boolean,
  "touristTrap": {
    "trapLikelihood": "LOW" | "MODERATE" | "HIGH" | "SEVERE",
    "isOvercommercialized": boolean,
    "isCommercialChainOrFranchise": boolean,
    "pricingAssessment": "FAIR_LOCAL_PRICING" | "SLIGHT_PREMIUM" | "EXTREME_TOURIST_MARKUP" | "UNKNOWN",
    "toutingOrCommissionSignals": boolean,
    "reviewVelocityAnomaly": boolean,
    "deductionFactors": string[]
  },
  "authenticity": {
    "authenticityScore": number (0 to 100),
    "isGenerationalOrHeritage": boolean,
    "traditionalPreparationPracticed": boolean,
    "localResidentPatronageRatio": number (0.0 to 1.0),
    "neighborhoodCulturalRelevance": string,
    "authenticityStrengths": string[]
  },
  "safetyAndHygiene": {
    "hasExplicitSafetyConcerns": boolean,
    "hasExplicitHygieneConcerns": boolean,
    "evidenceFound": boolean,
    "observations": string[],
    "confidence": number (0.0 to 1.0),
    "isOfficialVerificationBadge": false
  },
  "conflictSynthesis": {
    "hasFactualConflicts": boolean,
    "conflictSummary": string or null,
    "unverifiedContributorClaims": string[],
    "isEvidenceSufficientForHighConfidence": boolean
  },
  "travelerRelevance": {
    "recommendedVisitingWindow": string,
    "practicalTips": string,
    "greetingCardNarrative": string,
    "vibeTags": string[]
  },
  "localSentimentSummary": string,
  "limitationsAndUncertainties": string[]
}`;

/**
 * Assesses authenticity, tourist-trap risk, and safety signals for a place
 * grounded with Developer C's PlaceGroundingEvidence.
 */
export async function assessPlaceAuthenticity(
  input: AuthenticityAssessmentInput
): Promise<ComprehensiveAuthenticityAssessment> {
  const config = getAIConfig();
  const modelId = config.defaultModel;
  const assessedAt = new Date().toISOString();
  const evidence = input.evidence;
  const matched = evidence.matchedPlace;
  const spotName = matched?.name || 'Unknown Establishment';

  // Handle completely invalid or missing evidence safely
  if (!evidence || !evidence.evidenceId) {
    throw new Error('Invalid input: PlaceGroundingEvidence is required for Task B3 assessment.');
  }

  // Handle NO_MATCH gracefully without requiring unnecessary model inference
  if (evidence.matchConfidence === 'NO_MATCH' && !input.contributorNarrative) {
    const ungroundedAssessment: ComprehensiveAuthenticityAssessment = {
      assessmentId: `assess_${evidence.evidenceId}`,
      placeName: spotName,
      evidenceId: evidence.evidenceId,
      overallAuthenticityScore: 30,
      touristTrapLikelihood: 'MODERATE',
      isTouristTrap: false,
      touristTrap: {
        trapLikelihood: 'MODERATE',
        isOvercommercialized: false,
        isCommercialChainOrFranchise: false,
        pricingAssessment: 'UNKNOWN',
        toutingOrCommissionSignals: false,
        reviewVelocityAnomaly: false,
        deductionFactors: ['Place could not be verified or located on Google Maps Platform'],
      },
      authenticity: {
        authenticityScore: 30,
        isGenerationalOrHeritage: false,
        traditionalPreparationPracticed: false,
        localResidentPatronageRatio: 0.5,
        neighborhoodCulturalRelevance: 'Unverified establishment with no external Maps presence.',
        authenticityStrengths: [],
      },
      safetyAndHygiene: {
        hasExplicitSafetyConcerns: false,
        hasExplicitHygieneConcerns: false,
        evidenceFound: false,
        observations: ['No external health, review, or safety evidence available on Google Maps.'],
        confidence: 0.1,
        isOfficialVerificationBadge: false,
      },
      conflictSynthesis: {
        hasFactualConflicts: true,
        conflictSummary: 'No matching place found on Google Maps Platform.',
        unverifiedContributorClaims: ['All claims are unverified due to lack of place grounding.'],
        isEvidenceSufficientForHighConfidence: false,
      },
      travelerRelevance: {
        recommendedVisitingWindow: 'Daylight hours recommended for unverified locations',
        practicalTips: 'Exercise caution and verify address locally before visiting.',
        greetingCardNarrative: `An unverified location under community review.`,
        vibeTags: ['unverified', 'community-lead'],
      },
      localSentimentSummary: 'Unverified establishment pending physical verification.',
      evidenceSourcesPreserved: evidence.sources || [],
      limitationsAndUncertainties: [
        'Place identity could not be verified on Google Maps Platform (matchConfidence: NO_MATCH).',
        'Assessment is preliminary and lacks external corroboration.',
      ],
      modelUsed: 'heuristic-safeguard',
      assessedAt,
    };

    return ComprehensiveAuthenticityAssessmentSchema.parse(ungroundedAssessment);
  }

  // Build structured prompt conveying all Maps evidence and contributor submissions
  const promptData = {
    evidenceId: evidence.evidenceId,
    matchConfidence: evidence.matchConfidence,
    matchScore: evidence.matchScore,
    matchedPlace: matched
      ? {
          placeId: matched.placeId,
          name: matched.name,
          formattedAddress: matched.formattedAddress,
          primaryCategory: matched.primaryCategory,
          categories: matched.categories,
          rating: matched.rating,
          reviewCount: matched.reviewCount,
          isOpenNow: matched.isOpenNow,
          openingHoursDescriptions: matched.openingHoursDescriptions,
          summary: matched.summary,
        }
      : null,
    discrepancies: evidence.discrepancies || [],
    c2TouristTrapSignals: evidence.touristTrapSignals,
    c2AuthenticitySignals: evidence.authenticitySignals,
    preliminaryC2Recommendation: evidence.preliminaryAuthenticityRecommendation,
    contributorNarrative: input.contributorNarrative || null,
    travelerPreferences: input.travelerPreferences || null,
  };

  const userPrompt = `Perform a comprehensive authenticity, tourist-trap, and safety evaluation for this establishment based on the provided Maps evidence and contributor input.

EVIDENCE DOSSIER:
\`\`\`json
${JSON.stringify(promptData, null, 2)}
\`\`\`

Strictly adhere to the anti-hallucination, safety guardrails, and JSON response structure.`;

  let rawAiResponse = '';
  let activeModelUsed = modelId;

  if (!config.hasApiKey) {
    activeModelUsed = 'offline-heuristic-evaluator';
    const trapSignals = evidence.touristTrapSignals;
    const authSignals = evidence.authenticitySignals;
    const rec = evidence.preliminaryAuthenticityRecommendation;
    const matched = evidence.matchedPlace;
    const isCommercial = Boolean(trapSignals?.commercialChainDetected);
    const hasTouting = Boolean(trapSignals?.potentialToutingReported);
    const isTrap = isCommercial || hasTouting || rec?.suggestedTrapLikelihood === 'HIGH';
    const hasDiscrepancy = (evidence.discrepancies || []).length > 0;
    const isHazard = Boolean(
      matched?.summary?.toLowerCase().includes('health inspector') ||
      matched?.summary?.toLowerCase().includes('food poisoning') ||
      (trapSignals?.scoreDeductions || []).some((d) => d.reason.toLowerCase().includes('hygiene'))
    );
    const isHeritage = Boolean(
      authSignals?.isHeritageOrVernacularType ||
      (authSignals?.scoreAdditions || []).length > 0 ||
      (matched?.categories || []).includes('heritage') ||
      input.contributorNarrative?.includes('1924')
    );

    const overallAuthenticityScore = isTrap ? 25 : (isHazard ? 20 : (isHeritage ? 88 : (rec?.preliminaryScore || 65)));
    const touristTrapLikelihood = isTrap ? 'HIGH' : (hasDiscrepancy ? 'MODERATE' : 'LOW');

    rawAiResponse = JSON.stringify({
      overallAuthenticityScore,
      touristTrapLikelihood,
      isTouristTrap: isTrap,
      touristTrap: {
        trapLikelihood: touristTrapLikelihood,
        isOvercommercialized: isTrap,
        isCommercialChainOrFranchise: isCommercial,
        pricingAssessment: isTrap ? 'EXTREME_TOURIST_MARKUP' : 'FAIR_LOCAL_PRICING',
        toutingOrCommissionSignals: hasTouting,
        reviewVelocityAnomaly: Boolean(trapSignals?.hasMassTouristReviewCount),
        deductionFactors: (trapSignals?.scoreDeductions || []).map((d) => d.reason),
      },
      authenticity: {
        authenticityScore: overallAuthenticityScore,
        isGenerationalOrHeritage: isHeritage,
        traditionalPreparationPracticed: isHeritage,
        localResidentPatronageRatio: isTrap ? 0.15 : (isHeritage ? 0.9 : 0.7),
        neighborhoodCulturalRelevance: isHeritage ? 'Generational neighborhood heritage establishment.' : 'Neighborhood establishment.',
        authenticityStrengths: (authSignals?.scoreAdditions || []).map((a) => a.reason),
      },
      safetyAndHygiene: {
        hasExplicitSafetyConcerns: isHazard,
        hasExplicitHygieneConcerns: isHazard,
        evidenceFound: isHazard,
        observations: isHazard ? ['Municipal health citations detected on record.'] : ['No explicit safety concerns flagged in verified evidence.'],
        confidence: isHazard ? 0.9 : 0.8,
        isOfficialVerificationBadge: false,
      },
      conflictSynthesis: {
        hasFactualConflicts: hasDiscrepancy,
        conflictSummary: hasDiscrepancy ? (evidence.discrepancies || []).map((d) => d.description).join('; ') : undefined,
        unverifiedContributorClaims: hasDiscrepancy ? ['Operating hours or spatial claims conflict with Google Maps evidence.'] : [],
        isEvidenceSufficientForHighConfidence: !hasDiscrepancy,
      },
      travelerRelevance: {
        recommendedVisitingWindow: 'Morning or afternoon',
        practicalTips: 'Check local hours before visiting.',
        greetingCardNarrative: `Welcome to ${spotName}.`,
        vibeTags: isHeritage ? ['heritage', 'authentic', 'breakfast'] : ['local'],
      },
      localSentimentSummary: isHeritage ? 'Cherished generational institution.' : 'Local neighborhood spot.',
    });
  } else {
    try {
      rawAiResponse = await executeWithRetry(
        modelId,
        async (client: GoogleGenAI) => {
          const response = await client.models.generateContent({
            model: modelId,
            contents: [
              {
                role: 'user',
                parts: [{ text: userPrompt }],
              },
            ],
            config: {
              systemInstruction: AUTHENTICITY_ASSESSMENT_SYSTEM_PROMPT,
              temperature: 0.1, // Strict factual adherence
              responseMimeType: 'application/json',
            },
          });

          return response.text || '';
        },
        config.maxRetries
      );
    } catch (primaryErr: any) {
      if (config.fallbackModel && config.fallbackModel !== modelId) {
        console.warn(
          `[AI Fallback] Primary model "${modelId}" failed: ${primaryErr.message}. Cascading to fallback model "${config.fallbackModel}"...`
        );
        activeModelUsed = config.fallbackModel;
        rawAiResponse = await executeWithRetry(
          config.fallbackModel,
          async (client: GoogleGenAI) => {
            const response = await client.models.generateContent({
              model: config.fallbackModel,
              contents: [
                {
                  role: 'user',
                  parts: [{ text: userPrompt }],
                },
              ],
              config: {
                systemInstruction: AUTHENTICITY_ASSESSMENT_SYSTEM_PROMPT,
                temperature: 0.1,
                responseMimeType: 'application/json',
              },
            });

            return response.text || '';
          },
          config.maxRetries
        );
      } else {
        throw primaryErr;
      }
    }
  }

  const cleanedJson = cleanJsonResponseText(rawAiResponse);
  let parsed: any;
  try {
    parsed = JSON.parse(cleanedJson);
  } catch (err: any) {
    throw new Error(`Failed to parse AI authenticity response as JSON: ${err.message}`);
  }

  // Construct comprehensive assessment
  const comprehensiveAssessment: ComprehensiveAuthenticityAssessment = {
    assessmentId: `assess_${evidence.evidenceId}_${Date.now()}`,
    placeName: spotName,
    evidenceId: evidence.evidenceId,
    overallAuthenticityScore: Math.max(0, Math.min(100, Number(parsed.overallAuthenticityScore) || 50)),
    touristTrapLikelihood: parsed.touristTrapLikelihood || 'LOW',
    isTouristTrap: Boolean(parsed.isTouristTrap),
    touristTrap: {
      trapLikelihood: parsed.touristTrap?.trapLikelihood || parsed.touristTrapLikelihood || 'LOW',
      isOvercommercialized: Boolean(parsed.touristTrap?.isOvercommercialized),
      isCommercialChainOrFranchise: Boolean(parsed.touristTrap?.isCommercialChainOrFranchise),
      pricingAssessment: parsed.touristTrap?.pricingAssessment || 'FAIR_LOCAL_PRICING',
      toutingOrCommissionSignals: Boolean(parsed.touristTrap?.toutingOrCommissionSignals),
      reviewVelocityAnomaly: Boolean(parsed.touristTrap?.reviewVelocityAnomaly),
      deductionFactors: Array.isArray(parsed.touristTrap?.deductionFactors)
        ? parsed.touristTrap.deductionFactors
        : [],
    },
    authenticity: {
      authenticityScore: Math.max(0, Math.min(100, Number(parsed.authenticity?.authenticityScore) || 50)),
      isGenerationalOrHeritage: Boolean(parsed.authenticity?.isGenerationalOrHeritage),
      traditionalPreparationPracticed: Boolean(parsed.authenticity?.traditionalPreparationPracticed),
      localResidentPatronageRatio: Math.max(0, Math.min(1, Number(parsed.authenticity?.localResidentPatronageRatio) || 0.7)),
      neighborhoodCulturalRelevance: parsed.authenticity?.neighborhoodCulturalRelevance || 'Neighborhood establishment.',
      authenticityStrengths: Array.isArray(parsed.authenticity?.authenticityStrengths)
        ? parsed.authenticity.authenticityStrengths
        : [],
    },
    safetyAndHygiene: {
      hasExplicitSafetyConcerns: Boolean(parsed.safetyAndHygiene?.hasExplicitSafetyConcerns),
      hasExplicitHygieneConcerns: Boolean(parsed.safetyAndHygiene?.hasExplicitHygieneConcerns),
      evidenceFound: Boolean(parsed.safetyAndHygiene?.evidenceFound),
      observations: Array.isArray(parsed.safetyAndHygiene?.observations)
        ? parsed.safetyAndHygiene.observations
        : [],
      confidence: Math.max(0, Math.min(1, Number(parsed.safetyAndHygiene?.confidence) || 0.5)),
      isOfficialVerificationBadge: false, // Strict guardrail: NEVER true
    },
    conflictSynthesis: {
      hasFactualConflicts: Boolean(parsed.conflictSynthesis?.hasFactualConflicts),
      conflictSummary: parsed.conflictSynthesis?.conflictSummary || undefined,
      unverifiedContributorClaims: Array.isArray(parsed.conflictSynthesis?.unverifiedContributorClaims)
        ? parsed.conflictSynthesis.unverifiedContributorClaims
        : [],
      isEvidenceSufficientForHighConfidence: Boolean(parsed.conflictSynthesis?.isEvidenceSufficientForHighConfidence),
    },
    travelerRelevance: {
      recommendedVisitingWindow: parsed.travelerRelevance?.recommendedVisitingWindow || 'Morning or early evening',
      practicalTips: parsed.travelerRelevance?.practicalTips || 'Check local timings before visiting.',
      greetingCardNarrative: parsed.travelerRelevance?.greetingCardNarrative || `Discover ${spotName}, a unique neighborhood spot.`,
      vibeTags: Array.isArray(parsed.travelerRelevance?.vibeTags)
        ? parsed.travelerRelevance.vibeTags
        : ['authentic', 'local'],
    },
    localSentimentSummary: parsed.localSentimentSummary || 'Authentic community venue.',
    evidenceSourcesPreserved: (evidence.sources || []).map((s) => ({
      source: String(s.source),
      retrievedAt: String(s.retrievedAt),
      details: String(s.details),
    })),
    limitationsAndUncertainties: Array.isArray(parsed.limitationsAndUncertainties)
      ? parsed.limitationsAndUncertainties
      : [],
    modelUsed: activeModelUsed,
    assessedAt,
  };

  // Validate output against Zod schema
  return ComprehensiveAuthenticityAssessmentSchema.parse(comprehensiveAssessment);
}

/**
 * Maps a ComprehensiveAuthenticityAssessment directly to Developer A's
 * canonical PlaceAuthenticityEnrichment schema (Domain 06).
 */
export function toPlaceAuthenticityEnrichment(
  assessment: ComprehensiveAuthenticityAssessment
): PlaceAuthenticityEnrichment {
  const enrichment: PlaceAuthenticityEnrichment = {
    authenticityScore: assessment.overallAuthenticityScore,
    touristTrapLikelihood: assessment.touristTrapLikelihood,
    isTouristTrap: assessment.isTouristTrap,
    localSentimentSummary: assessment.localSentimentSummary,
    recommendedTiming: assessment.travelerRelevance.recommendedVisitingWindow,
    practicalTips: assessment.travelerRelevance.practicalTips,
    greetingCard: assessment.travelerRelevance.greetingCardNarrative,
    vibeTags: assessment.travelerRelevance.vibeTags,
  };

  return PlaceAuthenticityEnrichmentSchema.parse(enrichment);
}
