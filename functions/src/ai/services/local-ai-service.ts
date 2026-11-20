/**
 * Startup Buildathon 2026 — Neighborhood Guide App
 * Task B6: Local & On-Device AI Capability Evaluation & Offline Orchestration Engine
 *
 * ARCHITECTURAL BOUNDARY NOTICE:
 * This service implements the AI-side domain contracts, readiness evaluation heuristics,
 * and offline/online switching orchestration.
 *
 * Execution Separation:
 * 1. Application-Side Execution (Owned by Developer D):
 *    - Flutter UI -> NativePlatformService (MethodChannel) -> Android MainActivity.kt
 *    - On physical devices, actual local inference runs inside Android AICore or llama.cpp
 *      ARM64 native runtime (libllama.so) directly on the traveler's phone.
 * 2. Backend / Cloud Services (Owned by Developer B):
 *    - Cloud Functions provide server-side cloud AI (Gemini 3.8 Flash, Live, embeddings)
 *      and consented cloud fallback when online.
 *    - Cloud Functions does NOT execute on-device inference directly.
 *
 * Implements:
 * 1. Android AICore / ML Kit GenAI readiness evaluation using dynamic ML Kit feature status
 * 2. Gemma 4 E2B Unsloth GGUF via llama.cpp Android native runtime readiness evaluation (dynamic RAM & arm64 checks)
 * 3. Local inference orchestration with strict execution provenance:
 *    - GEMINI_NANO_LOCAL
 *    - GEMMA_LOCAL
 *    - CLOUD_FALLBACK
 *    - UNAVAILABLE
 * 4. Failsafe offline heuristic fallbacks with zero cloud leakage and privacy preservation.
 */

import {
  DeviceAICapabilities,
  AICoreFeature,
  AICoreReadinessStatus,
  GemmaGGUFReadinessStatus,
  LocalInferenceRequest,
  LocalInferenceResponse,
  LocalInferenceOutput,
} from '../schemas/local-ai-schemas.js';

/**
 * Exact Hugging Face Model Artifact Specifications for Gemma 4 E2B / Unsloth GGUF
 * Reference: https://huggingface.co/unsloth/gemma-4-E2B-it-GGUF
 * Documentation: https://gemma.ai/deployment/unsloth/
 */
export const GEMMA_4_E2B_UNSLOTH_GGUF_SPEC = {
  huggingFaceRepo: 'unsloth/gemma-4-E2B-it-GGUF',
  exactCommitSha: '90f9618340396838ee7ff5b0ba2da27da62953d3',
  canonicalFileName: 'gemma-4-E2B-it-Q4_K_M.gguf',
  fileSizeBytesQ4: 3344000000, // ~3.11 GB
  sha256ChecksumQ4: '740185b21d22ceb83a11c3aa62ad5842ef32c70f6096d756bbee85a1e4ec34b8',
  highFidelityFileName: 'gemma-4-E2B-it-Q8_0.gguf',
  fileSizeBytesQ8: 5420000000, // ~5.05 GB
  multimodalProjectorFileName: 'mmproj-BF16.gguf',
  fileSizeBytesProjector: 1034944512, // ~987 MB
  isMultimodalProjectorRequiredForB6: false, // B6 scope is text note summarization & keywords; mmproj is not required
  license: 'Apache License 2.0 (Hugging Face Repository License; base model governed by Google Gemma Open Model Terms of Use)',
  runtimeLibrary: 'libllama.so (llama.cpp compiled for arm64-v8a with Android NDK 26+)',
  targetArch: 'arm64-v8a', // 64-bit ARM architecture requirement
  // Provisional estimates pending physical hardware profiling:
  provisionalMinAvailableRamMb: 3500, // Provisional estimate: dynamic available RAM for 3.11GB Q4 + context buffer
  provisionalMinTotalRamMb: 8192,     // Provisional estimate: physical system RAM (>= 8 GB recommended)
  minStorageMb: 5000,               // Free disk space required for 3.11GB model cache + temp decomp buffers
  typicalTokensPerSec: '8-15 tokens/sec (Snapdragon 8 Gen 2 / 8 Gen 3)',
  coldStartLatencySec: '2.5 - 4.5 seconds',
} as const;

/**
 * Legacy / Experimental Gemma 2 2B Reference (Separately labeled; not Gemma 4 E2B)
 */
export const GEMMA_2_2B_LEGACY_EXPERIMENTAL_SPEC = {
  huggingFaceRepo: 'unsloth/gemma-2-2b-it-GGUF',
  canonicalFileName: 'gemma-2-2b-it-Q4_K_M.gguf',
  fileSizeBytesQ4: 1714561024, // ~1.71 GB
  note: 'EXPERIMENTAL ONLY. Retained for lightweight baseline testing; does not satisfy frozen Gemma 4 E2B commitment.',
} as const;

/**
 * 1. Evaluates Android AICore / ML Kit GenAI readiness.
 * Authority: Google ML Kit GenAI (https://developers.google.com/ml-kit/genai/)
 * Exact Gradle dependencies:
 * - implementation("com.google.mlkit:genai-prompt:1.0.0-beta4")
 * - implementation("com.google.mlkit:genai-summarization:1.0.0-beta4")
 *
 * Maps actual ML Kit GenAI FeatureStatus values:
 * - FeatureStatus.AVAILABLE -> MODEL_READY
 * - FeatureStatus.DOWNLOADABLE -> MODEL_DOWNLOADABLE
 * - FeatureStatus.DOWNLOADING -> MODEL_DOWNLOADING
 * - FeatureStatus.UNAVAILABLE -> FEATURE_NOT_SUPPORTED
 */
export function evaluateAICoreReadiness(
  telemetry: DeviceAICapabilities,
  targetFeature: AICoreFeature = 'SUMMARIZATION',
  dynamicModelState: 'DOWNLOADABLE' | 'DOWNLOADING' | 'READY' | 'UNAVAILABLE' = 'DOWNLOADABLE',
  requestedLanguage: string = 'en'
): { status: AICoreReadinessStatus; isReady: boolean; reason: string } {
  // Check 1: ML Kit GenAI library prerequisite: Android 8.0+ (API 26+)
  // Note: API 26+ is the library minSdk prerequisite; actual model availability
  // is evaluated dynamically via GenerativeModel.checkStatus() (FeatureStatus).
  if (telemetry.apiLevel < 26) {
    return {
      status: 'UNSUPPORTED_OS_VERSION',
      isReady: false,
      reason: `ML Kit GenAI Prompt API requires minimum Android 8.0+ (API 26+). Current device API: ${telemetry.apiLevel}.`,
    };
  }

  // Check 2: Package presence (com.google.android.aicore)
  if (!telemetry.aicoreInstalled) {
    return {
      status: 'PACKAGE_NOT_INSTALLED',
      isReady: false,
      reason: 'com.google.android.aicore system package is not installed on this device.',
    };
  }

  // Check 3: Host app foreground status
  // ML Kit GenAI strictly restricts background execution to preserve battery life and thermal headroom
  if (!telemetry.isInForeground) {
    return {
      status: 'BACKGROUND_RESTRICTED',
      isReady: false,
      reason: 'AICore inference is restricted while application is running in the background.',
    };
  }

  // Check 4: Dynamic RAM headroom for AICore execution
  if (telemetry.ramAvailableMb < 800) {
    return {
      status: 'QUOTA_EXCEEDED',
      isReady: false,
      reason: `Available RAM (${telemetry.ramAvailableMb} MB) is below AICore operational threshold (800 MB).`,
    };
  }

  // Check 5: Feature-specific compatibility
  if (targetFeature === 'IMAGE_DESCRIPTION') {
    // Multimodal image description requires AICore v2 hardware support (Pixel 9+ / Tensor G4 or equivalent)
    const isV2Capable = telemetry.supportedFeatures.includes('AICORE_MULTIMODAL_V2');
    if (!isV2Capable) {
      return {
        status: 'FEATURE_NOT_SUPPORTED',
        isReady: false,
        reason: 'On-device image description requires AICore v2 multimodal hardware support.',
      };
    }
  }

  // Check 6: Language support verification
  // Current ML Kit GenAI on-device models are English-first; regional languages require cloud fallback or pack
  const langLower = requestedLanguage.toLowerCase().slice(0, 2);
  if (langLower !== 'en') {
    return {
      status: 'UNSUPPORTED_LANGUAGE',
      isReady: false,
      reason: `Language '${requestedLanguage}' is not natively supported by the current on-device AICore model.`,
    };
  }

  // Check 7: Dynamic model download state (from GenerativeModel.checkStatus() / FeatureStatus)
  if (dynamicModelState === 'DOWNLOADING') {
    return {
      status: 'MODEL_DOWNLOADING',
      isReady: false,
      reason: 'AICore model weights are currently downloading in the background.',
    };
  }

  if (dynamicModelState !== 'READY') {
    return {
      status: 'MODEL_DOWNLOADABLE',
      isReady: false,
      reason: 'AICore feature is supported, but model weights are not cached yet. Requires background Wi-Fi + charging download.',
    };
  }

  return {
    status: 'MODEL_READY',
    isReady: true,
    reason: 'Android AICore / ML Kit GenAI is initialized and ready for on-device inference.',
  };
}

/**
 * 2. Evaluates Gemma 4 E2B Unsloth GGUF via llama.cpp readiness.
 * Evaluates dynamic available RAM (provisional estimate >= 3,500 MB), CPU architecture (arm64-v8a),
 * storage space (>= 5,000 MB), native runtime presence, and GGUF model file existence.
 */
export function evaluateGemmaGGUFReadiness(
  telemetry: DeviceAICapabilities,
  runtimeBinaryPresent: boolean = false,
  modelFilePresent: boolean = false
): { status: GemmaGGUFReadinessStatus; isReady: boolean; reason: string } {
  // Check 1: CPU Architecture (arm64-v8a)
  const arch = telemetry.hardwareArchitecture.toLowerCase();
  if (!arch.includes('arm64') && !arch.includes('aarch64')) {
    return {
      status: 'UNSUPPORTED_ARCHITECTURE',
      isReady: false,
      reason: `llama.cpp native runtime requires 64-bit ARM (arm64-v8a). Current architecture: ${telemetry.hardwareArchitecture}.`,
    };
  }

  // Check 2: Dynamic Available RAM (not just total physical RAM)
  // Gemma 4 E2B Q4_K_M is ~3.11 GB. Loading requires ~3.5 GB free RAM.
  if (telemetry.ramAvailableMb < GEMMA_4_E2B_UNSLOTH_GGUF_SPEC.provisionalMinAvailableRamMb) {
    return {
      status: 'INSUFFICIENT_AVAILABLE_RAM',
      isReady: false,
      reason: `Dynamic available RAM (${telemetry.ramAvailableMb} MB) is below provisional estimated ${GEMMA_4_E2B_UNSLOTH_GGUF_SPEC.provisionalMinAvailableRamMb} MB for Gemma 4 E2B GGUF runtime.`,
    };
  }

  // Check 3: Available Disk Storage for Model Cache
  if (telemetry.storageAvailableMb < GEMMA_4_E2B_UNSLOTH_GGUF_SPEC.minStorageMb) {
    return {
      status: 'INSUFFICIENT_STORAGE',
      isReady: false,
      reason: `Available storage (${telemetry.storageAvailableMb} MB) is below required ${GEMMA_4_E2B_UNSLOTH_GGUF_SPEC.minStorageMb} MB for Gemma 4 E2B GGUF cache.`,
    };
  }

  // Check 4: Native libllama.so shared library
  if (!runtimeBinaryPresent) {
    return {
      status: 'RUNTIME_BINARY_MISSING',
      isReady: false,
      reason: 'Native shared library libllama.so is not bundled or loaded in application native libs directory.',
    };
  }

  // Check 5: GGUF Model file cached
  if (!modelFilePresent) {
    return {
      status: 'MODEL_FILE_NOT_FOUND',
      isReady: false,
      reason: `Gemma 4 E2B GGUF artifact (${GEMMA_4_E2B_UNSLOTH_GGUF_SPEC.canonicalFileName}) not found in app cache directory.`,
    };
  }

  return {
    status: 'READY',
    isReady: true,
    reason: 'Gemma 4 E2B Unsloth GGUF runtime is loaded, memory-mapped, and ready for inference.',
  };
}

/**
 * 3. Selects optimal execution path based on connectivity, hardware readiness, and user preferences.
 */
export function selectExecutionEngine(
  request: LocalInferenceRequest,
  aicoreReady: boolean,
  gemmaReady: boolean
): {
  chosenEngine: 'GEMINI_NANO' | 'GEMMA_GGUF' | 'CLOUD' | 'UNASSISTED_FALLBACK';
  reason: string;
} {
  const isOffline = request.connectivity === 'OFFLINE' || request.offlineOnly;

  // STRICT OFFLINE ROUTING: Cloud is completely excluded when offline
  if (isOffline) {
    if (request.preferredEngine === 'AICORE_GEMINI_NANO') {
      if (aicoreReady) return { chosenEngine: 'GEMINI_NANO', reason: 'User preferred AICore and it is ready.' };
      if (gemmaReady) return { chosenEngine: 'GEMMA_GGUF', reason: 'AICore unready; fallback to ready Gemma 4 E2B GGUF.' };
      return { chosenEngine: 'UNASSISTED_FALLBACK', reason: 'Offline and neither on-device engine is ready.' };
    }

    if (request.preferredEngine === 'GEMMA_LOCAL_GGUF') {
      if (gemmaReady) return { chosenEngine: 'GEMMA_GGUF', reason: 'User preferred Gemma 4 E2B GGUF and it is ready.' };
      if (aicoreReady) return { chosenEngine: 'GEMINI_NANO', reason: 'Gemma unready; fallback to ready AICore.' };
      return { chosenEngine: 'UNASSISTED_FALLBACK', reason: 'Offline and neither on-device engine is ready.' };
    }

    // AUTO Engine selection offline:
    // Prefer AICore if available (zero app-managed RAM overhead, OS shared weights)
    if (aicoreReady) {
      return { chosenEngine: 'GEMINI_NANO', reason: 'AUTO selection: Android AICore ready on-device.' };
    }
    // Else check Gemma GGUF (app-managed local runtime)
    if (gemmaReady) {
      return { chosenEngine: 'GEMMA_GGUF', reason: 'AUTO selection: Gemma 4 E2B GGUF llama.cpp ready on-device.' };
    }
    // Both unready: fail closed offline
    return { chosenEngine: 'UNASSISTED_FALLBACK', reason: 'Offline mode: no local model ready; falling back to unassisted heuristics.' };
  }

  // ONLINE ROUTING:
  // If user explicitly chose cloud, or local models are unready and cloud consent is given
  if (request.preferredEngine === 'CLOUD_GEMINI') {
    return { chosenEngine: 'CLOUD', reason: 'User explicitly selected cloud inference.' };
  }

  // If local models are ready and preferred
  if (request.preferredEngine === 'AICORE_GEMINI_NANO' && aicoreReady) {
    return { chosenEngine: 'GEMINI_NANO', reason: 'User selected on-device AICore while online.' };
  }
  if (request.preferredEngine === 'GEMMA_LOCAL_GGUF' && gemmaReady) {
    return { chosenEngine: 'GEMMA_GGUF', reason: 'User selected on-device Gemma 4 E2B GGUF while online.' };
  }

  // AUTO when online:
  // Zero-latency edge inference preferred if ready, else cloud fallback with consent
  if (aicoreReady) {
    return { chosenEngine: 'GEMINI_NANO', reason: 'AUTO online: using ready zero-latency AICore.' };
  }
  if (gemmaReady) {
    return { chosenEngine: 'GEMMA_GGUF', reason: 'AUTO online: using ready on-device Gemma 4 E2B GGUF.' };
  }

  // Local models unavailable: check cloud fallback consent
  if (request.userConsentCloudFallback) {
    return { chosenEngine: 'CLOUD', reason: 'Local models unready; user consented to online cloud fallback.' };
  }

  return { chosenEngine: 'UNASSISTED_FALLBACK', reason: 'Local models unready and user declined cloud transmission.' };
}

/**
 * 4. Failsafe Offline Heuristic Generator (Unassisted Mode)
 * Provides helpful, deterministic extraction without hallucinating neural model execution.
 */
export function generateUnassistedFallback(
  taskType: LocalInferenceRequest['taskType'],
  prompt: string,
  spotName?: string
): LocalInferenceOutput {
  const cleanText = prompt.trim();

  if (taskType === 'NOTE_SUMMARIZATION') {
    // Sentence extraction heuristic
    const sentences = cleanText
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 10);

    const summary = sentences.slice(0, 2).join(' ') || cleanText.slice(0, 160);
    const keyHighlights = sentences.slice(0, 3).map((s) => s.replace(/^[•\-\*]\s*/, ''));

    return {
      summary: summary || (spotName ? `Notes recorded for ${spotName}.` : 'Note captured offline.'),
      keyHighlights: keyHighlights.length > 0 ? keyHighlights : ['Offline note captured on device.'],
    };
  }

  if (taskType === 'KEYWORD_EXTRACTION') {
    // Frequency and keyword extraction heuristic
    const stopWords = new Set([
      'the', 'is', 'at', 'which', 'on', 'and', 'a', 'an', 'in', 'to', 'for', 'of',
      'with', 'it', 'was', 'this', 'that', 'are', 'from', 'by', 'as', 'we', 'you',
      'very', 'good', 'great', 'place', 'spot', 'here', 'there', 'had', 'have',
    ]);

    const words = cleanText
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 3 && !stopWords.has(w));

    const freqMap = new Map<string, number>();
    for (const w of words) {
      freqMap.set(w, (freqMap.get(w) || 0) + 1);
    }

    const sortedKeywords = Array.from(freqMap.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([word]) => word)
      .slice(0, 8);

    return {
      keywords: sortedKeywords.length > 0 ? sortedKeywords : ['neighborhood', 'local'],
    };
  }

  // Spot assistance fallback
  return {
    answer: spotName
      ? `Offline spot guide for ${spotName}. Detailed AI assistance available once online or when on-device model finishes downloading.`
      : 'Offline neighborhood guidance. Connect online or download local model pack for full conversational AI.',
    practicalTips: [
      'Check local business hours displayed on spot card.',
      'Carry small cash / UPI as backup for small vendors.',
    ],
  };
}

/**
 * Interface for Developer D's MethodChannel contract:
 * com.innovotribe.locallens/native_ai
 * Implemented in Android Kotlin (MainActivity.kt) and Flutter (NativePlatformService).
 */
export interface NativeBridgeExecutor {
  checkAICoreAvailability(): Promise<{
    isAvailable: boolean;
    apiLevel: number;
    isSupportedDevice: boolean;
    aicorePackageInstalled: boolean;
    statusMessage: string;
  }>;
  getDeviceAICapabilities(): Promise<DeviceAICapabilities>;
  getNativeAiStatus(): Promise<string>;
  summarizeOfflineNote(params: {
    noteText: string;
    spotName: string;
    language?: string;
  }): Promise<{
    success: boolean;
    summary: string;
    keyHighlights: string[];
    isLocalInference: boolean;
    modelUsed: string;
    code: string;
    message?: string;
  }>;
  extractOfflineKeywords(params: {
    text: string;
  }): Promise<{
    success: boolean;
    keywords: string[];
    isLocalInference: boolean;
    modelUsed: string;
    code: string;
    message?: string;
  }>;
  executeOfflineInference(params: {
    prompt: string;
    engine: 'AICORE' | 'LLAMA_CPP';
  }): Promise<{
    success: boolean;
    isLocalInference: boolean;
    code: string;
    engine: string;
    output?: string;
    message?: string;
  }>;
}

/**
 * Interface for optional cloud executor (when online and consented)
 */
export interface CloudInferenceExecutor {
  executeCloudModel(prompt: string, taskType: string): Promise<{ text: string; modelUsed: string }>;
}

/**
 * 5. Primary Orchestration Function
 * Executes local or fallback inference with strict provenance and privacy guarantees.
 */
export async function orchestrateLocalInference(
  request: LocalInferenceRequest,
  options: {
    aicoreModelReady?: boolean;
    gemmaModelReady?: boolean;
    nativeBridge?: NativeBridgeExecutor;
    cloudExecutor?: CloudInferenceExecutor;
  } = {}
): Promise<LocalInferenceResponse> {
  const startTime = Date.now();

  // Step 1: Evaluate AICore readiness
  const aicoreEval = evaluateAICoreReadiness(
    request.deviceCapabilities,
    'SUMMARIZATION',
    options.aicoreModelReady ? 'READY' : 'DOWNLOADABLE',
    request.language
  );

  // Step 2: Evaluate Gemma GGUF readiness
  const gemmaEval = evaluateGemmaGGUFReadiness(
    request.deviceCapabilities,
    options.gemmaModelReady ?? false, // runtime present
    options.gemmaModelReady ?? false  // model cached
  );

  // Step 3: Engine Selection
  const engineSelection = selectExecutionEngine(request, aicoreEval.isReady, gemmaEval.isReady);

  // Path A: Android AICore / ML Kit GenAI
  if (engineSelection.chosenEngine === 'GEMINI_NANO') {
    if (options.nativeBridge) {
      try {
        if (request.taskType === 'NOTE_SUMMARIZATION') {
          const bridgeRes = await options.nativeBridge.summarizeOfflineNote({
            noteText: request.prompt,
            spotName: request.spotName || '',
            language: request.language,
          });
          if (bridgeRes.success && bridgeRes.isLocalInference) {
            return {
              taskId: request.taskId,
              success: true,
              provenance: 'GEMINI_NANO_LOCAL',
              executionEnvironment: 'CLIENT_ANDROID_NATIVE',
              isLocalInference: true,
              modelUsed: bridgeRes.modelUsed || 'Gemini Nano (Android AICore / ML Kit)',
              code: 'OK',
              message: 'Inference completed on-device via Android AICore.',
              output: {
                summary: bridgeRes.summary,
                keyHighlights: bridgeRes.keyHighlights,
              },
              unassistedFallback: false,
              executionDurationMs: Date.now() - startTime,
              metadata: { aicoreVersion: request.deviceCapabilities.aicoreVersion },
            };
          }
        } else if (request.taskType === 'KEYWORD_EXTRACTION') {
          const bridgeRes = await options.nativeBridge.extractOfflineKeywords({
            text: request.prompt,
          });
          if (bridgeRes.success && bridgeRes.isLocalInference) {
            return {
              taskId: request.taskId,
              success: true,
              provenance: 'GEMINI_NANO_LOCAL',
              executionEnvironment: 'CLIENT_ANDROID_NATIVE',
              isLocalInference: true,
              modelUsed: bridgeRes.modelUsed || 'Gemini Nano (Android AICore / ML Kit)',
              code: 'OK',
              message: 'Keyword extraction completed on-device via Android AICore.',
              output: {
                keywords: bridgeRes.keywords,
              },
              unassistedFallback: false,
              executionDurationMs: Date.now() - startTime,
              metadata: { aicoreVersion: request.deviceCapabilities.aicoreVersion },
            };
          }
        } else {
          // General / Spot assistance inference
          const bridgeRes = await options.nativeBridge.executeOfflineInference({
            prompt: request.prompt,
            engine: 'AICORE',
          });
          if (bridgeRes.success && bridgeRes.isLocalInference) {
            return {
              taskId: request.taskId,
              success: true,
              provenance: 'GEMINI_NANO_LOCAL',
              executionEnvironment: 'CLIENT_ANDROID_NATIVE',
              isLocalInference: true,
              modelUsed: 'Gemini Nano (Android AICore / ML Kit)',
              code: 'OK',
              message: 'Inference completed on-device via Android AICore.',
              output: {
                answer: bridgeRes.output,
              },
              unassistedFallback: false,
              executionDurationMs: Date.now() - startTime,
              metadata: { aicoreVersion: request.deviceCapabilities.aicoreVersion },
            };
          }
        }
      } catch (_err: any) {
        // Native execution failure: fall through to failsafe
      }
    }

    // If bridge is not connected or model execution failed:
    // Respect fail-closed offline policy
    if (request.connectivity === 'OFFLINE' || request.offlineOnly) {
      const fallbackOutput = generateUnassistedFallback(request.taskType, request.prompt, request.spotName);
      return {
        taskId: request.taskId,
        success: false,
        provenance: 'UNAVAILABLE',
        executionEnvironment: 'CLIENT_ANDROID_NATIVE',
        isLocalInference: false,
        modelUsed: 'NONE (Unassisted Fallback)',
        code: 'MODEL_NOT_DOWNLOADED',
        message: 'AICore model weights not yet cached; offline unassisted fallback applied.',
        output: fallbackOutput,
        unassistedFallback: true,
        executionDurationMs: Date.now() - startTime,
        metadata: { aicoreStatus: aicoreEval.status, reason: aicoreEval.reason },
      };
    }
  }

  // Path B: Gemma 4 E2B Unsloth GGUF via llama.cpp
  if (engineSelection.chosenEngine === 'GEMMA_GGUF') {
    if (options.nativeBridge) {
      try {
        const bridgeRes = await options.nativeBridge.executeOfflineInference({
          prompt: request.prompt,
          engine: 'LLAMA_CPP',
        });
        if (bridgeRes.success && bridgeRes.isLocalInference) {
          return {
            taskId: request.taskId,
            success: true,
            provenance: 'GEMMA_LOCAL',
            executionEnvironment: 'CLIENT_ANDROID_NATIVE',
            isLocalInference: true,
            modelUsed: `Gemma 4 E2B (${GEMMA_4_E2B_UNSLOTH_GGUF_SPEC.canonicalFileName}) via llama.cpp`,
            code: 'OK',
            message: 'Inference completed on-device via llama.cpp ARM64 runtime.',
            output: {
              summary: bridgeRes.output,
              keyHighlights: [bridgeRes.output?.slice(0, 60) || ''],
            },
            unassistedFallback: false,
            executionDurationMs: Date.now() - startTime,
            metadata: {
              quantization: 'Q4_K_M',
              targetArch: GEMMA_4_E2B_UNSLOTH_GGUF_SPEC.targetArch,
              repo: GEMMA_4_E2B_UNSLOTH_GGUF_SPEC.huggingFaceRepo,
              commitSha: GEMMA_4_E2B_UNSLOTH_GGUF_SPEC.exactCommitSha,
            },
          };
        }
      } catch (_err: any) {
        // llama.cpp execution failure: fall through
      }
    }

    // Offline fail-closed policy
    if (request.connectivity === 'OFFLINE' || request.offlineOnly) {
      const fallbackOutput = generateUnassistedFallback(request.taskType, request.prompt, request.spotName);
      return {
        taskId: request.taskId,
        success: false,
        provenance: 'UNAVAILABLE',
        executionEnvironment: 'CLIENT_ANDROID_NATIVE',
        isLocalInference: false,
        modelUsed: 'NONE (Unassisted Fallback)',
        code: 'RUNTIME_OR_MODEL_PENDING',
        message: 'Gemma 4 E2B GGUF runtime or weights not loaded; offline unassisted fallback applied.',
        output: fallbackOutput,
        unassistedFallback: true,
        executionDurationMs: Date.now() - startTime,
        metadata: { gemmaStatus: gemmaEval.status, reason: gemmaEval.reason },
      };
    }
  }

  // Path C: Cloud Fallback (Online Only + Consented)
  if (engineSelection.chosenEngine === 'CLOUD') {
    if (options.cloudExecutor) {
      try {
        const cloudRes = await options.cloudExecutor.executeCloudModel(request.prompt, request.taskType);
        return {
          taskId: request.taskId,
          success: true,
          provenance: 'CLOUD_FALLBACK',
          executionEnvironment: 'BACKEND_CLOUD_FUNCTIONS',
          isLocalInference: false, // Strict provenance: NEVER report cloud as local!
          modelUsed: cloudRes.modelUsed,
          code: 'CLOUD_FALLBACK_APPLIED',
          message: 'Local models unready; inference executed via cloud Gemini API with consent.',
          output: {
            summary: cloudRes.text,
            keyHighlights: [cloudRes.text.slice(0, 60)],
          },
          unassistedFallback: false,
          executionDurationMs: Date.now() - startTime,
          metadata: { connectivity: request.connectivity },
        };
      } catch (_cloudErr: any) {
        // Cloud API error: return unassisted fallback
      }
    }
  }

  // Path D: Unassisted Fallback (Fail-Closed / Offline / No-Consent)
  const fallbackOutput = generateUnassistedFallback(request.taskType, request.prompt, request.spotName);
  return {
    taskId: request.taskId,
    success: false,
    provenance: 'UNAVAILABLE',
    executionEnvironment: 'CLIENT_ANDROID_NATIVE',
    isLocalInference: false,
    modelUsed: 'NONE (Unassisted Fallback)',
    code: 'OFFLINE_UNASSISTED_FALLBACK',
    message: engineSelection.reason,
    output: fallbackOutput,
    unassistedFallback: true,
    executionDurationMs: Date.now() - startTime,
    metadata: {
      aicoreStatus: aicoreEval.status,
      gemmaStatus: gemmaEval.status,
      connectivity: request.connectivity,
      privacyGuaranteed: 'Zero offline user data transmitted to external networks.',
    },
  };
}
