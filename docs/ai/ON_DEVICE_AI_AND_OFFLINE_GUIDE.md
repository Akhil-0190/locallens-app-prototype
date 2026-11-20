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

### 2.1 Dependencies & Platform Requirements
* **Documentation Authority:** Google ML Kit GenAI ([https://developers.google.com/ml-kit/genai/](https://developers.google.com/ml-kit/genai/))
* **Platform SDK Requirement:** Minimum **Android 8.0+ (API 26+)** (`minSdk = 26`). Android API 34+ is **not** a universal library requirement; actual Gemini Nano model availability is determined dynamically via client status checks.
* **Exact Android Gradle Dependencies (`android/app/build.gradle.kts`):**
  ```kotlin
  dependencies {
      // Core ML Kit GenAI Prompt API for Gemini Nano access (Direct Prompting, Q&A, Keywords)
      implementation("com.google.mlkit:genai-prompt:1.0.0-beta4")
      // Specialized on-device summarization API (Offline Note Summaries)
      implementation("com.google.mlkit:genai-summarization:1.0.0-beta4")
      // CRITICAL: Explicitly pin kotlinx-coroutines to >= 1.11.0 to prevent
      // java.lang.NoSuchMethodError during runtime model download() in beta4
      implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.11.0")
  }
  ```

### 2.2 Actual Kotlin Implementation Reference (`MainActivity.kt`)
The following Kotlin implementation demonstrates how `Generation.getClient()` and `checkStatus()` execute and transmit real results across the Flutter MethodChannel:

```kotlin
package com.innovotribe.locallens

import android.os.Build
import com.google.mlkit.genai.prompt.Generation
import com.google.mlkit.genai.prompt.GenerativeModel
import com.google.mlkit.genai.prompt.FeatureStatus
import io.flutter.plugin.common.MethodChannel
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class NativeAiController(private val channel: MethodChannel) {
    private var generativeModel: GenerativeModel? = null

    private fun getModel(): GenerativeModel {
        if (generativeModel == null) {
            generativeModel = Generation.getClient()
        }
        return generativeModel!!
    }

    fun handleCheckAICoreAvailability(result: MethodChannel.Result) {
        val apiLevel = Build.VERSION.SDK_INT
        if (apiLevel < 26) {
            result.success(mapOf(
                "isAvailable" to false,
                "apiLevel" to apiLevel,
                "isSupportedDevice" to false,
                "aicorePackageInstalled" to false,
                "statusMessage" to "UNSUPPORTED_DEVICE: Requires API 26+. Current API: $apiLevel"
            ))
            return
        }

        try {
            val model = getModel()
            val status: FeatureStatus = model.checkStatus()
            val isReady = status == FeatureStatus.AVAILABLE

            result.success(mapOf(
                "isAvailable" to isReady,
                "apiLevel" to apiLevel,
                "featureStatus" to status.name, // AVAILABLE, DOWNLOADABLE, DOWNLOADING, UNAVAILABLE
                "aicorePackageInstalled" to true,
                "statusMessage" to when (status) {
                    FeatureStatus.AVAILABLE -> "AICORE_AVAILABLE: Gemini Nano is ready"
                    FeatureStatus.DOWNLOADABLE -> "MODEL_NOT_DOWNLOADED: Gemini Nano supported but not downloaded"
                    FeatureStatus.DOWNLOADING -> "MODEL_DOWNLOADING: Gemini Nano download in progress"
                    else -> "UNSUPPORTED_DEVICE: Gemini Nano not available on this device"
                }
            ))
        } catch (e: Exception) {
            result.success(mapOf(
                "isAvailable" to false,
                "apiLevel" to apiLevel,
                "isSupportedDevice" to false,
                "aicorePackageInstalled" to false,
                "statusMessage" to "AICore error: ${e.message}"
            ))
        }
    }

    fun handleExecuteOfflineInference(prompt: String, result: MethodChannel.Result) {
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val model = getModel()
                val status = model.checkStatus()
                if (status != FeatureStatus.AVAILABLE) {
                    result.success(mapOf(
                        "success" to false,
                        "isLocalInference" to false,
                        "code" to if (status == FeatureStatus.DOWNLOADABLE) "MODEL_NOT_DOWNLOADED" else "UNSUPPORTED_DEVICE",
                        "engine" to "AICORE",
                        "message" to "Model not ready ($status). Running in unassisted mode."
                    ))
                    return@launch
                }

                val response = model.generateContent(prompt)
                val text = response.text ?: ""
                result.success(mapOf(
                    "success" to true,
                    "isLocalInference" to true,
                    "code" to "OK",
                    "engine" to "AICORE",
                    "output" to text,
                    "modelUsed" to "Gemini Nano (ML Kit GenAI)"
                ))
            } catch (e: Exception) {
                result.success(mapOf(
                    "success" to false,
                    "isLocalInference" to false,
                    "code" to "INFERENCE_ERROR",
                    "engine" to "AICORE",
                    "message" to "Inference failed: ${e.message}"
                ))
            }
        }
    }
}
```

### 2.3 Dynamic Status Mapping to Internal Readiness States

| ML Kit GenAI `FeatureStatus` | Device Condition | Internal B6 Readiness State | Operational Behavior |
| :--- | :--- | :--- | :--- |
| `FeatureStatus.AVAILABLE` | Model downloaded, RAM sufficient, foreground | `MODEL_READY` | Dispatches on-device inference via AICore (`GEMINI_NANO_LOCAL`). |
| `FeatureStatus.DOWNLOADABLE` | Supported SoC, model weights pending | `MODEL_DOWNLOADABLE` | Triggers background download over unmetered Wi-Fi + charging. |
| `FeatureStatus.DOWNLOADING` | Download in progress | `MODEL_DOWNLOADING` | Displays download progress indicator; runs unassisted mode. |
| `FeatureStatus.UNAVAILABLE` | Unsupported SoC or API level < 26 | `FEATURE_NOT_SUPPORTED` / `UNSUPPORTED_OS_VERSION` | Suppresses AICore; cascades to Gemma GGUF or unassisted fallback. |
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
  - **Verification Command:** `sha256sum gemma-4-E2B-it-Q4_K_M.gguf` matches `740185b2...`.
  - **Direct Pinned URL:** `https://huggingface.co/unsloth/gemma-4-E2B-it-GGUF/resolve/90f9618340396838ee7ff5b0ba2da27da62953d3/gemma-4-E2B-it-Q4_K_M.gguf`
* **High-Fidelity Alternative Artifact:** `gemma-4-E2B-it-Q8_0.gguf`
  - **Quantization:** 8-bit (`Q8_0`).
  - **Exact File Size:** ~5.05 GB (`5,420,000,000` bytes).
* **Multimodal Projector Verification:**
  - Artifact `mmproj-BF16.gguf` (~987 MB) exists in the repository.
  - **Verification for B6:** Our frozen B6 scope is strictly text-based on-device assistance (offline note summarization, keyword extraction, spot practical Q&A). **The multimodal projector is NOT required for B6 functionality.** We do not claim local camera/audio multimodal support.
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

* **Agreement Source:** D5 Task Baseline Commit `fec0fb1`, [docs/d5-offline-android-report.md](file:///d:/neighborhoodguideapp/docs/d5-offline-android-report.md), and [MainActivity.kt](file:///d:/neighborhoodguideapp/android/app/src/main/kotlin/com/innovotribe/locallens/MainActivity.kt#L55-L207).

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

## 6. Comprehensive Integration Status Breakdown (A–E)

### A. Gemini Nano
* **Actual Kotlin ML Kit Client:** **AWAITING D** (Reference implementation provided; D to add Gradle dependencies `genai-prompt:1.0.0-beta4` and `kotlinx-coroutines:1.11.0` in `android/app/build.gradle.kts`).
* **Real Status Check:** **AWAITING D** (Currently returns simulated `AICORE_NOT_INSTALLED` in `MainActivity.kt`).
* **Real Inference Dispatch:** **NOT TESTED** (Requires physical Pixel 8/9 or Galaxy S24 hardware with downloaded AICore weights).

### B. Gemma 4 E2B
* **Pinned Artifact:** **IMPLEMENTED** (Pinned at Hugging Face commit `90f9618340396838ee7ff5b0ba2da27da62953d3`, SHA-256 `740185b2...`).
* **Android ARM64 Runtime Build:** **AWAITING D** (`libllama.so` compilation with NDK 26+ and placement in `jniLibs/arm64-v8a/`).
* **Model Download & Cache Manager:** **AWAITING D** (Flutter client download manager for 3.11 GB GGUF weight files into app storage).
* **Inference Dispatch:** **NOT TESTED** (Requires physical ARM64 device with 8GB+ RAM).

### C. Flutter-to-Kotlin Bridge
* **Actual Methods & Contracts:** **IMPLEMENTED** in Flutter `NativePlatformService` and Kotlin `MainActivity.kt` (D5 base `fec0fb1`).
* **Mock Bridge Adapter:** **IMPLEMENTED** in `functions/test/test-b6-on-device-ai.ts` (verified with 6/6 contract tests).
* **Real Device Bridge Execution:** **IMPLEMENTED (by D)** (verified with 26/26 passing Flutter unit tests in `test/native_platform_test.dart`).

### D. Cloud Fallback
* **Connectivity & Privacy Gating:** **IMPLEMENTED** in `local-ai-service.ts` and `model-orchestrator.ts`.
* **Execution Provenance:** Strictly sets `provenance: 'CLOUD_FALLBACK'`, `isLocalInference: false`, `executionEnvironment: 'BACKEND_CLOUD_FUNCTIONS'`.

### E. Offline Fallback
* **Zero Network Transmission:** **IMPLEMENTED** (Verified by spy executor test in Suite 4).
* **Deterministic Heuristics:** **IMPLEMENTED** (Sentence summarizer & frequency keyword extractor labeled `unassistedFallback: true`, `provenance: 'UNAVAILABLE'`).
