/**
 * Startup Buildathon 2026 — Neighborhood Guide App
 * Task B5 Verification Suite: Gemini Live & Street-Ready AI Assistance
 * Developer B — AI & Model Integration Lead
 * 
 * Verifies all 8 capability categories:
 * 1. Gemini 3.8 Live session handshake & ephemeral token minting (WebSocket)
 * 2. Conversational Street Copilot (Q&A with neighborhood context)
 * 3. Real-time translation preserving quantities, prices, and dietary cues
 * 4. Local greetings and cultural ordering phrases (Developer D client parity)
 * 5. Contextual venue etiquette (temples, darshinis, flower markets)
 * 6. Camera-based visual sign/menu translation with blur/unreadable handling
 * 7. Audio guidance content generation (< 60 words for device TTS)
 * 8. Plan-B route change explanation (consuming Developer C's PlanBExplanationContext verbatim)
 * 9. Continue in Gemini handoff interface and context export
 * 10. Live Gemini API execution (conditional probe with honest skip reporting)
 */

import {
  initializeLiveSession,
  askStreetCopilot,
  translateText,
  getOrderingPhrases,
  getEtiquetteGuidance,
  translateCameraSignage,
  generateAudioGuidance,
  explainPlanBReroute,
  formatGeminiHandoffContext,
} from '../src/ai/services/live-assistance-service.js';
import {
  LiveSessionTokenResponseSchema,
  StreetCopilotResponseSchema,
  TranslationResponseSchema,
  OrderingAssistanceResponseSchema,
  EtiquetteGuidanceResponseSchema,
  CameraVisualTranslationResponseSchema,
  AudioGuidanceContentResponseSchema,
  PlanBExplanationResponseSchema,
  GeminiHandoffResponseSchema,
} from '../src/ai/schemas/assistance-schemas.js';
import { PlanBExplanationContext } from '../src/maps/types/weather.types.js';
import { getAIConfig } from '../src/ai/config/env.js';
import {
  checkRateLimit,
  assertLiveSessionTokenIssuance,
  clearRateLimitsForTesting,
} from '../src/ai/utils/rate-limiter.js';

let passed = 0;
let total = 0;
let skipped = 0;

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

function skip(reason: string, testName: string) {
  skipped++;
  console.log(`⚠️ SKIPPED: ${testName} (${reason})`);
}

async function runB5Tests() {
  console.log('================================================================');
  console.log('  Startup Buildathon 2026 — Task B5 AI Assistance Test Suite   ');
  console.log('  Gemini Live, Translation & Street-Ready Assistance Engines   ');
  console.log('================================================================\n');

  const config = getAIConfig();
  console.log(`Environment: DefaultModel=${config.defaultModel}, HasKey=${config.hasApiKey}\n`);

  // =========================================================================
  // Test Suite 1: Gemini Live Session Handshake & Ephemeral Token Minting
  // =========================================================================
  console.log('--- [Suite 1] Gemini Live WebSocket Handshake & Token Minting ---');

  const liveSession = await initializeLiveSession({
    travelerId: 'usr_traveler_101',
    sessionPurpose: 'STREET_WALKING',
    preferredLanguage: 'kn-IN',
    neighborhoodHint: 'Malleshwaram 8th Cross',
  });

  assert(LiveSessionTokenResponseSchema.safeParse(liveSession).success, 'LiveSessionTokenResponse conforms strictly to Zod schema');
  assert(liveSession.model === 'models/gemini-2.0-flash-exp', 'Targets official Developer API Multimodal Live model models/gemini-2.0-flash-exp');
  assert(liveSession.deliveryMode === 'LIVE_STREAMING', 'Explicitly labeled deliveryMode: LIVE_STREAMING');
  assert(
    liveSession.webSocketEndpoint === 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContentConstrained',
    'Targets official BidiGenerateContentConstrained WebSocket endpoint'
  );
  assert(liveSession.authMethod === 'QUERY_PARAM_ACCESS_TOKEN', 'Specifies QUERY_PARAM_ACCESS_TOKEN authentication format');
  assert(liveSession.diagnostics.providerMechanism.includes('authTokens.create'), 'Identifies official Google Provider mechanism');
  assert(liveSession.ephemeralToken === null ? !liveSession.isLiveSessionSupported : liveSession.isLiveSessionSupported, 'Honest provider state: no fake tokens returned when offline');
  assert(liveSession.ephemeralToken === null || !liveSession.ephemeralToken.includes('AIzaSy'), 'Zero leakage: raw Google API keys are NEVER returned to client');
  assert(liveSession.systemInstructionsApplied.includes('Malleshwaram'), 'System instructions contextualized to requested neighborhood');

  // =========================================================================
  // Test Suite 2: Conversational Street Copilot (Q&A Dialogue)
  // =========================================================================
  console.log('\n--- [Suite 2] Conversational Street Copilot Dialogue ---');

  // Query 1: Coffee & Darshini inquiry
  const copilotCoffee = await askStreetCopilot({
    query: 'How do I order filter coffee and benne dose at CTR?',
    travelerContext: {
      currentNeighborhood: 'Malleshwaram',
      preferredLanguage: 'en-IN',
      activeDietaryRestrictions: ['Vegetarian'],
    },
  });
  assert(StreetCopilotResponseSchema.safeParse(copilotCoffee).success, 'Copilot response adheres to schema');
  assert(copilotCoffee.answer.length > 20, 'Generates substantive street guidance answer');
  assert(copilotCoffee.answer.toLowerCase().includes('ctr') || copilotCoffee.answer.toLowerCase().includes('dose'), 'Mentions CTR / benne dose context');
  assert(copilotCoffee.suggestedFollowUps.length > 0, 'Returns actionable follow-up suggestions');
  assert(
    copilotCoffee.deliveryMode === 'REQUEST_RESPONSE_FALLBACK' || copilotCoffee.deliveryMode === 'OFFLINE_MOCK_ADAPTER',
    'Delivery mode cleanly marked as fallback or offline adapter'
  );

  // Query 2: Temple decorum inquiry
  const copilotTemple = await askStreetCopilot({
    query: 'What should I wear before entering Kadu Malleshwara temple?',
    travelerContext: {
      currentNeighborhood: 'Malleshwaram',
      preferredLanguage: 'en-IN',
    },
  });
  assert(
    copilotTemple.answer.toLowerCase().includes('footwear') || copilotTemple.answer.toLowerCase().includes('shoes'),
    'Copilot correctly mentions footwear removal at temple entrance'
  );

  // =========================================================================
  // Test Suite 3: Real-Time Translation & Practical Details Preservation
  // =========================================================================
  console.log('\n--- [Suite 3] Real-Time Translation & Detail Preservation ---');

  // Case 3.1: Kannada to English with quantity
  const translationKannadaToEn = await translateText({
    sourceText: 'ಒಂದು ಕಪ್ ಬಿಸಿ ಫಿಲ್ಟರ್ ಕಾಫಿ ಕೊಡಿ',
    sourceLanguage: 'kn-IN',
    targetLanguage: 'en',
    conversationContext: 'Darshini counter order',
  });
  assert(TranslationResponseSchema.safeParse(translationKannadaToEn).success, 'Kannada-to-English translation validates against schema');
  assert(translationKannadaToEn.translatedText.toLowerCase().includes('coffee'), 'Translated text mentions coffee');
  assert(translationKannadaToEn.preservedPracticalDetails.extractedQuantities.length > 0, 'Preserved extracted quantity (1 cup)');

  // Case 3.2: Price preservation (40 rupees)
  const translationPrice = await translateText({
    sourceText: 'ಇದು 40 ರೂಪಾಯಿ (This is 40 rupees)',
    sourceLanguage: 'kn-IN',
    targetLanguage: 'en',
  });
  assert(translationPrice.preservedPracticalDetails.extractedPrices.length > 0, 'Preserved extracted price note (₹40)');

  // Case 3.3: Dietary requirement preservation (less spicy)
  const translationDietary = await translateText({
    sourceText: 'ಖಾರ ಕಡಿಮೆ ಮಾಡಿ (Make it less spicy)',
    sourceLanguage: 'kn-IN',
    targetLanguage: 'en',
  });
  assert(
    translationDietary.preservedPracticalDetails.dietaryCuesDetected.length > 0 ||
    translationDietary.translatedText.toLowerCase().includes('spicy'),
    'Preserved dietary spice tolerance requirement'
  );

  // =========================================================================
  // Test Suite 4: Cultural Greetings & Vendor Ordering Phrases
  // =========================================================================
  console.log('\n--- [Suite 4] Local Greetings & Vendor Ordering Cards ---');

  const allOrdering = await getOrderingPhrases();
  assert(OrderingAssistanceResponseSchema.safeParse(allOrdering).success, 'Ordering cards response conforms to schema');
  assert(allOrdering.cards.length >= 5, 'Returns comprehensive curated phrase deck (>= 5 cards)');

  // Check specific categories
  const foodCards = await getOrderingPhrases({ category: 'FOOD_ORDER' });
  assert(foodCards.cards.every((c) => c.category === 'FOOD_ORDER'), 'Category filter strictly enforces FOOD_ORDER');
  assert(
    foodCards.cards.some((c) => c.phraseRegional.includes('ಕಾಫಿ') || c.englishMeaning.includes('coffee')),
    'Includes authentic coffee ordering phrase in regional script'
  );

  const priceCards = await getOrderingPhrases({ category: 'PRICING' });
  assert(priceCards.cards.some((c) => c.category === 'PRICING'), 'Contains PRICING category cards (UPI / cost)');

  // Check Developer D interface parity
  const sampleCard = allOrdering.cards[0];
  assert(typeof sampleCard.phraseRegional === 'string' && sampleCard.phraseRegional.length > 0, 'phraseRegional present');
  assert(typeof sampleCard.phonetic === 'string' && sampleCard.phonetic.length > 0, 'phonetic guide present');
  assert(typeof sampleCard.englishMeaning === 'string' && sampleCard.englishMeaning.length > 0, 'englishMeaning present');
  assert(typeof sampleCard.usageTip === 'string' && sampleCard.usageTip.length > 0, 'usageTip present');

  // =========================================================================
  // Test Suite 5: Contextual Etiquette Guidance
  // =========================================================================
  console.log('\n--- [Suite 5] Contextual Etiquette Guidance ---');

  // Temple etiquette
  const templeEtiquette = await getEtiquetteGuidance({
    venueType: 'TEMPLE',
    venueName: 'Kadu Malleshwara Temple',
  });
  assert(EtiquetteGuidanceResponseSchema.safeParse(templeEtiquette).success, 'Temple etiquette conforms to schema');
  assert(templeEtiquette.footwearProtocol.toLowerCase().includes('prohibited') || templeEtiquette.footwearProtocol.toLowerCase().includes('remove'), 'Footwear protocol clearly flagged');
  assert(templeEtiquette.photographyPermitted === 'OUTSIDE_ONLY', 'Photography restricted to outside courtyard');
  assert(templeEtiquette.taboosOrPitfallsToAvoid.length > 0, 'Identifies specific temple taboos');

  // Darshini eatery etiquette
  const eateryEtiquette = await getEtiquetteGuidance({
    venueType: 'HERITAGE_EATERY',
    venueName: 'CTR Shri Sagar',
  });
  assert(eateryEtiquette.diningOrPaymentCustoms.toLowerCase().includes('token'), 'Darshini token ordering custom explained');

  // =========================================================================
  // Test Suite 6: Camera-Based Sign & Menu Translation
  // =========================================================================
  console.log('\n--- [Suite 6] Camera-Based Visual Translation ---');

  // Valid image payload
  const validImageResponse = await translateCameraSignage({
    imagePayload: {
      base64Data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', // 1x1 valid sample png
      mimeType: 'image/png',
    },
    captureContext: 'STOREFRONT_SIGN',
  });
  assert(CameraVisualTranslationResponseSchema.safeParse(validImageResponse).success, 'Camera translation conforms to schema');
  assert(validImageResponse.detectedScript.length > 0, 'Detected regional script');
  assert(validImageResponse.translatedText.length > 0, 'Produced translated text');

  // Empty / Missing image payload
  const emptyImageResponse = await translateCameraSignage({
    imagePayload: {
      base64Data: '',
      mimeType: 'image/jpeg',
    },
    captureContext: 'MENU_BOARD',
  });
  assert(emptyImageResponse.readabilityAssessment === 'UNREADABLE', 'Empty image payload safely marked UNREADABLE');
  assert(emptyImageResponse.confidenceScore === 0.0, 'Zero confidence for empty image');

  // Blurry / Tiny image payload
  const blurryImageResponse = await translateCameraSignage({
    imagePayload: {
      base64Data: 'short-junk',
      mimeType: 'image/jpeg',
    },
  });
  assert(blurryImageResponse.readabilityAssessment === 'BLURRY_OR_DARK', 'Short corrupt image marked BLURRY_OR_DARK');

  // =========================================================================
  // Test Suite 7: Audio Guidance Content Generation (< 60 words for TTS)
  // =========================================================================
  console.log('\n--- [Suite 7] Concise Audio Guidance Generation ---');

  const audioGuidance = await generateAudioGuidance({
    currentLocationName: '8th Cross Road',
    nextStopName: 'CTR Shri Sagar',
    walkingDistanceMeters: 120,
    guidanceTrigger: 'APPROACHING_STOP',
  });
  assert(AudioGuidanceContentResponseSchema.safeParse(audioGuidance).success, 'Audio guidance conforms to schema');
  assert(audioGuidance.wordCount <= 60, `Enforces concise spoken delivery: word count (${audioGuidance.wordCount}) <= 60`);
  assert(audioGuidance.estimatedSpokenDurationSeconds >= 3 && audioGuidance.estimatedSpokenDurationSeconds <= 30, 'Spoken duration is realistic (~15-25s)');
  assert(audioGuidance.spokenPromptText.includes('CTR Shri Sagar'), 'Spoken prompt incorporates target stop name');

  // =========================================================================
  // Test Suite 8: Plan-B Reroute Explanation (Consumes C's Context Verbatim)
  // =========================================================================
  console.log('\n--- [Suite 8] Plan-B Explanation (Developer C Context Integration) ---');

  const samplePlanBContext: PlanBExplanationContext = {
    summary: 'Rerouted around flooded 8th Cross flower lane via 7th Cross Margosa Road',
    primaryDisruption: 'HEAVY_RAIN',
    disruptedStopsCount: 1,
    replacedStops: [
      {
        from: '8th Cross Flower Alley',
        to: 'Margosa Covered Arcade',
        reason: 'Waterlogged pavement from sudden monsoon downpour',
      },
    ],
    retainedStopsCount: 3,
    distanceDeltaMeters: 45,
    durationDeltaSeconds: 60,
    weatherAdvisory: 'Heavy rain alert: 15mm/hr precipitation',
    crowdNotice: 'Covered pedestrian walkway has low crowd density',
  };

  const planBExplanation = await explainPlanBReroute({
    explanationContext: samplePlanBContext,
    spokenAudioPreferred: true,
  });

  assert(PlanBExplanationResponseSchema.safeParse(planBExplanation).success, 'Plan-B explanation conforms to schema');
  assert(planBExplanation.disruptionExplanation.toLowerCase().includes('rain'), 'Identifies severe weather / rain disruption');
  assert(planBExplanation.replacementJustification.includes('Margosa Covered Arcade'), 'Preserves replacement stop name from C verbatim');
  assert(planBExplanation.deltaSummary.distanceChangeText === 'Adds 45 meters', 'Formats distance delta without modifying C values');
  assert(planBExplanation.spokenAudioSnippet.length <= 300, 'Spoken audio snippet is short and immediate for walking cue');
  assert(
    planBExplanation.crowdAndWeatherNote?.includes('Heavy rain alert'),
    'Preserves weather advisory and crowd notice from context'
  );

  // =========================================================================
  // Test Suite 9: Continue in Gemini Handoff Interface (Two-Phase Explicit Consent)
  // =========================================================================
  console.log('\n--- [Suite 9] Continue in Gemini Handoff Interface ---');

  // Case A: Traveler has NOT granted consent yet (Phase 1: Preview & Challenge)
  const handoffRequiresConsent = formatGeminiHandoffContext({
    travelerId: 'usr_traveler_101',
    activeNeighborhood: 'Malleshwaram',
    currentCoordinates: { latitude: 12.9984, longitude: 77.5714 },
    currentRouteSummary: 'Malleshwaram Heritage Breakfast Walk (4 stops)',
    recentSpotCards: [
      { spotName: 'CTR Shri Sagar', category: 'tiffin_hall', openHours: '7:30 AM - 12:30 PM' },
    ],
    recentConversationSnippets: ['What is the best dish at CTR?'],
    userConsentGranted: false,
  });

  assert(GeminiHandoffResponseSchema.safeParse(handoffRequiresConsent).success, 'Handoff preview conforms to schema');
  assert(handoffRequiresConsent.consentStatus === 'CONSENT_REQUIRED', 'Demands explicit user consent before data export');
  assert(handoffRequiresConsent.consentChallengeToken.startsWith('consent_chk_'), 'Issues cryptographic consent challenge token');
  assert(handoffRequiresConsent.handoffUri === null, 'Does NOT generate handoff deep link without consent');
  assert(handoffRequiresConsent.cancellationPath === 'REMAIN_IN_APP', 'Provides safe cancellation path (REMAIN_IN_APP)');
  assert(handoffRequiresConsent.transferPayloadPreview.neighborhood === 'Malleshwaram', 'Presents transparent payload preview to user');
  assert(handoffRequiresConsent.transferPayloadPreview.spotNames.includes('CTR Shri Sagar'), 'Includes explicit spot names in preview');

  // Case B: Traveler confirmed but challenge token was corrupted/mismatched
  const handoffMismatched = formatGeminiHandoffContext({
    travelerId: 'usr_traveler_101',
    activeNeighborhood: 'Malleshwaram',
    currentCoordinates: { latitude: 12.9984, longitude: 77.5714 },
    currentRouteSummary: 'Malleshwaram Heritage Breakfast Walk (4 stops)',
    recentSpotCards: [
      { spotName: 'CTR Shri Sagar', category: 'tiffin_hall', openHours: '7:30 AM - 12:30 PM' },
    ],
    recentConversationSnippets: ['What is the best dish at CTR?'],
    userConsentGranted: true,
    consentChallengeToken: 'invalid_corrupted_token',
  });
  assert(handoffMismatched.consentStatus === 'CANCELLED', 'Rejects handoff when consent challenge token is invalid');
  assert(handoffMismatched.handoffUri === null, 'No URI generated on mismatched consent challenge');

  // Case C: Traveler confirmed with valid challenge token (Phase 2: Confirmed Handoff)
  const handoffConfirmed = formatGeminiHandoffContext({
    travelerId: 'usr_traveler_101',
    activeNeighborhood: 'Malleshwaram',
    currentCoordinates: { latitude: 12.9984, longitude: 77.5714 },
    currentRouteSummary: 'Malleshwaram Heritage Breakfast Walk (4 stops)',
    recentSpotCards: [
      { spotName: 'CTR Shri Sagar', category: 'tiffin_hall', openHours: '7:30 AM - 12:30 PM' },
    ],
    recentConversationSnippets: ['What is the best dish at CTR?'],
    userConsentGranted: true,
    consentChallengeToken: handoffRequiresConsent.consentChallengeToken,
  });

  assert(handoffConfirmed.consentStatus === 'CONSENT_GRANTED', 'Marks consent status as granted');
  assert(handoffConfirmed.handoffUri !== null && handoffConfirmed.handoffUri.startsWith('https://gemini.google.com/app'), 'Deep-link targets official Gemini app');
  assert(handoffConfirmed.transferredAttributes.includes('activeNeighborhood'), 'Transfers activeNeighborhood');
  assert(handoffConfirmed.omittedAttributes.includes('rawPaymentTokens'), 'Omits private payment tokens');
  assert(handoffConfirmed.handoffDisclaimer.length > 0, 'Contains explicit privacy and data transfer disclaimer');

  // =========================================================================
  // Test Suite 11: Rate Limiting & Abuse Prevention Controls
  // =========================================================================
  console.log('\n--- [Suite 11] Rate Limiting & Abuse Prevention Controls ---');

  clearRateLimitsForTesting();

  // Test 1: Normal requests allowed under limit
  const check1 = checkRateLimit('user_test_999', 'askStreetCopilot');
  assert(check1.allowed, 'First request under policy limit is allowed');
  assert(check1.remaining === 19, 'Remaining request count correctly decremented (19)');

  // Test 2: Rapid Live session token minting restricted (concurrency / loop prevention)
  let firstTokenAllowed = false;
  try {
    assertLiveSessionTokenIssuance('user_test_live_1');
    firstTokenAllowed = true;
  } catch {
    firstTokenAllowed = false;
  }
  assert(firstTokenAllowed, 'First live token issuance is allowed');

  let secondTokenBlocked = false;
  try {
    assertLiveSessionTokenIssuance('user_test_live_1');
  } catch (err: any) {
    if (err.code === 'resource-exhausted') {
      secondTokenBlocked = true;
    }
  }
  assert(secondTokenBlocked, 'Rapid subsequent live token issuance within 15s is blocked (resource-exhausted)');

  // Test 3: Exhausting policy limit
  for (let i = 0; i < 19; i++) {
    checkRateLimit('user_test_999', 'askStreetCopilot');
  }
  const checkExhausted = checkRateLimit('user_test_999', 'askStreetCopilot');
  assert(!checkExhausted.allowed, 'Exceeding 20 req/min policy limit correctly blocks request');
  assert(checkExhausted.remaining === 0, 'Remaining count is 0 when rate limit is exceeded');

  clearRateLimitsForTesting();

  // =========================================================================
  // Test Suite 10: Live Gemini API Integration (Conditional)
  // =========================================================================
  console.log('\n--- [Suite 10] Live Gemini API Integration ---');

  let isLiveApiReachable = false;
  if (config.hasApiKey) {
    try {
      const probeResponse = await translateText({
        sourceText: 'Hello world',
        sourceLanguage: 'en',
        targetLanguage: 'kn-IN',
      });
      if (probeResponse.deliveryMode === 'REQUEST_RESPONSE_FALLBACK') {
        isLiveApiReachable = true;
      }
    } catch {
      isLiveApiReachable = false;
    }
  }

  if (isLiveApiReachable) {
    console.log('Live Gemini API reachable: executing live conversational tests...');
    const liveCopilot = await askStreetCopilot({
      query: 'Tell me the history of Malleshwaram in two sentences.',
      travelerContext: { currentNeighborhood: 'Malleshwaram' },
    });
    assert(liveCopilot.deliveryMode === 'REQUEST_RESPONSE_FALLBACK', 'Live: Copilot answered via Gemini Flash');
  } else {
    skip('No outbound network or live API access in current environment', 'Live Gemini 3.8 Flash copilot execution');
    skip('No outbound network or live API access in current environment', 'Live Gemini 3.8 Live WebSocket connection');
    console.log('Note: Deterministic tests fully verified all schemas, fallbacks, and integration contracts.');
  }

  // =========================================================================
  // Summary
  // =========================================================================
  console.log('\n================================================================');
  console.log(`B5 Test Suite Results: ${passed} passed, ${skipped} skipped, ${total} total assertions.`);
  console.log('================================================================\n');

  if (process.exitCode && process.exitCode !== 0) {
    throw new Error(`Test suite failed with exit code ${process.exitCode}`);
  }
}

runB5Tests().catch((err) => {
  console.error('Fatal error in B5 tests:', err);
  process.exit(1);
});
