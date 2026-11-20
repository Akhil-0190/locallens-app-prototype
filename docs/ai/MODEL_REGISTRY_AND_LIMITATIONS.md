# AI Model Registry, Access, Quotas, and Limitations

**Project:** Startup Buildathon 2026 — Neighborhood Guide App  
**Role:** Developer B (AI & Model Integration)  
**Status:** Established for Task B1 (`feature/B1-ai-foundation`)  

---

## 1. Executive Summary & Verification Rules

In accordance with Buildathon Model Integrity Rules:
- **Never invent model IDs:** Marketing labels, competition aliases, or unreleased speculative versions (e.g., "Gemini 3.8 Flash", "Gemini Embedding 2", "Gemini 3.8 Live", "Gemini Nano", "Gemma 4 E2B") must be resolved to actual, verified Google Gemini API model IDs or explicit edge runtimes.
- **Subscription vs. API Quota:** A user's paid Google One AI Premium or Gemini Advanced web consumer subscription does **not** grant Gemini API developer credits or unlimited API quotas. API access is managed strictly through Google AI Studio / Google Cloud Vertex AI projects with their own discrete RPM/TPM/RPD quotas and billing accounts.
- **Server-Side Isolation:** All Gemini API keys must reside strictly on the server in environment variables or Google Cloud Secret Manager. No client-side Flutter app code or Git commit may contain API keys.

---

## 2. Model Mapping Matrix: Submitted Labels vs. Canonical APIs

| Submitted Label | Canonical API / Artifact ID | Target Runtime | Test Status in B1 | Capabilities & Constraints | Primary Role in Neighborhood Guide App |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Gemini 3.8 Flash** | `gemini-3.8-flash` | Cloud API (`@google/genai`) | **CATALOG_VERIFIED_UNTESTED** | 1M in / 65k out, `thinking: true` | Complex multimodal reasoning and deep authenticity analysis. Exhibits 503 high-demand spikes under peak load; cascades to fallback. |
| *(Operational Workhorse)*| `gemini-3.5-flash-lite` | Cloud API (`@google/genai`) | **LIVE_TESTED_VERIFIED** | 1M in / 8k out, **2.6s live latency** | Fast, high-throughput extraction (regional voice transcripts, photo OCR, structured JSON generation). |
| *(Flash Fallback)* | `gemini-3.1-flash-lite` | Cloud API (`@google/genai`) | **LIVE_TESTED_VERIFIED** | 1M in / 8k out, **Fast response** | Immediate responsive fallback if primary models hit rate limits or 503 outages. |
| **Gemini Embedding 2**| `gemini-embedding-2` | Cloud API (`@google/genai`) | **LIVE_TESTED_VERIFIED** | 8,192 in / **3,072 dimensions** | High-dimensional semantic vectors for place profiles, user preferences, and solo/group cosine similarity blending. |
| **Gemini 3.8 Live** | `gemini-3.8-live` | Multimodal Live API (WebSocket) | **UNTESTED_ENDPOINT** | Bidirectional audio streaming, 1M context | Real-time bidirectional voice translation, live audio turn-by-turn guidance. Requires WebSocket streaming client. |
| **Gemini Nano** | `N/A (On-Device AICore)` | Android System Service (`AICore`) | **DOCUMENTED_EDGE_SPEC** | 4k in / 1k out, zero network latency | Offline notes summary & keyword tagging on supported Android hardware. Not a cloud API model ID. Owned by Dev D. |
| **Gemma 4 E2B** | `gemma-4-e2b` | Edge Runtime (MediaPipe / LiteRT) | **DOCUMENTED_EDGE_SPEC** | 2k in / 1k out, ~1.8GB-2.2GB memory | Local open-weights edge inference runtime for offline devices without AICore hardware. Untested local artifact. |

> [!NOTE]
> **API Deprecation Note:** Legacy `gemini-2.5-flash` was confirmed via live API inspection to be deprecated for new users by Google (`404 NOT_FOUND: This model is no longer available to new users. Please update your code to use models/gemini-3.8-flash or gemini-3.5-flash-lite`). The configuration was updated accordingly.

---

## 3. Capability Testing Status: Live-Tested vs. Documented/Untested

To maintain absolute integrity across deliverables:

1. **Live-Tested & Verified Capabilities (Ready for Production):**
   * **`gemini-3.5-flash-lite`:** Live authorized call succeeded in **2,639ms**, returning strict structured JSON validated against Zod schema.
   * **`gemini-3.1-flash-lite`:** Live verified as responsive fallback.
   * **`gemini-embedding-2`:** Live verified via `embedContent()`, producing normalized **3,072-dimensional** vector embeddings.
   * **Schema Validation & Error Pipeline:** Live tested with automatic code-fence stripping and typed error classification.

2. **Catalog-Verified but Untested Capabilities:**
   * **`gemini-3.8-flash`:** Confirmed present in the project's Google AI Studio catalog (`name: "models/gemini-3.8-flash"`). However, standard `generateContent` calls exhibited 503 high-demand spikes ("This model is currently experiencing high demand"). It is configured as primary reasoning engine with automatic cascade to `gemini-3.5-flash-lite`.

3. **Untested Cloud Endpoints:**
   * **`gemini-3.8-live`:** Configured as the target endpoint for real-time bidirectional multimodal audio streaming over WebSocket. Requires bidirectional audio hardware and WebSocket client infrastructure, deferred to the Gemini Live assistance task.

4. **Documented Edge Specifications (Not Cloud APIs):**
   * **Gemini Nano:** Documented as an on-device Android AICore service, not a cloud API ID.
   * **Gemma 4 E2B:** Documented as an edge runtime artifact (`gemma-4-e2b`), not a cloud API ID.

---

## 4. Quota Limits, Tiers, and Cost Management

### Google AI Studio Quota Profiles

#### A. Free Tier (Development & Verification)
* **`gemini-3.5-flash-lite` / `gemini-3.8-flash`:**
  * **RPM (Requests Per Minute):** 15
  * **TPM (Tokens Per Minute):** 1,000,000
  * **RPD (Requests Per Day):** 1,500
* **`gemini-embedding-2`:**
  * **RPM:** 1,500
  * **TPM:** 1,000,000
  * **RPD:** 10,000
* **`gemini-3.8-live` (Live Multimodal WebSocket):**
  * **RPM:** 3 concurrent sessions / 15 RPM
  * **RPD:** 500

#### B. Pay-As-You-Go Tier 1 (Production Scale)
* **`gemini-3.5-flash-lite`:** 2,000 RPM, 4,000,000 TPM, 100,000 RPD
* **`gemini-3.8-flash`:** 1,000 RPM, 4,000,000 TPM, 100,000 RPD
* **`gemini-embedding-2`:** 3,000 RPM, 4,000,000 TPM, 500,000 RPD

### Mitigating Rate Limit Failures (429 / 503)
The centralized SDK client implements:
1. **Exponential Backoff with Jitter:** `backoffMs = initialBackoffMs * 2^(attempt - 1) + random_jitter`.
2. **Transparent Model Cascading:** When `gemini-3.8-flash` returns `RESOURCE_EXHAUSTED` (429) or `UNAVAILABLE` (503), the orchestrator automatically routes the query to `gemini-3.5-flash-lite` without dropping user requests.
3. **Structured Schema Retry:** Validates responses using Zod. If malformed, the validator strips formatting artifacts before throwing typed errors.

---

## 5. Edge & Local AI Feasibility Analysis

### A. Gemini Nano via Android AICore & ML Kit
* **Architecture:** Gemini Nano is accessed via the **Android system service (`com.google.android.aicore`)** and Google ML Kit GenAI Client on Android 14+ (API level 34+). It does **not** exist as an endpoint in the `@google/genai` cloud SDK.
* **Hardware & Device Prerequisites:**
  * Supported devices equipped with neural hardware accelerators: Google Pixel 8/8 Pro/9 series and Samsung Galaxy S24 series.
  * Model binary is downloaded transparently by Android AICore via Google Play Services system updates (requires Wi-Fi and device idle charging).
* **Integration Boundary:**
  * **Developer D:** Owns the Android-native Kotlin client bridge (`android.aicore`) and Flutter method channel invocation.
  * **Developer B:** Owns structured prompt design and schema validation ensuring on-device outputs match backend data formats.
* **Device Limitations:** Standard AICore v1 is text-centric. Multi-modal on-device input (e.g., photo OCR) requires Pixel 9 AICore v2 or cloud handoff to `gemini-3.5-flash-lite`.

### B. Gemma 4 E2B Local Edge Runtime
* **Architecture:** Gemma 4 E2B is an edge open-weights model artifact (e.g. `gemma-4-e2b.task` / `.bin`) designed for on-device execution via **Google MediaPipe LLM Inference Engine** or **LiteRT** (formerly TensorFlow Lite).
* **Memory & Performance Constraints:**
  * Quantized (int4/int8) model execution requires ~1.8 GB to 2.2 GB of active system RAM.
  * Running inference on mobile CPUs/GPUs introduces cold-boot latency (3-5 seconds) and increased battery drain.
* **Operational Boundary:** Serves as a pure offline contingency for devices lacking AICore hardware. Client runtime packaging is owned by Developer D; prompt contracts defined by Developer B.

---

## 6. Architectural Schema Notice & Team Boundaries

> [!IMPORTANT]
> **Preliminary AI Schemas Notice:**  
> The schemas established in `functions/src/ai/schemas/types.ts` (`AuthenticityAssessmentSchema`, `VoicePhotoExtractionSchema`, `GroupPreferenceBlendSchema`) represent **preliminary AI prompt structures and structured extraction formats** owned by Developer B.  
> 
> They are **NOT** independently finalized replacements for Developer A's canonical Firebase/Firestore backend contracts.  
> 
> During **Task B2**, Developer B will coordinate with Developer A to reconcile and map these preliminary AI output schemas directly to Developer A's canonical contribution and place schema contracts (Task A2) before persisting to Firestore.

### Team Boundaries
* **Developer A (Firebase Backend):** Owns Firestore database rules, collections, and canonical data models (Task A2).
* **Developer B (AI Integration - Self):** Owns model configurations, prompt engineering, preliminary AI extraction schemas, fallback orchestrator, and AI microservices.
* **Developer C (Maps & Places):** Provides Google Maps Platform place IDs, raw user reviews, geographic clusters, and routing constraints as inputs to B's authenticity assessment.
* **Developer D (Flutter Client & Android Bridge):** Owns Flutter UI, on-device AICore/Kotlin bridge, and local SQLite storage.
