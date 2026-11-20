/**
 * Zod Schemas and TypeScript Types for AI Operations.
 * Enforces strict typing and structured JSON responses from Gemini.
 */

import { z } from 'zod';

/**
 * 1. Authenticity & Tourist Trap Assessment Schema
 * Used by Developer B for place authenticity scoring and evidence synthesis.
 */
export const AuthenticityAssessmentSchema = z.object({
  placeName: z.string().describe('Name of the place or establishment being assessed'),
  authenticityScore: z.number().min(0).max(100).describe('Authenticity score from 0 (hyper-commercialized tourist trap) to 100 (deeply authentic local institution)'),
  touristTrapLikelihood: z.enum(['LOW', 'MODERATE', 'HIGH', 'SEVERE']).describe('Categorical tourist trap risk rating'),
  signals: z.object({
    isMassMarketCommercial: z.boolean().describe('True if place sells mass-manufactured souvenirs or lacks unique heritage'),
    hasAggressiveTouting: z.boolean().describe('True if there are reports of street hawkers, touts, or aggressive commission guides'),
    inflatedPricingDetected: z.boolean().describe('True if pricing is substantially higher than standard local rates for equivalent quality'),
    traditionalCraftOrRecipe: z.boolean().describe('True if preparation methods, generational recipes, or genuine regional crafts are practiced'),
  }),
  localSentiment: z.object({
    localResidentRatioEstimate: z.number().min(0).max(1).describe('Estimated ratio of local patrons vs tourists (0.0 to 1.0)'),
    residentPerceptionSummary: z.string().describe('Concise summary of how neighborhood residents perceive this spot'),
  }),
  recommendedTiming: z.string().describe('Best hours or days to visit to avoid crowds or experience peak authenticity'),
  evidenceSummary: z.string().describe('Clear rationale and synthesis of supporting evidence'),
});

export type AuthenticityAssessment = z.infer<typeof AuthenticityAssessmentSchema>;

/**
 * 2. Voice & Photo Practical Detail Extraction Schema
 * Used for regional language voice note transcription and extraction of on-the-ground details.
 */
export const VoicePhotoExtractionSchema = z.object({
  detectedLanguage: z.string().describe('BCP-47 language tag or descriptive regional language code (e.g., hi-IN, mr-IN, ta-IN, en)'),
  originalTranscript: z.string().describe('Verbatim transcription of the spoken audio or OCR text from photo'),
  englishTranslation: z.string().describe('Accurate English translation retaining regional nuances and cultural idioms'),
  practicalDetails: z.object({
    openingHoursMentioned: z.string().optional().describe('Extracted opening/closing times or prayer/rest break timings'),
    signatureDishesOrItems: z.array(z.string()).describe('List of must-try items, traditional specialties, or specific dishes mentioned'),
    priceLevelNote: z.string().optional().describe('Price details, budget range, or bargaining tips mentioned'),
    cashOnlyWarning: z.boolean().describe('True if reviewer or audio indicates cash-only or UPI-only payments'),
    insiderTips: z.array(z.string()).describe('Actionable insider advice (e.g. enter through side alley, ask for extra spice, parking tips)'),
  }),
  authenticitySignals: z.array(z.string()).describe('Specific keywords or claims indicating generational recipe, family-run, or authentic status'),
  confidenceScore: z.number().min(0).max(1).describe('Extraction confidence from 0.0 to 1.0'),
});

export type VoicePhotoExtraction = z.infer<typeof VoicePhotoExtractionSchema>;

/**
 * 3. Group Preference Blending & Matching Schema
 * Used for combining solo preferences into consensus group recommendations.
 */
export const GroupPreferenceBlendSchema = z.object({
  groupSessionId: z.string().describe('Unique identifier of the collaborative group planning session'),
  consensusAtmosphere: z.array(z.string()).describe('Top agreed vibes/atmospheres (e.g., quiet, lively, historic, culinary)'),
  dietaryConstraintsUnion: z.array(z.string()).describe('Strict union of all members dietary restrictions (vegetarian, vegan, halal, allergy)'),
  budgetConsensusRange: z.object({
    minCurrencyAmount: z.number().min(0),
    maxCurrencyAmount: z.number().min(0),
    currencyCode: z.string().default('INR'),
  }),
  individualWeightings: z.record(z.string(), z.number()).describe('Normalized importance weighting per member (e.g. memberId -> weight)'),
  compromiseFactors: z.array(z.string()).describe('Key compromises made to satisfy competing member preferences'),
  recommendedCategoryFocus: z.array(z.string()).describe('Prioritized activity categories matching the blended profile'),
});

export type GroupPreferenceBlend = z.infer<typeof GroupPreferenceBlendSchema>;

/**
 * 4. B1 Verification Test Schema
 * Small test response schema used to verify authorized Gemini API calls and structured JSON response enforcement.
 */
export const FoundationTestSchema = z.object({
  serviceStatus: z.enum(['HEALTHY', 'OPERATIONAL', 'DEGRADED']),
  activeModelId: z.string().describe('The actual model ID that generated this structured output'),
  testGreeting: z.string().describe('A welcoming confirmation message acknowledging the Buildathon 2026 role'),
  supportedModalities: z.array(z.string()).describe('List of verified input modalities'),
  timestampIso: z.string().describe('ISO 8601 timestamp string generated by the model test'),
  verifiedCapabilities: z.object({
    structuredJson: z.boolean(),
    regionalExtractionReady: z.boolean(),
    fallbackConfigured: z.boolean(),
  }),
});

export type FoundationTest = z.infer<typeof FoundationTestSchema>;
