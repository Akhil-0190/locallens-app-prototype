# Regional Voice & Multimodal Photo Extraction Guide (Task B2)

**Project:** Startup Buildathon 2026 — Neighborhood Guide App  
**Role:** Developer B (AI & Model Integration)  
**Task:** B2 — Regional-Language Voice and Photo Extraction  
**Status:** Completed & Live-Tested  

---

## 1. Executive Summary & Architectural Scope

Task B2 delivers the multimodal audio and image extraction pipeline for community spot contributions. It enables local residents to record voice notes in their native regional languages (Kannada, Tamil, Hindi, Marathi, Telugu, English) and snap photos of street signboards, storefronts, and menus.

The extraction pipeline is built strictly on top of:
- **Developer A's Canonical Shared Contracts** (`VoicePhotoAssetDocument`, `ExtractedPracticalDetails`, `CanonicalPlaceDocument`).
- **Official `@google/genai` TypeScript SDK** using the verified `gemini-3.5-flash-lite` workhorse model with automated fallback to `gemini-3.1-flash-lite`.
- **Zero-Hallucination Guardrails**: Missing information remains strictly missing. Hours, pricing, and directions are never fabricated without explicit supporting media evidence.

---

## 2. Regional Language Voice-Note Understanding

### A. Supported Regional Languages
| Language | BCP-47 Tag | Verbatim Transcription | Translation Grounding | Vernacular Nuances Preserved |
| :--- | :--- | :--- | :--- | :--- |
| **Kannada** | `kn-IN` | Full native script | Culturally fluent English | Darshini terms, *bisi bele bath*, *benne dose*, *kaapi*, *by-two* |
| **Tamil** | `ta-IN` | Full native script | Culturally fluent English | *Mallipoo idli*, *vadakari*, *filter kaapi*, *kothu parotta* |
| **Hindi** | `hi-IN` | Devanagari script | Culturally fluent English | *Kachori*, *jalebi*, *chai tapri*, *halwai*, *gali* |
| **Marathi** | `mr-IN` | Devanagari script | Culturally fluent English | *Misal pav*, *kanda poha*, *vada pav*, *khanaval* |
| **Telugu** | `te-IN` | Full native script | Culturally fluent English | *Pesarattu*, *punugulu*, *irani chai*, *mess* |
| **English** | `en` | Direct transcript | Native English | Local Indian English idioms, neighborhood landmark references |

### B. Anti-Hallucination & Missing Information Protocol
1. **Opening Hours (`openingHoursMentioned`):**
   * If spoken explicitly (e.g., "7:00 AM to 11:30 AM"), it is extracted into `practicalDetails.openingHoursMentioned`.
   * If unmentioned in the voice note, it **MUST REMAIN `undefined`**. It is never guessed from typical restaurant patterns.
2. **Pricing (`priceLevelNote`):**
   * Extracted only if the contributor stated price amounts or budget ranges. Otherwise `undefined`.
3. **Cash / UPI Payment Warning (`cashOnlyWarning`):**
   * Set to `true` only if contributor explicitly notes that cards are not accepted or cash/UPI is required ("card illa", "cash only"). Otherwise `false`.
4. **Uncertainty Report (`uncertaintyReport`):**
   * Every extraction returns structured flags: `isMissingOpeningHours`, `isMissingPricing`, `isMissingDirections`, `isLowConfidence`, and `detectedUncertainties`.

---

## 3. Multimodal Photo Understanding & OCR

### A. Media Asset Types (Domain 04)
- **`STOREFRONT_PHOTO`:** Analyzes main facade, entrance, hand-painted wooden signboards, bilingual scripts (e.g. Kannada + English), and traditional architectural features.
- **`MENU_PHOTO`:** Extracts dish names, regional specialties, daily specials, and listed prices.
- **`STREET_PHOTO`:** Extracts street signage, cross-street landmarks, and foot-traffic atmosphere.

### B. Visual Authenticity Indicators
The pipeline isolates genuine local cues from commercial tourist kitsch:
- `hasGenerationalOrTraditionalSignage`: Detects hand-painted, weathered wood, or legacy brass plaques.
- `hasTraditionalCulinaryEquipment`: Detects traditional brass filter urns, charcoal tandoors, cast-iron dosa tavas, clay pots.
- `hasCommercialTouristKitschness`: Flags mass-manufactured plastic trinkets, oversized aggressive tour-guide banners, or inflated pricing menus.

---

## 4. Spot-Card Synthesis (Domain 06)

The `synthesizeSpotCard` service combines the contributor's narrative (`infoParagraph`), Google Maps link (`mapsLink`), voice insights, and photo OCR into a draft `CanonicalPlaceDocument`:

1. **Distinction of Contributor Claims:**  
   Synthesized descriptions explicitly bracket contributor claims:  
   `"...narrative text... [Contributor Claim: Recommended items per contributor: Masala Dosa, Filter Coffee. Contributor note: Cash or UPI payments only.]"`
2. **Default Opening Hours:**  
   If extracted from supported audio or photo signage, `openHours` is populated; if unmentioned, it strictly defaults to `'Check Maps for hours'`.
3. **Attribution:**  
   Full contributor attribution (`userId`, `displayName`, `badgeTitle`, `isVerifiedResident`) is attached directly to the spot card.
4. **Verification State:**  
   `isVerified` is initialized to `false`. Maps grounding (Developer C) and backend verification (Developer A) occur in subsequent pipeline stages.

---

## 5. Team Coordination & Boundaries

* **Developer A (A3 Persistence & Cloud Functions):**  
  Cloud Functions import `AI.extractVoiceNoteDetails`, `AI.extractPhotoDetails`, and `AI.synthesizeSpotCard` from `functions/src/ai/index.js`. On file upload to Cloud Storage, A3 triggers the AI service and updates the `VoicePhotoAssetDocument.aiExtractionResult` and `ContributionDocument.status`.
* **Developer C (C2 Maps Grounding):**  
  Receives the synthesized draft spot card and grounds it against Google Places API (New) using `mapsLink` and coordinates.
* **Developer D (D2 Flutter Client):**  
  Flutter client records voice audio (`.m4a`) and captures photos (`.jpg`), uploading to Cloud Storage paths defined in Domain 04 (`contributions/{contributionId}/audio/{assetId}.m4a`).

---

## 6. Test Suite & Verification Results

All 32 test scenarios pass with zero failures:
```text
npm --prefix functions run test:b2

--- [Test Suite 1] Anti-Hallucination & Missing Information Guardrails ---
✅ PASSED: Voice note without hours processed successfully
✅ PASSED: Extraction result exists
✅ PASSED: Anti-hallucination: openingHoursMentioned is STRICTLY undefined when not spoken
✅ PASSED: Anti-hallucination: priceLevelNote is STRICTLY undefined when not spoken
✅ PASSED: Uncertainty report explicitly flags missing opening hours
✅ PASSED: Uncertainty report explicitly flags missing pricing

--- [Test Suite 2] Regional Language Voice Note Understanding ---
✅ PASSED: Kannada voice note processed
✅ PASSED: Detected regional language tag kn-IN
✅ PASSED: Correctly extracted cash/UPI only warning
✅ PASSED: Extracted explicitly spoken opening hours (7:00 - 11:30)
✅ PASSED: Extracted signature items (Masala Dosa, Filter Coffee)
✅ PASSED: Tamil voice note processed
✅ PASSED: Detected regional language tag ta-IN
✅ PASSED: Extracted Tamil signature culinary items

--- [Test Suite 3] Multimodal Photo & OCR Signage Understanding ---
✅ PASSED: Storefront photo processed
✅ PASSED: Photo extraction result exists
✅ PASSED: OCR detected text extracted from signboard
✅ PASSED: Extracted opening hours printed on signboard
✅ PASSED: Identified generational / heritage signboard

--- [Test Suite 4] Invalid, Ambiguous, and Low-Quality Inputs ---
✅ PASSED: Empty voice input safely marked as FAILED
✅ PASSED: Descriptive error message returned for empty input
✅ PASSED: Noise voice input safely marked as FAILED
✅ PASSED: Empty photo input safely marked as FAILED
✅ PASSED: Descriptive error message returned for empty photo

--- [Test Suite 5] Spot-Card Synthesis & Contributor Attribution ---
✅ PASSED: Canonical Place ID generated correctly
✅ PASSED: Contributor attribution preserved
✅ PASSED: Contributor display name preserved
✅ PASSED: Contributor verified resident status preserved
✅ PASSED: Open hours populated from supported media extraction
✅ PASSED: Spot card draft marked isVerified: false (pending Maps grounding)
✅ PASSED: Synthesized narrative clearly flags contributor claims
✅ PASSED: Anti-hallucination: spotCard defaults openHours to "Check Maps for hours" when unstated

Test Results: 32 / 32 tests passed.
```
