import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'firebase_options.dart';
import 'router/app_router.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  try {
    await Firebase.initializeApp(
      options: DefaultFirebaseOptions.currentPlatform,
    );
  } catch (_) {}

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