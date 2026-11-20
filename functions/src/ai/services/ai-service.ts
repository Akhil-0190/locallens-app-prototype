/**
 * High-Level AI Service Interfaces
 * Provides entry points for Developer B's core capabilities:
 * - Foundation testing & API validation
 * - Authenticity & Tourist Trap Assessment
 * - Practical detail extraction
 * - Text embeddings
 */

import { generateStructuredContentWithFallback, ModelExecutionResult } from './model-orchestrator.js';
import {
  FoundationTestSchema,
  FoundationTest,
  AuthenticityAssessmentSchema,
  AuthenticityAssessment,
  VoicePhotoExtractionSchema,
  VoicePhotoExtraction,
} from '../schemas/types.js';
import { executeWithRetry } from '../client/gemini-client.js';
import { getAIConfig } from '../config/env.js';

export {
  extractVoiceNoteDetails,
  VoiceExtractionInput,
  VoiceExtractionOutput,
} from './voice-extraction-service.js';

export {
  extractPhotoDetails,
  PhotoExtractionInput,
  PhotoExtractionOutput,
} from './photo-extraction-service.js';

export {
  synthesizeSpotCard,
  SpotCardSynthesisInput,
} from './spot-card-synthesis-service.js';

/**
 * 1. Foundation Verification Call
 * Runs a small, verified model call to test authorized credentials and structured schema return.
 */
export async function testModelFoundation(
  testMessage: string = 'Startup Buildathon 2026 Developer B Foundation Verification'
): Promise<ModelExecutionResult<FoundationTest>> {
  return await generateStructuredContentWithFallback<FoundationTest>({
    prompt: `You are verifying the AI Model Foundation for Startup Buildathon 2026.
Respond to this test request: "${testMessage}".
Return a strictly formatted JSON response acknowledging your active model ID, operational status, and verification capabilities.`,
    schema: FoundationTestSchema,
    systemInstruction:
      'You are the AI engine for Neighborhood Guide App. Always output strictly valid JSON conforming to the requested schema.',
    temperature: 0.1,
  });
}

/**
 * 2. Authenticity & Tourist Trap Assessment
 * Evaluates local vs tourist signals, pricing inflation, and cultural authenticity.
 */
export async function assessAuthenticity(
  placeName: string,
  contextEvidence: string
): Promise<ModelExecutionResult<AuthenticityAssessment>> {
  const prompt = `Assess the authenticity and tourist-trap risk for the following place in the neighborhood:
Place Name: "${placeName}"
Evidence & Background:
${contextEvidence}

Analyze local resident perception, commercialization, pricing, and timing advice. Return the structured assessment.`;

  return await generateStructuredContentWithFallback<AuthenticityAssessment>({
    prompt,
    schema: AuthenticityAssessmentSchema,
    systemInstruction:
      'You are an expert cultural researcher evaluating neighborhood authenticity. Provide objective, un-hyped assessments.',
    temperature: 0.2,
  });
}

/**
 * 3. Voice & Photo Practical Detail Extraction
 * Transcribes and extracts actionable ground details from regional voice notes or OCR text.
 */
export async function extractPracticalDetails(
  rawTranscriptOrOcr: string,
  languageHint?: string
): Promise<ModelExecutionResult<VoicePhotoExtraction>> {
  const prompt = `Extract practical details and translate to English if needed:
Content:
"""
${rawTranscriptOrOcr}
"""
${languageHint ? `Language Hint: ${languageHint}` : ''}

Extract opening hours, signature specialties, payment methods, insider tips, and assess authenticity signals.`;

  return await generateStructuredContentWithFallback<VoicePhotoExtraction>({
    prompt,
    schema: VoicePhotoExtractionSchema,
    systemInstruction:
      'You are an on-the-ground neighborhood reporter extracting hyper-practical details from local audio notes and images.',
    temperature: 0.1,
  });
}

/**
 * 4. Semantic Text Embedding Generation
 * Calls the verified embedding model (text-embedding-004) to produce 768-dim vector embeddings.
 */
export async function generateTextEmbedding(text: string): Promise<number[]> {
  const config = getAIConfig();
  const embeddingModel = config.embeddingModel;

  return await executeWithRetry(
    embeddingModel,
    async (client) => {
      const response = await client.models.embedContent({
        model: embeddingModel,
        contents: text,
      });

      const values = response.embeddings?.[0]?.values;
      if (!values || values.length === 0) {
        throw new Error('Embedding response did not contain vector values.');
      }

      return values;
    },
    config.maxRetries
  );
}
