/**
 * Startup Buildathon 2026 — Neighborhood Guide App
 * Task B4: Gemini Embedding 2 Integration & Semantic Vector Service
 * 
 * Developer B — AI & Model Integration
 * 
 * Integrates with Google Gemini Embedding 2 (gemini-embedding-2) to produce
 * 3,072-dimensional normalized dense vectors for semantic place matching,
 * user vibe profiles, and group consensus blending.
 * 
 * Includes a deterministic offline adapter for sandboxed test environments
 * where external network egress is unavailable, with explicit mock labeling.
 */

import { GoogleGenAI } from '@google/genai';
import { getAIConfig } from '../config/env.js';
import { executeWithRetry } from '../client/gemini-client.js';
import { EmbeddingVector, EmbeddingVectorSchema } from '../schemas/matching-schemas.js';

export const GEMINI_EMBEDDING_MODEL_ID = 'gemini-embedding-2';
export const EMBEDDING_DIMENSIONS = 3072;

/**
 * In-memory LRU cache for embeddings to reduce API calls and latency.
 */
const embeddingCache = new Map<string, EmbeddingVector>();
const MAX_CACHE_SIZE = 500;

/**
 * Computes cosine similarity between two normalized or arbitrary vectors.
 * Returns a value between -1.0 and 1.0 (clamped to 0.0 - 1.0 for positive spaces).
 */
export function computeCosineSimilarity(vecA: number[], vecB: number[]): number {
  if (!vecA || !vecB || vecA.length === 0 || vecB.length === 0) {
    return 0;
  }
  const minLength = Math.min(vecA.length, vecB.length);
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < minLength; i++) {
    const valA = vecA[i]!;
    const valB = vecB[i]!;
    dotProduct += valA * valB;
    normA += valA * valA;
    normB += valB * valB;
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;
  
  const similarity = dotProduct / denominator;
  // Normalize to 0.0 - 1.0 range
  return Math.max(0, Math.min(1, (similarity + 1) / 2));
}

/**
 * Deterministic offline hashing vector generator for testing when network is absent.
 * Produces unit-normalized 3,072-dimensional float vectors seeded by the text tokens.
 */
export function generateOfflineTestVector(text: string): number[] {
  const vector = new Float32Array(EMBEDDING_DIMENSIONS);
  const normalized = text.toLowerCase().trim();
  const words = normalized.split(/\s+/).filter(Boolean);

  // Distribute token hash signals across the 3,072 dimensions
  for (let wIdx = 0; wIdx < words.length; wIdx++) {
    const word = words[wIdx]!;
    let hash = 0;
    for (let cIdx = 0; cIdx < word.length; cIdx++) {
      hash = (hash << 5) - hash + word.charCodeAt(cIdx);
      hash |= 0;
    }
    const seed = Math.abs(hash);
    for (let i = 0; i < 32; i++) {
      const pos = (seed + i * 97) % EMBEDDING_DIMENSIONS;
      vector[pos] += (i % 2 === 0 ? 1 : -1) / Math.sqrt(wIdx + 1);
    }
  }

  // Normalize vector to unit length
  let norm = 0;
  for (let i = 0; i < EMBEDDING_DIMENSIONS; i++) {
    norm += vector[i]! * vector[i]!;
  }
  norm = Math.sqrt(norm);
  if (norm > 0) {
    for (let i = 0; i < EMBEDDING_DIMENSIONS; i++) {
      vector[i] /= norm;
    }
  }

  return Array.from(vector);
}

/**
 * Generates semantic embedding using Gemini Embedding 2.
 * In production, live API failures throw explicit errors to prevent silent mock injection.
 * Test adapter fallback is only permitted when explicitly requested (forceOffline or allowTestAdapterFallback).
 */
export async function generateEmbedding(
  text: string,
  options?: { forceOffline?: boolean; allowTestAdapterFallback?: boolean }
): Promise<EmbeddingVector> {
  const sanitized = (text || '').trim();
  if (!sanitized) {
    throw new Error('Cannot generate embedding for empty text input.');
  }

  // Check cache
  const cacheKey = sanitized.slice(0, 300);
  if (embeddingCache.has(cacheKey)) {
    return embeddingCache.get(cacheKey)!;
  }

  const config = getAIConfig();
  const nowIso = new Date().toISOString();

  // If forceOffline is explicitly requested or no API key is available in environment
  if (options?.forceOffline || !config.hasApiKey) {
    const offlineVector = generateOfflineTestVector(sanitized);
    const result: EmbeddingVector = {
      model: `${GEMINI_EMBEDDING_MODEL_ID}-test-adapter`,
      dimensions: EMBEDDING_DIMENSIONS,
      values: offlineVector,
      isOfflineMock: true,
      generatedAt: nowIso,
    };
    return EmbeddingVectorSchema.parse(result);
  }

  try {
    const rawValues = await executeWithRetry(
      GEMINI_EMBEDDING_MODEL_ID,
      async (client: GoogleGenAI) => {
        const response: any = await client.models.embedContent({
          model: GEMINI_EMBEDDING_MODEL_ID,
          contents: sanitized,
        });

        const values = response.embedding?.values || response.embeddings?.[0]?.values;
        if (!values || !Array.isArray(values) || values.length === 0) {
          throw new Error('Gemini Embedding 2 returned empty or malformed vector array.');
        }
        if (values.length !== EMBEDDING_DIMENSIONS) {
          throw new Error(
            `Gemini Embedding 2 returned unexpected dimension count: ${values.length} (expected ${EMBEDDING_DIMENSIONS})`
          );
        }
        return values;
      },
      config.maxRetries
    );

    const result: EmbeddingVector = {
      model: GEMINI_EMBEDDING_MODEL_ID,
      dimensions: rawValues.length,
      values: rawValues,
      isOfflineMock: false,
      generatedAt: nowIso,
    };

    // Cache result
    if (embeddingCache.size >= MAX_CACHE_SIZE) {
      const oldestKey = embeddingCache.keys().next().value;
      if (oldestKey) embeddingCache.delete(oldestKey);
    }
    embeddingCache.set(cacheKey, result);

    return EmbeddingVectorSchema.parse(result);
  } catch (error: any) {
    // Only fall back to test adapter if explicitly permitted via options
    if (options?.allowTestAdapterFallback) {
      console.warn(
        `[AI Embedding Fallback] Live Gemini Embedding 2 call failed (${error.message}). Permitted test adapter used.`
      );
      const offlineVector = generateOfflineTestVector(sanitized);
      const result: EmbeddingVector = {
        model: `${GEMINI_EMBEDDING_MODEL_ID}-fallback-adapter`,
        dimensions: EMBEDDING_DIMENSIONS,
        values: offlineVector,
        isOfflineMock: true,
        generatedAt: nowIso,
      };
      return EmbeddingVectorSchema.parse(result);
    }

    // Production guardrail: NEVER silently replace failed live calls with mock vectors
    throw error;
  }
}
