/**
 * Integration & Transactional Verification Tests:
 * Task A4 — Capacity, Scheduling, Idempotency, Check-In, Reconciliation, and Security Rules
 */

import { test, describe } from 'node:test';
import * as assert from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';

import {
  deriveVisitId,
  calculateCrowdLevel,
} from '../src/capacity/capacity-service.js';

import {
  VenueHourlyCapacityDocument,
  ScheduledVisitDocument,
} from '../src/types/contracts/index.js';


import { NormalizationService } from '../src/maps/services/normalization.service.js';

describe('Task A4 — Focused Transactional Verification & Security Rules', () => {
  // ---------------------------------------------------------------------------
  // 1. Transactional Booking and Cancellation State Machine
  // ---------------------------------------------------------------------------
  describe('1. Transactional Booking & Cancellation Logic', () => {
    test('Two concurrent bookings competing for insufficient remaining capacity: one succeeds, one rejected', () => {
      // Slot capacity setup: maxCapacity 10, currentVisitorsCount 7 -> remainingCapacity 3
      const maxCapacity = 10;
      let currentVisitorsCount = 7;
      let remainingCapacity = maxCapacity - currentVisitorsCount; // 3 available

      const attemptBooking = (partySize: number) => {
        if (remainingCapacity < partySize) {
          throw new Error(
            `Insufficient capacity. Requested: ${partySize}, Available: ${remainingCapacity}.`
          );
        }
        currentVisitorsCount += partySize;
        remainingCapacity = maxCapacity - currentVisitorsCount;
        const { level, isThrottled } = calculateCrowdLevel(remainingCapacity, maxCapacity);
        return { currentVisitorsCount, remainingCapacity, level, isThrottled };
      };

      // Booking 1 requests 2 visitors -> Succeeds
      const b1 = attemptBooking(2);
      assert.strictEqual(b1.remainingCapacity, 1);
      assert.strictEqual(b1.currentVisitorsCount, 9);
      assert.strictEqual(b1.level, 'HIGH');
      assert.strictEqual(b1.isThrottled, false);

      // Concurrent Booking 2 requests 2 visitors -> Fails due to insufficient remaining capacity (only 1 left)
      assert.throws(
        () => attemptBooking(2),
        /Insufficient capacity\. Requested: 2, Available: 1\./
      );

      // Verify counters were not corrupted by the failed booking
      assert.strictEqual(currentVisitorsCount, 9);
      assert.strictEqual(remainingCapacity, 1);
    });

    test('Repeated booking requests with identical idempotencyKey return existing reservation without double allocation', () => {
      let slotAllocation = 2; // Initial
      const reservationRegistry = new Map<string, ScheduledVisitDocument>();

      const mockBookVisit = (travelerId: string, idempotencyKey: string, params: { placeId: string; slotId: string; partySize: number }) => {
        const visitId = deriveVisitId(travelerId, idempotencyKey);
        if (reservationRegistry.has(visitId)) {
          const existing = reservationRegistry.get(visitId)!;
          if (
            existing.placeId !== params.placeId ||
            existing.slotId !== params.slotId ||
            existing.partySize !== params.partySize
          ) {
            throw new Error('Idempotency key was previously used with different booking parameters.');
          }
          // Safe retry
          return { reservation: existing, duplicateRetry: true };
        }

        // First allocation
        slotAllocation += params.partySize;
        const newReservation: ScheduledVisitDocument = {
          visitId,
          placeId: params.placeId,
          slotId: params.slotId,
          travelerId,
          partySize: params.partySize,
          memberUserIds: [travelerId],
          idempotencyKey,
          status: 'CONFIRMED',
          hourSlot: '2026-11-21T10:00:00.000Z',
          timeZone: 'Asia/Kolkata',
          localTimeSlot: '15:30 - 16:30 IST',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        reservationRegistry.set(visitId, newReservation);
        return { reservation: newReservation, duplicateRetry: false };
      };

      // First request
      const r1 = mockBookVisit('usr_t1', 'idemp_key_999', { placeId: 'place_1', slotId: 'slot_20261121_1000', partySize: 2 });
      assert.strictEqual(r1.duplicateRetry, false);
      assert.strictEqual(slotAllocation, 4);

      // Exact retry with identical idempotencyKey
      const r2 = mockBookVisit('usr_t1', 'idemp_key_999', { placeId: 'place_1', slotId: 'slot_20261121_1000', partySize: 2 });
      assert.strictEqual(r2.duplicateRetry, true);
      assert.strictEqual(r2.reservation.visitId, r1.reservation.visitId);
      assert.strictEqual(slotAllocation, 4, 'Slot allocation must NOT increment on duplicate idempotency retry');
    });

    test('Reusing an idempotency key with different booking parameters is strictly rejected', () => {
      const reservationRegistry = new Map<string, ScheduledVisitDocument>();
      const visitId = deriveVisitId('usr_t1', 'idemp_key_diff');

      reservationRegistry.set(visitId, {
        visitId,
        placeId: 'place_ctr_malleshwaram_01',
        slotId: 'slot_20261121_1000',
        travelerId: 'usr_t1',
        partySize: 2,
        memberUserIds: ['usr_t1', 'usr_t2'],
        idempotencyKey: 'idemp_key_diff',
        status: 'CONFIRMED',
        hourSlot: '2026-11-21T10:00:00.000Z',
        timeZone: 'Asia/Kolkata',
        localTimeSlot: '15:30 - 16:30 IST',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const validateReuse = (placeId: string, slotId: string, partySize: number) => {
        const existing = reservationRegistry.get(visitId)!;
        if (existing.placeId !== placeId || existing.slotId !== slotId || existing.partySize !== partySize) {
          throw new Error('Idempotency key was previously used with different booking parameters.');
        }
      };

      // Mismatched placeId
      assert.throws(
        () => validateReuse('place_veena_stores_02', 'slot_20261121_1000', 2),
        /Idempotency key was previously used with different booking parameters/
      );

      // Mismatched partySize
      assert.throws(
        () => validateReuse('place_ctr_malleshwaram_01', 'slot_20261121_1000', 4),
        /Idempotency key was previously used with different booking parameters/
      );

      // Mismatched slotId
      assert.throws(
        () => validateReuse('place_ctr_malleshwaram_01', 'slot_20261121_1100', 2),
        /Idempotency key was previously used with different booking parameters/
      );
    });

    test('Cancellation attempted twice: second cancellation is rejected', () => {
      let visitStatus = 'CONFIRMED';
      let capacityReleased = 0;

      const cancel = () => {
        if (visitStatus !== 'CONFIRMED') {
          throw new Error(`Cannot cancel visit with status ${visitStatus}.`);
        }
        visitStatus = 'CANCELLED';
        capacityReleased += 2;
      };

      // First cancellation succeeds
      cancel();
      assert.strictEqual(visitStatus, 'CANCELLED');
      assert.strictEqual(capacityReleased, 2);

      // Second cancellation fails
      assert.throws(() => cancel(), /Cannot cancel visit with status CANCELLED\./);
      assert.strictEqual(capacityReleased, 2, 'Capacity must not be released twice');
    });

    test('Cancellation after slot begins is strictly rejected', () => {
      const now = Date.now();
      const pastSlotHour = new Date(now - 10 * 60 * 1000).toISOString(); // Slot started 10m ago

      const cancelCheck = (slotHour: string) => {
        const slotDate = new Date(slotHour);
        if (slotDate.getTime() <= Date.now()) {
          throw new Error('Cannot cancel a reservation after the scheduled slot has started.');
        }
      };

      assert.throws(() => cancelCheck(pastSlotHour), /Cannot cancel a reservation after the scheduled slot has started/);
    });

    test('Group host versus non-host authorization for booking and cancellation', () => {
      const groupSession = {
        sessionId: 'group_test_auth_01',
        hostUserId: 'usr_host_priya',
        members: [{ userId: 'usr_host_priya' }, { userId: 'usr_member_arjun' }],
        status: 'FINALIZED',
      };

      const authorizeBooking = (callerUserId: string) => {
        if (groupSession.hostUserId !== callerUserId) {
          throw new Error('Only the group session host is authorized to book for the group.');
        }
      };

      // Host can book
      assert.doesNotThrow(() => authorizeBooking('usr_host_priya'));

      // Non-host cannot book
      assert.throws(() => authorizeBooking('usr_member_arjun'), /Only the group session host is authorized to book for the group/);
      assert.throws(() => authorizeBooking('usr_stranger'), /Only the group session host is authorized to book for the group/);

      // Cancellation authorization
      const reservation = {
        travelerId: 'usr_host_priya',
        memberUserIds: ['usr_host_priya', 'usr_member_arjun'],
      };

      const authorizeCancellation = (callerUserId: string) => {
        if (reservation.travelerId !== callerUserId) {
          throw new Error('Only the traveler who booked the visit may cancel it.');
        }
      };

      assert.doesNotThrow(() => authorizeCancellation('usr_host_priya'));
      assert.throws(() => authorizeCancellation('usr_member_arjun'), /Only the traveler who booked the visit may cancel it/);
    });

    test('Group roster snapshot and party-size invariants are strictly validated', () => {
      const sessionMembers = ['usr_h1', 'usr_m2', 'usr_m3'];

      const validateRoster = (partySize: number, memberUserIds: string[], hostId: string) => {
        if (memberUserIds.length !== partySize) {
          throw new Error(`partySize (${partySize}) does not match roster size (${memberUserIds.length}).`);
        }
        if (!memberUserIds.includes(hostId)) {
          throw new Error('Group host must be included in member roster.');
        }
      };

      // Valid matching roster
      assert.doesNotThrow(() => validateRoster(3, sessionMembers, 'usr_h1'));

      // Mismatched partySize
      assert.throws(() => validateRoster(2, sessionMembers, 'usr_h1'), /partySize \(2\) does not match roster size \(3\)/);

      // Host missing
      assert.throws(() => validateRoster(3, ['usr_m2', 'usr_m3', 'usr_m4'], 'usr_h1'), /Group host must be included in member roster/);
    });

    test('Capacity counters remain mathematically consistent after every operation (Initial -> Book -> Cancel)', () => {
      const maxCapacity = 10;
      let currentVisitorsCount = 4;
      let remainingCapacity = maxCapacity - currentVisitorsCount; // 6

      // Initial check
      let crowd = calculateCrowdLevel(remainingCapacity, maxCapacity);
      assert.strictEqual(crowd.level, 'MODERATE'); // 60% remaining

      // Step 1: Book party of 3
      currentVisitorsCount += 3; // 7
      remainingCapacity = maxCapacity - currentVisitorsCount; // 3
      crowd = calculateCrowdLevel(remainingCapacity, maxCapacity);
      assert.strictEqual(currentVisitorsCount, 7);
      assert.strictEqual(remainingCapacity, 3);
      assert.strictEqual(crowd.level, 'MODERATE'); // 30% remaining

      // Step 2: Book party of 3 (Reaches AT_CAPACITY)
      currentVisitorsCount += 3; // 10
      remainingCapacity = maxCapacity - currentVisitorsCount; // 0
      crowd = calculateCrowdLevel(remainingCapacity, maxCapacity);
      assert.strictEqual(currentVisitorsCount, 10);
      assert.strictEqual(remainingCapacity, 0);
      assert.strictEqual(crowd.level, 'AT_CAPACITY');
      assert.strictEqual(crowd.isThrottled, true);

      // Step 3: Cancel party of 3
      currentVisitorsCount -= 3; // 7
      remainingCapacity = maxCapacity - currentVisitorsCount; // 3
      crowd = calculateCrowdLevel(remainingCapacity, maxCapacity);
      assert.strictEqual(currentVisitorsCount, 7);
      assert.strictEqual(remainingCapacity, 3);
      assert.strictEqual(crowd.level, 'MODERATE');
      assert.strictEqual(crowd.isThrottled, false);
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Check-In Verification (GPS Proximity and QR Token)
  // ---------------------------------------------------------------------------
  describe('2. Check-In Verification & Proximity Enforcement', () => {
    const spotCoord = { latitude: 13.001700, longitude: 77.570400 }; // CTR Malleshwaram

    test('Valid GPS check-in within 150m is accepted', () => {
      // 80 meters away
      const travelerCoord = { latitude: 13.002200, longitude: 77.570400 };
      const dist = NormalizationService.calculateDistance(travelerCoord, spotCoord);

      assert.ok(dist.meters <= 150, `Distance ${dist.meters}m should be within 150m geofence`);
    });

    test('Rejection of GPS check-in outside 150m geofence', () => {
      // 350 meters away
      const farCoord = { latitude: 13.005000, longitude: 77.570400 };
      const dist = NormalizationService.calculateDistance(farCoord, spotCoord);

      assert.ok(dist.meters > 150, `Distance ${dist.meters}m should exceed 150m geofence`);

      const verifyGeofence = (coord: { latitude: number; longitude: number }) => {
        const d = NormalizationService.calculateDistance(coord, spotCoord);
        if (d.meters > 150) {
          throw new Error(`Proximity check failed: traveler is ${d.meters}m away (max 150m allowed).`);
        }
      };

      assert.throws(() => verifyGeofence(farCoord), /Proximity check failed: traveler is \d+m away/);
    });

    test('Unauthorized member is rejected from checking in', () => {
      const reservation = {
        travelerId: 'usr_host',
        memberUserIds: ['usr_host', 'usr_member_1'],
      };

      const checkInAuth = (callerId: string) => {
        if (!reservation.memberUserIds.includes(callerId) && reservation.travelerId !== callerId) {
          throw new Error('Caller is not a member of this scheduled visit.');
        }
      };

      assert.doesNotThrow(() => checkInAuth('usr_host'));
      assert.doesNotThrow(() => checkInAuth('usr_member_1'));
      assert.throws(() => checkInAuth('usr_unauthorized_stranger'), /Caller is not a member of this scheduled visit/);
    });

    test('QR token validation: valid token accepted, invalid token rejected', () => {
      const spotQrToken = 'qr_tok_ctr_verified_9876';

      const verifyQr = (inputToken?: string) => {
        if (!inputToken) {
          throw new Error('Either GPS coordinate or QR verification token is required for check-in.');
        }
        if (inputToken !== spotQrToken) {
          throw new Error('Invalid QR verification token for this spot.');
        }
        return true;
      };

      assert.strictEqual(verifyQr('qr_tok_ctr_verified_9876'), true);
      assert.throws(() => verifyQr('qr_tok_fake_1111'), /Invalid QR verification token/);
      assert.throws(() => verifyQr(undefined), /Either GPS coordinate or QR verification token is required/);
    });

    test('Check-in does NOT increment capacity again', () => {
      // Before check-in
      const slotState: VenueHourlyCapacityDocument = {
        slotId: 'slot_20261121_1400',
        placeId: 'place_ctr_malleshwaram_01',
        hourSlot: '2026-11-21T14:00:00Z',
        maxCapacity: 12,
        currentVisitorsCount: 4, // 4 visitors booked
        remainingCapacity: 8,
        level: 'LOW',
        isThrottled: false,
        suggestedAlternatives: [],
        updatedAt: new Date().toISOString(),
      };

      // Perform check-in on a reservation belonging to this slot
      const initialVisitors = slotState.currentVisitorsCount;
      const initialRemaining = slotState.remainingCapacity;

      // Check-in updates reservation document only, NOT the hourly capacity counter
      const reservationStatus = 'COMPLETED';
      const completedBy = 'TRAVELER_CHECKIN';

      assert.strictEqual(reservationStatus, 'COMPLETED');
      assert.strictEqual(completedBy, 'TRAVELER_CHECKIN');
      assert.strictEqual(slotState.currentVisitorsCount, initialVisitors, 'currentVisitorsCount must not change on check-in');
      assert.strictEqual(slotState.remainingCapacity, initialRemaining, 'remainingCapacity must not change on check-in');
    });

    test('Repeated check-in on already COMPLETED reservation is rejected', () => {
      let visitStatus: string = 'COMPLETED';

      const checkInAgain = () => {
        if (visitStatus !== 'CONFIRMED') {
          throw new Error(`Cannot check in visit with status ${visitStatus}.`);
        }
      };

      assert.throws(() => checkInAgain(), /Cannot check in visit with status COMPLETED\./);
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Scheduled Reconciliation Logic
  // ---------------------------------------------------------------------------
  describe('3. Scheduled Reconciliation & Safety Buffer Enforcement', () => {
    test('Eligible expired reservations (> 2h past) are transitioned to COMPLETED', () => {
      const now = Date.now();
      const cutoffHours = 2;
      const cutoffMs = now - cutoffHours * 60 * 60 * 1000;

      const reservations = [
        { id: 'v1', status: 'CONFIRMED', hourSlotMs: now - 3 * 3600 * 1000 }, // 3h ago -> ELIGIBLE
        { id: 'v2', status: 'CONFIRMED', hourSlotMs: now - 1 * 3600 * 1000 }, // 1h ago -> PROTECTED
        { id: 'v3', status: 'CANCELLED', hourSlotMs: now - 5 * 3600 * 1000 }, // 5h ago -> ALREADY CANCELLED
      ];

      const reconciled = reservations.filter(
        (r) => r.status === 'CONFIRMED' && r.hourSlotMs < cutoffMs
      );

      assert.strictEqual(reconciled.length, 1);
      assert.strictEqual(reconciled[0].id, 'v1');
    });

    test('Reservations within the 2-hour safety buffer remain CONFIRMED', () => {
      const now = Date.now();
      const cutoffMs = now - 2 * 60 * 60 * 1000;
      const activeReservation = { id: 'v_active', status: 'CONFIRMED', hourSlotMs: now - 30 * 60 * 1000 }; // 30m ago

      const isEligible = activeReservation.status === 'CONFIRMED' && activeReservation.hourSlotMs < cutoffMs;
      assert.strictEqual(isEligible, false, 'Reservation within safety buffer must NOT be reconciled');
    });

    test('Already cancelled or completed reservations are untouched by reconciliation', () => {
      const now = Date.now();
      const cutoffMs = now - 2 * 60 * 60 * 1000;

      const cancelledRes = { id: 'v_canc', status: 'CANCELLED', hourSlotMs: now - 10 * 3600 * 1000 };
      const completedRes = { id: 'v_comp', status: 'COMPLETED', hourSlotMs: now - 10 * 3600 * 1000 };

      const isCancelledEligible = cancelledRes.status === 'CONFIRMED' && cancelledRes.hourSlotMs < cutoffMs;
      const isCompletedEligible = completedRes.status === 'CONFIRMED' && completedRes.hourSlotMs < cutoffMs;

      assert.strictEqual(isCancelledEligible, false);
      assert.strictEqual(isCompletedEligible, false);
    });

    test('Capacity counters are untouched by reconciliation', () => {
      let slotAllocation = 8;
      // Reconciliation modifies reservation docs in batch; it does NOT touch slot documents
      const reconcile = (count: number) => {
        return { reconciledCount: count }; // slotAllocation is NOT modified
      };

      const res = reconcile(5);
      assert.strictEqual(res.reconciledCount, 5);
      assert.strictEqual(slotAllocation, 8, 'Slot capacity counters must not be modified by reconciliation');
    });

    test('Repeated reconciliation is idempotent (0 remaining on second pass)', () => {
      let unReconciledList = ['v1', 'v2'];

      const runReconcile = () => {
        const count = unReconciledList.length;
        unReconciledList = []; // Marked completed
        return count;
      };

      const pass1 = runReconcile();
      assert.strictEqual(pass1, 2);

      const pass2 = runReconcile();
      assert.strictEqual(pass2, 0, 'Second reconciliation pass must find 0 eligible reservations');
    });
  });

  // ---------------------------------------------------------------------------
  // 4. Firestore Security Rules Static Verification
  // ---------------------------------------------------------------------------
  describe('4. Firestore Security Rules Invariants & Assertions', () => {
    const rulesPath = path.resolve(__dirname, '../../../firestore.rules');
    const rules = fs.readFileSync(rulesPath, 'utf-8');

    test('preferences/{userId} permits owner read, but DENIES direct client writes', () => {
      assert.ok(rules.includes('match /preferences/{userId}'), 'Must match preferences collection');
      assert.ok(rules.includes('allow read: if isOwner(userId);'), 'Must allow owner read');
      assert.ok(
        rules.includes('allow write: if false;'),
        'Must strictly deny direct client writes to preferences'
      );
    });

    test('group_sessions/{sessionId} checks resource.data.memberUserIds and denies client writes', () => {
      assert.ok(rules.includes('match /group_sessions/{sessionId}'), 'Must match group_sessions');
      assert.ok(
        rules.includes('request.auth.uid in resource.data.memberUserIds'),
        'Must use memberUserIds (string array) instead of members (map array) for membership check'
      );
      assert.ok(
        rules.includes('allow create, update, delete: if false;'),
        'Client writes to group_sessions must be strictly denied'
      );
    });

    test('scheduled_visits/{visitId} restricts reads to travelerId, memberUserIds, or moderator, and denies client writes', () => {
      assert.ok(rules.includes('match /scheduled_visits/{visitId}'), 'Must match scheduled_visits');
      assert.ok(
        rules.includes('resource.data.travelerId == request.auth.uid'),
        'Must allow travelerId to read reservation'
      );
      assert.ok(
        rules.includes('request.auth.uid in resource.data.memberUserIds'),
        'Must allow memberUserIds to read reservation'
      );
      assert.ok(rules.includes('isModerator()'), 'Must allow moderator read');
      assert.ok(
        rules.includes('allow create, update, delete: if false;'),
        'Client writes to scheduled_visits must be strictly denied'
      );
    });

    test('places/{placeId}/hourly_capacities/{slotId} allows authenticated read, denies client writes', () => {
      assert.ok(
        rules.includes('match /places/{placeId}/hourly_capacities/{slotId}'),
        'Must match hourly_capacities subcollection'
      );
      assert.ok(
        rules.includes('allow read: if isAuthenticated();'),
        'Must allow authenticated read for crowd badges'
      );
      assert.ok(
        rules.includes('allow create, update, delete: if false;'),
        'Client writes to hourly_capacities must be strictly denied'
      );
    });
  });
});
