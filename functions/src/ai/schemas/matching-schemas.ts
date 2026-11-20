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
// 2. Solo Preference Matching Schemas
// ==============================================================================

export const MatchScoreBreakdownSchema = z.object({
  vibeSimilarity: z.number().min(0).max(100).describe('Cosine similarity between user vibes and spot categories/vibes'),
  budgetFitScore: z.number().min(0).max(100).describe('Score reflecting alignment with user budget tier & max meal budget'),
  dietaryComplianceScore: z.number().min(0).max(100).describe('100 if fully compliant, 0 if severe dietary conflict'),
  pacingSuitabilityScore: z.number().min(0).max(100).describe('Alignment with travel pacing (relaxed vs packed)'),
  authenticityBonus: z.number().min(0).max(20).describe('Bonus points awarded for high authenticity scores (> 80)'),
});

export type MatchScoreBreakdown = z.infer<typeof MatchScoreBreakdownSchema>;

export const SoloPlaceMatchResultSchema = z.object({
  placeId: z.string(),
  spotName: z.string(),
  overallMatchScore: z.number().min(0).max(100).describe('Composite match score from 0 to 100'),
  isRecommended: z.boolean().describe('True if overall match score >= 65 and zero hard constraint violations'),
  breakdown: MatchScoreBreakdownSchema,
  matchedVibes: z.array(z.string()).describe('Specific user vibes that strongly matched this spot'),
  primaryMatchReason: z.string().describe('1-2 sentence concise explanation of why this spot matches the traveler'),
  dietaryAlert: z.string().optional().describe('Warning if spot has limited options for user dietary restrictions'),
  practicalTip: z.string().optional().describe('Contextual visit tip derived from place enrichment'),
});

export type SoloPlaceMatchResult = z.infer<typeof SoloPlaceMatchResultSchema>;

// ==============================================================================
// 3. Group Consensus Blending & Matching Schemas (Domain 09)
// ==============================================================================

export const GroupPlaceMatchResultSchema = z.object({
  placeId: z.string(),
  spotName: z.string(),
  groupMatchScore: z.number().min(0).max(100).describe('Consensus match score across all group members'),
  isRecommended: z.boolean().describe('True if group match score >= 65 and strictly zero dietary conflicts'),
  breakdown: MatchScoreBreakdownSchema,
  memberSatisfactionScores: z.record(z.string(), z.number()).describe('Satisfaction score (0-100) per individual memberId'),
  sharedGroupVibesMatched: z.array(z.string()).describe('Vibes shared by multiple members that this spot fulfills'),
  primaryGroupReason: z.string().describe('Clear explanation of how this spot satisfies the collective group'),
  compromiseNote: z.string().optional().describe('Explicit notice if a compromise was made (e.g. member with different pacing)'),
  dietarySafetyVerified: z.boolean().describe('True if spot is safe for the STRICT UNION of all group dietary constraints'),
});

export type GroupPlaceMatchResult = z.infer<typeof GroupPlaceMatchResultSchema>;

// ==============================================================================
// 4. Service Inputs
// ==============================================================================

export interface SoloMatchInput {
  preferences: z.infer<typeof TravelerPreferencesDocumentSchema>;
  places: z.infer<typeof CanonicalPlaceDocumentSchema>[];
  limit?: number;
}

export interface GroupBlendAndMatchInput {
  sessionId?: string;
  neighborhood: string;
  members: z.infer<typeof MemberPreferenceInputSchema>[];
  places: z.infer<typeof CanonicalPlaceDocumentSchema>[];
  limit?: number;
}
