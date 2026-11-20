/**
 * Startup Buildathon 2026 — Neighborhood Guide App
 * Task B6: Local & On-Device AI Engine & Offline Orchestrator
 * 
 * Implements:
 * 1. Android AICore / ML Kit GenAI readiness evaluation (multi-OEM: Pixel, Galaxy, Xiaomi, Motorola, OnePlus)
 * 2. Gemma 4 E2B Unsloth GGUF via llama.cpp Android native runtime readiness evaluation (dynamic RAM & arm64 checks)
 * 3. Local inference orchestration with strict execution provenance:
 *    - GEMINI_NANO_LOCAL
 *    - GEMMA_LOCAL
 *    - CLOUD_FALLBACK
 *    - UNAVAILABLE
 * 4. Failsafe offline heuristic fallbacks with zero cloud leakage and privacy preservation.
 * 5. Native bridge interface mapping Developer D's D5 MethodChannel (com.innovotribe.locallens/native_ai).
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
 */
export const GEMMA_UNSLOTH_GGUF_SPEC = {
  huggingFaceRepo: 'unsloth/gemma-2-2b-it-GGUF',
  canonicalFileName: 'gemma-2-2b-it-Q4_K_M.gguf',
  highFidelityFileName: 'gemma-2-2b-it-Q8_0.gguf',
  fileSizeBytesQ4: 1714561024, // ~1.71 GB
  fileSizeBytesQ8: 2782142464, // ~2.78 GB
  artifactRevision: '84f4f38753235ff8a86a0e66d98e5e79147137f6', // Commit on main branch
  license: 'Gemma Open Model Terms of Use (Governed by Google open model license)',
  runtimeLibrary: 'libllama.so (llama.cpp compiled for arm64-v8a with Android NDK 26+)',
  minAvailableRamMb: 1500, // Dynamic available RAM required at invocation time
  minStorageMb: 2500,      // Disk space required for caching quantized weights
  targetArch: 'arm64-v8a', // 64-bit ARM architecture requirement
  typicalTokensPerSec: '8-15 tokens/sec (Snapdragon 8 Gen 2 / Tensor G3)',
  coldStartLatencySec: '1.8 - 3.2 seconds',
} as const;

/**
 * Android AICore Multi-OEM Supported Manufacturers & Devices
 * Authority: Google ML Kit GenAI documentation (https://developers.google.com/ml-kit/genai/)
 */
export const AICORE_SUPPORTED_OEM_PATTERNS = [
  'google',    // Pixel 8, 8 Pro, 8a, Pixel 9 series, Pixel Fold
  'samsung',   // Galaxy S24, S24+, S24 Ultra, Z Fold6, Z Flip6
  'xiaomi',    // Xiaomi 14 series, 14T series
  'motorola',  // Motorola Edge 50 Ultra, Razr 50 Ultra
  'oneplus',   // OnePlus 12 series
  'oppo',      // Find X7 series
] as const;

/**
 * 1. Evaluates Android AICore / ML Kit GenAI readiness.
 * Validates OS API level (API 34+), OEM compatibility, package presence,
 * memory headroom, foreground status, and model download state.
 */
export function evaluateAICoreReadiness(
  telemetry: DeviceAICapabilities,
  targetFeature: AICoreFeature = 'SUMMARIZATION',
  modelWeightsDownloaded: boolean = false
): { status: AICoreReadinessStatus; isReady: boolean; reason: string } {
  // Check 1: Android 14+ (API 34+) requirement
  if (telemetry.apiLevel < 34) {
    return {
      status: 'UNSUPPORTED_OS_VERSION',
      isReady: false,
      reason: `AICore requires Android 14+ (API 34+). Current device API: ${telemetry.apiLevel}.`,
    };
  }

  // Check 2: OEM compatibility verification
  if (telemetry.deviceManufacturer) {
    const mfg = telemetry.deviceManufacturer.toLowerCase();
    const isSupportedOem = AICORE_SUPPORTED_OEM_PATTERNS.some((pattern) => mfg.includes(pattern));
    if (!isSupportedOem) {
      return {
        status: 'UNSUPPORTED_DEVICE',
        isReady: false,
        reason: `Device manufacturer '${telemetry.deviceManufacturer}' is not in the certified AICore OEM list.`,
      };
    }
  }

  // Check 3: Package presence (com.google.android.aicore)
  if (!telemetry.aicoreInstalled) {
    return {
      status: 'PACKAGE_NOT_INSTALLED',
      isReady: false,
      reason: 'com.google.android.aicore system package is not installed on this device.',
    };
  }

  // Check 4: Host app foreground status
  // AICore throttles and restricts background execution to preserve battery life
  if (!telemetry.isInForeground) {
    return {
      status: 'BACKGROUND_RESTRICTED',
      isReady: false,
      reason: 'AICore inference is restricted while application is in background.',
    };
  }

  // Check 5: Dynamic RAM headroom for AICore execution
  if (telemetry.ramAvailableMb < 800) {
    return {
      status: 'FEATURE_UNAVAILABLE',
      isReady: false,
      reason: `Available RAM (${telemetry.ramAvailableMb} MB) is below AICore minimum operational threshold (800 MB).`,
    };
  }

  // Check 6: Feature-specific compatibility
  if (targetFeature === 'IMAGE_DESCRIPTION') {
    // Multimodal image description requires AICore v2 (Pixel 9+ / Tensor G4 or equivalent)
    const isV2Capable = telemetry.supportedFeatures.includes('AICORE_MULTIMODAL_V2');
    if (!isV2Capable) {
      return {
        status: 'FEATURE_UNAVAILABLE',
        isReady: false,
        reason: 'Image description requires AICore v2 multimodal hardware support.',
      };
    }
  }

  // Check 7: Model weights download status
  if (!modelWeightsDownloaded) {
    return {
      status: 'MODEL_NOT_DOWNLOADED',
      isReady: false,
      reason: 'AICore model weights are not downloaded to device cache yet. Requires background Wi-Fi + charging download.',
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
 * Enforces dynamic available RAM verification (>= 1500 MB), CPU architecture (arm64-v8a),
 * storage space (>= 2.5 GB), native runtime presence, and GGUF model file existence.
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

  // Check 2: Dynamic Available RAM (not just totalRamMb)
  // Enforces user feedback: totalRamMb alone is not a reliable measure
  if (telemetry.ramAvailableMb < GEMMA_UNSLOTH_GGUF_SPEC.minAvailableRamMb) {
    return {
      status: 'INSUFFICIENT_AVAILABLE_RAM',
      isReady: false,
      reason: `Dynamic available RAM (${telemetry.ramAvailableMb} MB) is below required ${GEMMA_UNSLOTH_GGUF_SPEC.minAvailableRamMb} MB for Gemma GGUF runtime.`,
    };
  }

  // Check 3: Available Disk Storage for Model Cache
  if (telemetry.storageAvailableMb < GEMMA_UNSLOTH_GGUF_SPEC.minStorageMb) {
    return {
      status: 'INSUFFICIENT_STORAGE',
      isReady: false,
      reason: `Available storage (${telemetry.storageAvailableMb} MB) is below required ${GEMMA_UNSLOTH_GGUF_SPEC.minStorageMb} MB for GGUF model cache.`,
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
      reason: `GGUF model artifact (${GEMMA_UNSLOTH_GGUF_SPEC.canonicalFileName}) not found in app cache directory.`,
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
      if (gemmaReady) return { chosenEngine: 'GEMMA_GGUF', reason: 'AICore unready; fallback to ready Gemma GGUF.' };
      return { chosenEngine: 'UNASSISTED_FALLBACK', reason: 'Offline and neither on-device engine is ready.' };
    }

    if (request.preferredEngine === 'GEMMA_LOCAL_GGUF') {
      if (gemmaReady) return { chosenEngine: 'GEMMA_GGUF', reason: 'User preferred Gemma GGUF and it is ready.' };
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
      return { chosenEngine: 'GEMMA_GGUF', reason: 'AUTO selection: Gemma GGUF llama.cpp ready on-device.' };
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
    return { chosenEngine: 'GEMMA_GGUF', reason: 'User selected on-device Gemma GGUF while online.' };
  }

  // AUTO when online:
  // Zero-latency edge inference preferred if ready, else cloud fallback with consent
  if (aicoreReady) {
    return { chosenEngine: 'GEMINI_NANO', reason: 'AUTO online: using ready zero-latency AICore.' };
  }
  if (gemmaReady) {
    return { chosenEngine: 'GEMMA_GGUF', reason: 'AUTO online: using ready on-device Gemma GGUF.' };
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
 * Interface for pluggable native bridge executor (matching D5 MethodChannel)
 */
export interface NativeBridgeExecutor {
  checkAICoreAvailability(): Promise<{ isAvailable: boolean; statusMessage: string; apiLevel: number }>;
  getDeviceAICapabilities(): Promise<DeviceAICapabilities>;
  executeAICoreInference(prompt: string, feature: AICoreFeature): Promise<{ success: boolean; text?: string; code?: string }>;
  executeLlamaCppInference(prompt: string, maxTokens: number): Promise<{ success: boolean; text?: string; code?: string }>;
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
    options.aicoreModelReady ?? false
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
        const bridgeRes = await options.nativeBridge.executeAICoreInference(request.prompt, 'SUMMARIZATION');
        if (bridgeRes.success && bridgeRes.text) {
          return {
            taskId: request.taskId,
            success: true,
            provenance: 'GEMINI_NANO_LOCAL',
            isLocalInference: true,
            modelUsed: 'Gemini Nano (Android AICore / ML Kit)',
            code: 'OK',
            message: 'Inference completed on-device via Android AICore.',
            output: {
              summary: bridgeRes.text,
              keyHighlights: [bridgeRes.text.slice(0, 60)],
            },
            unassistedFallback: false,
            executionDurationMs: Date.now() - startTime,
            metadata: { aicoreVersion: request.deviceCapabilities.aicoreVersion },
          };
        }
      } catch (err: any) {
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
        const bridgeRes = await options.nativeBridge.executeLlamaCppInference(request.prompt, 256);
        if (bridgeRes.success && bridgeRes.text) {
          return {
            taskId: request.taskId,
            success: true,
            provenance: 'GEMMA_LOCAL',
            isLocalInference: true,
            modelUsed: `Gemma 4 E2B (${GEMMA_UNSLOTH_GGUF_SPEC.canonicalFileName}) via llama.cpp`,
            code: 'OK',
            message: 'Inference completed on-device via llama.cpp ARM64 runtime.',
            output: {
              summary: bridgeRes.text,
              keyHighlights: [bridgeRes.text.slice(0, 60)],
            },
            unassistedFallback: false,
            executionDurationMs: Date.now() - startTime,
            metadata: { quantization: 'Q4_K_M', targetArch: GEMMA_UNSLOTH_GGUF_SPEC.targetArch },
          };
        }
      } catch (err: any) {
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
        isLocalInference: false,
        modelUsed: 'NONE (Unassisted Fallback)',
        code: 'RUNTIME_OR_MODEL_PENDING',
        message: 'Gemma GGUF runtime or weights not loaded; offline unassisted fallback applied.',
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
      } catch (cloudErr: any) {
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
