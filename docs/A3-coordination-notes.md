# A3 Coordination Notes — Contribution and AI-Result Persistence

**Task:** A3 — Contribution and AI-Result Persistence
**Branch:** `feature/A3-contribution-backend`
**Author:** Developer A
**Date:** 2026-11-20
**Review Status:** Updated following Developer A review and coordination requirements.

---

## 1. Resolved Architectural Decisions

### 1.1 Contribution Creation (Reconciled with Security Rules)
- **Problem:** Direct Firestore `allow create: if ...` would allow client SDKs to create documents that bypass schema validation, canonical defaults, and audit logging.
- **Resolution:**
  - `firestore.rules` under `match /contributions/{contributionId}` sets **`allow create: if false;`**.
  - All contributions **must** be created via the `submitContribution` Cloud Functions callable.
  - The backend validates the payload with A2 `ContributorSubmissionInputSchema`, generates the canonical `contrib_<id>`, initializes status to `SUBMITTED`, records an immutable audit log entry in `audit_logs`, and returns `{ contributionId, ... }` to the client.
  - The client proceeds to upload media files to Storage **only after receiving the contribution ID**.

### 1.2 Storage Ownership & Asset Protection
- **Ownership Verification:** Storage security rules verify `firestore.get(/databases/(default)/documents/contributions/$(contributionId)).data.submission.contributorId == request.auth.uid`.
- **Media Path Restrictions:** Uploads are strictly restricted to `contributions/{contributionId}/{mediaType}/{fileName}` where `mediaType in ['photos', 'audio']`.
- **MIME & Size Restrictions:**
  - `photos`: `image/jpeg` or `image/png`, maximum $10\text{ MB}$.
  - `audio`: `audio/mp4`, `audio/aac`, or `audio/x-m4a`, maximum $25\text{ MB}$.
- **Immutability & Anti-Deletion:**
  - `allow create`: Permitted for authenticated contribution owner matching all MIME and size rules.
  - `allow update: if false;`: **Overwriting uploaded media is strictly prohibited.**
  - `allow delete: if false;`: **Clients cannot delete media assets once uploaded.** Cleanup is reserved for Admin SDK moderation jobs.

### 1.3 Trusted AI Operations
- **Problem:** Ordinary authenticated clients must not be able to forge AI extraction results or mark assets as failed.
- **Resolution:**
  - `saveAiResult` and `markAssetAsFailed` callables enforce caller privileges:
    `request.auth.token.role in ['ADMIN', 'MODERATOR'] || request.auth.token.admin == true`.
    Ordinary clients calling these endpoints receive an immediate `permission-denied` HttpsError.
  - **Primary B2 Invocation Mechanism (In-Process):**
    Because B2 runs server-side in Cloud Functions within the same repository (`functions/src/ai/`), Developer B imports the shared persistence services directly:
    ```typescript
    import { saveAiExtractionResult, markAssetFailed } from '../contributions/services/asset-persistence.service.js';
    ```
    This bypasses network hops, eliminates client vulnerability, and runs securely via the Firebase Admin SDK.

### 1.4 B2 Reactive Processing Flow & Triggers
- **Implemented Triggers:**
  - `onContributionCreated` (`contributions/{contributionId}`): Cloud Functions v2 trigger that logs the event and initializes the pipeline audit trail.
  - `onAssetCreated` (`contributions/{contributionId}/assets/{assetId}`): Reactive trigger that fires when `recordAssetUpload` persists a new asset. This notifies or dispatches the asset for B2 multimodal extraction.
- **Agreed Flow:**
  ```
  1. Client calls submitContribution({ mapsLink, infoParagraph, contributorId })
     -> Backend creates doc (status: SUBMITTED), returns contributionId
  2. Client uploads media to Storage at contributions/{contributionId}/{mediaType}/{assetId}.*
     -> Storage rules verify submission.contributorId == auth.uid, enforce MIME & size
  3. Client calls recordAssetUpload({ contributionId, assetType, storagePath, downloadUrl, ... })
     -> Backend registers asset doc (status: UPLOADED)
  4. onAssetCreated trigger fires in Cloud Functions
  5. Developer B (B2) runs Gemini multimodal extraction
  6. B2 calls saveAiExtractionResult(contributionId, assetId, result) in-process
     -> Atomically updates asset to COMPLETED and parent contribution to AI_ANALYZED
  7. If hard unrecoverable Gemini error occurs, B2 calls markAssetFailed(contributionId, assetId, errMsg)
  ```

---

## 2. Testing & Verification Limitations Note
- Static syntax, structural pattern validation, and contract integrity are verified using Node.js test runner in `functions/tests/contributions.test.ts`.
- **Notice on Rules Verification:** Live emulator-based rules unit tests (`@firebase/rules-unit-testing`) are NOT configured in the repository; the rules have been verified via static AST/pattern analysis and internal logic tests. End-to-end enforcement will be validated when the Firebase emulator suite runs with test credentials.
