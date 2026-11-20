/**
 * Unit Tests for AI Schemas, JSON Cleaners, and Registry Validation
 */

import {
  AuthenticityAssessmentSchema,
  VoicePhotoExtractionSchema,
  GroupPreferenceBlendSchema,
  FoundationTestSchema,
} from '../src/ai/schemas/types.js';
import {
  cleanJsonResponseText,
  validateStructuredOutput,
  zodToJsonSchema,
} from '../src/ai/utils/validator.js';
import {
  MODEL_REGISTRY,
  resolveModelDefinition,
} from '../src/ai/config/models.js';
import { AISchemaValidationError } from '../src/ai/errors/ai-errors.js';

let passedTests = 0;
let totalTests = 0;

function assert(condition: boolean, testName: string) {
  totalTests++;
  if (!condition) {
    console.error(`❌ FAILED: ${testName}`);
    process.exitCode = 1;
  } else {
    console.log(`✅ PASSED: ${testName}`);
    passedTests++;
  }
}

console.log('--- [Test Suite 1] Model Registry & Alias Resolution ---');

const flashDef = resolveModelDefinition('Gemini 3.8 Flash');
assert(flashDef !== undefined, 'Resolve alias "Gemini 3.8 Flash" to real definition');
assert(flashDef?.apiModelId === 'gemini-3.8-flash', 'Gemini 3.8 Flash maps to verified API ID gemini-3.8-flash');

const embedDef = resolveModelDefinition('Gemini Embedding 2');
assert(embedDef !== undefined, 'Resolve alias "Gemini Embedding 2"');
assert(embedDef?.apiModelId === 'gemini-embedding-2', 'Gemini Embedding 2 maps to verified API ID gemini-embedding-2');

const liveDef = resolveModelDefinition('Gemini 3.8 Live');
assert(liveDef !== undefined, 'Resolve alias "Gemini 3.8 Live"');
assert(liveDef?.apiModelId === 'gemini-3.8-live', 'Gemini 3.8 Live maps to verified model ID gemini-3.8-live');
assert(liveDef?.testStatus === 'UNTESTED_ENDPOINT', 'Gemini 3.8 Live marked as UNTESTED_ENDPOINT');

const nanoDef = resolveModelDefinition('Gemini Nano');
assert(nanoDef !== undefined, 'Resolve alias "Gemini Nano"');
assert(nanoDef?.availability === 'ON_DEVICE_EDGE', 'Gemini Nano is designated as ON_DEVICE_EDGE');
assert(nanoDef?.testStatus === 'DOCUMENTED_EDGE_SPEC', 'Gemini Nano marked as DOCUMENTED_EDGE_SPEC');

const gemmaDef = resolveModelDefinition('Gemma 4 E2B');
assert(gemmaDef !== undefined, 'Resolve alias "Gemma 4 E2B"');
assert(gemmaDef?.apiModelId === 'gemma-4-e2b', 'Gemma 4 E2B maps to verified artifact ID gemma-4-e2b');
assert(gemmaDef?.availability === 'LOCAL_RUNTIME', 'Gemma 4 E2B is designated as LOCAL_RUNTIME');
assert(gemmaDef?.testStatus === 'DOCUMENTED_EDGE_SPEC', 'Gemma 4 E2B marked as DOCUMENTED_EDGE_SPEC');

console.log('\n--- [Test Suite 2] JSON Fence Stripping & Cleaning ---');

const markdownJson = `\`\`\`json
{
  "serviceStatus": "HEALTHY",
  "activeModelId": "gemini-2.5-flash"
}
\`\`\``;

const cleaned = cleanJsonResponseText(markdownJson);
assert(!cleaned.startsWith('```'), 'Markdown code fences stripped');
assert(cleaned.includes('"serviceStatus": "HEALTHY"'), 'JSON content preserved intact');

console.log('\n--- [Test Suite 3] Schema Validation & Zod Parsing ---');

const validAssessment = {
  placeName: 'MTR 1924 (Mavalli Tiffin Room)',
  authenticityScore: 94,
  touristTrapLikelihood: 'LOW',
  signals: {
    isMassMarketCommercial: false,
    hasAggressiveTouting: false,
    inflatedPricingDetected: false,
    traditionalCraftOrRecipe: true,
  },
  localSentiment: {
    localResidentRatioEstimate: 0.85,
    residentPerceptionSummary: 'Cherished generational institution serving authentic Rava Idli since 1924.',
  },
  recommendedTiming: 'Weekday mornings between 7:30 AM and 9:00 AM to avoid weekend queues.',
  evidenceSummary: 'Generational recipes, zero commission guides, strong resident loyalty spanning decades.',
};

const parsedAssessment = validateStructuredOutput(
  JSON.stringify(validAssessment),
  AuthenticityAssessmentSchema
);
assert(parsedAssessment.authenticityScore === 94, 'Valid Authenticity Assessment parsed correctly');
assert(parsedAssessment.touristTrapLikelihood === 'LOW', 'Enum validated correctly');

// Test validation failure
let caughtError = false;
try {
  const invalidAssessment = { ...validAssessment, authenticityScore: 150 }; // Exceeds 100 max
  validateStructuredOutput(JSON.stringify(invalidAssessment), AuthenticityAssessmentSchema);
} catch (err: any) {
  caughtError = err instanceof AISchemaValidationError;
}
assert(caughtError, 'Out-of-range score properly triggers AISchemaValidationError');

console.log('\n--- [Test Suite 4] Voice & Photo Practical Extraction Schema ---');

const validExtraction = {
  detectedLanguage: 'kn-IN',
  originalTranscript: 'ഇവിടെ ബെല്ല സാമ്പാർ തുമ്പാ ചെന്നാഗിതെ, കാഷ് മാത്ര തഗൊളോದು (Bellada sambar thumba chennagide, cash mathra thagolodu)',
  englishTranslation: 'The jaggery sambar here is very good, they only accept cash payments.',
  practicalDetails: {
    openingHoursMentioned: '6:30 AM - 11:30 AM',
    signatureDishesOrItems: ['Masala Dosa', 'Filter Coffee', 'Jaggery Sambar'],
    priceLevelNote: 'Budget friendly (approx ₹60-₹120 per person)',
    cashOnlyWarning: true,
    insiderTips: ['Reach before 8 AM for hot batch', 'Token counter is on the left'],
  },
  authenticitySignals: ['Single family owned', 'No branches', 'Locals queue up daily'],
  confidenceScore: 0.96,
};

const parsedExtraction = validateStructuredOutput(
  JSON.stringify(validExtraction),
  VoicePhotoExtractionSchema
);
assert(parsedExtraction.practicalDetails.cashOnlyWarning === true, 'Extracted practical warning: cashOnly');
assert(parsedExtraction.detectedLanguage === 'kn-IN', 'Detected regional language tag');

console.log('\n--- [Test Suite 5] JSON Schema Generation ---');

const jsonSchema = zodToJsonSchema(FoundationTestSchema);
assert(jsonSchema.type === 'OBJECT', 'Top level is OBJECT');
assert(typeof jsonSchema.properties === 'object', 'Properties mapped');
const props = jsonSchema.properties as Record<string, any>;
assert(props.serviceStatus?.type === 'STRING', 'Enum mapped to STRING type');
assert(props.verifiedCapabilities?.type === 'OBJECT', 'Nested object correctly mapped');

console.log(`\n========================================`);
console.log(`Test Results: ${passedTests}/${totalTests} tests passed.`);
console.log(`========================================`);
