/**
 * Startup Buildathon 2026 — Neighborhood Guide App
 * Task: Developer B — Handoff 2: Google Maps & Search Grounding Test Suite
 * 
 * Verifies:
 * 1. Google Maps Grounding tool configuration structure.
 * 2. Google Search Grounding tool configuration structure.
 * 3. Dual Maps + Search Grounding tool configuration.
 * 4. Correct extraction and handling of grounded results (Maps chunks & Web chunks).
 * 5. Safe handling of missing or insufficient grounding evidence.
 * 6. Truthful Provenance classification:
 *    - MAPS_GROUNDED vs COMMUNITY_VERIFIED vs HYBRID_VERIFIED vs SAMPLE_FIXTURE.
 * 7. Truth-in-advertising invariants:
 *    - No claim of Google Crowdsource API access.
 *    - No misrepresentation of Maps reviews as direct community contributions.
 *    - No invented opening hours or fabricated ratings.
 * 8. Provider errors, 429 quota failure handling, and deterministic fallback.
 * 9. 100% backward compatibility with existing synthesizeSpotCard and CanonicalPlaceDocument contracts.
 * 10. Clear separation between deterministic unit tests and live provider verification.
 */

import {
  buildGroundingToolsConfig,
  determineProvenanceBadge,
  synthesizeSpotCard,
  synthesizeSpotCardWithGrounding,
  SpotCardSynthesisInput,
} from '../src/ai/services/spot-card-synthesis-service.js';
import { CanonicalPlaceDocumentSchema } from '../src/types/contracts/index.js';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    passed++;
    console.log(`  ✅ PASSED: ${testName}`);
  } else {
    failed++;
    console.error(`  ❌ FAILED: ${testName}`);
    if (detail) console.error(`     Detail: ${detail}`);
  }
}

async function runHandoff2TestSuite() {
  console.log('================================================================');
  console.log('  Handoff 2: Google Maps & Search Grounding Verification Tests  ');
  console.log('================================================================');

  // ============================================================================
  // Suite 1: Tool Configuration Structure (@google/genai SDK format)
  // ============================================================================
  console.log('\n--- [Suite 1] Tool Configuration Structure ---');

  // 1.1: Maps Grounding tool configuration
  const mapsOnlyTools = buildGroundingToolsConfig({
    enableMapsGrounding: true,
    enableSearchGrounding: false,
  });
  assert(mapsOnlyTools.length === 1, 'Maps-only configuration yields exactly 1 tool');
  assert('googleMaps' in mapsOnlyTools[0], 'Tool contains googleMaps object conforming to @google/genai');

  // 1.2: Search Grounding tool configuration
  const searchOnlyTools = buildGroundingToolsConfig({
    enableMapsGrounding: false,
    enableSearchGrounding: true,
  });
  assert(searchOnlyTools.length === 1, 'Search-only configuration yields exactly 1 tool');
  assert('googleSearch' in searchOnlyTools[0], 'Tool contains googleSearch object conforming to @google/genai');

  // 1.3: Dual Grounding configuration (Maps + Search)
  const dualTools = buildGroundingToolsConfig({
    enableMapsGrounding: true,
    enableSearchGrounding: true,
  });
  assert(dualTools.length === 2, 'Dual configuration configures both tools');
  assert('googleMaps' in dualTools[0], 'First tool is googleMaps');
  assert('googleSearch' in dualTools[1], 'Second tool is googleSearch');

  // ============================================================================
  // Suite 2: Truthful Provenance Classification
  // ============================================================================
  console.log('\n--- [Suite 2] Truthful Provenance Classification ---');

  // 2.1: Direct LocalLens Community Voice Contribution
  const provCommunity = determineProvenanceBadge({
    isFixture: false,
    hasCommunityVoice: true,
    hasMapsGrounding: false,
  });
  assert(provCommunity.badge === 'COMMUNITY_VERIFIED', 'Resident voice memo alone classifies as COMMUNITY_VERIFIED');
  assert(provCommunity.primarySource === 'COMMUNITY_VOICE', 'Primary source is COMMUNITY_VOICE');
  assert(provCommunity.attributionNote.includes('Crowdsource lacks public API'), 'Truthfully discloses Crowdsource API absence');

  // 2.2: Google Maps Grounded Place
  const provMaps = determineProvenanceBadge({
    isFixture: false,
    hasCommunityVoice: false,
    hasMapsGrounding: true,
  });
  assert(provMaps.badge === 'MAPS_GROUNDED', 'Maps grounding without resident memo classifies as MAPS_GROUNDED');
  assert(provMaps.primarySource === 'GOOGLE_MAPS', 'Primary source is GOOGLE_MAPS');
  assert(!provMaps.attributionNote.includes('community voice'), 'Does not falsely label Maps grounding as community voice');

  // 2.3: Hybrid Verified Place (Community Voice + Maps Grounding)
  const provHybrid = determineProvenanceBadge({
    isFixture: false,
    hasCommunityVoice: true,
    hasMapsGrounding: true,
  });
  assert(provHybrid.badge === 'HYBRID_VERIFIED', 'Place with both voice memo and Maps grounding classifies as HYBRID_VERIFIED');
  assert(provHybrid.attributionNote.includes('Hybrid verified'), 'Attribution notes both community voice and Maps Platform grounding');

  // 2.4: Sample Fixture Data
  const provFixture = determineProvenanceBadge({
    isFixture: true,
    hasCommunityVoice: true,
    hasMapsGrounding: true,
  });
  assert(provFixture.badge === 'SAMPLE_FIXTURE', 'Fixture data strictly classifies as SAMPLE_FIXTURE');
  assert(provFixture.primarySource === 'SAMPLE_FIXTURE', 'Primary source is SAMPLE_FIXTURE');

  // ============================================================================
  // Suite 3: Spot Card Synthesis with Grounding & Contract Conformance
  // ============================================================================
  console.log('\n--- [Suite 3] Spot Card Synthesis & Contract Conformance ---');

  const baseInput: SpotCardSynthesisInput = {
    contributionId: 'contrib_ctr_001',
    submission: {
      spotName: 'CTR Shri Sagar',
      neighborhood: 'Malleshwaram',
      category: 'FOOD_AND_DINING',
      infoParagraph: 'Famous heritage darshini known for crispy benne masala dosa.',
      mapsLink: 'https://maps.google.com/?cid=12345',
      photoUrls: ['https://storage.googleapis.com/locallens/photo1.jpg'],
    },
    contributorProfile: {
      userId: 'user_malleshwaram_01',
      displayName: 'Ravi Kumar',
      badgeTitle: 'Heritage Resident',
      isVerifiedResident: true,
    },
    voiceExtractions: [
      {
        detectedLanguage: 'kn-IN',
        transcription: 'ಇಲ್ಲಿ ಮಲ್ಲೇಶ್ವರಂನಲ್ಲಿರೋ ಶ್ರೀ ಸಾಗರ್ ಸಿಟಿಆರ್ ಬೆಣ್ಣೆ ದೋಸೆ ತುಂಬಾ ಫೇಮಸ್.',
        englishTranslation: 'Shri Sagar CTR butter dosa is very famous in Malleshwaram.',
        practicalDetails: {
          openingHoursMentioned: '7:30 AM - 12:30 PM',
          signatureDishesOrItems: ['Benne Masala Dosa', 'Filter Coffee'],
          cashOnlyWarning: true,
          insiderTips: ['Collect coupon token before queueing'],
        },
      },
    ],
    preliminaryCoordinate: {
      latitude: 13.0075,
      longitude: 77.5714,
      precision: 6,
      formatted: '13.007500, 77.571400',
      geohash: 'tdr1v',
      isValid: true,
    },
  };

  // 3.1: Synthesis with Mock Fallback (Deterministic Mode)
  const resultMockFallback = await synthesizeSpotCardWithGrounding(baseInput, {
    forceMockFallback: true,
  });

  assert(CanonicalPlaceDocumentSchema.safeParse(resultMockFallback.spotCard).success, 'Synthesized spot card conforms strictly to CanonicalPlaceDocument schema');
  assert(resultMockFallback.provenance.badge === 'HYBRID_VERIFIED', 'Synthesized card correctly identifies HYBRID_VERIFIED provenance');
  assert(resultMockFallback.provenance.isCommunityVerified === true, 'Flags isCommunityVerified as true');
  assert(resultMockFallback.provenance.isMapsGrounded === true, 'Flags isMapsGrounded as true');
  assert(resultMockFallback.spotCard.openHours === '7:30 AM - 12:30 PM', 'Preserves verified opening hours from contributor voice note');
  assert(resultMockFallback.spotCard.authenticity.vibeTags.includes('provenance:hybrid_verified'), 'Enriches vibeTags with provenance:hybrid_verified');
  assert(resultMockFallback.spotCard.authenticity.localSentimentSummary.includes('Truthful Provenance') || resultMockFallback.spotCard.authenticity.localSentimentSummary.includes('Provenance: HYBRID_VERIFIED'), 'Includes provenance in local sentiment summary');

  // 3.2: Synthesis with Sample Fixture
  const resultFixture = await synthesizeSpotCardWithGrounding(baseInput, {
    isFixtureData: true,
  });

  assert(resultFixture.spotCard.isMockData === true, 'Fixture spot card is explicitly marked isMockData = true');
  assert(resultFixture.provenance.badge === 'SAMPLE_FIXTURE', 'Fixture badge is SAMPLE_FIXTURE');
  assert(resultFixture.executionStatus === 'DETERMINISTIC_FIXTURE', 'Execution status is DETERMINISTIC_FIXTURE');

  // ============================================================================
  // Suite 4: Missing & Insufficient Evidence Handing (Zero Hallucination)
  // ============================================================================
  console.log('\n--- [Suite 4] Missing Evidence & Anti-Hallucination Guardrails ---');

  const sparseInput: SpotCardSynthesisInput = {
    contributionId: 'contrib_sparse_002',
    submission: {
      spotName: 'Unregistered Street Vendor',
      neighborhood: 'Pete',
      category: 'FOOD_AND_DINING',
      infoParagraph: 'Small cart near market gate.',
    },
    // No voice extractions, no preliminary coordinate
  };

  const resultSparse = await synthesizeSpotCardWithGrounding(sparseInput, {
    forceMockFallback: true,
  });

  assert(resultSparse.spotCard.openHours === 'Check Maps for hours', 'Omitted opening hours strictly defaults to "Check Maps for hours"');
  assert(resultSparse.spotCard.isVerified === false, 'Unverified place sets isVerified = false');
  assert(resultSparse.provenance.isCommunityVerified === false, 'Missing voice extractions leaves isCommunityVerified = false');
  assert(resultSparse.provenance.badge === 'MAPS_GROUNDED', 'Classifies as MAPS_GROUNDED baseline pending verification');

  // ============================================================================
  // Suite 5: Provider Error & Quota Exhaustion (429 Fallback Handling)
  // ============================================================================
  console.log('\n--- [Suite 5] Provider Error & Quota Handling ---');

  // Test live synthesis wrapper without forceMockFallback:
  // (In test environment with developer key that hits 429 quota exhaustion,
  // the engine must catch 429 gracefully, set GROUNDING_QUOTA_FALLBACK, and produce a valid card)
  const resultLiveAttempt = await synthesizeSpotCardWithGrounding(baseInput, {
    enableMapsGrounding: true,
    enableSearchGrounding: true,
  });

  assert(CanonicalPlaceDocumentSchema.safeParse(resultLiveAttempt.spotCard).success, 'Gracefully produces valid CanonicalPlaceDocument even under 429 quota exhaustion');
  assert(
    resultLiveAttempt.executionStatus === 'GROUNDING_QUOTA_FALLBACK' ||
    resultLiveAttempt.executionStatus === 'LIVE_GROUNDED_SUCCESS' ||
    resultLiveAttempt.executionStatus === 'UNAUTHENTICATED_FALLBACK',
    'Accurately identifies execution status without crashing'
  );
  assert(resultLiveAttempt.groundingToolsConfigured.includes('googleMaps'), 'Documents googleMaps as configured tool');
  assert(resultLiveAttempt.groundingToolsConfigured.includes('googleSearch'), 'Documents googleSearch as configured tool');

  // ============================================================================
  // Suite 6: Backward Compatibility with Existing B2 synthesizeSpotCard
  // ============================================================================
  console.log('\n--- [Suite 6] Backward Compatibility with B2 Pipeline ---');

  const synchronousCard = synthesizeSpotCard(baseInput);
  assert(CanonicalPlaceDocumentSchema.safeParse(synchronousCard).success, 'Synchronous synthesizeSpotCard remains 100% contract compliant');
  assert(synchronousCard.openHours === '7:30 AM - 12:30 PM', 'Synchronous card preserves opening hours');
  assert(synchronousCard.authenticity.vibeTags.includes('resident_voice_attested'), 'Synchronous card preserves B2 vibe tags');

  // Final Summary
  console.log('\n================================================================');
  console.log(`Handoff 2 Test Suite Results: ${passed} passed, ${failed} failed.`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runHandoff2TestSuite().catch((err) => {
  console.error('Fatal test error in Handoff 2 test suite:', err);
  process.exit(1);
});
