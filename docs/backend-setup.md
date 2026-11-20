# Backend Setup Guide

This guide describes how to configure, run, and test the Firebase backend services for the Neighborhood Guide App.

## Prerequisites

- **Node.js**: `v22.x` (LTS or later)
- **npm**: `10.x` or later
- **Firebase CLI**: Install globally via `npm install -g firebase-tools` or run via `npx firebase-tools`
- **Java Runtime (JRE/JDK 17+)**: Required for running the local Firebase Emulator Suite (Firestore, Auth, Storage)

## Architecture & Technology Stack

- **Functions Runtime**: Node.js 22
- **Language**: TypeScript (compiled to CommonJS in `functions/lib`)
- **SDKs**:
  - `firebase-admin` (v12+): Server-side administrative operations
  - `firebase-functions` (v6+): Cloud Functions v2 API with params and secret management
  - `@google/genai`: Official Google Gen AI TypeScript SDK for Gemini model integration
- **Emulators**: Local Auth, Firestore, Storage, and Functions with UI on port `4000`

## Directory Structure

```
├── .firebaserc                # Firebase project aliases
├── firebase.json              # Firebase service definitions & emulator ports
├── firestore.rules            # Firestore security rules (default-deny baseline)
├── firestore.indexes.json     # Compound index definitions
├── storage.rules              # Cloud Storage security rules (default-deny baseline)
├── docs/                      # Technical documentation
│   ├── backend-setup.md       # This guide
│   ├── security-and-secrets.md# Secret management, permissions, and guardrails
│   ├── flutter-firebase-connection.md # Flutter client integration specs
│   └── contracts/             # Canonical shared data schemas (Team coordination)
│       └── README.md
├── functions/                 # Cloud Functions (Node.js 22 + TypeScript)
│   ├── package.json
│   ├── tsconfig.json
│   ├── .env.example           # Environment template
│   ├── src/
│   │   ├── config/            # Firebase Admin init & Cloud Secret parameters
│   │   │   ├── firebase.ts
│   │   │   └── secrets.ts
│   │   └── index.ts           # Exported cloud function handlers
│   └── tests/                 # Unit and integration tests (node:test)
│       └── foundation.test.ts
```

## Local Development Workflow

### 1. Install Functions Dependencies

```powershell
cd functions
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env.local` inside `functions/`:

```powershell
cd functions
cp .env.example .env.local
```

### 3. Build Functions

```powershell
npm run build
```

Watch mode for active development:
```powershell
npm run build:watch
```

### 4. Run Unit Tests

Using Node.js 22 built-in test runner:
```powershell
npm test
```

### 5. Run Firebase Emulators

Start the local emulator suite with UI:
```powershell
firebase emulators:start
```
- Emulator UI: `http://localhost:4000`
- Functions Emulator: `http://localhost:5001`
- Firestore Emulator: `http://localhost:8080`
- Auth Emulator: `http://localhost:9099`
- Storage Emulator: `http://localhost:9199`
