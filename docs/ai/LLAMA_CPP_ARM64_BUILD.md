# Documentation: llama.cpp ARM64 Android Native Runtime Build & Packaging

**Document Version:** 1.0.0  
**Target Architecture:** Android `arm64-v8a` (API level 28+)  
**Component:** `libllama.so` native runtime for Gemma 4 E2B GGUF inference  
**Output Directory:** `android/app/src/main/jniLibs/arm64-v8a/libllama.so`

---

## 1. Prerequisites

1. **Android NDK:** Version `r26d` or later (e.g. `26.1.10909125` or `27.0.12077973`).
2. **CMake:** Version `3.22.1` or later.
3. **Ninja Build System:** Ninja v1.10+.
4. **Git:** To clone the canonical `llama.cpp` upstream repository.

Set the `ANDROID_NDK` environment variable:
```bash
export ANDROID_NDK=$ANDROID_HOME/ndk/26.1.10909125
# On Windows PowerShell:
# $env:ANDROID_NDK = "$env:LOCALAPPDATA\Android\Sdk\ndk\26.1.10909125"
```

---

## 2. Source Checkout

Clone the `llama.cpp` repository at the stable tag or verified commit:
```bash
git clone https://github.com/ggerganov/llama.cpp.git
cd llama.cpp
```

---

## 3. Cross-Compilation Commands (`arm64-v8a`)

Run CMake configuring for Android ARM64 with position-independent code and optimized flags:

```bash
mkdir -p build-android-arm64
cd build-android-arm64

cmake .. \
    -DCMAKE_TOOLCHAIN_FILE=$ANDROID_NDK/build/cmake/android.toolchain.cmake \
    -DANDROID_ABI=arm64-v8a \
    -DANDROID_PLATFORM=android-28 \
    -DANDROID_STL=c++_shared \
    -DCMAKE_BUILD_TYPE=Release \
    -DBUILD_SHARED_LIBS=ON \
    -DGGML_NATIVE=OFF \
    -DGGML_OPENMP=OFF \
    -DGGML_LLAMAFILE=OFF \
    -DLLAMA_BUILD_EXAMPLES=OFF \
    -DLLAMA_BUILD_TESTS=OFF \
    -DLLAMA_BUILD_SERVER=OFF \
    -DLLAMA_OPENSSL=OFF

cmake --build . --config Release -j$(nproc)
```

On Windows with PowerShell and Ninja:
```powershell
cmake -G Ninja .. `
    -DCMAKE_TOOLCHAIN_FILE="$env:ANDROID_NDK/build/cmake/android.toolchain.cmake" `
    -DANDROID_ABI=arm64-v8a `
    -DANDROID_PLATFORM=android-28 `
    -DANDROID_STL=c++_shared `
    -DCMAKE_BUILD_TYPE=Release `
    -DBUILD_SHARED_LIBS=ON `
    -DGGML_NATIVE=OFF `
    -DGGML_OPENMP=OFF `
    -DGGML_LLAMAFILE=OFF `
    -DLLAMA_BUILD_EXAMPLES=OFF `
    -DLLAMA_BUILD_TESTS=OFF `
    -DLLAMA_BUILD_SERVER=OFF

ninja -j4
```

---

## 4. Packaging Artifacts into Android Project

After successful compilation, copy the generated shared libraries (`libllama.so` and `libc++_shared.so` if dynamic STL is selected):

```bash
mkdir -p <PROJECT_ROOT>/android/app/src/main/jniLibs/arm64-v8a/
cp bin/libllama.so <PROJECT_ROOT>/android/app/src/main/jniLibs/arm64-v8a/libllama.so
```

Verify the binary properties:
```bash
file <PROJECT_ROOT>/android/app/src/main/jniLibs/arm64-v8a/libllama.so
# Expected: ELF 64-bit LSB shared object, ARM aarch64, version 1 (SYSV), dynamically linked
```

---

## 5. JNI Bridge Implementation Contract

The Kotlin bridge `android/app/src/main/kotlin/com/innovotribe/locallens/LlamaBridge.kt` binds to the C/C++ exports:

```cpp
#include <jni.h>
#include "llama.h"

extern "C" {
JNIEXPORT jlong JNICALL
Java_com_innovotribe_locallens_LlamaBridge_nativeInit(
    JNIEnv* env, jobject thiz, jstring model_path, jint n_threads, jint n_ctx) {
    // Model loading implementation using llama_load_model_from_file and llama_new_context_with_model
}

JNIEXPORT jstring JNICALL
Java_com_innovotribe_locallens_LlamaBridge_nativeGenerate(
    JNIEnv* env, jobject thiz, jlong handle, jstring prompt, jint max_tokens) {
    // Tokenization, evaluation loop, and detokenization
}

JNIEXPORT void JNICALL
Java_com_innovotribe_locallens_LlamaBridge_nativeFree(
    JNIEnv* env, jobject thiz, jlong handle) {
    // Context and model cleanup via llama_free and llama_free_model
}
}
```

---

## 6. Execution Safety & Current Status

1. **Dynamic Loading:** `LlamaBridge.kt` uses `try { System.loadLibrary("llama") } catch (e: UnsatisfiedLinkError)` to safely detect whether `libllama.so` is present.
2. **Fail-Closed Fallback:** When `libllama.so` is absent from `jniLibs/arm64-v8a/`, the app safely returns `LLAMA_CPP_RUNTIME_NOT_LOADED` and gracefully defaults to unassisted mode without an `UnsatisfiedLinkError` crash.
3. **Status:** Host build environment currently lacks the cross-compilation Android NDK toolchain (`r26d`). As such, `libllama.so` is not packaged in the repository; the build instructions above provide the exact reproducible recipe for generating the ARM64 shared object.
