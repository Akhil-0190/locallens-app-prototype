/**
 * Startup Buildathon 2026 — Neighborhood Guide App
 * Task B7: Group Blending Skill
 * Developer B — AI & Multimodal Lead
 * 
 * Programmatic execution wrapper for Skill 3: Group Blending.
 * Harmonizes diverse traveler preference profiles into an actionable consensus blend,
 * strictly enforcing dietary safety unions and computing explainable group compatibility scores.
 */

import { z } from 'zod';
import {
  MemberPreferenceInput,
  ConsensusBlendOutput,
  ConsensusBlendOutputSchema,
} from '../../types/contracts/index.js';
import {
  blendGroupPreferences,
} from '../services/preference-matching-service.js';

export const SkillMemberInputSchema = z.object({
  userId: z.string().min(1),
  displayName: z.string().optional(),
  vibes: z.array(z.string()).optional(),
  dietaryRestrictions: z.array(z.string()).default([]),
  budgetTier: z.enum(['BUDGET', 'MODERATE', 'PREMIUM']).default('MODERATE'),
  preferredPace: z.enum(['LEISURELY', 'MODERATE', 'BRISK']).default('MODERATE'),
  interestTags: z.array(z.string()).optional(),
  maxBudgetAmount: z.number().optional(),
});
export type SkillMemberInput = z.infer<typeof SkillMemberInputSchema>;

export const GroupBlendingSkillInputSchema = z.object({
  sessionId: z.string().min(1),
  sessionCode: z.string().length(6).optional(),
  members: z.array(SkillMemberInputSchema).min(1),
  groupVibeNote: z.string().optional(),
});
export type GroupBlendingSkillInput = z.infer<typeof GroupBlendingSkillInputSchema>;

export const MemberAccommodationRecordSchema = z.object({
  userId: z.string(),
  accommodatedDietaryRestrictions: z.array(z.string()),
  budgetCompromise: z.string(),
  paceCompromise: z.string(),
  satisfactionEstimatePercent: z.number().int().min(0).max(100),
});
export type MemberAccommodationRecord = z.infer<typeof MemberAccommodationRecordSchema>;

export const GroupBlendingSkillOutputSchema = z.object({
  success: z.boolean(),
  sessionId: z.string(),
  consensusBlend: ConsensusBlendOutputSchema.extend({
    dietaryUnion: z.array(z.string()),
    consensusBudgetTier: z.enum(['BUDGET', 'MODERATE', 'PREMIUM']),
    recommendedPace: z.enum(['LEISURELY', 'MODERATE', 'BRISK']),
  }),
  memberAccommodations: z.array(MemberAccommodationRecordSchema),
  dietarySafetyGuarantees: z.array(z.string()),
  groupCohesionScore: z.number().int().min(0).max(100),
  conflictWarnings: z.array(z.string()),
  explanationSummary: z.string(),
});
export type GroupBlendingSkillOutput = z.infer<typeof GroupBlendingSkillOutputSchema>;

/**
 * Executes the Group Blending Skill.
 */
export async function executeGroupBlendingSkill(
  input: GroupBlendingSkillInput
): Promise<GroupBlendingSkillOutput> {
  const parsedInput = GroupBlendingSkillInputSchema.parse(input);
  const inputMembers: SkillMemberInput[] = parsedInput.members;

  const canonicalMembers: MemberPreferenceInput[] = inputMembers.map((m) => ({
    userId: m.userId,
    displayName: m.displayName || m.userId,
    vibes: m.vibes || m.interestTags || [],
    dietaryRestrictions: m.dietaryRestrictions || [],
    maxBudgetAmount:
      m.maxBudgetAmount ??
      (m.budgetTier === 'BUDGET' ? 300 : m.budgetTier === 'PREMIUM' ? 2500 : 800),
    weighting: 1.0,
  }));

  // Step 1: Execute core consensus blend service
  const baseBlend: ConsensusBlendOutput = blendGroupPreferences(canonicalMembers);

  // Derive explicit dietaryUnion (uppercase array matching user requirements)
  const dietaryUnionSet = new Set<string>();
  for (const m of inputMembers) {
    for (const d of m.dietaryRestrictions || []) {
      if (d.trim()) dietaryUnionSet.add(d.trim().toUpperCase());
    }
  }
  const dietaryUnion = Array.from(dietaryUnionSet);

  // Step 2: Formulate dietary safety guarantees
  const dietaryGuarantees: string[] = [];
  if (dietaryUnion.length === 0) {
    dietaryGuarantees.push('No restrictive dietary or allergen constraints were declared by any member.');
  } else {
    for (const restriction of dietaryUnion) {
      dietaryGuarantees.push(
        `STRICT GUARANTEE: All group recommendations must strictly satisfy ${restriction} (non-negotiable health union).`
      );
    }
  }

  // Step 3: Compute member-by-member accommodation records & conflict warnings
  const memberAccommodations: MemberAccommodationRecord[] = [];
  const conflictWarnings: string[] = [];

  const budgetTiers = inputMembers.map((m) => m.budgetTier);
  const hasBudgetConflict = budgetTiers.includes('BUDGET') && budgetTiers.includes('PREMIUM');
  if (hasBudgetConflict) {
    conflictWarnings.push(
      'Polar budget divergence detected: Group includes both BUDGET and PREMIUM travelers. Consensus capped at MODERATE to preserve accessibility.'
    );
  }

  const paces = inputMembers.map((m) => m.preferredPace);
  const hasPaceConflict = paces.includes('LEISURELY') && paces.includes('BRISK');
  if (hasPaceConflict) {
    conflictWarnings.push(
      'Polar walking pace divergence detected: Harmonized to MODERATE with extended rest stops between legs.'
    );
  }

  // Calculate consensus budget tier and recommended pace
  let consensusBudgetTier: 'BUDGET' | 'MODERATE' | 'PREMIUM' = 'MODERATE';
  if (budgetTiers.every((b) => b === 'BUDGET')) consensusBudgetTier = 'BUDGET';
  else if (budgetTiers.every((b) => b === 'PREMIUM')) consensusBudgetTier = 'PREMIUM';
  else if (budgetTiers.includes('BUDGET')) consensusBudgetTier = 'MODERATE';

  let recommendedPace: 'LEISURELY' | 'MODERATE' | 'BRISK' = 'MODERATE';
  if (paces.every((p) => p === 'LEISURELY')) recommendedPace = 'LEISURELY';
  else if (paces.every((p) => p === 'BRISK')) recommendedPace = 'BRISK';

  for (const m of inputMembers) {
    let satisfaction = 85;
    if (m.budgetTier !== consensusBudgetTier) satisfaction -= 10;
    if (m.preferredPace !== recommendedPace) satisfaction -= 10;
    satisfaction = Math.max(50, Math.min(100, satisfaction));

    memberAccommodations.push({
      userId: m.userId,
      accommodatedDietaryRestrictions: (m.dietaryRestrictions || []).map((r) => r.toUpperCase()),
      budgetCompromise: m.budgetTier === consensusBudgetTier ? 'Aligned' : `Shifted to ${consensusBudgetTier}`,
      paceCompromise: m.preferredPace === recommendedPace ? 'Aligned' : `Harmonized to ${recommendedPace}`,
      satisfactionEstimatePercent: satisfaction,
    });
  }

  // Step 4: Calculate group cohesion score
  let cohesionScore = 90;
  if (hasBudgetConflict) cohesionScore -= 15;
  if (hasPaceConflict) cohesionScore -= 10;
  if (inputMembers.length === 1) cohesionScore = 95;
  cohesionScore = Math.max(40, Math.min(100, cohesionScore));

  const explanationSummary = `Blended preferences for ${inputMembers.length} traveler(s): ${dietaryUnion.length} non-negotiable dietary restriction(s) accommodated with strict safety union; budget consensus set at ${consensusBudgetTier}.`;

  return {
    success: true,
    sessionId: parsedInput.sessionId,
    consensusBlend: {
      ...baseBlend,
      dietaryUnion,
      consensusBudgetTier,
      recommendedPace,
    },
    memberAccommodations,
    dietarySafetyGuarantees: dietaryGuarantees,
    groupCohesionScore: cohesionScore,
    conflictWarnings,
    explanationSummary,
  };
}
