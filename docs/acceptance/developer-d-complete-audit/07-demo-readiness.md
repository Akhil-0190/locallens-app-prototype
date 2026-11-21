# Part 7 — Demo-Readiness Assessment and Runbook

**Project:** Startup Buildathon India 2026 — Neighborhood Guide App (LocalLens)  
**Developer:** Developer D  
**Target Audience:** Evaluators, Hackathon Judges & Engineering Team  
**Scope:** Reproducible walkthrough script for live presentation with mandatory presenter disclosures and error recovery procedures.

---

## 1. Environment Prerequisites and Configuration

| Parameter | Recommended Configuration | Fallback / Alternative |
|---|---|---|
| **Flutter SDK** | `Flutter 3.50.0 • Dart 3.14.0` | Any Flutter 3.24+ runtime |
| **Target OS** | Android 11+ (API 30+) | Host test harness or desktop runner |
| **Build Binary** | `build\app\outputs\flutter-apk\app-debug.apk` (or `app-release.apk`) | Direct `flutter run` via IDE |
| **Permissions** | Microphone (Audio memos), Camera (Storefront photos), Storage (SQLite) | Granted via Android system prompt |
| **Active Network** | WiFi or Cellular for initial bundle discovery & map rendering | Fully offline mode supported via Drift SQLite cache |

---

## 2. Standardized Execution Modes (Presenter Transparency)

To maintain complete credibility with judges, every demo step must explicitly state its execution mode:
* `[Local Client]`: Executes entirely on the local device using client Dart code and local state.
* `[Simulation / In-Memory]`: Deterministic mock/adapter executing shared contracts without live cloud credentials.
* `[Sandbox Mode]`: Financial transactions processed via simulated banking rails (no real money charged).
* `[Local Draft]`: Information stored locally on client device; cloud dispatch marked pending.
* `[Live Intent]`: Calls standard Android system intents or external URL launchers.

---

## 3. Seven-Step Demonstration Script

### Step 1: Application Launch & Shell Navigation
* **Action:** Cold launch the application.
* **Observed Behavior:**
  * Opens on `/guide` (`Pocket Guide Screen`).
  * Bottom navigation displays 3 indexed branches: `Match Vibe` (index 0), `Pocket Guide` (index 1, active default), and `Add Gem` (index 2).
* **Presenter Disclosure:** `[Local Client]` Navigation driven by `go_router` shell.

### Step 2: Contributor Regional Voice & Photo Ingestion
* **Action:** Tap `Add Gem` on bottom bar.
  * View onboarding card explaining the 2-minute regional voice curation approach.
  * Tap microphone icon on `VoiceRecorderTile`. Record 10 seconds: *"Crisp benne masala dose and filter coffee at CTR."*
  * Tap stop. Waveform playback enables audio review.
  * Attach a street facade photo.
  * Tap `Preview & Submit`. Modal sheet displays synthesized structured spot card with authenticity score (0.96) and missing info report.
  * Tap `Confirm Submission`. Progresses to `ContributionStatusTracker` showing `SUBMITTED`.
* **Presenter Disclosure:** `[Simulation / In-Memory]` Audio captured locally; spot card synthesized and processed via deterministic simulation adapter. Live cloud callable execution is pending Developer A deployment.

### Step 3: Traveler Discovery & Preference Grounding
* **Action:** Switch to `Pocket Guide`. Tap preferences filter button.
  * Opens `TravelerOnboardingSheet`.
  * Select Dietary: `Vegetarian Only`, Budget: `Budget Friendly`, Pacing: `Relaxed`.
  * Save preferences. Data persists to local SharedPreferences.
  * Pocket Guide feed renders curated spot cards with authenticity badges: `EXPERT_CURATED`, `HYPERLOCAL`, and `COMMUNITY_VERIFIED`.
* **Presenter Disclosure:** `[Local Client]` SharedPreferences persistence and local filter logic. Live vector embedding similarity is pending backend cloud deployment.

### Step 4: Walking Route Tour & Street-Ready Assistance
* **Action:** Tap `Start Walking Tour`.
  * Opens `WalkingRouteScreen`.
  * Renders GoogleMap with decoded polyline and 3 ordered stops in Malleshwaram.
  * Metrics display distance (`1.1 km`) and pace-adjusted duration (`15 mins` for relaxed pace).
  * Tap speaker icon to play turn-by-turn walking cues via device Text-to-Speech (`flutter_tts`).
  * Tap `Street Assistant & Ordering` in AppBar.
  * Tab 1: Shows authentic Kannada ordering cards with native script, phonetic guide, and English translations.
  * Tab 2: Ask Guide Q&A dialogue. Submit query: *"What is the etiquette at CTR?"*. Renders response with `[Sample AI: Simulated B5 response]`.
  * Tap `Continue in Gemini (Deep Link Handoff)` button. Demonstrates construction of deep-link intent (`https://gemini.google.com/app?prompt=...`) preserving route and stop context.
* **Presenter Disclosure:** `[Local Client / Live Intent]` Local TTS and intent construction. Conversational Q&A is simulated pending Developer B's B5 Gemini Live merge.

### Step 5: Capacity Saturation & Plan-B Dynamic Rerouting
* **Action:** Observe `Venue Alert: High Crowd Capacity` banner on CTR stop.
  * Banner highlights remaining capacity saturation (`remainingCapacity <= 0`).
  * Tap `One-Tap Plan B Reroute`.
  * Route dynamically recalculates polyline and substitutes CTR with `Janatha Deluxe` / `Veena Stores` (`950 m`, `12 mins`), preserving unaffected destination `Kadu Malleshwara Temple`.
* **Presenter Disclosure:** `[Simulation / In-Memory]` Recalculation follows `skills/plan-b-rerouting/SKILL.md` rules and backend integration engine fixtures.

### Step 6: Offline Neighborhood Pack Persistence
* **Action:** Navigate to `/offline-packs`.
  * Lists `Malleshwaram Heritage Pack (v1)`.
  * Tap `Download Pack`.
  * Service verifies cryptographic SHA-256 hash and ingests spots transactionally into Drift SQLite.
  * Disconnect device WiFi/cellular.
  * Re-open pack: offline spot cards, cached routes, and audio cues remain accessible without internet.
* **Presenter Disclosure:** `[Local Client SQLite]` All spot cards and cached directions are offline. Honest disclosure displayed: raw vector map tiles require internet connectivity because vector tile pre-caching is currently unavailable.

### Step 7: Contributor Ecosystem & Monetization Sandbox
* **Action:**
  * Navigate to `/contributor-profile`.
  * View contributor tier (`Heritage Sage`), approved gems count (5), and balance ledger (₹850 available).
  * Tap `Tip Contributor`. Select ₹50 tip.
  * Banner displays: `[Sandbox Mode: Simulated Payment - No Real Money Charged]`.
  * Complete simulated settlement. Ledger balance updates.
  * Navigate to `/route-passes`. View pass catalog with explicit `Pricing: Pending Commercial Confirmation`.
  * Initiate pass checkout and complete simulated activation via `Monetization-confirmPassPayment`. Pass status turns `ACTIVE`.
  * Navigate to `/partner-subscriptions`. View hospitality partner onboarding form. Submit inquiry and observe it saves as a local draft with clear notice that backend dispatch is pending.
* **Presenter Disclosure:** `[Sandbox Mode & Local Drafts]` Payments operate strictly in sandbox mode; partner registrations and ID verification operate strictly as local drafts.

---

## 4. Fallback and Recovery Procedures

| Scenario During Demo | Observable Symptom | Exact Recovery Procedure |
|---|---|---|
| **Platform TTS Engine Unavailable** | No audio playback on speaker icon | Tap ordering cards directly to inspect phonetic and textual translations. |
| **Network Disconnected during Map View** | GoogleMap shows blank grid | Reconnect network for map tile rendering, or open `/offline-packs` to demonstrate cached spot cards and text directions. |
| **Gemini App Not Installed on Device** | Deep-link button tapped | The handoff gracefully falls back to launching the web browser at `https://gemini.google.com/app`. |
| **Corrupted Download Payload** | Checksum mismatch error | Re-download pack; service detects hash mismatch, rejects corrupted bytes, and keeps existing SQLite records intact. |
