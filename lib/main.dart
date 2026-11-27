import 'dart:async';
import 'package:flutter/foundation.dart';
// ignore: deprecated_member_use
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:cloud_functions/cloud_functions.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_app_check/firebase_app_check.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_storage/firebase_storage.dart';
import 'config/app_config.dart';
import 'firebase_options.dart';
import 'router/app_router.dart';
import 'services/offline_model_manager.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  try {
    await Firebase.initializeApp(
      options: DefaultFirebaseOptions.currentPlatform,
    );

    if (AppConfig.useEmulators) {
      final host = AppConfig.emulatorHost;
      await FirebaseAuth.instance.useAuthEmulator(host, 9099);
      FirebaseFirestore.instance.useFirestoreEmulator(host, 8080);
      FirebaseFunctions.instanceFor(region: AppConfig.apiRegion)
          .useFunctionsEmulator(host, 5001);
      await FirebaseStorage.instance.useStorageEmulator(host, 9199);
      debugPrint('[LocalLens] Connected to Firebase Emulators at $host');
    } else {
      // Activate App Check: Play Integrity for release, Debug provider for dev
      await FirebaseAppCheck.instance.activate(
        providerAndroid: kReleaseMode
            ? const AndroidPlayIntegrityProvider()
            : const AndroidDebugProvider(),
        providerApple: const AppleDeviceCheckProvider(),
      );
    }

    // Ensure authenticated Firebase session exists for Cloud Functions callables
    try {
      if (FirebaseAuth.instance.currentUser == null) {
        await FirebaseAuth.instance.signInAnonymously();
      }
    } catch (authErr) {
      debugPrint('[LocalLens] Anonymous FirebaseAuth sign-in failed: $authErr');
    }
  } catch (initErr) {
    debugPrint('[LocalLens] Firebase initialization error: $initErr');
  }

  // Non-blocking Gemma 4 E2B background setup / warm-up on >=6 GB RAM phones over Wi-Fi
  unawaited(OfflineModelManager().autoInitIfReadyOrWifi());

  runApp(
    const ProviderScope(
      child: NeighborhoodGuideApp(),
    ),
  );
}

class NeighborhoodGuideApp extends StatelessWidget {
  const NeighborhoodGuideApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp.router(
      title: 'Neighborhood Guide',
      debugShowCheckedModeBanner: false,
      routerConfig: appRouter,
      locale: const Locale('en', 'US'),
      localizationsDelegates: const [
        DefaultMaterialLocalizations.delegate,
        DefaultWidgetsLocalizations.delegate,
      ],
      supportedLocales: const [
        Locale('en', 'US'),
        Locale('en', 'IN'),
      ],
      theme: ThemeData(
        colorSchemeSeed: Colors.teal,
        useMaterial3: true,
      ),
    );
  }
}