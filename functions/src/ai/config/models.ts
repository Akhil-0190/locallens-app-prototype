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
  /** Canonical real API Model ID passed to @google/genai or on-device runtime */
  apiModelId: string;
  /** Human-readable display label */
  displayName: string;
  /** Submitted competition alias / marketing label */
  alias: string;
  /** Primary role or purpose in Neighborhood Guide App */
  primaryUse: string;
  /** Model availability status */
  availability: 'PUBLIC_GA' | 'PUBLIC_PREVIEW' | 'ON_DEVICE_EDGE' | 'LOCAL_RUNTIME' | 'UNAVAILABLE_CLOUD_API';
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
  /** Technical notes and device compatibility */
  notes: string;
}

/**
 * Verified Model Catalog
 * 
 * IMPORTANT:
 * Never invent model IDs. Submitted aliases (e.g. "Gemini 3.8 Flash", "Gemini Embedding 2",
 * "Gemini 3.8 Live", "Gemini Nano", "Gemma 4 E2B") are mapped to actual Google Gemini API
 * model IDs or edge deployment targets.
 */
export const MODEL_REGISTRY: Record<string, AIModelDefinition> = {
  // Verified Live API ID: gemini-3.8-flash
  GEMINI_FLASH_PRIMARY: {
    apiModelId: 'gemini-3.8-flash',
    displayName: 'Gemini 3.8 Flash (Primary Multimodal & Extraction Engine)',
    alias: 'Gemini 3.8 Flash',
    primaryUse: 'Fast multimodal extraction (voice transcripts, photo analysis, authenticity assessment, structured JSON generation)',
    availability: 'PUBLIC_GA',
    contextWindow: {
      inputTokens: 1048576, // 1M tokens
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
        rpm: 1000,
        tpm: 4000000,
        rpd: 100000,
      },
    },
    fallbackModelId: 'gemini-3.5-flash-lite',
    notes: 'Primary server-side workhorse. Maps to submitted label "Gemini 3.8 Flash". Has thinking capabilities enabled.',
  },

  // High-performance operational fallback: gemini-3.5-flash-lite
  GEMINI_FLASH_FALLBACK: {
    apiModelId: 'gemini-3.5-flash-lite',
    displayName: 'Gemini 3.5 Flash-Lite (High-Speed Operational Fallback)',
    alias: 'Gemini 3.5 Flash-Lite',
    primaryUse: 'Immediate fallback if gemini-3.8-flash experiences 503 demand spikes or rate limits',
    availability: 'PUBLIC_GA',
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
    notes: 'Fast, verified GA model. Immediate responsive fallback target for extraction and verification pipelines.',
  },

  // Verified Live API ID: gemini-embedding-2
  GEMINI_EMBEDDING_PRIMARY: {
    apiModelId: 'gemini-embedding-2',
    displayName: 'Gemini Embedding 2',
    alias: 'Gemini Embedding 2',
    primaryUse: 'Generating semantic embeddings for user preferences, place profiles, and solo/group blending',
    availability: 'PUBLIC_GA',
    contextWindow: {
      inputTokens: 2048,
      outputTokens: 0, // Embedding vector output
    },
    capabilities: {
      structuredOutput: false,
      multimodalInput: false,
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
    notes: 'Generates normalized embeddings. Verified live API model ID in project catalog.',
  },

  // Alias: "Gemini 3.8 Live" -> Real API: gemini-2.0-flash-exp (Multimodal Live API)
  GEMINI_LIVE_MULTIMODAL: {
    apiModelId: 'gemini-2.0-flash-exp',
    displayName: 'Gemini 2.0 Flash Multimodal Live (WebSocket/WebRTC)',
    alias: 'Gemini 3.8 Live',
    primaryUse: 'Low-latency bidirectional voice translation, live audio guidance, and conversational assistant',
    availability: 'PUBLIC_PREVIEW',
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
    notes: 'Requires bidirectional WebSocket connection. Rate limits on free tier are strict (3 concurrent sessions / low RPM).',
  },

  // Alias: "Gemini Nano" -> On-device Android AICore
  GEMINI_NANO_ONDEVICE: {
    apiModelId: 'android.aicore.gemini-nano',
    displayName: 'Gemini Nano (Android AICore System Service)',
    alias: 'Gemini Nano',
    primaryUse: 'Zero-latency, offline local extraction, basic keyword tagging, and offline summary on client device',
    availability: 'ON_DEVICE_EDGE',
    contextWindow: {
      inputTokens: 4096,
      outputTokens: 1024,
    },
    capabilities: {
      structuredOutput: false, // Dependent on Android AICore structured prompt heuristics
      multimodalInput: false, // Text-based on standard AICore; multimodal Nano requires Pixel 9+ AICore v2
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
    notes: 'Not a server-side Cloud API. Owned by Developer D for Kotlin Android bridge on supported hardware (Pixel 8+, Samsung S24+). Developer B defines prompt contracts.',
  },

  // Alias: "Gemma 4 E2B" -> Edge/Local Gemma Runtime
  GEMMA_LOCAL_INFERENCE: {
    apiModelId: 'gemma-2-2b-it',
    displayName: 'Gemma 2 2B Instruct (Edge / MediaPipe LLM Inference)',
    alias: 'Gemma 4 E2B',
    primaryUse: 'Cross-platform offline inference on devices without Android AICore, tested via MediaPipe/LiteRT or local runtime',
    availability: 'LOCAL_RUNTIME',
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
    notes: 'Open weights edge model (Gemma 2B quantized). Requires ~1.8GB RAM on device. Evaluated for feasibility by Developer B; client bridge runtime owned by Developer D.',
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
  // Check apiModelId or alias match
  return Object.values(MODEL_REGISTRY).find(
    (m) => m.apiModelId === identifier || m.alias.toLowerCase() === identifier.toLowerCase()
  );
}
