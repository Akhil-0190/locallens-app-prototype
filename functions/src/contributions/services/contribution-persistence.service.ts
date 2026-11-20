/**
 * Contribution Persistence Service
 * Task A3 — Contribution and AI-Result Persistence
 *
 * Owns all Firestore reads/writes for ContributionDocument.
 * Only this service (via Admin SDK) may write `status`, `groundedPlaceId`,
 * `rejectionReason`, or `moderatedBy`. Clients may never update these fields
 * directly — enforced both here and in Firestore security rules.
 */

import { randomUUID } from 'node:crypto';
import { db } from '../../config/firebase.js';
import {
  ContributionDocument,
  ContributionDocumentSchema,
  ContributorSubmissionInput,
  ContributionStatus,
  UserRole,
} from '../../types/contracts/index.js';

const CONTRIBUTIONS_COLLECTION = 'contributions';

/** ID prefix convention from A2: "contrib_<id>" */
function generateContributionId(): string {
  return `contrib_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Creates a new contribution document in Firestore.
 * Validates the input against the A2 canonical schema before writing.
 * Sets initial status to SUBMITTED and timestamps.
 */
export async function createContribution(
  input: ContributorSubmissionInput
): Promise<ContributionDocument> {
  const contributionId = generateContributionId();
  const now = nowIso();

  const doc: ContributionDocument = ContributionDocumentSchema.parse({
    contributionId,
    submission: input,
    status: 'SUBMITTED',
    groundedPlaceId: null,
    createdAt: now,
    updatedAt: now,
  });

  await db.collection(CONTRIBUTIONS_COLLECTION).doc(contributionId).set(doc);
  return doc;
}

/**
 * Retrieves a contribution document.
 * Enforces ownership: only the contributor themselves, a MODERATOR, or an ADMIN
 * may read the document. Throws PERMISSION_DENIED otherwise.
 */
export async function getContribution(
  contributionId: string,
  requestingUserId: string,
  requestingUserRole: UserRole
): Promise<ContributionDocument> {
  const snap = await db
    .collection(CONTRIBUTIONS_COLLECTION)
    .doc(contributionId)
    .get();

  if (!snap.exists) {
    const err = new Error(`Contribution not found: ${contributionId}`);
    (err as NodeJS.ErrnoException).code = 'NOT_FOUND';
    throw err;
  }

  const doc = ContributionDocumentSchema.parse(snap.data());

  const isOwner = doc.submission.contributorId === requestingUserId;
  const isModerator = requestingUserRole === 'MODERATOR' || requestingUserRole === 'ADMIN';

  if (!isOwner && !isModerator) {
    const err = new Error('Permission denied: not the contributor or a moderator.');
    (err as NodeJS.ErrnoException).code = 'PERMISSION_DENIED';
    throw err;
  }

  return doc;
}

/**
 * Lists all contributions for a given user (by contributorId in submission).
 * Returns in descending createdAt order.
 */
export async function listUserContributions(userId: string): Promise<ContributionDocument[]> {
  const snap = await db
    .collection(CONTRIBUTIONS_COLLECTION)
    .where('submission.contributorId', '==', userId)
    .orderBy('createdAt', 'desc')
    .get();

  return snap.docs.map((d) => ContributionDocumentSchema.parse(d.data()));
}

/**
 * Updates the status of a contribution.
 * This function is ONLY callable from server-side (Admin SDK) logic.
 * Clients may NEVER call this — it is not exported as a Cloud Function callable.
 * Protected at the service layer: no callable wrapper for this function.
 *
 * @param updatedBy - Firebase Auth UID of the admin/moderator or service account performing the update.
 */
export async function updateContributionStatus(
  contributionId: string,
  newStatus: ContributionStatus,
  updatedBy: string,
  extras?: {
    groundedPlaceId?: string;
    rejectionReason?: string;
    moderatedBy?: string;
  }
): Promise<void> {
  const updatePayload: Record<string, unknown> = {
    status: newStatus,
    updatedAt: nowIso(),
    updatedBy,
  };

  if (extras?.groundedPlaceId !== undefined) {
    updatePayload['groundedPlaceId'] = extras.groundedPlaceId;
  }
  if (extras?.rejectionReason !== undefined) {
    updatePayload['rejectionReason'] = extras.rejectionReason;
  }
  if (extras?.moderatedBy !== undefined) {
    updatePayload['moderatedBy'] = extras.moderatedBy;
  }

  await db.collection(CONTRIBUTIONS_COLLECTION).doc(contributionId).update(updatePayload);
}
