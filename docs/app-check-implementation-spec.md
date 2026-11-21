# Firebase App Check Implementation & Client Handoff Specification

**Project:** Startup Buildathon India 2026 — InnovoTribe  
**Document:** Developer D Implementation & Integration Handoff  
**Author:** Developer A (Backend, Security & Release)  
**Target Recipient:** Developer D (Flutter Client & Android Native)  
**Status:** READY FOR CLIENT IMPLEMENTATION  
**Date:** November 21, 2026  

---

## 1. Overview and Objective

Firebase App Check protects InnovoTribe's backend infrastructure (Cloud Functions, Firestore, Cloud Storage) from abuse, unauthorized scrapers, and bot traffic by verifying that incoming requests originate from the authentic, untampered InnovoTribe Android application.

### Current Backend Status:
* Developer A has implemented the backend token inspection utility (`functions/src/config/app-check.ts`).
* The backend currently operates in **Audit Mode** (`ENFORCE_APP_CHECK=false`), where tokens are inspected and logged without rejecting requests from mobile clients where App Check is not yet active.
* Once Developer D completes client-side initialization and registers the Android app in the Firebase Console, backend enforcement can be safely switched to **Enforced Mode** (`ENFORCE_APP_CHECK=true`).

---

## 2. Developer D Implementation Tasks

Developer D must complete three configuration and code integration steps in the Flutter and Android codebases:

### Step 2.1: Flutter Client Initialization in `lib/main.dart`

Ensure `firebase_app_check` is initialized immediately following `Firebase.initializeApp()` in `lib/main.dart`:

```dart
import 'package:flutter/foundation.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_app_check/firebase_app_check.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp();

  // Initialize Firebase App Check with Play Integrity for Android release builds
  // and Debug provider for local development/emulator testing.
  await FirebaseAppCheck.instance.activate(
    androidProvider: kReleaseMode
        ? AndroidProvider.playIntegrity
        : AndroidProvider.debug,
    appleProvider: AppleProvider.deviceCheck,
  );

  runApp(const NeighborhoodGuideApp());
}
```

### Step 2.2: Android Native Configuration

1. **Google Play Integrity API:**
   * Enable the Google Play Integrity API in the Google Cloud Console for project `neighborhoodguideapp-35856`.
2. **SHA-256 Fingerprint Registration:**
   * Obtain the SHA-256 fingerprint of the release signing key:
     ```bash
     keytool -list -v -keystore <your-release-key.keystore> -alias <key-alias>
     ```
   * Register the SHA-256 fingerprint in the Firebase Console under **Project Settings > General > Your Apps > Android app**.
3. **App Check Console Registration:**
   * In the Firebase Console, navigate to **Build > App Check > Apps**.
   * Select the Android app (`com.innovotribe.neighborhoodguideapp`).
   * Register the app with **Play Integrity**. Set token TTL to 1 hour (default).

### Step 2.3: Debug Provider Setup for Development & Testing

When running in debug mode (`kReleaseMode == false`):
1. Launch the app on an Android emulator or test device.
2. Filter the Android logcat output for `DebugAppCheckProvider`:
   ```text
   D/DebugAppCheckProvider: Enter this debug secret into the allow list in the Firebase Console for your project:
   XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX
   ```
3. Copy the UUID debug secret from the logcat.
4. In the Firebase Console (**Build > App Check > Apps > Manage debug tokens**), add the debug secret with a description (e.g., `Developer D Local Pixel 7 Emulator`).
5. This allows local developer builds to acquire valid App Check tokens without needing Google Play Services.

---

## 3. Backend Inspection & Callable Function Contract

### 3.1 Token Transmission
When using the official Firebase Cloud Functions SDK (`cloud_functions` package in Flutter), App Check tokens are automatically attached to every callable function invocation under the `X-Firebase-AppCheck` header. No manual HTTP header management is required for callable functions.

### 3.2 Backend Verification Utility (`functions/src/config/app-check.ts`)
The backend provides the helper:
```typescript
import { inspectAppCheck } from './config/app-check.js';

export const submitContribution = onCall(async (request) => {
  // Inspect token status (logs attestation metadata)
  const appCheck = inspectAppCheck(request, {
    enforce: process.env.ENFORCE_APP_CHECK === 'true'
  });

  // Business logic execution...
});
```

* In **Audit Mode** (`ENFORCE_APP_CHECK=false`):
  * If token is missing: Logs a `WARNING` with caller UID, but allows the request to continue.
  * If token is valid: Logs an `INFO` confirmation with `appId`.
* In **Enforced Mode** (`ENFORCE_APP_CHECK=true`):
  * If token is missing: Immediately throws an `HttpsError('unauthenticated', 'App Check attestation required.')`.

---

## 4. Rollout and Enforcement Conditions

To prevent breaking existing mobile users during release, the transition to hard enforcement must follow this strict sequence:

1. **Phase 1 (Development & Build Verification):**
   * Developer D implements Step 2.1–2.3.
   * Verify debug token in Android logcat and register in Firebase Console.
   * Execute acceptance tests and confirm callable functions succeed.
2. **Phase 2 (Staging & Physical Device Test):**
   * Build Android release APK/AAB signed with release key.
   * Install on physical Android device with Google Play Services.
   * Verify that Cloud Functions receive `app.appId` with `isVerified: true` in Cloud Logging.
3. **Phase 3 (Production Enforcement Activation):**
   * *Proposed Operational Criterion:* Project Lead and Developers A & D evaluate verification telemetry in Cloud Logging. Once verified attestation tokens are consistently observed without blocking genuine users (e.g. targeting ~99% verification rate as an operational safety benchmark, rather than a frozen requirement):
   * Project Lead authorizes updating Cloud Functions configuration to `ENFORCE_APP_CHECK=true`.

> [!NOTE]
> The ~99% threshold is a **proposed operational rollout criterion** to avoid user lockout; it is not a frozen product requirement. Backend enforcement is explicitly kept **disabled by default** (`ENFORCE_APP_CHECK=false`) until Developer D's client implementation is deployed and verified.

> [!CAUTION]
> **Enforcement Lockout Prevention:** Do NOT set `ENFORCE_APP_CHECK=true` in production until Developer D has confirmed Play Integrity token acquisition on physical Android devices.
