/**
 * Asset Persistence Service
 * Task A3 — Contribution and AI-Result Persistence
 *
 * Owns all Firestore reads/writes for VoicePhotoAssetDocument sub-collection.
 * B2 calls `saveAiExtractionResult` after completing Gemini extraction.
 * B2 calls `markAssetFailed` on hard Gemini API failures.
 * Clients may never write `aiExtractionResult`, `processingStatus`, or `errorMessage` directly.
 */

import { randomUUID } from 'node:crypto';
import { db } from '../../config/firebase.js';
import {
  VoicePhotoAssetDocument,
  VoicePhotoAssetDocumentSchema,
  AssetType,
  ProcessingStatus,
} from '../../types/contracts/index.js';

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
 * Called after D2 completes a Firebase Storage upload.
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
 * Also updates the parent contribution's status to AI_ANALYZED and updatedAt.
 *
 * Called ONLY by B2 (server-side) after a successful Gemini pass.
 * Uses Firestore batch to atomically update both asset and contribution.
 */
export async function saveAiExtractionResult(
  contributionId: string,
  assetId: string,
  extractionResult: VoicePhotoAssetDocument['aiExtractionResult']
): Promise<void> {
  const batch = db.batch();
  const now = nowIso();

  const assetRef = db
    .collection(CONTRIBUTIONS_COLLECTION)
    .doc(contributionId)
    .collection(ASSETS_SUBCOLLECTION)
    .doc(assetId);

  const contributionRef = db.collection(CONTRIBUTIONS_COLLECTION).doc(contributionId);

  batch.update(assetRef, {
    aiExtractionResult: extractionResult,
    processingStatus: 'COMPLETED' as ProcessingStatus,
    updatedAt: now,
  });

  batch.update(contributionRef, {
    status: 'AI_ANALYZED',
    updatedAt: now,
  });

  await batch.commit();
}

/**
 * Marks an asset as FAILED — used by B2 on hard Gemini API errors.
 * Sets `processingStatus` to FAILED and records the error message.
 * Does NOT update the parent contribution status (SUBMITTED remains until manually reviewed).
 */
export async function markAssetFailed(
  contributionId: string,
  assetId: string,
  errorMessage: string
): Promise<void> {
  await db
    .collection(CONTRIBUTIONS_COLLECTION)
    .doc(contributionId)
    .collection(ASSETS_SUBCOLLECTION)
    .doc(assetId)
    .update({
      processingStatus: 'FAILED' as ProcessingStatus,
      errorMessage,
      updatedAt: nowIso(),
    });
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
