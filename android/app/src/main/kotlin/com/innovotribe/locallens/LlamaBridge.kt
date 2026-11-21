package com.innovotribe.locallens

import android.util.Log

class LlamaBridge {
    companion object {
        private const val TAG = "LlamaBridge"
        private var isLibraryLoaded = false

        init {
            try {
                System.loadLibrary("llama")
                isLibraryLoaded = true
                Log.i(TAG, "libllama.so loaded successfully.")
            } catch (e: UnsatisfiedLinkError) {
                isLibraryLoaded = false
                Log.w(TAG, "libllama.so not available on this device/architecture: ${e.message}")
            }
        }

        fun isLoaded(): Boolean = isLibraryLoaded
    }

    external fun nativeInit(modelPath: String, nThreads: Int, nCtx: Int): Long
    external fun nativeGenerate(handle: Long, prompt: String, maxTokens: Int): String
    external fun nativeFree(handle: Long)
}
