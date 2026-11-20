/**
 * Centralized Gemini Client Wrapper using @google/genai
 * Handles client instantiation, request timeouts, and exponential backoff retry.
 */

import { GoogleGenAI } from '@google/genai';
import { getAIConfig } from '../config/env.js';
import {
  AIAuthenticationError,
  AIRateLimitError,
  AIModelUnavailableError,
  AITimeoutError,
  AIBaseError,
} from '../errors/ai-errors.js';

let cachedClient: GoogleGenAI | null = null;

/**
 * Returns a singleton instance of GoogleGenAI using configured credentials.
 * Throws AIAuthenticationError if API key is not present.
 */
export function getGeminiClient(): GoogleGenAI {
  if (cachedClient) {
    return cachedClient;
  }

  const config = getAIConfig();
  if (!config.hasApiKey) {
    throw new AIAuthenticationError(
      'Cannot initialize GoogleGenAI client: GEMINI_API_KEY environment variable is not set.'
    );
  }

  cachedClient = new GoogleGenAI({
    apiKey: config.apiKey,
  });

  return cachedClient;
}

/**
 * Helper delay function for exponential backoff
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Normalizes raw SDK/network errors into typed AI errors.
 */
export function normalizeApiError(error: any, modelId: string): AIBaseError {
  const message = error?.message || String(error);
  const status = error?.status || error?.statusCode;

  // 401/403 Invalid API key or permission denied
  if (status === 401 || status === 403 || message.includes('API_KEY_INVALID') || message.includes('API key not valid')) {
    return new AIAuthenticationError(`Authentication failed: ${message}`);
  }

  // 429 Quota or rate limit exceeded
  if (status === 429 || message.includes('RESOURCE_EXHAUSTED') || message.includes('quota') || message.includes('rate limit')) {
    return new AIRateLimitError(`Rate limit exceeded for model "${modelId}": ${message}`);
  }

  // 503 / 500 / Unavailable
  if (status === 503 || status === 500 || message.includes('UNAVAILABLE') || message.includes('high demand')) {
    return new AIModelUnavailableError(modelId, `Model "${modelId}" is temporarily unavailable: ${message}`);
  }

  if (message.includes('deadline exceeded') || message.includes('timed out')) {
    return new AITimeoutError(`Request timed out for model "${modelId}": ${message}`);
  }

  return new AIBaseError(message, 'AI_CALL_FAILED', status, false);
}

/**
 * Executes a Gemini API call with exponential backoff and timeout handling.
 */
export async function executeWithRetry<T>(
  modelId: string,
  operation: (client: GoogleGenAI) => Promise<T>,
  maxRetries: number = 3,
  initialBackoffMs: number = 1000
): Promise<T> {
  const client = getGeminiClient();
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      return await operation(client);
    } catch (err: any) {
      attempt++;
      const normalizedError = normalizeApiError(err, modelId);

      // Only retry if marked retryable and attempts remain
      if (normalizedError.retryable && attempt < maxRetries) {
        const backoffMs = initialBackoffMs * Math.pow(2, attempt - 1) + Math.random() * 200;
        console.warn(
          `[AI Retry] Attempt ${attempt} failed for model "${modelId}" (${normalizedError.code}). Retrying in ${Math.round(backoffMs)}ms...`
        );
        await sleep(backoffMs);
      } else {
        throw normalizedError;
      }
    }
  }

  throw new AIBaseError(`Operation failed after ${maxRetries} attempts for model "${modelId}".`, 'AI_RETRIES_EXHAUSTED');
}
