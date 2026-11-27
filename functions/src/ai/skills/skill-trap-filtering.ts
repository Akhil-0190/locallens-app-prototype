/**
 * Startup Buildathon 2026 — Neighborhood Guide App
 * Task B7: Maps-Grounded Trap Filtering Skill
 * Developer B — AI & Multimodal Lead
 * 
 * Programmatic execution wrapper for Skill 2: Maps-Grounded Trap Filtering.
 * Combines spatial Google Maps Places API evidence with contributor audio narratives
 * to evaluate cultural authenticity, detect commercial tourist traps, and generate safety disclosures.
 */

import { z } from 'zod';
import {
  ExtractedPracticalDetailsSchema,
} from '../../types/contracts/index.js';
import { getAIConfig } from '../config/env.js';
import { GroundingService } from '../../maps/services/grounding.service.js';
import { assessPlaceAuthenticity } from '../services/authenticity-assessment-service.js';

export const GroundingEvidenceInputSchema = z.object({
  placeId: z.string().optional(),
  displayName: z.string().optional(),
  formattedAddress: z.string().optional(),
  location: z.object({
    latitude: z.number(),
    longitude: z.number(),
  }).optional(),
  types: z.array(z.string()).optional(),
  rating: z.number().optional(),
  userRatingCount: z.number().optional(),
  priceLevel: z.string().optional(),
  businessStatus: z.string().optional(),
  coordinateDistanceDeltaMeters: z.number().optional(),
  hasMassTouristReviewCount: z.boolean().optional(),
  commercialChainDetected: z.boolean().optional(),
  potentialToutingReported: z.boolean().optional(),
});
export type GroundingEvidenceInput = z.infer<typeof GroundingEvidenceInputSchema>;

export const TrapFilterSkillInputSchema = z.object({
  placeName: z.string().min(1),
  neighborhood: z.string().default('Malleshwaram'),
  groundingEvidence: GroundingEvidenceInputSchema.optional(),
  voiceExtraction: ExtractedPracticalDetailsSchema.optional(),
  contributorId: z.string().optional(),
  hasGenerationalSignagePhoto: z.boolean().default(false),
  hasTraditionalEquipmentPhoto: z.boolean().default(false),
});
export type TrapFilterSkillInput = z.infer<typeof TrapFilterSkillInputSchema>;

export const TrapFilterSkillOutputSchema = z.object({
  success: z.boolean(),
  placeName: z.string(),
  authenticityScore: z.number().int().min(0).max(100),
  authenticityBadge: z.enum(['EXPERT_CURATED', 'HYPERLOCAL', 'COMMUNITY_VERIFIED', 'UNDER_REVIEW']),
  isTouristTrapRisk: z.boolean(),
  touristTrapScore: z.number().int().min(0).max(100),
  trapIndicators: z.array(z.string()),
  evidenceSynthesis: z.object({
    mapsEvidenceStatus: z.enum(['CONFIRMED_GROUNDED', 'STALE_DATA', 'MISSING_EVIDENCE', 'CONTRADICTORY_COORDINATES']),
    hasSpatialDiscrepancy: z.boolean(),
    spatialDistanceDeltaMeters: z.number().optional(),
    googleReviewCount: z.number().optional(),
    googleRating: z.number().optional(),
  }),
  safetyDisclosures: z.array(z.string()),
  recommendationVerdict: z.enum(['STRONGLY_RECOMMENDED', 'RECOMMENDED_WITH_CAUTION', 'FLAGGED_TOURIST_TRAP', 'UNVERIFIED_PENDING_GROUNDING']),
  curatorSummary: z.string(),
});
export type TrapFilterSkillOutput = z.infer<typeof TrapFilterSkillOutputSchema>;

/**
 * Executes the Maps-Grounded Trap Filtering Skill.
 */
export async function executeTrapFilteringSkill(
  input: TrapFilterSkillInput
): Promise<TrapFilterSkillOutput> {
  const parsedInput = TrapFilterSkillInputSchema.parse(input);
  const aiConfig = getAIConfig();
  const hasMapsKey = Boolean(process.env.MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY);

  // Live Google Maps + Gemini 3.8 Flash Trap Filtering when live keys exist and caller did not inject unit-test evidence
  if (!parsedInput.groundingEvidence && hasMapsKey && aiConfig.hasApiKey) {
    try {
      const grounding = new GroundingService({ allowMockFallback: false });
      const grounded = await grounding.groundContributedPlace({
        spotName: parsedInput.placeName,
        neighborhoodHint: parsedInput.neighborhood,
        infoParagraph:
          parsedInput.voiceExtraction?.insiderTips?.join('. ') || parsedInput.placeName,
      });

      if (grounded.evidence.matchedPlace && !grounded.evidence.matchedPlace.isMockData) {
        const assessment = await assessPlaceAuthenticity({
          evidence: grounded.evidence,
          contributorNarrative: parsedInput.voiceExtraction?.insiderTips?.join('. '),
        });
        const score = Math.round(assessment.overallAuthenticityScore);
        const isTrap = assessment.isTouristTrap;
        const trapScore = isTrap ? Math.max(65, 100 - score) : Math.max(10, 100 - score);
        const badge =
          score >= 85
            ? 'HYPERLOCAL'
            : score >= 75
            ? 'EXPERT_CURATED'
            : score >= 50
            ? 'COMMUNITY_VERIFIED'
            : 'UNDER_REVIEW';
        const verdict = isTrap
          ? 'FLAGGED_TOURIST_TRAP'
          : score >= 80
          ? 'STRONGLY_RECOMMENDED'
          : score >= 50
          ? 'RECOMMENDED_WITH_CAUTION'
          : 'UNVERIFIED_PENDING_GROUNDING';

        return {
          success: true,
          placeName: grounded.evidence.matchedPlace.name || parsedInput.placeName,
          authenticityScore: score,
          authenticityBadge: badge,
          isTouristTrapRisk: isTrap,
          touristTrapScore: trapScore,
          trapIndicators: assessment.touristTrap.deductionFactors,
          evidenceSynthesis: {
            mapsEvidenceStatus: 'CONFIRMED_GROUNDED',
            hasSpatialDiscrepancy: assessment.conflictSynthesis.hasFactualConflicts,
            googleReviewCount: grounded.evidence.matchedPlace.reviewCount,
            googleRating: grounded.evidence.matchedPlace.rating,
          },
          safetyDisclosures: assessment.safetyAndHygiene.observations,
          recommendationVerdict: verdict,
          curatorSummary: assessment.localSentimentSummary,
        };
      }
    } catch {
      // Fall through to honest MISSING_EVIDENCE handling below
    }
  }

  // Case 1: Missing Maps Grounding Evidence
  if (!parsedInput.groundingEvidence) {
    return {
      success: true,
      placeName: parsedInput.placeName,
      authenticityScore: 35,
      authenticityBadge: 'UNDER_REVIEW',
      isTouristTrapRisk: false,
      touristTrapScore: 40,
      trapIndicators: ['Unverified place: Google Maps Platform grounding evidence is unavailable'],
      evidenceSynthesis: {
        mapsEvidenceStatus: 'MISSING_EVIDENCE',
        hasSpatialDiscrepancy: false,
      },
      safetyDisclosures: [
        'Place location has not yet been confirmed via Google Maps Places API.',
        'Travelers should verify exact street address prior to departure.',
      ],
      recommendationVerdict: 'UNVERIFIED_PENDING_GROUNDING',
      curatorSummary: `${parsedInput.placeName} cannot be certified as authentic because spatial grounding evidence from Google Places API is missing. Retained under review.`,
    };
  }

  const evidence = parsedInput.groundingEvidence;

  // Case 2: Contradictory Evidence (Coordinate delta > 500m)
  const isContradictoryCoordinates = (evidence.coordinateDistanceDeltaMeters ?? 0) > 500;
  if (isContradictoryCoordinates) {
    return {
      success: true,
      placeName: parsedInput.placeName,
      authenticityScore: 20,
      authenticityBadge: 'UNDER_REVIEW',
      isTouristTrapRisk: true,
      touristTrapScore: 78,
      trapIndicators: [
        `Severe coordinate discrepancy: contributed pin is ${evidence.coordinateDistanceDeltaMeters}m away from verified Google Maps place location`,
        'Possible location spoofing or counterfeit clone storefront',
      ],
      evidenceSynthesis: {
        mapsEvidenceStatus: 'CONTRADICTORY_COORDINATES',
        hasSpatialDiscrepancy: true,
        spatialDistanceDeltaMeters: evidence.coordinateDistanceDeltaMeters,
        googleReviewCount: evidence.userRatingCount,
        googleRating: evidence.rating,
      },
      safetyDisclosures: [
        'WARNING: Location discrepancy detected between contributed voice note and official Google Maps listing.',
        'High risk of counterfeit or relocated storefront.',
      ],
      recommendationVerdict: 'FLAGGED_TOURIST_TRAP',
      curatorSummary: `Severe spatial mismatch (${evidence.coordinateDistanceDeltaMeters}m delta). Spot flagged as potential trap or counterfeit listing.`,
    };
  }

  // Case 3: Grounded evaluation
  let score = 70;
  const trapIndicators: string[] = [];
  const safetyDisclosures: string[] = [];

  if (parsedInput.hasGenerationalSignagePhoto) score += 10;
  if (parsedInput.hasTraditionalEquipmentPhoto) score += 10;
  if (evidence.rating && evidence.rating >= 4.4) score += 5;

  if (evidence.commercialChainDetected) {
    score -= 30;
    trapIndicators.push('Commercial chain or multi-outlet franchise detected');
  }
  if (evidence.potentialToutingReported) {
    score -= 25;
    trapIndicators.push('Aggressive touting or commission guides reported');
  }
  if (evidence.hasMassTouristReviewCount && evidence.rating && evidence.rating < 3.8) {
    score -= 20;
    trapIndicators.push('High volume generic tourist reviews with low resident satisfaction');
  }

  score = Math.max(0, Math.min(100, score));
  const isTrap = trapIndicators.length > 0 || score < 45;
  const trapScore = isTrap ? Math.max(65, 100 - score) : Math.max(10, 100 - score - 20);

  let badge: 'EXPERT_CURATED' | 'HYPERLOCAL' | 'COMMUNITY_VERIFIED' | 'UNDER_REVIEW' = 'COMMUNITY_VERIFIED';
  if (score >= 85) badge = 'HYPERLOCAL';
  else if (score >= 75) badge = 'EXPERT_CURATED';
  else if (score < 50) badge = 'UNDER_REVIEW';

  let verdict: 'STRONGLY_RECOMMENDED' | 'RECOMMENDED_WITH_CAUTION' | 'FLAGGED_TOURIST_TRAP' | 'UNVERIFIED_PENDING_GROUNDING';
  if (isTrap) {
    verdict = 'FLAGGED_TOURIST_TRAP';
  } else if (score >= 80) {
    verdict = 'STRONGLY_RECOMMENDED';
  } else if (score >= 50) {
    verdict = 'RECOMMENDED_WITH_CAUTION';
  } else {
    verdict = 'UNVERIFIED_PENDING_GROUNDING';
  }

  if (score >= 80) {
    safetyDisclosures.push('Generational heritage venue; confirmed cultural landmark with local resident patronage.');
  }

  const curatorSummary = isTrap
    ? `${parsedInput.placeName} exhibits tourist trap characteristics (${trapIndicators.join(', ')}). Proceed with caution.`
    : `${parsedInput.placeName} is an authentic neighborhood destination verified via Google Maps Platform grounding (${score}/100 authenticity).`;

  return {
    success: true,
    placeName: parsedInput.placeName,
    authenticityScore: score,
    authenticityBadge: badge,
    isTouristTrapRisk: isTrap,
    touristTrapScore: trapScore,
    trapIndicators,
    evidenceSynthesis: {
      mapsEvidenceStatus: 'CONFIRMED_GROUNDED',
      hasSpatialDiscrepancy: false,
      spatialDistanceDeltaMeters: evidence.coordinateDistanceDeltaMeters,
      googleReviewCount: evidence.userRatingCount,
      googleRating: evidence.rating,
    },
    safetyDisclosures,
    recommendationVerdict: verdict,
    curatorSummary,
  };
}
