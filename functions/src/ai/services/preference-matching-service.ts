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
  const { preferences, places, limit = 10, options, routeContext } = input;
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

  const userEmbedding = await generateEmbedding(
    userPrefText || 'authentic neighborhood gems',
    options
  );

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

    const placeEmbedding = await generateEmbedding(placeText, options);
    const cosineSim = computeCosineSimilarity(userEmbedding.values, placeEmbedding.values);
    const vibeMatch = Math.round(cosineSim * 100);

    // 2. Budget Fit Score (0 - 100)
    let budgetSuitability = 80;
    const maxBudget = preferences.maxBudgetPerMealInr || 250;
    const isBudgetTier = preferences.budgetTier === 'BUDGET';

    if (
      place.infoParagraph?.toLowerCase().includes('cheap') ||
      place.infoParagraph?.toLowerCase().includes('budget') ||
      place.infoParagraph?.toLowerCase().includes('affordable')
    ) {
      budgetSuitability = 95;
    } else if (
      place.infoParagraph?.toLowerCase().includes('expensive') ||
      place.infoParagraph?.toLowerCase().includes('fine dining')
    ) {
      budgetSuitability = isBudgetTier || maxBudget < 300 ? 30 : 70;
    }

    // 3. Dietary Compliance Score (0 - 100)
    // STRICT GUARDRAIL: Pure veg, vegan, and Jain are NOT interchangeable.
    // Unverified data is NEVER treated as verified suitability.
    let dietaryStatus: 'VERIFIED_SAFE' | 'CONFLICT_DETECTED' | 'UNVERIFIED_DATA' = 'VERIFIED_SAFE';
    let dietarySafetyVerified = true;
    let dietaryFit = 100;
    let dietaryAlert: string | undefined = undefined;

    const placeLower = (
      (place.infoParagraph || '') +
      ' ' +
      (place.categories || []).join(' ') +
      ' ' +
      (place.authenticity?.vibeTags || []).join(' ')
    ).toLowerCase();

    const userDiets = preferences.dietaryRestrictions || [];
    if (userDiets.length > 0) {
      for (const diet of userDiets) {
        const d = diet.toLowerCase();
        if (d === 'pure_veg' || d === 'vegetarian') {
          if (
            placeLower.includes('pure veg') ||
            placeLower.includes('pure_veg') ||
            (place.categories || []).includes('pure_veg')
          ) {
            // Verified lacto-vegetarian
          } else if (
            placeLower.includes('meat') ||
            placeLower.includes('chicken') ||
            placeLower.includes('pork') ||
            placeLower.includes('beef') ||
            placeLower.includes('barbecue')
          ) {
            dietaryStatus = 'CONFLICT_DETECTED';
            dietarySafetyVerified = false;
            dietaryFit = 0;
            dietaryAlert = `Explicit non-vegetarian establishment conflicting with ${diet.replace('_', ' ')} preference.`;
            break;
          } else {
            dietaryStatus = 'UNVERIFIED_DATA';
            dietarySafetyVerified = false;
            dietaryFit = Math.min(dietaryFit, 50);
            dietaryAlert = `Vegetarian suitability unverified from available online listing; patron confirmation advised.`;
          }
        } else if (d === 'vegan') {
          // Vegan requires strictly plant-based (no ghee, butter, curd, milk, honey).
          // Pure veg South Indian restaurants heavily use ghee/butter on dosas and dairy milk in coffee.
          if (
            placeLower.includes('vegan') ||
            placeLower.includes('plant-based') ||
            placeLower.includes('dairy-free')
          ) {
            // Verified vegan
          } else if (
            placeLower.includes('meat') ||
            placeLower.includes('chicken') ||
            placeLower.includes('pork') ||
            placeLower.includes('beef')
          ) {
            dietaryStatus = 'CONFLICT_DETECTED';
            dietarySafetyVerified = false;
            dietaryFit = 0;
            dietaryAlert = `Meat-serving establishment conflicting with vegan requirement.`;
            break;
          } else {
            dietaryStatus = 'UNVERIFIED_DATA';
            dietarySafetyVerified = false;
            dietaryFit = Math.min(dietaryFit, 50);
            dietaryAlert = `Vegan suitability unverified: pure vegetarian venues commonly use ghee, butter, and dairy.`;
          }
        } else if (d === 'jain') {
          // Jain requires strictly no root vegetables (onion, garlic, potato, carrot).
          if (
            placeLower.includes('jain food') ||
            placeLower.includes('jain menu') ||
            placeLower.includes('no onion no garlic')
          ) {
            // Verified Jain
          } else if (
            placeLower.includes('meat') ||
            placeLower.includes('chicken') ||
            placeLower.includes('pork') ||
            placeLower.includes('beef')
          ) {
            dietaryStatus = 'CONFLICT_DETECTED';
            dietarySafetyVerified = false;
            dietaryFit = 0;
            dietaryAlert = `Meat-serving establishment conflicting with Jain requirement.`;
            break;
          } else {
            dietaryStatus = 'UNVERIFIED_DATA';
            dietarySafetyVerified = false;
            dietaryFit = Math.min(dietaryFit, 50);
            dietaryAlert = `Jain suitability (no root vegetables, onions, or garlic) unverified online; patron confirmation required.`;
          }
        } else if (d === 'halal') {
          if (placeLower.includes('halal certified') || placeLower.includes('halal meat')) {
            // Verified halal
          } else if (placeLower.includes('pork') || placeLower.includes('bacon')) {
            dietaryStatus = 'CONFLICT_DETECTED';
            dietarySafetyVerified = false;
            dietaryFit = 0;
            dietaryAlert = `Pork-serving establishment conflicting with halal requirement.`;
            break;
          } else {
            dietaryStatus = 'UNVERIFIED_DATA';
            dietarySafetyVerified = false;
            dietaryFit = Math.min(dietaryFit, 50);
            dietaryAlert = `Halal certification unverified from online listing; please verify with management.`;
          }
        } else if (d === 'nut_allergy' || d === 'gluten_free') {
          // Allergens can NEVER be verified from generic categories alone
          dietaryStatus = 'UNVERIFIED_DATA';
          dietarySafetyVerified = false;
          dietaryFit = Math.min(dietaryFit, 50);
          dietaryAlert = `Allergen safety (${diet.replace('_', ' ')}) unverified online; cross-contamination risk unknown. Contact kitchen directly.`;
        }
      }
    }

    // 4. Pacing Suitability Score
    // GUARDRAIL: Do NOT invent arbitrary high scores based on categories alone.
    // When route evidence is available, score based on actual walking duration.
    // When route evidence is unavailable, return null rather than inventing a score.
    let pacingAlignment: number | null = null;
    const pacing = preferences.preferredPacing;

    if (routeContext?.totalWalkingDurationMinutes !== undefined) {
      const walkMins = routeContext.totalWalkingDurationMinutes;
      if (pacing === 'RELAXED') {
        pacingAlignment = walkMins <= 20 ? 95 : walkMins <= 35 ? 70 : 40;
      } else if (pacing === 'PACKED') {
        pacingAlignment = walkMins >= 30 ? 95 : 75;
      } else {
        // BALANCED
        pacingAlignment = walkMins <= 30 ? 90 : 65;
      }
    }

    // 5. Authenticity Bonus (0 - 15)
    const authenticityScore = place.authenticity?.authenticityScore || 50;
    const authenticityBonus =
      authenticityScore >= 80 ? Math.round((authenticityScore - 70) * 0.5) : 0;

    // 6. Overall Composite Score
    let rawScore: number;
    if (pacingAlignment !== null) {
      rawScore =
        0.45 * vibeMatch +
        0.20 * budgetSuitability +
        0.20 * dietaryFit +
        0.15 * pacingAlignment +
        authenticityBonus;
    } else {
      // Re-normalize weights when route evidence is unavailable (no fabricated score)
      rawScore =
        0.50 * vibeMatch +
        0.25 * budgetSuitability +
        0.25 * dietaryFit +
        authenticityBonus;
    }

    // If severe dietary conflict, clamp score
    if (dietaryFit < 50) {
      rawScore = Math.min(rawScore, 40);
    }

    const matchScore = Math.max(0, Math.min(100, Math.round(rawScore)));

    // 7. Matched Vibes
    const matchedVibes = (preferences.favoriteVibes || []).filter((vibe) => {
      const vKey = vibe.toLowerCase();
      const vWords = vKey.replace(/_/g, ' ');
      return placeLower.includes(vKey) || placeLower.includes(vWords);
    });

    // 8. Primary Match Reason
    const topMatchReasons: string[] = [];
    if (authenticityScore >= 85) {
      topMatchReasons.push(
        `Highly authentic local gem (${authenticityScore}/100) matching your ${matchedVibes[0] || 'neighborhood'} interest.`
      );
    } else if (matchedVibes.length > 0) {
      topMatchReasons.push(`Matches your preference for ${matchedVibes.join(', ')}.`);
    } else {
      topMatchReasons.push(`Recommended cultural spot in ${place.formattedAddress.split(',')[0]}.`);
    }

    const compromiseAlerts: string[] = [];
    if (dietaryAlert) {
      compromiseAlerts.push(dietaryAlert);
    }
    if (budgetSuitability <= 50) {
      compromiseAlerts.push(`Price point may exceed your preferred ${preferences.budgetTier.toLowerCase()} tier.`);
    }

    // CRITICAL GUARDRAIL: An overall match score MUST NEVER imply verified dietary safety.
    // If the traveler has dietary restrictions, the place is NOT recommended unless dietary safety is verified!
    const hasDietaryRestrictions = userDiets.length > 0;
    const isRecommended =
      matchScore >= 65 &&
      (!hasDietaryRestrictions || dietaryStatus === 'VERIFIED_SAFE');

    if (hasDietaryRestrictions && dietaryStatus === 'UNVERIFIED_DATA' && matchScore >= 65) {
      compromiseAlerts.push(
        'High preference alignment, but not recommended for dining until venue confirms dietary/allergen suitability.'
      );
    }

    const isOfflineMock = userEmbedding.isOfflineMock || placeEmbedding.isOfflineMock;

    const result: SoloPlaceMatchResult = {
      placeId: place.id,
      spotName: place.spotName,
      matchScore,
      isRecommended,
      breakdown: {
        vibeMatch,
        budgetSuitability,
        dietaryFit,
        pacingAlignment,
        authenticityBonus,
      },
      topMatchReasons,
      compromiseAlerts,
      matchedVibes,
      dietarySafetyVerified,
      dietaryStatus,
      dietaryAlert,
      practicalTip: place.authenticity?.practicalTips || undefined,
      isOfflineMock,
    };

    results.push(SoloPlaceMatchResultSchema.parse(result));
  }

  // Sort descending by match score
  results.sort((a, b) => b.matchScore - a.matchScore);
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
  const { members, places, limit = 10, options, routeContext } = input;
  const consensus = blendGroupPreferences(members);
  const results: GroupPlaceMatchResult[] = [];

  // Generate embedding for consensus group atmosphere
  const groupAtmosphereText =
    consensus.consensusAtmosphere.join(' ') + ' ' + consensus.recommendedCategoryFocus.join(' ');
  const groupEmbedding = await generateEmbedding(groupAtmosphereText, options);

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

    const placeEmbedding = await generateEmbedding(placeText, options);
    const cosineSim = computeCosineSimilarity(groupEmbedding.values, placeEmbedding.values);
    const vibeMatch = Math.round(cosineSim * 100);

    const placeLower = (
      (place.infoParagraph || '') +
      ' ' +
      (place.categories || []).join(' ') +
      ' ' +
      (place.authenticity?.vibeTags || []).join(' ')
    ).toLowerCase();

    // Strict Dietary Safety Union Check
    // Pure veg, vegan, and Jain are evaluated individually and NOT treated as interchangeable.
    let dietaryStatus: 'VERIFIED_SAFE' | 'CONFLICT_DETECTED' | 'UNVERIFIED_DATA' = 'VERIFIED_SAFE';
    let dietarySafetyVerified = true;
    let dietaryFit = 100;
    const dietaryAlerts: string[] = [];

    if (consensus.dietaryConstraintsUnion.length > 0) {
      for (const diet of consensus.dietaryConstraintsUnion) {
        const d = diet.toLowerCase();
        if (d === 'pure_veg' || d === 'vegetarian') {
          if (
            placeLower.includes('pure veg') ||
            placeLower.includes('pure_veg') ||
            (place.categories || []).includes('pure_veg')
          ) {
            // Verified pure vegetarian
          } else if (
            placeLower.includes('meat') ||
            placeLower.includes('chicken') ||
            placeLower.includes('mutton') ||
            placeLower.includes('pork') ||
            placeLower.includes('beef') ||
            placeLower.includes('barbecue')
          ) {
            dietaryStatus = 'CONFLICT_DETECTED';
            dietarySafetyVerified = false;
            dietaryFit = 0;
            dietaryAlerts.push(`Conflict: Venue serves meat, violating group member's ${diet} requirement.`);
            break;
          } else {
            dietaryStatus = 'UNVERIFIED_DATA';
            dietarySafetyVerified = false;
            dietaryFit = Math.min(dietaryFit, 50);
            dietaryAlerts.push(`Unverified vegetarian suitability; confirm with venue before group arrival.`);
          }
        } else if (d === 'vegan') {
          if (
            placeLower.includes('vegan') ||
            placeLower.includes('plant-based') ||
            placeLower.includes('dairy-free')
          ) {
            // Verified vegan
          } else if (
            placeLower.includes('meat') ||
            placeLower.includes('chicken') ||
            placeLower.includes('pork') ||
            placeLower.includes('beef')
          ) {
            dietaryStatus = 'CONFLICT_DETECTED';
            dietarySafetyVerified = false;
            dietaryFit = 0;
            dietaryAlerts.push(`Conflict: Venue serves meat, violating group member's vegan requirement.`);
            break;
          } else {
            dietaryStatus = 'UNVERIFIED_DATA';
            dietarySafetyVerified = false;
            dietaryFit = Math.min(dietaryFit, 50);
            dietaryAlerts.push(`Vegan compliance unverified: pure veg venues commonly use ghee, butter, and dairy.`);
          }
        } else if (d === 'jain') {
          if (
            placeLower.includes('jain food') ||
            placeLower.includes('jain menu') ||
            placeLower.includes('no onion no garlic')
          ) {
            // Verified Jain
          } else if (
            placeLower.includes('meat') ||
            placeLower.includes('chicken') ||
            placeLower.includes('pork') ||
            placeLower.includes('beef')
          ) {
            dietaryStatus = 'CONFLICT_DETECTED';
            dietarySafetyVerified = false;
            dietaryFit = 0;
            dietaryAlerts.push(`Conflict: Venue serves meat, violating group member's Jain requirement.`);
            break;
          } else {
            dietaryStatus = 'UNVERIFIED_DATA';
            dietarySafetyVerified = false;
            dietaryFit = Math.min(dietaryFit, 50);
            dietaryAlerts.push(`Jain suitability (no root vegetables, onions, or garlic) unverified online.`);
          }
        } else if (d === 'halal') {
          if (placeLower.includes('halal certified') || placeLower.includes('halal meat')) {
            // Verified halal
          } else if (placeLower.includes('pork') || placeLower.includes('bacon')) {
            dietaryStatus = 'CONFLICT_DETECTED';
            dietarySafetyVerified = false;
            dietaryFit = 0;
            dietaryAlerts.push(`Conflict: Venue serves pork, violating group member's halal requirement.`);
            break;
          } else {
            dietaryStatus = 'UNVERIFIED_DATA';
            dietarySafetyVerified = false;
            dietaryFit = Math.min(dietaryFit, 50);
            dietaryAlerts.push(`Halal certification unverified online.`);
          }
        } else if (d === 'nut_allergy' || d === 'gluten_free') {
          // Allergens cannot be verified safe from general listing alone
          dietaryStatus = 'UNVERIFIED_DATA';
          dietarySafetyVerified = false;
          dietaryFit = Math.min(dietaryFit, 50);
          dietaryAlerts.push(`Group member allergen (${diet}) unverified online; please contact kitchen.`);
        }
      }
    }

    // Budget Fit for Group Range
    let budgetSuitability = 80;
    if (placeLower.includes('cheap') || placeLower.includes('affordable')) {
      budgetSuitability = 95;
    } else if (placeLower.includes('fine dining') || placeLower.includes('expensive')) {
      budgetSuitability = consensus.budgetConsensusRange.maxCurrencyAmount < 300 ? 30 : 70;
    }

    // Pacing suitability: Use routeContext if available, otherwise return null
    let pacingAlignment: number | null = null;
    if (routeContext?.totalWalkingDurationMinutes !== undefined) {
      const walkMins = routeContext.totalWalkingDurationMinutes;
      pacingAlignment = walkMins <= 30 ? 90 : 65;
    }

    // Authenticity Bonus
    const authenticityScore = place.authenticity?.authenticityScore || 50;
    const authenticityBonus =
      authenticityScore >= 80 ? Math.round((authenticityScore - 70) * 0.5) : 0;

    // Calculate individual member satisfaction scores
    const memberSatisfactionScores: Record<string, number> = {};
    for (const m of members) {
      const memberVibes = m.vibes || [];
      const matchedCount = memberVibes.filter((v) => {
        const vKey = v.toLowerCase();
        const vWords = vKey.replace(/_/g, ' ');
        return (
          placeLower.includes(vKey) ||
          placeLower.includes(vWords) ||
          (place.authenticity?.vibeTags || []).some(
            (tag) => tag.toLowerCase() === vKey || tag.toLowerCase().replace(/_/g, ' ') === vWords
          )
        );
      }).length;
      const ratio = memberVibes.length > 0 ? matchedCount / memberVibes.length : 0.7;
      let memberScore = Math.round(ratio * 60 + vibeMatch * 0.4);
      if (
        dietaryStatus === 'CONFLICT_DETECTED' &&
        m.dietaryRestrictions?.some((d) => consensus.dietaryConstraintsUnion.includes(d))
      ) {
        memberScore = Math.min(memberScore, 30);
      }
      memberSatisfactionScores[m.userId] = Math.max(0, Math.min(100, memberScore));
    }

    // Overall Group Score
    let rawGroupScore: number;
    if (pacingAlignment !== null) {
      rawGroupScore =
        0.45 * vibeMatch +
        0.25 * dietaryFit +
        0.20 * budgetSuitability +
        0.10 * pacingAlignment +
        authenticityBonus;
    } else {
      rawGroupScore =
        0.50 * vibeMatch +
        0.25 * dietaryFit +
        0.25 * budgetSuitability +
        authenticityBonus;
    }

    if (dietaryStatus === 'CONFLICT_DETECTED') {
      rawGroupScore = Math.min(rawGroupScore, 40);
    }
    const groupMatchScore = Math.max(0, Math.min(100, Math.round(rawGroupScore)));

    // Shared Group Vibes Matched
    const sharedGroupVibesMatched = consensus.consensusAtmosphere.filter(
      (vibe) =>
        placeLower.includes(vibe.toLowerCase()) ||
        (place.authenticity?.vibeTags || []).some((tag) => tag.toLowerCase().includes(vibe.toLowerCase()))
    );

    // Primary Group Reason
    const topMatchReasons: string[] = [];
    if (dietaryStatus === 'CONFLICT_DETECTED') {
      topMatchReasons.push(`Caution: Conflicts with group dietary constraints.`);
    } else {
      topMatchReasons.push(
        `Fulfills group consensus on ${sharedGroupVibesMatched.join(', ') || 'neighborhood experience'}.`
      );
    }

    const compromiseAlerts: string[] = [...consensus.compromiseFactors, ...dietaryAlerts];

    // CRITICAL GUARDRAIL: If group has dietary restrictions, venue is NOT recommended unless verified safe!
    const hasGroupDietaryRestrictions = consensus.dietaryConstraintsUnion.length > 0;
    const isRecommended =
      groupMatchScore >= 65 &&
      (!hasGroupDietaryRestrictions || dietaryStatus === 'VERIFIED_SAFE');

    if (hasGroupDietaryRestrictions && dietaryStatus === 'UNVERIFIED_DATA' && groupMatchScore >= 65) {
      compromiseAlerts.push(
        'High group preference alignment, but not recommended for group dining until venue confirms dietary/allergen suitability.'
      );
    }

    const isOfflineMock = groupEmbedding.isOfflineMock || placeEmbedding.isOfflineMock;

    const groupResult: GroupPlaceMatchResult = {
      placeId: place.id,
      spotName: place.spotName,
      matchScore: groupMatchScore,
      isRecommended,
      breakdown: {
        vibeMatch,
        budgetSuitability,
        dietaryFit,
        pacingAlignment,
        authenticityBonus,
      },
      memberSatisfactionScores,
      topMatchReasons,
      compromiseAlerts,
      sharedGroupVibesMatched,
      dietarySafetyVerified,
      dietaryStatus,
      isOfflineMock,
    };

    results.push(GroupPlaceMatchResultSchema.parse(groupResult));
  }

  // Sort descending by group match score
  results.sort((a, b) => b.matchScore - a.matchScore);
  return results.slice(0, limit);
}
