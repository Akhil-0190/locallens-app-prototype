/**
 * Audit Logging Service
 * Task A3 — Contribution and AI-Result Persistence
 *
 * Records immutable audit events for status transitions, AI processing outcomes,
 * and moderation actions. Writes to the `audit_logs` collection (append-only).
 * No client-side reads are permitted on this collection.
 */

import { randomUUID } from 'node:crypto';
import { db } from '../../config/firebase.js';

const AUDIT_LOGS_COLLECTION = 'audit_logs';

export type AuditEventType =
  | 'CONTRIBUTION_CREATED'
  | 'CONTRIBUTION_STATUS_CHANGED'
  | 'CONTRIBUTION_UPDATED'
  | 'CONTRIBUTION_RETRACTED'
  | 'ASSET_UPLOADED'
  | 'AI_EXTRACTION_COMPLETED'
  | 'AI_EXTRACTION_FAILED'
  | 'CONTRIBUTION_MODERATED';

export interface AuditLogEntry {
  logId: string;
  eventType: AuditEventType;
  actorUserId: string;
  targetEntityId: string;
  targetEntityType: 'contribution' | 'asset';
  details: Record<string, unknown>;
  createdAt: string;
}

function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Appends an immutable audit log entry.
 * This function uses Admin SDK and is not exposed to clients.
 * Fire-and-forget: awaiting is optional in non-critical paths,
 * but callers should await to surface write failures in tests.
 */
export async function writeAuditLog(
  eventType: AuditEventType,
  actorUserId: string,
  targetEntityId: string,
  targetEntityType: 'contribution' | 'asset',
  details: Record<string, unknown> = {}
): Promise<void> {
  const logId = `log_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
  const entry: AuditLogEntry = {
    logId,
    eventType,
    actorUserId,
    targetEntityId,
    targetEntityType,
    details,
    createdAt: nowIso(),
  };

  await db.collection(AUDIT_LOGS_COLLECTION).doc(logId).set(entry);
}
