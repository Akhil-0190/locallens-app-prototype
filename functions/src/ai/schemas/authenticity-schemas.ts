/**
 * Startup Buildathon 2026 — Neighborhood Guide App
 * Task B3: Authenticity, Tourist-Trap, and Safety Assessment Schemas
 * 
 * Developer B — AI & Model Integration
 * 
 * Defines structured output schemas for:
 * 1. Tourist-trap and overcommercialization evaluation
 * 2. Cultural authenticity and local resident sentiment
 * 3. Evidence-backed safety and hygiene observations (strictly non-fabricated)
 * 4. Discrepancy and conflict synthesis between contributor claims and Maps evidence
 * 5. Practical traveler relevance and timing
 * 6. Mapping directly to Developer A's canonical PlaceAuthenticityEnrichment (Domain 06)
 */

import { z } from 'zod';
import {
  TouristTrapRiskSchema,
} from '../../types/contracts/index.js';
import { PlaceGroundingEvidence } from '../../maps/types/evidence.types.js';

// ==============================================================================
// 1. Detailed Sub-Assessment Schemas
// ==============================================================================

/**
 * Tourist Trap & Overcommercialization Assessment
 */
export const TouristTrapEvaluationSchema = z.object({
  trapLikelihood: TouristTrapRiskSchema,
  isOvercommercialized: z.boolean().describe('True if establishment exhibits mass-market commercial practices rather than local character'),
  isCommercialChainOrFranchise: z.boolean().describe('True if evidence confirms chain, multi-outlet franchise, or corporate ownership'),
  pricingAssessment: z.enum(['FAIR_LOCAL_PRICING', 'SLIGHT_PREMIUM', 'EXTREME_TOURIST_MARKUP', 'UNKNOWN']).describe('Evaluation of price reasonableness compared to neighborhood standards'),
  toutingOrCommissionSignals: z.boolean().describe('True if reports of aggressive touting, street hawkers, or tour-bus commission arrangements exist'),
  reviewVelocityAnomaly: z.boolean().describe('True if review patterns indicate suspicious inorganic spikes or mass generic tourist reviews'),
  deductionFactors: z.array(z.string()).describe('Specific reasons for score deductions based on verified evidence'),
});

export type TouristTrapEvaluation = z.infer<typeof TouristTrapEvaluationSchema>;

/**
 * Authenticity & Cultural Heritage Indicators
 */
export const AuthenticityEvaluationSchema = z.object({
  authenticityScore: z.number().min(0).max(100).describe('0-100 score reflecting cultural, historical, or neighborhood authenticity'),
  isGenerationalOrHeritage: z.boolean().describe('True if establishment has generational lineage, historic ties, or traditional roots'),
  traditionalPreparationPracticed: z.boolean().describe('True if traditional culinary recipes, artisanal methods, or craft heritage are verified'),
  localResidentPatronageRatio: z.number().min(0).max(1).describe('Estimated ratio of regular neighborhood resident patrons (0.0 = all tourists, 1.0 = all locals)'),
  neighborhoodCulturalRelevance: z.string().describe('Concise description of the venue cultural significance to its specific neighborhood'),
  authenticityStrengths: z.array(z.string()).describe('Specific evidence-backed reasons elevating the venue authenticity score'),
});

export type AuthenticityEvaluation = z.infer<typeof AuthenticityEvaluationSchema>;

/**
 * Safety and Hygiene Assessment
 * 
 * STRICT INTEGRATION RULES:
 * - Never label a business unsafe without concrete evidence.
 * - Missing safety data must NEVER be treated as a negative finding.
 * - Does not issue a verified official badge (strictly an AI analysis of available evidence).
 */
export const SafetyAndHygieneEvaluationSchema = z.object({
  hasExplicitSafetyConcerns: z.boolean().describe('True ONLY when verified incident reports, severe food safety violations, or police warnings are present in evidence'),
  hasExplicitHygieneConcerns: z.boolean().describe('True ONLY when multiple corroborated hygiene or sanitation complaints are present in verified reviews'),
  evidenceFound: z.boolean().describe('True if any explicit safety or hygiene details were mentioned in available reviews/evidence; false if silent'),
  observations: z.array(z.string()).describe('Specific factual observations regarding lighting, pedestrian access, seating, or food handling'),
  confidence: z.number().min(0).max(1).describe('Confidence level of the safety/hygiene assessment (0.1 if no data, 0.9 if corroborated by evidence)'),
  isOfficialVerificationBadge: z.literal(false).describe('Strict guardrail: AI assessments NEVER grant an official government/verified safety badge'),
});

export type SafetyAndHygieneEvaluation = z.infer<typeof SafetyAndHygieneEvaluationSchema>;

/**
 * Discrepancy & Conflict Synthesis
 */
export const EvidenceConflictSynthesisSchema = z.object({
  hasFactualConflicts: z.boolean().describe('True if contributor narrative conflicts with Google Maps Platform data'),
  conflictSummary: z.string().optional().describe('Summary of the most significant discrepancy (e.g. claimed hours vs verified closing time)'),
  unverifiedContributorClaims: z.array(z.string()).describe('List of claims made by contributor that lack external Maps verification'),
  isEvidenceSufficientForHighConfidence: z.boolean().describe('True if venue has strong matching and corroborating signals; false if data is sparse'),
});

export type EvidenceConflictSynthesis = z.infer<typeof EvidenceConflictSynthesisSchema>;

/**
 * Practical Traveler Relevance & Guidance
 */
export const TravelerRelevanceSchema = z.object({
  recommendedVisitingWindow: z.string().describe('Optimal time of day or week to visit to avoid crowds or experience peak freshness/authenticity'),
  practicalTips: z.string().describe('Actionable local etiquette, seating advice, payment advice (e.g. cash/UPI), or token queues'),
  greetingCardNarrative: z.string().describe('Welcoming, evocative 1-2 sentence description summarizing why this gem is worth visiting'),
  vibeTags: z.array(z.string()).describe('Curated 3-5 tags characterizing the atmosphere (e.g. "heritage-breakfast", "filter-coffee", "bustling", "serene")'),
});

export type TravelerRelevance = z.infer<typeof TravelerRelevanceSchema>;

// ==============================================================================
// 2. Comprehensive B3 Assessment Output Schema
// ==============================================================================

export const ComprehensiveAuthenticityAssessmentSchema = z.object({
  assessmentId: z.string(),
  placeName: z.string(),
  evidenceId: z.string(),
  overallAuthenticityScore: z.number().min(0).max(100),
  touristTrapLikelihood: TouristTrapRiskSchema,
  isTouristTrap: z.boolean(),
  touristTrap: TouristTrapEvaluationSchema,
  authenticity: AuthenticityEvaluationSchema,
  safetyAndHygiene: SafetyAndHygieneEvaluationSchema,
  conflictSynthesis: EvidenceConflictSynthesisSchema,
  travelerRelevance: TravelerRelevanceSchema,
  localSentimentSummary: z.string(),
  evidenceSourcesPreserved: z.array(
    z.object({
      source: z.string(),
      retrievedAt: z.string(),
      details: z.string(),
    })
  ),
  limitationsAndUncertainties: z.array(z.string()),
  modelUsed: z.string(),
  assessedAt: z.string(),
});

export type ComprehensiveAuthenticityAssessment = z.infer<
  typeof ComprehensiveAuthenticityAssessmentSchema
>;

// ==============================================================================
// 3. Service Input Contract
// ==============================================================================

export interface AuthenticityAssessmentInput {
  evidence: PlaceGroundingEvidence;
  /** Optional contributor narrative or voice transcript extracted in B2 */
  contributorNarrative?: string;
  /** Optional user preference profile to assess practical traveler fit */
  travelerPreferences?: {
    favoriteVibes?: string[];
    dietaryRestrictions?: string[];
    budgetTier?: 'BUDGET' | 'MODERATE' | 'PREMIUM';
    maxBudgetPerMealInr?: number;
  };
}
