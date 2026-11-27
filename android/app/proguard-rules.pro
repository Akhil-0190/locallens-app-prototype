# LocalLens Android Release ProGuard / R8 Keep Rules

# Unused optional ML Kit Text Recognition scripts referenced by google_mlkit_text_recognition
-dontwarn com.google.mlkit.vision.text.chinese.**
-dontwarn com.google.mlkit.vision.text.japanese.**
-dontwarn com.google.mlkit.vision.text.korean.**
-dontwarn com.google.mlkit.vision.text.devanagari.**

# Preserve LiteRT-LM (Gemma 4 E2B) JNI bindings and runtime classes
-keep class com.google.ai.edge.litertlm.** { *; }
-dontwarn com.google.ai.edge.litertlm.**

# Preserve Razorpay native checkout SDK callbacks
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
-keep class com.razorpay.** { *; }
-dontwarn com.razorpay.**
