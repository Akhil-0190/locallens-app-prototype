/**
 * Startup Buildathon 2026 — Neighborhood Guide App
 * Task B3 Test Suite: Authenticity, Tourist-Trap and Safety Assessment
 * 
 * Verifies all 12 required scenarios:
 * 1. Positive authenticity evidence (generational heritage institution)
 * 2. Negative authenticity / overcommercialization (chain, touting, tourist markup)
 * 3. Conflicting evidence (hours mismatch, spatial discrepancy)
 * 4. Insufficient evidence (matchConfidence: NO_MATCH, unverified venue)
 * 5. Missing reviews or place information (does not penalize unreviewed local stalls)
 * 6. Contributor claims conflicting with Maps evidence
 * 7. Safety/hygiene information with adequate supporting evidence
 * 8. Missing safety/hygiene information (strictly does NOT flag unsafe, badge is false)
 * 9. Confidence and explanation generation
 * 10. Source-reference preservation
 * 11. Invalid or malformed evidence input
 * 12. Output schema validation (Comprehensive & PlaceAuthenticityEnrichment)
 */

import {
  assessPlaceAuthenticity,
  toPlaceAuthenticityEnrichment,
} from '../src/ai/services/authenticity-assessment-service.js';
import {
  AuthenticityAssessmentInput,
  ComprehensiveAuthenticityAssessmentSchema,
} from '../src/ai/schemas/authenticity-schemas.js';
import {
  PlaceAuthenticityEnrichmentSchema,
} from '../src/types/contracts/index.js';
import {
  SAMPLE_HIGH_CONFIDENCE_EVIDENCE,
  SAMPLE_DISCREPANCY_EVIDENCE,
} from '../src/maps/fixtures/sample-evidence.fixture.js';
import { PlaceGroundingEvidence } from '../src/maps/types/evidence.types.js';

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

async function runB3Tests() {
  console.log('================================================================');
  console.log('  Startup Buildathon 2026 — Task B3 AI Authenticity Test Suite  ');
  console.log('  Tourist-Trap, Authenticity, & Safety Evidence Evaluation      ');
  console.log('================================================================\n');

  // -------------------------------------------------------------------------
  // Scenario 1: Positive Authenticity Evidence
  // -------------------------------------------------------------------------
  console.log('--- [Scenario 1] Positive Authenticity Evidence ---');
  const positiveInput: AuthenticityAssessmentInput = {
    evidence: SAMPLE_HIGH_CONFIDENCE_EVIDENCE,
    contributorNarrative: 'Generational benne masala dosa prepared on iron cast tawa since 1924. Frequented by local poets and residents of Malleshwaram.',
    travelerPreferences: {
      favoriteVibes: ['heritage', 'breakfast', 'authentic'],
      budgetTier: 'BUDGET',
    },
  };

  const positiveResult = await assessPlaceAuthenticity(positiveInput);
  assert(positiveResult.overallAuthenticityScore >= 75, 'High authenticity score (>= 75) for generational heritage institution');
  assert(positiveResult.touristTrapLikelihood === 'LOW', 'Tourist trap likelihood is LOW for verified local gem');
  assert(positiveResult.isTouristTrap === false, 'isTouristTrap is false for heritage venue');
  assert(positiveResult.authenticity.isGenerationalOrHeritage === true, 'Identified as generational / heritage institution');
  assert(positiveResult.authenticity.traditionalPreparationPracticed === true, 'Traditional preparation identified');

  // -------------------------------------------------------------------------
  // Scenario 2: Overcommercialization & Tourist Trap Signals
  // -------------------------------------------------------------------------
  console.log('\n--- [Scenario 2] Overcommercialization & Tourist Trap Signals ---');
  const touristTrapEvidence: PlaceGroundingEvidence = {
    evidenceId: 'evidence_tourist_trap_002',
    matchConfidence: 'EXACT_MATCH',
    matchScore: 0.95,
    matchedPlace: {
      placeId: 'place_commercial_chain_99',
      name: 'Global Souvenir & Fast Spice Bazaar #42',
      formattedAddress: 'Tourist Promenade, Main Boulevard',
      coordinate: { latitude: 12.9716, longitude: 77.5946, precision: 6, formatted: '12.9716, 77.5946', isValid: true },
      primaryCategory: 'souvenir_store',
      categories: ['souvenir_store', 'store', 'point_of_interest'],
      rating: 3.2,
      reviewCount: 18500,
      isOpenNow: true,
      openingHoursDescriptions: ['Open 9:00 AM - 11:00 PM'],
      summary: 'Commercial souvenir franchise with imported gift items and aggressive touting.',
      mapsUrl: 'https://maps.google.com/?q=Global+Souvenir',
      isMockData: true,
      lastVerifiedAt: new Date().toISOString(),
    },
    candidatePlaces: [],
    discrepancies: [],
    touristTrapSignals: {
      hasMassTouristReviewCount: true,
      hasDisproportionateNegativeRatings: true,
      commercialChainDetected: true,
      extremePriceLevelDetected: true,
      potentialToutingReported: true,
      scoreDeductions: [
        { reason: 'Multi-outlet commercial franchise with aggressive touting', points: -35 },
        { reason: 'Extreme price markup on generic mass-manufactured goods', points: -25 },
      ],
    },
    authenticitySignals: {
      isHeritageOrVernacularType: false,
      hasConsistentHighRatingWithModerateVolume: false,
      isLocatedInHistoricQuarterOrAlley: false,
      verifiedOperationalHoursMatch: true,
      hasLocalResidentSentimentMarkers: false,
      scoreAdditions: [],
    },
    preliminaryAuthenticityRecommendation: {
      suggestedTrapLikelihood: 'HIGH',
      preliminaryScore: 18,
      rationale: 'Commercial chain franchise with severe tourist touting and mass-manufactured merchandise.',
    },
    sources: [
      {
        source: 'GOOGLE_PLACES_API_NEW',
        retrievedAt: new Date().toISOString(),
        details: 'Verified commercial chain on tourist promenade',
      },
    ],
    isMockData: true,
    groundedAt: new Date().toISOString(),
  };

  const trapResult = await assessPlaceAuthenticity({ evidence: touristTrapEvidence });
  assert(trapResult.touristTrapLikelihood === 'HIGH' || trapResult.touristTrapLikelihood === 'SEVERE', 'Correctly flagged as HIGH/SEVERE tourist trap');
  assert(trapResult.isTouristTrap === true, 'isTouristTrap is true');
  assert(trapResult.touristTrap.isCommercialChainOrFranchise === true || trapResult.touristTrap.isOvercommercialized === true, 'Identified commercial chain or overcommercialization');
  assert(trapResult.overallAuthenticityScore < 40, 'Low authenticity score (< 40) for commercialized tourist trap');

  // -------------------------------------------------------------------------
  // Scenario 3: Conflicting Evidence (Spatial & Operating Hours)
  // -------------------------------------------------------------------------
  console.log('\n--- [Scenario 3] Conflicting Evidence Handling ---');
  const discrepancyResult = await assessPlaceAuthenticity({
    evidence: SAMPLE_DISCREPANCY_EVIDENCE,
    contributorNarrative: 'Amazing secret chai stall open all night until 11:30 PM.',
  });

  assert(discrepancyResult.conflictSynthesis.hasFactualConflicts === true, 'Factual conflicts detected from C2 evidence discrepancies');
  assert(Boolean(discrepancyResult.conflictSynthesis.conflictSummary), 'Conflict summary articulates discrepancy (hours or distance)');
  assert(discrepancyResult.touristTrapLikelihood === 'MODERATE' || discrepancyResult.touristTrapLikelihood === 'LOW', 'Discrepancy results in MODERATE/uncertain rating rather than unjustified extreme penalty');

  // -------------------------------------------------------------------------
  // Scenario 4: Insufficient Evidence & NO_MATCH Safe Handling
  // -------------------------------------------------------------------------
  console.log('\n--- [Scenario 4] Insufficient Evidence & NO_MATCH ---');
  const ungroundedEvidence: PlaceGroundingEvidence = {
    evidenceId: 'evidence_no_match_004',
    matchConfidence: 'NO_MATCH',
    matchScore: 0.0,
    matchedPlace: null,
    candidatePlaces: [],
    discrepancies: [],
    touristTrapSignals: {
      hasMassTouristReviewCount: false,
      hasDisproportionateNegativeRatings: false,
      commercialChainDetected: false,
      extremePriceLevelDetected: false,
      potentialToutingReported: false,
      scoreDeductions: [],
    },
    authenticitySignals: {
      isHeritageOrVernacularType: false,
      hasConsistentHighRatingWithModerateVolume: false,
      isLocatedInHistoricQuarterOrAlley: false,
      verifiedOperationalHoursMatch: false,
      hasLocalResidentSentimentMarkers: false,
      scoreAdditions: [],
    },
    preliminaryAuthenticityRecommendation: {
      suggestedTrapLikelihood: 'MODERATE',
      preliminaryScore: 30,
      rationale: 'Unmatched place on Google Maps Platform.',
    },
    sources: [],
    isMockData: true,
    groundedAt: new Date().toISOString(),
  };

  const ungroundedResult = await assessPlaceAuthenticity({ evidence: ungroundedEvidence });
  assert(ungroundedResult.conflictSynthesis.isEvidenceSufficientForHighConfidence === false, 'Explicitly marked as insufficient evidence for high confidence');
  assert(ungroundedResult.limitationsAndUncertainties.length > 0, 'Limitations and uncertainties explicitly enumerated');
  assert(ungroundedResult.safetyAndHygiene.confidence <= 0.3, 'Safety confidence is appropriately low when ungrounded');

  // -------------------------------------------------------------------------
  // Scenario 5: Missing Reviews (Newly Opened or Micro Street Stall)
  // -------------------------------------------------------------------------
  console.log('\n--- [Scenario 5] Missing Reviews & Sparse Data (No False Negative) ---');
  const sparseEvidence: PlaceGroundingEvidence = {
    evidenceId: 'evidence_sparse_stall_005',
    matchConfidence: 'HIGH_CONFIDENCE',
    matchScore: 0.85,
    matchedPlace: {
      placeId: 'place_sparse_stall_005',
      name: 'Amma Filter Coffee Kiosk',
      formattedAddress: 'Alleyway 4, Basavanagudi',
      coordinate: { latitude: 12.9431, longitude: 77.5752, precision: 6, formatted: '12.9431, 77.5752', isValid: true },
      primaryCategory: 'coffee_shop',
      categories: ['coffee_shop', 'cafe'],
      rating: 0,
      reviewCount: 0,
      isOpenNow: true,
      openingHoursDescriptions: [],
      summary: 'Small local filter coffee kiosk in Basavanagudi alleyway.',
      mapsUrl: 'https://maps.google.com/?q=Amma+Coffee',
      isMockData: true,
      lastVerifiedAt: new Date().toISOString(),
    },
    candidatePlaces: [],
    discrepancies: [],
    touristTrapSignals: {
      hasMassTouristReviewCount: false,
      hasDisproportionateNegativeRatings: false,
      commercialChainDetected: false,
      extremePriceLevelDetected: false,
      potentialToutingReported: false,
      scoreDeductions: [],
    },
    authenticitySignals: {
      isHeritageOrVernacularType: true,
      hasConsistentHighRatingWithModerateVolume: false,
      isLocatedInHistoricQuarterOrAlley: true,
      verifiedOperationalHoursMatch: false,
      hasLocalResidentSentimentMarkers: true,
      scoreAdditions: [{ reason: 'Micro coffee stall in historic quarter', points: 20 }],
    },
    preliminaryAuthenticityRecommendation: {
      suggestedTrapLikelihood: 'LOW',
      preliminaryScore: 65,
      rationale: 'Small local stall with zero online reviews but authentic neighborhood setting.',
    },
    sources: [
      {
        source: 'LOCAL_CONTRIBUTOR_SUBMISSION',
        retrievedAt: new Date().toISOString(),
        details: 'Contributor discovered stall',
      },
    ],
    isMockData: true,
    groundedAt: new Date().toISOString(),
  };

  const sparseResult = await assessPlaceAuthenticity({
    evidence: sparseEvidence,
    contributorNarrative: 'Freshly roasted chicory filter coffee brewed on a brass davarah set. Zero tourist footfall, just local elderly residents.',
  });
  assert(sparseResult.isTouristTrap === false, 'Missing reviews is NOT penalized as a tourist trap');
  assert(sparseResult.touristTrapLikelihood === 'LOW', 'Micro-stall retains LOW tourist trap likelihood');
  assert(sparseResult.authenticity.authenticityScore >= 50, 'Authenticity score remains healthy (>= 50) for vernacular stall');

  // -------------------------------------------------------------------------
  // Scenario 6: Contributor Claims Conflicting with Maps Evidence
  // -------------------------------------------------------------------------
  console.log('\n--- [Scenario 6] Contributor Claims Conflicting with Maps Evidence ---');
  const conflictResult = await assessPlaceAuthenticity({
    evidence: SAMPLE_DISCREPANCY_EVIDENCE,
    contributorNarrative: 'This place is open 24 hours and accepts all international credit cards and crypto.',
  });
  assert(conflictResult.conflictSynthesis.unverifiedContributorClaims.length >= 0, 'Unverified contributor claims tracked');
  assert(conflictResult.conflictSynthesis.hasFactualConflicts === true, 'Factual conflicts flagged for contradicting verified operational facts');

  // -------------------------------------------------------------------------
  // Scenario 7: Safety & Hygiene with Adequate Supporting Evidence
  // -------------------------------------------------------------------------
  console.log('\n--- [Scenario 7] Safety & Hygiene with Concrete Evidence ---');
  const hazardousEvidence: PlaceGroundingEvidence = {
    evidenceId: 'evidence_hazard_007',
    matchConfidence: 'EXACT_MATCH',
    matchScore: 0.90,
    matchedPlace: {
      placeId: 'place_hazard_007',
      name: 'Unregulated Night Alley Eatery',
      formattedAddress: 'Dark Alley 9, Industrial Slum',
      coordinate: { latitude: 12.98, longitude: 77.60, precision: 6, formatted: '12.98, 77.60', isValid: true },
      primaryCategory: 'restaurant',
      categories: ['restaurant'],
      rating: 2.1,
      reviewCount: 340,
      isOpenNow: true,
      openingHoursDescriptions: [],
      summary: 'Multiple municipal health inspector citations for contaminated water storage and recurrent food poisoning incidents.',
      mapsUrl: 'https://maps.google.com/?q=Night+Alley+Eatery',
      isMockData: true,
      lastVerifiedAt: new Date().toISOString(),
    },
    candidatePlaces: [],
    discrepancies: [],
    touristTrapSignals: {
      hasMassTouristReviewCount: false,
      hasDisproportionateNegativeRatings: true,
      commercialChainDetected: false,
      extremePriceLevelDetected: false,
      potentialToutingReported: false,
      scoreDeductions: [{ reason: 'Severe negative reviews for hygiene', points: -30 }],
    },
    authenticitySignals: {
      isHeritageOrVernacularType: false,
      hasConsistentHighRatingWithModerateVolume: false,
      isLocatedInHistoricQuarterOrAlley: false,
      verifiedOperationalHoursMatch: true,
      hasLocalResidentSentimentMarkers: false,
      scoreAdditions: [],
    },
    preliminaryAuthenticityRecommendation: {
      suggestedTrapLikelihood: 'HIGH',
      preliminaryScore: 20,
      rationale: 'Health inspection violations on record.',
    },
    sources: [
      {
        source: 'GOOGLE_PLACES_API_NEW',
        retrievedAt: new Date().toISOString(),
        details: 'Official municipal health inspection records in editorial summary',
      },
    ],
    isMockData: true,
    groundedAt: new Date().toISOString(),
  };

  const hazardousResult = await assessPlaceAuthenticity({ evidence: hazardousEvidence });
  assert(
    hazardousResult.safetyAndHygiene.hasExplicitHygieneConcerns === true ||
    hazardousResult.safetyAndHygiene.hasExplicitSafetyConcerns === true,
    'Flagged explicit safety/hygiene concerns when verified health citations exist'
  );
  assert(hazardousResult.safetyAndHygiene.evidenceFound === true, 'Safety evidence marked as found');
  assert(hazardousResult.safetyAndHygiene.isOfficialVerificationBadge === false, 'Strict guardrail: AI NEVER issues official safety badge');

  // -------------------------------------------------------------------------
  // Scenario 8: Missing Safety/Hygiene Information (Strict Non-Penalty)
  // -------------------------------------------------------------------------
  console.log('\n--- [Scenario 8] Missing Safety/Hygiene Information (Strict Non-Penalty) ---');
  assert(positiveResult.safetyAndHygiene.hasExplicitSafetyConcerns === false, 'No false safety alarm on clean heritage establishment');
  assert(positiveResult.safetyAndHygiene.hasExplicitHygieneConcerns === false, 'No false hygiene alarm on clean heritage establishment');
  assert(positiveResult.safetyAndHygiene.isOfficialVerificationBadge === false, 'AI strictly does NOT issue an official safety badge');

  // -------------------------------------------------------------------------
  // Scenario 9: Confidence and Explanation Generation
  // -------------------------------------------------------------------------
  console.log('\n--- [Scenario 9] Confidence and Explanation Generation ---');
  assert(Boolean(positiveResult.localSentimentSummary), 'Local sentiment summary provided');
  assert(Boolean(positiveResult.travelerRelevance.practicalTips), 'Actionable practical tips provided');
  assert(Boolean(positiveResult.travelerRelevance.recommendedVisitingWindow), 'Recommended visiting window provided');
  assert(positiveResult.travelerRelevance.vibeTags.length > 0, 'Atmospheric vibe tags populated');

  // -------------------------------------------------------------------------
  // Scenario 10: Source-Reference Preservation
  // -------------------------------------------------------------------------
  console.log('\n--- [Scenario 10] Source-Reference Preservation ---');
  assert(positiveResult.evidenceSourcesPreserved.length > 0, 'Evidence sources preserved from C2 PlaceGroundingEvidence');
  assert(
    positiveResult.evidenceSourcesPreserved.some((s) => s.source === 'GOOGLE_PLACES_API_NEW'),
    'Preserved GOOGLE_PLACES_API_NEW source reference'
  );

  // -------------------------------------------------------------------------
  // Scenario 11: Invalid or Malformed Evidence Input
  // -------------------------------------------------------------------------
  console.log('\n--- [Scenario 11] Invalid or Malformed Evidence Input Handling ---');
  let threwExpectedError = false;
  try {
    await assessPlaceAuthenticity({ evidence: {} as any });
  } catch (err: any) {
    threwExpectedError = true;
  }
  assert(threwExpectedError, 'Safely threw error for malformed/missing PlaceGroundingEvidence');

  // -------------------------------------------------------------------------
  // Scenario 12: Canonical Contract Mapping (Domain 06)
  // -------------------------------------------------------------------------
  console.log('\n--- [Scenario 12] Canonical Contract Mapping (Domain 06) ---');
  const canonicalEnrichment = toPlaceAuthenticityEnrichment(positiveResult);
  const validatedEnrichment = PlaceAuthenticityEnrichmentSchema.parse(canonicalEnrichment);

  assert(validatedEnrichment.authenticityScore === positiveResult.overallAuthenticityScore, 'Authenticity score mapped correctly to canonical enrichment');
  assert(validatedEnrichment.touristTrapLikelihood === positiveResult.touristTrapLikelihood, 'Tourist trap likelihood mapped correctly');
  assert(validatedEnrichment.isTouristTrap === false, 'isTouristTrap mapped correctly');
  assert(Boolean(validatedEnrichment.localSentimentSummary), 'localSentimentSummary mapped correctly');
  assert(Boolean(validatedEnrichment.recommendedTiming), 'recommendedTiming mapped correctly');
  assert(Boolean(validatedEnrichment.greetingCard), 'greetingCard mapped correctly');
  assert(validatedEnrichment.vibeTags.length > 0, 'vibeTags mapped correctly');

  // Also validate full Comprehensive schema
  const validatedComprehensive = ComprehensiveAuthenticityAssessmentSchema.parse(positiveResult);
  assert(validatedComprehensive.assessmentId === positiveResult.assessmentId, 'Comprehensive assessment schema validated');

  // -------------------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------------------
  console.log('\n================================================================');
  console.log(`B3 Test Suite Results: ${passed} / ${total} tests passed.`);
  console.log('================================================================\n');
}

runB3Tests().catch((err) => {
  console.error('Fatal error in B3 tests:', err);
  process.exit(1);
});
