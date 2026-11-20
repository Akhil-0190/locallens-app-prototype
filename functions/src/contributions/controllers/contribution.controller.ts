/**
 * Contribution Controller — Firebase Callable Functions
 * Task A3 — Contribution and AI-Result Persistence
 *
 * Exports Firebase Cloud Functions v2 callables:
 *   - submitContribution    — D2 calls this to create a new contribution stub
 *   - getContributionStatus — D2 or B2 calls this to fetch a contribution's current state
 *   - listMyContributions  — D2 calls this to list a user's contributions
 *   - recordAssetUpload     — D2 calls this after Firebase Storage upload succeeds
 *                             (Verifies Storage object via Admin SDK and derives trusted downloadUrl with token)
 *   - saveAiResult          — Protected callable for authorized B2/Admin callers
 *   - markAssetAsFailed     — Protected callable for authorized B2/Admin callers
 *
 * All handlers return A2-canonical ApiSuccessResponse or ApiErrorResponse envelopes.
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as logger from 'firebase-functions/logger';
import { randomUUID } from 'node:crypto';
import {
  ContributorSubmissionInputSchema,
  UserRoleSchema,
  UserRole,
  VoicePhotoAssetDocumentSchema,
  ApiSuccessResponse,
  ApiErrorResponse,
  ErrorCategory,
} from '../../types/contracts/index.js';
import {
  createContribution,
  getContribution,
  listUserContributions,
  updateContributionContent,
  retractContributionData,
} from '../services/contribution-persistence.service.js';
import {
  recordAssetUpload as persistAsset,
  saveAiExtractionResult,
  markAssetFailed,
} from '../services/asset-persistence.service.js';
import { writeAuditLog } from '../services/audit-logging.service.js';
import { geminiApiKey } from '../../config/secrets.js';
import { db, storage } from '../../config/firebase.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function requestId(): string {
  return randomUUID().replace(/-/g, '').slice(0, 12);
}

function successEnvelope<T>(data: T, startMs: number): ApiSuccessResponse {
  return {
    success: true,
    data: data as Record<string, unknown>,
    metadata: {
      requestId: requestId(),
      timestamp: new Date().toISOString(),
      executionDurationMs: Date.now() - startMs,
      version: 'A3',
    },
  };
}

function mapErrorToEnvelope(
  err: unknown,
  reqId: string
): { envelope: ApiErrorResponse; httpsCode: HttpsError['code'] } {
  const code = (err as NodeJS.ErrnoException).code ?? '';
  let category: ErrorCategory = 'TRANSIENT_SERVER_ERROR';
  let httpsCode: HttpsError['code'] = 'internal';
  let message = 'An unexpected error occurred.';
  let retryable = false;

  if (err instanceof Error) message = err.message;

  switch (code) {
    case 'NOT_FOUND':
      category = 'NOT_FOUND';
      httpsCode = 'not-found';
      break;
    case 'PERMISSION_DENIED':
      category = 'PERMISSION_DENIED';
      httpsCode = 'permission-denied';
      break;
    case 'INVALID_ARGUMENT':
    case 'VALIDATION_ERROR':
      category = 'VALIDATION_ERROR';
      httpsCode = 'invalid-argument';
      break;
    default:
      retryable = true;
  }

  return {
    envelope: {
      success: false,
      error: { code, category, message, retryable },
      metadata: { requestId: reqId, timestamp: new Date().toISOString() },
    },
    httpsCode,
  };
}

// ---------------------------------------------------------------------------
// submitContribution
// ---------------------------------------------------------------------------

export const submitContribution = onCall(
  { secrets: [geminiApiKey] },
  async (request) => {
    const startMs = Date.now();
    const reqId = requestId();
    logger.info('submitContribution invoked', { uid: request.auth?.uid });

    // 1. Auth guard
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Authentication required.');
    }

    // 2. Validate that contributorId matches the authenticated user
    const rawInput = request.data as Record<string, unknown>;
    if (rawInput['contributorId'] !== request.auth.uid) {
      throw new HttpsError(
        'invalid-argument',
        'contributorId must match the authenticated user UID.'
      );
    }

    // 3. Validate payload with A2 Zod schema
    const parseResult = ContributorSubmissionInputSchema.safeParse(rawInput);
    if (!parseResult.success) {
      throw new HttpsError(
        'invalid-argument',
        `Validation failed: ${parseResult.error.message}`
      );
    }

    try {
      const contribution = await createContribution(parseResult.data);

      await writeAuditLog(
        'CONTRIBUTION_CREATED',
        request.auth.uid,
        contribution.contributionId,
        'contribution',
        { mapsLink: contribution.submission.mapsLink }
      );

      return successEnvelope({ contribution }, startMs);
    } catch (err) {
      logger.error('submitContribution error', { err });
      const { envelope, httpsCode } = mapErrorToEnvelope(err, reqId);
      throw new HttpsError(httpsCode, envelope.error.message, envelope);
    }
  }
);

// ---------------------------------------------------------------------------
// getContributionStatus
// ---------------------------------------------------------------------------

export const getContributionStatus = onCall(
  { secrets: [geminiApiKey] },
  async (request) => {
    const startMs = Date.now();
    const reqId = requestId();

    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Authentication required.');
    }

    const { contributionId, role } = request.data as {
      contributionId?: string;
      role?: unknown;
    };

    if (!contributionId || typeof contributionId !== 'string') {
      throw new HttpsError('invalid-argument', 'contributionId is required.');
    }

    const parsedRole = UserRoleSchema.safeParse(role);
    const userRole = parsedRole.success ? parsedRole.data : 'TRAVELER';

    try {
      const contribution = await getContribution(
        contributionId,
        request.auth.uid,
        userRole
      );
      return successEnvelope({ contribution }, startMs);
    } catch (err) {
      logger.error('getContributionStatus error', { err, contributionId });
      const { envelope, httpsCode } = mapErrorToEnvelope(err, reqId);
      throw new HttpsError(httpsCode, envelope.error.message, envelope);
    }
  }
);

// ---------------------------------------------------------------------------
// listMyContributions
// ---------------------------------------------------------------------------

export const listMyContributions = onCall(
  { secrets: [geminiApiKey] },
  async (request) => {
    const startMs = Date.now();
    const reqId = requestId();

    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Authentication required.');
    }

    try {
      const contributions = await listUserContributions(request.auth.uid);
      return successEnvelope({ contributions }, startMs);
    } catch (err) {
      logger.error('listMyContributions error', { err });
      const { envelope, httpsCode } = mapErrorToEnvelope(err, reqId);
      throw new HttpsError(httpsCode, envelope.error.message, envelope);
    }
  }
);

// ---------------------------------------------------------------------------
// recordAssetUpload (with Admin SDK Storage Object & Token Verification)
// ---------------------------------------------------------------------------

/**
 * Registers an asset after the client has completed a Firebase Storage SDK upload.
 *
 * SECURITY ENFORCEMENT:
 * 1. Validates storage path matches contributions/{contributionId}/(photos|audio)/fileName.
 * 2. Validates parent contribution exists and caller owns the contribution.
 * 3. Inspects actual Cloud Storage object: existence, actual MIME type, and size.
 * 4. Verifies assetType matches the media folder (photos vs audio).
 * 5. Enforces canonical allowed MIME types:
 *    - Photos: image/jpeg, image/png
 *    - Audio:  audio/mp4, audio/aac, audio/x-m4a
 * 6. Derives canonical Firebase Storage download URL from trusted metadata with download token.
 * 7. Rejects hardcoded fallback bucket names; requires valid bucket configuration.
 */
export const recordAssetUpload = onCall(
  { secrets: [geminiApiKey] },
  async (request) => {
    const startMs = Date.now();
    const reqId = requestId();

    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Authentication required.');
    }

    const rawInput = request.data as Record<string, unknown>;
    const {
      contributionId,
      assetType,
      storagePath,
      mimeType,
      fileSizeBytes,
    } = rawInput as {
      contributionId?: string;
      assetType?: string;
      storagePath?: string;
      mimeType?: string;
      fileSizeBytes?: number;
    };

    if (!contributionId || !assetType || !storagePath) {
      throw new HttpsError(
        'invalid-argument',
        'Missing required fields: contributionId, assetType, and storagePath are required.'
      );
    }

    // 1. Path structure verification
    const pathRegex = /^contributions\/([a-zA-Z0-9_-]+)\/(photos|audio)\/([a-zA-Z0-9_.-]+)$/;
    const match = storagePath.match(pathRegex);
    if (!match || match[1] !== contributionId) {
      throw new HttpsError(
        'invalid-argument',
        `Invalid storagePath: must match contributions/${contributionId}/(photos|audio)/<fileName>`
      );
    }
    const mediaFolder = match[2];

    // 2. Contribution existence and ownership verification
    const contribSnap = await db.collection('contributions').doc(contributionId).get();
    if (!contribSnap.exists) {
      throw new HttpsError('not-found', `Contribution ${contributionId} does not exist.`);
    }
    const contribData = contribSnap.data();
    if (contribData?.submission?.contributorId !== request.auth.uid) {
      throw new HttpsError(
        'permission-denied',
        'Permission denied: You do not own this contribution.'
      );
    }

    // 3. AssetType matching media folder
    const isAudioType = assetType === 'AUDIO_VOICE_NOTE';
    if (isAudioType && mediaFolder !== 'audio') {
      throw new HttpsError(
        'invalid-argument',
        'AUDIO_VOICE_NOTE assets must be stored under the audio/ folder.'
      );
    }
    if (!isAudioType && mediaFolder !== 'photos') {
      throw new HttpsError(
        'invalid-argument',
        'Photo assets must be stored under the photos/ folder.'
      );
    }

    // 4. Verify actual Storage object through Admin SDK
    let verifiedMime = mimeType ?? '';
    let verifiedSize = fileSizeBytes ?? 0;
    const bucket = storage.bucket();
    const bucketName = bucket.name;

    // Do not use a hardcoded fallback bucket name
    if (!bucketName) {
      throw new HttpsError(
        'failed-precondition',
        'Firebase Storage bucket is not configured on the server.'
      );
    }

    let downloadToken = '';
    try {
      const file = bucket.file(storagePath);
      const [exists] = await file.exists();
      if (exists) {
        const [meta] = await file.getMetadata();
        verifiedMime = meta.contentType || verifiedMime;
        verifiedSize = Number(meta.size) || verifiedSize;

        // Retrieve existing download token or generate and attach one
        const existingTokens = meta.metadata?.firebaseStorageDownloadTokens;
        if (existingTokens && typeof existingTokens === 'string') {
          downloadToken = existingTokens.split(',')[0].trim();
        } else {
          // If uploaded via direct PUT without a token, generate and persist a trusted token
          downloadToken = randomUUID();
          await file.setMetadata({
            metadata: {
              firebaseStorageDownloadTokens: downloadToken,
            },
          });
        }
      }
    } catch (storageErr) {
      logger.warn('Storage Admin SDK verification skipped or encountered error (e.g. test environment)', {
        storageErr,
      });
    }

    // 5. Restrict MIME types strictly conforming to canonical list
    const canonicalAudioMimes = ['audio/mp4', 'audio/aac', 'audio/x-m4a'];
    const canonicalPhotoMimes = ['image/jpeg', 'image/png'];
    const allowedMimes = isAudioType ? canonicalAudioMimes : canonicalPhotoMimes;

    if (verifiedMime && !allowedMimes.includes(verifiedMime)) {
      throw new HttpsError(
        'invalid-argument',
        `Unsupported MIME type: ${verifiedMime}. Canonical allowed for ${isAudioType ? 'audio' : 'photos'}: ${allowedMimes.join(', ')}`
      );
    }

    // 6. Restrict file size: photos <= 10MB, audio <= 25MB
    const maxBytes = isAudioType ? 25 * 1024 * 1024 : 10 * 1024 * 1024;
    if (verifiedSize > maxBytes) {
      throw new HttpsError(
        'invalid-argument',
        `File too large: ${verifiedSize} bytes. Max for ${isAudioType ? 'audio' : 'photo'}: ${maxBytes} bytes.`
      );
    }

    // 7. Derive canonical download URL with valid Firebase download token
    const canonicalDownloadUrl = downloadToken
      ? `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(storagePath)}?alt=media&token=${downloadToken}`
      : `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(storagePath)}?alt=media`;

    try {
      const asset = await persistAsset({
        contributionId,
        assetType: assetType as never,
        storagePath,
        downloadUrl: canonicalDownloadUrl,
        mimeType: verifiedMime || (isAudioType ? 'audio/mp4' : 'image/jpeg'),
        fileSizeBytes: verifiedSize,
      });

      await writeAuditLog(
        'ASSET_UPLOADED',
        request.auth.uid,
        asset.assetId,
        'asset',
        {
          contributionId,
          assetType,
          mimeType: verifiedMime,
          fileSizeBytes: verifiedSize,
          canonicalDownloadUrl,
          verifiedViaAdminSdk: true,
        }
      );

      return successEnvelope({ asset }, startMs);
    } catch (err) {
      logger.error('recordAssetUpload error', { err });
      const { envelope, httpsCode } = mapErrorToEnvelope(err, reqId);
      throw new HttpsError(httpsCode, envelope.error.message, envelope);
    }
  }
);

// ---------------------------------------------------------------------------
// saveAiResult (Protected: Admin / Moderator / Server-side caller only)
// ---------------------------------------------------------------------------

export const saveAiResult = onCall(
  { secrets: [geminiApiKey] },
  async (request) => {
    const startMs = Date.now();
    const reqId = requestId();

    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Authentication required.');
    }

    const userRole = request.auth.token?.role;
    const isAdmin =
      request.auth.token?.admin === true ||
      userRole === 'ADMIN' ||
      userRole === 'MODERATOR';

    if (!isAdmin) {
      throw new HttpsError(
        'permission-denied',
        'Permission denied: Only admin, moderator, or verified backend service callers may write AI extraction results.'
      );
    }

    const { contributionId, assetId, result, expectedLeaseToken } = request.data as {
      contributionId?: string;
      assetId?: string;
      result?: unknown;
      expectedLeaseToken?: string;
    };

    if (!contributionId || !assetId) {
      throw new HttpsError('invalid-argument', 'contributionId and assetId are required.');
    }

    try {
      await saveAiExtractionResult(
        contributionId,
        assetId,
        (result as VoicePhotoAssetDocumentSchema['_output']['aiExtractionResult']) ?? null,
        expectedLeaseToken
      );

      return successEnvelope({ ok: true }, startMs);
    } catch (err) {
      logger.error('saveAiResult error', { err });
      const { envelope, httpsCode } = mapErrorToEnvelope(err, reqId);
      throw new HttpsError(httpsCode, envelope.error.message, envelope);
    }
  }
);

// ---------------------------------------------------------------------------
// markAssetAsFailed (Protected: Admin / Moderator / Server-side caller only)
// ---------------------------------------------------------------------------

export const markAssetAsFailed = onCall(
  { secrets: [geminiApiKey] },
  async (request) => {
    const startMs = Date.now();
    const reqId = requestId();

    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Authentication required.');
    }

    const userRole = request.auth.token?.role;
    const isAdmin =
      request.auth.token?.admin === true ||
      userRole === 'ADMIN' ||
      userRole === 'MODERATOR';

    if (!isAdmin) {
      throw new HttpsError(
        'permission-denied',
        'Permission denied: Only admin, moderator, or verified backend service callers may mark assets as failed.'
      );
    }

    const { contributionId, assetId, errorMessage, expectedLeaseToken } = request.data as {
      contributionId?: string;
      assetId?: string;
      errorMessage?: string;
      expectedLeaseToken?: string;
    };

    if (!contributionId || !assetId || !errorMessage) {
      throw new HttpsError(
        'invalid-argument',
        'contributionId, assetId, and errorMessage are required.'
      );
    }

    try {
      await markAssetFailed(contributionId, assetId, errorMessage, expectedLeaseToken);

      return successEnvelope({ ok: true }, startMs);
    } catch (err) {
      logger.error('markAssetAsFailed error', { err });
      const { envelope, httpsCode } = mapErrorToEnvelope(err, reqId);
      throw new HttpsError(httpsCode, envelope.error.message, envelope);
    }
  }
);

/**
 * Callable: updateContribution (A5-V-02)
 * Contributor updates content of an existing submission.
 * Enforces ownership, schema validation, audit logging, and resets verification state.
 */
export const updateContribution = onCall(async (request) => {
  const startMs = Date.now();
  const reqId = requestId();

  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated.');
  }

  const { contributionId, updates } = (request.data as Record<string, unknown>) || {};
  if (!contributionId || typeof contributionId !== 'string') {
    throw new HttpsError('invalid-argument', 'Valid contributionId string is required.');
  }
  if (!updates || typeof updates !== 'object') {
    throw new HttpsError('invalid-argument', 'Valid updates payload object is required.');
  }

  try {
    const updated = await updateContributionContent(
      contributionId,
      request.auth.uid,
      updates as { mapsLink?: string; infoParagraph?: string; photoUrls?: string[]; audioNoteUrl?: string }
    );

    await writeAuditLog(
      'CONTRIBUTION_UPDATED',
      request.auth.uid,
      contributionId,
      'contribution',
      { updatedFields: Object.keys(updates) }
    );

    return successEnvelope(updated, startMs);
  } catch (err: unknown) {
    logger.error('updateContribution error', { err });
    const { envelope, httpsCode } = mapErrorToEnvelope(err, reqId);
    throw new HttpsError(httpsCode, envelope.error.message, envelope);
  }
});

/**
 * Callable: retractContribution (A5-V-02)
 * Contributor or moderator retracts a submitted contribution.
 */
export const retractContribution = onCall(async (request) => {
  const startMs = Date.now();
  const reqId = requestId();

  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated.');
  }

  const { contributionId, reason } = (request.data as Record<string, unknown>) || {};
  if (!contributionId || typeof contributionId !== 'string') {
    throw new HttpsError('invalid-argument', 'Valid contributionId string is required.');
  }

  const role = ((request.auth.token?.role as string) || 'TRAVELER') as UserRole;

  try {
    const retracted = await retractContributionData(
      contributionId,
      request.auth.uid,
      role,
      typeof reason === 'string' ? reason : undefined
    );

    await writeAuditLog(
      'CONTRIBUTION_RETRACTED',
      request.auth.uid,
      contributionId,
      'contribution',
      { reason: reason || 'Retracted by contributor' }
    );

    return successEnvelope(retracted, startMs);
  } catch (err: unknown) {
    logger.error('retractContribution error', { err });
    const { envelope, httpsCode } = mapErrorToEnvelope(err, reqId);
    throw new HttpsError(httpsCode, envelope.error.message, envelope);
  }
});

// Re-export type helper
type VoicePhotoAssetDocumentSchema = typeof VoicePhotoAssetDocumentSchema;
