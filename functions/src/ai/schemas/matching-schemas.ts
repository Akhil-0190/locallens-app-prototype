/**
 * Startup Buildathon 2026 — Neighborhood Guide App
 * Task B4: Solo & Group Taste Matching Schemas
 * 
 * Developer B — AI & Model Integration
 * 
 * Defines structured output schemas for:
 * 1. Semantic embeddings representation (3,072-dim Gemini Embedding 2)
 * 2. Solo traveler preference matching and similarity scoring
 * 3. Group consensus preference blending (Domain 09 conformance)
 * 4. Hard constraint enforcement (dietary restrictions union, accessibility)
 * 5. Explainable match reasons and compromise alerts
 * 6. Direct compatibility with Developer D's Flutter Discovery client contract
 */

import { z } from 'zod';
import {
  MemberPreferenceInputSchema,
  TravelerPreferencesDocumentSchema,
  CanonicalPlaceDocumentSchema,
} from '../../types/contracts/index.js';

// ==============================================================================
// 1. Vector & Embedding Schemas
// ==============================================================================

export const EmbeddingVectorSchema = z.object({
  model: z.string().default('gemini-embedding-2'),
  dimensions: z.number().int().default(3072),
  values: z.array(z.number()),
  isOfflineMock: z.boolean().default(false),
  generatedAt: z.string(),
});

export type EmbeddingVector = z.infer<typeof EmbeddingVectorSchema>;

// ==============================================================================
// 2. Client-Facing Match Breakdown (Agreed D3 & A2 Contract)
// ==============================================================================

export const MatchScoreBreakdownSchema = z.object({
  vibeMatch: z.number().min(0).max(100).describe('Cosine similarity between user vibes and spot categories/vibes'),
  budgetSuitability: z.number().min(0).max(100).describe('Score reflecting alignment with user budget tier & max meal budget'),
  dietaryFit: z.number().min(0).max(100).describe('100 if fully verified compliant, 0 if severe dietary conflict, 50 if unverified/unknown'),
  pacingAlignment: z.number().min(0).max(100).describe('Alignment with travel pacing (relaxed vs packed)'),
  authenticityBonus: z.number().min(0).max(20).default(0).describe('Bonus points awarded for high authenticity scores (> 80)'),
});

export type MatchScoreBreakdown = z.infer<typeof MatchScoreBreakdownSchema>;

export const DietaryStatusSchema = z.enum([
  'VERIFIED_SAFE',
  'CONFLICT_DETECTED',
  'UNVERIFIED_DATA',
]);

export type DietaryStatus = z.infer<typeof DietaryStatusSchema>;

// ==============================================================================
// 3. Solo Preference Matching Schema
// ==============================================================================

export const SoloPlaceMatchResultSchema = z.object({
  placeId: z.string(),
  spotName: z.string(),
  matchScore: z.number().min(0).max(100).describe('Composite match score from 0 to 100'),
  isRecommended: z.boolean().describe('True if match score >= 65 and zero hard constraint violations'),
  breakdown: MatchScoreBreakdownSchema,
  topMatchReasons: z.array(z.string()).describe('Explanations of why this spot matches the traveler'),
  compromiseAlerts: z.array(z.string()).default([]).describe('Notices about minor mismatches or budget adjustments'),
  matchedVibes: z.array(z.string()).default([]).describe('Specific user vibes that strongly matched this spot'),
  dietaryAlert: z.string().optional().describe('Warning if spot has limited options or unverified dietary information'),
  practicalTip: z.string().optional().describe('Contextual visit tip derived from place enrichment'),
  isOfflineMock: z.boolean().default(false).describe('True if vector was computed via offline test adapter rather than live Gemini API'),
});

export type SoloPlaceMatchResult = z.infer<typeof SoloPlaceMatchResultSchema>;

// ==============================================================================
// 4. Group Consensus Blending & Matching Schemas (Domain 09)
// ==============================================================================

export const GroupPlaceMatchResultSchema = z.object({
  placeId: z.string(),
  spotName: z.string(),
  matchScore: z.number().min(0).max(100).describe('Consensus match score across all group members'),
  isRecommended: z.boolean().describe('True if group match score >= 65 and strictly zero dietary conflicts'),
  breakdown: MatchScoreBreakdownSchema,
  memberSatisfactionScores: z.record(z.string(), z.number()).describe('Satisfaction score (0-100) per individual memberId'),
  topMatchReasons: z.array(z.string()).describe('Explanations of how this spot satisfies the collective group'),
  compromiseAlerts: z.array(z.string()).default([]).describe('Explicit notices about compromises (e.g. pacing, budget, minority vibes)'),
  sharedGroupVibesMatched: z.array(z.string()).default([]).describe('Vibes shared by multiple members that this spot fulfills'),
  dietarySafetyVerified: z.boolean().describe('True ONLY if spot has verified compliance for the strict group union; false if unverified or conflict'),
  dietaryStatus: DietaryStatusSchema.describe('VERIFIED_SAFE, CONFLICT_DETECTED, or UNVERIFIED_DATA'),
  isOfflineMock: z.boolean().default(false).describe('True if computed via offline test adapter'),
});

export type GroupPlaceMatchResult = z.infer<typeof GroupPlaceMatchResultSchema>;

// ==============================================================================
// 5. Service Inputs
// ==============================================================================

export interface SoloMatchInput {
  preferences: z.infer<typeof TravelerPreferencesDocumentSchema>;
  places: z.infer<typeof CanonicalPlaceDocumentSchema>[];
  limit?: number;
  options?: {
    forceOffline?: boolean;
    allowTestAdapterFallback?: boolean;
  };
}

export interface GroupBlendAndMatchInput {
  sessionId?: string;
  neighborhood: string;
  members: z.infer<typeof MemberPreferenceInputSchema>[];
  places: z.infer<typeof CanonicalPlaceDocumentSchema>[];
  limit?: number;
  options?: {
    forceOffline?: boolean;
    allowTestAdapterFallback?: boolean;
  };
}
