/**
 * Contribution Controller — Firebase Callable Functions
 * Task A3 — Contribution and AI-Result Persistence
 *
 * Exports three Firebase Cloud Functions v2 callables:
 *   - submitContribution  — D2 calls this to create a new contribution stub
 *   - getContributionStatus — D2 or B2 calls this to fetch a contribution's current state
 *   - recordAssetUpload   — D2 calls this after Firebase Storage SDK upload succeeds
 *   - saveAiResult        — B2 calls this after Gemini extraction completes
 *
 * All handlers return A2-canonical ApiSuccessResponse or ApiErrorResponse envelopes.
 * Clients may NEVER trigger updateContributionStatus directly.
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as logger from 'firebase-functions/logger';
import { randomUUID } from 'node:crypto';
import {
  ContributorSubmissionInputSchema,
  UserRoleSchema,
  VoicePhotoAssetDocumentSchema,
  ApiSuccessResponse,
  ApiErrorResponse,
  ErrorCategory,
} from '../../types/contracts/index.js';
import {
  createContribution,
  getContribution,
  listUserContributions,
} from '../services/contribution-persistence.service.js';
import {
  recordAssetUpload as persistAsset,
  saveAiExtractionResult,
  markAssetFailed,
} from '../services/asset-persistence.service.js';
import { writeAuditLog } from '../services/audit-logging.service.js';
import { geminiApiKey } from '../../config/secrets.js';

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

/**
 * Creates a new contribution stub in Firestore (status: SUBMITTED).
 * Called by D2 before uploading media files.
 *
 * Request payload: ContributorSubmissionInput
 *   { mapsLink, infoParagraph, photoUrls?, audioNoteUrl?, contributorId }
 *
 * Returns: ApiSuccessResponse<{ contribution: ContributionDocument }>
 */
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

/**
 * Returns the current state of a contribution document.
 * Enforces ownership: only the contributor, a MODERATOR or ADMIN may read.
 *
 * Request payload: { contributionId: string, role?: UserRole }
 *
 * Returns: ApiSuccessResponse<{ contribution: ContributionDocument }>
 */
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

/**
 * Returns all contributions submitted by the authenticated user.
 *
 * Returns: ApiSuccessResponse<{ contributions: ContributionDocument[] }>
 */
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
// recordAssetUpload
// ---------------------------------------------------------------------------

/**
 * Registers an asset after the client has completed a Firebase Storage SDK upload.
 * Called by D2 after `firebase_storage` Dart SDK upload succeeds.
 *
 * Request payload: RecordAssetUploadInput
 *   { contributionId, assetType, storagePath, downloadUrl, mimeType, fileSizeBytes }
 *
 * Returns: ApiSuccessResponse<{ asset: VoicePhotoAssetDocument }>
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

    // Validate enough of the payload to protect processing
    const partialAsset = VoicePhotoAssetDocumentSchema.partial().safeParse({
      contributionId: rawInput['contributionId'],
      assetType: rawInput['assetType'],
      storagePath: rawInput['storagePath'],
      downloadUrl: rawInput['downloadUrl'],
      mimeType: rawInput['mimeType'],
      fileSizeBytes: rawInput['fileSizeBytes'],
    });

    if (!partialAsset.success) {
      throw new HttpsError(
        'invalid-argument',
        `Asset validation failed: ${partialAsset.error.message}`
      );
    }

    const { contributionId, assetType, storagePath, downloadUrl, mimeType, fileSizeBytes } =
      rawInput as {
        contributionId: string;
        assetType: string;
        storagePath: string;
        downloadUrl: string;
        mimeType: string;
        fileSizeBytes: number;
      };

    // Restrict MIME types: images and audio only
    const allowedMimes = ['image/jpeg', 'image/png', 'audio/mp4', 'audio/aac', 'audio/x-m4a'];
    if (!allowedMimes.includes(mimeType)) {
      throw new HttpsError(
        'invalid-argument',
        `Unsupported MIME type: ${mimeType}. Allowed: ${allowedMimes.join(', ')}`
      );
    }

    // Restrict file size: photos ≤ 10 MB, audio ≤ 25 MB
    const isAudio = mimeType.startsWith('audio/');
    const maxBytes = isAudio ? 25 * 1024 * 1024 : 10 * 1024 * 1024;
    if (fileSizeBytes > maxBytes) {
      throw new HttpsError(
        'invalid-argument',
        `File too large: ${fileSizeBytes} bytes. Max for ${isAudio ? 'audio' : 'image'}: ${maxBytes} bytes.`
      );
    }

    try {
      const asset = await persistAsset({
        contributionId,
        assetType: assetType as never,
        storagePath,
        downloadUrl,
        mimeType,
        fileSizeBytes,
      });

      await writeAuditLog(
        'ASSET_UPLOADED',
        request.auth.uid,
        asset.assetId,
        'asset',
        { contributionId, assetType, mimeType, fileSizeBytes }
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

/**
 * Persists B2's Gemini extraction result for an asset.
 * SECURED: Ordinary authenticated clients CANNOT invoke this.
 * Only callers with ADMIN or MODERATOR custom claims or service tokens are authorized.
 * For primary in-process server-side execution, Developer B invokes
 * `saveAiExtractionResult` directly from `asset-persistence.service.ts`.
 *
 * Request payload: { contributionId, assetId, result: AiExtractionResult | null }
 *
 * Returns: ApiSuccessResponse<{ ok: true }>
 */
export const saveAiResult = onCall(
  { secrets: [geminiApiKey] },
  async (request) => {
    const startMs = Date.now();
    const reqId = requestId();

    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Authentication required.');
    }

    // Role check: Only ADMIN, MODERATOR, or internal server-side caller token can invoke this
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

    const { contributionId, assetId, result } = request.data as {
      contributionId?: string;
      assetId?: string;
      result?: unknown;
    };

    if (!contributionId || !assetId) {
      throw new HttpsError('invalid-argument', 'contributionId and assetId are required.');
    }

    try {
      await saveAiExtractionResult(
        contributionId,
        assetId,
        (result as VoicePhotoAssetDocumentSchema['_output']['aiExtractionResult']) ?? null
      );

      await writeAuditLog(
        'AI_EXTRACTION_COMPLETED',
        request.auth.uid,
        assetId,
        'asset',
        { contributionId, hasResult: result !== null }
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

/**
 * Marks an asset as FAILED with an error message from B2.
 * SECURED: Ordinary authenticated clients CANNOT invoke this.
 * Only callers with ADMIN or MODERATOR custom claims or service tokens are authorized.
 * For primary in-process execution, Developer B invokes `markAssetFailed` directly.
 *
 * Request payload: { contributionId, assetId, errorMessage }
 *
 * Returns: ApiSuccessResponse<{ ok: true }>
 */
export const markAssetAsFailed = onCall(
  { secrets: [geminiApiKey] },
  async (request) => {
    const startMs = Date.now();
    const reqId = requestId();

    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Authentication required.');
    }

    // Role check: Only ADMIN, MODERATOR, or internal server-side caller token can invoke this
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

    const { contributionId, assetId, errorMessage } = request.data as {
      contributionId?: string;
      assetId?: string;
      errorMessage?: string;
    };

    if (!contributionId || !assetId || !errorMessage) {
      throw new HttpsError(
        'invalid-argument',
        'contributionId, assetId, and errorMessage are required.'
      );
    }

    try {
      await markAssetFailed(contributionId, assetId, errorMessage);

      await writeAuditLog(
        'AI_EXTRACTION_FAILED',
        request.auth.uid,
        assetId,
        'asset',
        { contributionId, errorMessage }
      );

      return successEnvelope({ ok: true }, startMs);
    } catch (err) {
      logger.error('markAssetAsFailed error', { err });
      const { envelope, httpsCode } = mapErrorToEnvelope(err, reqId);
      throw new HttpsError(httpsCode, envelope.error.message, envelope);
    }
  }
);

// Re-export VoicePhotoAssetDocumentSchema type helper (used in saveAiResult)
type VoicePhotoAssetDocumentSchema = typeof VoicePhotoAssetDocumentSchema;
