/**
 * Startup Buildathon 2026 — Neighborhood Guide App
 * AI Model Configuration & Registry
 * 
 * Central registry mapping submitted model aliases to real, verified Google Gemini API model IDs.
 * Documents quotas, rate limits, context windows, and operational constraints.
 */

export interface ModelCapability {
  structuredOutput: boolean;
  multimodalInput: boolean; // text, image, audio, video
  audioOutput: boolean;
  embeddings: boolean;
  localOnDevice: boolean;
  systemInstructions: boolean;
}

export interface QuotaProfile {
  freeTier: {
    rpm: number; // Requests Per Minute
    tpm: number; // Tokens Per Minute
    rpd: number; // Requests Per Day
  };
  payAsYouGoTier1?: {
    rpm: number;
    tpm: number;
    rpd: number;
  };
}

export interface AIModelDefinition {
  /** Canonical real API Model ID passed to @google/genai, or explicit edge runtime designation */
  apiModelId: string;
  /** Human-readable display label */
  displayName: string;
  /** Submitted competition alias / marketing label */
  alias: string;
  /** Primary role or purpose in Neighborhood Guide App */
  primaryUse: string;
  /** Model availability status */
  availability: 'PUBLIC_GA' | 'PUBLIC_PREVIEW' | 'ON_DEVICE_EDGE' | 'LOCAL_RUNTIME' | 'UNAVAILABLE_CLOUD_API';
  /** Explicit verification and testing status */
  testStatus: 'LIVE_TESTED_VERIFIED' | 'CATALOG_VERIFIED_UNTESTED' | 'UNTESTED_ENDPOINT' | 'DOCUMENTED_EDGE_SPEC';
  /** Token context window limits */
  contextWindow: {
    inputTokens: number;
    outputTokens: number;
  };
  /** Model capabilities */
  capabilities: ModelCapability;
  /** Rate limits and quotas */
  quotas: QuotaProfile;
  /** Fallback model ID if this model is rate-limited or unavailable */
  fallbackModelId?: string;
  /** Technical notes, device compatibility, and integration boundaries */
  notes: string;
}

/**
 * Central Model Registry
 * 
 * SEPARATION OF CAPABILITIES:
 * - LIVE_TESTED_VERIFIED: Successfully executed and validated against Google Gemini API with live credentials.
 * - CATALOG_VERIFIED_UNTESTED: Confirmed present in the live API model catalog, but not live-tested in B1.
 * - UNTESTED_ENDPOINT: Configured target endpoint (e.g. WebSocket Live API), not live-tested in B1.
 * - DOCUMENTED_EDGE_SPEC: On-device or edge model specifications with documented runtime architectures, not cloud API endpoints.
 */
export const MODEL_REGISTRY: Record<string, AIModelDefinition> = {
  // Verified in Live API Catalog: gemini-3.8-flash
  GEMINI_FLASH_PRIMARY: {
    apiModelId: 'gemini-3.8-flash',
    displayName: 'Gemini 3.8 Flash (Primary Multimodal & Extraction Engine)',
    alias: 'Gemini 3.8 Flash',
    primaryUse: 'Complex multimodal extraction, photo analysis, authenticity assessment, and structured JSON generation',
    availability: 'PUBLIC_GA',
    testStatus: 'CATALOG_VERIFIED_UNTESTED',
    contextWindow: {
      inputTokens: 1048576, // 1M tokens
      outputTokens: 65536,
    },
    capabilities: {
      structuredOutput: true,
      multimodalInput: true,
      audioOutput: false,
      embeddings: false,
      localOnDevice: false,
      systemInstructions: true,
    },
    quotas: {
      freeTier: {
        rpm: 15,
        tpm: 1000000,
        rpd: 1500,
      },
      payAsYouGoTier1: {
        rpm: 1000,
        tpm: 4000000,
        rpd: 100000,
      },
    },
    fallbackModelId: 'gemini-3.5-flash-lite',
    notes: 'Primary reasoning engine. Confirmed present in live API catalog with thinking: true. Exhibits 503 high-demand spikes under peak load; cascades to fallback.',
  },

  // Live Tested & Verified Workhorse: gemini-3.5-flash-lite
  GEMINI_FLASH_FALLBACK: {
    apiModelId: 'gemini-3.5-flash-lite',
    displayName: 'Gemini 3.5 Flash-Lite (High-Speed Operational Engine)',
    alias: 'Gemini 3.5 Flash-Lite',
    primaryUse: 'High-throughput operational extractions and immediate fallback when primary model experiences 503 spikes or 429 rate limits',
    availability: 'PUBLIC_GA',
    testStatus: 'LIVE_TESTED_VERIFIED',
    contextWindow: {
      inputTokens: 1048576,
      outputTokens: 8192,
    },
    capabilities: {
      structuredOutput: true,
      multimodalInput: true,
      audioOutput: false,
      embeddings: false,
      localOnDevice: false,
      systemInstructions: true,
    },
    quotas: {
      freeTier: {
        rpm: 15,
        tpm: 1000000,
        rpd: 1500,
      },
      payAsYouGoTier1: {
        rpm: 2000,
        tpm: 4000000,
        rpd: 100000,
      },
    },
    fallbackModelId: 'gemini-3.1-flash-lite',
    notes: 'LIVE TESTED & VERIFIED (2.6s latency). Generates structured JSON adhering to Zod schema.',
  },

  // Live Tested & Verified Embedding Model: gemini-embedding-2
  GEMINI_EMBEDDING_PRIMARY: {
    apiModelId: 'gemini-embedding-2',
    displayName: 'Gemini Embedding 2',
    alias: 'Gemini Embedding 2',
    primaryUse: 'Generating 3,072-dimensional semantic embeddings for place profiles, user preferences, and solo/group blending',
    availability: 'PUBLIC_GA',
    testStatus: 'LIVE_TESTED_VERIFIED',
    contextWindow: {
      inputTokens: 8192,
      outputTokens: 0, // Embedding vector output
    },
    capabilities: {
      structuredOutput: false,
      multimodalInput: true,
      audioOutput: false,
      embeddings: true,
      localOnDevice: false,
      systemInstructions: false,
    },
    quotas: {
      freeTier: {
        rpm: 1500,
        tpm: 1000000,
        rpd: 10000,
      },
      payAsYouGoTier1: {
        rpm: 3000,
        tpm: 4000000,
        rpd: 500000,
      },
    },
    notes: 'LIVE TESTED & VERIFIED. Produces normalized 3,072-dim multimodal vectors for cosine similarity operations.',
  },

  // Frozen Architecture Commitment: Gemini 3.8 Live (Bidirectional Streaming)
  GEMINI_LIVE_MULTIMODAL: {
    apiModelId: 'gemini-3.8-live',
    displayName: 'Gemini 3.8 Live (Bidirectional Streaming)',
    alias: 'Gemini 3.8 Live',
    primaryUse: 'Low-latency bidirectional voice translation, live audio guidance, and conversational assistant via WebSocket BidiGenerateContentConstrained',
    availability: 'PUBLIC_PREVIEW',
    testStatus: 'UNTESTED_ENDPOINT',
    contextWindow: {
      inputTokens: 1048576,
      outputTokens: 8192,
    },
    capabilities: {
      structuredOutput: false, // Streaming audio/text dialog
      multimodalInput: true,
      audioOutput: true,
      embeddings: false,
      localOnDevice: false,
      systemInstructions: true,
    },
    quotas: {
      freeTier: {
        rpm: 3,
        tpm: 500000,
        rpd: 500,
      },
    },
    notes: 'Frozen architectural model for real-time spoken translation and conversational assistance. Access through Google Gemini Enterprise Agent Platform or Developer API endpoints is unverified; marked explicitly as UNTESTED_ENDPOINT pending live provider verification.',
  },

  // Clarified: Gemini Nano on-device via Android AICore / ML Kit
  GEMINI_NANO_ONDEVICE: {
    apiModelId: 'N/A (On-Device AICore)',
    displayName: 'Gemini Nano (Android AICore / ML Kit System Service)',
    alias: 'Gemini Nano',
    primaryUse: 'Zero-latency offline text extraction, basic keyword tagging, and offline summary on client device',
    availability: 'ON_DEVICE_EDGE',
    testStatus: 'DOCUMENTED_EDGE_SPEC',
    contextWindow: {
      inputTokens: 4096,
      outputTokens: 1024,
    },
    capabilities: {
      structuredOutput: false, // Prompt heuristic constrained
      multimodalInput: false, // Standard AICore v1 is text-centric; multimodal requires Pixel 9+ AICore v2
      audioOutput: false,
      embeddings: false,
      localOnDevice: true,
      systemInstructions: true,
    },
    quotas: {
      freeTier: {
        rpm: Infinity, // On-device hardware constrained
        tpm: Infinity,
        rpd: Infinity,
      },
    },
    notes: 'NOT A CLOUD API MODEL ID. Integrates via Android system service (com.google.android.aicore) and Google ML Kit GenAI client on Android 14+. Device-constrained to supported hardware (Pixel 8+, Galaxy S24+). Developer B defines prompt contracts; Android Kotlin implementation owned by Developer D.',
  },

  // Corrected: Gemma 4 E2B edge runtime artifact
  GEMMA_LOCAL_INFERENCE: {
    apiModelId: 'gemma-4-e2b',
    displayName: 'Gemma 4 E2B (Edge Runtime Model Artifact)',
    alias: 'Gemma 4 E2B',
    primaryUse: 'Cross-platform offline inference on devices without Android AICore, tested via MediaPipe LLM Inference or LiteRT',
    availability: 'LOCAL_RUNTIME',
    testStatus: 'DOCUMENTED_EDGE_SPEC',
    contextWindow: {
      inputTokens: 2048,
      outputTokens: 1024,
    },
    capabilities: {
      structuredOutput: true,
      multimodalInput: false,
      audioOutput: false,
      embeddings: false,
      localOnDevice: true,
      systemInstructions: true,
    },
    quotas: {
      freeTier: {
        rpm: Infinity,
        tpm: Infinity,
        rpd: Infinity,
      },
    },
    notes: 'Edge open-weights model artifact (Gemma 4 E2B, e.g. .task / .bin) for MediaPipe LLM Inference / LiteRT runtime. Not a server-side @google/genai API endpoint. Requires ~1.8GB-2.2GB RAM on device. Untested local artifact; client runtime integration owned by Developer D.',
  },
};

/**
 * Helper to resolve an alias or API ID to the concrete Model Definition
 */
export function resolveModelDefinition(identifier: string): AIModelDefinition | undefined {
  // Check exact key match
  if (MODEL_REGISTRY[identifier]) {
    return MODEL_REGISTRY[identifier];
  }
  const idLower = identifier.toLowerCase();
  // Check apiModelId, alias match, or legacy alias match
  return Object.values(MODEL_REGISTRY).find(
    (m) =>
      m.apiModelId === identifier ||
      m.alias.toLowerCase() === idLower ||
      (m === MODEL_REGISTRY.GEMINI_LIVE_MULTIMODAL && idLower === 'gemini 3.8 live')
  );
}
