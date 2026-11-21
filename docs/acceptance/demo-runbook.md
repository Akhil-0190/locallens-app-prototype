# LocalLens Demo Runbook — Startup Buildathon 2026

**Project:** LocalLens (Neighborhood Guide App)  
**Developer:** Developer D  
**Target Audience:** Judges, Evaluators & Team  
**Scope:** Reproducible walkthrough of all integrated product flows with honest execution-mode disclosures.

---

## 1. Prerequisites and Setup

1. **Hardware / Runtime:**
   - Flutter SDK: 3.50.0 (Dart 3.14.0)
   - Target Platform: Android 11+ (API 30+)
   - Android Build: `build\app\outputs\flutter-apk\app-debug.apk` or `app-release.apk`
2. **Permissions:**
   - Microphone: Audio memo recording (Contributor flow)
   - Camera: Signage and storefront capture
   - Storage / SQLite: Drift local database caching
3. **Execution Modes Defined:**
   - `[Live Intent]`: Calls standard Android system intents or external URL launchers.
   - `[Local Client]`: Runs entirely on client device using local state/storage.
   - `[Simulation / In-Memory]`: Deterministic mock/test service executing contracts without active cloud credentials.
   - `[Sandbox Mode]`: Financial flows processed via simulated banking rails (no real money charged).
   - `[Local Draft]`: Information stored locally on client device; cloud dispatch marked pending.
4. **Community Provenance & Google Crowdsource Truth-in-Advertising Disclosure:**
   - Community dialect and venue sentiment are grounded via Gemini 3.8 Flash Google Maps review grounding and direct local voice contributions, as Google Crowdsource lacks a public API.
   - Spot-card verification displays and evidence records are truthfully labeled with `MAPS_GROUNDED` (Google Maps Platform place knowledge graph) and `COMMUNITY_VERIFIED` (direct local regional voice & memo contributions).

---

## 2. Step-by-Step Demonstration Sequence

### Step 1: Application Launch & Shell Navigation
- **Action:** Launch app from cold start.
- **Observed:**
  - Landing screen defaults to `/guide` (`Pocket Guide Screen`).
  - Bottom navigation displays 3 shell branches: `Match Vibe` (index 0), `Pocket Guide` (index 1, active default), and `Add Gem` (index 2).
- **Disclosure:** `[Local Client]` Navigation driven by `go_router` shell.

### Step 2: Contributor Regional Voice & Photo Ingestion
- **Action:** Tap `Add Gem` on bottom bar.
- **Observed:**
  - View contributor onboarding card explaining 2-minute regional recording.
  - Tap microphone button on `VoiceRecorderTile`. Record 10-15 seconds in Kannada or English: *"Hot benne dose and filter coffee at CTR."*
  - Tap stop. Waveform playback enables audio review.
  - Attach storefront/facade photo.
  - Tap `Preview & Submit`. Displays `ContributionPreviewSheet` showing synthesized structured spot card with authenticity score (0.96) and missing info report.
  - Tap `Confirm Submission`. Progresses to `ContributionStatusTracker` showing `SUBMITTED`.
- **Disclosure:** `[Simulation / In-Memory]` Audio captured locally; spot card synthesized and processed via deterministic simulation adapter. Live cloud callable execution is pending Developer A deployment.

### Step 3: Traveler Discovery & Preference Grounding
- **Action:** Switch to `Pocket Guide`. Tap preferences filter button.
- **Observed:**
  - Opens `TravelerOnboardingSheet`.
  - Select Dietary: `Vegetarian Only`, Budget: `Budget Friendly`, Pacing: `Relaxed`.
  - Save preferences. Preferences persist to SharedPreferences (`TravelerPreferencesDocument`).
  - Pocket Guide feed renders curated spot cards with authenticity badges: `EXPERT_CURATED`, `HYPERLOCAL`, and `COMMUNITY_VERIFIED`.
- **Disclosure:** `[Local Client]` SharedPreferences persistence and local filter logic. Live vector embedding similarity is pending backend cloud deployment. Community dialect and venue sentiment are grounded via Gemini 3.8 Flash Google Maps review grounding and direct local voice contributions, as Google Crowdsource lacks a public API. Spot cards display truthful provenance badges (`MAPS_GROUNDED` and `COMMUNITY_VERIFIED`).

### Step 4: Walking Route Tour & Street-Ready Assistance
- **Action:** Tap `Start Walking Tour`.
- **Observed:**
  - Opens `WalkingRouteScreen`.
  - Renders GoogleMap with decoded polyline and 3 ordered stops in Malleshwaram.
  - Metrics display distance (`1.1 km`) and pace-adjusted duration (`15 mins` for relaxed pace).
  - Tap speaker icon to play turn-by-turn walking cues via device Text-to-Speech (`flutter_tts`).
  - Tap `Street Assistant & Ordering` in AppBar.
  - Tab 1: Shows authentic Kannada ordering cards with native script, phonetic guide, and English translations.
  - Tab 2: Ask Guide Q&A dialogue. Submit *"What is the etiquette at CTR?"*. Renders response with `[Sample AI: Simulated B5 response]`.
  - Tap `Continue in Gemini (Deep Link Handoff)` button. Demonstrates construction of deep-link intent (`https://gemini.google.com/app?prompt=...`) preserving route and stop context.
- **Disclosure:** `[Local Client / Live Intent]` Local TTS and intent construction. Conversational Q&A is simulated pending Developer B's B5 Gemini Live merge.

### Step 5: Capacity Saturation & Plan-B Dynamic Rerouting
- **Action:** Observe `Venue Alert: High Crowd Capacity` banner on CTR stop.
- **Observed:**
  - Banner highlights remaining capacity saturation (`remainingCapacity <= 0`).
  - Tap `One-Tap Plan B Reroute`.
  - Route dynamically recalculates polyline and substitutes CTR with `Janatha Deluxe` / `Veena Stores` (`950 m`, `12 mins`), preserving unaffected destination `Kadu Malleshwara Temple`.
- **Disclosure:** `[Simulation / In-Memory]` Recalculation follows `skills/plan-b-rerouting/SKILL.md` rules and backend integration engine fixtures.

### Step 6: Offline Neighborhood Pack Persistence
- **Action:** Navigate to `/offline-packs`.
- **Observed:**
  - Lists `Malleshwaram Heritage Pack (v1)`.
  - Tap `Download Pack`.
  - Service verifies cryptographic SHA-256 hash and ingests spots transactionally into Drift SQLite.
  - Disconnect device WiFi/cellular.
  - Re-open pack: offline spot cards, cached routes, and audio cues remain accessible without internet.
- **Disclosure:** `[Local Client SQLite]` All spot cards and cached directions are offline. Honest disclosure displayed: raw vector map tiles require internet connectivity because vector tile pre-caching is currently unavailable.

### Step 7: Contributor Ecosystem & Monetization Sandbox
- **Action:**
  - Navigate to `/contributor-profile`.
  - View contributor tier (`Heritage Sage`), approved gems count (5), and balance ledger (₹850 available).
  - Tap `Tip Contributor`. Select ₹50 tip.
  - Banner displays: `[Sandbox Mode: Simulated Payment - No Real Money Charged]`.
  - Complete simulated settlement. Ledger balance updates.
  - Navigate to `/route-passes`. View pass catalog with explicit `Pricing: Pending Commercial Confirmation`.
  - Initiate pass checkout and complete simulated activation via `Monetization-confirmPassPayment`. Pass status turns `ACTIVE`.
  - Navigate to `/partner-subscriptions`. View hospitality partner onboarding form. Submit inquiry and observe it saves as a local draft with clear notice that backend dispatch is pending.
- **Disclosure:** `[Sandbox Mode & Local Drafts]` Payments operate strictly in sandbox mode; partner registrations and ID verification operate strictly as local drafts.

---

## 3. Demo Fallback & Recovery Procedures

| Scenario | Symptom | Recovery Procedure |
|---|---|---|
| Platform TTS Unavailable | No audio playback on speaker icon | Tap ordering cards directly to inspect phonetic and textual translations. |
| Network Disconnected during Map View | GoogleMap shows blank grid | Reconnect network for map tile rendering, or open `/offline-packs` to demonstrate cached spot cards and text directions. |
| External Gemini App Not Installed | Deep-link button tapped | The handoff gracefully falls back to launching the web browser at `https://gemini.google.com/app`. |
| Corrupted Offline Download | Checksum mismatch error | Re-download pack; service detects hash mismatch, rejects corrupted bytes, and keeps existing SQLite records intact. |
