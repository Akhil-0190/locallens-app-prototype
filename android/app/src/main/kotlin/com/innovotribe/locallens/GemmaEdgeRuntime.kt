package com.innovotribe.locallens

import android.app.ActivityManager
import android.content.Context
import android.util.Log
import com.google.ai.edge.litertlm.Backend
import com.google.ai.edge.litertlm.Content
import com.google.ai.edge.litertlm.Contents
import com.google.ai.edge.litertlm.Engine
import com.google.ai.edge.litertlm.EngineConfig
import kotlinx.coroutines.flow.collect
import java.io.File

/**
 * Thread-safe on-device Gemma 4 E2B multimodal runtime powered by Google AI Edge LiteRT-LM.
 *
 * Hardware Tuning:
 * - >= 10 GB RAM (e.g., Motorola Edge 60 Pro 12 GB RAM): GPU delegate for LLM + Vision (with CPU fallback)
 * - 6 GB - 9.9 GB RAM: CPU delegate by default to stay comfortably below Android LMK thresholds
 * - < 6 GB RAM: Safety-gated (refuses load to prevent OOM crashes)
 */
object GemmaEdgeRuntime {
    private const val TAG = "GemmaEdgeRuntime"
    const val MIN_RAM_MB = 6000L
    const val GPU_RECOMMENDED_RAM_MB = 10000L

    private val lock = Any()
    private var engine: Engine? = null
    private var loadedModelPath: String? = null
    private var activeBackendName: String = "NONE"

    data class InitResult(
        val loaded: Boolean,
        val backend: String,
        val loadTimeMs: Long,
        val error: String? = null
    )

    data class InferenceResult(
        val success: Boolean,
        val text: String,
        val tokensPerSec: Double,
        val model: String,
        val backend: String,
        val error: String? = null
    )

    fun getTotalRamMb(context: Context): Long {
        val am = context.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
        val info = ActivityManager.MemoryInfo()
        am.getMemoryInfo(info)
        return info.totalMem / (1024L * 1024L)
    }

    fun isLoaded(): Boolean = synchronized(lock) { engine != null }

    fun getActiveBackend(): String = synchronized(lock) { activeBackendName }

    fun getLoadedModelPath(): String? = synchronized(lock) { loadedModelPath }

    /**
     * Initializes the LiteRT-LM Engine for Gemma 4 E2B. Must be called on Dispatchers.IO.
     */
    fun initialize(
        context: Context,
        modelPath: String,
        preferGpu: Boolean? = null
    ): InitResult {
        val totalRamMb = getTotalRamMb(context)
        if (totalRamMb < MIN_RAM_MB) {
            return InitResult(
                loaded = false,
                backend = "UNSUPPORTED",
                loadTimeMs = 0L,
                error = "Safety guard: Device RAM (${totalRamMb} MB) is below the ${MIN_RAM_MB} MB minimum required for Gemma 4 E2B."
            )
        }

        val modelFile = File(modelPath)
        if (!modelFile.exists() || modelFile.length() <= 0L) {
            return InitResult(
                loaded = false,
                backend = "NONE",
                loadTimeMs = 0L,
                error = "Gemma 4 E2B model file not found at $modelPath."
            )
        }

        synchronized(lock) {
            if (engine != null && loadedModelPath == modelPath) {
                return InitResult(
                    loaded = true,
                    backend = activeBackendName,
                    loadTimeMs = 0L
                )
            }
            closeLocked()
        }

        val useGpuFirst = preferGpu ?: (totalRamMb >= GPU_RECOMMENDED_RAM_MB)
        val cacheDir = context.cacheDir.absolutePath
        val startMs = System.currentTimeMillis()

        // Try GPU first on flagship 12 GB RAM devices (e.g. Motorola Edge 60 Pro), fallback to CPU if GPU fails
        val attempts: List<Pair<String, Backend>> = if (useGpuFirst) {
            listOf("GPU" to Backend.GPU(), "CPU" to Backend.CPU())
        } else {
            listOf("CPU" to Backend.CPU())
        }

        var lastError: String? = null
        for ((label, backend) in attempts) {
            try {
                Log.i(TAG, "Initializing Gemma 4 E2B LiteRT-LM on $label backend (RAM: ${totalRamMb}MB)...")
                val config = EngineConfig(
                    modelPath = modelFile.absolutePath,
                    backend = backend,
                    visionBackend = backend,
                    cacheDir = cacheDir
                )
                val newEngine = Engine(config)
                newEngine.initialize()
                val elapsed = System.currentTimeMillis() - startMs

                synchronized(lock) {
                    engine = newEngine
                    loadedModelPath = modelFile.absolutePath
                    activeBackendName = label
                }
                Log.i(TAG, "Gemma 4 E2B initialized on $label in ${elapsed}ms.")
                return InitResult(
                    loaded = true,
                    backend = label,
                    loadTimeMs = elapsed
                )
            } catch (e: Exception) {
                lastError = "${label} init failed: ${e.message}"
                Log.w(TAG, lastError, e)
            }
        }

        return InitResult(
            loaded = false,
            backend = "NONE",
            loadTimeMs = System.currentTimeMillis() - startMs,
            error = lastError ?: "Failed to initialize LiteRT-LM engine."
        )
    }

    /**
     * Runs on-device text or multimodal (image + text) inference via LiteRT-LM Conversation API.
     * Must be invoked on Dispatchers.IO.
     */
    suspend fun generate(
        context: Context,
        prompt: String,
        imagePath: String? = null,
        modelPath: String? = null
    ): InferenceResult {
        if (prompt.isBlank()) {
            return InferenceResult(
                success = false,
                text = "",
                tokensPerSec = 0.0,
                model = "gemma-4-e2b",
                backend = activeBackendName,
                error = "Prompt cannot be empty."
            )
        }

        // Lazy initialize if not loaded yet and a modelPath was supplied
        if (!isLoaded() && !modelPath.isNullOrBlank()) {
            val initRes = initialize(context, modelPath)
            if (!initRes.loaded) {
                return InferenceResult(
                    success = false,
                    text = "",
                    tokensPerSec = 0.0,
                    model = "gemma-4-e2b",
                    backend = initRes.backend,
                    error = initRes.error
                )
            }
        }

        val currentEngine = synchronized(lock) { engine }
            ?: return InferenceResult(
                success = false,
                text = "",
                tokensPerSec = 0.0,
                model = "gemma-4-e2b",
                backend = "NONE",
                error = "Gemma 4 E2B engine is not loaded. Download and initialize the model first."
            )

        val startMs = System.currentTimeMillis()
        val outputBuilder = StringBuilder()
        var chunkCount = 0

        return try {
            val conversation = currentEngine.createConversation()
            val contents = if (!imagePath.isNullOrBlank() && File(imagePath).exists()) {
                Contents.of(
                    Content.ImageFile(imagePath),
                    Content.Text(prompt)
                )
            } else {
                Contents.of(Content.Text(prompt))
            }

            conversation.sendMessageAsync(contents).collect { message ->
                val piece = message.toString()
                if (piece.isNotEmpty()) {
                    outputBuilder.append(piece)
                    chunkCount++
                }
            }

            try {
                conversation.close()
            } catch (_: Exception) {
            }

            val elapsedSec = ((System.currentTimeMillis() - startMs).coerceAtLeast(1L)) / 1000.0
            val text = outputBuilder.toString().trim()
            val approxTokens = (text.split(Regex("\\s+")).size * 1.3).coerceAtLeast(chunkCount.toDouble())
            val tps = approxTokens / elapsedSec

            InferenceResult(
                success = text.isNotEmpty(),
                text = text,
                tokensPerSec = tps,
                model = "gemma-4-e2b",
                backend = activeBackendName,
                error = if (text.isEmpty()) "Gemma 4 E2B returned an empty response." else null
            )
        } catch (e: Exception) {
            Log.e(TAG, "Gemma 4 E2B inference error: ${e.message}", e)
            InferenceResult(
                success = false,
                text = "",
                tokensPerSec = 0.0,
                model = "gemma-4-e2b",
                backend = activeBackendName,
                error = "On-device inference error: ${e.message}"
            )
        }
    }

    private fun closeLocked() {
        try {
            engine?.close()
        } catch (_: Exception) {
        } finally {
            engine = null
            loadedModelPath = null
            activeBackendName = "NONE"
        }
    }

    fun close() {
        synchronized(lock) {
            closeLocked()
        }
    }
}
