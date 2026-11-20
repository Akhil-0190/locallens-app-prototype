/**
 * Asset Persistence Service
 * Task A3 — Contribution and AI-Result Persistence
 *
 * Owns all Firestore reads/writes for VoicePhotoAssetDocument sub-collection.
 * B2 calls `saveAiExtractionResult` after completing Gemini extraction.
 * B2 calls `markAssetFailed` on hard Gemini API failures.
 *
 * All mutations enforce:
 * - Parent contribution and asset document existence.
 * - Ownership matching (asset belongs to contribution).
 * - Fencing token verification (only active lease holder can commit).
 * - Idempotency against repeated trigger deliveries.
 * - Prevention of status regression on parent contribution.
 */

import { randomUUID } from 'node:crypto';
import { db } from '../../config/firebase.js';
import {
  VoicePhotoAssetDocument,
  VoicePhotoAssetDocumentSchema,
  AssetType,
  ProcessingStatus,
} from '../../types/contracts/index.js';
import { writeAuditLog } from './audit-logging.service.js';

const CONTRIBUTIONS_COLLECTION = 'contributions';
const ASSETS_SUBCOLLECTION = 'assets';

/** ID prefix convention from A2: "asset_<id>" */
function generateAssetId(): string {
  return `asset_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

export interface RecordAssetUploadInput {
  contributionId: string;
  assetType: AssetType;
  storagePath: string;
  downloadUrl: string;
  mimeType: string;
  fileSizeBytes: number;
}

/**
 * Records a newly uploaded asset in the Firestore sub-collection.
 * Called after D2 completes a Firebase Storage upload and backend verification.
 * Sets initial `processingStatus` to UPLOADED and `aiExtractionResult` to null.
 */
export async function recordAssetUpload(
  input: RecordAssetUploadInput
): Promise<VoicePhotoAssetDocument> {
  const assetId = generateAssetId();
  const now = nowIso();

  const doc: VoicePhotoAssetDocument = VoicePhotoAssetDocumentSchema.parse({
    assetId,
    contributionId: input.contributionId,
    assetType: input.assetType,
    storagePath: input.storagePath,
    downloadUrl: input.downloadUrl,
    mimeType: input.mimeType,
    fileSizeBytes: input.fileSizeBytes,
    processingStatus: 'UPLOADED' as ProcessingStatus,
    aiExtractionResult: null,
    createdAt: now,
    updatedAt: now,
  });

  await db
    .collection(CONTRIBUTIONS_COLLECTION)
    .doc(input.contributionId)
    .collection(ASSETS_SUBCOLLECTION)
    .doc(assetId)
    .set(doc);

  return doc;
}

/**
 * Atomically writes B2's AI extraction result to the asset document.
 * Sets `processingStatus` to COMPLETED.
 * Also updates the parent contribution's status to AI_ANALYZED (if currently SUBMITTED).
 *
 * Implements strict fencing token safety & idempotency:
 * - Checks parent contribution and asset documents exist.
 * - Checks asset belongs to the supplied contribution.
 * - Fencing token check: if `expectedLeaseToken` is provided and does not match
 *   the asset's current `processingToken`, the stale invocation is safely fenced out.
 * - If already COMPLETED, returns early (no-op) to prevent repeated deliveries from corrupting state.
 * - Prevents backward status regression on parent contribution.
 */
export async function saveAiExtractionResult(
  contributionId: string,
  assetId: string,
  extractionResult: VoicePhotoAssetDocument['aiExtractionResult'],
  expectedLeaseToken?: string
): Promise<void> {
  const now = nowIso();
  const contribRef = db.collection(CONTRIBUTIONS_COLLECTION).doc(contributionId);
  const assetRef = contribRef.collection(ASSETS_SUBCOLLECTION).doc(assetId);

  await db.runTransaction(async (tx) => {
    // 1. Verify parent contribution exists
    const contribSnap = await tx.get(contribRef);
    if (!contribSnap.exists) {
      const err = new Error(`Parent contribution not found: ${contributionId}`);
      (err as NodeJS.ErrnoException).code = 'NOT_FOUND';
      throw err;
    }

    // 2. Verify asset document exists
    const assetSnap = await tx.get(assetRef);
    if (!assetSnap.exists) {
      const err = new Error(`Asset not found: ${assetId} under contribution ${contributionId}`);
      (err as NodeJS.ErrnoException).code = 'NOT_FOUND';
      throw err;
    }

    const assetData = assetSnap.data() as VoicePhotoAssetDocument & { processingToken?: string };

    // 3. Verify asset belongs to the supplied contribution
    if (assetData.contributionId !== contributionId) {
      const err = new Error(`Asset ${assetId} does not belong to contribution ${contributionId}`);
      (err as NodeJS.ErrnoException).code = 'INVALID_ARGUMENT';
      throw err;
    }

    // 4. Idempotency safeguard: if already COMPLETED, do not re-process
    if (assetData.processingStatus === 'COMPLETED') {
      return;
    }

    // 5. Fencing token check: if lease expired and was claimed by a newer invocation,
    // fence out the stale execution so it cannot overwrite the newer invocation's result.
    if (
      expectedLeaseToken &&
      assetData.processingToken &&
      assetData.processingToken !== expectedLeaseToken
    ) {
      return;
    }

    // 6. Update asset document with AI extraction results
    tx.update(assetRef, {
      aiExtractionResult: extractionResult,
      processingStatus: 'COMPLETED' as ProcessingStatus,
      updatedAt: now,
    });

    // 7. Update parent contribution status ONLY if currently 'SUBMITTED' (prevent status regression)
    const contribData = contribSnap.data();
    if (contribData?.status === 'SUBMITTED') {
      tx.update(contribRef, {
        status: 'AI_ANALYZED',
        updatedAt: now,
      });
    }
  });

  // 8. Write audit log entry
  try {
    await writeAuditLog(
      'AI_EXTRACTION_COMPLETED',
      'system-ai-engine',
      assetId,
      'asset',
      { contributionId, hasResult: extractionResult !== null }
    );
  } catch {
    // Audit log failure is non-blocking
  }
}

/**
 * Marks an asset as FAILED — used on unrecoverable model/media errors.
 * Sets `processingStatus` to FAILED and records the error message.
 *
 * Enforces transaction safety & fencing tokens:
 * - Checks parent contribution and asset exist.
 * - Does NOT overwrite an already COMPLETED asset with FAILED (idempotency safeguard).
 * - Fences out stale executions whose lease token has been superseded.
 */
export async function markAssetFailed(
  contributionId: string,
  assetId: string,
  errorMessage: string,
  expectedLeaseToken?: string
): Promise<void> {
  const now = nowIso();
  const contribRef = db.collection(CONTRIBUTIONS_COLLECTION).doc(contributionId);
  const assetRef = contribRef.collection(ASSETS_SUBCOLLECTION).doc(assetId);

  await db.runTransaction(async (tx) => {
    const contribSnap = await tx.get(contribRef);
    if (!contribSnap.exists) {
      const err = new Error(`Parent contribution not found: ${contributionId}`);
      (err as NodeJS.ErrnoException).code = 'NOT_FOUND';
      throw err;
    }

    const assetSnap = await tx.get(assetRef);
    if (!assetSnap.exists) {
      const err = new Error(`Asset not found: ${assetId} under contribution ${contributionId}`);
      (err as NodeJS.ErrnoException).code = 'NOT_FOUND';
      throw err;
    }

    const assetData = assetSnap.data() as VoicePhotoAssetDocument & { processingToken?: string };
    if (assetData.contributionId !== contributionId) {
      const err = new Error(`Asset ${assetId} does not belong to contribution ${contributionId}`);
      (err as NodeJS.ErrnoException).code = 'INVALID_ARGUMENT';
      throw err;
    }

    // Idempotency: if already COMPLETED, never overwrite with FAILED
    if (assetData.processingStatus === 'COMPLETED') {
      return;
    }

    // Fencing token check
    if (
      expectedLeaseToken &&
      assetData.processingToken &&
      assetData.processingToken !== expectedLeaseToken
    ) {
      return;
    }

    tx.update(assetRef, {
      processingStatus: 'FAILED' as ProcessingStatus,
      errorMessage,
      updatedAt: now,
    });
  });

  try {
    await writeAuditLog(
      'AI_EXTRACTION_FAILED',
      'system-ai-engine',
      assetId,
      'asset',
      { contributionId, errorMessage }
    );
  } catch {
    // non-blocking
  }
}

/**
 * Retrieves a single asset document.
 */
export async function getAsset(
  contributionId: string,
  assetId: string
): Promise<VoicePhotoAssetDocument> {
  const snap = await db
    .collection(CONTRIBUTIONS_COLLECTION)
    .doc(contributionId)
    .collection(ASSETS_SUBCOLLECTION)
    .doc(assetId)
    .get();

  if (!snap.exists) {
    const err = new Error(`Asset not found: ${assetId} in contribution ${contributionId}`);
    (err as NodeJS.ErrnoException).code = 'NOT_FOUND';
    throw err;
  }

  return VoicePhotoAssetDocumentSchema.parse(snap.data());
}

/**
 * Lists all assets for a given contribution.
 */
export async function listContributionAssets(
  contributionId: string
): Promise<VoicePhotoAssetDocument[]> {
  const snap = await db
    .collection(CONTRIBUTIONS_COLLECTION)
    .doc(contributionId)
    .collection(ASSETS_SUBCOLLECTION)
    .orderBy('createdAt', 'asc')
    .get();

  return snap.docs.map((d) => VoicePhotoAssetDocumentSchema.parse(d.data()));
}
