package com.innovotribe.locallens

import android.app.ActivityManager
import android.content.Context
import android.content.pm.PackageManager
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.Build
import android.os.StatFs
import androidx.annotation.NonNull
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

class MainActivity : FlutterActivity() {
    private val DEVICE_CHANNEL = "com.innovotribe.locallens/device_info"
    private val NATIVE_AI_CHANNEL = "com.innovotribe.locallens/native_ai"

    override fun configureFlutterEngine(@NonNull flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)

        // 1. Device Info & Storage Channel
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, DEVICE_CHANNEL).setMethodCallHandler { call, result ->
            when (call.method) {
                "getAvailableDiskSpaceBytes" -> {
                    try {
                        val statFs = StatFs(context.filesDir.absolutePath)
                        val availableBytes = statFs.availableBytes
                        result.success(availableBytes)
                    } catch (e: Exception) {
                        result.error("STORAGE_ERROR", e.message, null)
                    }
                }
                "getNetworkStatus" -> {
                    try {
                        val connectivityManager = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
                        val activeNetwork = connectivityManager.activeNetwork
                        val capabilities = connectivityManager.getNetworkCapabilities(activeNetwork)
                        val status = when {
                            capabilities == null -> "OFFLINE"
                            capabilities.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) -> "WIFI"
                            capabilities.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) -> "CELLULAR"
                            capabilities.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET) -> "ETHERNET"
                            else -> "CONNECTED"
                        }
                        result.success(status)
                    } catch (e: Exception) {
                        result.error("NETWORK_ERROR", e.message, null)
                    }
                }
                else -> result.notImplemented()
            }
        }

        // 2. Native AI Bridge Channel (Domain: On-Device AI / B6 integration)
        // Architecture:
        // - Gemini Nano: Android AICore / ML Kit GenAI (API 34+)
        // - Gemma 4 E2B: Unsloth GGUF model via llama.cpp Android native runtime
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, NATIVE_AI_CHANNEL).setMethodCallHandler { call, result ->
            when (call.method) {
                "checkAICoreAvailability" -> {
                    val apiLevel = Build.VERSION.SDK_INT
                    val isSupportedApi = apiLevel >= 34 // Android 14+ requirement
                    var isPackageInstalled = false
                    try {
                        context.packageManager.getPackageInfo("com.google.android.aicore", 0)
                        isPackageInstalled = true
                    } catch (_: PackageManager.NameNotFoundException) {
                        isPackageInstalled = false
                    }

                    val isAvailable = isSupportedApi && isPackageInstalled
                    val statusMessage = when {
                        !isSupportedApi -> "UNSUPPORTED_DEVICE: Requires Android 14+ (API 34+). Current API: $apiLevel"
                        !isPackageInstalled -> "AICORE_NOT_INSTALLED: com.google.android.aicore package not present on device"
                        else -> "AICORE_AVAILABLE: Android AICore system service detected"
                    }

                    val response = mapOf(
                        "isAvailable" to isAvailable,
                        "apiLevel" to apiLevel,
                        "isSupportedDevice" to isSupportedApi,
                        "aicorePackageInstalled" to isPackageInstalled,
                        "statusMessage" to statusMessage
                    )
                    result.success(response)
                }

                "getDeviceAICapabilities" -> {
                    val actManager = context.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
                    val memInfo = ActivityManager.MemoryInfo()
                    actManager.getMemoryInfo(memInfo)

                    val availRamMb = memInfo.availMem / (1024 * 1024)
                    val totalRamMb = memInfo.totalMem / (1024 * 1024)
                    val apiLevel = Build.VERSION.SDK_INT

                    var aicoreInstalled = false
                    var aicoreVersion = 0
                    try {
                        val pInfo = context.packageManager.getPackageInfo("com.google.android.aicore", 0)
                        aicoreInstalled = true
                        aicoreVersion = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                            pInfo.longVersionCode.toInt()
                        } else {
                            @Suppress("DEPRECATION")
                            pInfo.versionCode
                        }
                    } catch (_: Exception) {}

                    // Frozen architectures supported in spec
                    val supportedFeatures = mutableListOf<String>()
                    if (apiLevel >= 34 && aicoreInstalled) {
                        supportedFeatures.add("AICORE_GEMINI_NANO")
                    }
                    if (totalRamMb >= 3000) {
                        // llama.cpp Unsloth GGUF edge execution boundary
                        supportedFeatures.add("LLAMA_CPP_GEMMA4_GGUF")
                    }

                    // Restored originally agreed B6 schema with honest unavailable/unknown handling
                    val response = mapOf(
                        "hasNpu" to false, // Honest handling: Standard Android SDK lacks public NPU API without vendor proprietary HAL
                        "ramAvailableMb" to availRamMb,
                        "aicoreVersion" to aicoreVersion,
                        "supportedFeatures" to supportedFeatures,
                        "apiLevel" to apiLevel,
                        "totalRamMb" to totalRamMb,
                        "aicoreInstalled" to aicoreInstalled
                    )
                    result.success(response)
                }

                "getNativeAiStatus" -> {
                    val apiLevel = Build.VERSION.SDK_INT
                    var aicoreInstalled = false
                    try {
                        context.packageManager.getPackageInfo("com.google.android.aicore", 0)
                        aicoreInstalled = true
                    } catch (_: Exception) {}

                    val state = when {
                        apiLevel < 34 -> "UNSUPPORTED_DEVICE"
                        !aicoreInstalled -> "AICORE_NOT_INSTALLED"
                        else -> "MODEL_NOT_AVAILABLE" // Model binary not downloaded to device cache yet
                    }
                    result.success(state)
                }

                "summarizeOfflineNote" -> {
                    val noteText = call.argument<String>("noteText") ?: ""
                    val spotName = call.argument<String>("spotName") ?: ""
                    val language = call.argument<String>("language") ?: "en"

                    // Contract with Developer B: Returns structured unassisted response with modelUsed
                    val response = mapOf(
                        "summary" to "",
                        "keyHighlights" to emptyList<String>(),
                        "isLocalInference" to false,
                        "modelUsed" to "NONE (Unassisted Fallback)",
                        "success" to false,
                        "code" to "MODEL_NOT_DOWNLOADED",
                        "message" to "On-device model for note summarization pending from Developer B (Gemma 4 GGUF/llama.cpp or AICore). Running in unassisted mode.",
                        "spotName" to spotName,
                        "language" to language,
                        "noteLength" to noteText.length
                    )
                    result.success(response)
                }

                "extractOfflineKeywords" -> {
                    val text = call.argument<String>("text") ?: ""

                    // Contract with Developer B: Returns structured unassisted response with modelUsed
                    val response = mapOf(
                        "keywords" to emptyList<String>(),
                        "isLocalInference" to false,
                        "modelUsed" to "NONE (Unassisted Fallback)",
                        "success" to false,
                        "code" to "MODEL_NOT_DOWNLOADED",
                        "message" to "On-device keyword extraction model binary pending from Developer B. Running in unassisted mode.",
                        "inputLength" to text.length
                    )
                    result.success(response)
                }

                "executeOfflineInference" -> {
                    val prompt = call.argument<String>("prompt") ?: ""
                    val engine = call.argument<String>("engine") ?: "AICORE"

                    // Strict contract: Never claim inference succeeded unless actual local inference runs.
                    // Models and inference execution are owned by Developer B.
                    // Developer D provides the verified platform detection, parameters, and boundary.
                    val failureResponse = mapOf(
                        "success" to false,
                        "isLocalInference" to false,
                        "code" to "MODEL_NOT_DOWNLOADED",
                        "engine" to engine,
                        "message" to "On-device model binary for $engine is pending download from AICore/Developer B. Running in unassisted mode.",
                        "promptLength" to prompt.length
                    )
                    result.success(failureResponse)
                }

                else -> result.notImplemented()
            }
        }
    }
}
