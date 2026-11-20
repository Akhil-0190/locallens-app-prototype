# Neighborhood Guide App

Neighborhood Guide is an AI-powered, crowd-throttled neighborhood discovery platform for travelers and local contributors, built for Startup Buildathon 2026.

The mobile application enables travelers to discover authentic local experiences through regional-language contributions, personalized recommendations, walking routes and offline guidance.

## Architecture & Technology Stack

### Mobile Application
- **Framework:** Flutter (Dart)
- **Design System:** Material 3
- **State Management:** Riverpod (`flutter_riverpod`)
- **Navigation:** `go_router`
- **Offline Persistence:** SQLite using Drift
- **Native Android Integration:** Kotlin
- **Backend Integration:** Firebase Authentication, Cloud Firestore and Firebase Storage

### Backend
- **Runtime:** Node.js 22+
- **Language:** TypeScript
- **Framework:** Firebase Cloud Functions (2nd generation)
- **Database:** Cloud Firestore
- **Authentication:** Firebase Authentication
- **File Storage:** Cloud Storage for Firebase
- **AI Integration:** Official `@google/genai` TypeScript SDK
- **Maps:** Google Maps Platform

## Project Structure

### Flutter Application

```text
lib/
├── config/
├── database/
├── mock/
├── models/
├── providers/
├── router/
├── screens/
├── services/
└── widgets/
```

The mobile application contains the configuration, offline database, domain models, state providers, navigation, screens, services and reusable UI components.

### Backend

```text
functions/
└── src/
    ├── ai/
    ├── config/
    ├── maps/
    └── tests/
```

The backend contains Firebase Cloud Functions, AI services, Maps integrations, configuration and automated tests. Refer to the actual repository structure when adding or changing modules.

## Getting Started

### Prerequisites

- Flutter SDK compatible with the repository's `pubspec.yaml`
- Dart SDK compatible with the Flutter installation
- Node.js 22+
- npm
- Java 17
- Android SDK
- Firebase CLI

### 1. Install Flutter Dependencies

From the directory containing `pubspec.yaml`:

```bash
flutter pub get
```

### 2. Generate Offline Database Code

If Drift code generation is required:

```bash
dart run build_runner build
```

### 3. Install Backend Dependencies

```bash
cd functions
npm install
```

### 4. Build and Check Backend

```bash
npm run lint
npm run build
npm test
```

### 5. Run Flutter Analysis and Tests

From the Flutter project directory:

```bash
flutter analyze
flutter test
```

### 6. Run the Application

```bash
flutter run
```

Live Firebase integration requires valid Firebase project configuration and credentials. Do not assume mock-data mode or live integration is enabled without checking the application configuration.

### 7. Start Firebase Emulators

From the repository root:

```bash
npm run emulators
```

### 8. Build Android Debug APK

From the Flutter project directory:

```bash
flutter build apk --debug
```

## Backend Documentation

- [Backend Setup & Architecture](docs/backend-setup.md)
- [Security, Credentials & Secrets Policy](docs/security-and-secrets.md)
- [Flutter-Firebase Integration](docs/flutter-firebase-connection.md)
- [Shared Data Contracts](docs/contracts/README.md)

## Development Principles

- Flutter is the primary mobile application.
- Kotlin provides Android-specific native integration.
- Firebase is the shared backend platform.
- Gemini provides server-side AI capabilities.
- Google Maps Platform provides maps, places and routing services.
- Offline functionality is part of the application architecture.
- API credentials and secrets must not be committed to the repository.
- Mocks and unverified integrations must be clearly identified.