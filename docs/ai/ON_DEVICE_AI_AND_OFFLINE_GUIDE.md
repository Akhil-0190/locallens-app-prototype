# On-Device AI Architecture & Offline Execution Guide
## Task B6: Gemini Nano (AICore) and Gemma 4 E2B (Unsloth GGUF)

**Repository:** `goddy04/neighborhoodguideapp`  
**Domain:** Domain 09 — On-Device AI Inference & Edge Execution  
**Lead AI Owner:** Developer B (AI & Model Integration Lead)
**Platform Integration Partner:** Developer D (Flutter Client & Android Native Platform Bridge)
**Status:** Verification & Artifact Pinned — Ready for Final Review
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
│         │                      Returns: isLocalInference: true                   │
│         │                               provenance: 'GEMINI_NANO_LOCAL'          │
│         │                                                                        │
│         ├── Offline Path B ──► llama.cpp Native Runtime (libllama.so)            │
│         │                      (Gemma 4 E2B Unsloth GGUF in App Storage)         │
│         │                      Returns: isLocalInference: true                   │
│         │                               provenance: 'GEMMA_LOCAL'                │
│         │                                                                        │
│         └── Offline Fallback ─► Deterministic Heuristics (Unassisted Mode)       │
│                                Fails closed (Zero network calls)                 │
│                                Returns: isLocalInference: false                  │
│                                         provenance: 'UNAVAILABLE'                │
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
│         │                      Returns: isLocalInference: false                  │
│         │                               provenance: 'CLOUD_FALLBACK'             │
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

### 2.1 Dependencies & Authoritative APIs
* **Documentation Authority:** Google ML Kit GenAI ([https://developers.google.com/ml-kit/genai/](https://developers.google.com/ml-kit/genai/))
* **Exact Android Gradle Dependencies:**
  ```kotlin
  dependencies {
      // Core ML Kit GenAI Prompt API for Gemini Nano on-device access
      implementation("com.google.mlkit:genai-prompt:1.0.0-beta4")
      // Specialized on-device summarization API
      implementation("com.google.mlkit:genai-summarization:1.0.0-beta4")
  }
  ```
* **Client Initialization & Status Verification:**
  ```kotlin
  import com.google.mlkit.genai.prompt.Generation
  import com.google.mlkit.genai.prompt.GenerativeModel
  import com.google.mlkit.genai.prompt.FeatureStatus

  val generativeModel: GenerativeModel = Generation.getClient()
  val status: FeatureStatus = generativeModel.checkStatus()
  ```

### 2.2 Dynamic Status Mapping to Internal Readiness States

| ML Kit GenAI `FeatureStatus` | Device Condition | Internal B6 Readiness State | Operational Behavior |
| :--- | :--- | :--- | :--- |
| `FeatureStatus.AVAILABLE` | Model downloaded, RAM sufficient, foreground | `MODEL_READY` | Dispatches on-device inference via AICore (`GEMINI_NANO_LOCAL`). |
| `FeatureStatus.DOWNLOADABLE` | Supported SoC, model weights pending | `MODEL_DOWNLOADABLE` | Triggers background download over unmetered Wi-Fi + charging. |
| `FeatureStatus.DOWNLOADING` | Download in progress | `MODEL_DOWNLOADING` | Displays download progress indicator; runs unassisted mode. |
| `FeatureStatus.UNAVAILABLE` | Unsupported SoC or API level < 34 | `FEATURE_NOT_SUPPORTED` / `UNSUPPORTED_OS_VERSION` | Suppresses AICore; cascades to Gemma GGUF or unassisted fallback. |
| *(Lifecycle: Background)* | App not in foreground | `BACKGROUND_RESTRICTED` | Suppresses execution to protect battery and thermal headroom. |
| *(Language Check)* | Non-English language requested | `UNSUPPORTED_LANGUAGE` | On-device models are English-first; regional languages route to cloud. |

---

## 3. Gemma 4 E2B / Unsloth GGUF via llama.cpp Path

### 3.1 Pinned Model Artifact Specifications
* **Documentation Authority:** Unsloth Gemma Deployment ([https://gemma.ai/deployment/unsloth/](https://gemma.ai/deployment/unsloth/))
* **Hugging Face Repository:** [`unsloth/gemma-4-E2B-it-GGUF`](https://huggingface.co/unsloth/gemma-4-E2B-it-GGUF)
* **Pinned Commit SHA:** `90f9618340396838ee7ff5b0ba2da27da62953d3`
* **Canonical Recommended Artifact:** `gemma-4-E2B-it-Q4_K_M.gguf`
  - **Quantization:** 4-bit Medium (`Q4_K_M`).
  - **Exact File Size:** `3,344,000,000` bytes (~3.11 GB).
  - **SHA-256 Checksum:** `740185b21d22ceb83a11c3aa62ad5842ef32c70f6096d756bbee85a1e4ec34b8`.
  - **Direct Download URL:** `https://huggingface.co/unsloth/gemma-4-E2B-it-GGUF/resolve/90f9618340396838ee7ff5b0ba2da27da62953d3/gemma-4-E2B-it-Q4_K_M.gguf`.
* **High-Fidelity Alternative Artifact:** `gemma-4-E2B-it-Q8_0.gguf`
  - **Quantization:** 8-bit (`Q8_0`).
  - **Exact File Size:** ~5.05 GB (`5,420,000,000` bytes).
* **Multimodal Projector Verification:**
  - Artifact `mmproj-BF16.gguf` (~987 MB) exists in the Hugging Face repository.
  - **Verification for B6:** Our frozen B6 scope is text-only on-device inference (traveler note summarization, keyword extraction, and spot Q&A). **The multimodal projector is NOT required for B6 functionality.** We do not claim local camera/audio multimodal support.
* **Licensing & Terms:** Governed by the **Gemma Open Model Terms of Use**. Non-redistributable inside the closed APK; downloaded on-demand to the app cache upon user selection.

### 3.2 Android ARM64 Build Configuration (`llama.cpp`)
To cross-compile `llama.cpp` for Android ARM64, CMake is configured with the Android NDK r26d+ toolchain:

```bash
cmake \
    -DCMAKE_TOOLCHAIN_FILE=$ANDROID_NDK/build/cmake/android.toolchain.cmake \
    -DANDROID_ABI=arm64-v8a \
    -DANDROID_PLATFORM=android-28 \
    -DGGML_NATIVE=OFF \
    -DGGML_OPENMP=OFF \
    -DGGML_LLAMAFILE=OFF \
    -DLLAMA_OPENSSL=OFF \
    -B build-android

cmake --build build-android --config Release -j4
```

### 3.3 Hardware Requirements (Provisional Estimates Pending Physical Profiling)
* **Target CPU Architecture:** `arm64-v8a` (64-bit ARM).
* **Provisional Dynamic Available RAM:** **`ramAvailableMb >= 3,500 MB`** at invocation time.
* **Provisional Total System RAM:** **`totalRamMb >= 8,192 MB`** (8 GB+). Devices with <= 6 GB physical RAM risk being terminated by Android's Low Memory Killer (LMK).
* **Minimum Disk Storage:** **`storageAvailableMb >= 5,000 MB`** (5 GB+ free storage for weight caching).

---

## 4. Developer D Bridge Contract Reconciliation

### 4.1 Agreed MethodChannel Interface (`com.innovotribe.locallens/native_ai`)

| Method Name | Arguments | Return Type / Map Keys | Implementation Status |
| :--- | :--- | :--- | :--- |
| `checkAICoreAvailability` | None | `{ isAvailable, apiLevel, isSupportedDevice, aicorePackageInstalled, statusMessage }` | Implemented in `MainActivity.kt` & `native_platform_service.dart` |
| `getDeviceAICapabilities` | None | `{ hasNpu, ramAvailableMb, aicoreVersion, supportedFeatures, apiLevel, totalRamMb, aicoreInstalled }` | Implemented in `MainActivity.kt` & `native_platform_service.dart` |
| `getNativeAiStatus` | None | String (`UNSUPPORTED_DEVICE`, `AICORE_NOT_INSTALLED`, `MODEL_NOT_AVAILABLE`, `INFERENCE_ACTIVE`) | Implemented in `MainActivity.kt` & `native_platform_service.dart` |
| `summarizeOfflineNote` | `{ noteText, spotName, language }` | `{ success, summary, keyHighlights, isLocalInference, modelUsed, code, message }` | Implemented in `MainActivity.kt` & `native_platform_service.dart` |
| `extractOfflineKeywords` | `{ text }` | `{ success, keywords, isLocalInference, modelUsed, code, message }` | Implemented in `MainActivity.kt` & `native_platform_service.dart` |
| `executeOfflineInference`| `{ prompt, engine }` | `{ success, isLocalInference, code, engine, output, message }` | Implemented in `MainActivity.kt` & `native_platform_service.dart` |

* **Discrepancy Resolution:** The test suite and orchestrator have been reconciled to directly use `executeOfflineInference({ prompt, engine: 'AICORE' | 'LLAMA_CPP' })`, `summarizeOfflineNote`, and `extractOfflineKeywords`. No artificial method signatures exist.
* **Agreement Source:** D5 Task Baseline Commit `fec0fb1`, [d5-offline-android-report.md](file:///d:/neighborhoodguideapp/docs/d5-offline-android-report.md), and [MainActivity.kt](file:///d:/neighborhoodguideapp/android/app/src/main/kotlin/com/innovotribe/locallens/MainActivity.kt#L55-L207).

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

## 6. Corrected Evidence Classification Matrix

| Path / Component | Verification Layer | Command / Environment | Result / Status | Notes |
| :--- | :--- | :--- | :--- | :--- |
| **TypeScript Schemas & Contracts** | Deterministic Unit Tests | `npm run test:b6` (tsx) | **PASSED (41/41 assertions)** | Schema validation, pinned commit SHA, dynamic ML Kit GenAI readiness rules. |
| **D5 Bridge Contract Emulation** | Mock Bridge Adapter Tests | `npm run test:b6` (tsx) | **PASSED (100%)** | Parity verification with `com.innovotribe.locallens/native_ai` signatures. |
| **Full Regression Suite** | Server-side Backend Suite | `npm test` (node --test) | **PASSED (271/271 tests)** | A1–A5, B1–B5, C1–C5 pass with zero failures. |
| **Actual Flutter-to-Kotlin Bridge**| Client Platform Bridge | `flutter test` (Flutter Test Runner) | **PASSED (26/26 tests)** | Verified by Developer D in Task D5 (`test/native_platform_test.dart`). |
| **Actual Gemini Nano Physical Inference** | Physical Android Hardware | Physical Pixel 8/9 / Galaxy S24 | **NOT TESTED** | Hardware unavailable in CI/workstation environment. |
| **Actual Gemma 4 E2B Physical Inference** | Physical ARM64 Hardware | Physical 8GB+ ARM64 Device | **NOT TESTED** | Hardware unavailable in CI/workstation environment. |
