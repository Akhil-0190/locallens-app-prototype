/**
 * Startup Buildathon 2026 — Neighborhood Guide App
 * Task B2 Verification Suite: Regional Voice & Photo Extraction
 * 
 * Verifies:
 * 1. Regional language voice note understanding (Kannada, Tamil, Hindi, English)
 * 2. Multimodal photo understanding and OCR extraction
 * 3. Strict anti-hallucination guardrails (missing hours/pricing remain undefined)
 * 4. Safe failure on invalid, silent, or low-quality inputs
 * 5. Spot-card synthesis conforming to CanonicalPlaceDocument (Domain 06)
 * 6. Live API execution with Google Gemini models
 */

import {
  extractVoiceNoteDetails,
  VoiceExtractionInput,
} from '../src/ai/services/voice-extraction-service.js';
import {
  extractPhotoDetails,
  PhotoExtractionInput,
} from '../src/ai/services/photo-extraction-service.js';
import {
  synthesizeSpotCard,
  SpotCardSynthesisInput,
} from '../src/ai/services/spot-card-synthesis-service.js';
import {
  CanonicalPlaceDocumentSchema,
  ExtractedPracticalDetailsSchema,
  VoicePhotoAssetDocumentSchema,
} from '../src/types/contracts/index.js';
import { getAIConfig } from '../src/ai/config/env.js';

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

async function runB2Tests() {
  console.log('================================================================');
  console.log('   Startup Buildathon 2026 — Task B2 AI Extraction Test Suite   ');
  console.log('   Regional Voice, Photo Understanding, & Anti-Hallucination    ');
  console.log('================================================================\n');

  const config = getAIConfig();
  console.log(`Environment: Model=${config.defaultModel}, HasKey=${config.hasApiKey}\n`);

  // -------------------------------------------------------------------------
  // Test Suite 1: Missing Information & Anti-Hallucination Guardrails
  // -------------------------------------------------------------------------
  console.log('--- [Test Suite 1] Anti-Hallucination & Missing Information Guardrails ---');

  // Input with NO opening hours and NO pricing
  const noHoursVoiceInput: VoiceExtractionInput = {
    assetId: 'asset_voice_no_hours_001',
    contributionId: 'contrib_malleshwaram_001',
    contributorId: 'usr_local_resident_1',
    transcriptText: 'This is a small legacy flower stall near the temple. The jasmine garlands are freshly strung by the grandmother sitting at the entrance.',
    languageHint: 'en',
  };

  const noHoursResult = await extractVoiceNoteDetails(noHoursVoiceInput);
  assert(noHoursResult.processingStatus === 'COMPLETED', 'Voice note without hours processed successfully');
  assert(noHoursResult.aiExtractionResult !== null, 'Extraction result exists');
  assert(
    noHoursResult.aiExtractionResult?.practicalDetails?.openingHoursMentioned === undefined,
    'Anti-hallucination: openingHoursMentioned is STRICTLY undefined when not spoken'
  );
  assert(
    noHoursResult.aiExtractionResult?.practicalDetails?.priceLevelNote === undefined,
    'Anti-hallucination: priceLevelNote is STRICTLY undefined when not spoken'
  );
  assert(
    noHoursResult.uncertaintyReport.isMissingOpeningHours === true,
    'Uncertainty report explicitly flags missing opening hours'
  );
  assert(
    noHoursResult.uncertaintyReport.isMissingPricing === true,
    'Uncertainty report explicitly flags missing pricing'
  );

  // -------------------------------------------------------------------------
  // Test Suite 2: Regional Language Voice Note Understanding
  // -------------------------------------------------------------------------
  console.log('\n--- [Test Suite 2] Regional Language Voice Note Understanding ---');

  // Kannada voice note input
  const kannadaVoiceInput: VoiceExtractionInput = {
    assetId: 'asset_voice_kannada_002',
    contributionId: 'contrib_malleshwaram_002',
    contributorId: 'usr_local_resident_2',
    transcriptText: 'ಇಲ್ಲಿ ಬಿಸಿ ಬಿಸಿ ಮಸಾಲೆ ದೋಸೆ ಮತ್ತು ಫಿಲ್ಟರ್ ಕಾಫಿ ಅದ್ಭುತವಾಗಿದೆ. ಬೆಳಗ್ಗೆ 7:00 ರಿಂದ 11:30 ರವರೆಗೆ ಮಾತ್ರ ಇರುತ್ತೆ. ನಗದು ಅಥವಾ ಯುಪಿಐ ಮಾತ್ರ ತಗೊಳೋದು, ಕಾರ್ಡ್ ಇಲ್ಲ. (Bisi bisi masala dose mathu filter coffee adbhutavagide. Belagge 7:00 rinda 11:30 ravarage mathra iruthe. Nagadu athava UPI mathra thagolodu, card illa.)',
    languageHint: 'kn-IN',
  };

  const kannadaResult = await extractVoiceNoteDetails(kannadaVoiceInput);
  assert(kannadaResult.processingStatus === 'COMPLETED', 'Kannada voice note processed');
  assert(
    kannadaResult.aiExtractionResult?.detectedLanguage === 'kn-IN',
    'Detected regional language tag kn-IN'
  );
  assert(
    Boolean(kannadaResult.aiExtractionResult?.practicalDetails?.cashOnlyWarning),
    'Correctly extracted cash/UPI only warning'
  );
  assert(
    kannadaResult.aiExtractionResult?.practicalDetails?.openingHoursMentioned !== undefined,
    'Extracted explicitly spoken opening hours (7:00 - 11:30)'
  );
  assert(
    kannadaResult.aiExtractionResult?.practicalDetails?.signatureDishesOrItems.length! > 0,
    'Extracted signature items (Masala Dosa, Filter Coffee)'
  );

  // Tamil voice note input
  const tamilVoiceInput: VoiceExtractionInput = {
    assetId: 'asset_voice_tamil_003',
    contributionId: 'contrib_triplicane_003',
    contributorId: 'usr_local_resident_3',
    transcriptText: 'இங்கே மல்லிப்பூ இட்லி மற்றும் வடகறி ரொம்ப பிரபலம். மாலை 5:00 மணிக்கு மேல் கூட்டம் அதிகம். டோக்கன் வாங்கிட்டு உள்ளே போங்க. (Inge mallipoo idly mathum vadakari romba pirabalam. Maalai 5:00 manikku mel koottam adhigam. Token vaangittu ulle ponga.)',
    languageHint: 'ta-IN',
  };

  const tamilResult = await extractVoiceNoteDetails(tamilVoiceInput);
  assert(tamilResult.processingStatus === 'COMPLETED', 'Tamil voice note processed');
  assert(
    tamilResult.aiExtractionResult?.detectedLanguage === 'ta-IN',
    'Detected regional language tag ta-IN'
  );
  assert(
    tamilResult.aiExtractionResult?.practicalDetails?.signatureDishesOrItems.some(item => 
      item.toLowerCase().includes('idli') || item.toLowerCase().includes('vadakari') || item.includes('இட்லி')
    ) || false,
    'Extracted Tamil signature culinary items'
  );

  // -------------------------------------------------------------------------
  // Test Suite 3: Multimodal Photo Understanding & OCR
  // -------------------------------------------------------------------------
  console.log('\n--- [Test Suite 3] Multimodal Photo & OCR Signage Understanding ---');

  const storefrontPhotoInput: PhotoExtractionInput = {
    assetId: 'asset_photo_storefront_004',
    contributionId: 'contrib_malleshwaram_004',
    assetType: 'STOREFRONT_PHOTO',
    imageDescriptionOrOcrHint: 'Storefront name board in Kannada: "ಶ್ರೀ ಸಾಗರ್ ಸೆಂಟ್ರಲ್ ಟಿಫಿನ್ ರೂಮ್ (ಸಿ.ಟಿ.ಆರ್)" and English: "Central Tiffin Room (CTR) Since 1924". Small brass board: "Timings: 7:30 AM - 12:30 PM & 4:00 PM - 9:00 PM. Cash/UPI Accepted."',
  };

  const photoResult = await extractPhotoDetails(storefrontPhotoInput);
  assert(photoResult.processingStatus === 'COMPLETED', 'Storefront photo processed');
  assert(photoResult.aiExtractionResult !== null, 'Photo extraction result exists');
  assert(
    (photoResult.aiExtractionResult?.ocrDetectedText?.length || 0) > 0,
    'OCR detected text extracted from signboard'
  );
  assert(
    photoResult.aiExtractionResult?.practicalDetails?.openingHoursMentioned !== undefined,
    'Extracted opening hours printed on signboard'
  );
  assert(
    photoResult.visualAuthenticityIndicators.hasGenerationalOrTraditionalSignage === true,
    'Identified generational / heritage signboard'
  );

  // -------------------------------------------------------------------------
  // Test Suite 4: Invalid, Corrupted, and Low-Quality Inputs
  // -------------------------------------------------------------------------
  console.log('\n--- [Test Suite 4] Invalid, Ambiguous, and Low-Quality Inputs ---');

  // Empty voice input
  const emptyVoiceInput: VoiceExtractionInput = {
    assetId: 'asset_voice_empty_005',
    contributionId: 'contrib_invalid_005',
    contributorId: 'usr_unknown',
    transcriptText: '   ',
  };

  const emptyVoiceResult = await extractVoiceNoteDetails(emptyVoiceInput);
  assert(emptyVoiceResult.processingStatus === 'FAILED', 'Empty voice input safely marked as FAILED');
  assert(emptyVoiceResult.errorMessage !== undefined, 'Descriptive error message returned for empty input');

  // Short unintelligible noise input
  const noiseVoiceInput: VoiceExtractionInput = {
    assetId: 'asset_voice_noise_006',
    contributionId: 'contrib_invalid_006',
    contributorId: 'usr_unknown',
    transcriptText: 'shhh',
  };

  const noiseVoiceResult = await extractVoiceNoteDetails(noiseVoiceInput);
  assert(noiseVoiceResult.processingStatus === 'FAILED', 'Noise voice input safely marked as FAILED');

  // Empty photo input
  const emptyPhotoInput: PhotoExtractionInput = {
    assetId: 'asset_photo_empty_007',
    contributionId: 'contrib_invalid_007',
    assetType: 'STREET_PHOTO',
  };

  const emptyPhotoResult = await extractPhotoDetails(emptyPhotoInput);
  assert(emptyPhotoResult.processingStatus === 'FAILED', 'Empty photo input safely marked as FAILED');
  assert(emptyPhotoResult.errorMessage !== undefined, 'Descriptive error message returned for empty photo');

  // -------------------------------------------------------------------------
  // Test Suite 5: Spot-Card Synthesis & Contributor Attribution (Domain 06)
  // -------------------------------------------------------------------------
  console.log('\n--- [Test Suite 5] Spot-Card Synthesis & Contributor Attribution ---');

  const synthesisInput: SpotCardSynthesisInput = {
    contributionId: 'contrib_ctr_981273',
    submission: {
      mapsLink: 'https://maps.google.com/?cid=1029384756',
      infoParagraph: 'My grandfather used to bring me here in the 1970s. The butter masala dosa has remained identical for fifty years. Crispy outside with soft fluffy inside.',
      photoUrls: ['https://storage.googleapis.com/spots/ctr_front.jpg'],
      audioNoteUrl: 'https://storage.googleapis.com/spots/ctr_voice.m4a',
      contributorId: 'usr_blr_782914',
    },
    contributorProfile: {
      userId: 'usr_blr_782914',
      displayName: 'Ramesh K.',
      badgeTitle: 'Heritage Sage',
      isVerifiedResident: true,
    },
    voiceExtractions: [kannadaResult.aiExtractionResult!],
    photoExtractions: [photoResult.aiExtractionResult!],
  };

  const spotCard = synthesizeSpotCard(synthesisInput);

  // Validate the generated document against Developer A's canonical Zod schema
  const validatedSpotCard = CanonicalPlaceDocumentSchema.parse(spotCard);
  assert(validatedSpotCard.id === 'spot_ctr_981273', 'Canonical Place ID generated correctly');
  assert(
    validatedSpotCard.contributorAttribution?.userId === 'usr_blr_782914',
    'Contributor attribution preserved'
  );
  assert(
    validatedSpotCard.contributorAttribution?.displayName === 'Ramesh K.',
    'Contributor display name preserved'
  );
  assert(
    validatedSpotCard.contributorAttribution?.isVerifiedResident === true,
    'Contributor verified resident status preserved'
  );
  assert(
    validatedSpotCard.openHours !== 'Check Maps for hours',
    'Open hours populated from supported media extraction'
  );
  assert(
    validatedSpotCard.isVerified === false,
    'Spot card draft marked isVerified: false (pending Maps grounding)'
  );
  assert(
    validatedSpotCard.infoParagraph.includes('[Contributor Claim:'),
    'Synthesized narrative clearly flags contributor claims'
  );

  // Test spot card synthesis when NO hours were extracted
  const noHoursSynthesisInput: SpotCardSynthesisInput = {
    contributionId: 'contrib_hidden_stall_008',
    submission: {
      mapsLink: 'https://maps.google.com/?cid=998877',
      infoParagraph: 'A tiny chai and bun maska spot in the alley.',
      photoUrls: [],
      contributorId: 'usr_blr_123',
    },
    voiceExtractions: [noHoursResult.aiExtractionResult!],
  };

  const noHoursSpotCard = synthesizeSpotCard(noHoursSynthesisInput);
  assert(
    noHoursSpotCard.openHours === 'Check Maps for hours',
    'Anti-hallucination: spotCard defaults openHours to "Check Maps for hours" when unstated'
  );

  // -------------------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------------------
  console.log('\n================================================================');
  console.log(`B2 Test Suite Results: ${passed} / ${total} tests passed.`);
  console.log('================================================================\n');
}

runB2Tests().catch((err) => {
  console.error('Fatal error in B2 tests:', err);
  process.exit(1);
});
