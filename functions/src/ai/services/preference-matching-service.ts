/**
 * Startup Buildathon 2026 — Neighborhood Guide App
 * Task B4: Solo & Group Preference Matching Service
 * 
 * Developer B — AI & Model Integration
 * 
 * Implements:
 * 1. Solo Traveler Preference Matching with explainable rationale
 * 2. Group Preference Blending conforming strictly to Domain 09 (ConsensusBlendOutput)
 * 3. Strict Dietary Constraints Union enforcement (non-negotiable safety guardrail)
 * 4. Minority preference preservation and compromise alerts
 * 5. Semantic vector similarity using Gemini Embedding 2 (3,072 dimensions)
 */

import {
  ConsensusBlendOutput,
  ConsensusBlendOutputSchema,
  MemberPreferenceInput,
} from '../../types/contracts/index.js';
import {
  SoloPlaceMatchResult,
  SoloPlaceMatchResultSchema,
  GroupPlaceMatchResult,
  GroupPlaceMatchResultSchema,
  SoloMatchInput,
  GroupBlendAndMatchInput,
} from '../schemas/matching-schemas.js';
import {
  generateEmbedding,
  computeCosineSimilarity,
} from './embedding-service.js';

// ==============================================================================
// 1. Group Preference Blending Engine (Domain 09)
// ==============================================================================

/**
 * Blends individual member preferences into a consensus group profile (Domain 09).
 * 
 * CRITICAL GROUP RULES:
 * 1. Dietary Restrictions: STRICT UNION across all members. If ANY member has a restriction,
 *    it becomes mandatory for the group.
 * 2. Budget Range: min is the lowest budget across members; max is the weighted average.
 * 3. Minority Preferences: Preserved via compromiseFactors rather than silently discarded.
 */
export function blendGroupPreferences(
  members: MemberPreferenceInput[]
): ConsensusBlendOutput {
  if (!members || members.length === 0) {
    throw new Error('Cannot blend group preferences for empty members list.');
  }

  // 1. Dietary Constraints Union (Strict Union)
  const dietaryUnionSet = new Set<string>();
  for (const m of members) {
    for (const diet of m.dietaryRestrictions || []) {
      if (diet.trim()) dietaryUnionSet.add(diet.trim().toLowerCase());
    }
  }
  const dietaryConstraintsUnion = Array.from(dietaryUnionSet);

  // 2. Budget Consensus Range
  let minBudget = Infinity;
  let totalWeightedBudget = 0;
  let totalWeight = 0;

  for (const m of members) {
    const w = typeof m.weighting === 'number' && m.weighting > 0 ? m.weighting : 1.0;
    const b = typeof m.maxBudgetAmount === 'number' ? m.maxBudgetAmount : 300;
    if (b < minBudget) minBudget = b;
    totalWeightedBudget += b * w;
    totalWeight += w;
  }

  const avgBudget = totalWeight > 0 ? Math.round(totalWeightedBudget / totalWeight) : 300;
  const budgetConsensusRange = {
    minCurrencyAmount: Math.max(0, minBudget === Infinity ? 100 : minBudget),
    maxCurrencyAmount: Math.max(minBudget, avgBudget),
    currencyCode: 'INR',
  };

  // 3. Individual Weightings Normalized
  const individualWeightings: Record<string, number> = {};
  for (const m of members) {
    const rawWeight = typeof m.weighting === 'number' ? m.weighting : 1.0;
    individualWeightings[m.userId] = totalWeight > 0 ? Number((rawWeight / totalWeight).toFixed(3)) : 1.0;
  }

  // 4. Atmosphere / Vibe Consensus Weighted Scoring
  const vibeScoreMap = new Map<string, number>();
  const memberVibeCountMap = new Map<string, number>();

  for (const m of members) {
    const w = typeof m.weighting === 'number' ? m.weighting : 1.0;
    for (const vibe of m.vibes || []) {
      const vKey = vibe.trim().toLowerCase();
      if (!vKey) continue;
      vibeScoreMap.set(vKey, (vibeScoreMap.get(vKey) || 0) + w);
      memberVibeCountMap.set(vKey, (memberVibeCountMap.get(vKey) || 0) + 1);
    }
  }

  // Sort vibes by weighted score
  const sortedVibes = Array.from(vibeScoreMap.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([vibe]) => vibe);

  const consensusAtmosphere = sortedVibes.slice(0, 5);

  // 5. Compromise Factors & Minority Preservation
  const compromiseFactors: string[] = [];
  if (dietaryConstraintsUnion.length > 0) {
    compromiseFactors.push(
      `Strict dietary union enforced for: ${dietaryConstraintsUnion.join(', ')}`
    );
  }

  // Check for minority vibes (vibes chosen by only 1 member when group > 2)
  if (members.length > 2) {
    for (const [vibe, count] of memberVibeCountMap.entries()) {
      if (count === 1) {
        compromiseFactors.push(
          `Preserving minority interest in "${vibe}" alongside majority consensus`
        );
      }
    }
  }

  // Check for budget variance
  const maxMemberBudget = Math.max(...members.map((m) => m.maxBudgetAmount || 300));
  if (maxMemberBudget - budgetConsensusRange.minCurrencyAmount > 400) {
    compromiseFactors.push(
      `Budget compromise: capping meals between ₹${budgetConsensusRange.minCurrencyAmount} and ₹${budgetConsensusRange.maxCurrencyAmount} to accommodate all members`
    );
  }

  // 6. Recommended Category Focus
  const categoryMap: Record<string, string[]> = {
    heritage: ['historical_landmark', 'cultural_center', 'museum'],
    vintage_filter_coffee: ['cafe', 'coffee_shop', 'breakfast_restaurant'],
    street_food: ['food_stall', 'snack_bar', 'market'],
    serene: ['park', 'temple', 'place_of_worship'],
    arts_culture: ['art_gallery', 'book_store', 'theatre'],
    lively: ['market', 'shopping_mall', 'bazaar'],
  };

  const recommendedCategories = new Set<string>();
  for (const vibe of consensusAtmosphere) {
    const cats = categoryMap[vibe];
    if (cats) cats.forEach((c) => recommendedCategories.add(c));
  }
  if (recommendedCategories.size === 0) {
    recommendedCategories.add('point_of_interest');
    recommendedCategories.add('restaurant');
  }

  const consensusOutput: ConsensusBlendOutput = {
    consensusAtmosphere: consensusAtmosphere.length > 0 ? consensusAtmosphere : ['authentic', 'local'],
    dietaryConstraintsUnion,
    budgetConsensusRange,
    individualWeightings,
    compromiseFactors: compromiseFactors.length > 0 ? compromiseFactors : ['Balanced group profile'],
    recommendedCategoryFocus: Array.from(recommendedCategories).slice(0, 6),
  };

  return ConsensusBlendOutputSchema.parse(consensusOutput);
}

// ==============================================================================
// 2. Solo Preference Matching Engine
// ==============================================================================

/**
 * Matches places against a solo traveler's preference profile.
 */
export async function matchSoloPreferences(
  input: SoloMatchInput
): Promise<SoloPlaceMatchResult[]> {
  const { preferences, places, limit = 10 } = input;
  const results: SoloPlaceMatchResult[] = [];

  // Construct text representation of user preferences for semantic vector
  const userPrefText = [
    preferences.favoriteVibes?.join(' '),
    preferences.budgetTier,
    preferences.preferredPacing,
    preferences.preferredNeighborhoods?.join(' '),
  ]
    .filter(Boolean)
    .join(' ');

  const userEmbedding = await generateEmbedding(userPrefText || 'authentic neighborhood gems');

  for (const place of places) {
    // 1. Semantic Vibe Similarity (0 - 100)
    const placeText = [
      place.spotName,
      place.primaryCategory,
      place.categories?.join(' '),
      place.authenticity?.vibeTags?.join(' '),
      place.infoParagraph,
    ]
      .filter(Boolean)
      .join(' ');

    const placeEmbedding = await generateEmbedding(placeText);
    const cosineSim = computeCosineSimilarity(userEmbedding.values, placeEmbedding.values);
    const vibeSimilarity = Math.round(cosineSim * 100);

    // 2. Budget Fit Score (0 - 100)
    let budgetFitScore = 80;
    const maxBudget = preferences.maxBudgetPerMealInr || 250;
    const isBudgetTier = preferences.budgetTier === 'BUDGET';

    if (place.infoParagraph?.toLowerCase().includes('cheap') || place.infoParagraph?.toLowerCase().includes('budget') || place.infoParagraph?.toLowerCase().includes('affordable')) {
      budgetFitScore = 95;
    } else if (place.infoParagraph?.toLowerCase().includes('expensive') || place.infoParagraph?.toLowerCase().includes('fine dining')) {
      budgetFitScore = (isBudgetTier || maxBudget < 300) ? 30 : 70;
    }

    // 3. Dietary Compliance Score (0 - 100)
    let dietaryComplianceScore = 100;
    let dietaryAlert: string | undefined = undefined;

    const placeLower = (place.infoParagraph + ' ' + (place.categories || []).join(' ')).toLowerCase();
    for (const diet of preferences.dietaryRestrictions || []) {
      const d = diet.toLowerCase();
      if ((d === 'pure_veg' || d === 'vegetarian' || d === 'jain') && placeLower.includes('meat') && !placeLower.includes('pure veg')) {
        dietaryComplianceScore = Math.min(dietaryComplianceScore, 40);
        dietaryAlert = `Caution: Place may not be exclusively ${diet.replace('_', ' ')}`;
      }
    }

    // 4. Pacing Suitability Score (0 - 100)
    let pacingSuitabilityScore = 80;
    const pacing = preferences.preferredPacing;
    if (pacing === 'RELAXED') {
      if (placeLower.includes('quiet') || placeLower.includes('peaceful') || placeLower.includes('serene') || placeLower.includes('temple') || placeLower.includes('garden')) {
        pacingSuitabilityScore = 95;
      } else if (placeLower.includes('crowded') || placeLower.includes('chaotic') || placeLower.includes('rush')) {
        pacingSuitabilityScore = 60;
      }
    } else if (pacing === 'PACKED') {
      pacingSuitabilityScore = 90;
    }

    // 5. Authenticity Bonus (0 - 15)
    const authenticityScore = place.authenticity?.authenticityScore || 50;
    const authenticityBonus = authenticityScore >= 80 ? Math.round((authenticityScore - 70) * 0.5) : 0;

    // 6. Overall Composite Score
    // Weightings: 45% Vibe, 20% Budget, 20% Dietary, 15% Pacing + Bonus
    let rawScore =
      0.45 * vibeSimilarity +
      0.20 * budgetFitScore +
      0.20 * dietaryComplianceScore +
      0.15 * pacingSuitabilityScore +
      authenticityBonus;

    // If severe dietary conflict, clamp score
    if (dietaryComplianceScore < 50) {
      rawScore = Math.min(rawScore, 40);
    }

    const overallMatchScore = Math.max(0, Math.min(100, Math.round(rawScore)));

    // 7. Matched Vibes
    const matchedVibes = (preferences.favoriteVibes || []).filter((vibe) => {
      const v = vibe.toLowerCase();
      return (
        placeLower.includes(v) ||
        (place.authenticity?.vibeTags || []).some((tag) => tag.toLowerCase().includes(v))
      );
    });

    // 8. Primary Match Reason
    let primaryMatchReason = `Matches your preference for ${matchedVibes.join(', ') || 'neighborhood culture'}.`;
    if (authenticityScore >= 85) {
      primaryMatchReason = `Highly authentic local gem (${authenticityScore}/100) matching your ${matchedVibes[0] || 'neighborhood'} interest.`;
    }

    const isRecommended = overallMatchScore >= 65 && dietaryComplianceScore >= 50;

    const result: SoloPlaceMatchResult = {
      placeId: place.id,
      spotName: place.spotName,
      overallMatchScore,
      isRecommended,
      breakdown: {
        vibeSimilarity,
        budgetFitScore,
        dietaryComplianceScore,
        pacingSuitabilityScore,
        authenticityBonus,
      },
      matchedVibes,
      primaryMatchReason,
      dietaryAlert,
      practicalTip: place.authenticity?.practicalTips || undefined,
    };

    results.push(SoloPlaceMatchResultSchema.parse(result));
  }

  // Sort descending by overall match score
  results.sort((a, b) => b.overallMatchScore - a.overallMatchScore);
  return results.slice(0, limit);
}

// ==============================================================================
// 3. Group Preference Matching Engine
// ==============================================================================

/**
 * Matches places against a group session using blended consensus and strict dietary safety.
 */
export async function matchGroupPreferences(
  input: GroupBlendAndMatchInput
): Promise<GroupPlaceMatchResult[]> {
  const { members, places, limit = 10 } = input;
  const consensus = blendGroupPreferences(members);
  const results: GroupPlaceMatchResult[] = [];

  // Generate embedding for consensus group atmosphere
  const groupAtmosphereText = consensus.consensusAtmosphere.join(' ') + ' ' + consensus.recommendedCategoryFocus.join(' ');
  const groupEmbedding = await generateEmbedding(groupAtmosphereText);

  for (const place of places) {
    const placeText = [
      place.spotName,
      place.primaryCategory,
      place.categories?.join(' '),
      place.authenticity?.vibeTags?.join(' '),
      place.infoParagraph,
    ]
      .filter(Boolean)
      .join(' ');

    const placeEmbedding = await generateEmbedding(placeText);
    const cosineSim = computeCosineSimilarity(groupEmbedding.values, placeEmbedding.values);
    const vibeSimilarity = Math.round(cosineSim * 100);

    // Strict Dietary Safety Union Check
    const placeLower = (place.infoParagraph + ' ' + (place.categories || []).join(' ')).toLowerCase();
    let dietarySafe = true;
    for (const diet of consensus.dietaryConstraintsUnion) {
      const d = diet.toLowerCase();
      if ((d === 'pure_veg' || d === 'jain' || d === 'vegan') && placeLower.includes('meat') && !placeLower.includes('pure veg')) {
        dietarySafe = false;
        break;
      }
    }

    const dietaryComplianceScore = dietarySafe ? 100 : 30;

    // Budget Fit for Group Range
    let budgetFitScore = 80;
    if (placeLower.includes('cheap') || placeLower.includes('affordable')) {
      budgetFitScore = 95;
    } else if (placeLower.includes('fine dining') || placeLower.includes('expensive')) {
      budgetFitScore = consensus.budgetConsensusRange.maxCurrencyAmount < 300 ? 30 : 70;
    }

    // Pacing suitability
    const pacingSuitabilityScore = 80;

    // Authenticity Bonus
    const authenticityScore = place.authenticity?.authenticityScore || 50;
    const authenticityBonus = authenticityScore >= 80 ? Math.round((authenticityScore - 70) * 0.5) : 0;

    // Calculate individual member satisfaction scores
    const memberSatisfactionScores: Record<string, number> = {};
    const placeAllText = (
      (place.infoParagraph || '') +
      ' ' +
      (place.categories || []).join(' ') +
      ' ' +
      (place.authenticity?.vibeTags || []).join(' ')
    ).toLowerCase();

    for (const m of members) {
      const memberVibes = m.vibes || [];
      const matchedCount = memberVibes.filter((v) => {
        const vKey = v.toLowerCase();
        const vWords = vKey.replace(/_/g, ' ');
        return (
          placeAllText.includes(vKey) ||
          placeAllText.includes(vWords) ||
          (place.authenticity?.vibeTags || []).some(
            (tag) => tag.toLowerCase() === vKey || tag.toLowerCase().replace(/_/g, ' ') === vWords
          )
        );
      }).length;
      const ratio = memberVibes.length > 0 ? matchedCount / memberVibes.length : 0.7;
      let memberScore = Math.round(ratio * 60 + vibeSimilarity * 0.4);
      if (!dietarySafe && m.dietaryRestrictions?.some((d) => consensus.dietaryConstraintsUnion.includes(d))) {
        memberScore = Math.min(memberScore, 30);
      }
      memberSatisfactionScores[m.userId] = Math.max(0, Math.min(100, memberScore));
    }

    // Overall Group Score
    let groupMatchScore = Math.round(
      0.45 * vibeSimilarity +
      0.25 * dietaryComplianceScore +
      0.20 * budgetFitScore +
      0.10 * pacingSuitabilityScore +
      authenticityBonus
    );

    if (!dietarySafe) {
      groupMatchScore = Math.min(groupMatchScore, 40);
    }
    groupMatchScore = Math.max(0, Math.min(100, groupMatchScore));

    // Shared Group Vibes Matched
    const sharedGroupVibesMatched = consensus.consensusAtmosphere.filter((vibe) =>
      placeLower.includes(vibe.toLowerCase()) ||
      (place.authenticity?.vibeTags || []).some((tag) => tag.toLowerCase().includes(vibe.toLowerCase()))
    );

    // Primary Group Reason
    let primaryGroupReason = `Fulfills group consensus on ${sharedGroupVibesMatched.join(', ') || 'neighborhood experience'}.`;
    if (!dietarySafe) {
      primaryGroupReason = `Caution: Violates group dietary constraint union.`;
    }

    const isRecommended = groupMatchScore >= 65 && dietarySafe;

    const groupResult: GroupPlaceMatchResult = {
      placeId: place.id,
      spotName: place.spotName,
      groupMatchScore,
      isRecommended,
      breakdown: {
        vibeSimilarity,
        budgetFitScore,
        dietaryComplianceScore,
        pacingSuitabilityScore,
        authenticityBonus,
      },
      memberSatisfactionScores,
      sharedGroupVibesMatched,
      primaryGroupReason,
      compromiseNote: consensus.compromiseFactors[0] || undefined,
      dietarySafetyVerified: dietarySafe,
    };

    results.push(GroupPlaceMatchResultSchema.parse(groupResult));
  }

  // Sort descending by group match score
  results.sort((a, b) => b.groupMatchScore - a.groupMatchScore);
  return results.slice(0, limit);
}
