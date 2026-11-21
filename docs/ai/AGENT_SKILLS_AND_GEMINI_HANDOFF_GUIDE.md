# Agent Skills & Continue in Gemini Handoff Implementation Guide

**Project:** LocalLens (Neighborhood Guide App)  
**Track:** AI & Multimodal Lead (Developer B)  
**Deliverable:** Task B7 — Final Implementation  
**Status:** Complete & Verified  

---

## 1. Executive Summary & Architecture

Task B7 delivers the final core AI capabilities for LocalLens:
1. Four standardized **Agent Skills** conforming to the Google Antigravity / Google AI Studio Agent Skills format (`skills/<skill-name>/SKILL.md`), paired with deterministic TypeScript execution engines.
2. A cryptographically secured **Continue in Gemini Handoff** engine facilitating seamless session handoff from LocalLens into the Gemini web experience (`https://gemini.google.com/app`).
3. A centralized Firebase onCall Cloud Function controller (`Skills-*`) exposing these capabilities to mobile, web, and backend clients.
4. An automated deterministic test suite (`test:b7`) verifying all behavioral invariants, security protections, and data contracts.

```
                           ┌───────────────────────────────┐
                           │   Agent Skills Definitions    │
                           │     skills/*/SKILL.md         │
                           └──────────────┬────────────────┘
                                          │
                                          ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           TypeScript Execution Engines                          │
│                      functions/src/ai/skills/                                   │
│  ┌───────────────────────┐ ┌───────────────────────┐ ┌───────────────────────┐  │
│  │ Voice-Note Extraction │ │   Trap Filtering      │ │   Group Blending      │  │
│  │ (Regional Audio/Text) │ │  (Maps Grounding)     │ │ (Dietary Safety Union)│  │
│  └───────────────────────┘ └───────────────────────┘ └───────────────────────┘  │
│  ┌───────────────────────┐ ┌─────────────────────────────────────────────────┐  │
│  │   Plan-B Rerouting    │ │           Continue in Gemini Handoff            │  │
│  │ (Dynamic Route Recalc)│ │  (Two-Phase Challenge, Anti-Replay, Scrubbing)  │  │
│  └───────────────────────┘ └─────────────────────────────────────────────────┘  │
└─────────────────────────────────────────┬───────────────────────────────────────┘
                                          │
                                          ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                       Skills Callable Controller                                │
│                   functions/src/ai/controllers/skills-controller.ts             │
│   • executeVoiceNoteExtraction     • executeTrapFiltering                       │
│   • executeGroupBlending           • executePlanBRerouting                      │
│   • executeGeminiHandoffCallable                                                │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Skill 1: Voice-Note Extraction (`voice-note-extraction`)

### Purpose
Processes regional-language voice notes (Tamil, Hindi, Telugu, Kannada, Bengali, and Indian English), transcribing spoken local recommendations and extracting structured place entities, regional dishes, and sensory observations.

### Schema & Classification Invariant
Extracted facts must be strictly classified into three explicit categories:
1. **FACT:** Explicitly stated in the contributor audio/transcript.
2. **INFERENCE:** Reasonably deduced from context (e.g., "crowded at sunset" -> evening peak hours).
3. **UNAVAILABLE:** Omitted from the voice note (e.g., exact price tier, opening hours). The engine strictly returns `undefined` for omitted fields rather than hallucinating defaults.

### Execution Workflow
1. Ingest audio recording (or raw transcript) with optional regional language hint.
2. Transcribe via Gemini 2.5 Flash Multimodal audio processing.
3. Extract structured entities (`placeName`, `category`, `specialties`, `crowdLevel`, `bestTimeToVisit`).
4. Apply the `classifyExtractionFacts` engine to categorize all extracted attributes into facts, inferences, and unavailable fields.
5. Compute an extraction confidence score based on explicit evidence density.

### Files
- **Specification:** `skills/voice-note-extraction/SKILL.md`
- **Engine:** `functions/src/ai/skills/skill-voice-extraction.ts`
- **Callable:** `Skills-executeVoiceNoteExtraction`

---

## 3. Skill 2: Maps-Grounded Tourist-Trap Filtering (`maps-grounded-trap-filtering`)

### Purpose
Distinguishes genuine local cultural institutions and culinary landmarks from commercialized tourist traps through rigorous spatial grounding against Google Maps Platform (Places API & Grounding Evidence).

### Behavioral Safeguards & Scoring Invariants
1. **Authenticity Score Calculation:**
   $$\text{Authenticity Score} = \text{baseScore} + \text{localSignals} - \text{trapFlags}$$
2. **Spatial Coordinate Delta Invariant:**
   If the spatial discrepancy between the contributor's reported coordinates and verified Google Places coordinates exceeds **500 meters**, the engine triggers `CONTRADICTORY_COORDINATES` and automatically categorizes the venue as `FLAGGED_TOURIST_TRAP`.
3. **Trap Indicators:**
   Aggressive sidewalk hawkers, inflated tourist pricing, non-local mainstream menus, review clustering with unverified accounts, and sponsored souvenir bundling.
4. **Authenticity Markers:**
   Generational family ownership, hyper-regional micro-specialties, high ratio of local language reviews, and steady off-season footfall.

### Files
- **Specification:** `skills/maps-grounded-trap-filtering/SKILL.md`
- **Engine:** `functions/src/ai/skills/skill-trap-filtering.ts`
- **Callable:** `Skills-executeTrapFiltering`

---

## 4. Skill 3: Group-Blending (`group-blending`)

### Purpose
Harmonizes multi-party travel preferences across diverse budgets, walking paces, and culinary interests while enforcing strict safety invariants.

### Dietary Safety Invariant (Non-Negotiable)
- **Medical and religious dietary restrictions are NEVER voted on or averaged out.**
- The group dietary requirement is strictly the **mathematical union** ($\bigcup$) of all member restrictions:
  $$\text{GroupDietary} = \bigcup_{m \in \text{Members}} \text{Restrictions}_m$$
- For example, if a group consists of Member 1 (`VEGAN`), Member 2 (`GLUTEN_FREE`), and Member 3 (`NUT_ALLERGY`), all dining stops recommended to the group must strictly satisfy **all three** restrictions simultaneously.

### Budget & Pace Compromise Invariants
- **Budget Floor Invariant:** The group budget tier is bounded to prevent budget-conscious members from being priced out (`BUDGET` takes precedence or caps the consensus at `MODERATE`).
- **Pace Harmonization:** Paces ranging from `LEISURELY` to `BRISK` compromise on `MODERATE`, automatically adding pacing buffer time between walking legs.
- **Group Cohesion Score:** Evaluated out of 100 based on restriction overlap, budget variance, and shared interests.

### Files
- **Specification:** `skills/group-blending/SKILL.md`
- **Engine:** `functions/src/ai/skills/skill-group-blending.ts`
- **Callable:** `Skills-executeGroupBlending`

---

## 5. Skill 4: Plan-B Rerouting (`plan-b-rerouting`)

### Purpose
Dynamically recalculates walking routes when unexpected disruptions occur: severe weather (monsoon, heat), unscheduled temple/venue closures, or hourly crowd saturation (`isThrottled = true`, `remainingCapacity <= 0`).

### Execution Workflow & Invariants
1. **Stop Preservation Invariant:** All stops unaffected by disruptions remain in their exact sequence with unchanged venue IDs and coordinates.
2. **Grounded Alternatives:** Disrupted stops are replaced exclusively by verified places in close walking proximity with verified open status and available capacity.
3. **Route & Polyline Recalculation:** The route polyline and leg metrics are dynamically recalculated via Google Routes API / C3 walking engine.
4. **Arrival Time Consistency:** Subsequent stop arrival times are recomputed using actual walking leg durations plus stop dwell times, ensuring zero schedule drift.
5. **Conversational Guidance:** Returns a structured `PlanBExplanationContext` consumable by Gemini Live or voice assistants to explain route modifications naturally to the traveler.

### Files
- **Specification:** `skills/plan-b-rerouting/SKILL.md`
- **Engine:** `functions/src/ai/skills/skill-plan-b-rerouting.ts`
- **Callable:** `Skills-executePlanBRerouting`

---

## 6. Continue in Gemini Handoff Protocol

### Purpose & Security Architecture
Allows travelers to transition their active trip planning, route context, and custom preferences from LocalLens into the Google Gemini web interface (`https://gemini.google.com/app`) securely without leaking user credentials or enabling URL replay attacks.

```
LocalLens Client                     Handoff Engine                  Gemini Web / User
      │                                    │                                 │
      ├── 1. Request PREVIEW ─────────────►│                                 │
      │   (trip context + session ID)      │                                 │
      │                                    ├── Generate HMAC Challenge       │
      │◄── 2. Return preview + challenge ──┤   Token (expires in 5 min)      │
      │                                    │                                 │
      ├── 3. Confirm CONFIRM ─────────────►│                                 │
      │   (challengeToken + session ID)    │                                 │
      │                                    ├── Verify HMAC Signature         │
      │                                    ├── Check Nonce (Atomic Consume)  │
      │                                    ├── Scrub Sensitive Credentials   │
      │                                    ├── Format Structured Prompt      │
      │◄── 4. Return deep-link + prompt ───┤                                 │
      │                                    │                                 │
      ├── 5. Open Deep-Link / Copy Prompt ──────────────────────────────────►│
```

### Security & Privacy Controls
1. **Two-Phase Cryptographic Handshake:**
   - Phase 1 (`PREVIEW`): Validates session and issues an HMAC-SHA256 challenge token with a 5-minute expiry.
   - Phase 2 (`CONFIRM`): Requires the valid challenge token to mint the deep-link URL.
2. **Anti-Replay Protection:**
   - Challenge tokens contain a cryptographic nonce.
   - Nonces are marked as consumed in an in-memory/cache store upon confirmation; replaying a previously consumed token fails with `CHALLENGE_ALREADY_CONSUMED`.
3. **Strict Credential Stripping:**
   - All session tokens, auth cookies, `authToken`, `userUid`, `rawPaymentTokens`, and private contact details are scrubbed prior to deep-link prompt generation.
4. **URL Length & Encoding Management:**
   - Gemini web URLs encode the handoff prompt via `encodeURIComponent`.
   - If the generated URL exceeds browser limits (2,000 characters), the engine provides a condensed URL and outputs the complete structured context via `manualCopyPasteFallback`.

### Files
- **Engine:** `functions/src/ai/skills/gemini-handoff.ts`
- **Callable:** `Skills-executeGeminiHandoffCallable`

---

## 7. Implementation Status & Categorization Matrix

| Component | Status | Real Implementation vs Mocks | Limitations / Dependencies |
| :--- | :--- | :--- | :--- |
| **Skill 1: Voice Extraction** | **Implemented & Tested** | Implemented with live Zod parsing and fallback transcript analysis; full live audio transcription requires active Google Cloud Speech / Gemini multimodal API key. | Multimodal audio bytes requires external storage bucket in production. |
| **Skill 2: Trap Filtering** | **Implemented & Tested** | Fully deterministic authenticity scoring engine with genuine coordinate distance calculation (`haversineDistanceMeters`). Maps grounding records verified. | Live Google Places search relies on Google Maps Platform API key or pre-cached candidate places. |
| **Skill 3: Group Blending** | **Implemented & Tested** | Pure deterministic mathematical union, budget floor capping, and pace compromise algorithms. Zero mocks needed. | Fully self-contained. |
| **Skill 4: Plan-B Rerouting** | **Implemented & Tested** | Full integration with `PlanBRerouteService`, Canonical Route Documents, and polyline generators. | Real-time live traffic polylines require Google Routes API quota. |
| **Gemini Handoff Engine** | **Implemented & Tested** | Real HMAC-SHA256 crypto, anti-replay nonce store, credential sanitization, and URL encoding. | URL query parameter length is limited by browser address bar limits (~2000 chars); copy-paste fallback provided. |
| **Skills Controller** | **Implemented & Tested** | Exported Firebase onCall Cloud Functions (`Skills-*`) in `functions/src/index.ts`. | Requires deployed Firebase environment for external HTTP trigger. |

---

## 8. Verification & Test Evidence

The deterministic test suite `functions/test/test-b7-agent-skills.ts` validates all four skills and the handoff protocol across 6 suites and 25 individual assertions:

1. **Suite 1: Voice-Note Extraction (`voice-note-extraction`)**
   - Transcribes regional Tamil/English voice notes into structured entities.
   - Accurately classifies explicitly mentioned facts as `FACT`.
   - Correctly marks omitted fields (e.g. `openingHours`) as `UNAVAILABLE` and `undefined`.
2. **Suite 2: Maps-Grounded Trap Filtering (`maps-grounded-trap-filtering`)**
   - Authenticity scoring recognizes generational family business as `AUTHENTIC_LOCAL_SPOT`.
   - Flags commercialized tourist trap with aggressive touts as `FLAGGED_TOURIST_TRAP`.
   - Enforces the coordinate delta invariant: spatial discrepancy > 500m triggers `CONTRADICTORY_COORDINATES` penalty.
3. **Suite 3: Group-Blending (`group-blending`)**
   - Strictly enforces mathematical union of dietary restrictions (`VEGAN`, `GLUTEN_FREE`, `NUT_ALLERGY`).
   - Caps conflicting budgets at `MODERATE` to safeguard budget-conscious members.
   - Harmonizes divergent walking paces with buffer warnings.
4. **Suite 4: Plan-B Rerouting (`plan-b-rerouting`)**
   - Successfully replaces disrupted stops during severe rain while retaining safe indoor stops.
   - Dynamically recomputes polyline, route distance, and stop arrival times.
   - Formulates clear conversational guidance for Gemini Live voice co-pilot.
5. **Suite 5: Continue in Gemini Handoff Protocol**
   - Phase 1 (`PREVIEW`) generates a cryptographic HMAC challenge token.
   - Phase 2 (`CONFIRM`) validates token and mints `https://gemini.google.com/app?prompt=...` deep-link.
   - Anti-replay protection prevents token reuse (`CHALLENGE_ALREADY_CONSUMED`).
   - Rejects tampered challenge tokens.
   - Completely scrubs `authToken`, `userUid`, and `rawPaymentTokens` from prompt payload.
6. **Suite 6: End-to-End Skills Module Export Integrity**
   - Confirms all 4 skills and handoff engines are cleanly exported from `functions/src/ai/skills/index.ts`.

---

## 9. Conclusion & Developer D / A Integration Touchpoints

1. **Mobile Application (Developer D):**
   - Mobile clients can invoke `Skills-executeVoiceNoteExtraction`, `Skills-executeTrapFiltering`, `Skills-executeGroupBlending`, `Skills-executePlanBRerouting`, and `Skills-executeGeminiHandoffCallable` directly via standard Firebase Functions SDK (`FirebaseFunctions.instance.httpsCallable(...)`).
   - For offline on-device inference, the Gemini Nano / Gemma 4 E2B runtime established in B6 handles low-latency tasks, while B7 skills provide the full cloud intelligence layer.
2. **Core Backend (Developer A):**
   - All cloud function entry points are registered in `functions/src/index.ts` under the `Skills` namespace.
   - Ready for pull request review and merge into `main`.
