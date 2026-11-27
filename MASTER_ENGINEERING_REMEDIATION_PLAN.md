# Team InnovoTribe — Master Engineering Remediation Plan (Zero Fakes / 100% Reality)
**Target Codebase:** `neighborhoodguideapp`  
**Execution Objective:** Resolve every single audit gap and make ALL 19 written promises from both pitch decks work genuinely end-to-end with real data, live AI, live Google Maps/Search, real Firestore persistence, native on-device Gemma 4 E2B inference, and clean error/empty states.  
**Strict Mandate:** ZERO hardcoded sample data, ZERO fake timer simulations, ZERO hidden `FLUTTER_TEST` disguises, and ZERO silent `catch (_)` fallbacks.

---

## Master Roadmap Overview

```
Phase 1: Foundational Backend, Secrets, Model Config & Auth Plumbing
   ↓
Phase 2: Stage 1 — End-to-End Supply, Gemini 3.8 Flash Synthesis, Maps/Search Grounding, Safety Badges & Community Signals (Promises #1–#6)
   ↓
Phase 3: Stage 2 — Gemini Embedding 2 Multimodal Search, Group Matchmaking, Hourly Crowd Caps, Weather/Closures & Real Agent Skills (Promises #7–#11)
   ↓
Phase 4: Stage 3A — Gemini 3.8 Live Spoken Voice Translation, Dynamic Order Cards, Live Plan B & Tipping / Revenue Share (Promises #12–#15)
   ↓
Phase 5: Stage 3B — Gemma 4 E2B Edge Runtime, Full Offline Packs + Map Tiles, 140+ Lang Offline Camera Translation & Auto Audio Cues (Promises #16–#19)
   ↓
Phase 6: Scorched-Earth Mock Eradication, Honest Error/Empty States & 19-Feature E2E Verification Gate
```

---

## Phase 1: Foundational Backend, Secrets, Model Config & Auth Plumbing
*Prerequisite for every downstream phase: fixes silent runtime crashes, wrong default models, missing secret bindings, and fake user identity.*

### 1.1 Exact Files to Modify
| File | Exact Targets / Lines | Concrete Remediation Actions |
| :--- | :--- | :--- |
| `functions/src/ai/config/env.ts` | `GEMINI_DEFAULT_MODEL` (L22), `getAIConfig()` | Change default model from `'gemini-3.5-flash-lite'` to `'gemini-3.8-flash'`; retain `'gemini-3.5-flash-lite'` strictly as an explicit 503/429 retry fallback. |
| `functions/src/ai/config/models.ts` | `MODEL_REGISTRY` (`GEMINI_FLASH_PRIMARY`, `GEMINI_LIVE_MULTIMODAL`) | Verify and mark live-tested model IDs: `gemini-3.8-flash`, `gemini-embedding-2`, `gemini-3.8-live` (and add `gemini-3.5-live-translate-preview` as a dedicated speech-to-speech option). |
| `functions/src/config/secrets.ts` | Secret definitions (L8–12) | Export `weatherApiKey = defineSecret("WEATHER_API_KEY")` (or explicitly share `mapsApiKey` for Google Weather API) alongside existing `geminiApiKey`, `mapsApiKey`, `razorpayKeyId`, `razorpayKeySecret`, `paymentWebhookSecret`. |
| `functions/src/contributions/triggers/contribution-triggers.ts` | `onAssetCreated` (L92) | Pass `{ document: '...', secrets: [geminiApiKey, mapsApiKey], timeoutSeconds: 180, memory: '512MiB' }` to `onDocumentCreated`. |
| `functions/src/maps/maps-controller.ts` | All 6 `onCall` exports (L49–219) | Bind `{ secrets: [mapsApiKey, geminiApiKey] }` on every `onCall(...)` handler; default `allowMockFallback` to **`false`** everywhere (L154). |
| `functions/src/ai/controllers/assistance-controller.ts` & `functions/src/ai/controllers/skills-controller.ts` | All `onCall` exports | Bind `{ secrets: [geminiApiKey, mapsApiKey] }` on every callable; raise memory to `512MiB` for multimodal calls. |
| `functions/src/monetization/monetization-controller.ts` | All `onCall` exports | Bind `{ secrets: [razorpayKeyId, razorpayKeySecret, paymentWebhookSecret] }`. |
| `lib/config/app_config.dart` | `AppConfig.useMockData` (L7–10) | Remove `useMockData` flag completely; add `AppConfig.apiRegion = 'us-central1'` and explicit `--dart-define` environment flags (`USE_EMULATORS`, `MAPS_API_KEY`). |
| `lib/services/contribution_service.dart` | `_testProfile` (`Aravinth S`, L95–122) | Replace hardcoded `_testProfile` with real `FirebaseAuth.instance.currentUser` UID + Firestore `users/{uid}` / `Monetization-getContributorProfile` fetch; auto-provision profile on first sign-in. |
| `firestore.rules` & `firestore.indexes.json` | New collections + vector index | *(Delegate `firestore.rules` updates to `firestore-rules-author` subagent)* Add read rules for `community_signals`, `safety_verifications`, `revenue_share_ledger`; configure Firestore vector index on `places.embeddingVector` (1,536 dims, COSINE). |

### 1.2 Required Secrets, Environment Variables & SDKs
- **Firebase Secret Manager (`firebase functions:secrets:set`):**
  - `GEMINI_API_KEY` (Google AI Studio / Gemini Developer API key with `gemini-3.8-flash`, `gemini-3.8-live`, `gemini-embedding-2` enabled)
  - `MAPS_API_KEY` (Google Cloud key with Places API (New), Routes API, Weather API, and Maps SDK for Android enabled)
  - `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `PAYMENT_WEBHOOK_SECRET` (Razorpay Test Mode or Live Mode keys)
- **Cloud Functions Runtime Env (`.env` / `functions/.env.<project>`):**
  - `GEMINI_DEFAULT_MODEL=gemini-3.8-flash`
  - `PAYMENT_ENV=LIVE` (pointed at Razorpay Test/Live API keys so `validateSettlementEnvironment` succeeds legitimately without sandbox cheats)
- **Android Build (`android/local.properties` or `-P MAPS_API_KEY=...`):**
  - Real `MAPS_API_KEY` injected into `manifestPlaceholders["MAPS_API_KEY"]` (`android/app/build.gradle.kts:37-38`).
- **Backend NPM:** Upgrade `@google/genai` to `>=2.3.0` in `functions/package.json` to guarantee full `gemini-3.8-flash`, `gemini-3.8-live`, and `gemini-embedding-2` multimodal SDK support.

### 1.3 Phase 1 Verification
- Deploy functions (or run Firebase Emulators with live API keys), invoke `healthCheck`, confirm `FirebaseAuth.instance.currentUser.uid` is persisted in every callable call, and confirm zero `Missing GEMINI_API_KEY` / `Missing MAPS_API_KEY` errors in Cloud Logging.

---

## Phase 2: Stage 1 — End-to-End Supply, Gemini 3.8 Flash Synthesis, Maps/Search Grounding, Safety Badges & Community Signals
*Delivers Promises **#1, #2, #3, #4, #5, #6** end-to-end.*

### 2.1 Exact Files to Modify / Create
| File | Exact Targets / Lines | Concrete Remediation Actions |
| :--- | :--- | :--- |
| `lib/widgets/voice_recorder_tile.dart` | Max recording duration (L103) | Increase hard cap from `90` seconds to **`120` seconds (2 full minutes)** to match the pitch-deck promise. |
| `functions/src/contributions/triggers/contribution-triggers.ts` | `onAssetCreated` (L92–241) | Wire the **complete 5-step pipeline** once required assets (voice + photo) are uploaded: **(1)** `extractVoiceNoteDetails` + `extractPhotoDetails` using `gemini-3.8-flash` -> **(2)** `groundingService.groundContributedPlace(...)` (Places API New) -> **(3)** `synthesizeSpotCardWithGrounding(...)` (Gemini 3.8 Flash with `{ googleMaps: {} }` + `{ googleSearch: {} }`) -> **(4)** `assessPlaceAuthenticity(...)` (review sentiment + trap scoring + safety/hygiene extraction) -> **(5)** `generateMultimodalPlaceEmbedding(...)` (`gemini-embedding-2`) and **write canonical published document to Firestore `places/{placeId}` & `spots/{spotId}`**, updating contribution status `UPLOADED -> AI_ANALYZED -> MAPS_GROUNDED -> VERIFIED` (or `NEEDS_REVIEW` if trap score fails). |
| `functions/src/maps/config.ts` (L62–87) & `functions/src/maps/services/places.service.ts` (L28–189) | `PLACES_FIELD_MASK`, `getPlaceDetails` | Add `places.reviews`, `places.currentOpeningHours`, `places.regularOpeningHours`, `places.businessStatus`, `places.priceLevel`, and `places.goodForGroups` to the Places API (New) field mask so **actual Google review texts** are passed into `assessPlaceAuthenticity` for real review sentiment & tourist-trap detection. |
| `functions/src/ai/services/spot-card-synthesis-service.ts` | `synthesizeSpotCardWithGrounding` (L100–517) | Enforce `model: 'gemini-3.8-flash'`, capture Google Search grounding metadata (`groundingChunks`, `webSearchQueries`) into `culturalContext`, `heritageSummary`, and `safetyNotices[]` persisted on the Spot Card. |
| `functions/src/ai/services/authenticity-assessment-service.ts` | `assessPlaceAuthenticity` (L53–449) | Feed live Places API `reviews[]` + photo cleanliness cues + contributor voice cues into Gemini 3.8 Flash to compute real `touristTrapScore`, `reviewSentimentSummary`, and structured `safetyHygieneChecklist` (`hygieneSignals`, `lightingSafety`, `soloTravelerFriendly`, `verificationTier: 'UNVERIFIED' | 'AI_EVIDENCE_CHECKED' | 'COMMUNITY_VERIFIED'`). **Never** grant verified badge without >=2 corroborating signals (photo + community peer endorsement or moderator approval). |
| `functions/src/maps/services/crowd-management.service.ts` (L50–320) & **NEW** `functions/src/community/community-signals-controller.ts` | Replace `liveCommunitySignalsStore` in-memory `Map` | Persist all community signals to Firestore **`community_signals/{signalId}`** and aggregate into **`places/{placeId}`** (`dialectNotes[]`, `localNameVariants[]`, `hygieneEndorsements`, `safetyReports`, `recentCrowdSignals[]`). Expose callable `Community-submitPlaceSignal` & `Community-verifySafetyHygiene`. |
| `lib/services/spot_service.dart` (L12–90), `lib/widgets/spot_card_tile.dart` (L259–284), `lib/widgets/contribution_status_tracker.dart` (L439) | Spot display & badges | Remove hardcoded `"Verified Local Spot"` badge in `SpotCardTile` (L275). Render real badges strictly from Firestore fields: `verificationTier`, `safetyHygieneBadges[]`, `searchGroundingCitations[]`, `touristTrapStatus`, and `communityDialectNotes[]`. Add a real "Confirm Hygiene / Local Dialect" 1-tap community verification UI on the Spot detail view. |

### 2.2 API Contracts (Flutter <-> Cloud Functions)
- **Published Firestore Document (`spots/{spotId}` & `places/{placeId}`):**
```json
{
  "spotId": "spot_abc123",
  "googlePlaceId": "ChIJ...",
  "name": "Shri Sagar (CTR)",
  "neighborhood": "Malleshwaram",
  "coordinate": { "latitude": 12.9982, "longitude": 77.5695 },
  "aiSynthesis": {
    "modelUsed": "gemini-3.8-flash",
    "storySummary": "...",
    "mustTryItems": ["Benne Masala Dose", "Filter Coffee"],
    "heritageContext": "...",
    "safetyNotices": ["Cash or UPI accepted; narrow footpath outside"],
    "searchGroundingUrls": ["https://..."]
  },
  "mapsGrounding": {
    "isOpenNow": true,
    "regularHours": ["Mon-Sun: 07:30-12:30, 16:00-21:00"],
    "rating": 4.5,
    "userRatingCount": 24100,
    "reviewSentimentScore": 0.87,
    "isTouristTrap": false,
    "trapReasoning": "High local repeat footfall; authentic pricing verified against 5 recent reviews."
  },
  "safetyHygiene": {
    "verificationTier": "COMMUNITY_VERIFIED",
    "badges": ["CLEAN_KITCHEN_VISIBLE", "SOLO_FRIENDLY", "DAYTIME_SAFE"],
    "endorsementCount": 3,
    "lastVerifiedAt": "2026-11-22T12:00:00Z"
  },
  "communitySignals": {
    "dialectPhrases": [{ "language": "kn", "script": "ಬೆಣ್ಣೆ ಮಸಾಲೆ ದೋಸೆ", "transliteration": "Benne Masale Dose", "verifiedByCount": 4 }],
    "latestCrowdLevel": "MODERATE",
    "latestCrowdUpdatedAt": "2026-11-22T12:10:00Z"
  },
  "hourlyCapacityCap": 10,
  "contributorUserId": "<firebase_uid>"
}
```
- **Callable `Community-submitPlaceSignal`:**
  - Request: `{ "placeId": string, "signalType": "CROWD" | "DIALECT" | "SAFETY_HYGIENE", "crowdLevel"?: "LOW"|"MODERATE"|"HIGH"|"AT_CAPACITY", "dialectNote"?: { "language": string, "localText": string, "transliteration": string, "meaning": string }, "hygieneChecks"?: { "cleanPrepArea": boolean, "safeAccess": boolean, "fairLocalPricing": boolean } }`
  - Response: `{ "success": true, "data": { "signalId": string, "updatedVerificationTier": string, "updatedCrowdSummary": object } }`

### 2.3 Platform Caveats & Honest Solutions (Stage 1)
1. **Google Crowdsource has NO public developer API:** Do not fake a Google Crowdsource API call. Implement our **own persistent Firestore-backed Community Crowdsource Signal Engine** (`community_signals` collection) collecting community dialect terms, pronunciation notes, local landmark corrections, and 1-tap crowd/hygiene peer verifications — AND transparently label it as community-sourced local signals (while keeping optional export compatible with Crowdsource-style open datasets).
2. **Google Places API (New) does NOT expose Google Maps "Popular Times / Live Busyness" histogram:** Combine **(a)** real `currentOpeningHours` + `businessStatus` from Places API (New), **(b)** our real-time Firestore `Capacity-*` slot occupancy, and **(c)** persisted recent `community_signals` crowd taps (with a 60-minute decay window). Clearly show both `Open/Closed (Google Maps)` and `Live Spot Occupancy (LocalLens Capacity + Recent Community Reports)`.

### 2.4 Phase 2 Verification (Promises #1–#6)
- Record a 2-minute regional voice note + take a live street photo in `AddGemScreen` -> verify Storage upload -> watch `ContributionStatusTracker` progress live via Firestore snapshots `UPLOADED -> AI_ANALYZED -> MAPS_GROUNDED -> VERIFIED` -> verify new document in `spots/{spotId}` populated by `gemini-3.8-flash` with live Google Maps hours/review sentiment + Google Search heritage citations -> submit 2 community hygiene/dialect signals from a second UID and verify the `COMMUNITY_VERIFIED` safety/hygiene badge flips automatically without any hardcoded flags.

---

## Phase 3: Stage 2 — Gemini Embedding 2 Multimodal Vector Search, Solo/Group Matchmaking, Hourly Crowd Caps, Weather/Closures & Real Agent Skills
*Delivers Promises **#7, #8, #9, #10, #11** end-to-end.*

### 3.1 Exact Files to Modify / Create
| File | Exact Targets / Lines | Concrete Remediation Actions |
| :--- | :--- | :--- |
| `functions/src/ai/services/embedding-service.ts` | `generateEmbedding` (L102–192) | Upgrade to **true multimodal embedding** using `gemini-embedding-2` (`ai.models.embedContent` passing `[textPart, inlinePhotoPart, inlineAudioPart]` when media exists, plus `outputDimensionality: 1536` for Firestore Vector Search). Persist vector on `places/{placeId}.embeddingVector` via `FieldValue.vector(...)`. |
| **NEW** `functions/src/discovery/discovery-controller.ts` & `functions/src/index.ts` | Export `Discovery` namespace | Export callables: **`Discovery-matchSoloSpots`** (reads user `preferences/{uid}`, generates query embedding via `gemini-embedding-2`, executes Firestore `findNearest` / cosine similarity against `places`, filters out tourist traps & closed/over-cap venues, returns ranked spots with real similarity scores) and **`Discovery-matchGroupSpots`** (reads `group_sessions/{sessionId}`, loads all members' `preferences/{memberUid}`, blends vectors + dietary/budget/accessibility hard constraints via `matchGroupPreferences`, filters by `remainingCapacity >= memberCount`, returns ranked consensus spots). |
| `functions/src/maps/services/weather.service.ts` (L29–115) & `functions/src/maps/services/plan-b.service.ts` (L171–225) | `WeatherService`, `PlanBReroutingService`, `SAMPLE_CLOSURE_FIXTURES` | **Delete `SAMPLE_CLOSURE_FIXTURES` completely.** Wire `WeatherService.getCurrentWeather(lat, lng)` directly into `Discovery-matchSoloSpots`, `Discovery-matchGroupSpots`, `Maps-computeCapacityAwareRoute`, and `Maps-computePlanBReroute`. Replace fixture closure lookups with **live `PlacesService.getPlaceDetails(googlePlaceId)`** checking `businessStatus !== 'OPERATIONAL'` or `currentOpeningHours.openNow === false`. |
| `functions/src/ai/skills/skill-voice-extraction.ts` (L206–267), `skill-trap-filtering.ts` (L71–200), `skill-group-blending.ts` (L69–179), `skill-plan-b-rerouting.ts` (L86–166) | All 4 Agent Skill executors | **Eliminate all fake/hardcoded outputs in `skill-voice-extraction.ts`.** Make every Agent Skill callable orchestrate real Gemini 3.8 Flash / Maps / Embedding tools: (1) `executeVoiceNoteExtraction` -> real `extractVoiceNoteDetails` + `extractPhotoDetails`; (2) `executeTrapFiltering` -> fetches live Places API details + runs `assessPlaceAuthenticity`; (3) `executeGroupBlending` -> loads real group preferences + runs `gemini-embedding-2` vector centroid blending + Gemini 3.8 Flash rationale; (4) `executePlanBRerouting` -> checks live Weather + live Places hours + `CapacityService` + `RoutesService`. |
| `lib/services/traveler_service.dart` (L13–255), `lib/providers/traveler_providers.dart`, `lib/screens/match_vibe_screen.dart` (L43–390), `lib/widgets/traveler_onboarding_sheet.dart` | Discovery & Preferences | Delete `useMockDiscovery` and hardcoded catalog. Wire `TravelerOnboardingSheet` to `Preferences-upsertPreferences` + `Preferences-getPreferences`. Wire `MatchVibeScreen` to call `Discovery-matchSoloSpots` (Solo) or `Discovery-matchGroupSpots` (Group). |
| **NEW** `lib/widgets/group_session_sheet.dart` & `lib/services/group_capacity_service.dart` | Group Mode & Live Crowd Caps | Build real **Group Mode UI** (Create Group -> displays 6-char shareable join code via `Groups-createGroupSession`; Join Group via `Groups-joinGroupSession`; live member list via Firestore snapshot on `group_sessions/{id}`). Wire live **Hourly Crowd Caps** via `Capacity-getHourlyCapacity` + Firestore stream on `places/{placeId}/hourly_capacities/{slotId}`, and add **"Reserve Hourly Slot" / "Check In" / "Cancel"** buttons wired to `Capacity-bookScheduledVisit`, `Capacity-checkInScheduledVisit`, and `Capacity-cancelScheduledVisit`. |

### 3.2 API Contracts (Flutter <-> Cloud Functions)
- **`Discovery-matchSoloSpots`:**
  - Request: `{ "neighborhood": string, "coordinate": { "latitude": number, "longitude": number }, "queryText"?: string, "intendedVisitTimeIso": string, "partySize": number }`
  - Response: `{ "success": true, "data": { "weatherContext": { "condition": string, "isRainAlert": boolean, "tempC": number }, "spots": [{ "spot": SpotCard, "embeddingSimilarityScore": number, "remainingHourlySlots": number, "hourlyCapacityCap": number, "isOpenNow": boolean, "whyMatched": string }] } }`
- **`Discovery-matchGroupSpots`:**
  - Request: `{ "sessionId": string, "neighborhood": string, "coordinate": { "latitude": number, "longitude": number }, "intendedVisitTimeIso": string }`
  - Response: `{ "success": true, "data": { "sessionId": string, "memberCount": number, "blendedVibeSummary": string, "weatherContext": object, "spots": [{ "spot": SpotCard, "groupConsensusScore": number, "perMemberFit": Record<string, number>, "remainingHourlySlots": number, "hourlyCapacityCap": number }] } }`
- **`Capacity-bookScheduledVisit`:**
  - Request: `{ "placeId": string, "slotStartIso": string, "partySize": number, "groupSessionId"?: string }`
  - Response: `{ "success": true, "data": { "visitId": string, "remainingSlots": number, "maxCapacity": number, "status": "BOOKED" } }`

### 3.3 Platform Caveats & Honest Solutions (Stage 2)
- **Firestore Native Vector Search Dimension Limit (`2048` dims vs `3072` dims):** Firestore `findNearest` caps vector indexes at 2,048 dimensions, whereas `gemini-embedding-2` defaults to 3,072 dims. **Solution:** Pass `outputDimensionality: 1536` (Matryoshka Representation Learning natively supported by `gemini-embedding-2` with negligible accuracy loss and 50% storage savings) so Firestore's native `findNearest` vector index works cleanly at scale.

### 3.4 Phase 3 Verification (Promises #7–#11)
- Query a vibe in `MatchVibeScreen` -> verify `Discovery-matchSoloSpots` calls `gemini-embedding-2`, returns non-hardcoded cosine similarity scores, and shows live weather banner.
- Create a Group Session on Device A, join with the 6-char code on Device B with conflicting preferences -> verify `Discovery-matchGroupSpots` returns blended consensus spots respecting hard constraints.
- Tap "Reserve Slot" on a spot showing `4/10` -> verify Firestore transaction updates live stream on both devices to `6/10` (and blocks booking when at `10/10`).
- Trigger all 4 `Skills-*` callables via integration test and UI flows -> verify real Gemini/Maps outputs and zero hardcoded `CTR` / `Brahmin Coffee Bar` strings.

---

## Phase 4: Stage 3A — Online Street-Ready Co-Pilot (Gemini 3.8 Live Spoken Voice Translation, Dynamic Order Cards, Live Plan B & Tipping / Revenue Share)
*Delivers Promises **#12, #13, #14, #15** end-to-end.*

### 4.1 Exact Files to Modify / Create
| File | Exact Targets / Lines | Concrete Remediation Actions |
| :--- | :--- | :--- |
| `functions/src/ai/services/live-assistance-service.ts` | `initializeLiveSession` (L75), `getOrderingPhrases` (L408) | **(1)** Fix `initializeLiveSession` to mint a real `v1beta` ephemeral token via `@google/genai` `client.authTokens.create(...)` scoped to `gemini-3.8-live` (and return `websocketUrl`, `ephemeralToken`, `model: 'gemini-3.8-live'`, `systemInstruction` tailored to active spot + source/target languages). **(2)** Replace the hardcoded 7-item Kannada array in `getOrderingPhrases` with a **real `gemini-3.8-flash` structured JSON call** generating dynamic vendor order cards for the exact spot, menu items, dietary constraints, and target regional language, cached in Firestore `places/{placeId}/order_cards/{lang}_{hash}`. |
| **NEW** `lib/services/gemini_live_voice_service.dart` & **NEW** `lib/widgets/live_voice_translator_sheet.dart` | Real-time Gemini 3.8 Live client | Implement real bidirectional WebSocket client to Gemini Live API (`wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContentConstrained?access_token=<ephemeralToken>`): stream mic audio (`record.startStream` PCM 16-bit mono 16kHz base64 chunks via `realtimeInput.audio`) and play incoming 24kHz PCM audio chunks (`serverContent.modelTurn.parts[].inlineData`) in real time, displaying live input + output transcripts. Wire directly from `WalkingRouteScreen` & `PocketGuideScreen` mic button. |
| `lib/services/street_assistance_service.dart` (L97–170) & `lib/screens/pocket_guide_screen.dart` (L67–159) | Order Cards & Pocket Guide Plan B | Delete hardcoded 5-item Kannada `const` list. Call `Assistance-getOrderingPhrases` dynamically with current `spotId`, `spotName`, `mustTryItems`, `targetLanguage`, and `dietaryNotes`. Wire `PocketGuideScreen._handlePlanB` (L140–159) to call real `Maps-computePlanBReroute` and **actually replace the affected spot in provider state** (not just show a SnackBar!). |
| `lib/services/route_service.dart` (L33–385) & `lib/screens/walking_route_screen.dart` (L483–760) | `getPersonalizedRoute`, `requestPlanBAlternative`, disruption polling | **(1)** Fix `computeWalkingRoute` request payload to send full `{ stops: [{ placeId, name, coordinate: { latitude, longitude } }] }` and parse `response.data['data']` (exact backend envelope!). **(2)** Fix `computePlanBReroute` payload to send `{ originalRoute, disruptions, candidateAlternatives, allowMockFallback: false }`. **(3)** Delete hardcoded `DisruptionAlert` (`route_service.dart:357–385`); derive live disruptions from real `WeatherService` + `Capacity-getHourlyCapacity` + `PlacesService` open-status checks on active route stops. |
| `functions/src/monetization/services/pass-service.ts`, `functions/src/monetization/services/tipping-service.ts`, `lib/services/monetization_service.dart` (L194–355), `lib/widgets/tipping_modal_sheet.dart` (L105–379), `lib/widgets/pass_checkout_sheet.dart` | Live Razorpay UPI Checkout + **Contributor Revenue Share** | **(1)** Implement **real Revenue Share** in `PassService.confirmRoutePassPayment`: inside the Firestore transaction, look up the contributors of verified spots in the pass's neighborhood and credit an automatic contributor pool share (20% of net pass revenue split pro-rata by spot check-ins/verifications) into each contributor's `contributor_rewards/{uid}` ledger + append audit entry to `revenue_share_ledger/{entryId}`. **(2)** Integrate official `razorpay_flutter` SDK in `TippingModalSheet` & `PassCheckoutSheet`: call `Monetization-initiateTip` / `purchaseRoutePass` -> receive real Razorpay `orderId` -> open Razorpay UPI/Card sheet -> verify signature server-side via `Monetization-settleTip` / webhook (removing `simulatedOutcome: 'SUCCESS'` completely!). **(3)** Align Tipping UI copy with actual platform fee (either set `platformFeeInr = 0` for 100% pass-through micro-tips if promised, or accurately display the 5% fee). |

### 4.2 API Contracts (Flutter <-> Cloud Functions)
- **`Assistance-initializeLiveSession`:**
  - Request: `{ "sourceLanguage": "en", "targetLanguage": "kn", "spotId": string, "spotName": string, "mode": "BIDI_VOICE_TRANSLATION" }`
  - Response: `{ "success": true, "data": { "ephemeralToken": string, "expiresAt": string, "model": "gemini-3.8-live", "websocketUrl": string, "audioInputMime": "audio/pcm;rate=16000", "audioOutputSampleRate": 24000, "systemInstruction": string } }`
- **`Assistance-getOrderingPhrases`:**
  - Request: `{ "spotId": string, "spotName": string, "targetLanguage": string, "menuHints": string[], "dietaryRestrictions": string[] }`
  - Response: `{ "success": true, "data": { "generatedByModel": "gemini-3.8-flash", "cards": [{ "englishIntent": string, "localScript": string, "phoneticTransliteration": string, "culturalEtiquetteTip": string }] } }`
- **`Maps-computeWalkingRoute`:**
  - Request: `{ "stops": [{ "placeId": string, "name": string, "coordinate": { "latitude": number, "longitude": number } }], "travelMode": "WALK" }`
  - Response: `{ "success": true, "data": CanonicalRouteDocument, "metadata": { ... } }`
- **`Maps-computePlanBReroute`:**
  - Request: `{ "originalRoute": CanonicalRouteDocument, "disruptions": [{ "placeId": string, "reason": "RAIN" | "CLOSED" | "AT_CAPACITY", "severity": "HIGH" }], "allowMockFallback": false }`
  - Response: `{ "success": true, "data": { "reroutedRoute": CanonicalRouteDocument, "replacedStops": [...], "explanation": string } }`
- **`Monetization-settleTip`:**
  - Request: `{ "tipId": string, "razorpayOrderId": string, "razorpayPaymentId": string, "razorpaySignature": string }`
  - Response: `{ "success": true, "data": { "tip": TipTransaction, "rewardLedger": ContributorRewardLedger } }`

### 4.3 Required New Flutter SDK Dependencies (`pubspec.yaml`)
- `web_socket_channel: ^3.0.1` — Direct WSS connection to Gemini 3.8 Live API using backend-minted ephemeral tokens.
- `flutter_pcm_sound: ^3.1.2` (or thin Kotlin `AudioTrack` platform channel in `MainActivity.kt`) — Low-latency 24kHz PCM playback of Gemini Live spoken voice output.
- `razorpay_flutter: ^1.3.7` — Native Android/iOS UPI & payment checkout sheet.

### 4.4 Platform Caveats & Honest Solutions (Stage 3A)
- **Razorpay / Indian UPI Live KYC vs. Buildathon Demo:** Getting full live bank-settlement KYC approved takes multiple business days. **Honest Engineering Solution:** Use **Razorpay Test Mode API keys** (`rzp_test_*`) with `LivePaymentGatewayAdapter` (`PAYMENT_ENV=LIVE`) and the real `razorpay_flutter` native checkout sheet. Every network request hits real Razorpay servers (`api.razorpay.com`), generates real order IDs, verifies real HMAC-SHA256 payment signatures server-side, and executes atomic Firestore ledger & revenue-share transactions — zero local mocks, zero `simulatedOutcome` hacks, and instant switch to production bank settlement by swapping `rzp_test_*` -> `rzp_live_*` in Secret Manager.

### 4.5 Phase 4 Verification (Promises #12–#15)
- Tap "Live Voice Translator" -> speak English ("Less spicy, no peanuts") -> hear spoken Kannada audio streamed back from `gemini-3.8-live` and view live bidirectional transcripts; reply in Kannada -> hear English translation.
- Open newly contributed spot -> verify `Assistance-getOrderingPhrases` generates spot-specific dynamic vendor cards.
- Start walking route -> verify real Google Routes API polyline + steps rendered -> simulate a real stop closure/capacity-full in Firestore -> tap 1-Tap Plan B -> verify live recomputed route polyline & swapped stop from `Maps-computePlanBReroute`.
- Complete a ₹50 tip and a Route Pass purchase via Razorpay Test UPI -> verify server-side HMAC verification, Firestore `tips/{id}` = `COMPLETED`, `contributor_rewards/{uid}` balance increment, and `revenue_share_ledger` distribution entries.

---

## Phase 5: Stage 3B — Offline Edge Mode (Gemma 4 E2B On-Device Runtime, Full Offline Packs + Map Tiles, 140+ Lang Offline Camera Translation & Auto Audio Cues)
*Delivers Promises **#16, #17, #18, #19** end-to-end.*

### 5.1 Exact Files to Modify / Create
| File | Exact Targets / Lines | Concrete Remediation Actions |
| :--- | :--- | :--- |
| `android/app/build.gradle.kts` (L60–64), `android/app/src/main/kotlin/com/innovotribe/locallens/MainActivity.kt`, `LlamaBridge.kt` | Native Android on-device Gemma 4 E2B runtime | Replace the broken `System.loadLibrary("llama")` stub (missing `libllama.so`) with Google's official **MediaPipe LLM Inference / LiteRT-LM Android SDK** (`com.google.mediapipe:tasks-genai` / `com.google.ai.edge.litertlm:litertlm-android`) supporting **Gemma 4 E2B quantized `.task` / `.litertlm` multimodal bundles** (text + vision!) with GPU/CPU delegate selection. Keep ML Kit Gemini Nano (`genai-prompt`) strictly as Tier-1 fast fallback on AICore devices. Expose real MethodChannel calls: `loadGemmaModel(modelPath)`, `generateText(prompt)`, `generateMultimodal(prompt, imagePath)` (for offline camera translation!), and `getHardwareCapability()` (RAM/storage check). |
| `lib/services/offline_model_manager.dart` (L41–215), `lib/main.dart`, `lib/screens/offline_packs_screen.dart` | Automatic background Gemma 4 E2B setup | Wire `OfflineModelManager` into app startup + `WorkManager` / `connectivity_plus` Wi-Fi background listener: check device RAM (>=6 GB) & free storage (>=4 GB), fetch canonical model manifest & signed download URL + SHA-256 from `LocalAI-getModelManifest`, download in background with pause/resume progress UI inside `OfflinePacksScreen`, verify SHA-256, and initialize the native Gemma 4 E2B engine automatically. |
| `lib/services/on_device_ai_service.dart` (L65–125) | `getAdaptiveVenueTip` | Delete the fake badge-stamping logic. Route genuinely: if offline & Gemma 4 E2B loaded -> invoke real `generateText` against local SQLite spot context and badge **`"On-Device Gemma 4 E2B"`**; else if AICore Gemini Nano ready -> invoke real ML Kit `genai-prompt` and badge **`"On-Device Gemini Nano"`**; else if online -> invoke `Assistance-askStreetCopilot` (`"Cloud Gemini 3.8 Flash"`); else display honest `"Offline Model Not Downloaded Yet"` state. |
| **NEW** `functions/src/offline/pack-builder-controller.ts`, `lib/services/offline_pack_service.dart`, `lib/services/offline_tile_provider.dart`, `lib/widgets/adaptive_route_map.dart` (L87–90), `lib/services/route_service.dart` | Real Neighborhood Packs + Offline Map Tiles + Offline Routes | **(1)** Add Cloud Function `LocalAI-generateNeighborhoodPack(neighborhood)` that compiles ALL verified Firestore `spots`, precomputed walking routes (with non-empty `legs[]` and polylines!), and cached vendor order cards for a neighborhood into a versioned SHA-256 pack in Firebase Storage + `offline_packs/{packId}` manifest. **(2)** Download local raster map tiles (zoom 14–17 bounding box of neighborhood) into local app directory during pack download via `flutter_map` `FileTileProvider` (or MBTiles via `flutter_map_mbtiles`), and update `AdaptiveRouteMap._buildOfflineMapCanvas` to load tiles strictly from disk when offline (zero `tile.openstreetmap.org` calls offline). **(3)** Update `RouteService` to read cached routes from Drift `LocalRoutes` when offline. |
| `lib/services/street_assistance_service.dart` (L175–235) | `translateStreetImage` | **Delete the 5-key hardcoded dictionary and 250ms CTR fallback.** Implement real **2-path camera sign/menu translation**: **(a) Offline Mode:** Pass captured image directly into **Gemma 4 E2B multimodal vision (`generateMultimodal`)** on-device (supports 140+ languages including Kannada, Tamil, Telugu, Hindi, Japanese, Arabic, etc., directly from pixels without Latin-only OCR limits!), falling back on lower-RAM devices to multi-script OCR + `google_mlkit_translation` (59 downloaded languages) with honest capability notice; **(b) Online Mode:** Call existing real backend `Assistance-translateCameraSignage` (`gemini-3.8-flash` vision). |
| `lib/screens/walking_route_screen.dart` (L79–126) | `_checkStepProximity` | Add a `"Hands-Free Audio"` toggle (default ON during active navigation). When `_checkStepProximity` detects GPS within `25m` of the next waypoint (or off-route >`40m`), **automatically invoke `_speakCurrentStep()`** via offline `flutter_tts` without requiring any screen tap, deduplicated by `_lastSpokenStepIndex`. |

### 5.2 API Contracts (Flutter <-> Backend & Native Android)
- **Backend `LocalAI-generateNeighborhoodPack`:**
  - Request: `{ "neighborhood": string }`
  - Response: `{ "success": true, "data": { "packId": string, "version": string, "downloadUrl": string, "sha256": string, "spotCount": number, "routeCount": number, "tileBounds": { "north": number, "south": number, "east": number, "west": number, "minZoom": 14, "maxZoom": 17 } } }`
- **Flutter <-> Android MethodChannel (`com.innovotribe.locallens/edge_ai`):**
  - `checkDeviceSupport()` -> `{ "totalRamMb": int, "freeStorageMb": int, "gemmaE2bSupported": bool, "geminiNanoAvailable": bool }`
  - `initGemmaE2B({ "modelPath": String, "useGpu": bool })` -> `{ "loaded": bool, "backend": "GPU"|"CPU", "loadTimeMs": int }`
  - `runGemmaMultimodal({ "prompt": String, "imagePath"?: String, "maxTokens": int })` -> `{ "text": String, "tokensPerSec": double, "model": "gemma-4-e2b" }`

### 5.3 Required Native Assets, Dependencies & Hardware Caveats (Stage 3B)
- **Android Dependencies:** `com.google.mediapipe:tasks-genai` (or `litertlm-android`), Flutter `connectivity_plus`, `workmanager`, and `google_mlkit_translation` (fallback for <6 GB RAM phones).
- **Model Hosting:** Host the quantized **Gemma 4 E2B** bundle (`.litertlm` / `.task`, ~1.5–2.2 GB INT4 multimodal or 3.11 GB Q4_K_M) in Firebase Storage / Hugging Face CDN with SHA-256 checksum served by `LocalAI-getModelManifest`. **Never** bundle a multi-GB model inside the APK.
- **Hardware Reality Caveat:** Mid/low-end Android phones with <6 GB RAM cannot load a 2B–3GB model without Android OOM-killing the app. **Honest Engineering Solution:** Implement explicit device capability gating in `checkDeviceSupport()`:
  - **>=6 GB RAM & >=4 GB free storage:** Auto-downloads Gemma 4 E2B over Wi-Fi in background and runs full 140+ language multimodal camera translation + offline street Q&A on-device.
  - **<6 GB RAM devices:** Honestly informs the user that device RAM is below Gemma 4 E2B threshold, automatically offers lightweight ML Kit On-Device Translation + Gemini Nano (if Pixel/AICore) + cached Drift neighborhood packs, and never pretends Gemma 4 E2B is running.

### 5.4 Phase 5 Verification (Promises #16–#19)
- Put Android device on Wi-Fi -> confirm automatic background download & SHA-256 verification of Gemma 4 E2B -> download a real Firestore-generated neighborhood pack (spots + routes + map tiles).
- Turn on **Airplane Mode (100% Offline)**:
  - Open `OfflinePacksScreen` / `PocketGuideScreen` / `WalkingRouteScreen` -> verify map tiles render from local disk, walking route loads from Drift SQLite, and offline street tip is generated live by Gemma 4 E2B (verifiable via latency + non-canned answer to a novel question).
  - Point camera at a **real Kannada / Hindi / handwritten menu or sign** -> verify live on-device Gemma 4 E2B multimodal translation with zero internet.
  - Walk (or feed GPS mock coordinates along route in Android Developer Options) within 25m of next turn -> verify `flutter_tts` **automatically speaks** the cue hands-free without touching the screen.

---

## Phase 6: Scorched-Earth Mock Eradication, Honest Error/Empty States & Final Audit Gate
*Guarantees zero hardcoded sample data, zero fake timers, zero `FLUTTER_TEST` disguises, and zero silent mock fallbacks remain anywhere in the repo.*

### 6.1 Files to Delete Completely
1. **DELETE** `lib/mock/sample_spots.dart`
2. **DELETE** `assets/offline_packs/pack_malleshwaram_v1.json` (replace with live Firestore-built packs from Firebase Storage; seed Firestore with real contributed & Maps-grounded Malleshwaram spots through the real Stage 1 pipeline!)
3. **DELETE** `SAMPLE_CLOSURE_FIXTURES` & mock route builders inside `functions/src/maps/fixtures/` (keep fixtures strictly under `functions/src/__tests__/fixtures/` for unit tests only — never imported by production `src/`!).

### 6.2 Every Mock, Timer, Silent Catch & `FLUTTER_TEST` Disguise to Purge
| Category | Exact Files & Lines to Clean | Replacement Behavior |
| :--- | :--- | :--- |
| **`FLUTTER_TEST` Production Disguises** | `lib/widgets/spot_card_tile.dart` (L262–283), `lib/screens/match_vibe_screen.dart` (L193–213), `lib/screens/walking_route_screen.dart` (L483–487), `lib/widgets/tipping_modal_sheet.dart` (L105–379), `lib/screens/route_pass_screen.dart` (L49–53), `lib/widgets/pass_checkout_sheet.dart` (L79–312), `lib/widgets/traveler_preference_summary_card.dart` | **Remove every single `Platform.environment.containsKey('FLUTTER_TEST')` branch** in `lib/`. UI must display identical, truthful state in tests and production. |
| **`Future.delayed` Fake Simulations** | `lib/services/traveler_service.dart` (L45), `lib/services/route_service.dart` (L66, L230), `lib/services/street_assistance_service.dart` (L226), `lib/widgets/id_verification_modal_sheet.dart` (L66), `lib/services/contribution_service.dart` (L394) | Delete all artificial sleeps. Wire `IdVerificationModalSheet` to real backend `Monetization-submitVerificationRequest` (persisting `PENDING_REVIEW` status in Firestore instead of fake instant approval); wire moderation appeals to a real Firestore `appeals` callable. |
| **Silent `catch (_) {}` Mock Fallbacks** | `lib/services/contribution_service.dart` (L220–231), `lib/services/route_service.dart` (L60–321), `lib/services/monetization_service.dart` (L194–355), `lib/services/street_assistance_service.dart` (L159–235), `lib/services/trip_planner_service.dart` (L132–355), `lib/screens/trip_planner_screen.dart` (L166–241) | Replace every silent fallback with **typed `AppFailure` exceptions** surfaced to Riverpod `AsyncValue.error` -> clean Retry / Offline-Mode / Empty-State UI widgets. In `TripPlannerScreen`, call real `Maps-computeWalkingRoute` using grounded coordinates instead of `lat + 0.005` fabrication. |
| **Dead Mock Flags & Static Strings** | `useMockData`, `useMockDiscovery`, `isMockData`, `"[Sample C4: ...]"`, `"Simulated B5"` | Rip out across all Dart & TS files; add a CI/lint grep gate that **fails the build** if `FLUTTER_TEST`, `sample_spots`, `Simulated B5`, `Sample C4`, or `allowMockFallback: true` appears anywhere in `lib/` or non-test `functions/src/`. |

### 6.3 Final 19-Feature End-to-End Verification Matrix (Definition of Done)

| # | Written Pitch-Deck Promise | Phase Completed | Live Proof Required Before Sign-Off |
| :-: | :--- | :---: | :--- |
| 1 | 2-min regional voice + street photo ingestion | Ph 1–2 | 120s mic capture + real photo -> Storage + Firestore `contributions/{id}` under real Auth UID |
| 2 | Gemini 3.8 Flash audio/photo -> structured Spot Card | Ph 2 | Cloud Logs show `gemini-3.8-flash` call in `onAssetCreated` writing real `spots/{id}` |
| 3 | Google Maps grounding (hours, busy/occupancy, review sentiment, trap filtering) | Ph 2 | Places API New `reviews` + `currentOpeningHours` + real trap score stored on `spots/{id}` |
| 4 | Google Search grounding (heritage & safety notices) | Ph 2 | Non-empty `searchGroundingUrls` + heritage/safety strings on `spots/{id}` |
| 5 | Community dialect / place signals | Ph 2 | Persisted `community_signals` doc survives Cloud Function cold start & updates spot UI |
| 6 | Verified safety / hygiene badges | Ph 2 | Badge renders ONLY when `safetyHygiene.verificationTier == 'COMMUNITY_VERIFIED'` in Firestore |
| 7 | Gemini Embedding 2 multimodal vector search | Ph 3 | `gemini-embedding-2` called with text+image+audio; Firestore vector search ranks spots live |
| 8 | Solo & Group Taste Matchmaking (Group Mode) | Ph 3 | 2 separate devices/UIDs join 6-char group code -> blended consensus spots returned |
| 9 | Real-time hourly venue crowd caps | Ph 3 | Booking slot decrements Firestore counter in real time across devices; enforces cap at 0 |
| 10 | Weather & venue closure rules | Ph 3 | Live Weather API + live Places `openNow` dynamically flag/deprioritize rain-exposed/closed stops |
| 11 | Google Agent Skills (all 4 skills) | Ph 3 | All 4 `Skills-*` callables run real Gemini/Maps/Embedding logic with zero hardcoded CTR strings |
| 12 | Gemini 3.8 Live bidirectional spoken voice translation | Ph 4 | Live WSS session over ephemeral token streams 16kHz mic PCM <-> 24kHz translated voice audio |
| 13 | Dynamic local-language vendor order cards | Ph 4 | Newly created spot generates custom regional-script order cards via `gemini-3.8-flash` |
| 14 | 1-Tap Plan B dynamic rerouting | Ph 4 | Both Pocket Guide & Walking Route call `Maps-computePlanBReroute` and redraw live polyline |
| 15 | Instant tipping & contributor revenue share | Ph 4 | Razorpay checkout -> HMAC server verify -> Firestore `contributor_rewards` + `revenue_share_ledger` |
| 16 | Gemma 4 E2B auto background setup & edge inference | Ph 5 | Background Wi-Fi download + SHA-256 verify + real offline inference via MediaPipe/LiteRT-LM |
| 17 | Downloadable neighborhood packs (spots, routes, tiles) | Ph 5 | Airplane mode renders downloaded spots, full routes, and disk-cached map tiles |
| 18 | Offline camera sign/menu translation (140+ languages) | Ph 5 | Airplane mode photo of Indic/non-Latin menu translated live on-device by Gemma 4 E2B vision |
| 19 | Hands-free offline audio walking cues | Ph 5 | Airplane mode GPS proximity <=25m auto-speaks next step via `flutter_tts` with zero taps |
