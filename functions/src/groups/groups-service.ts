/**
 * Groups and Taste-Matching Persistence Service
 * Task A4 — Preferences, Groups, Capacity, and Scheduling Backend
 *
 * Implements collaborative multi-traveler group session lifecycle stored at
 * `group_sessions/{sessionId}`, adhering strictly to Domain 09 contract.
 */

import { randomBytes } from 'node:crypto';
import { db } from '../config/firebase.js';
import {
  GroupSessionDocument,
  GroupSessionDocumentSchema,
  MemberPreferenceInput,
  MemberPreferenceInputSchema,
  ConsensusBlendOutput,
  ConsensusBlendOutputSchema,
} from '../types/contracts/index.js';

export const GROUP_SESSIONS_COLLECTION = 'group_sessions';

const CODE_CHARACTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Excludes 0, O, 1, I to prevent confusion

/**
 * Generates a unique 6-character short session code.
 */
export function generateSessionCode(): string {
  const bytes = randomBytes(6);
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += CODE_CHARACTERS[bytes[i] % CODE_CHARACTERS.length];
  }
  return code;
}

function nowIso(): string {
  return new Date().toISOString();
}

function expirationIso(hours = 24): string {
  const d = new Date();
  d.setHours(d.getHours() + hours);
  return d.toISOString();
}

/**
 * Creates a new collaborative group session.
 * The host is registered as the initial member.
 */
export async function createGroupSession(
  hostUserId: string,
  neighborhood: string,
  hostInput: Omit<MemberPreferenceInput, 'userId'>
): Promise<GroupSessionDocument> {
  const sessionId = `group_${randomBytes(8).toString('hex')}`;
  const sessionCode = generateSessionCode();

  const validatedHostMember = MemberPreferenceInputSchema.parse({
    userId: hostUserId,
    displayName: hostInput.displayName,
    vibes: hostInput.vibes,
    dietaryRestrictions: hostInput.dietaryRestrictions,
    maxBudgetAmount: hostInput.maxBudgetAmount,
    weighting: hostInput.weighting ?? 1.0,
  });

  const sessionDoc: GroupSessionDocument = GroupSessionDocumentSchema.parse({
    sessionId,
    hostUserId,
    sessionCode,
    neighborhood,
    status: 'INVITING',
    members: [validatedHostMember],
    memberUserIds: [hostUserId],
    consensusBlend: null,
    recommendedSpotIds: [],
    createdAt: nowIso(),
    expiresAt: expirationIso(24),
  });


  await db.collection(GROUP_SESSIONS_COLLECTION).doc(sessionId).set(sessionDoc);
  return sessionDoc;
}

/**
 * Retrieves a group session by session ID.
 */
export async function getGroupSessionById(
  sessionId: string
): Promise<GroupSessionDocument | null> {
  const snap = await db.collection(GROUP_SESSIONS_COLLECTION).doc(sessionId).get();
  if (!snap.exists) {
    return null;
  }
  return GroupSessionDocumentSchema.parse(snap.data());
}

/**
 * Retrieves an active group session by 6-character session code.
 */
export async function getGroupSessionByCode(
  sessionCode: string
): Promise<GroupSessionDocument | null> {
  const snap = await db
    .collection(GROUP_SESSIONS_COLLECTION)
    .where('sessionCode', '==', sessionCode.toUpperCase().trim())
    .limit(1)
    .get();

  if (snap.empty) {
    return null;
  }
  return GroupSessionDocumentSchema.parse(snap.docs[0].data());
}

/**
 * Joins an active group session using a 6-character code.
 * Ensures the session is not expired or finalized.
 * Deduplicates or updates the member entry if already joined.
 */
export async function joinGroupSession(
  userId: string,
  sessionCode: string,
  memberInput: Omit<MemberPreferenceInput, 'userId'>
): Promise<GroupSessionDocument> {
  const session = await getGroupSessionByCode(sessionCode);
  if (!session) {
    throw new Error(`Group session with code ${sessionCode} not found.`);
  }

  const now = new Date();
  const expiresAt = new Date(session.expiresAt);
  if (now > expiresAt || session.status === 'EXPIRED') {
    throw new Error('This group session has expired.');
  }

  if (session.status === 'FINALIZED') {
    throw new Error('This group session is already finalized.');
  }

  const validatedMember = MemberPreferenceInputSchema.parse({
    userId,
    displayName: memberInput.displayName,
    vibes: memberInput.vibes,
    dietaryRestrictions: memberInput.dietaryRestrictions,
    maxBudgetAmount: memberInput.maxBudgetAmount,
    weighting: memberInput.weighting ?? 1.0,
  });

  // Filter out existing member if updating preferences, then append
  const updatedMembers = session.members.filter((m) => m.userId !== userId);
  updatedMembers.push(validatedMember);
  const updatedMemberIds = updatedMembers.map((m) => m.userId);

  const updatedDoc: GroupSessionDocument = {
    ...session,
    members: updatedMembers,
    memberUserIds: updatedMemberIds,
  };

  await db
    .collection(GROUP_SESSIONS_COLLECTION)
    .doc(session.sessionId)
    .update({ members: updatedMembers, memberUserIds: updatedMemberIds });

  return updatedDoc;
}

/**
 * Removes a member from an active group session.
 * If the host leaves, either delegates host to next member or marks session EXPIRED if empty.
 */
export async function leaveGroupSession(
  userId: string,
  sessionId: string
): Promise<{ remainingMembersCount: number; status: string }> {
  const session = await getGroupSessionById(sessionId);
  if (!session) {
    throw new Error(`Group session ${sessionId} not found.`);
  }

  const remaining = session.members.filter((m) => m.userId !== userId);
  const remainingIds = remaining.map((m) => m.userId);

  if (remaining.length === 0) {
    await db
      .collection(GROUP_SESSIONS_COLLECTION)
      .doc(sessionId)
      .update({ members: [], memberUserIds: [], status: 'EXPIRED' });
    return { remainingMembersCount: 0, status: 'EXPIRED' };
  }

  let newHost = session.hostUserId;
  if (session.hostUserId === userId) {
    newHost = remaining[0].userId;
  }

  await db
    .collection(GROUP_SESSIONS_COLLECTION)
    .doc(sessionId)
    .update({ members: remaining, memberUserIds: remainingIds, hostUserId: newHost });

  return { remainingMembersCount: remaining.length, status: session.status };

}

/**
 * Updates session status (e.g. from INVITING to BLENDING).
 */
export async function updateSessionStatus(
  sessionId: string,
  status: 'INVITING' | 'BLENDING' | 'FINALIZED' | 'EXPIRED'
): Promise<void> {
  await db.collection(GROUP_SESSIONS_COLLECTION).doc(sessionId).update({ status });
}

/**
 * Persists the consensus blend output computed by Developer B's AI service.
 * Transitions the group session to FINALIZED status.
 */
export async function saveConsensusBlend(
  sessionId: string,
  blend: ConsensusBlendOutput,
  recommendedSpotIds: string[]
): Promise<GroupSessionDocument> {
  const session = await getGroupSessionById(sessionId);
  if (!session) {
    throw new Error(`Group session ${sessionId} not found.`);
  }

  const validatedBlend = ConsensusBlendOutputSchema.parse(blend);

  const updatedDoc: GroupSessionDocument = {
    ...session,
    consensusBlend: validatedBlend,
    recommendedSpotIds,
    status: 'FINALIZED',
  };

  await db.collection(GROUP_SESSIONS_COLLECTION).doc(sessionId).update({
    consensusBlend: validatedBlend,
    recommendedSpotIds,
    status: 'FINALIZED',
  });

  return updatedDoc;
}
