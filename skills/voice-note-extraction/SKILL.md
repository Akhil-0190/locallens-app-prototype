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

---

## 5. Representative Examples

### Example 1: Successful Regional Extraction (Kannada Audio Note)
* **Input:** Audio memo recorded in Kannada (`kn-IN`) describing Shri Sagar (CTR):
  `ಇಲ್ಲಿ ಮಲ್ಲೇಶ್ವರಂನಲ್ಲಿರೋ ಶ್ರೀ ಸಾಗರ್ ಸಿಟಿಆರ್ ಬೆಣ್ಣೆ ದೋಸೆ ತುಂಬಾ ಫೇಮಸ್. ಬೆಳಗ್ಗೆ 7:30 ರಿಂದ 12:30 ವರೆಗೆ ಇರುತ್ತೆ. ಒಂದು ದೋಸೆಗೆ 80 ರೂಪಾಯಿ, ಕಾರ್ಡ್ ತಗಳಲ್ಲ, ಕ್ಯಾಶ್ ಅಥವಾ ಯುಪಿಐ ಮಾತ್ರ.`
* **Output:**
  - `placeNameSuggested`: `"Shri Sagar (CTR)"`
  - `vernacularTranscription`: `"ಇಲ್ಲಿ ಮಲ್ಲೇಶ್ವರಂನಲ್ಲಿರೋ ಶ್ರೀ ಸಾಗರ್ ಸಿಟಿಆರ್ ಬೆಣ್ಣೆ ದೋಸೆ ತುಂಬಾ ಫೇಮಸ್..."`
  - `translatedEnglish`: `"Here in Malleshwaram, Shri Sagar CTR butter dose is very famous. Open morning 7:30 AM to 12:30 PM. 80 rupees per dose. No cards accepted, only cash or UPI."`
  - `openingHoursMentioned`: `"7:30 AM - 12:30 PM"` (FACT)
  - `priceLevelNote`: `"₹80 per dose (Budget)"` (FACT)
  - `cashOnlyWarning`: `true` (FACT)
  - `recommendedDishesOrItems`: `["Benne Masala Dose", "Filter Coffee"]`
  - `dietaryCuesIdentified`: `["PURE_VEG"]`

### Example 2: Edge Case — Incomplete / Omitted Opening Hours (Zero Hallucination)
* **Input:** Audio memo describing Brahmin Coffee Bar without stating opening or closing hours.
* **Output:**
  - `placeNameSuggested`: `"Brahmin Coffee Bar"`
  - `openingHoursMentioned`: `undefined` (Never fabricated)
  - `uncertaintyReport.isMissingOpeningHours`: `true`
  - `uncertaintyReport.detectedUncertainties`: `["Opening hours were not mentioned in audio note"]`

### Example 3: Unsuccessful / Corrupted Input Case
* **Input:** Contribution payload lacking both audio stream and storefront photo.
* **Output:**
  - `success`: `false`
  - `isLowQualityOrNoisy`: `true`
  - `detectedUncertainties`: `["Input contains neither audio nor photo payload"]`

---

## 6. Facts vs. Inferences vs. Unavailable Invariants

| Attribute | Classification Rule | System Behavior |
| :--- | :--- | :--- |
| **Directly Spoken Details** | `FACT` | Directly mapped to canonical fields (e.g. "open 7am to 1pm", "costs ₹80"). |
| **Contextual Derivations** | `INFERENCE` | Labeled with confidence (e.g. "darshini" implies counter service). |
| **Omitted Details** | `UNAVAILABLE` | Strictly left `undefined`. Never populated from web search or generalized training priors. |

---

## 7. Execution Engine & Programmatic Service

* **TypeScript Implementation:** `functions/src/ai/skills/skill-voice-extraction.ts`
* **Firebase Callable:** `Skills-executeVoiceNoteExtraction`
* **Test Verification:** Verified via deterministic tests in `functions/test/test-b7-agent-skills.ts` (Suite 1).
