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

### 2.2 Actual Committed Code vs. Design Reference Code
* **Code Committed in Repository (`android/app/.../MainActivity.kt` in commit `fec0fb1`):**
  Currently contains Developer D's baseline platform detection: checks `Build.VERSION.SDK_INT >= 34` and `PackageManager.getPackageInfo("com.google.android.aicore", 0)`. The ML Kit GenAI dependencies and `Generation.getClient()` are **NOT** yet committed in `MainActivity.kt`.
  - **Status:** **`AWAITING D`**.
  - **Ownership:** Developer D owns adding the Gradle dependencies, calling `Generation.getClient()`, managing model preparation/download, and writing corresponding Android instrumentation tests.
* **Architectural Reference Code (Provided by B for D's Implementation):**
  ```kotlin
  // Reference Kotlin implementation for Developer D to integrate into MainActivity.kt:
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

      fun handleCheckAICoreAvailability(result: MethodChannel.Result, context: android.content.Context) {
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

          var isPkgInstalled = false
          try {
              context.packageManager.getPackageInfo("com.google.android.aicore", 0)
              isPkgInstalled = true
          } catch (_: Exception) {
              isPkgInstalled = false
          }

          try {
              val model = getModel()
              val status: FeatureStatus = model.checkStatus()
              val isReady = status == FeatureStatus.AVAILABLE

              result.success(mapOf(
                  "isAvailable" to isReady,
                  "apiLevel" to apiLevel,
                  "featureStatus" to status.name,
                  "aicorePackageInstalled" to isPkgInstalled,
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
                  "aicorePackageInstalled" to isPkgInstalled,
                  "statusMessage" to "AICore error: ${e.message}"
              ))
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

### 3.1 Pinned Model Artifact & Licensing Evidence
* **Documentation Authority:** Unsloth Gemma Deployment ([https://gemma.ai/deployment/unsloth/](https://gemma.ai/deployment/unsloth/))
* **Hugging Face Repository:** [`unsloth/gemma-4-E2B-it-GGUF`](https://huggingface.co/unsloth/gemma-4-E2B-it-GGUF)
* **Pinned Commit SHA:** `90f9618340396838ee7ff5b0ba2da27da62953d3`
* **Canonical Recommended Artifact:** `gemma-4-E2B-it-Q4_K_M.gguf`
  - **Quantization:** 4-bit Medium (`Q4_K_M`).
  - **Exact File Size:** `3,344,000,000` bytes (~3.11 GB).
  - **SHA-256 Checksum:** `740185b21d22ceb83a11c3aa62ad5842ef32c70f6096d756bbee85a1e4ec34b8`.
  - **Direct Pinned URL:** `https://huggingface.co/unsloth/gemma-4-E2B-it-GGUF/resolve/90f9618340396838ee7ff5b0ba2da27da62953d3/gemma-4-E2B-it-Q4_K_M.gguf`.
* **High-Fidelity Alternative Artifact:** `gemma-4-E2B-it-Q8_0.gguf`
  - **Quantization:** 8-bit (`Q8_0`).
  - **Exact File Size:** ~5.05 GB (`5,420,000,000` bytes).
* **Multimodal Projector Verification:**
  - Artifact `mmproj-BF16.gguf` (~987 MB) exists in the repository.
  - **Verification for B6:** Our frozen B6 scope is strictly text-based on-device assistance (offline note summarization, keyword extraction, spot practical Q&A). **The multimodal projector is NOT required for B6 functionality.** We do not claim local camera/audio multimodal support.
* **Exact Licensing Evidence:**
  - **Hugging Face Repository License:** Tagged as **Apache License 2.0** (`apache-2.0`) in the model card metadata.
  - **Underlying Google Foundation Weights:** Governed by the **Gemma Open Model Terms of Use** (commercial use permitted, attribution required, standard use restrictions).
  - **Redistribution Terms:** Non-redistributable inside the closed APK; must be downloaded on-demand to the app cache upon user selection.

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

### 4.1 Status of D5 MethodChannel Methods (`com.innovotribe.locallens/native_ai`)

| Method Name | Arguments | Return Type / Map Keys | Real Implementation vs. Placeholder in D5 |
| :--- | :--- | :--- | :--- |
| `getAvailableDiskSpaceBytes` | None | `int` (bytes) | **REAL** (Uses Android `StatFs`) |
| `getNetworkStatus` | None | String (`WIFI`, `CELLULAR`, `ETHERNET`, `OFFLINE`) | **REAL** (Uses Android `ConnectivityManager`) |
| `checkAICoreAvailability` | None | `{ isAvailable, apiLevel, isSupportedDevice, aicorePackageInstalled, statusMessage }` | **PARTIAL** (Checks API >= 34 and package name; does not call ML Kit) |
| `getDeviceAICapabilities` | None | `{ hasNpu, ramAvailableMb, aicoreVersion, supportedFeatures, apiLevel, totalRamMb, aicoreInstalled }` | **PARTIAL** (Queries real RAM; returns mock supported features) |
| `getNativeAiStatus` | None | String (`UNSUPPORTED_DEVICE`, `AICORE_NOT_INSTALLED`, `MODEL_NOT_AVAILABLE`) | **PLACEHOLDER** (Static enum return) |
| `summarizeOfflineNote` | `{ noteText, spotName, language }` | `{ success: false, summary: "", keyHighlights: [], isLocalInference: false, modelUsed: "NONE", code: "MODEL_NOT_DOWNLOADED" }` | **UNASSISTED FALLBACK** (Does not execute neural model) |
| `extractOfflineKeywords` | `{ text }` | `{ success: false, keywords: [], isLocalInference: false, modelUsed: "NONE", code: "MODEL_NOT_DOWNLOADED" }` | **UNASSISTED FALLBACK** (Does not execute neural model) |
| `executeOfflineInference`| `{ prompt, engine }` | `{ success: false, isLocalInference: false, code: "MODEL_NOT_DOWNLOADED", engine }` | **UNASSISTED FALLBACK** (Does not execute neural model) |

* **Agreement Source:** D5 Task Baseline Commit `fec0fb1`, [docs/d5-offline-android-report.md](file:///d:/neighborhoodguideapp/docs/d5-offline-android-report.md), and [MainActivity.kt](file:///d:/neighborhoodguideapp/android/app/src/main/kotlin/com/innovotribe/locallens/MainActivity.kt#L55-L207).

---

## 5. Cloud and Offline Behavior

### 5.1 Client-to-Backend Cloud Fallback Flow
1. **Network Interrogation:** Host app calls `NativePlatformService.getNetworkStatus()`.
2. **If OFFLINE:** Cloud calls are strictly blocked. Host app executes deterministic unassisted heuristics locally.
3. **If ONLINE:** Client evaluates user consent (`userConsentCloudFallback`).
   - If user consent is **granted**: Client dispatches callable request to Firebase Cloud Functions (`AssistanceController.generateStreetGuidance`), executing `gemini-3.8-flash`. Response carries `provenance: 'CLOUD_FALLBACK'`, `isLocalInference: false`, `executionEnvironment: 'BACKEND_CLOUD_FUNCTIONS'`.
   - If user consent is **withheld**: Network call is suppressed; client returns unassisted fallback with `provenance: 'UNAVAILABLE'`.

### 5.2 Deterministic Heuristics (Unassisted Fallback)
* When on-device models are unready or offline, the engine executes deterministic sentence extraction and frequency-based keyword scoring.
* These heuristics are **strictly labeled as unassisted fallbacks**, never as neural or AI inference (`unassistedFallback: true`, `modelUsed: 'NONE (Unassisted Fallback)'`).

### 5.3 Test Evidence Distinction
* **TypeScript Spy Executor Test (Suite 4):** Validates unit-level fail-closed routing in TypeScript (zero invocations of `executeCloudModel` when `connectivity === 'OFFLINE'`).
* **Actual Application Network Isolation:** Must be validated on physical Android hardware by toggling Airplane Mode and inspecting Android network sockets.

---

## 6. Comprehensive Integration Status Matrix

| Component / Capability | Status | Exact Source Files | Evidence & Notes |
| :--- | :--- | :--- | :--- |
| **Gemini Nano Readiness API** | **AWAITING D** | `android/app/.../MainActivity.kt` | Reference implementation provided; D to add Gradle dependencies. |
| **Gemini Nano Inference** | **NOT TESTED** | Physical hardware | Requires physical Pixel 8/9 or Galaxy S24 with AICore weights. |
| **Gemini Nano Download / Setup** | **AWAITING D** | `android/app/.../MainActivity.kt` | Background Wi-Fi + charging download managed by Android system service. |
| **Gemma 4 E2B Artifact & License** | **IMPLEMENTED** | [local-ai-service.ts](file:///d:/neighborhoodguideapp/functions/src/ai/services/local-ai-service.ts), [models.ts](file:///d:/neighborhoodguideapp/functions/src/ai/config/models.ts) | Pinned commit `90f96183`, SHA-256 `740185b2...`, Apache 2.0 / Gemma Terms. |
| **Gemma Android Runtime & JNI** | **AWAITING D** | `android/app/src/main/jniLibs/arm64-v8a/` | Requires Android NDK 26+ CMake compilation of `libllama.so` and JNI wrapper. |
| **Gemma Download / Cache Manager** | **AWAITING D** | `lib/services/offline_model_manager.dart` | Client-side 3.11 GB resumable downloader with SHA-256 verification. |
| **Flutter-to-Kotlin Integration** | **IMPLEMENTED (by D)** | `MainActivity.kt` (lines 55–207), `native_platform_service.dart` (lines 91–355) | 6 reconciled methods implemented in D5 (`fec0fb1`); 26/26 Flutter tests pass. |
| **Cloud Fallback & Consent** | **IMPLEMENTED** | [local-ai-service.ts](file:///d:/neighborhoodguideapp/functions/src/ai/services/local-ai-service.ts), `model-orchestrator.ts` | Dispatches to `gemini-3.8-flash` only when online + consented; provenance tracked. |
| **Offline Privacy & Fallback** | **IMPLEMENTED** | [local-ai-service.ts](file:///d:/neighborhoodguideapp/functions/src/ai/services/local-ai-service.ts) | Fail-closed offline policy; deterministic unassisted heuristics. |
