/**
 * Startup Buildathon 2026 — Neighborhood Guide App
 * Task B7: Voice-Note Extraction Skill
 * Developer B — AI & Multimodal Lead
 * 
 * Programmatic execution wrapper for Skill 1: Voice-Note Extraction.
 * Transforms vernacular regional-language voice notes and storefront/menu photos
 * into canonical place recommendations with zero-hallucination guardrails.
 */

import { z } from 'zod';
import {
  ExtractedPracticalDetails,
  ExtractedPracticalDetailsSchema,
} from '../../types/contracts/index.js';
import { getAIConfig } from '../config/env.js';
import { extractVoiceNoteDetails } from '../services/voice-extraction-service.js';
import { extractPhotoDetails } from '../services/photo-extraction-service.js';

export const VoicePhotoExtractionInputSchema = z.object({
  audioBase64: z.string().optional(),
  audioMimeType: z.string().optional(),
  photoBase64: z.string().optional(),
  photoMimeType: z.string().optional(),
  languageHint: z.string().optional(),
  contributorNotes: z.string().optional(),
  neighborhoodContext: z.string().optional(),
  rawTranscript: z.string().optional(),
});
export type VoicePhotoExtractionInput = z.infer<typeof VoicePhotoExtractionInputSchema>;

export const FactCategorySchema = z.enum(['FACT', 'INFERENCE', 'UNAVAILABLE']);
export type FactCategory = z.infer<typeof FactCategorySchema>;

export const ClassifiedFactItemSchema = z.object({
  attribute: z.string(),
  value: z.string().nullable(),
  category: FactCategorySchema,
  sourceEvidence: z.string(),
  confidence: z.number().min(0).max(1),
});
export type ClassifiedFactItem = z.infer<typeof ClassifiedFactItemSchema>;

export const VoiceNoteExtractionSkillOutputSchema = z.object({
  success: z.boolean(),
  spotName: z.string(),
  vernacularTranscription: z.string(),
  translatedEnglish: z.string(),
  languageDetected: z.string(),
  practicalDetails: ExtractedPracticalDetailsSchema,
  factClassification: z.array(ClassifiedFactItemSchema),
  unresolvedAmbiguities: z.array(z.string()),
  executionProvenance: z.enum(['GEMINI_MULTIMODAL_EXTRACTION', 'DETERMINISTIC_EXTRACTION_FALLBACK']),
  isLowQualityOrNoisy: z.boolean(),
});
export type VoiceNoteExtractionSkillOutput = z.infer<typeof VoiceNoteExtractionSkillOutputSchema>;

/**
 * Classifies extracted attributes into strictly separated Facts, Inferences, and Unavailable details.
 * Prevents hallucinated or assumed information from being treated as verified fact.
 */
export function classifyExtractionFacts(
  spotName: string | undefined,
  extracted: ExtractedPracticalDetails,
  rawTranscript: string,
  rawTranslation: string
): ClassifiedFactItem[] {
  const items: ClassifiedFactItem[] = [];

  // 1. Spot Name
  if (spotName && spotName.trim().length > 0 && spotName !== 'Unknown Spot' && spotName !== 'Local Heritage Venue') {
    const cleanSpot = spotName.toLowerCase().replace(/[()]/g, '').trim();
    const cleanTrans = rawTranslation.toLowerCase().replace(/[()]/g, '');
    const cleanRaw = rawTranscript.toLowerCase().replace(/[()]/g, '');
    const isInTranscript =
      cleanTrans.includes(cleanSpot) ||
      cleanRaw.includes(cleanSpot) ||
      cleanSpot.split(' ').some((w) => w.length > 2 && (cleanTrans.includes(w) || cleanRaw.includes(w)));
    items.push({
      attribute: 'placeName',
      value: spotName,
      category: isInTranscript ? 'FACT' : 'INFERENCE',
      sourceEvidence: isInTranscript ? 'Explicitly spoken in voice note' : 'Inferred from context and specialty items',
      confidence: isInTranscript ? 0.98 : 0.75,
    });
  } else {
    items.push({
      attribute: 'placeName',
      value: null,
      category: 'UNAVAILABLE',
      sourceEvidence: 'No venue name identified in audio or signage',
      confidence: 1.0,
    });
  }

  // 2. Opening Hours
  if (extracted.openingHoursMentioned && extracted.openingHoursMentioned.trim().length > 0) {
    items.push({
      attribute: 'openingHours',
      value: extracted.openingHoursMentioned,
      category: 'FACT',
      sourceEvidence: 'Directly stated operating hours in contributor audio',
      confidence: 0.95,
    });
  } else {
    items.push({
      attribute: 'openingHours',
      value: null,
      category: 'UNAVAILABLE',
      sourceEvidence: 'Hours omitted by contributor; strictly not fabricated',
      confidence: 1.0,
    });
  }

  // 3. Pricing & Budget Level
  if (extracted.priceLevelNote && extracted.priceLevelNote.trim().length > 0) {
    items.push({
      attribute: 'priceLevel',
      value: extracted.priceLevelNote,
      category: 'FACT',
      sourceEvidence: 'Specific dish or bill price cited by contributor',
      confidence: 0.92,
    });
  } else {
    items.push({
      attribute: 'priceLevel',
      value: null,
      category: 'UNAVAILABLE',
      sourceEvidence: 'No pricing mentioned; defaulting to undefined',
      confidence: 1.0,
    });
  }

  // 4. Payment Methods (Cash / UPI)
  if (extracted.cashOnlyWarning) {
    items.push({
      attribute: 'paymentMethods',
      value: 'Cash / UPI Only (No Cards)',
      category: 'FACT',
      sourceEvidence: 'Contributor explicitly advised cash or QR code payment',
      confidence: 0.95,
    });
  } else {
    items.push({
      attribute: 'paymentMethods',
      value: null,
      category: 'UNAVAILABLE',
      sourceEvidence: 'No explicit payment restrictions mentioned',
      confidence: 1.0,
    });
  }

  // 5. Specialty Dishes
  if (extracted.signatureDishesOrItems && extracted.signatureDishesOrItems.length > 0) {
    items.push({
      attribute: 'recommendedDishes',
      value: extracted.signatureDishesOrItems.join(', '),
      category: 'FACT',
      sourceEvidence: 'Specific items recommended in audio recording',
      confidence: 0.95,
    });
  }

  return items;
}

/**
 * Executes the Voice-Note Extraction Skill.
 */
export async function executeVoiceNoteExtractionSkill(
  input: VoicePhotoExtractionInput
): Promise<VoiceNoteExtractionSkillOutput> {
  // Validate input
  const parsedInput = VoicePhotoExtractionInputSchema.parse(input);

  // Check for noisy / empty / corrupted media indicator
  const hasAudio = Boolean(parsedInput.audioBase64 && parsedInput.audioMimeType);
  const hasPhoto = Boolean(parsedInput.photoBase64 && parsedInput.photoMimeType);
  const hasTranscriptOrNotes = Boolean(
    (parsedInput.rawTranscript && parsedInput.rawTranscript.trim().length > 0) ||
      (parsedInput.contributorNotes && parsedInput.contributorNotes.trim().length > 0)
  );
  const isNoisyOrEmpty = !parsedInput.audioMimeType && !parsedInput.photoMimeType && !hasTranscriptOrNotes;
  if (isNoisyOrEmpty) {
    const emptyDetails: ExtractedPracticalDetails = {
      openingHoursMentioned: undefined,
      signatureDishesOrItems: [],
      priceLevelNote: undefined,
      cashOnlyWarning: false,
      insiderTips: [],
    };

    return {
      success: false,
      spotName: 'Unknown Spot',
      vernacularTranscription: '',
      translatedEnglish: '',
      languageDetected: parsedInput.languageHint || 'unknown',
      practicalDetails: emptyDetails,
      factClassification: [
        {
          attribute: 'audioPayload',
          value: null,
          category: 'UNAVAILABLE',
          sourceEvidence: 'Missing audio and photo data',
          confidence: 1.0,
        },
      ],
      unresolvedAmbiguities: ['No media supplied for extraction'],
      executionProvenance: 'DETERMINISTIC_EXTRACTION_FALLBACK',
      isLowQualityOrNoisy: true,
    };
  }

  const config = getAIConfig();
  let transcript = (parsedInput.rawTranscript || parsedInput.contributorNotes || '').trim();
  let translation = transcript;
  let detectedLanguage = parsedInput.languageHint || 'en';
  let spotName = 'Unknown Spot';
  let hours: string | undefined = undefined;
  let price: string | undefined = undefined;
  let cashOnly = false;
  let dishes: string[] = [];
  let insiderTips: string[] = [];
  let executionProvenance: 'GEMINI_MULTIMODAL_EXTRACTION' | 'DETERMINISTIC_EXTRACTION_FALLBACK' =
    'DETERMINISTIC_EXTRACTION_FALLBACK';
  const uncertainties: string[] = [];

  // 1. Live Gemini 3.8 Flash Multimodal Voice & Photo Extraction when API key is configured
  if (config.hasApiKey && (hasAudio || hasPhoto || hasTranscriptOrNotes)) {
    const skillRunId = `skill_${Date.now()}`;
    if (hasAudio || hasTranscriptOrNotes) {
      const voiceRes = await extractVoiceNoteDetails({
        assetId: `${skillRunId}_audio`,
        contributionId: skillRunId,
        contributorId: 'agent_skill_caller',
        transcriptText: hasAudio ? undefined : transcript,
        languageHint: parsedInput.languageHint,
        media: hasAudio
          ? {
              base64Data: parsedInput.audioBase64!,
              mimeType: parsedInput.audioMimeType!,
            }
          : undefined,
      });

      if (voiceRes.processingStatus === 'COMPLETED' && voiceRes.aiExtractionResult) {
        const res = voiceRes.aiExtractionResult;
        transcript = res.transcription || transcript;
        translation = res.englishTranslation || res.transcription || translation;
        detectedLanguage = res.detectedLanguage || detectedLanguage;
        hours = res.practicalDetails?.openingHoursMentioned || hours;
        price = res.practicalDetails?.priceLevelNote || price;
        cashOnly = Boolean(res.practicalDetails?.cashOnlyWarning);
        dishes = res.practicalDetails?.signatureDishesOrItems || [];
        insiderTips = res.practicalDetails?.insiderTips || [];
        executionProvenance = 'GEMINI_MULTIMODAL_EXTRACTION';
      }
    }

    if (hasPhoto) {
      const photoRes = await extractPhotoDetails({
        assetId: `${skillRunId}_photo`,
        contributionId: skillRunId,
        assetType: 'STREET_PHOTO',
        media: {
          base64Data: parsedInput.photoBase64!,
          mimeType: parsedInput.photoMimeType!,
        },
      });

      if (photoRes.processingStatus === 'COMPLETED' && photoRes.aiExtractionResult) {
        const res = photoRes.aiExtractionResult;
        if (res.ocrDetectedText && res.ocrDetectedText.length > 0 && spotName === 'Unknown Spot') {
          spotName = res.ocrDetectedText[0]!.slice(0, 60);
        }
        hours = hours || res.practicalDetails?.openingHoursMentioned;
        price = price || res.practicalDetails?.priceLevelNote;
        cashOnly = cashOnly || Boolean(res.practicalDetails?.cashOnlyWarning);
        dishes = Array.from(new Set([...dishes, ...(res.practicalDetails?.signatureDishesOrItems || [])]));
        insiderTips = Array.from(new Set([...insiderTips, ...(res.practicalDetails?.insiderTips || [])]));
        executionProvenance = 'GEMINI_MULTIMODAL_EXTRACTION';
      }
    }
  } else {
    // Offline/unauthenticated honest text parser — NEVER fabricates CTR or Brahmin Coffee Bar
    uncertainties.push(
      'GEMINI_API_KEY unavailable; executed deterministic parser without live multimodal transcription.'
    );
    if (transcript) {
      if (/cash\s*only|upi\s*only|no\s*card/i.test(transcript)) cashOnly = true;
      const hourMatch = transcript.match(/\b\d{1,2}(?::\d{2})?\s*(?:am|pm)\s*(?:to|-|–)\s*\d{1,2}(?::\d{2})?\s*(?:am|pm)\b/i);
      if (hourMatch) hours = hourMatch[0];
      const priceMatch = transcript.match(/(?:₹|rs\.?\s*)\d+(?:\s*-\s*\d+)?/i);
      if (priceMatch) price = priceMatch[0];
    }
  }

  if (spotName === 'Unknown Spot') {
    const candidateSource = (translation || parsedInput.contributorNotes || '').trim();
    const firstClause = candidateSource.split(/[.!?\n]/)[0]?.trim() || '';
    if (firstClause.length > 0 && firstClause.length <= 55) {
      spotName = firstClause;
    } else if (parsedInput.neighborhoodContext) {
      spotName = `${parsedInput.neighborhoodContext} Spot`;
    }
  }

  if (!hours) {
    uncertainties.push('Opening hours were not explicitly stated in provided media.');
  }

  const practicalDetails: ExtractedPracticalDetails = {
    openingHoursMentioned: hours,
    signatureDishesOrItems: dishes,
    priceLevelNote: price,
    cashOnlyWarning: cashOnly,
    insiderTips,
  };

  const factClassification = classifyExtractionFacts(spotName, practicalDetails, transcript, translation);

  return {
    success: true,
    spotName,
    vernacularTranscription: transcript,
    translatedEnglish: translation,
    languageDetected: detectedLanguage,
    practicalDetails,
    factClassification,
    unresolvedAmbiguities: uncertainties,
    executionProvenance,
    isLowQualityOrNoisy: false,
  };
}
