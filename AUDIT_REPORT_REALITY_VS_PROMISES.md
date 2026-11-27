# Team InnovoTribe — Codebase vs. Pitch Deck Reality Audit
**Target Codebase:** `neighborhoodguideapp`  
**Evaluation Standard:** Strictly against the **written features, architecture, and AI stack** promised across both Startup Buildathon India 2026 Pitch Decks (ignoring UI mockups and wireframes).  
**Inspection Mode:** Comprehensive read-only audit across `functions/src/**`, `lib/**`, `android/app/**`, and `assets/**`.

---

## Executive Reality Check

Right now, **zero of the headline AI, Google Maps grounding, or on-device Gemma promises work end-to-end in the running app.**

The codebase suffers from three systemic architectural issues that make the app look functional while being driven almost entirely by fakes:
1. **Orphaned Backend:** Substantial TypeScript logic exists in `functions/src/` (mostly built and verified against unit tests), but most of it is either **never exported as a Cloud Function**, **never called by Flutter**, or **called with broken request payloads** whose errors are silently swallowed by `catch (_) {}` blocks that fall back to hardcoded mock arrays.
2. **Default Model Mismatch & Missing Secret Bindings:** The backend defaults to `gemini-3.5-flash-lite` (`functions/src/ai/config/env.ts:22`), marks `gemini-3.8-flash` and `gemini-3.8-live` as untested (`models.ts:76-183`), and fails to bind `{ secrets: [geminiApiKey] }` or `{ secrets: [mapsApiKey] }` on `onAssetCreated`, `Maps-*`, `Assistance-*`, and `Skills-*`.
3. **Deceptive `FLUTTER_TEST` Masking:** Multiple Flutter UI widgets explicitly check `Platform.environment.containsKey('FLUTTER_TEST')` to display honest `[Sample Data]` / `[Sandbox Mode]` disclosures during automated testing, while **deliberately hiding those disclosures in real production app runs** and replacing them with fake live labels like `"Verified Local Spot"` or `"Zero commission cut"`.

---

## 1. Written Promises vs. Reality (All 19 Capabilities)

### Stage 1: Supply & Grounding (6 Items)

#### 1. 2-Minute Regional Voice Note + Street Photo Ingestion
- **Status:** **`[REAL & END-TO-END]`** *(with caveats)*
- **What is real:** Real microphone audio recording via `record` package (`lib/widgets/voice_recorder_tile.dart:28-103`), real camera and gallery photo picking via `image_picker` (`lib/services/photo_helper.dart:18-39`, `lib/screens/add_gem_screen.dart:45-68`), real upload to Firebase Storage buckets (`lib/services/contribution_service.dart:303-356`), and real Cloud Function callable invocations to `Contributions-submitContribution` and `Contributions-recordAssetUpload` (`functions/src/contributions/controllers/contribution.controller.ts:112-252`).
- **Gaps / Fakes:**
  - Audio recording is hard-capped at **90 seconds**, not the promised 2 minutes (`voice_recorder_tile.dart:103`).
  - `submitContribution` silently swallows any backend failure into an in-memory stub object (`contribution_service.dart:220-231`).
  - Contributor profile identity is hardcoded to a mock user `_testProfile` (`Aravinth S`, `usr_blr_782914` at `contribution_service.dart:95-122`).

#### 2. Gemini 3.8 Flash Converting Audio/Photo into Structured Spot Cards
- **Status:** **`[REAL BACKEND, FAKE/UNWIRED FRONTEND]`** *(broken pipeline)*
- **What is real:** The Firestore background trigger `onAssetCreated` (`functions/src/contributions/triggers/contribution-triggers.ts:92-241`) downloads uploaded audio/photo files from Cloud Storage and executes real `@google/genai` extraction calls via `extractVoiceNoteDetails` (`voice-extraction-service.ts:204`) and `extractPhotoDetails` (`photo-extraction-service.ts:192`).
- **Why it is broken / unwired:**
  - The runtime defaults to `gemini-3.5-flash-lite`, not `gemini-3.8-flash` (`env.ts:22`), and `onAssetCreated` lacks `{ secrets: [geminiApiKey] }`.
  - **`synthesizeSpotCard` / `synthesizeSpotCardWithGrounding` (`functions/src/ai/services/spot-card-synthesis-service.ts:211-378`) is NEVER called anywhere in `functions/src/`!**
  - Nothing in the backend ever merges voice and photo data into a published Spot Card, nor transitions a contribution past `AI_ANALYZED` into `MAPS_GROUNDED` or `VERIFIED`. The frontend tracker even admits `[Downstream C2 Integration Pending]` (`lib/widgets/contribution_status_tracker.dart:439`).

#### 3. Google Maps Grounding (Live Hours, Busy Times, Review Sentiment / Tourist-Trap Filtering)
- **Status:** **`[REAL BACKEND, FAKE/UNWIRED FRONTEND]`**
- **What is real:** Real Google Places API (New) calls exist in `PlacesService` (`places.service.ts:28-189`), `PlaceGroundingService` (`grounding.service.ts:40-577`), and callable `Maps-groundContributedPlace` (`maps-controller.ts:166`). Real Gemini `{ googleMaps: {} }` grounding config exists in `spot-card-synthesis-service.ts:100-112`, and real Gemini authenticity scoring exists in `authenticity-assessment-service.ts:111-449`.
- **What is unwired / missing:**
  - Flutter **never calls** `Maps-groundContributedPlace`. Zero callables or triggers invoke `assessPlaceAuthenticity` or `synthesizeSpotCardWithGrounding`.
  - **Live busy times** and **raw review text sentiment** are **never fetched** (neither field exists in the Places field mask at `functions/src/maps/config.ts:62-87` — only `rating`, `userRatingCount`, and `editorialSummary`).
  - Tourist-trap flags in the app originate entirely from hardcoded `isTouristTrap: true` properties in `lib/mock/sample_spots.dart:144-161` and `lib/services/traveler_service.dart:229`.

#### 4. Google Search Grounding (Heritage/Cultural Context & Safety Notices)
- **Status:** **`[REAL BACKEND, FAKE/UNWIRED FRONTEND]`**
- **Reality:** `{ googleSearch: {} }` grounding is configured in `synthesizeSpotCardWithGrounding` (`spot-card-synthesis-service.ts:108-110`), but **zero Cloud Functions, triggers, or Flutter screens ever invoke it**. Completely dormant at runtime.

#### 5. Google Crowdsource Signals (Community Dialect / Place Signals)
- **Status:** **`[NOT IMPLEMENTED]`**
- **Reality:** Codebase comments explicitly acknowledge that Google Crowdsource has no public API (`spot-card-synthesis-service.ts:18`, `grounding.service.ts:84-109`). The only crowd signal endpoint (`Maps-reportVenueCrowd`) stores 1-tap crowd level reports in an **ephemeral in-memory JavaScript `Map`** (`liveCommunitySignalsStore`, `crowd-management.service.ts:50`) that is wiped on cold start and never written to Firestore.

#### 6. Verified Safety / Hygiene Badges
- **Status:** **`[FAKE / SAMPLE DATA ONLY]`**
- **Reality:** There is **zero safety or hygiene verification logic** in the backend or Flutter models. Backend AI explicitly sets `isOfficialVerificationBadge: false` (`authenticity-assessment-service.ts:53-89`) and notes no hygiene certification registry exists (`preference-matching-service.ts:128-195`). Meanwhile, the frontend `SpotCardTile` hardcodes a green **`"Verified Local Spot"`** badge onto **every single card** whenever `FLUTTER_TEST` is false (`lib/widgets/spot_card_tile.dart:259-284`).

---

### Stage 2: AI Matching & Crowd Engine (5 Items)

#### 7. Gemini Embedding 2 Multimodal Vector Search
- **Status:** **`[REAL BACKEND, FAKE/UNWIRED FRONTEND]`**
- **What is real:** Real `gemini-embedding-2` (3,072-dim) API calls and cosine similarity calculations exist in `embedding-service.ts:102-192` and `preference-matching-service.ts:424-863`.
- **What is fake / missing:**
  - Text-only input (`contents: sanitized` string), **not** multimodal photo + audio embeddings.
  - **No Cloud Function callable or trigger exposes `generateEmbedding`, `matchSoloPreferences`, or `matchGroupPreferences`** (`functions/src/index.ts`).
  - Flutter executes simple Dart string comparisons and tag counts over hardcoded mock arrays (`traveler_service.dart:39-255`, `match_vibe_screen.dart:43-90`).

#### 8. Solo & Group Taste Matchmaking ("Group Mode" Blending Multiple Profiles)
- **Status:** **`[REAL BACKEND, FAKE/UNWIRED FRONTEND]`**
- **What is real:** Full Firestore CRUD for user preferences (`Preferences-*`) and multi-user group sessions (`Groups-*`), plus mathematical consensus blending in `Skills-executeGroupBlending` (`skill-group-blending.ts:69-179`) and `preference-matching-service.ts`.
- **What is fake on frontend:**
  - Flutter **never calls** `Preferences-*`, `Groups-*`, or `Skills-executeGroupBlending`.
  - There is **no UI to create/join a group session or invite friends**.
  - Toggling `Solo Explorer` vs `Group Vibe` passes `isGroupMode` into `TravelerService.getDiscoveredPlaces(...)` where the parameter is **completely ignored** (`traveler_service.dart:42`). The `groupSize` selector only checks `remainingCapacity >= groupSize` locally.

#### 9. Real-Time Hourly Venue Crowd Caps
- **Status:** **`[REAL BACKEND, FAKE/UNWIRED FRONTEND]`**
- **What is real:** Transactional Firestore hourly slot reservation, cancellation, check-in, and hourly cron reconciliation exist in `Capacity-*` (`capacity-controller.ts`, `capacity-service.ts`).
- **What is fake on frontend:** Flutter **never calls any `Capacity-*` function** or `Maps-evaluateVenueCapacity`. Every crowd indicator displayed (`4/6`, `3/8`, `4/12`) is a static hardcoded number from `sample_spots.dart`, `traveler_service.dart`, or string literals like `"[Sample C4: Spacious & authentic (4/12 visitors)]"` (`walking_route_screen.dart:755`).

#### 10. Weather & Venue Closure Rules
- **Status:** **`[REAL BACKEND, FAKE/UNWIRED FRONTEND]`**
- **Reality:** A real Google Weather API client exists in `weather.service.ts:29-115`, but is **never invoked anywhere in production backend execution** (only in unit tests). Venue closure detection in `plan-b.service.ts:171-225` checks only a static `SAMPLE_CLOSURE_FIXTURES` table rather than live Places API hours. Flutter has zero weather or closure logic.

#### 11. Google Agent Skills (Voice Extraction, Trap Filtering, Group Blending, Plan-B Rerouting)
- **Status:** **`[FAKE / SAMPLE DATA ONLY]`**
- **Reality:** Four `Skills-*` callables are exported in `skills-controller.ts`, **none of which are called by Flutter**, and none of which run an actual Agent/LLM loop:
  - `Skills-executeVoiceNoteExtraction` (`skill-voice-extraction.ts:206-267`) is **100% fake**: it ignores input audio/photo data, returns hardcoded CTR/Brahmin Coffee Bar strings, and fakes `executionProvenance: 'GEMINI_MULTIMODAL_EXTRACTION'`.
  - `Skills-executeTrapFiltering` (`skill-trap-filtering.ts:71-200`) is deterministic point math (zero Gemini/Maps API calls).
  - `Skills-executeGroupBlending` (`skill-group-blending.ts:69-179`) is deterministic averaging math (zero LLM/embeddings).
  - `Skills-executePlanBRerouting` (`skill-plan-b-rerouting.ts:86-166`) wraps `PlanBReroutingService` with `allowMockFallback: true` and static templates.

---

### Stage 3A: Online Street-Ready Co-Pilot (4 Items)

#### 12. Gemini 3.8 Live Bidirectional Spoken Voice Translation
- **Status:** **`[REAL BACKEND, FAKE/UNWIRED FRONTEND]`**
- **What is real:** Backend `Assistance-initializeLiveSession` (`assistance-controller.ts:82`, `live-assistance-service.ts:75-167`) attempts `client.authTokens.create` for `gemini-3.8-live` (marked `UNTESTED_ENDPOINT`), and `Assistance-translateText` performs unary text translation.
- **What is missing on frontend:** Flutter has **zero WebSocket client, zero audio streaming, zero voice-translation UI, and never calls `initializeLiveSession` or `translateText`**. The only "Ask Guide" feature (`walking_route_screen.dart:1182-1283`) is a **plain text field** calling `Assistance-askStreetCopilot` (which falls back to 4 hardcoded keyword `if/else` replies in `street_assistance_service.dart:159-169`).

#### 13. Local-Language Vendor Order Cards
- **Status:** **`[FAKE / SAMPLE DATA ONLY]`**
- **Reality:** Backend `Assistance-getOrderingPhrases` (`live-assistance-service.ts:408-492`) never calls Gemini — it filters a static 7-item Kannada array (`CURATED_CULTURAL_CARDS`). Flutter does not even call this backend endpoint: `StreetAssistanceService.getCulturalOrderingCards()` returns a hardcoded `const` list of 5 Kannada phrases (`street_assistance_service.dart:97-135`), and Pocket Guide shows hardcoded `spot.greetingCard` strings (`pocket_guide_screen.dart:67-138`).

#### 14. 1-Tap Plan B Dynamic Rerouting
- **Status:** **`[REAL BACKEND, FAKE/UNWIRED FRONTEND]`**
- **What is real:** Backend `Maps-computePlanBReroute` (`maps-controller.ts:108`, `plan-b.service.ts:81-400`) exists (relying on `SAMPLE_CLOSURE_FIXTURES` and `allowMockFallback: true`).
- **Why it is 100% faked on the frontend:**
  - **Pocket Guide:** Tapping Plan B **only displays a SnackBar** claiming spots were swapped, without altering data or invoking an API (`pocket_guide_screen.dart:140-159`).
  - **Walking Route:** `RouteService.requestPlanBAlternative()` sends `{ originalRouteId, constrainedPlaceId }` to `Maps-computePlanBReroute` (`route_service.dart:203-234`), which **always fails validation** because the controller requires `{ originalRoute, disruptions }` (`maps-controller.ts:117`). The `catch (_)` block swallows the error, waits `Future.delayed(400ms)`, and returns a hardcoded backup route (`route_malleshwaram_plan_b_02`). The disruption trigger itself is a hardcoded `const DisruptionAlert` (`route_service.dart:357-385`).

#### 15. Instant Tipping & Revenue Share
- **Status:** **`[REAL BACKEND, FAKE/UNWIRED FRONTEND]`** *(tipping ledger is real on backend; fail-closed rejection in cloud runtime; revenue share missing)*
- **What is real:** Real Firestore transactional tipping, withdrawal, and reward ledger tracking (`Monetization-initiateTip`, `settleTip`, `getContributorRewardSummary`), plus a Razorpay `LivePaymentGatewayAdapter` (`tipping-service.ts`, `live-payment-adapter.ts`). Flutter calls `initiateTip` and `settleTip`.
- **Why it fails / is faked:**
  - **Fail-closed cloud rejection:** Flutter hardcodes `simulatedOutcome: 'SUCCESS'` (`tipping_modal_sheet.dart:254`). In any deployed Cloud Functions environment (`K_SERVICE` / `FUNCTION_TARGET` / `FIREBASE_CONFIG` set), `validateSettlementEnvironment` **strictly rejects simulated settlements** (`payment-environment.ts:26-78`). `MonetizationService.settleTip()` catches the error and silently returns a fake hardcoded `₹100` tip and `₹1345` ledger (`monetization_service.dart:285-335`).
  - **No UPI / Razorpay SDK or intent launch** exists in Flutter.
  - **Revenue share is `[NOT IMPLEMENTED]`:** Purchasing a Route Pass (`pass-service.ts`) never credits contributor ledgers. (Tipping also takes a 5% platform cut despite the production UI falsely claiming `"Zero commission cut"` at `tipping_modal_sheet.dart:109`).

---

### Stage 3B: Offline Edge Mode (4 Items)

#### 16. Gemma 4 E2B Automatic Background Model Setup & On-Device Inference
- **Status:** **`[NOT IMPLEMENTED]`** *(dead scaffolding; cannot execute)*
- **Reality:**
  - `OfflineModelManager` (`offline_model_manager.dart:41-215`) has HTTP download logic for `gemma-4-E2B-it-Q4_K_M.gguf` (3.11 GB), **but is never instantiated or called anywhere in `lib/`**.
  - `LlamaBridge.kt` calls `System.loadLibrary("llama")` (`LlamaBridge.kt:12`), **but zero `libllama.so` binaries or `.gguf` files exist anywhere in `android/app/src/`**, so Gemma 4 E2B can never load or execute.
  - `MainActivity.kt` wires Android ML Kit GenAI (Gemini Nano), but Flutter never triggers offline inference from any screen. `OnDeviceAiService.getAdaptiveVenueTip()` (`on_device_ai_service.dart:65-125`) **runs zero AI inference** — it merely returns cached `SpotCard` text stamped with fake `"On-Device Gemini Nano"` or `"Cloud Gemini Live"` badges.

#### 17. Downloadable Neighborhood Packs
- **Status:** **`[REAL & END-TO-END]`** *(with major content/map caveats)*
- **What is real:** Real Drift/SQLite tables (`LocalSpots`, `LocalRoutes`, `OfflinePacks`, `PackSpots`, `PackRoutes` in `app_database.dart`), real SHA-256 integrity checks, and atomic storage (`offline_pack_service.dart`), wired to `offline_packs_screen.dart` and read by `SpotService.getVerifiedSpots()` (`spot_service.dart:16-41`).
- **Gaps:** Only **one** sample pack exists (`assets/offline_packs/pack_malleshwaram_v1.json`) containing just **1 spot and 1 route with empty `legs: []`**; `WalkingRouteScreen` / `RouteService` **never read** offline routes from Drift; and the offline map canvas (`adaptive_route_map.dart:87-90`) continues attempting to load live `https://tile.openstreetmap.org/...` tiles over the internet.

#### 18. Offline Camera Sign/Menu Translation (140+ Languages On-Device)
- **Status:** **`[FAKE / SAMPLE DATA ONLY]`**
- **Reality:** `StreetAssistanceService.translateStreetImage()` (`street_assistance_service.dart:175-235`) executes **Latin-script-only** ML Kit OCR (`TextRecognitionScript.latin` — incapable of reading Kannada, Hindi, Tamil, or any Indic script), runs **zero translation models**, and looks up text in a **5-key hardcoded Dart dictionary** (`shri sagar`, `benne dose`, `coffee`, `veena stores`, `kadu malleshwara`). Any other text returns `'Local Neighborhood Storefront Sign'`, or waits `250ms` before returning a static Kannada CTR fallback. The UI itself logs `Simulated B5` (`walking_route_screen.dart:1308-1370`).

#### 19. Hands-Free Offline Audio Walking Cues
- **Status:** **`[REAL & END-TO-END]`** *(offline TTS works, but NOT hands-free)*
- **What is real:** Offline `flutter_tts` audio synthesis functions properly in `pocket_guide_screen.dart:161-172` and `walking_route_screen.dart:116-126`.
- **Gaps:** **Not hands-free** — `_checkStepProximity()` updates `_activeStepIndex` at 25m GPS proximity (`walking_route_screen.dart:79-104`) but **never calls `_speakCurrentStep()`** automatically. The user must manually tap the volume/speaker icon, and it only reads static/hardcoded step text.

---

## 2. Backend Inventory (Real vs. Dummy vs. Unused)

### A. Exported Cloud Functions (`functions/src/index.ts`)

| Namespace / Endpoint | Backend Logic Reality | Used by Flutter? | Notes / Bugs |
| :--- | :--- | :--- | :--- |
| `healthCheck` | **Real** HTTP endpoint | No | Binds `geminiApiKey`. |
| `Contributions-submitContribution`, `recordAssetUpload`, `listMyContributions`, `getContributionDetails` | **Real** Firestore CRUD + auth | **Yes** (`submit`, `recordAsset`, `list`) | `getContributionDetails` unused. `submit` falls back to mock on error. |
| `Contributions-onAssetCreated` (Firestore trigger) | **Real** Gemini audio/photo extraction | Triggered on upload | Defaults to `gemini-3.5-flash-lite`; **missing `secrets: [geminiApiKey]`**; never creates Spot Card. |
| `Preferences-*` (`upsert`, `get`, `delete`) | **Real** Firestore CRUD | **No** | Completely unwired from Flutter. |
| `Groups-*` (`create`, `join`, `get`, `updateStatus`) | **Real** Firestore group sessions | **No** | Completely unwired from Flutter. |
| `Capacity-*` (`getHourlyCapacity`, `book`, `cancel`, `checkIn`, `reconcileHourlyCapacity` cron) | **Real** transactional Firestore slots | **No** | Completely unwired from Flutter. |
| `Maps-computeWalkingRoute` | **Real** Google Routes API (with mock fallback) | **Broken** | Flutter sends stops without `coordinate` & reads wrong JSON key -> always falls back to mock (`route_service.dart:33-100`). Missing `mapsApiKey` secret binding. |
| `Maps-computePlanBReroute` | **Hybrid** (Real Routes API + hardcoded `SAMPLE_CLOSURE_FIXTURES`) | **Broken** | Flutter sends `{originalRouteId, constrainedPlaceId}` instead of `{originalRoute, disruptions}` -> always fails validation -> mock fallback (`route_service.dart:203-234`). |
| `Maps-groundContributedPlace`, `evaluateVenueCapacity`, `searchNearbyPlaces` | **Real** Places API / capacity | **No** | Completely unused by Flutter. |
| `Maps-reportVenueCrowd` | **Dummy / In-Memory** (`Map` lost on cold start) | **Yes** (fire-and-forget) | Does not persist to Firestore or update UI slot counts (`crowd-management.service.ts:50-320`). |
| `Monetization-initiateTip`, `settleTip`, `getContributorRewardSummary`, `getContributorProfile`, `registerContributorProfile`, `requestWithdrawal` | **Real** Firestore ledger + Razorpay/Sandbox adapter | **Partial / Broken in Cloud** | `settleTip` fails closed in cloud runtime due to `simulatedOutcome: 'SUCCESS'` (`payment-environment.ts:26-78`); Flutter swallows error into mock `₹1345`. |
| `Monetization-purchaseRoutePass`, `confirmRoutePassPayment`, `validateActiveRoutePass`, `getPassOfferings` | **Real** Firestore passes (no revenue share) | **Partial** (`purchase`, `confirm`) | Same fail-closed sandbox issue in cloud; no contributor revenue share. |
| `Monetization-registerGuidanceOffering`, `listGuidanceOfferings`, `requestLocalGuidance`, `confirmGuidancePayment`, `accept`, `reject`, `cancel`, `complete`, `get`, `listMy` | **Real** Firestore escrow lifecycle | **Partial** (`list`, `request`, `confirm`) | Same fail-closed sandbox issue in cloud. |
| `Monetization-registerPartnerSubscription`, `confirmPartnerSubscriptionPayment`, `getPublicPartnerOffer` | **Real** Firestore merchant subs | **Partial** (`register`, `confirm`) | Same fail-closed sandbox issue in cloud. |
| `Assistance-askStreetCopilot`, `generateTripPlan` | **Real** Gemini text calls (with static fallbacks) | **Yes** (text only) | Missing `secrets: [geminiApiKey]`; uses `gemini-3.5-flash-lite`; `generateTripPlan` is not in the PPTs. |
| `Assistance-initializeLiveSession`, `translateText`, `translateCameraSignage`, `generateAudioGuidance`, `getCulturalInsights` | **Real** Gemini API logic (except fallback templates) | **No** | Completely unused by Flutter; missing `secrets: [geminiApiKey]`. |
| `Assistance-getOrderingPhrases` | **Dummy / Hardcoded** (7-item static Kannada array) | **No** | Zero AI calls (`live-assistance-service.ts:408-492`). |
| `LocalAI-negotiateModelStrategy`, `buildOfflineContextPack`, `getModelManifest` | **Real** manifest/routing helpers (no inference) | **No** | Completely unused by Flutter (`local-ai-controller.ts`). |
| `Skills-executeVoiceNoteExtraction` | **100% DUMMY / FAKE** | **No** | Ignores audio/photo, returns hardcoded CTR/Brahmin Coffee Bar strings, fakes `GEMINI_MULTIMODAL_EXTRACTION` (`skill-voice-extraction.ts:206-267`). |
| `Skills-executeTrapFiltering`, `executeGroupBlending`, `executePlanBRerouting`, `buildGeminiHandoff` | **Deterministic / Non-LLM** (rule-based math & templates) | **No** | Zero Gemini calls; completely unused by Flutter. |

### B. Unexported Real Backend Services (Exist in Code, Never Exposed or Called)
- `synthesizeSpotCard` & `synthesizeSpotCardWithGrounding` (Google Maps + Search grounding) — `functions/src/ai/services/spot-card-synthesis-service.ts`
- `assessPlaceAuthenticity` (Gemini trap/authenticity scoring) — `functions/src/ai/services/authenticity-assessment-service.ts`
- `generateEmbedding` (`gemini-embedding-2`) — `functions/src/ai/services/embedding-service.ts`
- `matchSoloPreferences` & `matchGroupPreferences` — `functions/src/ai/services/preference-matching-service.ts`
- `WeatherService` (Google Weather API client) — `functions/src/maps/services/weather.service.ts` *(only called in unit tests)*

---

## 3. Frontend Sample-Data & Simulation Audit

### A. Hardcoded Sample Datasets
- **`lib/mock/sample_spots.dart:1-176`:** 6 hardcoded Malleshwaram spots (`CTR`, `Veena Stores`, `Kadu Malleshwara Temple`, `8th Cross Flower Market`, `VV Puram Tourist Plaza`, `Commercial Street Emporium`) with static crowd numbers (`4/6`, `3/8`, `18/20`), fake `isTouristTrap: true` tags, and hardcoded Kannada greetings.
- **`lib/services/traveler_service.dart:13-255`:** Sets `useMockDiscovery = true` by default; hardcoded 5-spot discovery catalog + fake match scores (`94%`, `91%`) calculated using basic Dart tag intersections.
- **`lib/services/route_service.dart:70-385`:** Hardcoded `Malleshwaram Heritage & Coffee Trail`, hardcoded Plan B backup route (`route_malleshwaram_plan_b_02`), and `const` hardcoded `DisruptionAlert` (`"Sudden Heavy Rain & Surge at CTR"`).
- **`lib/services/street_assistance_service.dart:97-235`:** Hardcoded 5-item Kannada ordering phrases, 4 keyword copilot fallback strings, and a 5-key OCR translation dictionary.
- **`lib/services/contribution_service.dart:95-231`:** Hardcoded contributor profile (`Aravinth S`), hardcoded past contributions, and silent fallback to a local mock record on submission failure.
- **`lib/services/monetization_service.dart:194-355`:** Hardcoded fallback tip (`CTR Shri Sagar`, `₹100`), hardcoded `₹1345` reward ledger, and hardcoded pass/guidance fallbacks on any callable error.
- **`lib/services/trip_planner_service.dart:132-355` & `lib/screens/trip_planner_screen.dart:166-241`:** Hardcoded multi-day itinerary templates; clicking *"Start Walking Tour"* fabricates a fake 2-stop route (`lat + 0.005`, empty polyline `''`) and labels it `isMockData: false // LIVE dynamic route!`.

### B. `Future.delayed` Fake Simulations
- `traveler_service.dart:45` — `Future.delayed(300ms)` simulating AI taste matching.
- `route_service.dart:66` & `route_service.dart:230` — `Future.delayed(400ms)` simulating route generation and Plan B rerouting before returning hardcoded routes.
- `street_assistance_service.dart:226` — `Future.delayed(250ms)` simulating camera translation before returning hardcoded CTR Kannada text.
- `id_verification_modal_sheet.dart:66` — `Future.delayed(800ms)` fake Aadhaar / Voter ID verification (zero backend check; immediately sets user to verified).
- `contribution_service.dart:394` — `Future.delayed(600ms)` fake moderation appeal.

### C. Fake UI Actions & Deceptive `FLUTTER_TEST` Disguises
- **Fake Plan B Action:** `lib/screens/pocket_guide_screen.dart:140-159` — tapping Plan B only triggers a SnackBar; zero data changes.
- **Fake On-Device AI Badges:** `lib/services/on_device_ai_service.dart:65-125` — attaches `"On-Device Gemini Nano"` or `"Cloud Gemini Live"` badges to static strings without running any inference.
- **Hiding Disclosures in Real App Runs (`!Platform.environment.containsKey('FLUTTER_TEST')`):**
  - `lib/widgets/spot_card_tile.dart:262-283` — hides `[Sample Data]` and displays `"Verified Local Spot"`.
  - `lib/screens/match_vibe_screen.dart:193-213` — hides `[Sample Data]` banner on hardcoded discovery results.
  - `lib/screens/walking_route_screen.dart:483-487` — hides `[Sample Data]` banner on hardcoded walking route.
  - `lib/widgets/tipping_modal_sheet.dart:105-109, 247-249, 377-379` — hides `[Sandbox Mode]` and shows `"Zero commission cut"` (false; backend takes 5%).
  - `lib/screens/route_pass_screen.dart:49-53` & `lib/widgets/pass_checkout_sheet.dart:79-83` — hides `[Sandbox Mode]` disclosures in production runs.

---

## 4. Brutally Honest Scorecard (Against the 19 Written PPT Promises)

| Audit Classification | Count | % of Written Promises | Capabilities |
| :--- | :---: | :---: | :--- |
| **`[REAL & END-TO-END]`** | **3 / 19** | **15.8%** | #1 Voice/Photo capture & upload *(90s cap)*, #17 Offline SQLite packs *(1 sample spot, online map tiles)*, #19 Offline TTS audio *(manual tap, not hands-free)* |
| **`[REAL BACKEND, FAKE/UNWIRED FRONTEND]`** | **10 / 19** | **52.6%** | #2 Spot Card synthesis, #3 Maps grounding, #4 Search grounding, #7 Embedding 2 search, #8 Group matchmaking, #9 Hourly crowd caps, #10 Weather/closure rules, #12 Gemini Live voice translation, #14 1-Tap Plan B rerouting, #15 Instant tipping & revenue share |
| **`[FAKE / SAMPLE DATA ONLY]`** | **4 / 19** | **21.1%** | #6 Verified safety/hygiene badges, #11 Agent Skills, #13 Vendor order cards, #18 Offline camera 140+ lang translation |
| **`[NOT IMPLEMENTED]`** | **2 / 19** | **10.5%** | #5 Google Crowdsource signals, #16 Gemma 4 E2B auto-setup & inference |

### Summary by Requested Buckets
- **Truly working end-to-end with real data/AI right now:** **15.8% (3 of 19)** — exactly **0% (0 of 16)** of the promised AI, Gemini, Google Maps grounding, crowd-cap, or edge-LLM features work end-to-end in the live app. The only 3 working items are basic device plumbing (mic/camera upload, SQLite pack caching, and manual `flutter_tts`).
- **Faked with sample data / simulations in the running app:** **73.7% (14 of 19)** — consisting of **52.6% (10 of 19)** where real backend logic exists but is unwired/broken/masked by frontend mocks, plus **21.1% (4 of 19)** that are hardcoded fakes across the entire stack.
- **Completely missing:** **10.5% (2 of 19)** completely unbuilt (`Google Crowdsource`, `Gemma 4 E2B` runtime) — plus major unbuilt sub-promises inside the other items (contributor revenue share on passes, live busy times, review sentiment, multimodal embeddings, hands-free auto-TTS, and offline map tiles).
