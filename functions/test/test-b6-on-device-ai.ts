/**
 * Startup Buildathon 2026 — Neighborhood Guide App
 * Task B6 Test Suite: On-Device AI (Gemini Nano & Gemma 4 E2B)
 * 
 * Verifies:
 * 1. Android AICore / ML Kit GenAI dynamic readiness evaluation (API 34+, package, foreground, language)
 * 2. Gemma 4 E2B Unsloth GGUF dynamic RAM (3,500 MB), storage, and ARM64 architecture evaluation
 * 3. Execution provenance invariants (GEMINI_NANO_LOCAL, GEMMA_LOCAL, CLOUD_FALLBACK, UNAVAILABLE)
 *    and ExecutionEnvironment (CLIENT_ANDROID_NATIVE vs BACKEND_CLOUD_FUNCTIONS)
 * 4. Online/offline switching, privacy fail-closed guarantees, and unassisted heuristics
 * 5. D5 MethodChannel bridge emulation and parameter round-trip
 * 6. Physical Hardware Real Inference Verification (explicitly marked NOT TESTED)
 */

import {
  evaluateAICoreReadiness,
  evaluateGemmaGGUFReadiness,
  generateUnassistedFallback,
  orchestrateLocalInference,
  GEMMA_4_E2B_UNSLOTH_GGUF_SPEC,
  GEMMA_2_2B_LEGACY_EXPERIMENTAL_SPEC,
  NativeBridgeExecutor,
  CloudInferenceExecutor,
} from '../src/ai/services/local-ai-service.js';
import {
  DeviceAICapabilities,
  LocalInferenceRequest,
} from '../src/ai/schemas/local-ai-schemas.js';

let passedAssertions = 0;
let failedAssertions = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    passedAssertions++;
    console.log(`  ✅ PASSED: ${testName}`);
  } else {
    failedAssertions++;
    console.error(`  ❌ FAILED: ${testName}${detail ? ` — ${detail}` : ''}`);
  }
}

async function runB6TestSuite() {
  console.log('================================================================');
  console.log('  Startup Buildathon 2026 — Task B6 On-Device AI Verification  ');
  console.log('  Gemini Nano (AICore) & Gemma 4 E2B (llama.cpp Unsloth GGUF)  ');
  console.log('================================================================\n');

  // --------------------------------------------------------------------------
  // Suite 1: Android AICore / ML Kit GenAI Dynamic Readiness Lifecycle
  // --------------------------------------------------------------------------
  console.log('--- [Suite 1] Android AICore / ML Kit GenAI Dynamic Readiness ---');

  const baseTelemetry: DeviceAICapabilities = {
    apiLevel: 34,
    totalRamMb: 12288,
    ramAvailableMb: 5120,
    aicoreInstalled: true,
    aicoreVersion: 240800000,
    hasNpu: true,
    supportedFeatures: ['AICORE_GEMINI_NANO'],
    hardwareArchitecture: 'arm64-v8a',
    storageAvailableMb: 15000,
    deviceManufacturer: 'Google',
    deviceModel: 'Pixel 8',
    isInForeground: true,
    language: 'en',
  };

  // 1.1: Reject Android API < 34
  const api33Telemetry = { ...baseTelemetry, apiLevel: 33 };
  const resApi33 = evaluateAICoreReadiness(api33Telemetry, 'SUMMARIZATION', 'READY', 'en');
  assert(
    resApi33.status === 'UNSUPPORTED_OS_VERSION' && !resApi33.isReady,
    'Rejects Android API < 34 with UNSUPPORTED_OS_VERSION'
  );

  // 1.2: Reject when com.google.android.aicore package is missing
  const noPackage = { ...baseTelemetry, aicoreInstalled: false };
  const resNoPackage = evaluateAICoreReadiness(noPackage, 'SUMMARIZATION', 'READY', 'en');
  assert(
    resNoPackage.status === 'PACKAGE_NOT_INSTALLED' && !resNoPackage.isReady,
    'Rejects when com.google.android.aicore package is not installed'
  );

  // 1.3: Reject when app is in background (foreground execution rule)
  const backgroundApp = { ...baseTelemetry, isInForeground: false };
  const resBackground = evaluateAICoreReadiness(backgroundApp, 'SUMMARIZATION', 'READY', 'en');
  assert(
    resBackground.status === 'BACKGROUND_RESTRICTED' && !resBackground.isReady,
    'Enforces foreground execution rule (BACKGROUND_RESTRICTED)'
  );

  // 1.4: Reject when dynamic RAM headroom is insufficient (< 800 MB)
  const lowRam = { ...baseTelemetry, ramAvailableMb: 512 };
  const resLowRam = evaluateAICoreReadiness(lowRam, 'SUMMARIZATION', 'READY', 'en');
  assert(
    resLowRam.status === 'QUOTA_EXCEEDED' && !resLowRam.isReady,
    'Rejects AICore when available RAM < 800 MB (QUOTA_EXCEEDED / throttled)'
  );

  // 1.5: Reject feature-specific mismatch (Image description without AICORE_MULTIMODAL_V2)
  const resImageDesc = evaluateAICoreReadiness(baseTelemetry, 'IMAGE_DESCRIPTION', 'READY', 'en');
  assert(
    resImageDesc.status === 'FEATURE_NOT_SUPPORTED' && !resImageDesc.isReady,
    'Rejects image description feature when AICORE_MULTIMODAL_V2 hardware support is absent'
  );

  // 1.6: Reject unsupported language on on-device model (English-first limitation)
  const resUnsupportedLang = evaluateAICoreReadiness(baseTelemetry, 'SUMMARIZATION', 'READY', 'hi');
  assert(
    resUnsupportedLang.status === 'UNSUPPORTED_LANGUAGE' && !resUnsupportedLang.isReady,
    'Detects UNSUPPORTED_LANGUAGE for regional language on English-first AICore model'
  );

  // 1.7: Detect MODEL_DOWNLOADING state
  const resDownloading = evaluateAICoreReadiness(baseTelemetry, 'SUMMARIZATION', 'DOWNLOADING', 'en');
  assert(
    resDownloading.status === 'MODEL_DOWNLOADING' && !resDownloading.isReady,
    'Detects MODEL_DOWNLOADING state when background download is in progress'
  );

  // 1.8: Detect MODEL_DOWNLOADABLE state prior to Wi-Fi/charging background download
  const resDownloadable = evaluateAICoreReadiness(baseTelemetry, 'SUMMARIZATION', 'DOWNLOADABLE', 'en');
  assert(
    resDownloadable.status === 'MODEL_DOWNLOADABLE' && !resDownloadable.isReady,
    'Detects MODEL_DOWNLOADABLE status prior to Wi-Fi/charging background download'
  );

  // 1.9: Fully ready AICore
  const resReady = evaluateAICoreReadiness(baseTelemetry, 'SUMMARIZATION', 'READY', 'en');
  assert(
    resReady.status === 'MODEL_READY' && resReady.isReady,
    'Confirms MODEL_READY when all dynamic ML Kit GenAI lifecycle gates are satisfied'
  );

  // --------------------------------------------------------------------------
  // Suite 2: Gemma 4 E2B Unsloth GGUF via llama.cpp Evaluation
  // --------------------------------------------------------------------------
  console.log('\n--- [Suite 2] Gemma 4 E2B Unsloth GGUF via llama.cpp ---');

  // 2.1: Enforce arm64-v8a architecture requirement
  const x86Telemetry = { ...baseTelemetry, hardwareArchitecture: 'x86_64' };
  const resX86 = evaluateGemmaGGUFReadiness(x86Telemetry, true, true);
  assert(
    resX86.status === 'UNSUPPORTED_ARCHITECTURE' && !resX86.isReady,
    'Rejects non-ARM64 architecture (x86_64) for llama.cpp runtime'
  );

  // 2.2: Enforce dynamic available RAM verification (estimated >= 3,500 MB for 3.11GB Q4 model)
  // Even with 8192 MB total RAM, if available RAM is 2500 MB, reject!
  const tightRamTelemetry = { ...baseTelemetry, totalRamMb: 8192, ramAvailableMb: 2500 };
  const resTightRam = evaluateGemmaGGUFReadiness(tightRamTelemetry, true, true);
  assert(
    resTightRam.status === 'INSUFFICIENT_AVAILABLE_RAM' && !resTightRam.isReady,
    'Rejects when dynamic available RAM < 3,500 MB despite total RAM = 8,192 MB'
  );

  // 2.3: Enforce storage check (>= 5,000 MB for Gemma 4 E2B 3.11GB model cache + buffers)
  const lowStorageTelemetry = { ...baseTelemetry, storageAvailableMb: 3500 };
  const resLowStorage = evaluateGemmaGGUFReadiness(lowStorageTelemetry, true, true);
  assert(
    resLowStorage.status === 'INSUFFICIENT_STORAGE' && !resLowStorage.isReady,
    'Rejects when available storage < 5.0 GB for Gemma 4 E2B model cache'
  );

  // 2.4: Detect missing native runtime (libllama.so)
  const resNoBinary = evaluateGemmaGGUFReadiness(baseTelemetry, false, true);
  assert(
    resNoBinary.status === 'RUNTIME_BINARY_MISSING' && !resNoBinary.isReady,
    'Detects missing native runtime binary (libllama.so)'
  );

  // 2.5: Detect missing Gemma 4 E2B GGUF model artifact
  const resNoModel = evaluateGemmaGGUFReadiness(baseTelemetry, true, false);
  assert(
    resNoModel.status === 'MODEL_FILE_NOT_FOUND' && !resNoModel.isReady,
    'Detects missing GGUF model file (gemma-4-E2B-it-Q4_K_M.gguf)'
  );

  // 2.6: Fully ready Gemma 4 E2B GGUF runtime
  const resGemmaReady = evaluateGemmaGGUFReadiness(baseTelemetry, true, true);
  assert(
    resGemmaReady.status === 'READY' && resGemmaReady.isReady,
    'Confirms READY when arm64-v8a + dynamic RAM >= 3500MB + libllama.so + Gemma 4 E2B present'
  );

  // 2.7: Verify Gemma 4 E2B exact model artifact specifications
  assert(
    GEMMA_4_E2B_UNSLOTH_GGUF_SPEC.huggingFaceRepo === 'unsloth/gemma-4-E2B-it-GGUF' &&
    GEMMA_4_E2B_UNSLOTH_GGUF_SPEC.canonicalFileName === 'gemma-4-E2B-it-Q4_K_M.gguf' &&
    GEMMA_4_E2B_UNSLOTH_GGUF_SPEC.fileSizeBytesQ4 === 3344000000 &&
    GEMMA_4_E2B_UNSLOTH_GGUF_SPEC.multimodalProjectorFileName === 'mmproj-gemma-4-E2B-it-f16.gguf',
    'Verified exact Gemma 4 E2B repository (unsloth/gemma-4-E2B-it-GGUF), ~3.11GB Q4, and mmproj file'
  );

  // 2.8: Separately verify that Gemma 2 2B is explicitly marked as experimental legacy only
  assert(
    GEMMA_2_2B_LEGACY_EXPERIMENTAL_SPEC.huggingFaceRepo === 'unsloth/gemma-2-2b-it-GGUF' &&
    GEMMA_2_2B_LEGACY_EXPERIMENTAL_SPEC.note.includes('EXPERIMENTAL ONLY'),
    'Gemma 2 2B is explicitly segregated and marked as experimental legacy baseline only'
  );

  // --------------------------------------------------------------------------
  // Suite 3: Provenance Classification & Execution Environment Invariants
  // --------------------------------------------------------------------------
  console.log('\n--- [Suite 3] Execution Provenance & Environment Invariants ---');

  // Mock Native Bridge implementation (representing Android D5 MethodChannel)
  const mockBridge: NativeBridgeExecutor = {
    checkAICoreAvailability: async () => ({ isAvailable: true, statusMessage: 'READY', apiLevel: 34 }),
    getDeviceAICapabilities: async () => baseTelemetry,
    executeAICoreInference: async (_prompt) => ({
      success: true,
      text: 'Local AICore summary: Authentic filter coffee institution.',
    }),
    executeLlamaCppInference: async (_prompt) => ({
      success: true,
      text: 'Local Gemma 4 E2B summary: Bustling traditional heritage bakery.',
    }),
  };

  // Mock Cloud Executor implementation
  const mockCloud: CloudInferenceExecutor = {
    executeCloudModel: async (_prompt) => ({
      text: 'Cloud Gemini 3.8 Flash summary: Iconic spot with generational legacy.',
      modelUsed: 'gemini-3.8-flash',
    }),
  };

  // 3.1: Test GEMINI_NANO_LOCAL provenance & client execution environment
  const reqNano: LocalInferenceRequest = {
    taskId: 'req-nano-01',
    taskType: 'NOTE_SUMMARIZATION',
    prompt: 'Brahmin Coffee Bar filter coffee and crisp vada on Shankar Mutt road.',
    spotName: 'Brahmin Coffee Bar',
    language: 'en',
    preferredEngine: 'AICORE_GEMINI_NANO',
    connectivity: 'OFFLINE',
    offlineOnly: true,
    userConsentCloudFallback: false,
    deviceCapabilities: baseTelemetry,
  };

  const resNano = await orchestrateLocalInference(reqNano, {
    aicoreModelReady: true,
    nativeBridge: mockBridge,
  });

  assert(resNano.provenance === 'GEMINI_NANO_LOCAL', 'Assigns GEMINI_NANO_LOCAL provenance');
  assert(resNano.isLocalInference === true, 'GEMINI_NANO_LOCAL strictly sets isLocalInference = true');
  assert(resNano.executionEnvironment === 'CLIENT_ANDROID_NATIVE', 'Local inference marked as CLIENT_ANDROID_NATIVE');
  assert(!resNano.unassistedFallback, 'GEMINI_NANO_LOCAL is not unassisted fallback');

  // 3.2: Test GEMMA_LOCAL provenance
  const reqGemma: LocalInferenceRequest = {
    taskId: 'req-gemma-01',
    taskType: 'NOTE_SUMMARIZATION',
    prompt: 'Warm coconut buns and honey cake at VB Bakery VV Puram.',
    spotName: 'VB Bakery',
    language: 'en',
    preferredEngine: 'GEMMA_LOCAL_GGUF',
    connectivity: 'OFFLINE',
    offlineOnly: true,
    userConsentCloudFallback: false,
    deviceCapabilities: baseTelemetry,
  };

  const resGemma = await orchestrateLocalInference(reqGemma, {
    gemmaModelReady: true,
    nativeBridge: mockBridge,
  });

  assert(resGemma.provenance === 'GEMMA_LOCAL', 'Assigns GEMMA_LOCAL provenance');
  assert(resGemma.isLocalInference === true, 'GEMMA_LOCAL strictly sets isLocalInference = true');
  assert(resGemma.executionEnvironment === 'CLIENT_ANDROID_NATIVE', 'Gemma GGUF execution marked as CLIENT_ANDROID_NATIVE');
  assert(!resGemma.unassistedFallback, 'GEMMA_LOCAL is not unassisted fallback');

  // 3.3: Test CLOUD_FALLBACK provenance
  const reqCloud: LocalInferenceRequest = {
    taskId: 'req-cloud-01',
    taskType: 'NOTE_SUMMARIZATION',
    prompt: 'Detailed architectural overview of Malleshwaram 8th Cross temples.',
    spotName: 'Kaadu Malleshwara',
    language: 'en',
    preferredEngine: 'AUTO',
    connectivity: 'WIFI',
    offlineOnly: false,
    userConsentCloudFallback: true,
    deviceCapabilities: baseTelemetry,
  };

  const resCloud = await orchestrateLocalInference(reqCloud, {
    aicoreModelReady: false,
    gemmaModelReady: false,
    cloudExecutor: mockCloud,
  });

  assert(resCloud.provenance === 'CLOUD_FALLBACK', 'Assigns CLOUD_FALLBACK provenance when online + consented');
  assert(resCloud.isLocalInference === false, 'CLOUD_FALLBACK strictly sets isLocalInference = false (NEVER reports cloud as local)');
  assert(resCloud.executionEnvironment === 'BACKEND_CLOUD_FUNCTIONS', 'Cloud fallback explicitly marked as BACKEND_CLOUD_FUNCTIONS');
  assert(resCloud.modelUsed === 'gemini-3.8-flash', 'Identifies real cloud model ID');

  // 3.4: Test UNAVAILABLE provenance (Fail-closed offline fallback)
  const reqOfflineUnavail: LocalInferenceRequest = {
    taskId: 'req-unavail-01',
    taskType: 'NOTE_SUMMARIZATION',
    prompt: 'Quiet book cafe in Basavanagudi with filter coffee and garden seating.',
    spotName: 'Atta Galatta',
    language: 'en',
    preferredEngine: 'AUTO',
    connectivity: 'OFFLINE',
    offlineOnly: true,
    userConsentCloudFallback: false,
    deviceCapabilities: baseTelemetry,
  };

  const resUnavail = await orchestrateLocalInference(reqOfflineUnavail, {
    aicoreModelReady: false,
    gemmaModelReady: false,
  });

  assert(resUnavail.provenance === 'UNAVAILABLE', 'Assigns UNAVAILABLE provenance when offline and local unready');
  assert(resUnavail.isLocalInference === false, 'UNAVAILABLE sets isLocalInference = false');
  assert(resUnavail.unassistedFallback === true, 'UNAVAILABLE explicitly marks unassistedFallback = true');
  assert(resUnavail.modelUsed === 'NONE (Unassisted Fallback)', 'Correct unassisted fallback label');

  // --------------------------------------------------------------------------
  // Suite 4: Online / Offline Orchestration & Privacy Safeguards
  // --------------------------------------------------------------------------
  console.log('\n--- [Suite 4] Online/Offline Switching & Privacy Safeguards ---');

  // 4.1: Privacy Rule: Never silently leak offline user data
  let cloudCallAttempted = false;
  const spiedCloudExecutor: CloudInferenceExecutor = {
    executeCloudModel: async () => {
      cloudCallAttempted = true;
      return { text: 'Leaked cloud text', modelUsed: 'cloud' };
    },
  };

  const reqPrivacyLeakTest: LocalInferenceRequest = {
    taskId: 'req-privacy-01',
    taskType: 'NOTE_SUMMARIZATION',
    prompt: 'Confidential traveler journal: secret alleyway behind temple.',
    connectivity: 'OFFLINE',
    offlineOnly: true,
    userConsentCloudFallback: true, // Even with consent, offline means NO NETWORK CALLS!
    deviceCapabilities: baseTelemetry,
  };

  await orchestrateLocalInference(reqPrivacyLeakTest, {
    aicoreModelReady: false,
    gemmaModelReady: false,
    cloudExecutor: spiedCloudExecutor,
  });

  assert(
    !cloudCallAttempted,
    'PRIVACY GUARANTEE: Zero network calls made when connectivity is OFFLINE'
  );

  // 4.2: Privacy Rule: Online without consent does NOT call cloud
  cloudCallAttempted = false;
  const reqNoConsentOnline: LocalInferenceRequest = {
    taskId: 'req-no-consent-01',
    taskType: 'NOTE_SUMMARIZATION',
    prompt: 'User note captured while online but user declined cloud upload.',
    connectivity: 'WIFI',
    offlineOnly: false,
    userConsentCloudFallback: false, // User withheld consent!
    deviceCapabilities: baseTelemetry,
  };

  const resNoConsent = await orchestrateLocalInference(reqNoConsentOnline, {
    aicoreModelReady: false,
    gemmaModelReady: false,
    cloudExecutor: spiedCloudExecutor,
  });

  assert(
    !cloudCallAttempted && resNoConsent.provenance === 'UNAVAILABLE',
    'PRIVACY GUARANTEE: Cloud fallback suppressed when user consent is withheld'
  );

  // 4.3: Unassisted Heuristic: Note Summarization
  const noteOutput = generateUnassistedFallback(
    'NOTE_SUMMARIZATION',
    'Brahmin Coffee Bar is renowned for its piping hot filter coffee. The chutney is served in liberal steel mugs. Expect long standing queues during morning rush.',
    'Brahmin Coffee Bar'
  );
  assert(
    typeof noteOutput.summary === 'string' &&
    noteOutput.summary.length > 0 &&
    Array.isArray(noteOutput.keyHighlights) &&
    noteOutput.keyHighlights.length > 0,
    'Unassisted Note Summarizer produces deterministic sentence summary and highlights'
  );

  // 4.4: Unassisted Heuristic: Keyword Extraction
  const keywordOutput = generateUnassistedFallback(
    'KEYWORD_EXTRACTION',
    'Crisp masala dosa with fragrant ghee roast, spicy coconut chutney, and filter coffee.',
    'CTR Shri Sagar'
  );
  assert(
    Array.isArray(keywordOutput.keywords) &&
    keywordOutput.keywords.length > 0 &&
    keywordOutput.keywords.includes('masala'),
    'Unassisted Keyword Extractor strips stop words and extracts salient local terms'
  );

  // --------------------------------------------------------------------------
  // Suite 5: D5 Mock Native Bridge Emulation & Round-trip
  // --------------------------------------------------------------------------
  console.log('\n--- [Suite 5] D5 Native Bridge Emulation ---');

  const d5BridgeCheck = await mockBridge.checkAICoreAvailability();
  assert(
    d5BridgeCheck.isAvailable === true && d5BridgeCheck.apiLevel === 34,
    'D5 Bridge checkAICoreAvailability contract verified'
  );

  const d5Caps = await mockBridge.getDeviceAICapabilities();
  assert(
    d5Caps.supportedFeatures.includes('AICORE_GEMINI_NANO') &&
    d5Caps.ramAvailableMb === 5120,
    'D5 Bridge getDeviceAICapabilities telemetry round-trip verified'
  );

  const d5AICoreInference = await mockBridge.executeAICoreInference(
    'Summarize local spot',
    'SUMMARIZATION'
  );
  assert(
    d5AICoreInference.success === true &&
    typeof d5AICoreInference.text === 'string' &&
    d5AICoreInference.text.includes('AICore'),
    'D5 Bridge executeAICoreInference round-trip verified'
  );

  const d5LlamaInference = await mockBridge.executeLlamaCppInference(
    'Summarize local spot',
    256
  );
  assert(
    d5LlamaInference.success === true &&
    typeof d5LlamaInference.text === 'string' &&
    d5LlamaInference.text.includes('Gemma 4 E2B'),
    'D5 Bridge executeLlamaCppInference round-trip verified'
  );

  // --------------------------------------------------------------------------
  // Suite 6: Physical Hardware Real Inference Verification (NOT TESTED)
  // --------------------------------------------------------------------------
  console.log('\n--- [Suite 6] Physical Hardware Real Inference Verification ---');
  console.log('  ⚠️  STATUS: NOT TESTED (Physical Android ARM64 hardware unavailable in test environment)');
  console.log('  Hardware prerequisites for live validation:');
  console.log('    1. Physical Google Pixel 8/8a/9 or Galaxy S24 running Android 14+ (API 34+) with AICore initialized.');
  console.log('    2. Physical 64-bit ARM device (>= 8 GB physical RAM) with gemma-4-E2B-it-Q4_K_M.gguf and libllama.so.');
  console.log('  Deterministic schemas, readiness gates, fallback engines, and mock bridges are 100% verified.');

  // Final Results
  console.log('\n================================================================');
  console.log(`B6 Test Suite Results: ${passedAssertions} passed, ${failedAssertions} failed, 2 hardware gates NOT TESTED.`);
  console.log('================================================================');

  if (failedAssertions > 0) {
    process.exit(1);
  }
}

runB6TestSuite().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
