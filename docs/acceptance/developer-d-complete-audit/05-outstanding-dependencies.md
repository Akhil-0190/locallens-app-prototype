# Part 5 — Outstanding Issues and External Dependencies

**Project:** Startup Buildathon India 2026 — Neighborhood Guide App (LocalLens)  
**Developer:** Developer D  
**Scope:** Transparent classification of all outstanding external dependencies, blocked integrations, and necessary actions required from Developers A, B, and C.

---

## 1. Developer A (Backend Infrastructure & Firebase Lead) Dependencies

| Dependency ID | Required Action / Deliverable | Impact on Developer D Client | Required Interface / Confirmation | Evidence That Will Prove Resolution |
|:---:|---|---|---|---|
| **DEP-A-01** | **Live Cloud Functions & Firestore Deployment:** Deploy TypeScript Cloud Functions (A1–A5) to live Firebase project (`us-central1`). | Client currently connects to local in-memory simulation adapters or test fixtures. Live network requests fail without deployed cloud backend. | Live HTTPS callable endpoints reachable via `FirebaseFunctions.instanceFor(region: 'us-central1')`. | Successful callable execution from physical device or emulator without using test flags. |
| **DEP-A-02** | **Firestore & Storage Security Rules Merge:** Deploy `firestore.rules` and `storage.rules` to live Firebase project. | Live uploads of contributor audio memos and photos require authenticated Storage security rules. | Verified read/write permissions on `contributions/{contributionId}` in Firebase Console. | Live upload test via `ContributionService.uploadMediaAssets` with non-null download URLs. |
| **DEP-A-03** | **Self-Service Backend Callables for Drafts:** Implement backend callables for `Monetization-submitPartnerSubscription` and `Monetization-submitIdVerification`. | Client currently stores partner merchant registrations and residency ID verification strictly as **Local Drafts**. | Agreed payload contracts in `docs/contracts/` for partner registration and identity verification. | Client draft dispatch successfully transitions from local draft to active backend document. |
| **DEP-A-04** | **Firebase App Check Enforcement:** Configure live App Check debug tokens for Android debug builds. | Prevents API abuse and secures Cloud Functions against unauthorized non-client traffic. | App Check registered in Firebase Console with SafetyNet / Play Integrity provider. | App Check token attached to outgoing callable requests. |

---

## 2. Developer B (AI & Model Integration Lead) Dependencies

| Dependency ID | Required Action / Deliverable | Impact on Developer D Client | Required Interface / Confirmation | Evidence That Will Prove Resolution |
|:---:|---|---|---|---|
| **DEP-B-01** | **Gemini Live Assistance (Task B5 Merge):** Finalize and merge `feature/B5-live-assistance` into `main`. | Street-ready Q&A currently operates on a simulated response adapter with explicit `[Sample AI: Simulated B5 response]` labeling. | Bidirectional WebSocket or WebRTC streaming endpoint for real-time voice translation. | Client streams live microphone audio and receives real-time translated voice back from Gemini Live. |
| **DEP-B-02** | **On-Device Model Binaries Provisioning:** Supply verified Gemini Nano / Gemma 4 E2B Unsloth GGUF model binaries or automated download pipelines. | Kotlin MethodChannel bridge honestly returns `MODEL_NOT_DOWNLOADED` with zero fabricated NPU claims. | Local GGUF file path or AICore model availability callback. | `NativePlatformService.summarizeOfflineNote` executes real local inference with network disabled. |
| **DEP-B-03** | **Live Gemini Embedding 2 Deployment:** Connect preference vectors to live 3,072-dimensional Gemini Embedding 2 service. | Taste and group matchmaking currently filters on local categorical tags and dietary unions. | Backend callable returning true semantic similarity cosine scores across spot and traveler profiles. | Live semantic ranking of off-the-beaten-path spots based on free-form preference text. |

---

## 3. Developer C (Maps, Places & Routes Lead) Dependencies

| Dependency ID | Required Action / Deliverable | Impact on Developer D Client | Required Interface / Confirmation | Evidence That Will Prove Resolution |
|:---:|---|---|---|---|
| **DEP-C-01** | **Google Maps Platform API Credentials:** Populate production Google Maps API key in `android/app/src/main/AndroidManifest.xml` and environment configs. | GoogleMap widget requires live API key with Maps SDK for Android enabled to render base vector map tiles. | Valid Google Maps Platform API key restricted to package `com.innovotribe.locallens`. | GoogleMap renders live satellite/vector tiles instead of blank grid on physical device. |
| **DEP-C-02** | **Live Routes API & Places (New) Compute:** Connect backend route generation to live Google Routes API directions compute. | Walking routes currently render from verified synthetic fixtures (`CanonicalRouteDocument`). | Deployed Cloud Functions executing live HTTP calls to `routes.googleapis.com`. | Dynamic routing between arbitrary user-selected coordinates outside Malleshwaram test zone. |
| **DEP-C-03** | **Live Weather & Closure Data Feeds:** Connect live Google Maps Platform Weather API or municipal closure feeds. | Route warnings and Plan-B triggers currently operate on simulated capacity and weather thresholds. | Structured weather and venue closure signals in route context payload. | Dynamic route banner updates in response to real-time precipitation or venue closure events. |

---

## 4. Third-Party Platform Architectural Constraints

| Constraint ID | Constraint Description | System Impact & Chosen Engineering Solution |
|:---:|---|---|
| **CON-01** | **Google Crowdsource Public API:** Google Crowdsource has no public developer API or SDK for arbitrary external data querying. | Grounding is achieved honestly via direct insider voice memos + real-time Google Search grounding. |
| **CON-02** | **Offline Vector Map Tile Pre-Caching:** Google Maps Platform Flutter SDK does not permit offline vector map tile pre-caching. | Classified as **Unavailable** in all user-facing UI and documentation. Spot cards, turn-by-turn prompts, and audio notes are fully preserved offline in Drift SQLite. |
| **CON-03** | **Banking Rails Sandbox Mode:** Live banking, card processing, and UPI payment gateways require formal commercial merchant onboarding. | All financial transactions operate strictly in **Sandbox Simulation Mode**. Zero real credit card numbers or CVVs are collected or stored. |
