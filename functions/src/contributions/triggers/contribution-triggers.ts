/**
 * Contribution Triggers — Cloud Functions v2 Firestore Event Handlers
 * Task A3 — Contribution and AI-Result Persistence
 *
 * Implements actual reactive triggers on Firestore documents:
 *   - onContributionCreated: Fires when a new contribution document is created.
 *     Logs audit record and sets up pipeline state.
 *   - onAssetCreated: Fires when a new asset document is created in the subcollection.
 *     Signals that media is ready for Developer B's B2 AI extraction pass.
 */

import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import * as logger from 'firebase-functions/logger';
import { writeAuditLog } from '../services/audit-logging.service.js';

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
 * This is the reactive event hook for B2 ingestion. When D2 completes
 * `recordAssetUpload`, this trigger fires, indicating that media is in Storage
 * and ready for Gemini multimodal extraction.
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
    const data = snap.data();

    logger.info('onAssetCreated trigger fired — asset ready for AI extraction', {
      contributionId,
      assetId,
      assetType: data?.assetType,
      processingStatus: data?.processingStatus,
      storagePath: data?.storagePath,
    });

    try {
      await writeAuditLog(
        'ASSET_UPLOADED',
        'system-trigger',
        assetId,
        'asset',
        {
          trigger: 'onAssetCreated',
          contributionId,
          assetType: data?.assetType,
          processingStatus: data?.processingStatus,
        }
      );
    } catch (err) {
      logger.error('Failed to write audit log in onAssetCreated', { err, assetId });
    }
  }
);
