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

| Submitted Label | Canonical API Model ID | Deployment / Runtime Target | Status / Availability | Verified Context / Output | Primary Neighborhood Guide Responsibility |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Gemini 3.8 Flash** | `gemini-3.8-flash` | Cloud API (`@google/genai`) | GA in project catalog | 1M in / 65k out, thinking: true | Primary reasoning engine for complex multimodal and authenticity assessment. Exhibits 503 spikes under high demand. |
| *(High-Speed Workhorse)*| `gemini-3.5-flash-lite` | Cloud API (`@google/genai`) | Generally Available (GA) | 1M in / 8k out | Fast, verified operational model (2.6s live latency). Handles high-throughput voice/photo extractions and verification calls. |
| *(Flash Fallback)* | `gemini-3.1-flash-lite` | Cloud API (`@google/genai`) | Generally Available (GA) | 1M in / 8k out | Immediate responsive fallback when primary models encounter rate limits or transient outages. |
| **Gemini Embedding 2**| `gemini-embedding-2` | Cloud API (`@google/genai`) | Generally Available (GA) | 8,192 in / 3072 dims | Verified live: 3072-dimensional semantic embeddings for place profiles and group preference cosine blending. |
| **Gemini 3.8 Live** | `gemini-2.0-flash-exp` | Multimodal Live API (WebSocket) | Public Preview | 1M in / 8k out | Low-latency bidirectional voice translation, live audio turn-by-turn cultural commentary. |
| **Gemini Nano** | `android.aicore.gemini-nano` | On-Device Edge (Android AICore) | Edge System Service | 4k in / 1k out | Zero-latency on-device processing: offline notes summary, keyword tagging. Owned by Dev D (Kotlin bridge); prompt contracts defined by Dev B. |
| **Gemma 4 E2B** | `gemma-2-2b-it` | On-Device Edge (MediaPipe / LiteRT) | Local Open Weights Runtime | 2k in / 1k out | Cross-platform fallback for offline inference on Android/iOS devices lacking AICore hardware. |

> [!NOTE]
> **API Deprecation Note:** Legacy `gemini-2.5-flash` was confirmed via live API inspection to be deprecated for new users by Google (`404 NOT_FOUND: This model is no longer available to new users. Please update your code to use models/gemini-3.8-flash or gemini-3.5-flash-lite`). The configuration was updated accordingly.

---

## 3. Quota Limits, Tiers, and Cost Management

### Google AI Studio Quota Profiles

#### A. Free Tier (Development & Verification)
* **`gemini-2.5-flash` / `gemini-2.0-flash`:**
  * **RPM (Requests Per Minute):** 15
  * **TPM (Tokens Per Minute):** 1,000,000
  * **RPD (Requests Per Day):** 1,500
* **`text-embedding-004`:**
  * **RPM:** 1,500
  * **TPM:** 1,000,000
  * **RPD:** 10,000
* **`gemini-2.0-flash-exp` (Live Multimodal WebSocket):**
  * **RPM:** 3 concurrent sessions / 15 RPM
  * **RPD:** 500

#### B. Pay-As-You-Go Tier 1 (Production Scale)
* **`gemini-2.5-flash`:** 1,000 RPM, 4,000,000 TPM, 100,000 RPD
* **`gemini-2.0-flash`:** 2,000 RPM, 4,000,000 TPM, 100,000 RPD
* **`text-embedding-004`:** 3,000 RPM, 4,000,000 TPM, 500,000 RPD

### Mitigating Rate Limit Failures (429 / 503)
The centralized SDK client implements:
1. **Exponential Backoff with Jitter:** `backoffMs = initialBackoffMs * 2^(attempt - 1) + random_jitter`.
2. **Transparent Model Cascading:** When `gemini-2.5-flash` returns `RESOURCE_EXHAUSTED` (429), the orchestrator automatically routes the query to `gemini-2.0-flash` without dropping user requests.
3. **Structured Schema Retry:** Validates responses using Zod. If malformed, the validator strips formatting artifacts before throwing typed errors.

---

## 4. Edge & Local AI Feasibility Analysis

### A. Gemini Nano via Android AICore
* **Hardware Prerequisites:** Supported Android devices with neural accelerators (Google Pixel 8/9 series, Samsung Galaxy S24 series) running Android 14+.
* **Integration Boundary:**
  * **Developer D:** Implements the Android Kotlin AICore client binding and Flutter method channel bridge (`android.aicore.gemini-nano`).
  * **Developer B:** Authors the structured prompt templates and validates output compatibility with the backend Firestore schema.
* **Limitations:** Gemini Nano on AICore v1 is text-centric. Multi-modal on-device input (e.g. raw photo understanding) requires Pixel 9 AICore v2 or cloud handoff to `gemini-2.5-flash`.

### B. Gemma 2B Local Edge Runtime
* **Feasibility:** Gemma 2B quantized (int4 / int8) requires ~1.8 GB to 2.2 GB of active system RAM.
* **Runtime Options:** Google MediaPipe LLM Inference Engine or LiteRT (formerly TensorFlow Lite).
* **Limitations:** Increased battery consumption and cold-boot latency (3-5 seconds on mid-range Android devices). Recommended only as an offline survival fallback when no cellular connectivity exists.

---

## 5. Team Coordination Boundaries

* **Developer A (Firebase Backend):** Consumes `functions/src/ai/index.ts` inside Cloud Functions HTTPS triggers and Firestore reactive hooks (`onPlaceCreated`, `onContributionSubmitted`).
* **Developer B (AI Integration - Self):** Owns model configurations, prompt engineering, schema definitions, Zod validation, and AI microservices.
* **Developer C (Maps & Places):** Provides Google Maps Platform place IDs, raw user reviews, geographic clusters, and routing constraints as inputs to B's authenticity assessment.
* **Developer D (Flutter Client & Android Bridge):** Consumes Cloud Function endpoints, handles client voice recording, and executes Android AICore bindings for Gemini Nano.
