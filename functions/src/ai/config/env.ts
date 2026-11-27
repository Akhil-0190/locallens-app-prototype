/**
 * Environment configuration for AI Services.
 * Reads environment variables safely, ensuring secrets are NEVER exposed in logs or errors.
 */

import dotenv from 'dotenv';
dotenv.config();

export interface AIEnvironmentConfig {
  apiKey: string;
  hasApiKey: boolean;
  defaultModel: string;
  fallbackModel: string;
  embeddingModel: string;
  requestTimeoutMs: number;
  maxRetries: number;
  isProduction: boolean;
}

export function getAIConfig(): AIEnvironmentConfig {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY || '';
  const defaultModel = process.env.GEMINI_DEFAULT_MODEL || 'gemini-3.8-flash';
  const fallbackModel = process.env.GEMINI_FALLBACK_MODEL || 'gemini-3.5-flash-lite';
  const embeddingModel = process.env.GEMINI_EMBEDDING_MODEL || 'gemini-embedding-2';
  const requestTimeoutMs = parseInt(process.env.GEMINI_REQUEST_TIMEOUT_MS || '30000', 10);
  const maxRetries = parseInt(process.env.GEMINI_MAX_RETRIES || '3', 10);
  const isProduction = process.env.NODE_ENV === 'production';

  return {
    apiKey,
    hasApiKey: apiKey.trim().length > 0,
    defaultModel,
    fallbackModel,
    embeddingModel,
    requestTimeoutMs,
    maxRetries,
    isProduction,
  };
}
