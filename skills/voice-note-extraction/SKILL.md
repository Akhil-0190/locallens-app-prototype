---
name: voice-note-extraction
description: Extracts structured cultural place details, verbatim vernacular transcripts, opening hours, pricing, and visual cues from regional-language voice notes and storefront/menu photos.
---

# Voice-Note Extraction Skill

**Name:** voice-note-extraction  
**Domain:** Regional Multimodal Audio & Vision Understanding, Cultural Ingestion  
**Primary Ownership:** Developer B (AI Extraction Pipeline) & Developer A (Canonical Persistence)  
**Status:** Active  

---

## 1. Overview & Purpose

The **Voice-Note Extraction Skill** powers the ingestion of authentic neighborhood spot recommendations submitted by local residents and cultural insiders:
1. **Regional Voice-Note Processing:** Transcribes verbatim audio in native regional scripts (Kannada `kn-IN`, Tamil `ta-IN`, Hindi `hi-IN`, Marathi `mr-IN`, Telugu `te-IN`, English `en`) and translates culturally nuanced expressions into fluent English without flattening vernacular context (*darshini*, *by-two*, *filter kaapi*, *benne dose*).
2. **Multimodal Visual Grounding:** Inspects storefront, menu, and street photos for traditional craftsmanship, generational signage, bilingual signboards, and visual authenticity cues.
3. **Structured Entity Extraction:** Derives canonical spot attributes including venue name, neighborhood, practical hours, budget level, dish recommendations, and special cultural notes.
4. **Anti-Hallucination Guardrails:** If opening hours, pricing, or payment details are omitted from the media, they strictly remain `undefined`. Information is never fabricated from generalized heuristics.

---

## 2. Trigger Conditions

This skill is invoked during the spot contribution lifecycle (`Task A3 / B2 / D2`):
- When a local contributor records an audio memo describing a neighborhood gem.
- When photos of a storefront, signboard, or menu are uploaded alongside or independent of voice notes.
- When an asset upload completes in Cloud Storage triggering automated AI extraction (`saveAiResult`).

---

## 3. Technical Service Pipeline

```
[Audio/Photo Upload] 
       │
       ▼
[Media Pre-Processor] ──► Validate MIME type (audio/aac, audio/mp4, image/jpeg, image/png) & size caps
       │
       ▼
[Gemini Multimodal Client] ──► Invokes gemini-3.5-flash-lite / gemini-3.1-flash-lite fallback
       │
       ▼
[Structured Extraction] ──► Enforces Zero-Hallucination & Uncertainty Reporting
       │
       ▼
[Canonical Document Output] ──► ExtractedPracticalDetails & VoicePhotoAssetDocument
```

---

## 4. Input & Output Contract

### Input Parameters
- `mediaUrl`: Cloud Storage signed URI or Buffer of the recorded audio / photo.
- `mediaType`: `'AUDIO_NOTE'` | `'STOREFRONT_PHOTO'` | `'MENU_PHOTO'` | `'STREET_PHOTO'`.
- `primaryLanguageHint`: BCP-47 tag (e.g. `'kn-IN'`, `'ta-IN'`, `'hi-IN'`, `'mr-IN'`, `'te-IN'`, `'en'`).
- `contributorNotes`: Optional contextual text provided by the submitter.

### Output Structure (`ExtractedPracticalDetails`)
- `transcription`: Native regional script verbatim text.
- `translatedEnglish`: Culturally fluent English translation preserving idioms.
- `placeNameSuggested`: Extracted venue or spot title.
- `openingHoursMentioned`: Exact hours if explicitly stated; otherwise `undefined`.
- `priceLevelNote`: Budget context or dish prices if explicitly stated; otherwise `undefined`.
- `cashOnlyWarning`: `true` if card non-acceptance or cash/UPI requirement was stated; otherwise `false`.
- `recommendedDishesOrItems`: Array of highlighted specialty items.
- `uncertaintyReport`:
  - `isMissingOpeningHours`: boolean
  - `isMissingPricing`: boolean
  - `isLowConfidence`: boolean
  - `detectedUncertainties`: string[]
