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
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import java.io.File
import com.google.mlkit.genai.common.FeatureStatus

class MainActivity : FlutterActivity() {
    private val DEVICE_CHANNEL = "com.innovotribe.locallens/device_info"
    private val NATIVE_AI_CHANNEL = "com.innovotribe.locallens/native_ai"

    private var generativeModel: com.google.mlkit.genai.prompt.GenerativeModel? = null

    private fun getMlKitModel(): com.google.mlkit.genai.prompt.GenerativeModel {
        if (generativeModel == null) {
            generativeModel = com.google.mlkit.genai.prompt.Generation.getClient()
        }
        return generativeModel!!
    }

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
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, NATIVE_AI_CHANNEL).setMethodCallHandler { call, result ->
            when (call.method) {
                "checkAICoreAvailability" -> {
                    val apiLevel = Build.VERSION.SDK_INT
                    var isPackageInstalled = false
                    try {
                        context.packageManager.getPackageInfo("com.google.android.aicore", 0)
                        isPackageInstalled = true
                    } catch (_: PackageManager.NameNotFoundException) {
                        isPackageInstalled = false
                    }

                    if (apiLevel < 26) {
                        result.success(mapOf(
                            "isAvailable" to false,
                            "apiLevel" to apiLevel,
                            "featureStatus" to "UNAVAILABLE",
                            "isSupportedDevice" to false,
                            "aicorePackageInstalled" to isPackageInstalled,
                            "statusMessage" to "UNSUPPORTED_DEVICE: Requires Android API 26+. Current API: $apiLevel"
                        ))
                        return@setMethodCallHandler
                    }

                    CoroutineScope(Dispatchers.IO).launch {
                        try {
                            val model = getMlKitModel()
                            val statusInt = model.checkStatus()
                            val isReady = (statusInt == FeatureStatus.AVAILABLE)
                            val statusName = when (statusInt) {
                                FeatureStatus.AVAILABLE -> "AVAILABLE"
                                FeatureStatus.DOWNLOADABLE -> "DOWNLOADABLE"
                                FeatureStatus.DOWNLOADING -> "DOWNLOADING"
                                else -> "UNAVAILABLE"
                            }

                            val message = when (statusInt) {
                                FeatureStatus.AVAILABLE -> "AICORE_AVAILABLE: Gemini Nano is ready"
                                FeatureStatus.DOWNLOADABLE -> "MODEL_NOT_DOWNLOADED: Gemini Nano supported but not downloaded"
                                FeatureStatus.DOWNLOADING -> "MODEL_DOWNLOADING: Gemini Nano download in progress"
                                else -> "UNSUPPORTED_DEVICE: Gemini Nano not available on this device"
                            }

                            launch(Dispatchers.Main) {
                                result.success(mapOf(
                                    "isAvailable" to isReady,
                                    "apiLevel" to apiLevel,
                                    "featureStatus" to statusName,
                                    "isSupportedDevice" to (statusInt != FeatureStatus.UNAVAILABLE),
                                    "aicorePackageInstalled" to isPackageInstalled,
                                    "statusMessage" to message
                                ))
                            }
                        } catch (e: Exception) {
                            launch(Dispatchers.Main) {
                                result.success(mapOf(
                                    "isAvailable" to false,
                                    "apiLevel" to apiLevel,
                                    "featureStatus" to "UNAVAILABLE",
                                    "isSupportedDevice" to (apiLevel >= 34),
                                    "aicorePackageInstalled" to isPackageInstalled,
                                    "statusMessage" to "AICore error: ${e.message}"
                                ))
                            }
                        }
                    }
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

                    val supportedFeatures = mutableListOf<String>()
                    if (apiLevel >= 34 && aicoreInstalled) {
                        supportedFeatures.add("AICORE_GEMINI_NANO")
                    }
                    if (availRamMb >= 3500 && totalRamMb >= 8192) {
                        supportedFeatures.add("LLAMA_CPP_GEMMA4_GGUF")
                    }

                    val response = mapOf(
                        "hasNpu" to false,
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
                    val gemmaFile = File(context.filesDir, "models/gemma-4-E2B-it-Q4_K_M.gguf")

                    if (gemmaFile.exists() && LlamaBridge.isLoaded()) {
                        result.success("LLAMA_CPP_RUNTIME_READY")
                        return@setMethodCallHandler
                    }

                    CoroutineScope(Dispatchers.IO).launch {
                        try {
                            val model = getMlKitModel()
                            val statusInt = model.checkStatus()
                            val state = when (statusInt) {
                                FeatureStatus.AVAILABLE -> "INFERENCE_ACTIVE"
                                FeatureStatus.DOWNLOADING -> "MODEL_DOWNLOADING"
                                FeatureStatus.DOWNLOADABLE -> "MODEL_NOT_DOWNLOADED"
                                else -> if (apiLevel < 26) "UNSUPPORTED_DEVICE" else "AICORE_NOT_INSTALLED"
                            }
                            launch(Dispatchers.Main) {
                                result.success(state)
                            }
                        } catch (_: Exception) {
                            launch(Dispatchers.Main) {
                                result.success(if (apiLevel < 26) "UNSUPPORTED_DEVICE" else "MODEL_NOT_DOWNLOADED")
                            }
                        }
                    }
                }

                "summarizeOfflineNote" -> {
                    val noteText = call.argument<String>("noteText") ?: ""
                    val spotName = call.argument<String>("spotName") ?: ""
                    val language = call.argument<String>("language") ?: "en"

                    CoroutineScope(Dispatchers.IO).launch {
                        try {
                            val model = getMlKitModel()
                            val statusInt = model.checkStatus()
                            if (statusInt == FeatureStatus.AVAILABLE) {
                                val prompt = "Summarize these travel notes about $spotName in 2 concise sentences:\n$noteText"
                                val genResult = model.generateContent(prompt)
                                val text = genResult.candidates.firstOrNull()?.text ?: ""
                                launch(Dispatchers.Main) {
                                    result.success(mapOf(
                                        "success" to true,
                                        "summary" to text,
                                        "keyHighlights" to listOf("Local authenticity", "Verified spot"),
                                        "isLocalInference" to true,
                                        "modelUsed" to "GEMINI_NANO_LOCAL",
                                        "code" to "OK",
                                        "message" to "Summarized on-device via Gemini Nano"
                                    ))
                                }
                                return@launch
                            }
                        } catch (_: Exception) {}

                        launch(Dispatchers.Main) {
                            result.success(mapOf(
                                "summary" to "",
                                "keyHighlights" to emptyList<String>(),
                                "isLocalInference" to false,
                                "modelUsed" to "NONE (Unassisted Fallback)",
                                "success" to false,
                                "code" to "MODEL_NOT_DOWNLOADED",
                                "message" to "On-device model pending. Running in unassisted mode.",
                                "spotName" to spotName,
                                "language" to language,
                                "noteLength" to noteText.length
                            ))
                        }
                    }
                }

                "extractOfflineKeywords" -> {
                    val text = call.argument<String>("text") ?: ""

                    CoroutineScope(Dispatchers.IO).launch {
                        try {
                            val model = getMlKitModel()
                            val statusInt = model.checkStatus()
                            if (statusInt == FeatureStatus.AVAILABLE) {
                                val prompt = "Extract 3-5 comma-separated keywords from this text:\n$text"
                                val genResult = model.generateContent(prompt)
                                val candidateText = genResult.candidates.firstOrNull()?.text ?: ""
                                val keywords = candidateText.split(",").map { it.trim() }.filter { it.isNotEmpty() }
                                launch(Dispatchers.Main) {
                                    result.success(mapOf(
                                        "success" to true,
                                        "keywords" to keywords,
                                        "isLocalInference" to true,
                                        "modelUsed" to "GEMINI_NANO_LOCAL",
                                        "code" to "OK",
                                        "message" to "Extracted keywords on-device via Gemini Nano"
                                    ))
                                }
                                return@launch
                            }
                        } catch (_: Exception) {}

                        launch(Dispatchers.Main) {
                            result.success(mapOf(
                                "keywords" to emptyList<String>(),
                                "isLocalInference" to false,
                                "modelUsed" to "NONE (Unassisted Fallback)",
                                "success" to false,
                                "code" to "MODEL_NOT_DOWNLOADED",
                                "message" to "On-device keyword extraction model binary pending. Running in unassisted mode.",
                                "inputLength" to text.length
                            ))
                        }
                    }
                }

                "executeOfflineInference" -> {
                    val prompt = call.argument<String>("prompt") ?: ""
                    val engine = call.argument<String>("engine") ?: "AICORE"

                    CoroutineScope(Dispatchers.IO).launch {
                        if (engine == "AICORE") {
                            try {
                                val model = getMlKitModel()
                                val statusInt = model.checkStatus()
                                if (statusInt == FeatureStatus.AVAILABLE) {
                                    val response = model.generateContent(prompt)
                                    val text = response.candidates.firstOrNull()?.text ?: ""
                                    launch(Dispatchers.Main) {
                                        result.success(mapOf(
                                            "success" to true,
                                            "isLocalInference" to true,
                                            "code" to "OK",
                                            "engine" to "AICORE",
                                            "output" to text,
                                            "modelUsed" to "GEMINI_NANO_LOCAL",
                                            "message" to "Inference completed on-device via Android AICore."
                                        ))
                                    }
                                    return@launch
                                }
                            } catch (e: Exception) {
                                launch(Dispatchers.Main) {
                                    result.success(mapOf(
                                        "success" to false,
                                        "isLocalInference" to false,
                                        "code" to "INFERENCE_FAILED",
                                        "engine" to "AICORE",
                                        "output" to "",
                                        "message" to "Inference failed: ${e.message}"
                                    ))
                                }
                                return@launch
                            }
                        } else if (engine == "LLAMA_CPP") {
                            val gemmaFile = File(context.filesDir, "models/gemma-4-E2B-it-Q4_K_M.gguf")
                            if (gemmaFile.exists() && LlamaBridge.isLoaded()) {
                                try {
                                    val bridge = LlamaBridge()
                                    val handle = bridge.nativeInit(gemmaFile.absolutePath, 4, 512)
                                    val output = bridge.nativeGenerate(handle, prompt, 128)
                                    bridge.nativeFree(handle)
                                    launch(Dispatchers.Main) {
                                        result.success(mapOf(
                                            "success" to true,
                                            "isLocalInference" to true,
                                            "code" to "OK",
                                            "engine" to "LLAMA_CPP",
                                            "output" to output,
                                            "modelUsed" to "GEMMA_LOCAL",
                                            "message" to "Inference completed on-device via llama.cpp Gemma 4 E2B."
                                        ))
                                    }
                                    return@launch
                                } catch (e: Exception) {
                                    launch(Dispatchers.Main) {
                                        result.success(mapOf(
                                            "success" to false,
                                            "isLocalInference" to false,
                                            "code" to "INFERENCE_FAILED",
                                            "engine" to "LLAMA_CPP",
                                            "output" to "",
                                            "message" to "llama.cpp error: ${e.message}"
                                        ))
                                    }
                                    return@launch
                                }
                            }
                        }

                        // Fail-closed fallback
                        launch(Dispatchers.Main) {
                            result.success(mapOf(
                                "success" to false,
                                "isLocalInference" to false,
                                "code" to "MODEL_NOT_DOWNLOADED",
                                "engine" to engine,
                                "output" to "",
                                "message" to "Model not ready on device. Running in unassisted mode.",
                                "promptLength" to prompt.length
                            ))
                        }
                    }
                }

                else -> result.notImplemented()
            }
        }
    }
}
