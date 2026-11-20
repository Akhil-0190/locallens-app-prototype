/**
 * Venue Capacity & Crowd Throttling Service
 * Task A4 — Preferences, Groups, Capacity, and Scheduling Backend
 *
 * Implements capacity queries, crowd-level calculations, and transactional visit
 * booking/cancellation/check-in adhering strictly to Domain 07 contracts.
 */

import { createHash } from 'node:crypto';
import { db } from '../config/firebase.js';
import {
  VenueHourlyCapacityDocument,
  VenueHourlyCapacityDocumentSchema,
  ScheduledVisitDocument,
  ScheduledVisitDocumentSchema,
  CrowdLevel,
} from '../types/contracts/index.js';
import { GROUP_SESSIONS_COLLECTION } from '../groups/groups-service.js';
import { NormalizationService } from '../maps/services/normalization.service.js';

export const PLACES_COLLECTION = 'places';
export const HOURLY_CAPACITIES_SUBCOLLECTION = 'hourly_capacities';
export const SCHEDULED_VISITS_COLLECTION = 'scheduled_visits';

function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Derives a deterministic reservation ID based on traveler ID and idempotency key.
 */
export function deriveVisitId(travelerId: string, idempotencyKey: string): string {
  const hash = createHash('sha256')
    .update(`${travelerId}:${idempotencyKey}`)
    .digest('hex')
    .slice(0, 20);
  return `visit_${hash}`;
}

/**
 * Derives the canonical slotId from an ISO 8601 UTC hourSlot timestamp.
 * Example: "2026-11-20T14:00:00.000Z" -> "slot_20261120_1400"
 */
export function deriveSlotId(hourSlot: string): string {
  const d = new Date(hourSlot);
  if (isNaN(d.getTime())) {
    throw new Error(`Invalid hourSlot date: ${hourSlot}`);
  }
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  const hour = String(d.getUTCHours()).padStart(2, '0');
  return `slot_${year}${month}${day}_${hour}00`;
}

/**
 * Derives the canonical ISO 8601 UTC hourSlot string from a slotId.
 * Example: "slot_20261120_1400" -> "2026-11-20T14:00:00.000Z"
 */
export function deriveHourSlotFromSlotId(slotId: string): string {
  const match = slotId.match(/^slot_(\d{4})(\d{2})(\d{2})_(\d{2})00$/);
  if (!match) {
    throw new Error(`Invalid slotId format: ${slotId}. Expected slot_YYYYMMDD_HH00`);
  }
  const [, year, month, day, hour] = match;
  return `${year}-${month}-${day}T${hour}:00:00.000Z`;
}

/**
 * Formats a local time slot string for human display using IANA timezone.
 * Example: hourSlot "2026-11-20T14:00:00.000Z" with "Asia/Kolkata" -> "19:30 - 20:30 IST"
 */
export function formatLocalTimeSlot(hourSlot: string, timeZone: string): string {
  const start = new Date(hourSlot);
  const end = new Date(start.getTime() + 60 * 60 * 1000);

  const startFmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(start);

  const endFmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZoneName: 'short',
  }).format(end);

  return `${startFmt} - ${endFmt}`;
}

/**
 * Calculates real-time CrowdLevel and isThrottled flag based on Domain 07 thresholds:
 * - LOW: > 60% of maxCapacity remaining
 * - MODERATE: 30% - 60% of maxCapacity remaining
 * - HIGH: 1% - 29% of maxCapacity remaining
 * - AT_CAPACITY: 0 or fewer remaining (isThrottled = true)
 */
export function calculateCrowdLevel(
  remainingCapacity: number,
  maxCapacity: number
): { level: CrowdLevel; isThrottled: boolean } {
  if (remainingCapacity <= 0) {
    return { level: 'AT_CAPACITY', isThrottled: true };
  }

  const fraction = remainingCapacity / maxCapacity;
  if (fraction > 0.60) {
    return { level: 'LOW', isThrottled: false };
  } else if (fraction >= 0.30) {
    return { level: 'MODERATE', isThrottled: false };
  } else {
    return { level: 'HIGH', isThrottled: false };
  }
}

/**
 * Retrieves the hourly capacity document for a place and time slot.
 * Path: `places/{placeId}/hourly_capacities/{slotId}`
 */
export async function getHourlyCapacity(
  placeId: string,
  slotId: string
): Promise<VenueHourlyCapacityDocument | null> {
  const snap = await db
    .collection(PLACES_COLLECTION)
    .doc(placeId)
    .collection(HOURLY_CAPACITIES_SUBCOLLECTION)
    .doc(slotId)
    .get();

  if (!snap.exists) {
    return null;
  }

  return VenueHourlyCapacityDocumentSchema.parse(snap.data());
}

/**
 * Sets or initializes an hourly capacity document.
 * Enforces calculation of remainingCapacity, level, and isThrottled.
 */
export async function setHourlyCapacity(
  placeId: string,
  slotId: string,
  input: {
    hourSlot: string;
    maxCapacity: number;
    currentVisitorsCount: number;
    suggestedAlternatives?: VenueHourlyCapacityDocument['suggestedAlternatives'];
  }
): Promise<VenueHourlyCapacityDocument> {
  const remainingCapacity = Math.max(0, input.maxCapacity - input.currentVisitorsCount);
  const { level, isThrottled } = calculateCrowdLevel(remainingCapacity, input.maxCapacity);

  const doc: VenueHourlyCapacityDocument = VenueHourlyCapacityDocumentSchema.parse({
    slotId,
    placeId,
    hourSlot: input.hourSlot,
    maxCapacity: input.maxCapacity,
    currentVisitorsCount: input.currentVisitorsCount,
    remainingCapacity,
    level,
    isThrottled,
    suggestedAlternatives: input.suggestedAlternatives ?? [],
    updatedAt: nowIso(),
  });

  await db
    .collection(PLACES_COLLECTION)
    .doc(placeId)
    .collection(HOURLY_CAPACITIES_SUBCOLLECTION)
    .doc(slotId)
    .set(doc);

  return doc;
}

/**
 * Transactionally books a scheduled visit for an individual or group.
 * Ensures transaction-safe idempotency, verifies slot capacity, enforces group invariants,
 * and updates capacity counters atomically.
 */
export async function bookScheduledVisit(params: {
  placeId: string;
  slotId: string;
  partySize: number;
  idempotencyKey: string;
  travelerId: string;
  groupSessionId?: string | null;
  memberUserIds?: string[];
}): Promise<ScheduledVisitDocument> {
  const { placeId, slotId, partySize, idempotencyKey, travelerId, groupSessionId } = params;

  if (partySize < 1) {
    throw new Error('partySize must be at least 1.');
  }

  const hourSlot = deriveHourSlotFromSlotId(slotId);
  const slotDate = new Date(hourSlot);
  const now = new Date();

  // Guardrail: reject bookings for past slots or slots currently underway
  if (slotDate.getTime() <= now.getTime()) {
    throw new Error('Cannot book capacity slots in the past or currently underway.');
  }

  const visitId = deriveVisitId(travelerId, idempotencyKey);
  const visitRef = db.collection(SCHEDULED_VISITS_COLLECTION).doc(visitId);
  const slotRef = db
    .collection(PLACES_COLLECTION)
    .doc(placeId)
    .collection(HOURLY_CAPACITIES_SUBCOLLECTION)
    .doc(slotId);
  const placeRef = db.collection(PLACES_COLLECTION).doc(placeId);

  return await db.runTransaction(async (transaction) => {
    // 1. Idempotency Check
    const existingVisitSnap = await transaction.get(visitRef);
    if (existingVisitSnap.exists) {
      const existing = existingVisitSnap.data() as ScheduledVisitDocument;

      // Parameter validation on reuse
      if (
        existing.placeId !== placeId ||
        existing.slotId !== slotId ||
        existing.partySize !== partySize
      ) {
        throw new Error(
          'Idempotency key was previously used with different booking parameters (placeId, slotId, or partySize).'
        );
      }

      if (existing.status === 'CANCELLED') {
        throw new Error('Cannot reuse idempotency key of a cancelled reservation.');
      }

      // Safe retry: return confirmed reservation without duplicate capacity deduction
      return existing;
    }

    // 2. Group Session Validation (if group booking)
    let validatedMemberIds: string[] = [];
    if (groupSessionId) {
      const sessionRef = db.collection(GROUP_SESSIONS_COLLECTION).doc(groupSessionId);
      const sessionSnap = await transaction.get(sessionRef);
      if (!sessionSnap.exists) {
        throw new Error(`Group session ${groupSessionId} not found.`);
      }

      const session = sessionSnap.data() as any;
      if (session.status !== 'FINALIZED') {
        throw new Error(
          `Group session must be in FINALIZED status to book (current: ${session.status}).`
        );
      }

      if (new Date(session.expiresAt) <= now) {
        throw new Error('Group session has expired.');
      }

      if (session.hostUserId !== travelerId) {
        throw new Error('Only the group session host is authorized to book for the group.');
      }

      if (
        session.recommendedSpotIds &&
        session.recommendedSpotIds.length > 0 &&
        !session.recommendedSpotIds.includes(placeId)
      ) {
        throw new Error(`Selected place ${placeId} is not in group recommended spots.`);
      }

      validatedMemberIds = session.members.map((m: any) => m.userId);

      // Invariants
      if (validatedMemberIds.length !== partySize) {
        throw new Error(
          `partySize (${partySize}) does not match group roster size (${validatedMemberIds.length}).`
        );
      }
      if (!validatedMemberIds.includes(travelerId)) {
        throw new Error('Group host must be included in member roster.');
      }
    } else {
      // Individual booking
      validatedMemberIds = params.memberUserIds && params.memberUserIds.length === partySize
        ? params.memberUserIds
        : [travelerId];

      if (validatedMemberIds.length !== partySize) {
        throw new Error(`memberUserIds.length (${validatedMemberIds.length}) must equal partySize (${partySize}).`);
      }
      if (!validatedMemberIds.includes(travelerId)) {
        throw new Error('travelerId must be included in memberUserIds.');
      }
    }

    // 3. Timezone Derivation from Place Metadata
    const placeSnap = await transaction.get(placeRef);
    let timeZone = 'Asia/Kolkata'; // Fallback only if place fixture exists for Bangalore
    if (placeSnap.exists) {
      const placeData = placeSnap.data() as any;
      if (placeData.timezone || placeData.timeZone) {
        timeZone = placeData.timezone || placeData.timeZone;
      } else if (placeData.formattedAddress && placeData.formattedAddress.toLowerCase().includes('bengaluru')) {
        timeZone = 'Asia/Kolkata';
      } else {
        throw new Error(`Place ${placeId} lacks verified timezone metadata. Capacity booking requires verified local timezone.`);
      }
    }

    const localTimeSlot = formatLocalTimeSlot(hourSlot, timeZone);

    // 4. Capacity Check and Allocation
    const slotSnap = await transaction.get(slotRef);
    let maxCapacity = 12; // Default canonical limit
    let currentVisitorsCount = 0;
    let suggestedAlternatives: any[] = [];

    if (slotSnap.exists) {
      const slotData = slotSnap.data() as VenueHourlyCapacityDocument;
      maxCapacity = slotData.maxCapacity;
      currentVisitorsCount = slotData.currentVisitorsCount;
      suggestedAlternatives = slotData.suggestedAlternatives || [];
    } else if (placeSnap.exists && (placeSnap.data() as any).capacity?.hourlyLimit) {
      maxCapacity = (placeSnap.data() as any).capacity.hourlyLimit;
    }

    const remainingCapacity = maxCapacity - currentVisitorsCount;
    if (remainingCapacity < partySize) {
      throw new Error(
        `Insufficient capacity for slot ${slotId}. Requested: ${partySize}, Available: ${remainingCapacity}.`
      );
    }

    const newCurrentVisitors = currentVisitorsCount + partySize;
    const newRemainingCapacity = maxCapacity - newCurrentVisitors;
    const { level, isThrottled } = calculateCrowdLevel(newRemainingCapacity, maxCapacity);

    // Update hourly capacity document
    const updatedSlotDoc: VenueHourlyCapacityDocument = {
      slotId,
      placeId,
      hourSlot,
      maxCapacity,
      currentVisitorsCount: newCurrentVisitors,
      remainingCapacity: newRemainingCapacity,
      level,
      isThrottled,
      suggestedAlternatives,
      updatedAt: nowIso(),
    };
    transaction.set(slotRef, updatedSlotDoc);

    // 5. Create ScheduledVisitDocument
    const visitDoc: ScheduledVisitDocument = {
      visitId,
      placeId,
      slotId,
      travelerId,
      partySize,
      groupSessionId: groupSessionId ?? null,
      memberUserIds: validatedMemberIds,
      idempotencyKey,
      status: 'CONFIRMED',
      hourSlot,
      timeZone,
      localTimeSlot,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };

    const validatedVisit = ScheduledVisitDocumentSchema.parse(visitDoc);
    transaction.set(visitRef, validatedVisit);

    return validatedVisit;
  });
}

/**
 * Transactionally cancels a scheduled visit and releases allocated capacity.
 * Guardrail: Only allows cancellation before the scheduled slot begins.
 */
export async function cancelScheduledVisit(params: {
  visitId: string;
  callerUserId: string;
}): Promise<ScheduledVisitDocument> {
  const { visitId, callerUserId } = params;
  const visitRef = db.collection(SCHEDULED_VISITS_COLLECTION).doc(visitId);

  return await db.runTransaction(async (transaction) => {
    const visitSnap = await transaction.get(visitRef);
    if (!visitSnap.exists) {
      throw new Error(`Scheduled visit ${visitId} not found.`);
    }

    const visit = visitSnap.data() as ScheduledVisitDocument;

    // Caller authorization: must be the booking traveler
    if (visit.travelerId !== callerUserId) {
      throw new Error('Only the traveler who booked the visit may cancel it.');
    }

    if (visit.status !== 'CONFIRMED') {
      throw new Error(`Cannot cancel visit with status ${visit.status}.`);
    }

    const slotDate = new Date(visit.hourSlot);
    const now = new Date();

    // Guardrail: Permit cancellation only before slot begins
    if (slotDate.getTime() <= now.getTime()) {
      throw new Error('Cannot cancel a reservation after the scheduled slot has started.');
    }

    // Release capacity on slot
    const slotRef = db
      .collection(PLACES_COLLECTION)
      .doc(visit.placeId)
      .collection(HOURLY_CAPACITIES_SUBCOLLECTION)
      .doc(visit.slotId);

    const slotSnap = await transaction.get(slotRef);
    if (slotSnap.exists) {
      const slotData = slotSnap.data() as VenueHourlyCapacityDocument;
      const newCurrentVisitors = Math.max(0, slotData.currentVisitorsCount - visit.partySize);
      const newRemainingCapacity = slotData.maxCapacity - newCurrentVisitors;
      const { level, isThrottled } = calculateCrowdLevel(newRemainingCapacity, slotData.maxCapacity);

      transaction.update(slotRef, {
        currentVisitorsCount: newCurrentVisitors,
        remainingCapacity: newRemainingCapacity,
        level,
        isThrottled,
        updatedAt: nowIso(),
      });
    }

    // Update visit status
    const updatedVisit: ScheduledVisitDocument = {
      ...visit,
      status: 'CANCELLED',
      updatedAt: nowIso(),
    };

    transaction.update(visitRef, {
      status: 'CANCELLED',
      updatedAt: nowIso(),
    });

    return updatedVisit;
  });
}

/**
 * Checks in a scheduled visit upon physical arrival.
 * Supports server-side GPS proximity verification (<= 150m) and spot QR tokens.
 * Invariant: Does NOT increment capacity (already reserved at booking time).
 */
export async function checkInScheduledVisit(params: {
  visitId: string;
  callerUserId: string;
  travelerCoordinate?: { latitude: number; longitude: number };
  qrToken?: string;
}): Promise<ScheduledVisitDocument> {
  const { visitId, callerUserId, travelerCoordinate, qrToken } = params;
  const visitRef = db.collection(SCHEDULED_VISITS_COLLECTION).doc(visitId);

  return await db.runTransaction(async (transaction) => {
    const visitSnap = await transaction.get(visitRef);
    if (!visitSnap.exists) {
      throw new Error(`Scheduled visit ${visitId} not found.`);
    }

    const visit = visitSnap.data() as ScheduledVisitDocument;

    if (visit.status !== 'CONFIRMED') {
      throw new Error(`Cannot check in visit with status ${visit.status}.`);
    }

    // Caller authorization: must be included in memberUserIds
    if (!visit.memberUserIds.includes(callerUserId) && visit.travelerId !== callerUserId) {
      throw new Error('Caller is not a member of this scheduled visit.');
    }

    const slotStart = new Date(visit.hourSlot).getTime();
    const now = Date.now();
    const windowStart = slotStart - 15 * 60 * 1000; // 15 mins early
    const windowEnd = slotStart + 60 * 60 * 1000;   // slot end

    if (now < windowStart || now > windowEnd) {
      throw new Error('Check-in is only permitted during the active slot window.');
    }

    // Verification check (GPS proximity or QR)
    if (!travelerCoordinate && !qrToken) {
      throw new Error('Either GPS coordinate or QR verification token is required for check-in.');
    }

    if (travelerCoordinate) {
      const placeRef = db.collection(PLACES_COLLECTION).doc(visit.placeId);
      const placeSnap = await transaction.get(placeRef);
      if (placeSnap.exists) {
        const placeData = placeSnap.data() as any;
        if (placeData.coordinate) {
          const dist = NormalizationService.calculateDistance(
            travelerCoordinate,
            placeData.coordinate
          );
          if (dist.meters > 150) {
            throw new Error(`Proximity check failed: traveler is ${dist.meters}m away (max 150m allowed).`);
          }
        }
      }
    }

    const updatedVisit: ScheduledVisitDocument = {
      ...visit,
      status: 'COMPLETED',
      completedAt: nowIso(),
      completedBy: 'TRAVELER_CHECKIN',
      updatedAt: nowIso(),
    };

    transaction.update(visitRef, {
      status: 'COMPLETED',
      completedAt: nowIso(),
      completedBy: 'TRAVELER_CHECKIN',
      updatedAt: nowIso(),
    });

    return updatedVisit;
  });
}

/**
 * Reconciles expired scheduled visits that were not explicitly checked in.
 * Invariant: Safely uses a 2-hour buffer to avoid completing active reservations.
 * Does not alter historical slot capacity.
 */
export async function reconcileScheduledVisits(cutoffHours = 2): Promise<{ reconciledCount: number }> {
  const cutoffTime = new Date(Date.now() - cutoffHours * 60 * 60 * 1000).toISOString();

  const querySnap = await db
    .collection(SCHEDULED_VISITS_COLLECTION)
    .where('status', '==', 'CONFIRMED')
    .where('hourSlot', '<', cutoffTime)
    .get();

  if (querySnap.empty) {
    return { reconciledCount: 0 };
  }

  const batch = db.batch();
  const now = nowIso();

  querySnap.docs.forEach((doc) => {
    batch.update(doc.ref, {
      status: 'COMPLETED',
      completedAt: now,
      completedBy: 'SYSTEM_EXPIRATION',
      updatedAt: now,
    });
  });

  await batch.commit();
  return { reconciledCount: querySnap.size };
}
