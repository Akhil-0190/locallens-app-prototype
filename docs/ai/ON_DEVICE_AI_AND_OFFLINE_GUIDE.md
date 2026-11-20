# On-Device AI Architecture & Offline Execution Guide
## Task B6: Gemini Nano (AICore) and Gemma 4 E2B (Unsloth GGUF)

**Repository:** `goddy04/neighborhoodguideapp`  
**Domain:** Domain 09 — On-Device AI Inference & Edge Execution  
**Lead Owner:** Developer B (AI & Model Integration Lead)  
**Platform Integration Partner:** Developer D (Flutter Client & Android Native Bridge)  
**Status:** Implementation Complete & Ready for Review  
**Date:** November 2026  

---

## 1. Executive Summary & Architectural Overview

The Neighborhood Guide App delivers zero-latency, private, and fully offline AI capabilities committed in our frozen architecture and pitch deck. The design provides two distinct on-device local execution paths:

```
                                  [LocalInferenceRequest]
                                             │
                                    ┌────────┴────────┐
                             (Device Connectivity Check)
                                    │                 │
                             [OFFLINE / LOCAL]     [ONLINE]
                                    │                 │
                   ┌────────────────┴────────────────┐│
                   │ (Dynamic Hardware Telemetry)    ││
                   │  - CPU ABI: arm64-v8a           ││
                   │  - ramAvailableMb >= 1500MB     ││
                   │  - storageAvailableMb >= 2500MB ││
                   │  - API >= 34 & AICore package   ││
                   └────────────────┬────────────────┘│
                                    │                 │
              ┌─────────────────────┴───────┐         │
              ▼                             ▼         ▼
     [Path 1: Gemini Nano]         [Path 2: Gemma GGUF] [Path 3: Cloud Gemini]
      Android AICore / ML Kit       llama.cpp ARM64 Native  (Consented Fallback)
    (com.google.android.aicore)    (unsloth/gemma-2-2b)   (gemini-3.8-flash)
              │                             │                 │
              ▼                             ▼                 ▼
     [GEMINI_NANO_LOCAL]              [GEMMA_LOCAL]     [CLOUD_FALLBACK]
              │                             │                 │
              └──────────────┬──────────────┘                 │
                             │ (If Unready / Model Missing)   │
                             ▼                                │
                 [Fail-Closed Offline Fallback]               │
                    - Zero cloud data leakage                 │
                    - Deterministic heuristics                │
                             │                                │
                             ▼                                │
                       [UNAVAILABLE]                          │
                             │                                │
                             └────────────────┬───────────────┘
                                              ▼
                                   [Audit-Ready Response]
```

### Architectural Separation
1. **Gemini Nano:** System-managed on-device foundation model via Android AICore / Google ML Kit GenAI.
2. **Gemma 4 E2B:** App-managed open-weights instruction-tuned GGUF model executed via `llama.cpp` Android native runtime (`libllama.so` on `arm64-v8a`).

These two model paths are fundamentally distinct and never conflated:
- Gemma is **never** treated as an AICore model.
- Gemini Nano is **never** treated as a GGUF model.

---

## 2. Gemini Nano / Android AICore Path

### 2.1 Authoritative Standard & Multi-OEM Support
* **Documentation Authority:** Google ML Kit GenAI ([https://developers.google.com/ml-kit/genai/](https://developers.google.com/ml-kit/genai/))
* **Multi-OEM Support Matrix:** Gemini Nano is not restricted to Pixel or Galaxy devices. Google's ML Kit GenAI documentation encompasses devices from multiple OEMs:
  - **Google:** Pixel 8, Pixel 8 Pro, Pixel 8a, Pixel 9, Pixel 9 Pro, Pixel 9 Pro Fold, Pixel Fold.
  - **Samsung:** Galaxy S24, S24+, S24 Ultra, Galaxy Z Fold6, Galaxy Z Flip6.
  - **Xiaomi:** Xiaomi 14, Xiaomi 14 Pro, Xiaomi 14T Pro.
  - **Motorola:** Motorola Edge 50 Ultra, Razr 50 Ultra.
  - **OnePlus:** OnePlus 12 series.
  - **OPPO:** Find X7 series.

### 2.2 Deep Readiness Lifecycle Evaluation
A device having `Build.VERSION.SDK_INT >= 34` and `com.google.android.aicore` installed is **necessary but not sufficient** to establish readiness. The B6 engine evaluates the complete status pipeline:

| Status Code | Description | Action Taken |
| :--- | :--- | :--- |
| `UNSUPPORTED_OS_VERSION` | Android SDK < 34 (Android 13 or older). | Reject AICore; evaluate Gemma or unassisted. |
| `UNSUPPORTED_DEVICE` | OEM SoC does not meet NPU/DSP requirements. | Reject AICore; evaluate Gemma or unassisted. |
| `PACKAGE_NOT_INSTALLED` | `com.google.android.aicore` not present. | Reject AICore; evaluate Gemma or unassisted. |
| `MODEL_NOT_DOWNLOADED` | System service present, but model weights not yet cached. | Fall back to unassisted offline (MODEL_NOT_DOWNLOADED). |
| `MODEL_DOWNLOADING` | Model weights downloading via unmetered Wi-Fi + charging. | Display download progress badge in UI. |
| `BACKGROUND_RESTRICTED` | Host app is in background; AICore limits inference. | Suppress execution to protect battery/thermals. |
| `FEATURE_UNAVAILABLE` | Specific requested API (e.g. Vision/Multimodal) unsupported. | Reject feature; fall back to text summarizer. |
| `MODEL_READY` | Initialized, model weights loaded, ready for inference. | Route request to `GEMINI_NANO_LOCAL`. |

### 2.3 Feature-Specific Capabilities
ML Kit GenAI exposes separate APIs with distinct hardware readiness:
- **Direct Model Prompting:** Raw prompt/response via foundation LLM.
- **Summarization API:** Highly optimized summarization pipeline for notes, reviews, and highlights.
- **Rewrite API:** Tone adjustment, phrasing improvements, and structural polish.
- **Image Description:** Multimodal on-device vision (restricted to AICore v2 hardware).

---

## 3. Gemma 4 E2B / Unsloth GGUF via llama.cpp Path

### 3.1 Model Artifact Specifications
* **Documentation Authority:** Unsloth Gemma Deployment ([https://gemma.ai/deployment/unsloth/](https://gemma.ai/deployment/unsloth/))
* **Hugging Face Repository:** `unsloth/gemma-2-2b-it-GGUF`
* **Canonical Recommended Artifact:** `gemma-2-2b-it-Q4_K_M.gguf`
  - **Quantization:** 4-bit medium (`Q4_K_M`), optimal balance between perplexity and RAM footprint.
  - **Exact File Size:** 1,714,561,024 bytes (~1.71 GB).
  - **Artifact Revision:** `main` (commit SHA `84f4f38753235ff8a86a0e66d98e5e79147137f6`).
* **High-Fidelity Alternative Artifact:** `gemma-2-2b-it-Q8_0.gguf`
  - **Quantization:** 8-bit quantization (`Q8_0`).
  - **Exact File Size:** 2,782,142,464 bytes (~2.78 GB).
  - **Hardware Profile:** Devices with >= 6,144 MB total RAM.
* **License & Redistribution:** Governed by the **Gemma Open Model Terms of Use**. The model binary is not bundled into the closed APK; it is downloaded on-demand to the app cache upon user selection or packaged as an optional offline neighborhood language pack.

### 3.2 Native Runtime Architecture (`llama.cpp` Android ARM64)
- **Shared Library:** `libllama.so` compiled for `arm64-v8a` using Android NDK r26d+ with OpenMP and ARM NEON SIMD vectorization.
- **JNI Bridge:** Android JNI interface exposing model initialization, token generation, context caching, and memory release.
- **Context Buffer & KV Cache:** 2048 token context window consumes ~350 MB KV cache + ~200 MB execution buffers.
- **Memory Footprint:**
  - mmap model weights: ~1.71 GB.
  - Active runtime resident set size (RSS): ~1.9 GB.
  - Dynamic Free RAM requirement (`ramAvailableMb`): **>= 1,500 MB**.

### 3.3 Dynamic RAM vs Total RAM Rule
> [!IMPORTANT]
> A static check of `totalRamMb >= 3000` is **insufficient** and rejected by our architecture. Android system services, surface flinger, and background apps consume substantial RAM. The runtime must verify dynamic available RAM (`ramAvailableMb >= 1500`) at invocation time to prevent Android LMK (Low Memory Killer) from killing the application.

---

## 4. D5 Native Platform Bridge Interface

Developer D provides the native Android MethodChannel bridge in `MainActivity.kt` and `NativePlatformService`. Developer B defines the AI data schemas, readiness evaluator, prompt structuring, and provenance engine.

### 4.1 MethodChannel Contract (`com.innovotribe.locallens/native_ai`)

| Bridge Method | Arguments | Native Implementation | AI Engine Mapping |
| :--- | :--- | :--- | :--- |
| `checkAICoreAvailability` | None | Inspects `SDK_INT >= 34` and `com.google.android.aicore`. | Feeds `evaluateAICoreReadiness()`. |
| `getDeviceAICapabilities` | None | Queries `ActivityManager.MemoryInfo`, ABI, and versions. | Populates `DeviceAICapabilities`. |
| `getNativeAiStatus` | None | Returns discrete lifecycle state string. | Mapped to `AICoreReadinessStatus`. |
| `summarizeOfflineNote` | `noteText`, `spotName`, `language` | Dispatches to AICore or unassisted fallback. | Populates `LocalInferenceOutput.summary`. |
| `extractOfflineKeywords` | `text` | Dispatches to keyword extraction pipeline. | Populates `LocalInferenceOutput.keywords`. |
| `executeOfflineInference`| `prompt`, `engine` | Dispatches to local engine (`AICORE` or `LLAMA_CPP`). | Routes to `orchestrateLocalInference()`. |

### 4.2 Four-Level State Distinction
Our architecture strictly differentiates:
1. **Bridge method existing:** The Kotlin `MethodChannel` handler is registered.
2. **Bridge method returning mock/fallback:** The bridge returns `success: false, code: "MODEL_NOT_DOWNLOADED"`.
3. **Model being available:** The model weights exist in AICore system storage or app GGUF cache.
4. **Actual local inference succeeding:** The local engine executes tokens on device hardware and returns non-empty generated text.

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

### Strict Architectural Invariants:
1. **Never Report Cloud as Local:** A cloud-generated response (`gemini-3.8-flash` or `gemini-3.5-flash-lite`) must **never** be labeled `isLocalInference: true` or given a local provenance tag.
2. **Never Silently Leak Offline Data:** When a traveler is offline and on-device model inference fails or is not downloaded, the engine **fails closed**. It never queues or leaks traveler notes to the cloud without explicit consent.
3. **Transparent Unassisted Mode:** When models are unready, the engine produces deterministic heuristic summaries and keywords labeled `unassistedFallback: true` and `provenance: 'UNAVAILABLE'`, ensuring travelers receive helpful assistance without deceptive claims of neural generation.

---

## 6. Verification Evidence & Physical Hardware Boundaries

### 6.1 Test Classification Matrix

| Test Category | Execution Tool | Status | Scope Verified |
| :--- | :--- | :--- | :--- |
| **Deterministic Unit Tests** | `npm run test:b6` (tsx) | **PASSED** (100%) | AICore readiness rules, Gemma GGUF checks, dynamic RAM evaluation, engine selection logic, unassisted heuristics. |
| **Mock Bridge Tests** | `npm run test:b6` (tsx) | **PASSED** (100%) | D5 MethodChannel contract emulation, response schema conformance, parameter round-tripping. |
| **Online / Offline Switching** | `npm run test:b6` (tsx) | **PASSED** (100%) | Provenance tagging, privacy fail-closed guarantees, consented cloud fallback. |
| **Full Regression Suite** | `npm test` | **PASSED** (100%) | Upstream domains A1–A5, B1–B5, and C1–C5 unaffected. |
| **Real Device AICore Inference**| Physical Pixel 8/9 / Galaxy S24 | **NOT TESTED** | Requires physical Android 14+ ARM64 hardware with pre-provisioned AICore models. |
| **Real Device Gemma GGUF Inference** | Physical ARM64 device | **NOT TESTED** | Requires physical ARM64 device with 1.71GB GGUF artifact and compiled `libllama.so`. |

### 6.2 Hardware Required for Post-Merge Physical Validation
- **Device 1 (Gemini Nano):** Google Pixel 8 / 8a / 9 running Android 14 (API 34) or Android 15 (API 35) with Google Play Services and AICore initialized.
- **Device 2 (Gemma GGUF):** Any 64-bit ARM device (`arm64-v8a`) with >= 8 GB total RAM and Snapdragon 8 Gen 2 / Gen 3 or Tensor G3 SoC, running Android NDK r26d runtime with `gemma-2-2b-it-Q4_K_M.gguf`.
