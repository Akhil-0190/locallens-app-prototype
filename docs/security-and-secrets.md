# Security and Secrets Policy

## Absolute Guardrails

1. **Zero Server Secrets in Client Code**: No API keys with administrative privileges, server-side Gemini service keys, or Firebase Service Account credentials may ever be embedded into the Flutter client codebase, `.dart` files, Android manifests, or Gradle configs.
2. **Zero Secrets in Git**: Git tracking is blocked for all `.env`, `.env.*` (except `.env.example`), `*serviceAccountKey*.json`, and keystore files via root `.gitignore`.

## Secret Management

### Production Environment (Cloud Secret Manager)

Firebase Cloud Functions v2 uses Google Cloud Secret Manager to bind sensitive keys dynamically to function runtimes.

Defined in `functions/src/config/secrets.ts`:
```typescript
import { defineSecret } from "firebase-functions/params";

export const geminiApiKey = defineSecret("GEMINI_API_KEY");
export const mapsApiKey = defineSecret("MAPS_API_KEY");
```

Functions declare required secrets in their configuration:
```typescript
export const healthCheck = onRequest({ secrets: [geminiApiKey] }, (req, res) => { ... });
```

To set secrets in Google Cloud / Firebase CLI:
```bash
firebase functions:secrets:set GEMINI_API_KEY
firebase functions:secrets:set MAPS_API_KEY
```

### Local Development Environment

For local emulator testing:
- Create `functions/.env.local`
- Provide mock values or test keys:
  ```env
  GEMINI_API_KEY=mock-local-key
  MAPS_API_KEY=mock-local-key
  ```
- Firebase Functions emulator automatically loads `.env.local` values when running locally.

## Firestore & Storage Baseline Rules

- All rules default to **DENY-ALL**:
  ```rules
  match /{document=**} {
    allow read, write: if false;
  }
  ```
- Read/write access is opened granularly per collection only as shared contracts are finalized with Developers B, C, and D.
