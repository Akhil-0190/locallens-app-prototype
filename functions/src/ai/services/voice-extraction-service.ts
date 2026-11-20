/**
 * Startup Buildathon 2026 — Neighborhood Guide App
 * Task B2: Regional-Language Voice-Note Extraction Service
 * 
 * Implements local voice-note transcription, regional language understanding
 * (Kannada, Tamil, Hindi, Marathi, Telugu, English), and practical-detail extraction
 * using the official @google/genai SDK and Developer A's canonical contracts.
 * 
 * ANTI-HALLUCINATION & INTEGRATION RULES:
 * - Implements directly against Developer A's canonical contracts (Domain 04).
 * - Never hallucinates opening hours, pricing, or directions if not supported by audio.
 * - Missing information remains strictly undefined.
 * - Source attribution to the original contribution is preserved.
 * - Invalid, silent, or low-quality audio fails safely with descriptive errors.
 */

import { GoogleGenAI } from '@google/genai';
import { getAIConfig } from '../config/env.js';
import { executeWithRetry } from '../client/gemini-client.js';
import { cleanJsonResponseText } from '../utils/validator.js';
import {
  ExtractedPracticalDetails,
  ExtractedPracticalDetailsSchema,
  ProcessingStatus,
} from '../../types/contracts/index.js';

export interface VoiceExtractionInput {
  assetId: string;
  contributionId: string;
  contributorId: string;
  /** Audio binary content (base64 string or Buffer) with mimeType, or raw transcript if pre-transcribed */
  media?: {
    base64Data: string;
    mimeType: string; // e.g. "audio/mp4", "audio/m4a", "audio/wav", "audio/mp3", "audio/aac"
  };
  /** Optional text transcript input for testing or fallback pipelines */
  transcriptText?: string;
  /** Contributor language hint if selected in UI (e.g. 'kn-IN', 'ta-IN', 'hi-IN') */
  languageHint?: string;
}

export interface VoiceExtractionOutput {
  assetId: string;
  contributionId: string;
  contributorId: string;
  processingStatus: ProcessingStatus;
  aiExtractionResult: {
    detectedLanguage?: string;
    transcription?: string;
    englishTranslation?: string;
    practicalDetails?: ExtractedPracticalDetails;
    ocrDetectedText?: string[];
    confidenceScore?: number;
  } | null;
  /** Explicit uncertainty and missing-information indicators */
  uncertaintyReport: {
    isMissingOpeningHours: boolean;
    isMissingPricing: boolean;
    isMissingDirections: boolean;
    isLowConfidence: boolean;
    detectedUncertainties: string[];
    unverifiedContributorClaims: string[];
  };
  errorMessage?: string;
  modelUsed: string;
  processedAt: string;
}

/**
 * System instruction enforcing strict extraction, regional cultural fidelity,
 * and zero hallucination of unmentioned facts.
 */
const VOICE_EXTRACTION_SYSTEM_PROMPT = `You are an expert cultural researcher and audio analyst for the Neighborhood Guide App.
Your responsibility is to transcribe and understand community voice-notes recorded by local residents in regional Indian languages (including Kannada, Tamil, Hindi, Marathi, Telugu, and English).

STRICT OPERATIONAL RULES:
1. TRANSCRIPTION: Provide a faithful, verbatim transcription of what was spoken. Retain local neighborhood idioms, vernacular food terms, and colloquial place references.
2. TRANSLATION: Translate the transcription into natural, culturally grounded English that preserves the contributor's intent and nuance.
3. LANGUAGE DETECTION: Identify the primary language and regional code (e.g., 'kn-IN', 'ta-IN', 'hi-IN', 'mr-IN', 'te-IN', 'en').
4. ANTI-HALLUCINATION / MISSING INFORMATION:
   - ONLY extract practical details that were EXPLICITLY spoken in the recording.
   - If opening hours are NOT mentioned, "openingHoursMentioned" MUST BE null. NEVER guess or assume opening hours!
   - If pricing is NOT mentioned, "priceLevelNote" MUST BE null.
   - If the contributor mentions that cards are not accepted, or that only cash or UPI/cash is taken ("card illa", "cash only", "no cards"), set "cashOnlyWarning" to true. Otherwise false.
   - Do NOT invent addresses, directions, or landmark proximities that were not stated.
5. QUALITY & VALIDITY EVALUATION:
   - If the audio is completely silent, corrupt, static noise, unintelligible, or contains completely irrelevant spam (not about a neighborhood, place, or community tip), set "isValidSpotAudio" to false, "confidenceScore" below 0.3, and state the exact issue in "rejectionReason".
   - If valid, set "confidenceScore" between 0.6 and 1.0 based on clarity and specificity.

OUTPUT FORMAT:
Respond with a strict JSON object conforming to this exact structure:
{
  "isValidSpotAudio": boolean,
  "rejectionReason": string or null,
  "detectedLanguage": string (e.g. "kn-IN", "ta-IN", "hi-IN", "en"),
  "transcription": string,
  "englishTranslation": string,
  "practicalDetails": {
    "openingHoursMentioned": string or null,
    "signatureDishesOrItems": string[],
    "priceLevelNote": string or null,
    "cashOnlyWarning": boolean,
    "insiderTips": string[]
  },
  "confidenceScore": number (0.0 to 1.0),
  "unverifiedContributorClaims": string[],
  "uncertainties": string[]
}`;

/**
 * Extracts structured practical details and translations from regional-language voice notes.
 */
export async function extractVoiceNoteDetails(
  input: VoiceExtractionInput
): Promise<VoiceExtractionOutput> {
  const config = getAIConfig();
  const modelId = config.defaultModel; // gemini-3.5-flash-lite (or configured fallback)
  const processedAt = new Date().toISOString();

  // Validate input presence
  if (!input.media && (!input.transcriptText || input.transcriptText.trim().length === 0)) {
    return {
      assetId: input.assetId,
      contributionId: input.contributionId,
      contributorId: input.contributorId,
      processingStatus: 'FAILED',
      aiExtractionResult: null,
      uncertaintyReport: {
        isMissingOpeningHours: true,
        isMissingPricing: true,
        isMissingDirections: true,
        isLowConfidence: true,
        detectedUncertainties: ['No audio media or text content provided in input'],
        unverifiedContributorClaims: [],
      },
      errorMessage: 'Invalid voice note submission: audio media or transcript text is required',
      modelUsed: modelId,
      processedAt,
    };
  }

  // Handle empty or whitespace-only transcript text
  if (input.transcriptText && input.transcriptText.trim().length < 5 && !input.media) {
    return {
      assetId: input.assetId,
      contributionId: input.contributionId,
      contributorId: input.contributorId,
      processingStatus: 'FAILED',
      aiExtractionResult: null,
      uncertaintyReport: {
        isMissingOpeningHours: true,
        isMissingPricing: true,
        isMissingDirections: true,
        isLowConfidence: true,
        detectedUncertainties: ['Input audio transcript is too short or empty to contain meaningful neighborhood details'],
        unverifiedContributorClaims: [],
      },
      errorMessage: 'Voice note is too short or empty (under 5 characters)',
      modelUsed: modelId,
      processedAt,
    };
  }

  try {
    const rawAiResponse = await executeWithRetry(
      modelId,
      async (client: GoogleGenAI) => {
        const contents: any[] = [];

        // Build prompt parts
        const userPrompt = `Analyze this community voice note contribution for spot identification and practical extraction.
${input.languageHint ? `Contributor indicated regional language hint: ${input.languageHint}` : ''}
Contribution ID: ${input.contributionId}
Asset ID: ${input.assetId}

Extract verbatim transcription, cultural translation, and supported practical details.`;

        if (input.media) {
          // Multimodal audio part
          contents.push({
            role: 'user',
            parts: [
              { text: userPrompt },
              {
                inlineData: {
                  mimeType: input.media.mimeType,
                  data: input.media.base64Data,
                },
              },
            ],
          });
        } else {
          // Transcript-based part (for offline, mocked, or pre-transcribed flows)
          contents.push({
            role: 'user',
            parts: [
              {
                text: `${userPrompt}\n\nSpoken Voice Note Content:\n"""\n${input.transcriptText}\n"""`,
              },
            ],
          });
        }

        const response = await client.models.generateContent({
          model: modelId,
          contents,
          config: {
            systemInstruction: VOICE_EXTRACTION_SYSTEM_PROMPT,
            temperature: 0.1, // Strict factual adherence
            responseMimeType: 'application/json',
          },
        });

        return response.text || '';
      },
      config.maxRetries
    );

    const cleanedJson = cleanJsonResponseText(rawAiResponse);
    let parsed: any;
    try {
      parsed = JSON.parse(cleanedJson);
    } catch (parseErr: any) {
      throw new Error(`Failed to parse AI response as JSON: ${parseErr.message}`);
    }

    // Check if the AI marked the audio as invalid/corrupt/silent
    if (parsed.isValidSpotAudio === false) {
      return {
        assetId: input.assetId,
        contributionId: input.contributionId,
        contributorId: input.contributorId,
        processingStatus: 'FAILED',
        aiExtractionResult: null,
        uncertaintyReport: {
          isMissingOpeningHours: true,
          isMissingPricing: true,
          isMissingDirections: true,
          isLowConfidence: true,
          detectedUncertainties: parsed.uncertainties || [parsed.rejectionReason || 'Invalid audio'],
          unverifiedContributorClaims: [],
        },
        errorMessage: parsed.rejectionReason || 'Audio is unintelligible, silent, or unrelated to neighborhood spots',
        modelUsed: modelId,
        processedAt,
      };
    }

    // Map and validate practical details using Developer A's canonical ExtractedPracticalDetailsSchema
    const rawPractical = parsed.practicalDetails || {};
    const practicalDetails: ExtractedPracticalDetails = ExtractedPracticalDetailsSchema.parse({
      openingHoursMentioned: rawPractical.openingHoursMentioned || undefined,
      signatureDishesOrItems: Array.isArray(rawPractical.signatureDishesOrItems)
        ? rawPractical.signatureDishesOrItems
        : [],
      priceLevelNote: rawPractical.priceLevelNote || undefined,
      cashOnlyWarning: Boolean(rawPractical.cashOnlyWarning),
      insiderTips: Array.isArray(rawPractical.insiderTips) ? rawPractical.insiderTips : [],
    });

    const confidenceScore = typeof parsed.confidenceScore === 'number'
      ? Math.max(0, Math.min(1, parsed.confidenceScore))
      : 0.85;

    const isMissingHours = practicalDetails.openingHoursMentioned === undefined;
    const isMissingPrice = practicalDetails.priceLevelNote === undefined;
    const isLowConfidence = confidenceScore < 0.6;

    const detectedUncertainties: string[] = Array.isArray(parsed.uncertainties) ? parsed.uncertainties : [];
    if (isMissingHours) {
      detectedUncertainties.push('Opening hours not stated in voice recording');
    }
    if (isMissingPrice) {
      detectedUncertainties.push('Pricing details not stated in voice recording');
    }
    if (isLowConfidence) {
      detectedUncertainties.push('Low extraction confidence: audio clarity or ambient noise requires manual verification');
    }

    return {
      assetId: input.assetId,
      contributionId: input.contributionId,
      contributorId: input.contributorId,
      processingStatus: isLowConfidence && confidenceScore < 0.3 ? 'FAILED' : 'COMPLETED',
      aiExtractionResult: {
        detectedLanguage: parsed.detectedLanguage || input.languageHint || 'en',
        transcription: parsed.transcription || input.transcriptText || '',
        englishTranslation: parsed.englishTranslation || parsed.transcription || '',
        practicalDetails,
        ocrDetectedText: [], // Audio does not produce OCR text
        confidenceScore,
      },
      uncertaintyReport: {
        isMissingOpeningHours: isMissingHours,
        isMissingPricing: isMissingPrice,
        isMissingDirections: !parsed.transcription?.toLowerCase().includes('near') && !parsed.transcription?.toLowerCase().includes('opposite'),
        isLowConfidence,
        detectedUncertainties,
        unverifiedContributorClaims: Array.isArray(parsed.unverifiedContributorClaims)
          ? parsed.unverifiedContributorClaims
          : [],
      },
      modelUsed: modelId,
      processedAt,
    };
  } catch (error: any) {
    return {
      assetId: input.assetId,
      contributionId: input.contributionId,
      contributorId: input.contributorId,
      processingStatus: 'FAILED',
      aiExtractionResult: null,
      uncertaintyReport: {
        isMissingOpeningHours: true,
        isMissingPricing: true,
        isMissingDirections: true,
        isLowConfidence: true,
        detectedUncertainties: [`AI processing error: ${error.message}`],
        unverifiedContributorClaims: [],
      },
      errorMessage: `Voice extraction failed: ${error.message}`,
      modelUsed: modelId,
      processedAt,
    };
  }
}
