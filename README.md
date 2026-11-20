# LocalLens - Tourist Helper Application

LocalLens is a street-level neighborhood guide mobile client for tourists and local contributors, built with Flutter, Material 3, Riverpod, Drift (SQLite), and Firebase.

---

## Architecture & Technology Stack

- **Framework:** Flutter (Channel stable, Dart 3)
- **Design System:** Material 3 (`useMaterial3: true`, `colorSchemeSeed: Colors.teal`)
- **State Management:** Riverpod (`flutter_riverpod`)
- **Navigation:** `go_router` with state-preserving `StatefulShellRoute.indexedStack`
- **Offline Persistence:** SQLite via Drift (`drift`, `sqlite3_flutter_libs`)
- **Backend Integration:** Firebase Authentication, Cloud Firestore, Firebase Storage
- **Native Platform:** Android with Kotlin DSL (`build.gradle.kts`), Java 17 target

---

## Project Structure

```
lib/
├── config/
│   └── app_config.dart          # Environment variables & runtime flags
├── database/
│   ├── app_database.dart        # Drift SQLite offline database schema
│   └── app_database.g.dart      # Generated Drift code
├── mock/
│   └── sample_spots.dart        # Mock verified local spots
├── models/
│   └── spot_card.dart           # Spot domain model & serialization
├── providers/
│   └── spot_providers.dart      # Riverpod providers & state notifiers
├── router/
│   └── app_router.dart          # go_router shell route & branches
├── screens/
│   ├── add_gem_screen.dart      # Contributor spot submission flow
│   ├── match_vibe_screen.dart   # Traveler vibe matching & route generation
│   └── pocket_guide_screen.dart # Verified street pocket guide
├── services/
│   ├── photo_helper.dart        # Base64/network/asset photo processor
│   └── spot_service.dart        # Firestore / Mock data gateway
└── widgets/
    ├── app_async_states.dart    # Reusable loading, error, and empty state widgets
    ├── spot_card_tile.dart      # Reusable M3 spot card presentation widget
    └── vibe_chip_selector.dart  # Reusable vibe selection chip group
```

---

## Setup & Development Instructions

### 1. Prerequisites
- **Flutter SDK:** 3.50.0 (Dart SDK `^3.14.0`)
- **JDK:** Java 17
- **Android SDK:** API Level 34+ compileSdk, minimum SDK 21

### 2. Install Dependencies
```bash
flutter pub get
```

### 3. Generate Offline Database Code (Drift)
```bash
dart run build_runner build
```

### 4. Run Static Analysis & Linter
```bash
flutter analyze
```

### 5. Run Automated Tests
```bash
flutter test
```

### 6. Run on Device / Emulator
Development mode with mock data (default):
```bash
flutter run
```

Running with live Firebase endpoints:
```bash
flutter run --dart-define=APP_ENV=staging --dart-define=USE_MOCK_DATA=false
```

### 7. Build Android Debug APK
```bash
flutter build apk --debug
```

---

## Navigation Routes

| Path | Destination | Description |
|---|---|---|
| `/guide` | **Pocket Guide** (Default) | Lists verified local spots, audio cues, and map directions. |
| `/vibe` | **Match Vibe** | Customizes route based on traveler vibes, party size, and crowd-caps. |
| `/add` | **Add Gem** | Contributor submission form for new street discoveries. |

---

## State Management (Riverpod)

- `appDatabaseProvider`: Provides the Drift SQLite database instance with automatic lifecycle disposal.
- `spotServiceProvider`: Gateway to local mock or live Firestore queries.
- `verifiedSpotsProvider`: `FutureProvider` providing list of verified spots.
- `selectedVibesProvider`: `StateProvider<Set<String>>` tracking user selected interests.
- `groupSizeProvider`: `StateProvider<int>` tracking traveler group size.
- `matchedRouteProvider`: `StateProvider<List<SpotCard>>` tracking the generated 3-stop route.
- `crowdedSpotsProvider`: `StateProvider<List<SpotCard>>` tracking high-footfall spots.
- `isGeneratingRouteProvider` / `hasGeneratedRouteProvider`: Route generation lifecycle flags.
