/**
 * Model Selection and Fallback Orchestrator.
 * Transparently cascades to fallback models if primary model hits rate limits or unavailability.
 */

import { GoogleGenAI } from '@google/genai';
import { executeWithRetry, getGeminiClient } from '../client/gemini-client.js';
import { resolveModelDefinition, MODEL_REGISTRY } from '../config/models.js';
import { getAIConfig } from '../config/env.js';
import { validateStructuredOutput, zodToJsonSchema } from '../utils/validator.js';
import { ZodSchema } from 'zod';
import { AIBaseError } from '../errors/ai-errors.js';

export interface ModelExecutionResult<T> {
  data: T;
  rawText: string;
  modelUsed: string;
  fallbackTriggered: boolean;
  attemptsCount: number;
}

export interface GenerateStructuredOptions<T> {
  primaryModelId?: string;
  fallbackModelId?: string;
  systemInstruction?: string;
  prompt: string;
  schema: ZodSchema<T>;
  temperature?: number;
}

/**
 * Executes a structured content generation request.
 * Enforces JSON response schema, performs Zod validation, and executes model fallback on failure.
 */
export async function generateStructuredContentWithFallback<T>(
  options: GenerateStructuredOptions<T>
): Promise<ModelExecutionResult<T>> {
  const config = getAIConfig();
  const primaryModel = options.primaryModelId || config.defaultModel;
  const primaryDef = resolveModelDefinition(primaryModel);
  const fallbackModel = options.fallbackModelId || primaryDef?.fallbackModelId || config.fallbackModel;

  const jsonSchema = zodToJsonSchema(options.schema);

  // Helper to run a generation call on a specific model ID
  const runModelCall = async (modelId: string) => {
    return await executeWithRetry(
      modelId,
      async (client: GoogleGenAI) => {
        const response = await client.models.generateContent({
          model: modelId,
          contents: options.prompt,
          config: {
            systemInstruction: options.systemInstruction,
            temperature: options.temperature ?? 0.2, // Low temperature for deterministic structured extraction
            responseMimeType: 'application/json',
            responseSchema: jsonSchema as any,
          },
        });

        const text = response.text || '';
        const validated = validateStructuredOutput(text, options.schema);
        return { data: validated, rawText: text };
      },
      config.maxRetries
    );
  };

  // Attempt 1: Primary Model
  try {
    const result = await runModelCall(primaryModel);
    return {
      data: result.data,
      rawText: result.rawText,
      modelUsed: primaryModel,
      fallbackTriggered: false,
      attemptsCount: 1,
    };
  } catch (primaryError: any) {
    // If error is retryable (e.g. rate limit / unavailable) and a fallback model is configured
    if (primaryError instanceof AIBaseError && primaryError.retryable && fallbackModel && fallbackModel !== primaryModel) {
      console.warn(
        `[AI Fallback] Primary model "${primaryModel}" failed (${primaryError.code}). Cascading to fallback model "${fallbackModel}"...`
      );

      try {
        const fallbackResult = await runModelCall(fallbackModel);
        return {
          data: fallbackResult.data,
          rawText: fallbackResult.rawText,
          modelUsed: fallbackModel,
          fallbackTriggered: true,
          attemptsCount: 2,
        };
      } catch (fallbackError: any) {
        console.error(`[AI Fallback] Fallback model "${fallbackModel}" also failed:`, fallbackError);
        throw fallbackError;
      }
    }

    // Not retryable or no fallback available
    throw primaryError;
  }
}
