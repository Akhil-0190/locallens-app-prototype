/**
 * Foundation Verification Script
 * Validates model registry, credentials, and executes a small tested model call.
 */

import { testModelFoundation } from '../src/ai/services/ai-service.js';
import { getAIConfig } from '../src/ai/config/env.js';
import { MODEL_REGISTRY, resolveModelDefinition } from '../src/ai/config/models.js';
import { FoundationTestSchema } from '../src/ai/schemas/types.js';
import { validateStructuredOutput } from '../src/ai/utils/validator.js';

async function runFoundationVerification() {
  console.log('================================================================');
  console.log('   Startup Buildathon 2026 — AI Model Foundation Verification   ');
  console.log('   Developer B: Model Integration & Structured Schemas          ');
  console.log('================================================================\n');

  // 1. Environment & Credentials Check
  const config = getAIConfig();
  console.log('1. CREDENTIALS & ENVIRONMENT CHECK:');
  console.log(`   - Default Model:       ${config.defaultModel}`);
  console.log(`   - Fallback Model:      ${config.fallbackModel}`);
  console.log(`   - Embedding Model:     ${config.embeddingModel}`);
  console.log(`   - Max Retries:         ${config.maxRetries}`);
  console.log(`   - Timeout:             ${config.requestTimeoutMs}ms`);
  console.log(`   - GEMINI_API_KEY:      ${config.hasApiKey ? 'PRESENT (Masked: ' + config.apiKey.slice(0, 4) + '...' + config.apiKey.slice(-4) + ')' : 'NOT DETECTED'}`);

  console.log('\n2. SUBMITTED LABELS VS VERIFIED CANONICAL API IDS:');
  const labelsToVerify = [
    { label: 'Gemini 3.8 Flash', key: 'GEMINI_FLASH_PRIMARY' },
    { label: 'Gemini Embedding 2', key: 'GEMINI_EMBEDDING_PRIMARY' },
    { label: 'Gemini 3.8 Live', key: 'GEMINI_LIVE_MULTIMODAL' },
    { label: 'Gemini Nano', key: 'GEMINI_NANO_ONDEVICE' },
    { label: 'Gemma 4 E2B', key: 'GEMMA_LOCAL_INFERENCE' },
  ];

  for (const item of labelsToVerify) {
    const def = resolveModelDefinition(item.label);
    if (def) {
      console.log(`   ✓ [${item.label}] -> API ID: "${def.apiModelId}" (${def.availability})`);
      console.log(`     Display: ${def.displayName}`);
      console.log(`     Primary: ${def.primaryUse}`);
      if (def.quotas.freeTier) {
        console.log(`     Quotas:  ${def.quotas.freeTier.rpm} RPM | ${def.quotas.freeTier.rpd} RPD`);
      }
    } else {
      console.log(`   ✗ [${item.label}] -> UNRESOLVED`);
    }
  }

  console.log('\n3. MODEL EXECUTION TEST:');
  if (config.hasApiKey) {
    console.log('   Executing LIVE authorized model call to Google Gemini API...');
    const startTime = Date.now();
    try {
      const result = await testModelFoundation('Buildathon 2026 Developer B Authorized Test');
      const latency = Date.now() - startTime;
      console.log(`   ✅ LIVE MODEL CALL SUCCEEDED! (${latency}ms)`);
      console.log(`   - Active Model Used:   ${result.modelUsed}`);
      console.log(`   - Fallback Triggered:  ${result.fallbackTriggered}`);
      console.log(`   - Service Status:      ${result.data.serviceStatus}`);
      console.log(`   - Test Greeting:       ${result.data.testGreeting}`);
      console.log(`   - Capabilities:        `, JSON.stringify(result.data.verifiedCapabilities, null, 2));
    } catch (err: any) {
      console.error(`   ❌ LIVE MODEL CALL FAILED:`, err.message);
      if (err.code) console.error(`      Error Code: ${err.code}`);
      if (err.statusCode) console.error(`      Status: ${err.statusCode}`);
      process.exitCode = 1;
    }
  } else {
    console.log('   ⚠️  GEMINI_API_KEY is not set in environment or .env.');
    console.log('   Executing offline schema verification pipeline...');

    // Simulate structured payload to verify the exact parser and validator
    const mockPayload = {
      serviceStatus: 'HEALTHY',
      activeModelId: config.defaultModel,
      testGreeting: 'Developer B AI Foundation initialized. Ready for Buildathon 2026.',
      supportedModalities: ['text', 'audio', 'image'],
      timestampIso: new Date().toISOString(),
      verifiedCapabilities: {
        structuredJson: true,
        regionalExtractionReady: true,
        fallbackConfigured: true,
      },
    };

    try {
      const validated = validateStructuredOutput(JSON.stringify(mockPayload), FoundationTestSchema);
      console.log('   ✅ Offline schema validation and parser pipeline verified successfully.');
      console.log(`   - Mock Model ID:      ${validated.activeModelId}`);
      console.log(`   - Status:             ${validated.serviceStatus}`);
    } catch (err: any) {
      console.error('   ❌ Offline pipeline failed:', err.message);
      process.exitCode = 1;
    }

    console.log('\n   To perform an authorized live call:');
    console.log('   1. Copy functions/.env.example to functions/.env');
    console.log('   2. Add your Google AI Studio GEMINI_API_KEY');
    console.log('   3. Run: npm --prefix functions run test:ai');
  }

  console.log('\n================================================================');
  console.log('   Verification Complete                                        ');
  console.log('================================================================\n');
}

runFoundationVerification().catch((err) => {
  console.error('Fatal verification error:', err);
  process.exit(1);
});
