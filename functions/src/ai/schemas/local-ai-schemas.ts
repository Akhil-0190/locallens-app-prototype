/**
 * Startup Buildathon 2026 — Neighborhood Guide App
 * Task B6: Local & On-Device AI Schemas and Provenance Contracts
 * 
 * Defines schemas for:
 * 1. Device hardware & telemetry capabilities (AICore, llama.cpp GGUF, RAM, architecture)
 * 2. AICore and Gemma runtime readiness lifecycle states
 * 3. Local inference requests and structured responses
 * 4. Strict execution provenance tracking (GEMINI_NANO_LOCAL, GEMMA_LOCAL, CLOUD_FALLBACK, UNAVAILABLE)
 */

import { z } from 'zod';

/**
 * Execution Provenance:
 * Explicit, auditable tag identifying the exact execution origin.
 * Strict architectural rule:
 * - Never report CLOUD_FALLBACK as local inference.
 * - Never silently upload offline user data to the cloud when local inference fails.
 */
export const ExecutionProvenanceSchema = z.enum([
  'GEMINI_NANO_LOCAL', // Android AICore / ML Kit GenAI on-device execution
  'GEMMA_LOCAL',       // Gemma 4 E2B / Unsloth GGUF via llama.cpp Android native runtime
  'CLOUD_FALLBACK',    // Google Gemini API cloud execution (online only, with consent)
  'UNAVAILABLE',       // Local model unavailable/unassisted fallback, or offline fail-closed
]);

export type ExecutionProvenance = z.infer<typeof ExecutionProvenanceSchema>;

/**
 * Android AICore feature capabilities.
 * Google ML Kit GenAI separates capabilities across distinct APIs and models.
 */
export const AICoreFeatureSchema = z.enum([
  'DIRECT_MODEL',       // Foundation LLM direct prompt-response API
  'SUMMARIZATION',      // Specialized on-device summarization API
  'REWRITE',            // Specialized text rewriting / style adaptation API
  'IMAGE_DESCRIPTION',  // On-device multimodal / vision description (AICore v2 / Pixel 9+)
]);

export type AICoreFeature = z.infer<typeof AICoreFeatureSchema>;

/**
 * Discrete lifecycle readiness states for Android AICore / ML Kit GenAI.
 * Accounts for API version, OEM support, package presence, model downloading, and foreground state.
 */
export const AICoreReadinessStatusSchema = z.enum([
  'UNSUPPORTED_OS_VERSION', // Requires Android 14+ (API 34+)
  'UNSUPPORTED_DEVICE',     // Device SoC/manufacturer not in supported OEM matrix
  'PACKAGE_NOT_INSTALLED',  // com.google.android.aicore package not present
  'MODEL_NOT_DOWNLOADED',   // System package present, but feature model weights not yet cached
  'MODEL_DOWNLOADING',      // Weights currently downloading in background (charging + Wi-Fi)
  'MODEL_READY',            // Model downloaded and ready for local inference
  'BACKGROUND_RESTRICTED',  // AICore restricts heavy inference when app is in background
  'FEATURE_UNAVAILABLE',    // Requested specific feature (e.g. image description) unsupported on this hardware
]);

export type AICoreReadinessStatus = z.infer<typeof AICoreReadinessStatusSchema>;

/**
 * Discrete lifecycle readiness states for Gemma 4 E2B Unsloth GGUF via llama.cpp.
 * Accounts for CPU architecture (arm64-v8a), dynamic available RAM, storage, and binary files.
 */
export const GemmaGGUFReadinessStatusSchema = z.enum([
  'UNSUPPORTED_ARCHITECTURE',    // Non-64-bit ARM (e.g. armeabi-v7a or unaccelerated x86)
  'INSUFFICIENT_AVAILABLE_RAM',  // Dynamic available RAM < 1,500 MB (regardless of total RAM)
  'INSUFFICIENT_STORAGE',        // Free device storage < 2.5 GB for model weight caching
  'RUNTIME_BINARY_MISSING',      // Native libllama.so shared library not located
  'MODEL_FILE_NOT_FOUND',        // GGUF model artifact not present in local storage
  'READY',                       // Native runtime loaded and model mapped into memory
]);

export type GemmaGGUFReadinessStatus = z.infer<typeof GemmaGGUFReadinessStatusSchema>;

/**
 * Device AI Telemetry & Hardware Capabilities schema.
 * Reconciled with Developer D's MethodChannel contract: com.innovotribe.locallens/native_ai
 */
export const DeviceAICapabilitiesSchema = z.object({
  apiLevel: z.number().int().min(0).describe('Android SDK API level (e.g. 34 for Android 14)'),
  totalRamMb: z.number().int().min(0).describe('Total physical RAM in megabytes'),
  ramAvailableMb: z.number().int().min(0).describe('Dynamic currently available RAM in megabytes'),
  aicoreInstalled: z.boolean().describe('True if com.google.android.aicore package is installed'),
  aicoreVersion: z.number().int().min(0).describe('Version code of com.google.android.aicore'),
  hasNpu: z.boolean().describe('Whether an active NPU is detected and accessible via standard HAL'),
  supportedFeatures: z.array(z.string()).describe('Architectural feature tags (e.g. AICORE_GEMINI_NANO, LLAMA_CPP_GEMMA4_GGUF)'),
  hardwareArchitecture: z.string().default('arm64-v8a').describe('CPU ABI (e.g. arm64-v8a, armeabi-v7a, x86_64)'),
  storageAvailableMb: z.number().int().min(0).default(5000).describe('Available disk space on device in megabytes'),
  deviceManufacturer: z.string().optional().describe('OEM manufacturer (e.g. Google, Samsung, Xiaomi, Motorola, OnePlus)'),
  deviceModel: z.string().optional().describe('Hardware model identifier'),
  isInForeground: z.boolean().default(true).describe('Whether host application is in foreground'),
});

export type DeviceAICapabilities = z.infer<typeof DeviceAICapabilitiesSchema>;

/**
 * Supported on-device local inference task types.
 */
export const LocalInferenceTaskTypeSchema = z.enum([
  'NOTE_SUMMARIZATION',   // Summarizing traveler impressions or neighborhood notes
  'KEYWORD_EXTRACTION',   // Extracting neighborhood tags, culinary specialties, vibe keywords
  'SPOT_ASSISTANCE',      // Offline spot practical Q&A and insider tip extraction
]);

export type LocalInferenceTaskType = z.infer<typeof LocalInferenceTaskTypeSchema>;

/**
 * Local Inference Request Contract.
 */
export const LocalInferenceRequestSchema = z.object({
  taskId: z.string().describe('Unique identifier for this inference invocation'),
  taskType: LocalInferenceTaskTypeSchema,
  prompt: z.string().describe('Input text or formatted prompt to be processed'),
  spotName: z.string().optional().describe('Name of associated spot if applicable'),
  language: z.string().default('en').describe('Target or source language code (e.g. en, hi, kn)'),
  preferredEngine: z.enum([
    'AUTO',                // Select best available engine: AICore -> Gemma GGUF -> Cloud (if online)
    'AICORE_GEMINI_NANO',  // Explicitly target Android AICore / ML Kit GenAI
    'GEMMA_LOCAL_GGUF',    // Explicitly target Gemma 4 E2B Unsloth GGUF via llama.cpp
    'CLOUD_GEMINI',        // Explicitly target Google Gemini API (online only)
  ]).default('AUTO'),
  connectivity: z.enum(['WIFI', 'CELLULAR', 'ETHERNET', 'CONNECTED', 'OFFLINE']).default('OFFLINE'),
  offlineOnly: z.boolean().default(false).describe('If true, strictly forbids cloud fallback under all circumstances'),
  userConsentCloudFallback: z.boolean().default(false).describe('User consent to transmit data to cloud when offline inference is unavailable'),
  deviceCapabilities: DeviceAICapabilitiesSchema,
});

export type LocalInferenceRequest = z.infer<typeof LocalInferenceRequestSchema>;

/**
 * Structured Output Payload for Local Inference.
 */
export const LocalInferenceOutputSchema = z.object({
  summary: z.string().optional(),
  keyHighlights: z.array(z.string()).optional(),
  keywords: z.array(z.string()).optional(),
  answer: z.string().optional(),
  practicalTips: z.array(z.string()).optional(),
});

export type LocalInferenceOutput = z.infer<typeof LocalInferenceOutputSchema>;

/**
 * Local Inference Response Contract.
 * Guarantees explicit provenance and clear distinction between genuine local execution,
 * unassisted heuristic fallback, and cloud fallback.
 */
export const LocalInferenceResponseSchema = z.object({
  taskId: z.string(),
  success: z.boolean(),
  provenance: ExecutionProvenanceSchema,
  isLocalInference: z.boolean().describe('True ONLY if model executed entirely on-device without cloud network hops'),
  modelUsed: z.string().describe('Model identifier or unassisted fallback description'),
  code: z.string().describe('Structured status code: OK, MODEL_NOT_DOWNLOADED, INSUFFICIENT_AVAILABLE_RAM, UNSUPPORTED_DEVICE, CLOUD_FALLBACK_APPLIED, OFFLINE_FAIL_CLOSED'),
  message: z.string(),
  output: LocalInferenceOutputSchema,
  unassistedFallback: z.boolean().describe('True if response was produced by heuristic/unassisted logic due to local model unavailability'),
  executionDurationMs: z.number().min(0),
  metadata: z.record(z.string(), z.any()).default({}),
});

export type LocalInferenceResponse = z.infer<typeof LocalInferenceResponseSchema>;
