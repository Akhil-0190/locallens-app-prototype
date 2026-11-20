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
  PlaceDietaryEvidence,
  TRUSTED_SERVER_AUTH_SYMBOL,
} from '../src/ai/schemas/matching-schemas.js';

// Verifiable Dietary Evidence Fixtures (Domain 09 Grounding Guardrails)
const verifiedPureVegCertification: PlaceDietaryEvidence = {
  certification: {
    issuingOrganization: 'Satvik Food Certification Council',
    evidenceReference: 'CERT-SATVIK-VEG-2026-889',
    verificationStatus: 'VERIFIED',
    verificationDate: '2026-01-15T10:00:00Z',
    validUntil: '2027-01-15T10:00:00Z',
    certificationScope: ['pure_veg', 'vegetarian'],
  },
};

const fssaiLicenseEvidence: PlaceDietaryEvidence = {
  certification: {
    issuingOrganization: 'FSSAI Food Safety and Standards Authority of India',
    evidenceReference: 'FSSAI-LIC-112233445566',
    verificationStatus: 'VERIFIED',
    verificationDate: '2026-01-01T00:00:00Z',
    validUntil: '2027-01-01T00:00:00Z',
    certificationScope: ['pure_veg', 'vegetarian'],
  },
};

const expiredCertEvidence: PlaceDietaryEvidence = {
  certification: {
    issuingOrganization: 'Satvik Food Certification Council',
    evidenceReference: 'CERT-EXPIRED-2020',
    verificationStatus: 'EXPIRED',
    verificationDate: '2019-01-01T00:00:00Z',
    validUntil: '2020-01-01T00:00:00Z',
    certificationScope: ['pure_veg', 'vegetarian'],
  },
};

const revokedCertEvidence: PlaceDietaryEvidence = {
  certification: {
    issuingOrganization: 'Satvik Food Certification Council',
    evidenceReference: 'CERT-REVOKED-999',
    verificationStatus: 'REVOKED',
    verificationDate: '2026-01-01T00:00:00Z',
    validUntil: '2027-01-01T00:00:00Z',
    certificationScope: ['pure_veg', 'vegetarian'],
  },
};

const verifiedCommunityAuditVeg: PlaceDietaryEvidence = {
  communityAudit: {
    auditorId: 'aud_priya_resident_42',
    auditorName: 'Priya Sharma',
    auditDate: '2026-02-10T09:30:00Z',
    kitchenConditionAssessed: 'Inspected separate dedicated vegetarian cookware, zero non-veg storage on premises',
    evidenceSource: 'submission_audit_doc_9912',
    verificationStatus: 'VERIFIED',
    auditScope: ['pure_veg', 'vegetarian'],
  },
};

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
  infoParagraph: 'Generational certified pure vegetarian benne masala dosa and filter coffee prepared in dedicated pure vegetarian kitchen since 1924 in Malleshwaram. Affordable legacy breakfast under 150 INR.',
  photoUrls: ['https://storage.googleapis.com/spots/ctr.jpg'],
  openHours: '7:30 AM - 12:30 PM & 4:00 PM - 9:00 PM',
  isOpenNow: true,
  authenticity: {
    authenticityScore: 94,
    touristTrapLikelihood: 'LOW',
    isTouristTrap: false,
    localSentimentSummary: 'Cherished generational institution with certified pure veg authentic South Indian recipes.',
    recommendedTiming: 'Morning before 8:30 AM to avoid lines',
    practicalTips: 'Token counter at entrance; cash and UPI preferred.',
    greetingCard: 'Welcome to CTR! The golden standard of Bengaluru benne dosa.',
    vibeTags: ['heritage', 'vintage_filter_coffee', 'pure_veg', 'breakfast'],
  },
  contributorAttribution: {
    userId: 'usr_priya_resident',
    displayName: 'Priya Sharma',
    badgeTitle: 'Local Historian',
    isVerifiedResident: true,
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
  // 1. Solo Traveler WITHOUT dietary restrictions matching CTR
  const soloGeneralTraveler: TravelerPreferencesDocument = {
    userId: 'usr_solo_heritage_gen',
    favoriteVibes: ['heritage', 'vintage_filter_coffee'],
    dietaryRestrictions: [],
    budgetTier: 'BUDGET',
    maxBudgetPerMealInr: 200,
    preferredPacing: 'RELAXED',
    preferredNeighborhoods: ['Malleshwaram'],
    accessibilityNeeds: [],
    updatedAt: new Date().toISOString(),
  };

  const generalResults = await matchSoloPreferences({
    preferences: soloGeneralTraveler,
    places: [sampleHeritageDosaSpot, sampleMeatBarbecueSpot],
  });
  const topMatch = generalResults[0]!;
  assert(topMatch.placeId === sampleHeritageDosaSpot.id, 'Top match is the heritage vegetarian dosa spot');
  assert(topMatch.matchScore >= 80, 'Strong match receives high overall score (>= 80)');
  assert(topMatch.isRecommended === true, 'Strong match is marked as recommended for traveler without restrictions');
  assert(topMatch.matchedVibes.includes('heritage'), 'Heritage vibe explicitly matched');
  assert(topMatch.topMatchReasons.length > 0, 'topMatchReasons populated');
  assert(topMatch.breakdown.pacingAlignment === null, 'Pacing alignment is null when route evidence is absent');

  // 2. Solo Traveler WITH vegetarian restriction under verified server authority
  const soloVegResults = await matchSoloPreferences({
    preferences: soloVegTraveler,
    places: [sampleHeritageDosaSpot],
    dietaryEvidenceMap: {
      [sampleHeritageDosaSpot.id]: verifiedPureVegCertification,
    },
    internalSecurityContext: {
      [TRUSTED_SERVER_AUTH_SYMBOL]: true,
    },
  });
  const topVegMatch = soloVegResults[0]!;
  assert(topVegMatch.dietarySafetyVerified === true, 'Dietary safety verified under trusted server verification');
  assert(topVegMatch.dietaryStatus === 'VERIFIED_SAFE', 'Dietary status marked VERIFIED_SAFE for pure veg traveler');
  assert(topVegMatch.dietaryProvenance === 'INDEPENDENT_CERTIFICATION', 'Dietary provenance is INDEPENDENT_CERTIFICATION for certified pure veg');
  assert(topVegMatch.isRecommended === true, 'Recommended when verified by trusted server authority');

  // 3. Anti-Manufacture Guardrail: Caller-supplied claim without trusted server authority
  const unverifiedCallerResults = await matchSoloPreferences({
    preferences: soloVegTraveler,
    places: [sampleHeritageDosaSpot],
    dietaryEvidenceMap: {
      [sampleHeritageDosaSpot.id]: verifiedPureVegCertification,
    },
  });
  assert(unverifiedCallerResults[0]!.dietarySafetyVerified === false, 'Caller-supplied claim cannot manufacture dietarySafetyVerified');
  assert(unverifiedCallerResults[0]!.dietaryStatus === 'UNVERIFIED_DATA', 'Caller-supplied claim retains UNVERIFIED_DATA without trusted server authority');
  assert(unverifiedCallerResults[0]!.isRecommended === false, 'Caller-supplied claim cannot manufacture isRecommended: true');

  // Verify pacing alignment when route evidence is provided
  const soloRouteResults = await matchSoloPreferences({
    preferences: soloGeneralTraveler,
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

  // Verify Separation of Place Identity Verification from Dietary Verification:
  // A venue with place.isVerified: true (Maps identity grounded) and categories: ['pure_veg']
  // but WITHOUT certified kitchen audit yields DIRECTORY_LISTING_ONLY, UNVERIFIED_DATA, and isRecommended: false.
  const categoryOnlyVegSpot: CanonicalPlaceDocument = {
    ...sampleHeritageDosaSpot,
    id: 'spot_category_only_veg',
    infoParagraph: 'General neighborhood eatery with traditional recipes under 150 INR.',
    categories: ['breakfast_restaurant', 'pure_veg'],
    authenticity: {
      ...sampleHeritageDosaSpot.authenticity,
      localSentimentSummary: 'Popular local food spot.',
    },
    contributorAttribution: undefined,
  };
  const categoryOnlyResults = await matchSoloPreferences({
    preferences: soloVegTraveler,
    places: [categoryOnlyVegSpot],
  });
  assert(categoryOnlyResults[0]!.dietaryProvenance === 'DIRECTORY_LISTING_ONLY', 'Provenance is DIRECTORY_LISTING_ONLY when listing lacks certified audit');
  assert(categoryOnlyResults[0]!.dietarySafetyVerified === false, 'Directory category alone does NOT verify dietary safety');
  assert(categoryOnlyResults[0]!.dietaryStatus === 'UNVERIFIED_DATA', 'Status is UNVERIFIED_DATA without grounded dietary certification');
  assert(categoryOnlyResults[0]!.isRecommended === false, 'Venue is NOT recommended when dietary certification is missing');

  // Verify Unverified Place Draft with ungrounded claims (isVerified: false and no certified audit)
  const unverifiedPureVegSpot: CanonicalPlaceDocument = {
    ...sampleHeritageDosaSpot,
    id: 'spot_unverified_veg',
    isVerified: false,
    infoParagraph: 'Unverified local discovery claiming vegetarian food without certification.',
    authenticity: {
      ...sampleHeritageDosaSpot.authenticity,
      localSentimentSummary: 'Unverified neighborhood food stop.',
    },
    contributorAttribution: undefined,
  };
  const unverifiedResults = await matchSoloPreferences({
    preferences: soloVegTraveler,
    places: [unverifiedPureVegSpot],
  });
  assert(unverifiedResults[0]!.dietarySafetyVerified === false, 'Unverified venue record cannot produce VERIFIED_SAFE');
  assert(unverifiedResults[0]!.dietaryStatus === 'UNVERIFIED_DATA', 'Unverified venue record stays UNVERIFIED_DATA');
  assert(unverifiedResults[0]!.isRecommended === false, 'Unverified venue is NOT recommended for dietary traveler');

  // -------------------------------------------------------------------------
  // Mandatory Dietary Evidence Tests (7 Explicit Verification Cases)
  // -------------------------------------------------------------------------
  console.log('\n--- [Mandatory Dietary Evidence: 7 Required Cases] ---');

  // Case 1: Description containing "certified pure veg kitchen" without supporting certification evidence
  // cannot produce INDEPENDENT_CERTIFICATION.
  const case1TextClaimSpot: CanonicalPlaceDocument = {
    ...sampleHeritageDosaSpot,
    id: 'spot_case1_text_only',
    infoParagraph: 'Generational certified pure veg kitchen tawa since 1924.',
  };
  const case1Results = await matchSoloPreferences({
    preferences: soloVegTraveler,
    places: [case1TextClaimSpot],
  });
  assert(
    case1Results[0]!.dietaryProvenance !== 'INDEPENDENT_CERTIFICATION',
    'Mandatory Case 1: Text claim without supporting evidence cannot produce INDEPENDENT_CERTIFICATION'
  );
  assert(
    case1Results[0]!.dietaryStatus === 'UNVERIFIED_DATA',
    'Mandatory Case 1: Text claim without supporting evidence retains UNVERIFIED_DATA'
  );

  // Case 2: A pure_veg directory category cannot produce VERIFIED_SAFE.
  const case2CategorySpot: CanonicalPlaceDocument = {
    ...sampleHeritageDosaSpot,
    id: 'spot_case2_cat_only',
    infoParagraph: 'Traditional local restaurant serving dosas and coffee.',
    categories: ['breakfast_restaurant', 'pure_veg'],
  };
  const case2Results = await matchSoloPreferences({
    preferences: soloVegTraveler,
    places: [case2CategorySpot],
  });
  assert(
    case2Results[0]!.dietaryStatus !== 'VERIFIED_SAFE',
    'Mandatory Case 2: pure_veg directory category cannot produce VERIFIED_SAFE'
  );
  assert(
    case2Results[0]!.dietarySafetyVerified === false,
    'Mandatory Case 2: pure_veg category alone leaves dietarySafetyVerified as false'
  );
  assert(
    case2Results[0]!.isRecommended === false,
    'Mandatory Case 2: pure_veg category alone leaves isRecommended as false'
  );

  // Case 3: A verified resident's dietary statement without a recorded audit cannot produce VERIFIED_COMMUNITY_AUDIT.
  const case3ResidentSpot: CanonicalPlaceDocument = {
    ...sampleHeritageDosaSpot,
    id: 'spot_case3_resident_statement',
    contributorAttribution: {
      userId: 'usr_priya_resident',
      displayName: 'Priya Sharma',
      badgeTitle: 'Local Historian',
      isVerifiedResident: true,
    },
    authenticity: {
      ...sampleHeritageDosaSpot.authenticity,
      localSentimentSummary: 'Verified resident Priya says the kitchen is 100% pure veg and authentic.',
    },
  };
  const case3Results = await matchSoloPreferences({
    preferences: soloVegTraveler,
    places: [case3ResidentSpot],
  });
  assert(
    case3Results[0]!.dietaryProvenance !== 'VERIFIED_COMMUNITY_AUDIT',
    'Mandatory Case 3: Resident statement without recorded audit cannot produce VERIFIED_COMMUNITY_AUDIT'
  );
  assert(
    case3Results[0]!.dietaryStatus === 'UNVERIFIED_DATA',
    'Mandatory Case 3: Resident statement without recorded audit retains UNVERIFIED_DATA'
  );

  // Anti-Manufacture Case: Caller-supplied certification claiming VERIFIED without trusted server authority
  const callerSuppliedClaimResults = await matchSoloPreferences({
    preferences: soloVegTraveler,
    places: [sampleHeritageDosaSpot],
    dietaryEvidenceMap: {
      [sampleHeritageDosaSpot.id]: verifiedPureVegCertification,
    },
    // No trustedServerVerification option
  });
  assert(
    callerSuppliedClaimResults[0]!.dietaryStatus === 'UNVERIFIED_DATA',
    'Anti-Manufacture: Caller-supplied certification without trusted server authority retains UNVERIFIED_DATA'
  );
  assert(
    callerSuppliedClaimResults[0]!.dietarySafetyVerified === false,
    'Anti-Manufacture: Caller-supplied certification cannot manufacture dietarySafetyVerified: true'
  );
  assert(
    callerSuppliedClaimResults[0]!.isRecommended === false,
    'Anti-Manufacture: Caller-supplied certification cannot manufacture isRecommended: true'
  );

  // Security Boundary Bypass Attempt 1: Caller sends options.trustedServerVerification in payload
  const bypassPayload1 = JSON.parse(
    JSON.stringify({
      preferences: soloVegTraveler,
      places: [sampleHeritageDosaSpot],
      dietaryEvidenceMap: {
        [sampleHeritageDosaSpot.id]: verifiedPureVegCertification,
      },
      options: {
        trustedServerVerification: true,
      },
    })
  );
  const bypassResults1 = await matchSoloPreferences(bypassPayload1);
  assert(
    bypassResults1[0]!.dietaryStatus === 'UNVERIFIED_DATA',
    'Security Boundary: External payload options.trustedServerVerification is ignored at runtime'
  );
  assert(
    bypassResults1[0]!.dietarySafetyVerified === false,
    'Security Boundary: External options cannot forge dietarySafetyVerified'
  );
  assert(
    bypassResults1[0]!.isRecommended === false,
    'Security Boundary: External options cannot forge isRecommended: true'
  );

  // Security Boundary Bypass Attempt 2: Caller sends top-level trustedServerVerification in payload
  const bypassPayload2 = JSON.parse(
    JSON.stringify({
      preferences: soloVegTraveler,
      places: [sampleHeritageDosaSpot],
      dietaryEvidenceMap: {
        [sampleHeritageDosaSpot.id]: verifiedPureVegCertification,
      },
      trustedServerVerification: true,
    })
  );
  const bypassResults2 = await matchSoloPreferences(bypassPayload2);
  assert(
    bypassResults2[0]!.dietaryStatus === 'UNVERIFIED_DATA',
    'Security Boundary: External top-level trustedServerVerification is ignored'
  );
  assert(
    bypassResults2[0]!.isRecommended === false,
    'Security Boundary: Top-level forged field cannot recommend venue'
  );

  // Security Boundary Bypass Attempt 3: Caller sends JSON internalSecurityContext with string key
  const bypassPayload3 = JSON.parse(
    JSON.stringify({
      preferences: soloVegTraveler,
      places: [sampleHeritageDosaSpot],
      dietaryEvidenceMap: {
        [sampleHeritageDosaSpot.id]: verifiedPureVegCertification,
      },
      internalSecurityContext: {
        trustedServerVerification: true,
      },
    })
  );
  const bypassResults3 = await matchSoloPreferences(bypassPayload3);
  assert(
    bypassResults3[0]!.dietaryStatus === 'UNVERIFIED_DATA',
    'Security Boundary: JSON string key internalSecurityContext cannot forge Symbol key'
  );
  assert(
    bypassResults3[0]!.isRecommended === false,
    'Security Boundary: String-keyed JSON context cannot recommend venue'
  );

  // Security Boundary Bypass Attempt 4: Group matching external caller bypass attempt
  const bypassGroupPayload = JSON.parse(
    JSON.stringify({
      neighborhood: 'Malleshwaram',
      members: [
        {
          userId: 'usr_veg_bypass',
          displayName: 'Bypass Tester',
          vibes: ['heritage'],
          dietaryRestrictions: ['pure_veg'],
          maxBudgetAmount: 250,
          weighting: 1.0,
        },
      ],
      places: [sampleHeritageDosaSpot],
      dietaryEvidenceMap: {
        [sampleHeritageDosaSpot.id]: verifiedPureVegCertification,
      },
      options: {
        trustedServerVerification: true,
      },
    })
  );
  const bypassGroupResults = await matchGroupPreferences(bypassGroupPayload);
  assert(
    bypassGroupResults[0]!.dietaryStatus === 'UNVERIFIED_DATA',
    'Security Boundary: Group external options.trustedServerVerification is ignored'
  );
  assert(
    bypassGroupResults[0]!.isRecommended === false,
    'Security Boundary: Group external options cannot recommend venue'
  );

  // Anti-Manufacture Case: FSSAI general food business license rejected as dietary certification
  const caseFssaiResults = await matchSoloPreferences({
    preferences: soloVegTraveler,
    places: [sampleHeritageDosaSpot],
    dietaryEvidenceMap: {
      [sampleHeritageDosaSpot.id]: fssaiLicenseEvidence,
    },
    internalSecurityContext: {
      [TRUSTED_SERVER_AUTH_SYMBOL]: true,
    },
  });
  assert(
    caseFssaiResults[0]!.dietaryStatus === 'UNVERIFIED_DATA',
    'Anti-Manufacture: FSSAI food business licence is rejected as dietary certification and retains UNVERIFIED_DATA'
  );
  assert(
    caseFssaiResults[0]!.dietarySafetyVerified === false,
    'Anti-Manufacture: FSSAI food license cannot produce dietarySafetyVerified: true'
  );
  assert(
    caseFssaiResults[0]!.isRecommended === false,
    'Anti-Manufacture: FSSAI food license cannot recommend venue for dietary traveler'
  );

  // Anti-Manufacture Case: Expired and revoked certification records retain UNVERIFIED_DATA
  const caseExpiredResults = await matchSoloPreferences({
    preferences: soloVegTraveler,
    places: [sampleHeritageDosaSpot],
    dietaryEvidenceMap: {
      [sampleHeritageDosaSpot.id]: expiredCertEvidence,
    },
    internalSecurityContext: {
      [TRUSTED_SERVER_AUTH_SYMBOL]: true,
    },
  });
  assert(
    caseExpiredResults[0]!.dietaryStatus === 'UNVERIFIED_DATA',
    'Anti-Manufacture: Expired certification retains UNVERIFIED_DATA'
  );
  assert(
    caseExpiredResults[0]!.isRecommended === false,
    'Anti-Manufacture: Expired certification leaves isRecommended as false'
  );

  const caseRevokedResults = await matchSoloPreferences({
    preferences: soloVegTraveler,
    places: [sampleHeritageDosaSpot],
    dietaryEvidenceMap: {
      [sampleHeritageDosaSpot.id]: revokedCertEvidence,
    },
    internalSecurityContext: {
      [TRUSTED_SERVER_AUTH_SYMBOL]: true,
    },
  });
  assert(
    caseRevokedResults[0]!.dietaryStatus === 'UNVERIFIED_DATA',
    'Anti-Manufacture: Revoked certification retains UNVERIFIED_DATA'
  );
  assert(
    caseRevokedResults[0]!.isRecommended === false,
    'Anti-Manufacture: Revoked certification leaves isRecommended as false'
  );

  // Anti-Manufacture Case: Caller-supplied community audit without server moderation approval
  const unmoderatedAuditResults = await matchSoloPreferences({
    preferences: soloVegTraveler,
    places: [sampleHeritageDosaSpot],
    dietaryEvidenceMap: {
      [sampleHeritageDosaSpot.id]: verifiedCommunityAuditVeg,
    },
    // No trustedServerVerification option
  });
  assert(
    unmoderatedAuditResults[0]!.dietaryStatus === 'UNVERIFIED_DATA',
    'Anti-Manufacture: Caller-supplied community audit without server moderation retains UNVERIFIED_DATA'
  );
  assert(
    unmoderatedAuditResults[0]!.dietarySafetyVerified === false,
    'Anti-Manufacture: Unmoderated community audit leaves dietarySafetyVerified as false'
  );
  assert(
    unmoderatedAuditResults[0]!.isRecommended === false,
    'Anti-Manufacture: Unmoderated community audit leaves isRecommended as false'
  );

  // Case 4: Valid certification under trusted server authority produces INDEPENDENT_CERTIFICATION & VERIFIED_SAFE within scope
  const case4Results = await matchSoloPreferences({
    preferences: soloVegTraveler,
    places: [sampleHeritageDosaSpot],
    dietaryEvidenceMap: {
      [sampleHeritageDosaSpot.id]: verifiedPureVegCertification,
    },
    internalSecurityContext: {
      [TRUSTED_SERVER_AUTH_SYMBOL]: true,
    },
  });
  assert(
    case4Results[0]!.dietaryProvenance === 'INDEPENDENT_CERTIFICATION',
    'Mandatory Case 4: Recorded certification under trusted server authority produces INDEPENDENT_CERTIFICATION'
  );
  assert(
    case4Results[0]!.dietaryStatus === 'VERIFIED_SAFE',
    'Mandatory Case 4: Recorded certification produces VERIFIED_SAFE for covered restriction'
  );
  assert(
    case4Results[0]!.isRecommended === true,
    'Mandatory Case 4: Venue recommended when verified certification exists'
  );

  // Case 5: Valid community audit under trusted server moderation produces VERIFIED_COMMUNITY_AUDIT & VERIFIED_SAFE within scope
  const case5Results = await matchSoloPreferences({
    preferences: soloVegTraveler,
    places: [sampleHeritageDosaSpot],
    dietaryEvidenceMap: {
      [sampleHeritageDosaSpot.id]: verifiedCommunityAuditVeg,
    },
    internalSecurityContext: {
      [TRUSTED_SERVER_AUTH_SYMBOL]: true,
    },
  });
  assert(
    case5Results[0]!.dietaryProvenance === 'VERIFIED_COMMUNITY_AUDIT',
    'Mandatory Case 5: Recorded community audit under server moderation produces VERIFIED_COMMUNITY_AUDIT'
  );
  assert(
    case5Results[0]!.dietaryStatus === 'VERIFIED_SAFE',
    'Mandatory Case 5: Recorded community audit produces VERIFIED_SAFE within scope'
  );
  assert(
    case5Results[0]!.isRecommended === true,
    'Mandatory Case 5: Venue recommended when covered by verified community audit'
  );

  // Case 6: Evidence that does not cover vegan, Jain, or specific allergy cannot certify suitability for those requirements.
  const case6Vegan = await matchSoloPreferences({
    preferences: soloVeganTraveler,
    places: [sampleHeritageDosaSpot],
    dietaryEvidenceMap: {
      [sampleHeritageDosaSpot.id]: verifiedPureVegCertification, // scope is pure_veg only, not vegan!
    },
    internalSecurityContext: {
      [TRUSTED_SERVER_AUTH_SYMBOL]: true,
    },
  });
  assert(
    case6Vegan[0]!.dietaryStatus === 'UNVERIFIED_DATA',
    'Mandatory Case 6: Pure veg certification does NOT certify vegan suitability'
  );
  assert(
    case6Vegan[0]!.dietarySafetyVerified === false,
    'Mandatory Case 6: Vegan safety remains false under pure veg certification'
  );
  assert(
    case6Vegan[0]!.isRecommended === false,
    'Mandatory Case 6: Pure veg certification does NOT recommend venue for vegan'
  );

  const case6Jain = await matchSoloPreferences({
    preferences: soloJainTraveler,
    places: [sampleHeritageDosaSpot],
    dietaryEvidenceMap: {
      [sampleHeritageDosaSpot.id]: verifiedPureVegCertification, // scope is pure_veg only, not jain!
    },
    internalSecurityContext: {
      [TRUSTED_SERVER_AUTH_SYMBOL]: true,
    },
  });
  assert(
    case6Jain[0]!.dietaryStatus === 'UNVERIFIED_DATA',
    'Mandatory Case 6: Pure veg certification does NOT certify Jain suitability'
  );
  assert(
    case6Jain[0]!.isRecommended === false,
    'Mandatory Case 6: Pure veg certification does NOT recommend venue for Jain'
  );

  // Case 7: Insufficient or conflicting evidence retains UNVERIFIED_DATA or CONFLICT_DETECTED.
  const case7Conflict = await matchSoloPreferences({
    preferences: soloVegTraveler,
    places: [sampleMeatBarbecueSpot],
  });
  assert(
    case7Conflict[0]!.dietaryStatus === 'CONFLICT_DETECTED',
    'Mandatory Case 7: Conflicting food retains CONFLICT_DETECTED'
  );
  assert(
    case7Conflict[0]!.dietarySafetyVerified === false,
    'Mandatory Case 7: Conflicting food leaves dietarySafetyVerified as false'
  );
  assert(
    case7Conflict[0]!.isRecommended === false,
    'Mandatory Case 7: Conflicting food leaves isRecommended as false'
  );

  // -------------------------------------------------------------------------
  // Scenario 5: Weak Individual Preference Match & Dietary Constraint Penalty
  // -------------------------------------------------------------------------
  console.log('\n--- [Scenario 5] Weak Match & Dietary Constraint Penalty ---');
  const weakMatchResults = await matchSoloPreferences({
    preferences: soloVegTraveler,
    places: [sampleHeritageDosaSpot, sampleMeatBarbecueSpot],
  });
  const weakMatch = weakMatchResults.find((r) => r.placeId === sampleMeatBarbecueSpot.id)!;
  assert(weakMatch.matchScore < 50, 'Meat barbecue spot receives penalized score (< 50) for pure veg traveler');
  assert(weakMatch.isRecommended === false, 'Meat spot is not recommended for pure veg traveler');
  assert(Boolean(weakMatch.compromiseAlerts.length > 0 || weakMatch.dietaryAlert), 'Dietary alert is emitted for non-compliant spot');

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

  // 1. Group matching under trusted server verification
  const vegGroupResults = await matchGroupPreferences({
    neighborhood: 'Malleshwaram',
    members: vegOnlyMembers,
    places: [sampleHeritageDosaSpot],
    dietaryEvidenceMap: {
      [sampleHeritageDosaSpot.id]: verifiedPureVegCertification,
    },
    internalSecurityContext: {
      [TRUSTED_SERVER_AUTH_SYMBOL]: true,
    },
  });
  assert(
    vegGroupResults[0]!.dietarySafetyVerified === true,
    'Dietary safety verified when venue explicitly certifies pure vegetarian under trusted authority'
  );
  assert(
    vegGroupResults[0]!.dietaryStatus === 'VERIFIED_SAFE',
    'Dietary status marked as VERIFIED_SAFE when venue explicitly certifies pure vegetarian'
  );
  assert(
    vegGroupResults[0]!.isRecommended === true,
    'Group recommendation is true when preferences match AND dietary safety is verified'
  );

  // 2. Anti-Manufacture Guardrail: Caller-supplied group dietary evidence without trusted server authority
  const unverifiedGroupResults = await matchGroupPreferences({
    neighborhood: 'Malleshwaram',
    members: vegOnlyMembers,
    places: [sampleHeritageDosaSpot],
    dietaryEvidenceMap: {
      [sampleHeritageDosaSpot.id]: verifiedPureVegCertification,
    },
  });
  assert(
    unverifiedGroupResults[0]!.dietarySafetyVerified === false,
    'Anti-Manufacture: Caller-supplied group dietary claim cannot produce dietarySafetyVerified: true'
  );
  assert(
    unverifiedGroupResults[0]!.dietaryStatus === 'UNVERIFIED_DATA',
    'Anti-Manufacture: Caller-supplied group dietary claim retains UNVERIFIED_DATA'
  );
  assert(
    unverifiedGroupResults[0]!.isRecommended === false,
    'Anti-Manufacture: Caller-supplied group dietary claim leaves isRecommended as false'
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
    dietaryEvidenceMap: {
      [sampleHeritageDosaSpot.id]: verifiedPureVegCertification,
    },
    internalSecurityContext: {
      [TRUSTED_SERVER_AUTH_SYMBOL]: true,
    },
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
  const validatedSoloResult = SoloPlaceMatchResultSchema.parse(topMatch);
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
  const soloJson = JSON.parse(JSON.stringify(topMatch));
  assert(typeof soloJson.matchScore === 'number', 'D3 Contract: matchScore is numeric');
  assert(typeof soloJson.isRecommended === 'boolean', 'D3 Contract: isRecommended is boolean');
  assert(typeof soloJson.dietarySafetyVerified === 'boolean', 'D3 Contract: dietarySafetyVerified is boolean');
  assert(
    ['VERIFIED_SAFE', 'CONFLICT_DETECTED', 'UNVERIFIED_DATA'].includes(soloJson.dietaryStatus),
    'D3 Contract: dietaryStatus is valid enum'
  );
  assert(
    ['INDEPENDENT_CERTIFICATION', 'VERIFIED_COMMUNITY_AUDIT', 'DIRECTORY_LISTING_ONLY', 'UNSTATED'].includes(soloJson.dietaryProvenance),
    'D3 Contract: dietaryProvenance is valid enum'
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
  assert(
    ['INDEPENDENT_CERTIFICATION', 'VERIFIED_COMMUNITY_AUDIT', 'DIRECTORY_LISTING_ONLY', 'UNSTATED'].includes(groupJson.dietaryProvenance),
    'D3 Group Contract: dietaryProvenance is valid enum'
  );
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
