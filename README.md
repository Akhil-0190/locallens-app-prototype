# Neighborhood Guide App

Welcome to the **Neighborhood Guide App** repository for Startup Buildathon 2026.

## Architecture & Technology Stack

- **Client**: Flutter (Dart) with Android-native Kotlin integration
- **Offline Storage**: SQLite / Drift for client-side offline packs
- **Backend**: Firebase Cloud Functions (TypeScript, Node.js 22+)
- **Database & Auth**: Cloud Firestore, Firebase Authentication, Cloud Storage
- **AI Integration**: Official `@google/genai` TypeScript SDK (server-side Cloud Functions)
- **Maps**: Google Maps Platform integration

## Getting Started

See [docs/backend-setup.md](file:///d:/Judah/Projects/Hackthon/Google/BuildathonNew/neighborhoodguideapp/docs/backend-setup.md) for full setup instructions, local emulator steps, and build workflows.

### Quick Commands

- **Build Cloud Functions**:
  ```bash
  cd functions
  npm run build
  ```
- **Run Unit Tests**:
  ```bash
  cd functions
  npm test
  ```
- **Start Local Emulators**:
  ```bash
  npm run emulators
  ```

## Documentation

- [Backend Setup & Architecture](file:///d:/Judah/Projects/Hackthon/Google/BuildathonNew/neighborhoodguideapp/docs/backend-setup.md)
- [Security, Credentials & Secrets Policy](file:///d:/Judah/Projects/Hackthon/Google/BuildathonNew/neighborhoodguideapp/docs/security-and-secrets.md)
- [Flutter-Firebase Integration](file:///d:/Judah/Projects/Hackthon/Google/BuildathonNew/neighborhoodguideapp/docs/flutter-firebase-connection.md)
- [Shared Data Contracts](file:///d:/Judah/Projects/Hackthon/Google/BuildathonNew/neighborhoodguideapp/docs/contracts/README.md)
