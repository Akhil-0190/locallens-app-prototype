# Developer D Handoff: Task B6 On-Device AI & Native Runtime Integration

**Author:** Developer B (AI & Model Integration Lead)  
**Target:** Developer D (Flutter Client & Android Platform Lead)  
**Task:** B6 — On-Device AI Integration (Gemini Nano & Gemma 4 E2B)  
**Repository Branch:** `feature/B6-on-device-ai`  
**Active PR:** [#29](https://github.com/goddy04/neighborhoodguideapp/pull/29)  
**Target Branch:** `main`

---

## 1. Executive Summary & Ownership Separation

To preserve architectural integrity and avoid blocking each other, our roles are partitioned as follows:

* **Developer B (AI Lead) — Completed in PR #29:**
  - Zod validation schemas and TypeScript contracts for local AI inference, telemetry, readiness states, and execution provenance (`functions/src/ai/schemas/local-ai-schemas.ts`).
  - Model registry configuration pinning Gemma 4 E2B and Gemini Nano specifications (`functions/src/ai/config/models.ts`).
  - Dynamic readiness evaluators, offline fail-closed routing, and deterministic unassisted fallback heuristics (`functions/src/ai/services/local-ai-service.ts`).
  - Unit and contract verification suite with 44 passing tests (`functions/test/test-b6-on-device-ai.ts`).
* **Developer D (Client / Native Lead) — Next Implementation Phase:**
  - Android Gradle dependencies for Google ML Kit GenAI Prompt and Summarization APIs.
  - Native Kotlin implementation of `checkAICoreAvailability`, `getDeviceAICapabilities`, and inference execution in `MainActivity.kt`.
  - Android NDK CMake cross-compilation of `libllama.so` for `arm64-v8a` and JNI wrapper.
  - Flutter-side offline model download and cache manager (`offline_model_manager.dart`) with SHA-256 checksum verification.
  - Integration with existing `NativePlatformService` (`lib/services/native_platform_service.dart`).

---

## 2. MethodChannel Bridge Contract (`com.innovotribe.locallens/native_ai`)

Developer D's existing bridge in `android/app/src/main/kotlin/com/innovotribe/locallens/MainActivity.kt` provides the foundation. The following adjustments are required to transition from placeholder/mock checks to actual runtime execution.

### 2.1 Summary of Method Signatures & Return Types

| Method | Flutter Arguments | Return Map Keys | Execution Status |
| :--- | :--- | :--- | :--- |
| `checkAICoreAvailability` | `None` | `isAvailable` (bool), `apiLevel` (int), `featureStatus` (string), `aicorePackageInstalled` (bool), `statusMessage` (string) | Upgrade from static API 34+ check to dynamic ML Kit `checkStatus()`. |
| `getDeviceAICapabilities` | `None` | `hasNpu` (bool), `ramAvailableMb` (long), `aicoreVersion` (int), `supportedFeatures` (list), `apiLevel` (int), `totalRamMb` (long), `aicoreInstalled` (bool) | Upgrade `supportedFeatures` check for Gemma from `totalRamMb >= 3000` to dynamic `ramAvailableMb >= 3500 && totalRamMb >= 8192`. |
| `getNativeAiStatus` | `None` | String (`UNSUPPORTED_DEVICE`, `AICORE_NOT_INSTALLED`, `MODEL_NOT_DOWNLOADED`, `MODEL_DOWNLOADING`, `LLAMA_CPP_RUNTIME_READY`, `INFERENCE_ACTIVE`) | Return real discrete status. |
| `summarizeOfflineNote` | `noteText` (string), `spotName` (string), `language` (string) | `success` (bool), `summary` (string), `keyHighlights` (list), `isLocalInference` (bool), `modelUsed` (string), `code` (string), `message` (string) | Execute on-device summarization via ML Kit or Gemma GGUF. |
| `extractOfflineKeywords` | `text` (string) | `success` (bool), `keywords` (list), `isLocalInference` (bool), `modelUsed` (string), `code` (string), `message` (string) | Execute on-device keyword extraction. |
| `executeOfflineInference`| `prompt` (string), `engine` ("AICORE" \| "LLAMA_CPP") | `success` (bool), `isLocalInference` (bool), `code` (string), `engine` (string), `output` (string), `message` (string) | Direct prompt-response execution via selected native engine. |

---

## 3. Gemini Nano / Android AICore Integration Details

### 3.1 Android Build Configuration (`android/app/build.gradle`)
Add the following dependencies to `android/app/build.gradle`:

```groovy
dependencies {
    // Minimum SDK requirement for ML Kit GenAI is API 26+
    implementation 'com.google.mlkit:genai-prompt:1.0.0-beta4'
    implementation 'com.google.mlkit:genai-summarization:1.0.0-beta4'

    // Mandatory fix: Pin coroutines to >= 1.11.0 to avoid java.lang.NoSuchMethodError during download()
    implementation 'org.jetbrains.kotlinx:kotlinx-coroutines-android:1.11.0'
}
```

### 3.2 Kotlin Controller Implementation (`MainActivity.kt`)
Replace the placeholder checks in `MainActivity.kt` with the real ML Kit client:

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
                "featureStatus" to "UNAVAILABLE",
                "aicorePackageInstalled" to false,
                "statusMessage" to "UNSUPPORTED_DEVICE: Requires Android API 26+. Current API: $apiLevel"
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
                "featureStatus" to "UNAVAILABLE",
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
                        "output" to "",
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
                    "modelUsed" to "Gemini Nano (ML Kit GenAI)",
                    "message" to "Inference completed on-device via Android AICore."
                ))
            } catch (e: Exception) {
                result.success(mapOf(
                    "success" to false,
                    "isLocalInference" to false,
                    "code" to "INFERENCE_FAILED",
                    "engine" to "AICORE",
                    "output" to "",
                    "message" to "Inference failed: ${e.message}"
                ))
            }
        }
    }
}
```

---

## 4. Gemma 4 E2B Unsloth GGUF & `llama.cpp` Native Runtime

### 4.1 Pinned Artifact Specifications
* **Repository:** [`unsloth/gemma-4-E2B-it-GGUF`](https://huggingface.co/unsloth/gemma-4-E2B-it-GGUF)
* **Pinned Commit SHA:** `90f9618340396838ee7ff5b0ba2da27da62953d3`
* **Artifact Filename:** `gemma-4-E2B-it-Q4_K_M.gguf`
* **Direct Download URL:**  
  `https://huggingface.co/unsloth/gemma-4-E2B-it-GGUF/resolve/90f9618340396838ee7ff5b0ba2da27da62953d3/gemma-4-E2B-it-Q4_K_M.gguf`
* **Exact File Size:** `3,344,000,000` bytes (~3.11 GB)
* **SHA-256 Checksum:** `740185b21d22ceb83a11c3aa62ad5842ef32c70f6096d756bbee85a1e4ec34b8`
* **License:** Apache License 2.0 (as declared in repository metadata and model card).
* **Multimodal Projector:** `mmproj-BF16.gguf` (~987 MB) is **NOT required** for B6 text tasks.

### 4.2 Hardware & System Memory Gates
* **Target Architecture:** `arm64-v8a` (64-bit ARM). 32-bit devices and x86 emulators are unsupported.
* **Dynamic Available RAM:** Must verify `ramAvailableMb >= 3500 MB` at invocation time.
* **Total Physical RAM:** Device must have `totalRamMb >= 8192 MB` (8 GB+). Devices with <= 6 GB physical RAM risk process termination by Android's Low Memory Killer (LMK).
* **Storage Requirement:** Minimum `5,000 MB` free storage for model weight caching.

### 4.3 Native Runtime Cross-Compilation (`libllama.so`)
Developer D compiles `llama.cpp` with the Android NDK r26d+ CMake toolchain:

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
Output library `libllama.so` placed at:
`android/app/src/main/jniLibs/arm64-v8a/libllama.so`

### 4.4 JNI Interface Specification (`LlamaBridge.kt`)
```kotlin
package com.innovotribe.locallens

class LlamaBridge {
    companion object {
        init {
            System.loadLibrary("llama")
        }
    }

    external fun nativeInit(modelPath: String, nThreads: Int, nCtx: Int): Long
    external fun nativeGenerate(handle: Long, prompt: String, maxTokens: Int): String
    external fun nativeFree(handle: Long)
}
```

### 4.5 Client Offline Model Downloader (`offline_model_manager.dart`)
Implement a client-side downloader with:
1. Resumable range requests for the 3.11 GB artifact.
2. Background execution with notifications.
3. Strict SHA-256 integrity verification matching `740185b21d22ceb83a11c3aa62ad5842ef32c70f6096d756bbee85a1e4ec34b8` prior to marking the model ready.
4. Storage pre-flight check (`>= 5000 MB` free space).

---

## 5. Provenance & Privacy Invariants

To maintain integrity across the monorepo, responses must adhere to the following contracts:

1. **`isLocalInference`:**
   - Must be `true` **ONLY** when the neural model ran entirely on-device (`GEMINI_NANO_LOCAL` or `GEMMA_LOCAL`).
   - Must be `false` for cloud fallback and unassisted heuristic fallbacks.
2. **`unassistedFallback`:**
   - Must be `true` when returning deterministic heuristics due to missing model binaries (`provenance: 'UNAVAILABLE'`).
   - Never claim heuristics as AI or neural generation.
3. **Fail-Closed Offline Policy:**
   - Zero network calls when `connectivity === 'OFFLINE'`.
   - Never upload offline user notes to the cloud without explicit opt-in consent (`userConsentCloudFallback: true`).

---

## 6. Implementation Checklist for Developer D

- [ ] **Step 1:** Update `android/app/build.gradle` with ML Kit GenAI and coroutine dependencies.
- [ ] **Step 2:** Update `MainActivity.kt` with real `Generation.getClient()` and `checkStatus()` mapping.
- [ ] **Step 3:** Compile `libllama.so` for `arm64-v8a` and place in `android/app/src/main/jniLibs/arm64-v8a/`.
- [ ] **Step 4:** Implement `offline_model_manager.dart` with SHA-256 verification.
- [ ] **Step 5:** Update `test/native_platform_test.dart` to verify real MethodChannel payloads.

---
*End of Developer D Handoff Specification.*
