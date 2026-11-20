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

## 2. Gemini Live Security, Token Lifecycle & Model Verification

### A. The Ephemeral Token Architecture
Client devices (Flutter on Android/iOS) must **never** hold permanent Google AI Studio API credentials. Instead:
1. Flutter client calls authenticated Cloud Function: `Assistance-initializeLiveSession`.
2. Backend validates Firebase Auth user token (`request.auth.uid`).
3. Backend calls Google's official Developer API via `@google/genai` SDK:
   `client.authTokens.create({ config: { uses: 1, expireTime: ..., liveConnectConstraints: { ... } } })`.
4. Provider-backed token (`tokenResponse.name`) is returned with exact provider expiry.
5. **Honest Provider Fallback:** If the Google Live API endpoint, network, or credentials are unavailable, the backend reports `isLiveSessionSupported: false` and `ephemeralToken: null`. It **never** manufactures a synthetic local UUID as a fake credential.
6. **Live Model Status:** The target model `gemini-3.8-live` is configured in the centralized registry as an `UNTESTED_ENDPOINT` pending live provider socket verification.
7. Client connects directly to the streaming endpoint:
   `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent`
8. On expiration, the client re-authenticates to mint a fresh token.

---

## 3. Developer D (Flutter) Client Integration Guide

Developer B provides callable Firebase Cloud Functions under the `Assistance` namespace that map 1:1 with Developer D's client models in `lib/services/street_assistance_service.dart`.

### Formal Agreement vs. Inspected Schema Parity
- **Inspected Schema Parity (Achieved):** The field names, types, enums, and nullability for `OrderingCard` / `CulturalOrderingCard` match 100% with Developer D's Dart definition in `lib/services/street_assistance_service.dart`.
- **Wire Integration (Pending D6/D7):** Developer D must replace client mock generators with live `FirebaseFunctions.instance.httpsCallable('Assistance-...')` invocations when implementing production UI.

### Callable Abuse Controls & Authentication

| Cloud Function Callable | Authentication (`request.auth`) | Abuse Controls & Rate Limiting | Status |
| :--- | :--- | :--- | :--- |
| `Assistance-initializeLiveSession` | **Required** | Auth check + 15m provider token bound | Billed AI operation |
| `Assistance-askStreetCopilot` | **Required** | Auth check + query length bound (1000 chars) | Billed AI operation |
| `Assistance-translateText` | **Required** | Auth check + source length bound (2000 chars) | Billed AI operation |
| `Assistance-getOrderingPhrases` | Optional | Payload size limit (< 4KB) | Public curated content |
| `Assistance-getEtiquetteGuidance` | Optional | Payload size limit (< 4KB) | Public curated content |
| `Assistance-translateCameraSignage`| **Required** | Auth check + MIME whitelist + base64 bounds | Billed AI operation |
| `Assistance-generateAudioGuidance` | **Required** | Auth check + input param bounds | Billed AI operation |
| `Assistance-explainPlanBReroute` | **Required** | Auth check + strict Zod schema parsing | Traveler route alert |
| `Assistance-formatGeminiHandoff` | **Required** | Auth check + Explicit Consent verification | Privacy-protected handoff |

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

## 6. Continue in Gemini Handoff Interface & Explicit Consent

Prepares the structured context payload for the optional "Continue in Gemini" capability:
- **Explicit Traveler Confirmation:** Requires `userConsentGranted: true` before formulating the handoff URI.
- **Transparent Data Preview:** When `userConsentGranted: false`, returns `consentStatus: 'CONSENT_REQUIRED'`, `handoffUri: null`, and `transferPayloadPreview` so the user sees exactly what is shared (neighborhood, coordinates, spots, dialogue) before consenting.
- **Cancellation Path:** Provides a distinct `cancellationPath: 'REMAIN_IN_APP'` allowing the traveler to reject the transfer and stay within Neighborhood Guide.
- **Transferred Context:** `activeNeighborhood`, `currentCoordinates`, `currentRouteSummary`, recent spot cards, and recent dialogue history.
- **Omitted Data:** Payment tokens, private user authentication credentials, internal database identifiers (`omittedAttributes`).
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
