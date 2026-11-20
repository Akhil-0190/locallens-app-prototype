/**
 * Contribution Triggers — Cloud Functions v2 Firestore Event Handlers
 * Task A3 — Contribution and AI-Result Persistence
 *
 * Implements actual reactive triggers on Firestore documents:
 *   - onContributionCreated: Fires when a new contribution document is created.
 *     Logs audit record and sets up pipeline state.
 *   - onAssetCreated: Fires when a new asset document is created in the subcollection.
 *     ACTUALLY INVOKES Developer B's merged B2 extraction services:
 *       - extractVoiceNoteDetails (for AUDIO_VOICE_NOTE)
 *       - extractPhotoDetails (for STREET_PHOTO, STOREFRONT_PHOTO, MENU_PHOTO)
 *     Uses Firestore transaction with a fencing lease token to claim status from
 *     UPLOADED -> PROCESSING, preventing duplicate Gemini execution.
 *     Includes stale lease timeout (5 min) for crash recovery, fencing out stale
 *     invocations, and auto-reversion to UPLOADED on temporary download failures.
 *     Persists results via A3's saveAiExtractionResult / markAssetFailed.
 */

import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import * as logger from 'firebase-functions/logger';
import { randomUUID } from 'node:crypto';
import { db, storage } from '../../config/firebase.js';
import { VoicePhotoAssetDocument } from '../../types/contracts/index.js';
import { writeAuditLog } from '../services/audit-logging.service.js';
import {
  saveAiExtractionResult,
  markAssetFailed,
} from '../services/asset-persistence.service.js';
import { extractVoiceNoteDetails } from '../../ai/services/voice-extraction-service.js';
import { extractPhotoDetails } from '../../ai/services/photo-extraction-service.js';

/** Stale lease timeout: 5 minutes. If a function crashes after claiming, retries can re-claim. */
const PROCESSING_LEASE_TIMEOUT_MS = 5 * 60 * 1000;

/**
 * Fires when a new contribution document is created in Firestore.
 * Trigger path: contributions/{contributionId}
 */
export const onContributionCreated = onDocumentCreated(
  'contributions/{contributionId}',
  async (event) => {
    const snap = event.data;
    if (!snap) {
      logger.warn('onContributionCreated: no snapshot available', { eventId: event.id });
      return;
    }

    const contributionId = event.params.contributionId;
    const data = snap.data();
    const contributorId = data?.submission?.contributorId ?? 'unknown';

    logger.info('onContributionCreated trigger fired', {
      contributionId,
      contributorId,
      status: data?.status,
    });

    try {
      await writeAuditLog(
        'CONTRIBUTION_CREATED',
        contributorId,
        contributionId,
        'contribution',
        {
          trigger: 'onContributionCreated',
          mapsLink: data?.submission?.mapsLink,
          status: data?.status,
        }
      );
    } catch (err) {
      logger.error('Failed to write audit log in onContributionCreated', { err, contributionId });
    }
  }
);

/**
 * Fires when a new media asset document is created under a contribution.
 * Trigger path: contributions/{contributionId}/assets/{assetId}
 *
 * ACTUAL B2 PROCESSING INTEGRATION & FENCING LEASE RECOVERY STRATEGY:
 * 1. Checks if asset is in 'UPLOADED' status or has a stale 'PROCESSING' lease (> 5 minutes).
 * 2. Uses Firestore transaction to atomically claim state to 'PROCESSING' with a unique lease token.
 *    - Concurrent deliveries: Only 1 instance succeeds; others see fresh 'PROCESSING' and exit.
 *    - Crashed executions: If lease expired (> 5 min), re-claims and generates a new lease token.
 * 3. Downloads media buffer from Cloud Storage via Admin SDK.
 *    - Temporary download failure: Reverts state to 'UPLOADED' and re-throws, allowing
 *      Cloud Functions exponential backoff retry to pick it up immediately.
 * 4. Invokes B2's extractVoiceNoteDetails or extractPhotoDetails.
 * 5. Persists the extraction result via saveAiExtractionResult with fencing token:
 *    - Expired invocations are fenced out and cannot overwrite newer invocations.
 */
export const onAssetCreated = onDocumentCreated(
  'contributions/{contributionId}/assets/{assetId}',
  async (event) => {
    const snap = event.data;
    if (!snap) {
      logger.warn('onAssetCreated: no snapshot available', { eventId: event.id });
      return;
    }

    const { contributionId, assetId } = event.params;
    const assetRef = db
      .collection('contributions')
      .doc(contributionId)
      .collection('assets')
      .doc(assetId);

    // Generate a unique fencing lease token for this execution
    const leaseToken = randomUUID();

    // Atomically claim the asset using a transaction with crash-lease recovery & fencing
    let claimed = false;
    try {
      claimed = await db.runTransaction(async (tx) => {
        const doc = await tx.get(assetRef);
        if (!doc.exists) return false;

        const data = doc.data() as VoicePhotoAssetDocument;
        const currentStatus = data.processingStatus;
        const updatedAtTime = data.updatedAt ? new Date(data.updatedAt).getTime() : 0;
        const isStaleLease =
          currentStatus === 'PROCESSING' &&
          Date.now() - updatedAtTime > PROCESSING_LEASE_TIMEOUT_MS;

        // Can only claim if newly uploaded or lease has expired after a crash/timeout
        const canClaim = currentStatus === 'UPLOADED' || isStaleLease;
        if (!canClaim) {
          return false;
        }

        tx.update(assetRef, {
          processingStatus: 'PROCESSING',
          processingToken: leaseToken, // Fencing token assigned
          updatedAt: new Date().toISOString(),
        });
        return true;
      });
    } catch (claimErr) {
      logger.warn('Failed to claim asset for processing in transaction', { claimErr, assetId });
      return;
    }

    if (!claimed) {
      logger.info('onAssetCreated: asset already claimed, completed, or failed. Exiting.', {
        assetId,
      });
      return;
    }

    // Refresh current asset document snapshot after claim
    const freshSnap = await assetRef.get();
    const assetData = freshSnap.data() as VoicePhotoAssetDocument;

    logger.info('onAssetCreated: claimed asset, invoking B2 extraction', {
      contributionId,
      assetId,
      assetType: assetData.assetType,
      leaseToken,
    });

    // Attempt to download media bytes from Cloud Storage using Admin SDK
    let mediaBuffer: Buffer | null = null;
    try {
      const file = storage.bucket().file(assetData.storagePath);
      const [exists] = await file.exists();
      if (exists) {
        const [buf] = await file.download();
        mediaBuffer = buf;
      }
    } catch (storageErr) {
      logger.error('Temporary storage download failure, reverting to UPLOADED for retry', {
        storageErr,
        path: assetData.storagePath,
      });
      // Revert status to UPLOADED so Cloud Functions automatic retry can immediately re-claim
      try {
        await assetRef.update({
          processingStatus: 'UPLOADED',
          updatedAt: new Date().toISOString(),
        });
      } catch (revertErr) {
        logger.error('Failed to revert status to UPLOADED', { revertErr, assetId });
      }
      throw storageErr; // Re-throw triggers Cloud Functions v2 retry
    }

    try {
      if (assetData.assetType === 'AUDIO_VOICE_NOTE') {
        const output = await extractVoiceNoteDetails({
          assetId,
          contributionId,
          contributorId: 'contributor',
          media: mediaBuffer
            ? {
                base64Data: mediaBuffer.toString('base64'),
                mimeType: assetData.mimeType,
              }
            : undefined,
        });

        if (output.processingStatus === 'COMPLETED' && output.aiExtractionResult) {
          await saveAiExtractionResult(contributionId, assetId, output.aiExtractionResult, leaseToken);
        } else {
          await markAssetFailed(
            contributionId,
            assetId,
            output.errorMessage || 'Voice note extraction failed.',
            leaseToken
          );
        }
      } else {
        const output = await extractPhotoDetails({
          assetId,
          contributionId,
          assetType: assetData.assetType,
          media: mediaBuffer
            ? {
                base64Data: mediaBuffer.toString('base64'),
                mimeType: assetData.mimeType,
              }
            : undefined,
        });

        if (output.processingStatus === 'COMPLETED' && output.aiExtractionResult) {
          await saveAiExtractionResult(contributionId, assetId, output.aiExtractionResult, leaseToken);
        } else {
          await markAssetFailed(
            contributionId,
            assetId,
            output.errorMessage || 'Photo extraction failed.',
            leaseToken
          );
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      logger.error('Error during B2 extraction in onAssetCreated', { err, assetId });
      await markAssetFailed(contributionId, assetId, errorMessage, leaseToken);
    }
  }
);
