# A3 Coordination & Integration Notes — Contribution and AI-Result Persistence

**Task:** A3 — Contribution and AI-Result Persistence
**Branch:** `feature/A3-contribution-backend`
**Base Commit (Synchronized):** `8019749` (merged PRs #6 C2, #7 D2, #8 C3, #10 B2)
**Author:** Developer A
**Date:** 2026-11-20
**Status:** Synchronized with all merged dependencies (B1–B2, D1–D2, C1–C3, A1–A2)

---

## 1. Synchronization and Repository Integration Status

The A3 branch has been cleanly merged with `origin/main` at commit `8019749`, incorporating:
- **B1 → B2:** Regional-language voice extraction, multimodal photo understanding & OCR, and spot card synthesis.
- **D1 → D2:** Local contributor experience, voice recording UI, regional language selection, preview sheet, and pipeline tracking.
- **C1 → C3:** Google Maps Places grounding, URL parsing, verification evidence, and walking routes generation.
- **A1 → A2:** Firebase foundation, canonical contracts (12 domains), security baselines, and API envelopes.

**Reconciled Files:**
- `functions/package.json`: Consolidated test scripts so that `npm test` runs all foundation, contract, contribution, and maps test suites in a single command.

---

## 2. Reassessment Against Merged Implementations

### 2.1 Developer B (Task B2 Integration & Defect Coordination)
- **Ingestion Entry Points:**
  - `extractVoiceNoteDetails(input: VoiceExtractionInput): Promise<VoiceExtractionOutput>`
  - `extractPhotoDetails(input: PhotoExtractionInput): Promise<PhotoExtractionOutput>`
  - `synthesizeSpotCard(input: SpotCardSynthesisInput): CanonicalPlaceDocument`
- **Output Contracts:** Aligned 1:1 with Domain 04 `VoicePhotoAssetDocument.aiExtractionResult`.
- **Coordination of B2 Defect Reported to Developer B:**
  - **Issue:** In `spot-card-synthesis-service.ts` line 54, `(input.photoExtractions || []).map((p) => p.practicalDetails)` throws `TypeError: Cannot read properties of null (reading 'practicalDetails')` when an extraction result is null (which occurs whenever model extraction encounters temporary unavailability or returns null).
  - **Required Fix (by Developer B):** In `spot-card-synthesis-service.ts`:
    - Line 53: `(input.voiceExtractions || []).map((v) => v?.practicalDetails).filter(Boolean)`
    - Line 54: `(input.photoExtractions || []).map((p) => p?.practicalDetails).filter(Boolean)`
    - Line 81: `(input.photoExtractions || []).flatMap((p) => p?.ocrDetectedText || [])`
  - **Status:** Reported to Developer B. B's fix has not yet been merged into `main`. The standalone live integration script `npm run test:b2` is currently failing on Test Suite 5 solely due to this defect in B2 code.

### 2.2 Developer D (Task D2 Integration)
- **Client Submission Flow:**
  - `ContributionService.submitContribution` currently uses `useMockPipeline: true` as agreed until A3/B2 are deployed.
  - In live mode, client submits contribution stub, receives `contributionId`, then uploads media files to `contributions/{contributionId}/{photos|audio}/`.
  - Client tracking: `trackContributionPipeline` subscribes to real-time snapshots on `contributions/{contributionId}`. Firestore security rules grant read access to the contributor (`isContributionOwner`), enabling seamless live streaming.

### 2.3 Developer C (Task C1–C3 Integration)
- **Grounding Integration:**
  - C2's `GroundingService.groundContributedPlace` accepts `ContributedPlaceInput` and produces `GroundedPlaceResult`.
  - C2 will be triggered downstream once status reaches `AI_ANALYZED`. A3 guards parent contribution status transitions to ensure status does not regress backwards.

---

## 3. Resolution of Review Points

### 3.1 Canonical MIME Validation Consistency
A single, strictly consistent canonical allowed MIME list is enforced identically across Storage security rules, Cloud Functions controller, and B2 ingestion handlers:
- **Photos (`mediaType == 'photos'`):**
  - Canonical: `image/jpeg`, `image/png`
  - Max Size: $10\text{ MB}$ ($10,485,760\text{ bytes}$)
- **Audio (`mediaType == 'audio'`):**
  - Canonical: `audio/mp4`, `audio/aac`, `audio/x-m4a`
  - Max Size: $25\text{ MB}$ ($26,214,400\text{ bytes}$)

Any file outside this canonical set is rejected at the Storage security rule layer and rejected by `recordAssetUpload`.

### 3.2 Fencing Token Lease Safety & Interrupted Trigger Recovery (`onAssetCreated`)
The `onAssetCreated` reactive trigger implements a comprehensive fencing-token recovery strategy:
1. **Concurrent Trigger Deliveries:**
   An atomic Firestore transaction claims `processingStatus: 'UPLOADED'` $\to$ `'PROCESSING'` and sets a unique `processingToken: randomUUID()`. Any concurrent trigger instance sees `'PROCESSING'` (< 5 min old) and exits immediately without executing Gemini.
2. **Fencing Token Protection against Stale Invocations:**
   If invocation A claims the lease, takes $> 5\text{ minutes}$, and invocation B re-claims the expired lease with a new token `leaseToken_B`:
   When invocation A eventually finishes and calls `saveAiExtractionResult(..., leaseToken_A)`, the transaction checks `assetData.processingToken === leaseToken_A`. Because the token in Firestore is now `leaseToken_B`, invocation A is **fenced out** and its commit is discarded. Only the current lease holder can finalize processing.
3. **Function Crashes After Claiming (OOM / SIGKILL / Timeout):**
   `PROCESSING_LEASE_TIMEOUT_MS = 5 * 60 * 1000` (5 minutes). If a container terminates abruptly while in `'PROCESSING'`, subsequent retries check `Date.now() - updatedAt > 5 min` and safely re-claim the expired lease to complete processing.
   *(Note: No background reconciliation cron job is currently implemented; recovery relies on Cloud Functions automatic retries and reactive triggers.)*
4. **Temporary Storage Download Failures:**
   If `file.download()` throws a network error, the trigger catch block explicitly reverts the asset status back to `'UPLOADED'` and re-throws the error. This signals Cloud Functions v2 to retry with exponential backoff and allows the retry to immediately re-claim the asset.
5. **Permanent Model / Audio Failures:**
   When input is silent, corrupted, or rejected by model guardrails, B2 returns `processingStatus: 'FAILED'`. `markAssetFailed` records `'FAILED'` and the descriptive error message with the fencing token.

### 3.3 Asset Upload Verification & Trusted Download URL with Token
- **Path Verification:** `storagePath` is verified via regex `^contributions/{contributionId}/(photos|audio)/[a-zA-Z0-9_.-]+$`.
- **Contribution Ownership:** Verifies that parent contribution exists and `submission.contributorId == request.auth.uid`.
- **Storage Object Verification via Admin SDK:** Verifies `file.exists()`, actual `meta.contentType`, and actual `meta.size`.
- **Trusted Download URL Derivation:**
  - Removed any hardcoded fallback bucket name (`bucket.name` is strictly required).
  - Inspects `metadata.metadata.firebaseStorageDownloadTokens` on the Cloud Storage object. If missing, generates a secure `randomUUID()` token and attaches it to the object metadata.
  - Derives the canonical Firebase Storage URL with the valid `&token=${token}` parameter, allowing D2's Flutter UI (`Image.network`, audioplayers) to retrieve the media seamlessly without 403 Forbidden errors.

### 3.4 Persistence Idempotency and State Validation
- **Transaction Safety in `saveAiExtractionResult` & `markAssetFailed`:**
  1. Verifies parent contribution and asset documents exist.
  2. Asserts `assetData.contributionId === contributionId`.
  3. If asset is already `COMPLETED`, returns early as a clean no-op.
  4. Fencing token check discards any write from a stale/expired lease holder.
  5. Transitions parent contribution status to `AI_ANALYZED` **only if** current status is `SUBMITTED`. If already `MAPS_GROUNDED` or `VERIFIED`, status is preserved.
  6. Anti-overwrite protection: `markAssetFailed` will **never** overwrite an already `COMPLETED` asset.

---

## 4. Test Strategy and Delineation

To maintain absolute clarity regarding test coverage:
1. **A3 Deterministic Unit Tests:**
   - Command: `npm run functions:test`
   - Execution: Node.js native test runner on compiled TypeScript.
   - Status: **80 passed, 0 failed across 21 test suites** (includes all A1, A2, A3, C1, C2, C3 unit tests).
   - Scope: Offline, mocked/static, zero network access, zero live API costs.
2. **B2 Unit/Integration Tests:**
   - Command: `npm run test:b2` (`tsx test/test-b2-voice-photo-extraction.ts`)
   - Execution: Standalone tsx execution making live multimodal Gemini calls.
   - Status: **Failing on Test Suite 5** due to the null-check defect in Developer B's `spot-card-synthesis-service.ts`. Suites 1, 2, and 4 pass when executed with network access and API credentials.
3. **Live Gemini End-to-End Pipeline:**
   - Status: **PARTIALLY VERIFIED / PENDING DEVELOPER B DEFECT FIX**.

---

## 5. Git & Commit Disclosure

- **Local Commits Created on this Branch:**
  - Commit `f3bb9bb`: `wip: A3 baseline before rebasing on main` (local safety commit before merging `origin/main`).
  - Commit `72da1ac`: `Merge origin/main into feature/A3-contribution-backend` (local merge commit integrating `origin/main` at `8019749`).
- **Remote Push Status:** **No commits have been pushed to origin.** The remote branch `origin/feature/A3-contribution-backend` does not exist on GitHub. All commits reside strictly on this local machine.
- **Current Working Tree:** Clean staged changes ready for review. No PR has been opened.
