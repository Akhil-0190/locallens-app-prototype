/**
 * Contributions Module Index
 * Task A3 — Contribution and AI-Result Persistence
 *
 * Re-exports all callable Cloud Functions and reactive Firestore triggers
 * from the contribution module.
 * These are picked up by functions/src/index.ts via `export * as Contributions`.
 */

// Callables (Client & Admin)
export {
  submitContribution,
  getContributionStatus,
  listMyContributions,
  recordAssetUpload,
  saveAiResult,
  markAssetAsFailed,
} from './controllers/contribution.controller.js';

// Reactive Firestore Triggers
export {
  onContributionCreated,
  onAssetCreated,
} from './triggers/contribution-triggers.js';

// In-Process Persistence Services (For Developer B / B2 direct import)
export {
  createContribution,
  getContribution,
  listUserContributions,
  updateContributionStatus,
} from './services/contribution-persistence.service.js';

export {
  recordAssetUpload as persistAssetUpload,
  saveAiExtractionResult,
  markAssetFailed,
  getAsset,
  listContributionAssets,
} from './services/asset-persistence.service.js';

export {
  writeAuditLog,
} from './services/audit-logging.service.js';
