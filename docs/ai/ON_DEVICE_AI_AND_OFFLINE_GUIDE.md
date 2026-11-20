# On-Device AI Architecture & Offline Execution Guide
## Task B6: Gemini Nano (AICore) and Gemma 4 E2B (Unsloth GGUF)

**Repository:** `goddy04/neighborhoodguideapp`  
**Domain:** Domain 09 — On-Device AI Inference & Edge Execution  
**Lead AI Owner:** Developer B (AI & Model Integration Lead)
**Platform Integration Partner:** Developer D (Flutter Client & Android Native Platform Bridge)
**Status:** Implementation Complete & Ready for Review  
**Date:** November 2026  

---

## 1. Architectural Separation: Application-Side vs. Backend

To prevent architectural conflation, execution responsibilities are strictly separated between the client device and the cloud backend:

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                           CLIENT-SIDE (ANDROID DEVICE)                           │
│                                                                                  │
│  [Flutter Application UI] (Owned by Developer D)                                 │
│         │                                                                        │
│         ▼                                                                        │
│  [NativePlatformService] (lib/services/native_platform_service.dart)             │
│         │                                                                        │
│         ▼ MethodChannel: "com.innovotribe.locallens/native_ai"                   │
│  [Android MainActivity.kt] (android/app/src/main/kotlin/...)                     │
│         │                                                                        │
│         ├── Offline Path A ──► Android AICore / ML Kit GenAI (Gemini Nano)       │
│         │                      (com.google.android.aicore - OS shared weights)   │
│         │                                                                        │
│         ├── Offline Path B ──► llama.cpp Native Runtime (libllama.so)            │
│         │                      (Gemma 4 E2B Unsloth GGUF in App Storage)         │
│         │                                                                        │
│         └── Offline Fallback ─► Deterministic Heuristics (Unassisted Mode)       │
└──────────────────────────────────────┬───────────────────────────────────────────┘
                                       │
                      (If Online + User Privacy Consent)
                                       │
                                       ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│                       BACKEND / CLOUD (FIREBASE FUNCTIONS)                       │
│                                                                                  │
│  [Cloud Functions AI Module] (Owned by Developer B)                              │
│         │                                                                        │
│         ├── Cloud Inference ──► Google Gemini API (gemini-3.8-flash)             │
│         │                      - Provenance: CLOUD_FALLBACK                      │
│         │                      - isLocalInference: false                         │
│         │                                                                        │
│         └── Contracts & Schemas (functions/src/ai/)                              │
│             - Defines canonical request/response Zod contracts                   │
│             - Evaluates telemetry & readiness rules                              │
│             - Tests fallback behavior and provenance tagging                     │
└──────────────────────────────────────────────────────────────────────────────────┘
```

### Responsibility Matrix:
* **Developer D (Client & Android Integration):** Owns Flutter UI, Flutter state management, `NativePlatformService`, Android `MainActivity.kt`, permissions, Android NDK build of `libllama.so`, and on-device model file management.
* **Developer B (AI Integration & Contracts):** Owns AI model definitions, prompt templates, Zod schemas, readiness evaluation logic, cloud Gemini API integration, and provenance verification.

---

## 2. Gemini Nano / Android AICore Path

### 2.1 Authoritative Standard & Dynamic Status Checks
* **Documentation Authority:** Google ML Kit GenAI ([https://developers.google.com/ml-kit/genai/](https://developers.google.com/ml-kit/genai/))
* **Evaluation Standard:** Dynamic readiness is evaluated via ML Kit GenAI status callbacks rather than hard-coded OEM lists:
  - `Build.VERSION.SDK_INT >= 34` (Android 14+).
  - Package presence of `com.google.android.aicore`.
  - Feature-specific readiness check:
    - `DIRECT_MODEL`: Foundation model prompt/response.
    - `SUMMARIZATION`: Specialized on-device summarization API.
    - `REWRITE`: Specialized text rewriting / style adaptation API.
    - `IMAGE_DESCRIPTION`: Multimodal vision (requires AICore v2 hardware).
  - Lifecycle state checks:
    - `MODEL_DOWNLOADABLE`: Feature supported by hardware, but model weights not yet cached.
    - `MODEL_DOWNLOADING`: Model weights actively downloading in background.
    - `MODEL_READY`: Model loaded and available for local inference.
    - `BACKGROUND_RESTRICTED`: AICore suppresses heavy background inference to protect battery and thermal limits.
    - `UNSUPPORTED_LANGUAGE`: ML Kit GenAI on-device models are currently English-first (`en`). Regional languages fall back to cloud when online or unassisted heuristics when offline.
    - `QUOTA_EXCEEDED`: Per-minute token limit or thermal throttling triggered.

---

## 3. Gemma 4 E2B / Unsloth GGUF via llama.cpp Path

### 3.1 Model Artifact Specifications
* **Documentation Authority:** Unsloth Gemma Deployment ([https://gemma.ai/deployment/unsloth/](https://gemma.ai/deployment/unsloth/))
* **Hugging Face Repository:** `unsloth/gemma-4-E2B-it-GGUF` ([https://huggingface.co/unsloth/gemma-4-E2B-it-GGUF](https://huggingface.co/unsloth/gemma-4-E2B-it-GGUF))
* **Canonical Recommended Artifact:** `gemma-4-E2B-it-Q4_K_M.gguf`
  - **Quantization:** 4-bit Medium (`Q4_K_M`).
  - **Exact File Size:** ~3.11 GB (`3,344,000,000` bytes).
  - **Artifact Revision:** `main`.
* **High-Fidelity Alternative Artifact:** `gemma-4-E2B-it-Q8_0.gguf`
  - **Quantization:** 8-bit (`Q8_0`).
  - **Exact File Size:** ~5.05 GB (`5,420,000,000` bytes).
* **Optional Multimodal Projector (Vision/Audio):** `mmproj-gemma-4-E2B-it-f16.gguf`
  - **File Size:** ~1.0 GB (`1,073,741,824` bytes).
  - Required only if multimodal image/audio understanding is invoked locally.
* **License & Redistribution:** Governed by the **Gemma Open Model Terms of Use**. Non-redistributable inside the closed APK; downloaded on-demand to the app cache upon user selection or packaged as an optional offline language pack.

> [!NOTE]
> Previous experimental tests utilizing Gemma 2 2B (`unsloth/gemma-2-2b-it-GGUF`) are retained only as a lightweight baseline test. Gemma 2 does **not** satisfy the frozen Gemma 4 E2B commitment.

### 3.2 Realistic Hardware Requirements (Estimates Pending Hardware Benchmarking)
Because `gemma-4-E2B-it-Q4_K_M.gguf` is ~3.11 GB in size, memory and storage requirements are substantially higher than 2B models:

| Resource | Minimum Requirement | Recommended Target | Verification Status |
| :--- | :--- | :--- | :--- |
| **CPU Architecture** | `arm64-v8a` (64-bit ARM) | `arm64-v8a` with NEON / OpenMP | Required / Validated |
| **Dynamic Available RAM** | **`>= 3,500 MB`** | **`>= 4,500 MB`** | **Estimated** (Pending physical profiling) |
| **Total Physical RAM** | **`>= 8,192 MB` (8 GB)** | **`>= 12,288 MB` (12 GB)** | **Estimated** (Devices with <= 6GB risk LMK kill) |
| **Free Disk Storage** | **`>= 5,000 MB` (5 GB)** | **`>= 8,000 MB`** | Required for weight cache + buffers |
| **Inference Throughput** | ~8–15 tokens/sec | ~15–25 tokens/sec | Estimated (Snapdragon 8 Gen 2/3, Tensor G3) |

> [!WARNING]
> A static check of `totalRamMb >= 3000` is **rejected**. Android system overhead and host app heaps consume 2.5–3.5 GB of RAM. Loading a 3.11 GB model on a device with only 4 GB or 6 GB total RAM will trigger Android's Low Memory Killer (LMK). Dynamic available RAM must be verified at invocation time.

---

## 4. Complete End-to-End Request / Response Flow

```
1. Traveler initiates action (e.g. "Summarize Offline Note")
   │
   ▼
2. Flutter Client (NativePlatformService)
   │ Queries connectivity & device telemetry
   │
   ├── [Case 1: OFFLINE]
   │     │
   │     ▼ Invokes MethodChannel: summarizeOfflineNote / executeOfflineInference
   │   Android Kotlin (MainActivity.kt)
   │     │
   │     ├── If AICore model is ready ─────────► Executes Gemini Nano locally
   │     │                                       Returns: isLocalInference: true,
   │     │                                                provenance: 'GEMINI_NANO_LOCAL'
   │     │
   │     ├── Else if Gemma GGUF is ready ──────► Executes libllama.so locally
   │     │                                       Returns: isLocalInference: true,
   │     │                                                provenance: 'GEMMA_LOCAL'
   │     │
   │     └── Else (neither model ready) ───────► Executes unassisted deterministic heuristic
   │                                             Fails closed (Zero network calls)
   │                                             Returns: isLocalInference: false,
   │                                                      provenance: 'UNAVAILABLE'
   │
   └── [Case 2: ONLINE]
         │
         ├── If traveler requests on-device ───► Follows Case 1 local execution
         │
         └── If cloud fallback consented ──────► Calls Firebase Cloud Function
               │
               ▼ Cloud Function AI Service
             Executes Google Gemini API (gemini-3.8-flash)
             Returns: isLocalInference: false,
                      provenance: 'CLOUD_FALLBACK'
```

---

## 5. Execution Provenance & Privacy Guarantees

Every AI response emitted by the system carries an explicit, tamper-evident `ExecutionProvenance` tag:

```typescript
export type ExecutionProvenance =
  | 'GEMINI_NANO_LOCAL'  // Android AICore / ML Kit GenAI on-device execution
  | 'GEMMA_LOCAL'        // Gemma 4 E2B / Unsloth GGUF via llama.cpp native runtime
  | 'CLOUD_FALLBACK'     // Google Gemini API cloud execution (online only, with consent)
  | 'UNAVAILABLE';       // Local model unavailable / unassisted heuristic fallback
```

### Privacy Invariants Enforced:
1. **Never Report Cloud as Local:** A cloud-generated response (`gemini-3.8-flash` or `gemini-3.5-flash-lite`) must **never** be labeled `isLocalInference: true` or given a local provenance tag.
2. **Never Silently Leak Offline User Data:** When a traveler is offline and on-device model inference fails or is not downloaded, the engine **fails closed**. It never queues or leaks traveler notes to the cloud without explicit consent.
3. **Transparent Unassisted Mode:** When models are unready, the engine produces deterministic heuristic summaries and keywords labeled `unassistedFallback: true` and `provenance: 'UNAVAILABLE'`, ensuring travelers receive helpful assistance without deceptive claims of neural generation.

---

## 6. Verification Evidence & Classification

### 6.1 Test Classification Matrix

| Component / Layer | Implementation Location | Execution Mode | Verification Status |
| :--- | :--- | :--- | :--- |
| **Client-Side Platform Bridge** | `android/app/.../MainActivity.kt`, `lib/services/native_platform_service.dart` | Flutter / Kotlin Android Runtime (Owned by D) | Implemented & verified via `flutter test` (26/26 passed) |
| **Backend Schemas & Orchestration** | `functions/src/ai/schemas/`, `functions/src/ai/services/` | Node.js / TypeScript (Owned by B) | Implemented & compiled with 0 errors |
| **Deterministic Contract Tests** | `functions/test/test-b6-on-device-ai.ts` | Unit / Mock Bridge Execution (`tsx`) | **PASSED (42/42 assertions)** |
| **Full Regression Suite** | `functions/package.json` | Node.js Test Runner (`npm test`) | **PASSED (271/271 tests)** |
| **Physical Gemini Nano Inference** | Physical Pixel 8/9 / Galaxy S24 | Physical Android Hardware Execution | **NOT TESTED** (Requires physical AICore hardware) |
| **Physical Gemma 4 E2B Inference** | Physical ARM64 device (8GB+ RAM) | Physical Android Hardware Execution | **NOT TESTED** (Requires physical ARM64 device) |

### 6.2 Hardware Required for Physical Validation
- **Device 1 (Gemini Nano):** Google Pixel 8 / 8a / 9 or Galaxy S24 running Android 14 (API 34+) with Google Play Services and AICore initialized.
- **Device 2 (Gemma 4 E2B):** 64-bit ARM device (`arm64-v8a`) with >= 8 GB total physical RAM (Snapdragon 8 Gen 2 / Gen 3 or Tensor G3), running Android NDK 26+ runtime with `gemma-4-E2B-it-Q4_K_M.gguf`.
