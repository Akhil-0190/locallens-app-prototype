/**
 * Startup Buildathon 2026 — Neighborhood Guide App
 * Task B4 Test Suite: Gemini Embeddings, Solo & Group Taste Matching
 * 
 * Verifies all 16 required scenarios:
 * 1. Individual traveler preference representation
 * 2. Individual place/preference similarity
 * 3. Strong individual preference match
 * 4. Weak individual preference match
 * 5. Incomplete or missing traveler preferences
 * 6. Group preference blending (Domain 09 ConsensusBlendOutput)
 * 7. Shared group preferences
 * 8. Conflicting group preferences
 * 9. Minority preference preservation
 * 10. Hard constraints vs soft preferences (Strict Dietary Union)
 * 11. Group-to-place matching
 * 12. Explainable match reasons
 * 13. Invalid or malformed preference input
 * 14. Output schema validation
 * 15. Embedding response validation (3,072 dimensions)
 * 16. Offline test-adapter behavior & transparent labeling
 */

import {
  generateEmbedding,
  computeCosineSimilarity,
  generateOfflineTestVector,
  blendGroupPreferences,
  matchSoloPreferences,
  matchGroupPreferences,
  EMBEDDING_DIMENSIONS,
} from '../src/ai/services/ai-service.js';
import {
  TravelerPreferencesDocument,
  MemberPreferenceInput,
  CanonicalPlaceDocument,
  ConsensusBlendOutputSchema,
} from '../src/types/contracts/index.js';
import {
  SoloPlaceMatchResultSchema,
  GroupPlaceMatchResultSchema,
} from '../src/ai/schemas/matching-schemas.js';

let passed = 0;
let total = 0;

function assert(condition: boolean, testName: string) {
  total++;
  if (!condition) {
    console.error(`❌ FAILED: ${testName}`);
    process.exitCode = 1;
  } else {
    console.log(`✅ PASSED: ${testName}`);
    passed++;
  }
}

// Representative Sample Places (Domain 06)
const sampleHeritageDosaSpot: CanonicalPlaceDocument = {
  id: 'spot_ctr_1924',
  placeId: 'ChIJ82NqvCUWrjsRC33A4yTYQWk',
  spotName: 'CTR Shri Sagar',
  formattedAddress: '7th Cross Road, Malleshwaram, Bengaluru',
  coordinate: { latitude: 13.003185, longitude: 77.570258, precision: 6, formatted: '13.003185, 77.570258', isValid: true },
  mapsLink: 'https://maps.google.com/?cid=1029384756',
  primaryCategory: 'restaurant',
  categories: ['breakfast_restaurant', 'cafe', 'pure_veg', 'heritage'],
  infoParagraph: 'Generational pure veg benne masala dosa and filter coffee prepared on cast iron tawa since 1924 in Malleshwaram. Affordable legacy breakfast under 150 INR.',
  photoUrls: ['https://storage.googleapis.com/spots/ctr.jpg'],
  openHours: '7:30 AM - 12:30 PM & 4:00 PM - 9:00 PM',
  isOpenNow: true,
  authenticity: {
    authenticityScore: 94,
    touristTrapLikelihood: 'LOW',
    isTouristTrap: false,
    localSentimentSummary: 'Cherished generational institution with pure veg authentic South Indian recipes.',
    recommendedTiming: 'Morning before 8:30 AM to avoid lines',
    practicalTips: 'Token counter at entrance; cash and UPI preferred.',
    greetingCard: 'Welcome to CTR! The golden standard of Bengaluru benne dosa.',
    vibeTags: ['heritage', 'vintage_filter_coffee', 'pure_veg', 'breakfast'],
  },
  capacity: {
    hourlyLimit: 12,
    currentVisitors: 4,
    remainingCapacity: 8,
    crowdLevel: 'MODERATE',
    isThrottled: false,
    lastUpdatedSlot: '2026-11-20T08:00:00Z',
  },
  isVerified: true,
  isMockData: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const sampleMeatBarbecueSpot: CanonicalPlaceDocument = {
  id: 'spot_bbq_meat_202',
  placeId: 'ChIJxyz_meat_spot',
  spotName: 'Smoky Ribs & Grill House',
  formattedAddress: '100 Feet Road, Indiranagar, Bengaluru',
  coordinate: { latitude: 12.9716, longitude: 77.6412, precision: 6, formatted: '12.9716, 77.6412', isValid: true },
  mapsLink: 'https://maps.google.com/?cid=99887766',
  primaryCategory: 'barbecue_restaurant',
  categories: ['barbecue_restaurant', 'meat', 'pub', 'nightlife'],
  infoParagraph: 'Heavy pork ribs, beef steaks, and craft beer pub with loud music. Expensive dining averaging 1200 INR per person.',
  photoUrls: [],
  openHours: '12:00 PM - 11:30 PM',
  isOpenNow: true,
  authenticity: {
    authenticityScore: 60,
    touristTrapLikelihood: 'MODERATE',
    isTouristTrap: false,
    localSentimentSummary: 'Popular weekend nightlife hangout for modern cocktails and meat platters.',
    recommendedTiming: 'Friday evening with table reservation',
    practicalTips: 'Cover charges on weekends.',
    greetingCard: 'Enjoy craft brews and grilled meats.',
    vibeTags: ['nightlife', 'meat', 'craft_beer', 'packed'],
  },
  capacity: {
    hourlyLimit: 20,
    currentVisitors: 15,
    remainingCapacity: 5,
    crowdLevel: 'HIGH',
    isThrottled: false,
    lastUpdatedSlot: '2026-11-20T20:00:00Z',
  },
  isVerified: true,
  isMockData: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

async function runB4Tests() {
  console.log('================================================================');
  console.log('  Startup Buildathon 2026 — Task B4 AI Group Matching Suite     ');
  console.log('  Gemini Embedding 2, Solo & Group Taste Consensus Matching     ');
  console.log('================================================================\n');

  // -------------------------------------------------------------------------
  // Scenario 1: Individual Traveler Preference Representation
  // -------------------------------------------------------------------------
  console.log('--- [Scenario 1] Individual Traveler Preference Representation ---');
  const soloVegTraveler: TravelerPreferencesDocument = {
    userId: 'usr_solo_heritage_1',
    favoriteVibes: ['heritage', 'vintage_filter_coffee', 'pure_veg'],
    dietaryRestrictions: ['pure_veg'],
    budgetTier: 'BUDGET',
    maxBudgetPerMealInr: 200,
    preferredPacing: 'RELAXED',
    preferredNeighborhoods: ['Malleshwaram'],
    accessibilityNeeds: [],
    updatedAt: new Date().toISOString(),
  };

  assert(soloVegTraveler.favoriteVibes.length === 3, 'Individual preferences support multiple vibe tags');
  assert(soloVegTraveler.budgetTier === 'BUDGET', 'Budget tier represented');
  assert(soloVegTraveler.preferredPacing === 'RELAXED', 'Travel pacing represented');

  // -------------------------------------------------------------------------
  // Scenario 2: Embedding Generation & 3,072-Dimensional Vector Validation
  // -------------------------------------------------------------------------
  console.log('\n--- [Scenario 2] Gemini Embedding 2 Vector Validation ---');
  const embedding = await generateEmbedding('Authentic South Indian filter coffee in Malleshwaram');
  assert(embedding.dimensions === 3072, 'Embedding vector has exactly 3,072 dimensions');
  assert(embedding.values.length === 3072, 'Embedding values array contains 3,072 elements');
  assert(typeof embedding.values[0] === 'number', 'Embedding elements are floating-point numbers');

  // -------------------------------------------------------------------------
  // Scenario 3: Place & Preference Cosine Similarity
  // -------------------------------------------------------------------------
  console.log('\n--- [Scenario 3] Cosine Similarity Vector Mathematics ---');
  const vec1 = generateOfflineTestVector('heritage filter coffee and dosa');
  const vec2 = generateOfflineTestVector('heritage filter coffee and dosa');
  const vec3 = generateOfflineTestVector('loud industrial techno nightclub');

  const simIdentical = computeCosineSimilarity(vec1, vec2);
  const simDivergent = computeCosineSimilarity(vec1, vec3);

  assert(Math.abs(simIdentical - 1.0) < 0.01, 'Cosine similarity of identical concepts is ~1.0');
  assert(simDivergent < simIdentical, 'Cosine similarity of divergent concepts is significantly lower');

  // -------------------------------------------------------------------------
  // Scenario 4: Strong Individual Preference Match
  // -------------------------------------------------------------------------
  console.log('\n--- [Scenario 4] Strong Individual Preference Match ---');
  const soloResults = await matchSoloPreferences({
    preferences: soloVegTraveler,
    places: [sampleHeritageDosaSpot, sampleMeatBarbecueSpot],
  });

  const topMatch = soloResults[0]!;
  assert(topMatch.placeId === sampleHeritageDosaSpot.id, 'Top match is the heritage vegetarian dosa spot');
  assert(topMatch.matchScore >= 80, 'Strong match receives high overall score (>= 80)');
  assert(topMatch.isRecommended === true, 'Strong match is marked as recommended');
  assert(topMatch.matchedVibes.includes('heritage'), 'Heritage vibe explicitly matched');
  assert(topMatch.topMatchReasons.length > 0, 'topMatchReasons populated');
  assert(topMatch.breakdown.pacingAlignment === null, 'Pacing alignment is null when route evidence is absent');
  assert(topMatch.dietarySafetyVerified === true, 'Dietary safety verified for pure veg traveler at pure veg spot');
  assert(topMatch.dietaryStatus === 'VERIFIED_SAFE', 'Dietary status marked VERIFIED_SAFE for pure veg traveler');

  // Verify pacing alignment when route evidence is provided
  const soloRouteResults = await matchSoloPreferences({
    preferences: soloVegTraveler,
    places: [sampleHeritageDosaSpot],
    routeContext: {
      totalWalkingDurationMinutes: 15,
      totalDistanceMeters: 900,
      numberOfStops: 2,
    },
  });
  assert(soloRouteResults[0]!.breakdown.pacingAlignment !== null, 'Pacing alignment calculated when routeContext is provided');
  assert(soloRouteResults[0]!.breakdown.pacingAlignment === 95, 'Relaxed pacing score calculated from 15 min walk duration');

  // Verify Vegan Traveler vs Pure Veg Venue (CTR uses butter/ghee/milk)
  const soloVeganTraveler: TravelerPreferencesDocument = {
    userId: 'usr_solo_vegan',
    favoriteVibes: ['heritage'],
    dietaryRestrictions: ['vegan'],
    budgetTier: 'BUDGET',
    maxBudgetPerMealInr: 200,
    preferredPacing: 'RELAXED',
    preferredNeighborhoods: ['Malleshwaram'],
    accessibilityNeeds: [],
    updatedAt: new Date().toISOString(),
  };
  const veganResults = await matchSoloPreferences({
    preferences: soloVeganTraveler,
    places: [sampleHeritageDosaSpot],
  });
  const veganMatch = veganResults[0]!;
  assert(veganMatch.dietarySafetyVerified === false, 'Pure veg venue alone does NOT verify vegan suitability');
  assert(veganMatch.dietaryStatus === 'UNVERIFIED_DATA', 'Vegan status is UNVERIFIED_DATA due to butter/ghee/dairy risk');
  assert(veganMatch.isRecommended === false, 'Venue is NOT recommended when vegan safety is unverified despite high vibe match');
  assert(
    veganMatch.compromiseAlerts.some((a) => a.toLowerCase().includes('vegan') || a.toLowerCase().includes('dairy') || a.toLowerCase().includes('ghee')),
    'Emits vegan alert about butter/ghee/dairy usage in South Indian pure veg venues'
  );

  // Verify Jain Traveler vs Pure Veg Venue (masala dosa contains potato & onion)
  const soloJainTraveler: TravelerPreferencesDocument = {
    userId: 'usr_solo_jain',
    favoriteVibes: ['heritage'],
    dietaryRestrictions: ['jain'],
    budgetTier: 'BUDGET',
    maxBudgetPerMealInr: 200,
    preferredPacing: 'RELAXED',
    preferredNeighborhoods: ['Malleshwaram'],
    accessibilityNeeds: [],
    updatedAt: new Date().toISOString(),
  };
  const jainResults = await matchSoloPreferences({
    preferences: soloJainTraveler,
    places: [sampleHeritageDosaSpot],
  });
  const jainMatch = jainResults[0]!;
  assert(jainMatch.dietarySafetyVerified === false, 'Pure veg venue alone does NOT verify Jain suitability');
  assert(jainMatch.dietaryStatus === 'UNVERIFIED_DATA', 'Jain status is UNVERIFIED_DATA without root-veg verification');
  assert(jainMatch.isRecommended === false, 'Venue is NOT recommended when Jain safety is unverified');
  assert(
    jainMatch.compromiseAlerts.some((a) => a.toLowerCase().includes('jain') || a.toLowerCase().includes('root') || a.toLowerCase().includes('onion')),
    'Emits Jain alert about root vegetables and onions'
  );

  // Verify Unverified Venue (isVerified: false) cannot claim VERIFIED_SAFE even if category says pure_veg
  const unverifiedPureVegSpot: CanonicalPlaceDocument = {
    ...sampleHeritageDosaSpot,
    id: 'spot_unverified_veg',
    isVerified: false,
  };
  const unverifiedResults = await matchSoloPreferences({
    preferences: soloVegTraveler,
    places: [unverifiedPureVegSpot],
  });
  assert(unverifiedResults[0]!.dietarySafetyVerified === false, 'Unverified venue record cannot produce VERIFIED_SAFE');
  assert(unverifiedResults[0]!.dietaryStatus === 'UNVERIFIED_DATA', 'Unverified venue record stays UNVERIFIED_DATA');
  assert(unverifiedResults[0]!.isRecommended === false, 'Unverified venue is NOT recommended for dietary traveler');

  // -------------------------------------------------------------------------
  // Scenario 5: Weak Individual Preference Match & Dietary Constraint Penalty
  // -------------------------------------------------------------------------
  console.log('\n--- [Scenario 5] Weak Match & Dietary Constraint Penalty ---');
  const weakMatch = soloResults.find((r) => r.placeId === sampleMeatBarbecueSpot.id)!;
  assert(weakMatch.matchScore < 50, 'Meat barbecue spot receives penalized score (< 50) for pure veg traveler');
  assert(weakMatch.isRecommended === false, 'Meat spot is not recommended for pure veg traveler');
  assert(Boolean(weakMatch.dietaryAlert), 'Dietary alert is emitted for non-compliant spot');

  // -------------------------------------------------------------------------
  // Scenario 6: Incomplete or Missing Traveler Preferences (Zero-Bias Handling)
  // -------------------------------------------------------------------------
  console.log('\n--- [Scenario 6] Incomplete or Missing Traveler Preferences ---');
  const blankTraveler: TravelerPreferencesDocument = {
    userId: 'usr_blank_traveler',
    favoriteVibes: [],
    dietaryRestrictions: [],
    budgetTier: 'MODERATE',
    maxBudgetPerMealInr: 250,
    preferredPacing: 'BALANCED',
    preferredNeighborhoods: [],
    accessibilityNeeds: [],
    updatedAt: new Date().toISOString(),
  };

  const blankResults = await matchSoloPreferences({
    preferences: blankTraveler,
    places: [sampleHeritageDosaSpot],
  });
  assert(blankResults[0]!.matchScore >= 60, 'Graceful handling of empty preferences without throwing errors');
  assert(blankResults[0]!.topMatchReasons.length > 0, 'Generates sensible explanation even with missing preferences');

  // -------------------------------------------------------------------------
  // Scenario 7: Group Preference Blending (Domain 09 ConsensusBlendOutput)
  // -------------------------------------------------------------------------
  console.log('\n--- [Scenario 7] Group Preference Blending (Domain 09) ---');
  const groupMembers: MemberPreferenceInput[] = [
    {
      userId: 'usr_mem_1',
      displayName: 'Aravinth',
      vibes: ['heritage', 'vintage_filter_coffee'],
      dietaryRestrictions: ['pure_veg'],
      maxBudgetAmount: 200,
      weighting: 1.0,
    },
    {
      userId: 'usr_mem_2',
      displayName: 'Sneha',
      vibes: ['heritage', 'arts_culture'],
      dietaryRestrictions: ['nut_allergy'],
      maxBudgetAmount: 500,
      weighting: 1.2,
    },
    {
      userId: 'usr_mem_3',
      displayName: 'Kiran',
      vibes: ['street_food', 'lively'],
      dietaryRestrictions: [],
      maxBudgetAmount: 300,
      weighting: 0.8,
    },
  ];

  const blended = blendGroupPreferences(groupMembers);
  const validatedBlend = ConsensusBlendOutputSchema.parse(blended);

  assert(validatedBlend.consensusAtmosphere.length > 0, 'Consensus atmosphere generated');
  assert(validatedBlend.consensusAtmosphere[0] === 'heritage', 'Shared majority vibe "heritage" prioritized');

  // -------------------------------------------------------------------------
  // Scenario 8: Shared Group Preferences Prioritization
  // -------------------------------------------------------------------------
  console.log('\n--- [Scenario 8] Shared Group Preferences Prioritized ---');
  assert(
    blended.consensusAtmosphere.includes('heritage'),
    'Shared vibe "heritage" present in consensus atmosphere'
  );

  // -------------------------------------------------------------------------
  // Scenario 9: Conflicting Group Preferences & Compromise Factors
  // -------------------------------------------------------------------------
  console.log('\n--- [Scenario 9] Conflicting Group Preferences & Compromises ---');
  assert(blended.compromiseFactors.length > 0, 'Compromise factors explicitly articulated');
  assert(
    blended.budgetConsensusRange.minCurrencyAmount === 200,
    'Budget consensus range min is capped at lowest member budget (₹200)'
  );

  // -------------------------------------------------------------------------
  // Scenario 10: Strict Dietary Constraints Union (Non-Negotiable Safety Rule)
  // -------------------------------------------------------------------------
  console.log('\n--- [Scenario 10] Strict Dietary Constraints Union ---');
  assert(
    blended.dietaryConstraintsUnion.includes('pure_veg'),
    'Dietary union includes member 1 "pure_veg"'
  );
  assert(
    blended.dietaryConstraintsUnion.includes('nut_allergy'),
    'Dietary union includes member 2 "nut_allergy"'
  );
  assert(
    blended.dietaryConstraintsUnion.length === 2,
    'Dietary union strictly unions distinct member restrictions'
  );

  // -------------------------------------------------------------------------
  // Scenario 11: Minority Preference Preservation
  // -------------------------------------------------------------------------
  console.log('\n--- [Scenario 11] Minority Preference Preservation ---');
  const hasMinorityMention = blended.compromiseFactors.some(
    (c) => c.toLowerCase().includes('minority') || c.toLowerCase().includes('arts_culture') || c.toLowerCase().includes('lively')
  );
  assert(hasMinorityMention, 'Minority preference preserved in compromise factors instead of discarded');

  // -------------------------------------------------------------------------
  // Scenario 12: Group-to-Place Matching & Member Satisfaction
  // -------------------------------------------------------------------------
  console.log('\n--- [Scenario 12] Group-to-Place Matching & Member Satisfaction ---');
  const groupResults = await matchGroupPreferences({
    neighborhood: 'Malleshwaram',
    members: groupMembers,
    places: [sampleHeritageDosaSpot, sampleMeatBarbecueSpot],
  });

  const topGroupSpot = groupResults[0]!;
  assert(topGroupSpot.placeId === sampleHeritageDosaSpot.id, 'Top group recommendation is the heritage spot');
  assert(
    topGroupSpot.dietarySafetyVerified === false,
    'Guardrail: Unverified nut allergy in group union prevents false dietary safety guarantee'
  );
  assert(
    topGroupSpot.dietaryStatus === 'UNVERIFIED_DATA',
    'Dietary status marked as UNVERIFIED_DATA for unverified allergen'
  );
  assert(
    topGroupSpot.isRecommended === false,
    'Guardrail: Group venue with unverified allergen is NOT recommended despite high preference score'
  );
  assert(
    topGroupSpot.compromiseAlerts.some((a) => a.includes('allergen') || a.includes('nut_allergy') || a.includes('dietary/allergen suitability')),
    'Compromise alerts contain allergen verification warning'
  );
  assert(topGroupSpot.memberSatisfactionScores['usr_mem_1']! >= 70, 'Member 1 has high satisfaction score');
  assert(topGroupSpot.memberSatisfactionScores['usr_mem_2']! >= 60, 'Member 2 has healthy satisfaction score');

  // Verify pure vegetarian group achieves VERIFIED_SAFE on pure veg venue
  const vegOnlyMembers: MemberPreferenceInput[] = [
    {
      userId: 'usr_veg_1',
      displayName: 'Aravinth',
      vibes: ['heritage'],
      dietaryRestrictions: ['pure_veg'],
      maxBudgetAmount: 250,
      weighting: 1.0,
    },
    {
      userId: 'usr_veg_2',
      displayName: 'Kiran',
      vibes: ['heritage'],
      dietaryRestrictions: ['pure_veg'],
      maxBudgetAmount: 300,
      weighting: 1.0,
    },
  ];

  const vegGroupResults = await matchGroupPreferences({
    neighborhood: 'Malleshwaram',
    members: vegOnlyMembers,
    places: [sampleHeritageDosaSpot],
  });
  assert(
    vegGroupResults[0]!.dietarySafetyVerified === true,
    'Dietary safety verified when venue explicitly certifies pure vegetarian'
  );
  assert(
    vegGroupResults[0]!.dietaryStatus === 'VERIFIED_SAFE',
    'Dietary status marked as VERIFIED_SAFE when venue explicitly certifies pure vegetarian'
  );
  assert(
    vegGroupResults[0]!.isRecommended === true,
    'Group recommendation is true when preferences match AND dietary safety is verified'
  );
  assert(
    topGroupSpot.breakdown.pacingAlignment === null,
    'Group pacing alignment is null when route evidence is omitted'
  );

  // Verify Group Pacing with Route Evidence (Developer C route input)
  const groupWithRouteResults = await matchGroupPreferences({
    neighborhood: 'Malleshwaram',
    members: vegOnlyMembers,
    places: [sampleHeritageDosaSpot],
    routeContext: {
      totalWalkingDurationMinutes: 20,
      totalDistanceMeters: 1200,
      numberOfStops: 3,
    },
  });
  assert(
    groupWithRouteResults[0]!.breakdown.pacingAlignment === 90,
    'Group pacing alignment is 90 when routeContext has 20 min walking duration'
  );

  // -------------------------------------------------------------------------
  // Scenario 13: Dietary Violation Disqualifies Group Spot
  // -------------------------------------------------------------------------
  console.log('\n--- [Scenario 13] Group Dietary Violation Disqualification ---');
  const meatGroupSpot = groupResults.find((r) => r.placeId === sampleMeatBarbecueSpot.id)!;
  assert(meatGroupSpot.dietarySafetyVerified === false, 'Meat spot fails group dietary safety verification');
  assert(meatGroupSpot.dietaryStatus === 'CONFLICT_DETECTED', 'Dietary status marked as CONFLICT_DETECTED');
  assert(meatGroupSpot.isRecommended === false, 'Meat spot is NOT recommended for group containing vegetarian member');
  assert(meatGroupSpot.matchScore <= 40, 'Meat spot score heavily penalized for group');

  // -------------------------------------------------------------------------
  // Scenario 14: Explainable Match Reasons
  // -------------------------------------------------------------------------
  console.log('\n--- [Scenario 14] Explainable Match Reasons ---');
  assert(topGroupSpot.topMatchReasons.length > 0, 'topMatchReasons populated');
  assert(topGroupSpot.compromiseAlerts.length > 0, 'compromiseAlerts populated');
  assert(topGroupSpot.sharedGroupVibesMatched.length > 0, 'Shared group vibes listed');

  // -------------------------------------------------------------------------
  // Scenario 15: Invalid or Malformed Input Handling
  // -------------------------------------------------------------------------
  console.log('\n--- [Scenario 15] Invalid or Malformed Input Handling ---');
  let threwBlendError = false;
  try {
    blendGroupPreferences([]);
  } catch (err: any) {
    threwBlendError = true;
  }
  assert(threwBlendError, 'Throws error when blending empty members list');

  let threwEmbedError = false;
  try {
    await generateEmbedding('   ');
  } catch (err: any) {
    threwEmbedError = true;
  }
  assert(threwEmbedError, 'Throws error when generating embedding for blank text');

  // -------------------------------------------------------------------------
  // Scenario 16: Output Schema Validation & Test Adapter Behavior
  // -------------------------------------------------------------------------
  console.log('\n--- [Scenario 16] Schema Validation & Offline Test Adapter ---');
  const validatedSoloResult = SoloPlaceMatchResultSchema.parse(soloResults[0]);
  assert(validatedSoloResult.placeId === sampleHeritageDosaSpot.id, 'Solo match result strictly adheres to Zod schema');

  const validatedGroupResult = GroupPlaceMatchResultSchema.parse(groupResults[0]);
  assert(validatedGroupResult.placeId === sampleHeritageDosaSpot.id, 'Group match result strictly adheres to Zod schema');

  // Force offline adapter check
  const offlineVector = await generateEmbedding('Offline test verification text', { forceOffline: true });
  assert(offlineVector.isOfflineMock === true, 'Offline adapter vector explicitly flagged as isOfflineMock: true');
  assert(offlineVector.dimensions === 3072, 'Offline adapter vector maintains exact 3,072 dimensions');

  // -------------------------------------------------------------------------
  // Scenario 17: D3 Client Serialization Compatibility
  // -------------------------------------------------------------------------
  console.log('\n--- [Scenario 17] D3 Client Serialization Compatibility ---');
  const soloJson = JSON.parse(JSON.stringify(soloResults[0]));
  assert(typeof soloJson.matchScore === 'number', 'D3 Contract: matchScore is numeric');
  assert(typeof soloJson.isRecommended === 'boolean', 'D3 Contract: isRecommended is boolean');
  assert(typeof soloJson.dietarySafetyVerified === 'boolean', 'D3 Contract: dietarySafetyVerified is boolean');
  assert(
    ['VERIFIED_SAFE', 'CONFLICT_DETECTED', 'UNVERIFIED_DATA'].includes(soloJson.dietaryStatus),
    'D3 Contract: dietaryStatus is valid enum'
  );
  assert(Array.isArray(soloJson.topMatchReasons), 'D3 Contract: topMatchReasons is array of strings');
  assert(Array.isArray(soloJson.compromiseAlerts), 'D3 Contract: compromiseAlerts is array of strings');
  assert(typeof soloJson.isOfflineMock === 'boolean', 'D3 Contract: isOfflineMock is boolean');
  assert(soloJson.breakdown && typeof soloJson.breakdown.vibeMatch === 'number', 'D3 Contract: breakdown contains vibeMatch');
  assert(soloJson.breakdown && typeof soloJson.breakdown.budgetSuitability === 'number', 'D3 Contract: breakdown contains budgetSuitability');
  assert(soloJson.breakdown && typeof soloJson.breakdown.dietaryFit === 'number', 'D3 Contract: breakdown contains dietaryFit');
  assert(
    soloJson.breakdown && (soloJson.breakdown.pacingAlignment === null || typeof soloJson.breakdown.pacingAlignment === 'number'),
    'D3 Contract: pacingAlignment is nullable number'
  );

  const groupJson = JSON.parse(JSON.stringify(groupResults[0]));
  assert(typeof groupJson.matchScore === 'number', 'D3 Group Contract: matchScore is numeric');
  assert(typeof groupJson.memberSatisfactionScores === 'object', 'D3 Group Contract: memberSatisfactionScores is object');
  assert(Array.isArray(groupJson.sharedGroupVibesMatched), 'D3 Group Contract: sharedGroupVibesMatched is array');

  // -------------------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------------------
  console.log('\n================================================================');
  console.log(`B4 Test Suite Results: ${passed} / ${total} tests passed.`);
  console.log('================================================================\n');
}

runB4Tests().catch((err) => {
  console.error('Fatal error in B4 tests:', err);
  process.exit(1);
});
