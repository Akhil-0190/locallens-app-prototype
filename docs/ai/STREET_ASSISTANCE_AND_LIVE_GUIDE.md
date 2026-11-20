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

### A. Frozen Architecture Commitment: Gemini 3.8 Live
- **Committed Model:** `gemini-3.8-live` (the frozen architectural commitment in the pitch deck).
- **Current Model Status:** Marked as `UNTESTED_ENDPOINT` in the central model registry pending real provider live session verification.
- **Provider Investigation (Developer API vs. Enterprise Agent Platform):**
  - **Gemini Developer API (Google AI Studio via `@google/genai` v1alpha):** Exposes ephemeral token creation via `client.authTokens.create`. In the Developer API v1alpha catalog, bidirectional streaming targets experimental live endpoints. Attempting to create tokens for unverified model IDs fails closed.
  - **Google Gemini Enterprise Agent Platform (Vertex AI):** Uses Google Cloud IAM, service accounts, and OAuth2/STS downscoped tokens. The `@google/genai` SDK explicitly restricts `authTokens.create` to the Developer API (`isVertexAI()` throws an error).
  - **Honest Provider Fallback:** In offline sandboxes or when API credentials/network/endpoints are unavailable, the backend reports `isLiveSessionSupported: false` and `ephemeralToken: null`. It **never** manufactures a synthetic local UUID as a fake credential or silently substitutes an unapproved model.

### B. Correct Ephemeral-Token WebSocket Protocol
When using Google Developer API ephemeral tokens, connections must use the constrained endpoint and query parameter authentication:
- **WebSocket Endpoint:**
  `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContentConstrained`
- **Authentication Method:**
  `?access_token=<ephemeral_token>` (passed as a URL query parameter; NOT bearer headers or session params).
- **Full Client Connection URL:**
  `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContentConstrained?access_token=${ephemeralToken}`
- **Constrained Locking:** The session is cryptographically locked by Google to the committed model (`gemini-3.8-live`) and system instructions configured during token minting. The client cannot modify locked fields.
- **Expiry Enforcement:** Single-use session token with a 15-minute (`ttlSeconds: 900`) message rejection boundary and 5-minute session initialization window.

---

## 3. Developer D (Flutter) Client Integration Guide

Developer B provides callable Firebase Cloud Functions under the `Assistance` namespace that map 1:1 with Developer D's client models in `lib/services/street_assistance_service.dart`.

### Formal Agreement vs. Inspected Schema Parity
- **Inspected Schema Parity (Achieved):** The field names, types, enums, and nullability for `OrderingCard` / `CulturalOrderingCard` match 100% with Developer D's Dart definition in `lib/services/street_assistance_service.dart`.
- **Wire Integration (Pending D6/D7):** Developer D must replace client mock generators with live `FirebaseFunctions.instance.httpsCallable('Assistance-...')` invocations when implementing production UI.

### Callable Abuse Controls, Quotas & App Check

To protect externally billed Google AI operations and prevent quota exhaustion across multiple Cloud Function instances:

1. **Shared Rate Limiting Engine:**
   - Backed by Firestore collection `ai_usage_quotas` (coordinated with Developer A's architecture) using atomic operations, surviving instance restarts and cold starts.
   - Includes in-memory safeguards for local execution and rapid rejection.
   - Tested across independent limiter instances to prove shared state enforcement.

2. **Per-User Quotas:**

| Cloud Function Callable | Authentication (`request.auth`) | App Check Required | Shared Rate Limit | Abuse & Cost Controls |
| :--- | :--- | :--- | :--- | :--- |
| `Assistance-initializeLiveSession` | **Required** | **Yes** (Production) | Max 5 calls / 15 min | Single active token per user; 15s cooldown |
| `Assistance-askStreetCopilot` | **Required** | **Yes** (Production) | Max 20 calls / min | Query capped at 1,000 chars; history max 10 |
| `Assistance-translateText` | **Required** | **Yes** (Production) | Max 30 calls / min | Source text capped at 2,000 chars |
| `Assistance-translateCameraSignage`| **Required** | **Yes** (Production) | Max 10 calls / min | MIME whitelist + base64 payload bounds |
| `Assistance-generateAudioGuidance` | **Required** | **Yes** (Production) | Max 15 calls / min | Spoken word count strictly capped < 60 |
| `Assistance-explainPlanBReroute` | **Required** | Optional | Max 10 calls / min | Strict PlanBExplanationContext validation |
| `Assistance-formatGeminiHandoff` | **Required** | Optional | Max 5 calls / min | Cryptographic two-phase consent challenge |
| `Assistance-getOrderingPhrases` | Optional | Optional | Payload < 4KB | In-memory zero-cost curated phrase deck |
| `Assistance-getEtiquetteGuidance` | Optional | Optional | Payload < 4KB | In-memory zero-cost curated etiquette deck |

3. **Firebase App Check Deployment Status:**
   - **Deployment Truth:** In the current repository and environment, `ENFORCE_APP_CHECK` is **not yet set in production deployment secrets** (`.env.example` has no App Check keys).
   - **Enforcement Logic:** `checkAppCheckIfEnforced(request)` is a readiness safeguard. When `ENFORCE_APP_CHECK` is unset or false (local/test/emulator), requests pass without an App Check token. When set to `'true'`, it strictly blocks callers lacking a valid App Check token (`failed-precondition`). Active production enforcement will be enabled once Play Integrity / DeviceCheck is registered in Firebase Console.

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

## 6. Continue in Gemini Handoff Agreement & Two-Phase Consent Protocol

Prepares the structured context payload for the optional "Continue in Gemini" capability with end-to-end user consent verification:

### Two-Phase Cryptographic Confirmation Flow:
1. **Phase 1 (Inspection & Preview):**
   - Flutter client calls `Assistance-formatGeminiHandoff` with `{ action: 'PREVIEW', userConsentGranted: false }`.
   - Backend computes payload fingerprint, generates an unpredictable 16-byte random nonce, sets 5-minute expiry, and creates HMAC-signed `consentChallengeToken` (`chk_<nonce>_<expiresAt>_<signature>`).
   - Returns `consentStatus: 'CONSENT_REQUIRED'`, `consentChallengeToken`, and `transferPayloadPreview`.
   - `handoffUri` remains strictly `null`.
2. **User Confirmation Dialog (Developer D UI Agreement):**
   - Flutter client renders modal displaying `transferPayloadPreview`:
     - Neighborhood: e.g. "Malleshwaram"
     - GPS Sharing: Approximate coordinates (e.g. `12.998° N, 77.571° E`)
     - Route & Spots: "Malleshwaram Breakfast Walk (CTR Shri Sagar, ...)"
     - Conversation: Count of recent dialogue snippets shared.
   - User choices:
     - **[Cancel / Stay in Guide]:** Client sends `{ action: 'CANCEL' }`, dialog closes, takes `cancellationPath: 'REMAIN_IN_APP'`, 0 data exported.
     - **[Share & Continue in Gemini]:** Explicit affirmative user action triggers Phase 2.
3. **Phase 2 (Verified Export & Anti-Replay):**
   - Flutter client sends `{ action: 'CONFIRM', userConsentGranted: true, consentChallengeToken: '<token_from_phase_1>' }`.
   - Backend verifies:
     - Challenge has not expired (`now <= expiresAt`).
     - Cryptographic signature matches.
     - Payload binding matches (if coordinates or spots were altered between preview and confirmation, verification fails).
     - Nonce has not been consumed (one-time use; replay attempts are strictly rejected).
   - If valid, returns `consentStatus: 'CONSENT_GRANTED'` and `handoffUri`.
   - If challenge token is missing, expired, altered, or replayed, returns `consentStatus: 'CANCELLED'` with `handoffUri: null`.
4. **Privacy Protection:**
   - Raw payment tokens, user passwords, and internal database IDs are permanently excluded (`omittedAttributes`).
   - Deep-link targets official Gemini web app: `https://gemini.google.com/app?context=...`.

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
