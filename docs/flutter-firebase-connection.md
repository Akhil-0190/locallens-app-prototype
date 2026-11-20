# Flutter - Firebase Connection Specification

This document guides Developer D on connecting the Flutter application to Firebase without risking secret leaks or violating backend isolation.

## Firebase Configuration via FlutterFire

The Flutter client connects using official FlutterFire plugins:
- `firebase_core`
- `firebase_auth`
- `cloud_firestore`
- `firebase_storage`

### Generation of `firebase_options.dart`

To configure the Flutter client for development and production:
1. Log in via Firebase CLI:
   ```bash
   firebase login
   ```
2. Run FlutterFire CLI configuration from project root:
   ```bash
   dart pub global activate flutterfire_cli
   flutterfire configure --project=neighborhoodguideapp-35856
   ```
3. This generates `lib/firebase_options.dart`, `android/app/google-services.json`, and `ios/Runner/GoogleService-Info.plist`.

> **IMPORTANT**:
> - Real `google-services.json`, `GoogleService-Info.plist`, and `firebase_options.dart` containing live project IDs and client API keys are ignored by `.gitignore`.
> - Template files (`.template`) are provided in the repository to document expected structure.

## Local Emulator Integration in Flutter

For local offline development and test automation, the Flutter client must connect to the local Firebase emulators when running in debug/development mode:

```dart
import 'package:flutter/foundation.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_storage/firebase_storage.dart';
import 'firebase_options.dart';

Future<void> initializeFirebaseForEnvironment() async {
  await Firebase.initializeApp(
    options: DefaultFirebaseOptions.currentPlatform,
  );

  if (kDebugMode) {
    // 10.0.2.2 is Android emulator host loopback address; use localhost for iOS/desktop.
    const host = '10.0.2.2';

    FirebaseFirestore.instance.useFirestoreEmulator(host, 8080);
    await FirebaseAuth.instance.useAuthEmulator(host, 9099);
    FirebaseStorage.instance.useStorageEmulator(host, 9199);
  }
}
```
