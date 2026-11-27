package com.innovotribe.locallens

import android.app.ActivityManager
import android.content.Context
import android.content.pm.PackageManager
import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioTrack
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.Build
import android.os.StatFs
import androidx.annotation.NonNull
import com.google.mlkit.genai.common.FeatureStatus
import com.google.mlkit.genai.prompt.Generation
import com.google.mlkit.genai.prompt.GenerativeModel
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import java.io.File

class MainActivity : FlutterActivity() {

    private val DEVICE_CHANNEL = "com.innovotribe.locallens/device_info"
    private val NATIVE_AI_CHANNEL = "com.innovotribe.locallens/native_ai"
    private val PCM_AUDIO_CHANNEL = "com.innovotribe.locallens/pcm_audio"
    private val EDGE_AI_CHANNEL = "com.innovotribe.locallens/edge_ai"

    private var generativeModel: GenerativeModel? = null
    private var pcmAudioTrack: AudioTrack? = null
    private val pcmAudioLock = Any()

    private fun startPcmAudioTrack(sampleRate: Int) {
        synchronized(pcmAudioLock) {
            stopPcmAudioTrackLocked()
            val minBuffer = AudioTrack.getMinBufferSize(
                sampleRate,
                AudioFormat.CHANNEL_OUT_MONO,
                AudioFormat.ENCODING_PCM_16BIT
            ).coerceAtLeast(sampleRate / 5)

            val track = AudioTrack.Builder()
                .setAudioAttributes(
                    AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_MEDIA)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                        .build()
                )
                .setAudioFormat(
                    AudioFormat.Builder()
                        .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                        .setSampleRate(sampleRate)
                        .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
                        .build()
                )
                .setBufferSizeInBytes(minBuffer * 2)
                .setTransferMode(AudioTrack.MODE_STREAM)
                .build()

            track.play()
            pcmAudioTrack = track
        }
    }

    private fun writePcmAudioChunk(pcmBytes: ByteArray): Int {
        synchronized(pcmAudioLock) {
            val track = pcmAudioTrack ?: return 0
            return track.write(pcmBytes, 0, pcmBytes.size, AudioTrack.WRITE_BLOCKING)
        }
    }

    private fun stopPcmAudioTrackLocked() {
        val track = pcmAudioTrack ?: return
        try {
            if (track.playState == AudioTrack.PLAYSTATE_PLAYING) {
                track.pause()
                track.flush()
            }
            track.stop()
        } catch (_: Exception) {
            // Safe teardown
        } finally {
            try {
                track.release()
            } catch (_: Exception) {
            }
            pcmAudioTrack = null
        }
    }

    override fun onDestroy() {
        synchronized(pcmAudioLock) {
            stopPcmAudioTrackLocked()
        }
        GemmaEdgeRuntime.close()
        super.onDestroy()
    }

    private fun getMlKitModel(): GenerativeModel {
        if (generativeModel == null) {
            generativeModel = Generation.getClient()
        }
        return generativeModel!!
    }

    /**
     * Discovers on-device Gemma 4 E2B bundles across LiteRT-LM (.litertlm) and legacy GGUF formats.
     */
    private fun getGemmaModelFile(customPath: String? = null): File {
        if (!customPath.isNullOrBlank()) {
            return File(customPath)
        }

        val modelsDirectory = File(context.filesDir, "models")

        val litertFile = File(modelsDirectory, "gemma-4-E2B-it.litertlm")
        val litertShort = File(modelsDirectory, "gemma-4-e2b.litertlm")
        val preferredFile = File(modelsDirectory, "gemma-4-e2b.gguf")
        val legacyFile = File(modelsDirectory, "gemma-4-E2B-it-Q4_K_M.gguf")

        return when {
            litertFile.exists() && litertFile.length() > 0 -> litertFile
            litertShort.exists() && litertShort.length() > 0 -> litertShort
            preferredFile.exists() && preferredFile.length() > 0 -> preferredFile
            legacyFile.exists() && legacyFile.length() > 0 -> legacyFile
            else -> litertFile
        }
    }

    private fun isAICoreInstalled(): Boolean {
        return try {
            context.packageManager.getPackageInfo(
                "com.google.android.aicore",
                0
            )
            true
        } catch (_: Exception) {
            false
        }
    }

    override fun configureFlutterEngine(@NonNull flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)

        // ---------------------------------------------------------
        // 1. DEVICE INFORMATION AND STORAGE CHANNEL
        // ---------------------------------------------------------

        MethodChannel(
            flutterEngine.dartExecutor.binaryMessenger,
            DEVICE_CHANNEL
        ).setMethodCallHandler { call, result ->

            when (call.method) {

                "getAvailableDiskSpaceBytes" -> {
                    try {
                        val statFs = StatFs(context.filesDir.absolutePath)
                        result.success(statFs.availableBytes)
                    } catch (e: Exception) {
                        result.error("STORAGE_ERROR", e.message, null)
                    }
                }

                "getNetworkStatus" -> {
                    try {
                        val connectivityManager =
                            context.getSystemService(Context.CONNECTIVITY_SERVICE)
                                    as ConnectivityManager

                        val activeNetwork = connectivityManager.activeNetwork
                        val capabilities =
                            connectivityManager.getNetworkCapabilities(activeNetwork)

                        val status = when {
                            capabilities == null -> "OFFLINE"

                            capabilities.hasTransport(
                                NetworkCapabilities.TRANSPORT_WIFI
                            ) -> "WIFI"

                            capabilities.hasTransport(
                                NetworkCapabilities.TRANSPORT_CELLULAR
                            ) -> "CELLULAR"

                            capabilities.hasTransport(
                                NetworkCapabilities.TRANSPORT_ETHERNET
                            ) -> "ETHERNET"

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

        // ---------------------------------------------------------
        // 2. NATIVE AI BRIDGE
        // ---------------------------------------------------------

        MethodChannel(
            flutterEngine.dartExecutor.binaryMessenger,
            NATIVE_AI_CHANNEL
        ).setMethodCallHandler { call, result ->

            when (call.method) {

                // -------------------------------------------------
                // A. GEMINI NANO / AICORE AVAILABILITY
                // -------------------------------------------------

                "checkAICoreAvailability" -> {

                    val apiLevel = Build.VERSION.SDK_INT
                    val aicoreInstalled = isAICoreInstalled()

                    if (apiLevel < 34) {
                        result.success(
                            mapOf(
                                "isAvailable" to false,
                                "apiLevel" to apiLevel,
                                "featureStatus" to "UNAVAILABLE",
                                "isSupportedDevice" to false,
                                "aicorePackageInstalled" to aicoreInstalled,
                                "statusMessage" to
                                    "UNSUPPORTED_DEVICE: Gemini Nano requires Android API 34+."
                            )
                        )
                        return@setMethodCallHandler
                    }

                    CoroutineScope(Dispatchers.IO).launch {

                        try {
                            val model = getMlKitModel()
                            val statusInt = model.checkStatus()

                            val isReady =
                                statusInt == FeatureStatus.AVAILABLE

                            val statusName = when (statusInt) {
                                FeatureStatus.AVAILABLE -> "AVAILABLE"
                                FeatureStatus.DOWNLOADABLE -> "DOWNLOADABLE"
                                FeatureStatus.DOWNLOADING -> "DOWNLOADING"
                                else -> "UNAVAILABLE"
                            }

                            val message = when (statusInt) {
                                FeatureStatus.AVAILABLE ->
                                    "AICORE_AVAILABLE: Gemini Nano is ready."

                                FeatureStatus.DOWNLOADABLE ->
                                    "MODEL_NOT_DOWNLOADED: Gemini Nano is supported but not downloaded."

                                FeatureStatus.DOWNLOADING ->
                                    "MODEL_DOWNLOADING: Gemini Nano download is in progress."

                                else ->
                                    "AICORE_UNAVAILABLE: Gemini Nano is not currently available."
                            }

                            launch(Dispatchers.Main) {
                                result.success(
                                    mapOf(
                                        "isAvailable" to isReady,
                                        "apiLevel" to apiLevel,
                                        "featureStatus" to statusName,
                                        "isSupportedDevice" to
                                            (statusInt != FeatureStatus.UNAVAILABLE),
                                        "aicorePackageInstalled" to aicoreInstalled,
                                        "statusMessage" to message
                                    )
                                )
                            }

                        } catch (e: Exception) {

                            launch(Dispatchers.Main) {
                                result.success(
                                    mapOf(
                                        "isAvailable" to false,
                                        "apiLevel" to apiLevel,
                                        "featureStatus" to "UNAVAILABLE",
                                        "isSupportedDevice" to false,
                                        "aicorePackageInstalled" to aicoreInstalled,
                                        "statusMessage" to
                                            "AICore error: ${e.message}"
                                    )
                                )
                            }
                        }
                    }
                }

                // -------------------------------------------------
                // B. DEVICE CAPABILITIES
                // -------------------------------------------------

                "getDeviceAICapabilities" -> {

                    val activityManager =
                        context.getSystemService(Context.ACTIVITY_SERVICE)
                                as ActivityManager

                    val memoryInfo = ActivityManager.MemoryInfo()
                    activityManager.getMemoryInfo(memoryInfo)

                    val availableRamMb =
                        memoryInfo.availMem / (1024 * 1024)

                    val totalRamMb =
                        memoryInfo.totalMem / (1024 * 1024)

                    val apiLevel = Build.VERSION.SDK_INT

                    var aicoreVersion = 0

                    try {
                        val packageInfo =
                            context.packageManager.getPackageInfo(
                                "com.google.android.aicore",
                                0
                            )

                        aicoreVersion =
                            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                                packageInfo.longVersionCode.toInt()
                            } else {
                                @Suppress("DEPRECATION")
                                packageInfo.versionCode
                            }

                    } catch (_: Exception) {
                        // AICore is not installed.
                    }

                    val aicoreInstalled = isAICoreInstalled()

                    val supportedFeatures = mutableListOf<String>()

                    if (apiLevel >= 34 && aicoreInstalled) {
                        supportedFeatures.add("AICORE_GEMINI_NANO")
                    }

                    // This is a hardware eligibility estimate, not proof
                    // that the GGUF runtime or model is installed.
                    if (availableRamMb >= 3500 && totalRamMb >= 8192) {
                        supportedFeatures.add("LLAMA_CPP_GEMMA4_GGUF")
                    }

                    result.success(
                        mapOf(
                            "hasNpu" to false,
                            "ramAvailableMb" to availableRamMb,
                            "aicoreVersion" to aicoreVersion,
                            "supportedFeatures" to supportedFeatures,
                            "apiLevel" to apiLevel,
                            "totalRamMb" to totalRamMb,
                            "aicoreInstalled" to aicoreInstalled
                        )
                    )
                }

                // -------------------------------------------------
                // C. NATIVE AI STATUS
                // -------------------------------------------------

                "getNativeAiStatus" -> {

                    val apiLevel = Build.VERSION.SDK_INT

                    val customPath = call.argument<String>("modelPath")
                    val gemmaFile = getGemmaModelFile(customPath)

                    val gemmaFilePresent =
                        gemmaFile.exists() && gemmaFile.length() > 0

                    if (gemmaFilePresent && LlamaBridge.isLoaded()) {
                        result.success("LLAMA_CPP_RUNTIME_READY")
                        return@setMethodCallHandler
                    }

                    if (gemmaFilePresent) {
                        result.success("GEMMA_MODEL_FILE_PRESENT")
                        return@setMethodCallHandler
                    }

                    if (apiLevel < 34) {
                        result.success("UNSUPPORTED_DEVICE")
                        return@setMethodCallHandler
                    }

                    CoroutineScope(Dispatchers.IO).launch {

                        try {
                            val model = getMlKitModel()
                            val statusInt = model.checkStatus()

                            val state = when (statusInt) {
                                FeatureStatus.AVAILABLE ->
                                    "INFERENCE_ACTIVE"

                                FeatureStatus.DOWNLOADING ->
                                    "MODEL_DOWNLOADING"

                                FeatureStatus.DOWNLOADABLE ->
                                    "MODEL_NOT_DOWNLOADED"

                                else ->
                                    "AICORE_NOT_INSTALLED"
                            }

                            launch(Dispatchers.Main) {
                                result.success(state)
                            }

                        } catch (_: Exception) {

                            launch(Dispatchers.Main) {
                                result.success("MODEL_NOT_AVAILABLE")
                            }
                        }
                    }
                }

                // -------------------------------------------------
                // D. MODEL PROVISIONING STATUS
                // -------------------------------------------------

                "checkModelProvisioning" -> {

                    val engine =
                        call.argument<String>("engine") ?: "GEMMA_GGUF"

                    val gemmaFile = getGemmaModelFile()

                    val gemmaFilePresent =
                        gemmaFile.exists() && gemmaFile.length() > 0

                    val aicoreInstalled = isAICoreInstalled()
                    val apiLevel = Build.VERSION.SDK_INT

                    result.success(
                        mapOf(
                            "engine" to engine,
                            "gemmaModelDownloaded" to gemmaFilePresent,
                            "gemmaModelPath" to
                                if (gemmaFilePresent) gemmaFile.absolutePath else null,
                            "gemmaSizeBytes" to
                                if (gemmaFilePresent) gemmaFile.length() else 0L,
                            "aicoreInstalled" to aicoreInstalled,
                            "apiLevel" to apiLevel,

                            // Provisioning status only.
                            // This does not claim successful inference.
                            "isProvisioned" to when (engine) {
                                "AICORE", "GEMINI_NANO" ->
                                    aicoreInstalled && apiLevel >= 34

                                "GEMMA_GGUF", "LLAMA_CPP_GGUF",
                                "GEMMA", "LLAMA_CPP" ->
                                    gemmaFilePresent

                                else -> false
                            }
                        )
                    )
                }

                // -------------------------------------------------
                // E. OFFLINE NOTE SUMMARIZATION
                // -------------------------------------------------

                "summarizeOfflineNote" -> {

                    val noteText =
                        call.argument<String>("noteText") ?: ""

                    val spotName =
                        call.argument<String>("spotName") ?: ""

                    val language =
                        call.argument<String>("language") ?: "en"

                    if (noteText.isBlank()) {
                        result.success(
                            mapOf(
                                "success" to false,
                                "summary" to "",
                                "keyHighlights" to emptyList<String>(),
                                "isLocalInference" to false,
                                "modelUsed" to "NONE",
                                "code" to "EMPTY_INPUT",
                                "message" to "No note text was provided."
                            )
                        )
                        return@setMethodCallHandler
                    }

                    CoroutineScope(Dispatchers.IO).launch {

                        try {
                            val model = getMlKitModel()
                            val statusInt = model.checkStatus()

                            if (statusInt == FeatureStatus.AVAILABLE) {

                                val prompt =
                                    "Summarize these travel notes about $spotName " +
                                    "in 2 concise sentences. " +
                                    "Use language code $language:\n$noteText"

                                val generatedResult =
                                    model.generateContent(prompt)

                                val generatedText =
                                    generatedResult.candidates
                                        .firstOrNull()
                                        ?.text
                                        ?: ""

                                if (generatedText.isNotBlank()) {

                                    launch(Dispatchers.Main) {
                                        result.success(
                                            mapOf(
                                                "success" to true,
                                                "summary" to generatedText,
                                                "keyHighlights" to emptyList<String>(),
                                                "isLocalInference" to true,
                                                "modelUsed" to "GEMINI_NANO_LOCAL",
                                                "engine" to "AICORE",
                                                "code" to "OK",
                                                "message" to
                                                    "Summarized on-device via Gemini Nano."
                                            )
                                        )
                                    }

                                    return@launch
                                }
                            }

                        } catch (_: Exception) {
                            // Return an explicit failure below.
                        }

                        launch(Dispatchers.Main) {
                            result.success(
                                mapOf(
                                    "success" to false,
                                    "summary" to "",
                                    "keyHighlights" to emptyList<String>(),
                                    "isLocalInference" to false,
                                    "modelUsed" to "NONE",
                                    "code" to "MODEL_NOT_DOWNLOADED",
                                    "message" to
                                        "On-device model unavailable. Running in unassisted mode.",
                                    "spotName" to spotName,
                                    "language" to language,
                                    "noteLength" to noteText.length
                                )
                            )
                        }
                    }
                }

                // -------------------------------------------------
                // F. OFFLINE KEYWORD EXTRACTION
                // -------------------------------------------------

                "extractOfflineKeywords" -> {

                    val text = call.argument<String>("text") ?: ""

                    if (text.isBlank()) {
                        result.success(
                            mapOf(
                                "success" to false,
                                "keywords" to emptyList<String>(),
                                "isLocalInference" to false,
                                "modelUsed" to "NONE",
                                "code" to "EMPTY_INPUT"
                            )
                        )
                        return@setMethodCallHandler
                    }

                    CoroutineScope(Dispatchers.IO).launch {

                        try {
                            val model = getMlKitModel()
                            val statusInt = model.checkStatus()

                            if (statusInt == FeatureStatus.AVAILABLE) {

                                val prompt =
                                    "Extract 3-5 important keywords from this text. " +
                                    "Return only comma-separated keywords:\n$text"

                                val generatedResult =
                                    model.generateContent(prompt)

                                val candidateText =
                                    generatedResult.candidates
                                        .firstOrNull()
                                        ?.text
                                        ?: ""

                                val keywords = candidateText
                                    .split(",")
                                    .map { it.trim() }
                                    .filter { it.isNotEmpty() }
                                    .distinct()
                                    .take(5)

                                if (keywords.isNotEmpty()) {

                                    launch(Dispatchers.Main) {
                                        result.success(
                                            mapOf(
                                                "success" to true,
                                                "keywords" to keywords,
                                                "isLocalInference" to true,
                                                "modelUsed" to "GEMINI_NANO_LOCAL",
                                                "engine" to "AICORE",
                                                "code" to "OK",
                                                "message" to
                                                    "Extracted keywords on-device via Gemini Nano."
                                            )
                                        )
                                    }

                                    return@launch
                                }
                            }

                        } catch (_: Exception) {
                            // Return an explicit failure below.
                        }

                        launch(Dispatchers.Main) {
                            result.success(
                                mapOf(
                                    "success" to false,
                                    "keywords" to emptyList<String>(),
                                    "isLocalInference" to false,
                                    "modelUsed" to "NONE",
                                    "code" to "MODEL_NOT_DOWNLOADED",
                                    "message" to
                                        "On-device keyword extraction is unavailable.",
                                    "inputLength" to text.length
                                )
                            )
                        }
                    }
                }

                // -------------------------------------------------
                // G. GENERIC ON-DEVICE INFERENCE
                // -------------------------------------------------

                "executeOfflineInference" -> {

                    val prompt =
                        call.argument<String>("prompt") ?: ""

                    val engine =
                        call.argument<String>("engine") ?: "AICORE"

                    val customPath =
                        call.argument<String>("modelPath")

                    if (prompt.isBlank()) {
                        result.success(
                            mapOf(
                                "success" to false,
                                "isLocalInference" to false,
                                "code" to "EMPTY_PROMPT",
                                "engine" to engine,
                                "output" to ""
                            )
                        )
                        return@setMethodCallHandler
                    }

                    CoroutineScope(Dispatchers.IO).launch {

                        // -----------------------------------------
                        // GEMINI NANO / AICORE
                        // -----------------------------------------

                        if (
                            engine == "AICORE" ||
                            engine == "GEMINI_NANO"
                        ) {

                            try {
                                if (Build.VERSION.SDK_INT < 34) {
                                    throw IllegalStateException(
                                        "Gemini Nano requires Android API 34+."
                                    )
                                }

                                val model = getMlKitModel()
                                val statusInt = model.checkStatus()

                                if (statusInt != FeatureStatus.AVAILABLE) {
                                    throw IllegalStateException(
                                        "Gemini Nano model is not available. Status: $statusInt"
                                    )
                                }

                                val generatedResult =
                                    model.generateContent(prompt)

                                val output =
                                    generatedResult.candidates
                                        .firstOrNull()
                                        ?.text
                                        ?: ""

                                if (output.isBlank()) {
                                    throw IllegalStateException(
                                        "Gemini Nano returned empty output."
                                    )
                                }

                                launch(Dispatchers.Main) {
                                    result.success(
                                        mapOf(
                                            "success" to true,
                                            "isLocalInference" to true,
                                            "code" to "OK",
                                            "engine" to "AICORE",
                                            "output" to output,
                                            "modelUsed" to "GEMINI_NANO_LOCAL",
                                            "message" to
                                                "Inference completed on-device via Android AICore."
                                        )
                                    )
                                }

                                return@launch

                            } catch (e: Exception) {

                                launch(Dispatchers.Main) {
                                    result.success(
                                        mapOf(
                                            "success" to false,
                                            "isLocalInference" to false,
                                            "code" to "INFERENCE_FAILED",
                                            "engine" to "AICORE",
                                            "output" to "",
                                            "message" to
                                                "Gemini Nano inference failed: ${e.message}"
                                        )
                                    )
                                }

                                return@launch
                            }
                        }

                        // -----------------------------------------
                        // GEMMA 4 E2B / LLAMA.CPP
                        // -----------------------------------------

                        if (
                            engine == "LLAMA_CPP" ||
                            engine == "GEMMA_GGUF" ||
                            engine == "LLAMA_CPP_GGUF" ||
                            engine == "GEMMA"
                        ) {

                            val gemmaFile =
                                getGemmaModelFile(customPath)

                            if (
                                !gemmaFile.exists() ||
                                gemmaFile.length() <= 0
                            ) {
                                launch(Dispatchers.Main) {
                                    result.success(
                                        mapOf(
                                            "success" to false,
                                            "isLocalInference" to false,
                                            "code" to "MODEL_NOT_DOWNLOADED",
                                            "engine" to engine,
                                            "output" to "",
                                            "message" to
                                                "Gemma GGUF model file not found or empty. Provisioning required.",
                                            "modelPath" to gemmaFile.absolutePath
                                        )
                                    )
                                }

                                return@launch
                            }

                            var bridge: LlamaBridge? = null
                            var handle: Long? = null

                            try {
                                if (!LlamaBridge.isLoaded()) {
                                    throw IllegalStateException(
                                        "llama.cpp native runtime is not loaded."
                                    )
                                }

                                bridge = LlamaBridge()

                                handle = bridge.nativeInit(
                                    gemmaFile.absolutePath,
                                    4,
                                    512
                                )

                                val output = bridge.nativeGenerate(
                                    handle,
                                    prompt,
                                    128
                                )

                                if (output.isBlank()) {
                                    throw IllegalStateException(
                                        "llama.cpp returned empty output."
                                    )
                                }

                                launch(Dispatchers.Main) {
                                    result.success(
                                        mapOf(
                                            "success" to true,
                                            "isLocalInference" to true,
                                            "code" to "OK",
                                            "engine" to "LLAMA_CPP",
                                            "output" to output,
                                            "modelUsed" to "GEMMA_LOCAL",
                                            "message" to
                                                "Inference completed on-device via llama.cpp Gemma 4 E2B."
                                        )
                                    )
                                }

                                return@launch

                            } catch (e: Exception) {

                                launch(Dispatchers.Main) {
                                    result.success(
                                        mapOf(
                                            "success" to false,
                                            "isLocalInference" to false,
                                            "code" to "INFERENCE_FAILED",
                                            "engine" to "LLAMA_CPP",
                                            "output" to "",
                                            "message" to
                                                "llama.cpp inference failed: ${e.message}"
                                        )
                                    )
                                }

                                return@launch

                            } finally {
                                if (handle != null && bridge != null) {
                                    try {
                                        bridge.nativeFree(handle)
                                    } catch (_: Exception) {
                                        // Cleanup must not crash the channel.
                                    }
                                }
                            }
                        }

                        // -----------------------------------------
                        // UNKNOWN ENGINE
                        // -----------------------------------------

                        launch(Dispatchers.Main) {
                            result.success(
                                mapOf(
                                    "success" to false,
                                    "isLocalInference" to false,
                                    "code" to "UNKNOWN_ENGINE",
                                    "engine" to engine,
                                    "output" to "",
                                    "message" to
                                        "Unsupported on-device inference engine: $engine"
                                )
                            )
                        }
                    }
                }

                else -> result.notImplemented()
            }
        }

        // ---------------------------------------------------------
        // 3. GEMINI LIVE 24KHZ PCM STREAMING AUDIO CHANNEL
        // ---------------------------------------------------------
        MethodChannel(
            flutterEngine.dartExecutor.binaryMessenger,
            PCM_AUDIO_CHANNEL
        ).setMethodCallHandler { call, result ->
            when (call.method) {
                "startPcmPlayback" -> {
                    val sampleRate = call.argument<Int>("sampleRate") ?: 24000
                    try {
                        startPcmAudioTrack(sampleRate)
                        result.success(true)
                    } catch (e: Exception) {
                        result.error("PCM_START_ERROR", e.message, null)
                    }
                }
                "feedPcmChunk" -> {
                    val bytes = call.argument<ByteArray>("bytes")
                    if (bytes == null || bytes.isEmpty()) {
                        result.success(0)
                    } else {
                        CoroutineScope(Dispatchers.IO).launch {
                            try {
                                val written = writePcmAudioChunk(bytes)
                                launch(Dispatchers.Main) {
                                    result.success(written)
                                }
                            } catch (e: Exception) {
                                launch(Dispatchers.Main) {
                                    result.error("PCM_WRITE_ERROR", e.message, null)
                                }
                            }
                        }
                    }
                }
                "stopPcmPlayback" -> {
                    synchronized(pcmAudioLock) {
                        stopPcmAudioTrackLocked()
                    }
                    result.success(true)
                }
                else -> result.notImplemented()
            }
        }

        // ---------------------------------------------------------
        // 4. GEMMA 4 E2B MULTIMODAL EDGE AI CHANNEL (LITERT-LM)
        // ---------------------------------------------------------
        MethodChannel(
            flutterEngine.dartExecutor.binaryMessenger,
            EDGE_AI_CHANNEL
        ).setMethodCallHandler { call, result ->
            when (call.method) {
                "checkDeviceSupport" -> {
                    val totalRamMb = GemmaEdgeRuntime.getTotalRamMb(context)
                    val freeStorageMb = try {
                        StatFs(context.filesDir.absolutePath).availableBytes / (1024L * 1024L)
                    } catch (_: Exception) {
                        0L
                    }
                    val gemmaFile = getGemmaModelFile()
                    val gemmaDownloaded = gemmaFile.exists() && gemmaFile.length() > 0L
                    val gemmaSupported = totalRamMb >= GemmaEdgeRuntime.MIN_RAM_MB
                    val recommendedBackend = when {
                        totalRamMb >= GemmaEdgeRuntime.GPU_RECOMMENDED_RAM_MB -> "GPU"
                        totalRamMb >= GemmaEdgeRuntime.MIN_RAM_MB -> "CPU"
                        else -> "UNSUPPORTED"
                    }
                    val geminiNanoAvailable = isAICoreInstalled() && Build.VERSION.SDK_INT >= 34

                    result.success(
                        mapOf(
                            "totalRamMb" to totalRamMb.toInt(),
                            "freeStorageMb" to freeStorageMb.toInt(),
                            "gemmaE2bSupported" to gemmaSupported,
                            "recommendedBackend" to recommendedBackend,
                            "geminiNanoAvailable" to geminiNanoAvailable,
                            "gemmaModelDownloaded" to gemmaDownloaded,
                            "gemmaModelPath" to if (gemmaDownloaded) gemmaFile.absolutePath else null,
                            "gemmaLoaded" to GemmaEdgeRuntime.isLoaded(),
                            "activeBackend" to GemmaEdgeRuntime.getActiveBackend()
                        )
                    )
                }

                "initGemmaE2B" -> {
                    val modelPath = call.argument<String>("modelPath")
                        ?: getGemmaModelFile().absolutePath
                    val useGpu = call.argument<Boolean>("useGpu")
                    CoroutineScope(Dispatchers.IO).launch {
                        val initRes = GemmaEdgeRuntime.initialize(
                            context = context,
                            modelPath = modelPath,
                            preferGpu = useGpu
                        )
                        launch(Dispatchers.Main) {
                            result.success(
                                mapOf(
                                    "loaded" to initRes.loaded,
                                    "backend" to initRes.backend,
                                    "loadTimeMs" to initRes.loadTimeMs,
                                    "error" to initRes.error
                                )
                            )
                        }
                    }
                }

                "runGemmaMultimodal" -> {
                    val prompt = call.argument<String>("prompt") ?: ""
                    val imagePath = call.argument<String>("imagePath")
                    val modelPath = call.argument<String>("modelPath")
                        ?: getGemmaModelFile().let { if (it.exists()) it.absolutePath else null }

                    CoroutineScope(Dispatchers.IO).launch {
                        val genRes = GemmaEdgeRuntime.generate(
                            context = context,
                            prompt = prompt,
                            imagePath = imagePath,
                            modelPath = modelPath
                        )
                        launch(Dispatchers.Main) {
                            result.success(
                                mapOf(
                                    "success" to genRes.success,
                                    "text" to genRes.text,
                                    "tokensPerSec" to genRes.tokensPerSec,
                                    "model" to genRes.model,
                                    "backend" to genRes.backend,
                                    "error" to genRes.error
                                )
                            )
                        }
                    }
                }

                "unloadGemmaE2B" -> {
                    GemmaEdgeRuntime.close()
                    result.success(true)
                }

                else -> result.notImplemented()
            }
        }
    }
}