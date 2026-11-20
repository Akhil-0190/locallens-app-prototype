/**
 * Startup Buildathon 2026 — Neighborhood Guide App
 * Task B2: Multimodal Photo Understanding & OCR Extraction Service
 * 
 * Implements street signage OCR, storefront analysis, menu card parsing,
 * and visual authenticity assessment using @google/genai and Developer A's contracts.
 * 
 * ANTI-HALLUCINATION & INTEGRATION RULES:
 * - Implements directly against Developer A's canonical contracts (Domain 04).
 * - OCR text is strictly grounded in what is visible on boards/signage.
 * - Missing information remains strictly undefined (no fabricated hours/prices).
 * - Handles low-quality, blurry, or irrelevant images safely with error codes.
 * - Distinguishes visual evidence from speculation.
 */

import { GoogleGenAI } from '@google/genai';
import { getAIConfig } from '../config/env.js';
import { executeWithRetry } from '../client/gemini-client.js';
import { cleanJsonResponseText } from '../utils/validator.js';
import {
  AssetType,
  ExtractedPracticalDetails,
  ExtractedPracticalDetailsSchema,
  ProcessingStatus,
} from '../../types/contracts/index.js';

export interface PhotoExtractionInput {
  assetId: string;
  contributionId: string;
  assetType: AssetType; // 'STREET_PHOTO' | 'MENU_PHOTO' | 'STOREFRONT_PHOTO'
  /** Multimodal image payload (base64 string) */
  media?: {
    base64Data: string;
    mimeType: string; // e.g. "image/jpeg", "image/png", "image/webp"
  };
  /** Pre-extracted OCR hints or text description for offline/mock test paths */
  imageDescriptionOrOcrHint?: string;
}

export interface PhotoExtractionOutput {
  assetId: string;
  contributionId: string;
  assetType: AssetType;
  processingStatus: ProcessingStatus;
  aiExtractionResult: {
    detectedLanguage?: string;
    transcription?: string;
    englishTranslation?: string;
    practicalDetails?: ExtractedPracticalDetails;
    ocrDetectedText?: string[];
    confidenceScore?: number;
  } | null;
  /** Visual authenticity indicators detected in the photo */
  visualAuthenticityIndicators: {
    hasGenerationalOrTraditionalSignage: boolean;
    hasTraditionalCulinaryEquipment: boolean;
    hasCommercialTouristKitschness: boolean;
    hasClearNameBoard: boolean;
    observedVibeTags: string[];
  };
  /** Explicit uncertainty and missing-information indicators */
  uncertaintyReport: {
    isMissingOpeningHours: boolean;
    isMissingPricing: boolean;
    isBlurryOrLowQuality: boolean;
    isNonNeighborhoodSubject: boolean;
    detectedUncertainties: string[];
  };
  errorMessage?: string;
  modelUsed: string;
  processedAt: string;
}

const PHOTO_EXTRACTION_SYSTEM_PROMPT = `You are a computer vision and cultural researcher for the Neighborhood Guide App.
Your responsibility is to analyze community photos taken of neighborhood spots (storefronts, street signboards in regional scripts like Kannada/Tamil/Hindi/English, and menu cards).

STRICT OPERATIONAL RULES:
1. OCR TEXT DETECTION: Extract all visible text from signage, boards, chalkboards, and menus verbatim into "ocrDetectedText".
2. PRACTICAL DETAILS:
   - Extract opening hours ONLY if explicitly written on the board/door (e.g. "Timings: 7am to 11am"). Otherwise "openingHoursMentioned" MUST BE null!
   - Extract dish/item names visible on boards/menus into "signatureDishesOrItems".
   - Extract prices only if printed/written on the board into "priceLevelNote". Otherwise null!
   - Check for visible cash-only or UPI notices (e.g. "No Cards", "Cash/UPI Only") -> "cashOnlyWarning".
3. VISUAL AUTHENTICITY CUES:
   - Traditional brass filters, clay tandoor, generational wood-carved boards, hand-painted signs.
   - Detect tourist-trap kitsch (mass-produced plastic souvenirs, inflated English-only luxury signage, aggressive guide touting banners).
4. IMAGE QUALITY & RELEVANCE EVALUATION:
   - If the image is extremely blurry, pitch black, corrupted, or completely irrelevant (e.g. photo of shoes, pet, bathroom tile, vehicle tire, selfie without storefront), set "isRelevantSpotPhoto" to false, "confidenceScore" below 0.3, and state why in "rejectionReason".
   - If valid, set "confidenceScore" based on lighting and text legibility (0.6 to 1.0).

OUTPUT FORMAT:
Respond with a strict JSON object conforming to this exact structure:
{
  "isRelevantSpotPhoto": boolean,
  "rejectionReason": string or null,
  "detectedLanguage": string (e.g. "kn-IN", "ta-IN", "hi-IN", "en"),
  "ocrDetectedText": string[],
  "visualSummary": string,
  "practicalDetails": {
    "openingHoursMentioned": string or null,
    "signatureDishesOrItems": string[],
    "priceLevelNote": string or null,
    "cashOnlyWarning": boolean,
    "insiderTips": string[]
  },
  "visualAuthenticity": {
    "hasGenerationalOrTraditionalSignage": boolean,
    "hasTraditionalCulinaryEquipment": boolean,
    "hasCommercialTouristKitschness": boolean,
    "hasClearNameBoard": boolean,
    "observedVibeTags": string[]
  },
  "confidenceScore": number (0.0 to 1.0),
  "uncertainties": string[]
}`;

/**
 * Extracts OCR text, practical details, and visual cues from community photos.
 */
export async function extractPhotoDetails(
  input: PhotoExtractionInput
): Promise<PhotoExtractionOutput> {
  const config = getAIConfig();
  const modelId = config.defaultModel;
  const processedAt = new Date().toISOString();

  // Validate input presence
  if (!input.media && (!input.imageDescriptionOrOcrHint || input.imageDescriptionOrOcrHint.trim().length === 0)) {
    return {
      assetId: input.assetId,
      contributionId: input.contributionId,
      assetType: input.assetType,
      processingStatus: 'FAILED',
      aiExtractionResult: null,
      visualAuthenticityIndicators: {
        hasGenerationalOrTraditionalSignage: false,
        hasTraditionalCulinaryEquipment: false,
        hasCommercialTouristKitschness: false,
        hasClearNameBoard: false,
        observedVibeTags: [],
      },
      uncertaintyReport: {
        isMissingOpeningHours: true,
        isMissingPricing: true,
        isBlurryOrLowQuality: true,
        isNonNeighborhoodSubject: true,
        detectedUncertainties: ['No image media or OCR hints provided in input'],
      },
      errorMessage: 'Invalid photo submission: media binary or image description is required',
      modelUsed: modelId,
      processedAt,
    };
  }

  try {
    const rawAiResponse = await executeWithRetry(
      modelId,
      async (client: GoogleGenAI) => {
        const contents: any[] = [];
        const userPrompt = `Analyze this community photo contribution for spot verification and detail extraction.
Asset Type: ${input.assetType}
Contribution ID: ${input.contributionId}
Asset ID: ${input.assetId}

Extract visible OCR text, signboards, menu prices, and visual authenticity indicators.`;

        if (input.media) {
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
          // Fallback text description for offline/mock test paths
          contents.push({
            role: 'user',
            parts: [
              {
                text: `${userPrompt}\n\nVisible Image Description & OCR Content:\n"""\n${input.imageDescriptionOrOcrHint}\n"""`,
              },
            ],
          });
        }

        const response = await client.models.generateContent({
          model: modelId,
          contents,
          config: {
            systemInstruction: PHOTO_EXTRACTION_SYSTEM_PROMPT,
            temperature: 0.1,
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

    // Check if the AI marked the photo as blurry, black, or irrelevant
    if (parsed.isRelevantSpotPhoto === false) {
      return {
        assetId: input.assetId,
        contributionId: input.contributionId,
        assetType: input.assetType,
        processingStatus: 'FAILED',
        aiExtractionResult: null,
        visualAuthenticityIndicators: {
          hasGenerationalOrTraditionalSignage: false,
          hasTraditionalCulinaryEquipment: false,
          hasCommercialTouristKitschness: false,
          hasClearNameBoard: false,
          observedVibeTags: [],
        },
        uncertaintyReport: {
          isMissingOpeningHours: true,
          isMissingPricing: true,
          isBlurryOrLowQuality: true,
          isNonNeighborhoodSubject: true,
          detectedUncertainties: parsed.uncertainties || [parsed.rejectionReason || 'Irrelevant or low quality photo'],
        },
        errorMessage: parsed.rejectionReason || 'Photo is too blurry, dark, or does not contain recognizable spot features',
        modelUsed: modelId,
        processedAt,
      };
    }

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

    const ocrDetectedText = Array.isArray(parsed.ocrDetectedText) ? parsed.ocrDetectedText : [];
    const isMissingHours = practicalDetails.openingHoursMentioned === undefined;
    const isMissingPrice = practicalDetails.priceLevelNote === undefined;
    const isLowConfidence = confidenceScore < 0.6;

    const detectedUncertainties: string[] = Array.isArray(parsed.uncertainties) ? parsed.uncertainties : [];
    if (isMissingHours) {
      detectedUncertainties.push('No opening hours visible on signage or menu');
    }
    if (isMissingPrice) {
      detectedUncertainties.push('No prices visible on photo');
    }

    const visualAuth = parsed.visualAuthenticity || {};
    const visualAuthenticityIndicators = {
      hasGenerationalOrTraditionalSignage: Boolean(visualAuth.hasGenerationalOrTraditionalSignage),
      hasTraditionalCulinaryEquipment: Boolean(visualAuth.hasTraditionalCulinaryEquipment),
      hasCommercialTouristKitschness: Boolean(visualAuth.hasCommercialTouristKitschness),
      hasClearNameBoard: Boolean(visualAuth.hasClearNameBoard),
      observedVibeTags: Array.isArray(visualAuth.observedVibeTags) ? visualAuth.observedVibeTags : [],
    };

    return {
      assetId: input.assetId,
      contributionId: input.contributionId,
      assetType: input.assetType,
      processingStatus: isLowConfidence && confidenceScore < 0.3 ? 'FAILED' : 'COMPLETED',
      aiExtractionResult: {
        detectedLanguage: parsed.detectedLanguage || 'en',
        transcription: parsed.visualSummary || ocrDetectedText.join(' | '),
        englishTranslation: parsed.visualSummary || '',
        practicalDetails,
        ocrDetectedText,
        confidenceScore,
      },
      visualAuthenticityIndicators,
      uncertaintyReport: {
        isMissingOpeningHours: isMissingHours,
        isMissingPricing: isMissingPrice,
        isBlurryOrLowQuality: isLowConfidence,
        isNonNeighborhoodSubject: false,
        detectedUncertainties,
      },
      modelUsed: modelId,
      processedAt,
    };
  } catch (error: any) {
    return {
      assetId: input.assetId,
      contributionId: input.contributionId,
      assetType: input.assetType,
      processingStatus: 'FAILED',
      aiExtractionResult: null,
      visualAuthenticityIndicators: {
        hasGenerationalOrTraditionalSignage: false,
        hasTraditionalCulinaryEquipment: false,
        hasCommercialTouristKitschness: false,
        hasClearNameBoard: false,
        observedVibeTags: [],
      },
      uncertaintyReport: {
        isMissingOpeningHours: true,
        isMissingPricing: true,
        isBlurryOrLowQuality: true,
        isNonNeighborhoodSubject: true,
        detectedUncertainties: [`Photo extraction error: ${error.message}`],
      },
      errorMessage: `Photo extraction failed: ${error.message}`,
      modelUsed: modelId,
      processedAt,
    };
  }
}
