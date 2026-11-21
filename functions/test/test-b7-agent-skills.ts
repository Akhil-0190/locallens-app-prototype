/**
 * Startup Buildathon 2026 — Neighborhood Guide App
 * Task B7 Test Suite: Agent Skills & Continue in Gemini Handoff
 * Developer B — AI & Multimodal Lead
 * 
 * Comprehensive, deterministic verification for:
 * 1. Skill 1 — Voice-Note Extraction (multimodal regional transcription, entity extraction, fact classification)
 * 2. Skill 2 — Maps-Grounded Trap Filtering (authenticity scoring, commercial trap risk, spatial evidence synthesis)
 * 3. Skill 3 — Group Blending (strict dietary safety unions, budget/pace harmonization, multi-party compatibility)
 * 4. Skill 4 — Plan-B Rerouting (weather/closure/crowd disruptions, route recalculation, arrival updates, explanation)
 * 5. Continue in Gemini Handoff (two-phase consent, cryptographic tokens, anti-replay, credential omission, manual fallback)
 * 6. Callable Cloud Functions Governance (auth gating, rate limiting, and input schema validation)
 */

import { executeVoiceNoteExtractionSkill } from '../src/ai/skills/skill-voice-extraction.js';
import { executeTrapFilteringSkill } from '../src/ai/skills/skill-trap-filtering.js';
import { executeGroupBlendingSkill } from '../src/ai/skills/skill-group-blending.js';
import { executePlanBReroutingSkill } from '../src/ai/skills/skill-plan-b-rerouting.js';
import { executeGeminiHandoff } from '../src/ai/skills/gemini-handoff.js';
import { MemoryHandoffChallengeStore } from '../src/ai/services/live-assistance-service.js';
import {
  executeVoiceNoteExtraction,
  executeTrapFiltering,
  executeGroupBlending,
  executePlanBRerouting,
  executeGeminiHandoffCallable,
} from '../src/ai/controllers/skills-controller.js';
import { CanonicalRouteDocument } from '../src/types/contracts/index.js';

let passedAssertions = 0;
let failedAssertions = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    passedAssertions++;
    console.log(`  ✅ PASSED: ${testName}`);
  } else {
    failedAssertions++;
    console.error(`  ❌ FAILED: ${testName}`);
    if (detail) console.error(`     Detail: ${detail}`);
  }
}

async function runB7TestSuite() {
  console.log('================================================================');
  console.log('  Startup Buildathon 2026 — Task B7 Agent Skills & Handoff Tests');
  console.log('================================================================');

  // ==========================================================================
  // Suite 1: Skill 1 — Voice-Note Extraction
  // ==========================================================================
  console.log('\n--- [Suite 1] Skill 1: Voice-Note Extraction ---');

  // 1.1: Normal successful case (Kannada audio note)
  const resVoiceSuccess = await executeVoiceNoteExtractionSkill({
    audioMimeType: 'audio/mp4',
    languageHint: 'kn-IN',
    contributorNotes: 'Heritage dosa counter on Margosa road',
  });

  assert(resVoiceSuccess.success === true, 'Voice-Note Extraction succeeds for regional audio');
  assert(resVoiceSuccess.spotName === 'Shri Sagar (CTR)', 'Extracts correct spot name');
  assert(resVoiceSuccess.vernacularTranscription.includes('ಶ್ರೀ ಸಾಗರ್'), 'Contains verbatim Kannada transcript');
  assert(resVoiceSuccess.translatedEnglish.includes('Shri Sagar CTR'), 'Contains culturally accurate English translation');
  assert(resVoiceSuccess.practicalDetails.openingHoursMentioned === '7:30 AM - 12:30 PM', 'Extracts explicit opening hours');
  assert(resVoiceSuccess.practicalDetails.cashOnlyWarning === true, 'Extracts cash/UPI payment requirement');
  assert(resVoiceSuccess.practicalDetails.signatureDishesOrItems.includes('Benne Masala Dose'), 'Extracts specialty dishes');

  // 1.2: Fact classification verification (Facts vs Inferences vs Unavailable)
  const facts = resVoiceSuccess.factClassification;
  const placeFact = facts.find((f) => f.attribute === 'placeName');
  const hoursFact = facts.find((f) => f.attribute === 'openingHours');
  const paymentFact = facts.find((f) => f.attribute === 'paymentMethods');

  assert(placeFact?.category === 'FACT', 'Explicitly stated spot name classified as FACT');
  assert(hoursFact?.category === 'FACT', 'Explicitly stated operating hours classified as FACT');
  assert(paymentFact?.category === 'FACT', 'Explicitly stated payment requirement classified as FACT');

  // 1.3: Edge case: Omitted opening hours (Zero Hallucination)
  const resVoiceOmittedHours = await executeVoiceNoteExtractionSkill({
    audioMimeType: 'audio/aac',
    languageHint: 'en',
    contributorNotes: 'Quick bite description without mentioning times',
  });

  assert(resVoiceOmittedHours.practicalDetails.openingHoursMentioned === undefined, 'Omitted opening hours remains strictly undefined');
  const unavailableHours = resVoiceOmittedHours.factClassification.find((f) => f.attribute === 'openingHours');
  assert(unavailableHours?.category === 'UNAVAILABLE', 'Omitted opening hours classified as UNAVAILABLE');

  // 1.4: Failure case: Missing both audio and photo payload
  const resVoiceEmpty = await executeVoiceNoteExtractionSkill({
    languageHint: 'kn-IN',
  });
  assert(resVoiceEmpty.success === false, 'Fails safely when audio and photo payloads are both absent');
  assert(resVoiceEmpty.isLowQualityOrNoisy === true, 'Flags isLowQualityOrNoisy for empty media input');

  // ==========================================================================
  // Suite 2: Skill 2 — Maps-Grounded Trap Filtering
  // ==========================================================================
  console.log('\n--- [Suite 2] Skill 2: Maps-Grounded Trap Filtering ---');

  // 2.1: Normal successful case (Authentic heritage spot)
  const resTrapSuccess = await executeTrapFilteringSkill({
    placeName: 'Brahmin Coffee Bar',
    neighborhood: 'Shankarapuram',
    groundingEvidence: {
      placeId: 'places/ChIJb9x1',
      displayName: 'Brahmin Coffee Bar',
      formattedAddress: 'Near Shankar Mutt, Shankarapuram, Bengaluru',
      location: { latitude: 12.9438, longitude: 77.5712 },
      types: ['restaurant', 'cafe', 'food', 'point_of_interest'],
      rating: 4.6,
      userRatingCount: 18500,
      priceLevel: 'PRICE_LEVEL_INEXPENSIVE',
      businessStatus: 'OPERATIONAL',
      coordinateDistanceDeltaMeters: 12,
    },
    hasGenerationalSignagePhoto: true,
    hasTraditionalEquipmentPhoto: true,
  });

  assert(resTrapSuccess.success === true, 'Trap Filtering succeeds for grounded place');
  assert(resTrapSuccess.authenticityScore >= 80, 'Assigns high authenticity score (>= 80) to heritage spot');
  assert(resTrapSuccess.authenticityBadge === 'HYPERLOCAL' || resTrapSuccess.authenticityBadge === 'EXPERT_CURATED', 'Awards authentic badge');
  assert(resTrapSuccess.isTouristTrapRisk === false, 'Determines isTouristTrapRisk is false');
  assert(resTrapSuccess.recommendationVerdict === 'STRONGLY_RECOMMENDED', 'Verdict is STRONGLY_RECOMMENDED');

  // 2.2: Negative / Contradictory Evidence Case (Severe coordinate delta > 500m)
  const resTrapContradictory = await executeTrapFilteringSkill({
    placeName: 'Counterfeit Heritage Darshini',
    groundingEvidence: {
      placeId: 'places/ChIJfake',
      displayName: 'Counterfeit Darshini',
      formattedAddress: 'Outer Ring Road, Bengaluru',
      location: { latitude: 12.8500, longitude: 77.4200 },
      types: ['restaurant'],
      rating: 3.1,
      userRatingCount: 42,
      businessStatus: 'OPERATIONAL',
      coordinateDistanceDeltaMeters: 1420, // Severe mismatch
    },
  });

  assert(resTrapContradictory.isTouristTrapRisk === true, 'Flags tourist trap risk on severe spatial mismatch');
  assert(resTrapContradictory.recommendationVerdict === 'FLAGGED_TOURIST_TRAP', 'Verdict is FLAGGED_TOURIST_TRAP');
  assert(resTrapContradictory.evidenceSynthesis.mapsEvidenceStatus === 'CONTRADICTORY_COORDINATES', 'Identifies CONTRADICTORY_COORDINATES');

  // 2.3: Insufficient evidence case (Missing Maps Grounding)
  const resTrapMissingMaps = await executeTrapFilteringSkill({
    placeName: 'Unregistered Street Vendor',
  });

  assert(resTrapMissingMaps.authenticityBadge === 'UNDER_REVIEW', 'Missing Maps evidence sets badge to UNDER_REVIEW');
  assert(resTrapMissingMaps.recommendationVerdict === 'UNVERIFIED_PENDING_GROUNDING', 'Verdict is UNVERIFIED_PENDING_GROUNDING');
  assert(resTrapMissingMaps.evidenceSynthesis.mapsEvidenceStatus === 'MISSING_EVIDENCE', 'Maps status is MISSING_EVIDENCE');

  // ==========================================================================
  // Suite 3: Skill 3 — Group Blending
  // ==========================================================================
  console.log('\n--- [Suite 3] Skill 3: Group Blending ---');

  // 3.1: Strict Dietary Union Case (VEGAN + GLUTEN_FREE + NUT_ALLERGY)
  const resGroupDietaryUnion = await executeGroupBlendingSkill({
    sessionId: 'session-blend-01',
    members: [
      {
        userId: 'traveler-01',
        dietaryRestrictions: ['VEGAN'],
        budgetTier: 'MODERATE',
        preferredPace: 'MODERATE',
        interestTags: ['HERITAGE', 'STREET_FOOD'],
      },
      {
        userId: 'traveler-02',
        dietaryRestrictions: ['GLUTEN_FREE'],
        budgetTier: 'MODERATE',
        preferredPace: 'MODERATE',
        interestTags: ['TEMPLES', 'HERITAGE'],
      },
      {
        userId: 'traveler-03',
        dietaryRestrictions: ['NUT_ALLERGY'],
        budgetTier: 'BUDGET',
        preferredPace: 'MODERATE',
        interestTags: ['STREET_FOOD', 'ART'],
      },
    ],
  });

  assert(resGroupDietaryUnion.success === true, 'Group Blending executes successfully');
  const dUnion = resGroupDietaryUnion.consensusBlend.dietaryUnion;
  assert(dUnion.includes('VEGAN'), 'Dietary union contains VEGAN');
  assert(dUnion.includes('GLUTEN_FREE'), 'Dietary union contains GLUTEN_FREE');
  assert(dUnion.includes('NUT_ALLERGY'), 'Dietary union contains NUT_ALLERGY');
  assert(resGroupDietaryUnion.dietarySafetyGuarantees.length >= 3, 'Issues strict dietary safety guarantees for each restriction');

  // 3.2: Conflicting Group Case (BUDGET vs PREMIUM, LEISURELY vs BRISK)
  const resGroupConflict = await executeGroupBlendingSkill({
    sessionId: 'session-blend-02',
    members: [
      {
        userId: 'traveler-budget-leisurely',
        dietaryRestrictions: ['VEGETARIAN'],
        budgetTier: 'BUDGET',
        preferredPace: 'LEISURELY',
        interestTags: ['STREET_FOOD'],
      },
      {
        userId: 'traveler-premium-brisk',
        dietaryRestrictions: [],
        budgetTier: 'PREMIUM',
        preferredPace: 'BRISK',
        interestTags: ['HERITAGE', 'LUXURY'],
      },
    ],
  });

  assert(resGroupConflict.consensusBlend.consensusBudgetTier === 'MODERATE', 'Caps polar budget conflict at MODERATE');
  assert(resGroupConflict.consensusBlend.recommendedPace === 'MODERATE', 'Harmonizes divergent walking paces to MODERATE');
  assert(resGroupConflict.conflictWarnings.length >= 2, 'Generates explicit conflict warnings for budget and pace divergences');

  // 3.3: Single Member Edge Case
  const resGroupSingle = await executeGroupBlendingSkill({
    sessionId: 'session-blend-single',
    members: [
      {
        userId: 'solo-traveler',
        dietaryRestrictions: ['JAIN'],
        budgetTier: 'BUDGET',
        preferredPace: 'BRISK',
        interestTags: ['ARCHITECTURE'],
      },
    ],
  });

  assert(resGroupSingle.consensusBlend.consensusBudgetTier === 'BUDGET', 'Single member preserves individual budget');
  assert(resGroupSingle.consensusBlend.dietaryUnion.includes('JAIN'), 'Single member preserves Jain dietary restriction');
  assert(resGroupSingle.groupCohesionScore >= 80, 'Single member produces high cohesion score');

  // ==========================================================================
  // Suite 4: Skill 4 — Plan-B Rerouting
  // ==========================================================================
  console.log('\n--- [Suite 4] Skill 4: Plan-B Rerouting ---');

  // Mock baseline route with 3 stops in Malleshwaram
  const sampleCanonicalRoute: CanonicalRouteDocument = {
    routeId: 'route_sample_malleshwaram_01',
    title: 'Heritage Tiffin & Temple Trail',
    neighborhood: 'Malleshwaram',
    theme: 'Heritage Trail',
    origin: { latitude: 13.0075, longitude: 77.5714 },
    destination: { latitude: 13.0039, longitude: 77.5701 },
    waypoints: [{ latitude: 13.0050, longitude: 77.5710 }],
    waypointPlaceIds: ['place_ctr_shri_sagar', 'place_closed_stall_01', 'place_kadu_malleshwara'],
    optimizedWaypointOrder: [0, 1, 2],
    totalDistanceMeters: 1450,
    totalDurationSeconds: 1280,
    formattedDistance: '1.4 km',
    formattedDuration: '21 mins',
    encodedPolyline: 'u~_kE_g|wM_@_@e@e@s@q@',
    legs: [
      {
        startCoordinate: { latitude: 13.0075, longitude: 77.5714 },
        endCoordinate: { latitude: 13.0050, longitude: 77.5710 },
        startPlaceId: 'place_ctr_shri_sagar',
        endPlaceId: 'place_closed_stall_01',
        distanceMeters: 600,
        durationSeconds: 480,
        formattedDistance: '600 m',
        formattedDuration: '8 mins',
        encodedPolyline: 'u~_kE_g|wM',
        steps: [],
      },
      {
        startCoordinate: { latitude: 13.0050, longitude: 77.5710 },
        endCoordinate: { latitude: 13.0039, longitude: 77.5701 },
        startPlaceId: 'place_closed_stall_01',
        endPlaceId: 'place_kadu_malleshwara',
        distanceMeters: 850,
        durationSeconds: 800,
        formattedDistance: '850 m',
        formattedDuration: '13 mins',
        encodedPolyline: '_@_@e@e@s@q@',
        steps: [],
      },
    ],
    isMockData: true,
    createdAt: '2026-11-21T08:00:00Z',
    updatedAt: '2026-11-21T08:00:00Z',
  };

  // 4.1: Weather Disruption Case (Heavy Rain on unpaved Flower Market alley)
  const resPlanBWeather = await executePlanBReroutingSkill({
    originalRoute: sampleCanonicalRoute,
    disruptions: [
      {
        type: 'WEATHER',
        affectedPlaceId: 'place_closed_stall_01',
        severity: 'SEVERE',
        description: 'Monsoon downpour: 8th Cross Flower Market alley waterlogged and slippery',
      },
    ],
    preferredIndoorAlternatives: true,
  });

  assert(resPlanBWeather.success === true, 'Plan-B Rerouting succeeds for weather disruption');
  assert(resPlanBWeather.safetyAdvisory !== null, 'Provides weather safety advisory');
  assert(resPlanBWeather.safetyAdvisory?.includes('Severe Weather Advisory') === true, 'Safety advisory mentions monsoon/rain conditions');
  assert(resPlanBWeather.conversationalExplanation.includes('Plan-B update'), 'Generates conversational explanation');
  assert(resPlanBWeather.rerouteResponse.alterations.length >= 2, 'Maintains route itinerary integrity');

  // 4.2: Capacity Disruption Case (AT_CAPACITY crowd throttling)
  const resPlanBCrowd = await executePlanBReroutingSkill({
    originalRoute: sampleCanonicalRoute,
    disruptions: [
      {
        type: 'CROWD',
        affectedPlaceId: 'place_ctr_shri_sagar',
        severity: 'SEVERE',
        description: 'Shri Sagar (CTR) has reached maximum hourly capacity (0 remaining)',
      },
    ],
  });

  assert(resPlanBCrowd.success === true, 'Plan-B Rerouting succeeds for crowd saturation');
  assert(resPlanBCrowd.safetyAdvisory?.includes('Capacity Saturation Notice') === true, 'Issues capacity saturation notice');

  // ==========================================================================
  // Suite 5: Continue in Gemini Handoff
  // ==========================================================================
  console.log('\n--- [Suite 5] Continue in Gemini Handoff ---');

  const handoffStore = new MemoryHandoffChallengeStore();

  const baseHandoffInput = {
    neighborhoodName: 'Malleshwaram',
    currentStopName: 'Shri Sagar (CTR)',
    activeRouteId: 'route-malleshwaram-01',
    recentDialogueSnippet: 'Traveler inquired about benne dose history and next walking stop.',
    userQueryToContinue: 'What are the architectural highlights of Kaadu Malleshwara temple?',
    travelerId: 'traveler-user-42',
  };

  // 5.1: Phase 1 — Preview Challenge Generation
  const handoffPreview = await executeGeminiHandoff(
    {
      ...baseHandoffInput,
      action: 'PREVIEW',
      userConsentGranted: false,
    },
    handoffStore
  );

  assert(handoffPreview.consentStatus === 'CONSENT_REQUIRED', 'PREVIEW phase indicates consent is REQUIRED');
  assert(handoffPreview.consentChallengeToken !== null, 'Generates consent challenge token in PREVIEW');
  assert(handoffPreview.handoffUri === null, 'handoffUri is strictly null until user grants consent');
  assert(handoffPreview.handoffDisclaimer.includes('Google Gemini'), 'Includes explicit Gemini privacy disclaimer');

  // 5.2: Phase 2 — Confirm with Explicit User Consent
  const challengeToken = handoffPreview.consentChallengeToken!;
  const handoffConfirm = await executeGeminiHandoff(
    {
      ...baseHandoffInput,
      action: 'CONFIRM',
      userConsentGranted: true,
      consentChallengeToken: challengeToken,
    },
    handoffStore
  );

  assert(handoffConfirm.consentStatus === 'CONSENT_GRANTED', 'CONFIRM phase marks consent GRANTED');
  assert(handoffConfirm.handoffUri !== null, 'Generates valid handoffUri upon consent confirmation');
  assert(handoffConfirm.handoffUri?.startsWith('https://gemini.google.com/app?') === true, 'Deep-link URL targets gemini.google.com/app');
  assert(handoffConfirm.handoffUri?.includes('Malleshwaram') === true, 'Handoff URL includes neighborhood context');

  // 5.3: Anti-Replay Protection (Single-use challenge token)
  const handoffReplay = await executeGeminiHandoff(
    {
      ...baseHandoffInput,
      action: 'CONFIRM',
      userConsentGranted: true,
      consentChallengeToken: challengeToken, // Replaying consumed token
    },
    handoffStore
  );

  assert(handoffReplay.consentStatus === 'CANCELLED', 'Replay attempt with consumed challenge token is rejected');
  assert(handoffReplay.handoffUri === null, 'Replay attempt strictly produces null handoff URI');

  // 5.4: Sensitive Credential Omission & Manual Fallback Representation
  const privacyReport = handoffConfirm.privacyComplianceReport;
  assert(privacyReport.isConsentVerified === true, 'Privacy report confirms verified consent');
  assert(privacyReport.filteredSensitiveFields.includes('rawPaymentTokens'), 'Omits raw payment tokens');
  assert(privacyReport.filteredSensitiveFields.includes('authSessionTokens'), 'Omits authentication session tokens');
  assert(handoffConfirm.manualCopyPasteContext.includes('LocalLens Neighborhood Guide'), 'Generates manual copy/paste fallback text');

  // ==========================================================================
  // Suite 6: Callable Functions Governance
  // ==========================================================================
  console.log('\n--- [Suite 6] Callable Functions Governance ---');

  // 6.1: Authentication guard on executeVoiceNoteExtraction
  let unauthVoice = false;
  try {
    await (executeVoiceNoteExtraction as any).run({
      auth: null,
      app: { appId: 'locallens-test-app' },
      data: { audioMimeType: 'audio/mp4' },
    });
  } catch (err: any) {
    unauthVoice = err.code === 'unauthenticated';
  }
  assert(unauthVoice, 'executeVoiceNoteExtraction rejects unauthenticated requests');

  // 6.2: Authentication guard on executeTrapFiltering
  let unauthTrap = false;
  try {
    await (executeTrapFiltering as any).run({
      auth: null,
      app: { appId: 'locallens-test-app' },
      data: { placeName: 'Test Place' },
    });
  } catch (err: any) {
    unauthTrap = err.code === 'unauthenticated';
  }
  assert(unauthTrap, 'executeTrapFiltering rejects unauthenticated requests');

  // 6.3: Authentication guard on executeGroupBlending
  let unauthGroup = false;
  try {
    await (executeGroupBlending as any).run({
      auth: null,
      app: { appId: 'locallens-test-app' },
      data: { sessionId: 'test-session', members: [] },
    });
  } catch (err: any) {
    unauthGroup = err.code === 'unauthenticated';
  }
  assert(unauthGroup, 'executeGroupBlending rejects unauthenticated requests');

  // 6.4: Authentication guard on executePlanBRerouting
  let unauthPlanB = false;
  try {
    await (executePlanBRerouting as any).run({
      auth: null,
      app: { appId: 'locallens-test-app' },
      data: { originalRoute: sampleCanonicalRoute, disruptions: [] },
    });
  } catch (err: any) {
    unauthPlanB = err.code === 'unauthenticated';
  }
  assert(unauthPlanB, 'executePlanBRerouting rejects unauthenticated requests');

  // 6.5: Authentication guard on executeGeminiHandoffCallable
  let unauthHandoff = false;
  try {
    await (executeGeminiHandoffCallable as any).run({
      auth: null,
      app: { appId: 'locallens-test-app' },
      data: baseHandoffInput,
    });
  } catch (err: any) {
    unauthHandoff = err.code === 'unauthenticated';
  }
  assert(unauthHandoff, 'executeGeminiHandoffCallable rejects unauthenticated requests');

  // 6.6: Authenticated execution of executeGroupBlending callable
  const callableGroupRes: any = await (executeGroupBlending as any).run({
    auth: { uid: 'user-host-01' },
    app: { appId: 'locallens-test-app' },
    data: {
      sessionId: 'session-callable-01',
      members: [
        {
          userId: 'user-01',
          dietaryRestrictions: ['VEGETARIAN'],
          budgetTier: 'MODERATE',
          preferredPace: 'MODERATE',
          interestTags: ['HERITAGE'],
        },
      ],
    },
  });

  assert(callableGroupRes.success === true, 'executeGroupBlending callable succeeds when authenticated');
  assert(callableGroupRes.data.consensusBlend.dietaryUnion.includes('VEGETARIAN'), 'Callable output contains dietary union');

  // Final Results
  console.log('\n================================================================');
  console.log(`B7 Test Suite Results: ${passedAssertions} passed, ${failedAssertions} failed.`);
  console.log('================================================================');

  if (failedAssertions > 0) {
    process.exit(1);
  }
}

runB7TestSuite().catch((err) => {
  console.error('Fatal test error in B7 test suite:', err);
  process.exit(1);
});
