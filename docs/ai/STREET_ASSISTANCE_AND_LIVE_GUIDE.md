# Street-Ready AI Assistance, Translation & Gemini Live Guide (Task B5)

**Project:** Startup Buildathon 2026 — Neighborhood Guide App  
**Role:** Developer B (AI & Model Integration Lead)  
**Task:** B5 — Gemini Live, Translation, and Street-Ready AI Assistance  
**Status:** Implemented & Verified with Deterministic Suites  

---

## 1. Executive Summary & Architecture

Task B5 provides the server-side AI intelligence layer powering the traveler's street-level experience. When walking through historic neighborhoods like Malleshwaram, travelers encounter regional scripts, unwritten dining customs, complex vendor negotiations, sudden monsoon downpours, and dynamic route changes.

Task B5 introduces three operational delivery tiers:

1. **`LIVE_STREAMING` (Gemini 3.8 Live):**  
   - Low-latency bidirectional spoken dialogue over WebSocket (`wss://...`).
   - Mints ephemeral session tokens on the backend with 15-minute TTL.
   - Permanent Google Gemini API keys remain strictly server-side.
2. **`REQUEST_RESPONSE_FALLBACK` (Gemini 3.8 Flash / 3.5 Flash-Lite):**  
   - High-speed unary requests for multimodal signage OCR, structured translation, etiquette advice, and Plan-B explanations.
   - Automatically cascades from primary model to fallback engine if 503/429 rate limits occur.
3. **`OFFLINE_MOCK_ADAPTER` (Deterministic Cultural Knowledge Base):**  
   - High-fidelity offline adapter supporting testing and offline device scenarios without internet connectivity.
   - Explicitly labeled in response envelopes so simulated data is never mistaken for live API output.

---

## 2. Gemini 3.8 Live Security & Token Lifecycle

### A. The Ephemeral Token Architecture
Client devices (Flutter on Android/iOS) must **never** hold permanent Google AI Studio API credentials. Instead:
1. Flutter client calls authenticated Cloud Function: `Assistance-initializeLiveSession`.
2. Backend validates Firebase Auth user token (`request.auth.uid`).
3. Backend mints a signed, short-lived session identifier (`gem_live_ephem_...`) with an exact 900-second (15-minute) expiration timestamp.
4. Client connects directly to the streaming endpoint:
   `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent`
5. On expiration, the client re-authenticates to mint a fresh token seamlessly.

---

## 3. Developer D (Flutter) Client Integration Guide

Developer B provides callable Firebase Cloud Functions under the `Assistance` namespace that map 1:1 with Developer D's client models in `lib/services/street_assistance_service.dart`.

### Endpoint Directory

| Cloud Function Callable | Request Schema | Response Schema | Developer D Client Mapping |
| :--- | :--- | :--- | :--- |
| `Assistance-initializeLiveSession` | `LiveSessionTokenRequest` | `LiveSessionTokenResponse` | WebSocket session manager |
| `Assistance-askStreetCopilot` | `StreetCopilotRequest` | `StreetCopilotResponse` | `StreetAssistanceService.askStreetCopilot()` |
| `Assistance-translateText` | `TranslationRequest` | `TranslationResponse` | Live translation sheet |
| `Assistance-getOrderingPhrases` | `OrderingAssistanceRequest`| `OrderingAssistanceResponse`| `OrderingCard` deck |
| `Assistance-getEtiquetteGuidance` | `EtiquetteGuidanceRequest` | `EtiquetteGuidanceResponse` | Cultural etiquette modal |
| `Assistance-translateCameraSignage`| `CameraVisualTranslationRequest` | `CameraVisualTranslationResponse` | `CameraTranslationResult` |
| `Assistance-generateAudioGuidance` | `AudioGuidanceContentRequest` | `AudioGuidanceContentResponse` | `StreetAssistanceService.speakAudioPrompt()` |
| `Assistance-explainPlanBReroute` | `PlanBExplanationRequest` | `PlanBExplanationResponse` | Dynamic Plan-B alert sheet |
| `Assistance-formatGeminiHandoff` | `GeminiHandoffContext` | `GeminiHandoffResponse` | Continue in Gemini button |

### Example Request & Response: Camera Signage Translation
**Request Payload:**
```json
{
  "imagePayload": {
    "base64Data": "iVBORw0KGgoAAAANSUhEUg...",
    "mimeType": "image/png"
  },
  "captureContext": "STOREFRONT_SIGN",
  "targetLanguage": "en"
}
```
**Response Envelope (`ApiSuccessResponse`):**
```json
{
  "success": true,
  "data": {
    "detectedScript": "Kannada (ಕನ್ನಡ)",
    "originalText": "ಶ್ರೀ ಸಾಗರ್ ಉಪಹಾರ ಗೃಹ — ಶುದ್ಧ ತುಪ್ಪ ಮತ್ತು ಬೆಣ್ಣೆ ದೋಸೆ",
    "translatedText": "Shri Sagar Refreshments — Pure Ghee & Butter Dose",
    "culturalContext": "Heritage signage of Central Tiffin Room (CTR) dating back to 1920s Bengaluru.",
    "menuItemsDetected": [
      {
        "itemName": "Benne Masala Dose",
        "description": "Crisp golden crepe made with fresh country butter and potato filling",
        "priceDetected": "₹75",
        "dietaryFlags": ["Vegetarian"]
      }
    ],
    "instructionsOrWarnings": ["Tokens must be purchased at the entrance cash register."],
    "readabilityAssessment": "CLEAR_READABLE",
    "deliveryMode": "REQUEST_RESPONSE_FALLBACK",
    "confidenceScore": 0.90,
    "modelUsed": "gemini-3.8-flash",
    "processedAt": "2026-11-21T00:30:00.000Z"
  }
}
```

---

## 4. Developer C (Maps/Weather) Route Context Coordination

Task B5 consumes Developer C's `PlanBExplanationContext` verbatim (`functions/src/maps/types/weather.types.ts#L129-L143`).

### Anti-Hallucination Guardrails:
- **Zero Metric Fabrication:** Developer B **never** recalculates route paths, re-estimates walking durations, or invents detour distances.
- **Accurate Propagation:**
  - `distanceDeltaMeters` and `durationDeltaSeconds` supplied by C are formatted into readable conversational text (e.g. `"Adds 45 meters (~1 min)"`).
  - `primaryDisruption` (`SEVERE_WEATHER`, `VENUE_CAPACITY_EXCEEDED`, `UNEXPECTED_CLOSURE`) provides the exact factual justification.
- **Immediate Audio Guidance:** Produces a concise spoken snippet (`spokenAudioSnippet` < 40 words) allowing the traveler to hear the change through earphones immediately.

---

## 5. Audio Guidance Constraints (< 60 Words)

To keep spoken walking guidance clear and safe on busy streets:
- Text prompts are strictly enforced to **under 60 words** (~15 to 25 seconds spoken duration).
- Travelers are never required to look down at their phone screen while crossing streets or navigating crowded market lanes.
- Formatted with `recommendedTtsLocale: 'en-IN'` to match Developer D's client TTS configuration in `lib/services/street_assistance_service.dart`.

---

## 6. Continue in Gemini Handoff Interface

Prepares the structured context payload for the optional "Continue in Gemini" capability:
- **Transferred Context:** `activeNeighborhood`, `currentCoordinates`, `currentRouteSummary`, recent spot cards, and recent dialogue history.
- **Omitted Data:** Payment tokens, private user authentication credentials, internal database identifiers.
- **Handoff Target:** Official Gemini web application deep-link: `https://gemini.google.com/app?context=...`.
- *Note:* Agent Skills execution is retained for Task B7.

---

## 7. Verification & Test Suite

Run the B5 verification test suite via npm:
```bash
npm --prefix functions run test:b5
```
Verified scenarios:
- WebSocket ephemeral token minting & 15-minute TTL.
- Zero key leakage (server secrets never exposed to client).
- Bidirectional translation preserving prices, quantities, and dietary cues.
- Curated cultural ordering card deck (1:1 Developer D parity).
- Contextual venue etiquette (temple decorum, darshini tokens, flower stalls).
- Multimodal camera translation with blur and unreadable image handling.
- Spoken audio guidance length constraints (< 60 words).
- Plan-B route change explanation utilizing C's context without fabrication.
- Continue in Gemini handoff context formatting.
- Conditional live API probe with transparent reporting of offline environment status.
