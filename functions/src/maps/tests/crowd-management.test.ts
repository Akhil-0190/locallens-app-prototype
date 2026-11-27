/**
 * Venue Capacity, Crowd Throttling and Alternatives Test Suite
 * Developer C - Task C4
 *
 * Verifies all 25 minimum required scenarios across:
 * 1. Capacity representation & thresholds
 * 2. Visit scheduling & validation
 * 3. Crowd throttling & rotation
 * 4. Capacity-aware walking routes
 * 5. Backend transactional integration boundary & failures
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import './fixtures/register.js';
import { CrowdManagementService } from '../services/crowd-management.service.js';
import { calculateCrowdLevel, deriveSlotId } from '../../capacity/capacity-service.js';

describe('Task C4 - Capacity, Crowd Throttling & Alternatives', () => {
  // ============================================================================
  // 1. Capacity Representation & Domain 07 Invariants
  // ============================================================================
  describe('Capacity Representation', () => {
    it('1. should evaluate venue with valid hourly capacity record', async () => {
      const evaluation = await CrowdManagementService.evaluateVenueCapacity({
        placeId: 'place_ctr_shri_sagar',
        intendedVisitTime: '2026-11-20T08:15:00.000Z',
        allowMockFallback: true,
      });

      assert.strictEqual(evaluation.placeId, 'place_ctr_shri_sagar');
      assert.strictEqual(evaluation.slotId, 'slot_20261120_0800');
      assert.strictEqual(evaluation.status, 'AVAILABLE');
      assert.strictEqual(evaluation.maxCapacity, 15);
      assert.strictEqual(evaluation.currentVisitorsCount, 8);
      assert.strictEqual(evaluation.remainingCapacity, 7);
      assert.strictEqual(evaluation.crowdLevel, 'MODERATE');
      assert.strictEqual(evaluation.isThrottled, false);
      assert.strictEqual(evaluation.isMockData, true);
    });

    it('2. should handle different capacities and levels across different hours', async () => {
      // 08:00 UTC - Moderate
      const eval08 = await CrowdManagementService.evaluateVenueCapacity({
        placeId: 'place_ctr_shri_sagar',
        intendedVisitTime: '2026-11-20T08:00:00.000Z',
      });
      assert.strictEqual(eval08.crowdLevel, 'MODERATE');
      assert.strictEqual(eval08.isThrottled, false);

      // 09:00 UTC - AT_CAPACITY / Throttled
      const eval09 = await CrowdManagementService.evaluateVenueCapacity({
        placeId: 'place_ctr_shri_sagar',
        intendedVisitTime: '2026-11-20T09:00:00.000Z',
      });
      assert.strictEqual(eval09.status, 'AT_CAPACITY');
      assert.strictEqual(eval09.crowdLevel, 'AT_CAPACITY');
      assert.strictEqual(eval09.isThrottled, true);

      // 10:00 UTC - HIGH crowd (remaining 2/15 = 13.3%)
      const eval10 = await CrowdManagementService.evaluateVenueCapacity({
        placeId: 'place_ctr_shri_sagar',
        intendedVisitTime: '2026-11-20T10:00:00.000Z',
      });
      assert.strictEqual(eval10.crowdLevel, 'HIGH');
      assert.strictEqual(eval10.isThrottled, false);

      // 11:00 UTC - LOW crowd (remaining 11/15 = 73.3%)
      const eval11 = await CrowdManagementService.evaluateVenueCapacity({
        placeId: 'place_ctr_shri_sagar',
        intendedVisitTime: '2026-11-20T11:00:00.000Z',
      });
      assert.strictEqual(eval11.crowdLevel, 'LOW');
      assert.strictEqual(eval11.isThrottled, false);
    });

    it('3. should honestly report UNKNOWN when venue has no capacity record', async () => {
      const evaluation = await CrowdManagementService.evaluateVenueCapacity({
        placeId: 'non_existent_place_xyz',
        intendedVisitTime: '2026-11-20T14:00:00.000Z',
        allowMockFallback: true,
      });

      assert.strictEqual(evaluation.status, 'UNKNOWN');
      assert.strictEqual(evaluation.isThrottled, false);
      assert.strictEqual(evaluation.isMockData, false);
      assert.ok(evaluation.notes?.includes('No capacity record found'));
    });

    it('4. should handle malformed or invalid visit timestamp gracefully', async () => {
      const evaluation = await CrowdManagementService.evaluateVenueCapacity({
        placeId: 'place_ctr_shri_sagar',
        intendedVisitTime: 'invalid-date-string',
      });

      assert.strictEqual(evaluation.status, 'UNKNOWN');
      assert.strictEqual(evaluation.slotId, 'slot_invalid');
      assert.ok(evaluation.notes?.includes('Invalid visit time'));
    });

    it('5. should enforce exact Domain 07 4-bracket threshold math', () => {
      // LOW: > 60%
      assert.deepStrictEqual(calculateCrowdLevel(7, 10), { level: 'LOW', isThrottled: false });
      // MODERATE: 30% to 60%
      assert.deepStrictEqual(calculateCrowdLevel(5, 10), { level: 'MODERATE', isThrottled: false });
      assert.deepStrictEqual(calculateCrowdLevel(3, 10), { level: 'MODERATE', isThrottled: false });
      // HIGH: 1% to 29%
      assert.deepStrictEqual(calculateCrowdLevel(2, 10), { level: 'HIGH', isThrottled: false });
      assert.deepStrictEqual(calculateCrowdLevel(1, 10), { level: 'HIGH', isThrottled: false });
      // AT_CAPACITY: <= 0
      assert.deepStrictEqual(calculateCrowdLevel(0, 10), { level: 'AT_CAPACITY', isThrottled: true });
      assert.deepStrictEqual(calculateCrowdLevel(-2, 10), { level: 'AT_CAPACITY', isThrottled: true });
    });
  });

  // ============================================================================
  // 2. Visit Scheduling
  // ============================================================================
  describe('Visit Scheduling', () => {
    it('6. should schedule a visit when capacity is confirmed available', async () => {
      const result = await CrowdManagementService.scheduleVisit({
        placeId: 'place_ctr_shri_sagar',
        hourSlot: '2026-11-20T08:00:00.000Z',
        partySize: 2,
        travelerId: 'traveler_123',
        idempotencyKey: 'idemp_key_001',
        allowMockFallback: true,
      });

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.status, 'CONFIRMED');
      assert.ok(result.scheduledVisit);
      assert.strictEqual(result.scheduledVisit.placeId, 'place_ctr_shri_sagar');
      assert.strictEqual(result.scheduledVisit.partySize, 2);
    });

    it('7. should reject scheduling and suggest alternatives when selected slot is full', async () => {
      const result = await CrowdManagementService.scheduleVisit({
        placeId: 'place_ctr_shri_sagar',
        hourSlot: '2026-11-20T09:00:00.000Z', // AT_CAPACITY in fixture
        partySize: 2,
        travelerId: 'traveler_123',
        idempotencyKey: 'idemp_key_002',
        allowMockFallback: true,
      });

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.status, 'REJECTED_FULL');
      assert.strictEqual(result.evaluation.status, 'AT_CAPACITY');
      assert.ok(result.suggestedAlternativeSlots && result.suggestedAlternativeSlots.length > 0);
      assert.ok(result.suggestedAlternativeVenues && result.suggestedAlternativeVenues.length > 0);
    });

    it('8. should reject partySize that exceeds remaining capacity even if not zero', async () => {
      const eval10 = await CrowdManagementService.evaluateVenueCapacity({
        placeId: 'place_ctr_shri_sagar',
        intendedVisitTime: '2026-11-20T10:00:00.000Z', // 2 spots remaining
        partySize: 4, // Requests 4
      });

      assert.strictEqual(eval10.status, 'AT_CAPACITY');
      assert.ok(eval10.isThrottled);
    });

    it('9. should reject booking with REJECTED_UNKNOWN when capacity is missing and mock fallback is disabled', async () => {
      const result = await CrowdManagementService.scheduleVisit({
        placeId: 'unverified_stall_99',
        hourSlot: '2026-11-20T15:00:00.000Z',
        partySize: 1,
        travelerId: 'traveler_123',
        idempotencyKey: 'idemp_key_003',
        allowMockFallback: false,
      });

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.status, 'REJECTED_UNKNOWN');
    });

    it('10. should derive slotId and hourSlot consistently at top-of-hour UTC', () => {
      const slot = deriveSlotId('2026-11-20T14:35:12.456Z');
      assert.strictEqual(slot, 'slot_20261120_1400');
    });
  });

  // ============================================================================
  // 3. Crowd Throttling and Recommendation Rotation
  // ============================================================================
  describe('Crowd Throttling and Rotation', () => {
    it('11. should exclude full venue from preferred recommendation in affected time slot', async () => {
      const stopResults = await CrowdManagementService.evaluateRouteStops({
        stops: [
          {
            placeId: 'place_ctr_shri_sagar',
            placeName: 'CTR Shri Sagar',
            intendedVisitTime: '2026-11-20T09:00:00.000Z',
            partySize: 2,
          },
        ],
        allowMockFallback: true,
      });

      assert.strictEqual(stopResults.length, 1);
      assert.strictEqual(stopResults[0].evaluation.status, 'AT_CAPACITY');
      assert.strictEqual(stopResults[0].recommendedAction, 'ROTATE_TO_ALTERNATIVE');
      assert.ok(stopResults[0].alternativeOptions.length > 0);
    });

    it('12. should allow a venue full at 9 AM to be recommended at 11 AM when capacity permits', async () => {
      const eval9 = await CrowdManagementService.evaluateVenueCapacity({
        placeId: 'place_ctr_shri_sagar',
        intendedVisitTime: '2026-11-20T09:00:00.000Z',
      });
      assert.strictEqual(eval9.status, 'AT_CAPACITY');

      const eval11 = await CrowdManagementService.evaluateVenueCapacity({
        placeId: 'place_ctr_shri_sagar',
        intendedVisitTime: '2026-11-20T11:00:00.000Z',
      });
      assert.strictEqual(eval11.status, 'AVAILABLE');
      assert.strictEqual(eval11.crowdLevel, 'LOW');
    });

    it('13. should discover available alternative time slots on the same day', async () => {
      const altSlots = await CrowdManagementService.findAlternativeTimeSlots({
        placeId: 'place_ctr_shri_sagar',
        intendedVisitTime: '2026-11-20T09:00:00.000Z',
        partySize: 2,
        hoursToCheck: 3,
        allowMockFallback: true,
      });

      assert.ok(altSlots.length > 0);
      assert.ok(altSlots.some((s) => s.slotId === 'slot_20261120_1000' || s.slotId === 'slot_20261120_1100'));
    });

    it('14. should return suitable nearby alternatives with distance and crowd levels', async () => {
      const alternatives = await CrowdManagementService.findAlternativesForVenue({
        placeId: 'place_ctr_shri_sagar',
        intendedVisitTime: '2026-11-20T09:00:00.000Z',
        partySize: 2,
        allowMockFallback: true,
      });

      assert.ok(alternatives.length > 0);
      assert.strictEqual(alternatives[0].alternativePlaceId, 'place_veena_stores');
      assert.ok(alternatives[0].distanceMeters > 0);
      assert.ok(alternatives[0].walkingDurationMinutes > 0);
      assert.strictEqual(alternatives[0].isMockData, true);
    });

    it('15. should NOT treat unknown capacity as confirmed availability in stop checks', async () => {
      const stopResults = await CrowdManagementService.evaluateRouteStops({
        stops: [
          {
            placeId: 'unverified_stall_unknown',
            placeName: 'Unknown Stall',
            intendedVisitTime: '2026-11-20T09:00:00.000Z',
          },
        ],
        allowMockFallback: true,
      });

      assert.strictEqual(stopResults[0].evaluation.status, 'UNKNOWN');
      assert.strictEqual(stopResults[0].recommendedAction, 'PROCEED_WITH_UNKNOWN');
    });
  });

  // ============================================================================
  // 4. Capacity-Aware Walking Route Selection
  // ============================================================================
  describe('Capacity-Aware Route Generation', () => {
    it('16. should generate walking route considering capacity for all stops', async () => {
      const response = await CrowdManagementService.generateCapacityAwareRoute({
        title: 'Malleswaram Morning Breakfast Trail',
        neighborhood: 'Malleswaram',
        theme: 'Heritage Food',
        stops: [
          {
            placeId: 'place_ctr_shri_sagar',
            spotName: 'CTR Shri Sagar',
            coordinate: { latitude: 13.0075, longitude: 77.5714 },
            intendedVisitTime: '2026-11-20T08:00:00.000Z', // Available at 8 AM
          },
          {
            placeId: 'place_kadu_malleshwara',
            spotName: 'Kadu Malleshwara Temple',
            coordinate: { latitude: 13.0039, longitude: 77.5701 },
            intendedVisitTime: '2026-11-20T08:30:00.000Z',
          },
        ],
        autoSubstituteFullStops: true,
        allowMockFallback: true,
      });

      assert.ok(response.routeId);
      assert.strictEqual(response.stops.length, 2);
      assert.strictEqual(response.hasThrottledStops, false);
      assert.strictEqual(response.stops[0].isSubstituted, false);
      assert.ok(response.encodedPolyline.length > 0);
    });

    it('17. should automatically substitute full stops when autoSubstituteFullStops is enabled', async () => {
      const response = await CrowdManagementService.generateCapacityAwareRoute({
        title: 'Malleswaram Morning Trail',
        neighborhood: 'Malleswaram',
        stops: [
          {
            placeId: 'place_ctr_shri_sagar',
            spotName: 'CTR Shri Sagar',
            coordinate: { latitude: 13.0075, longitude: 77.5714 },
            intendedVisitTime: '2026-11-20T09:00:00.000Z', // AT_CAPACITY in fixture
          },
          {
            placeId: 'place_kadu_malleshwara',
            spotName: 'Kadu Malleshwara Temple',
            coordinate: { latitude: 13.0039, longitude: 77.5701 },
            intendedVisitTime: '2026-11-20T09:30:00.000Z',
          },
        ],
        autoSubstituteFullStops: true,
        allowMockFallback: true,
      });

      assert.strictEqual(response.hasThrottledStops, true);
      assert.strictEqual(response.stops[0].isSubstituted, true);
      assert.strictEqual(response.stops[0].originalPlaceId, 'place_ctr_shri_sagar');
      assert.ok(response.stops[0].substitutionReason?.includes('is at capacity'));
      assert.ok(response.warnings.some((w) => w.includes('Rotated to')));
    });

    it('18. should retain original full stop with warning if autoSubstituteFullStops is false', async () => {
      const response = await CrowdManagementService.generateCapacityAwareRoute({
        title: 'Malleswaram Morning Trail',
        neighborhood: 'Malleswaram',
        stops: [
          {
            placeId: 'place_ctr_shri_sagar',
            spotName: 'CTR Shri Sagar',
            coordinate: { latitude: 13.0075, longitude: 77.5714 },
            intendedVisitTime: '2026-11-20T09:00:00.000Z',
          },
          {
            placeId: 'place_kadu_malleshwara',
            spotName: 'Kadu Malleshwara Temple',
            coordinate: { latitude: 13.0039, longitude: 77.5701 },
            intendedVisitTime: '2026-11-20T09:30:00.000Z',
          },
        ],
        autoSubstituteFullStops: false,
        allowMockFallback: true,
      });

      assert.strictEqual(response.hasThrottledStops, true);
      assert.strictEqual(response.stops[0].isSubstituted, false);
      assert.strictEqual(response.stops[0].capacityStatus, 'AT_CAPACITY');
    });

    it('19. should handle mixed routes with some confirmed and some unknown stops honestly', async () => {
      const response = await CrowdManagementService.generateCapacityAwareRoute({
        title: 'Malleswaram Discovery Trail',
        neighborhood: 'Malleswaram',
        stops: [
          {
            placeId: 'place_ctr_shri_sagar',
            spotName: 'CTR Shri Sagar',
            coordinate: { latitude: 13.0075, longitude: 77.5714 },
            intendedVisitTime: '2026-11-20T08:00:00.000Z',
          },
          {
            placeId: 'unverified_corner_stall',
            spotName: 'Unverified Corner Stall',
            coordinate: { latitude: 13.0050, longitude: 77.5710 },
            intendedVisitTime: '2026-11-20T08:30:00.000Z',
          },
        ],
        allowMockFallback: true,
      });

      assert.strictEqual(response.hasUnknownCapacityStops, true);
      assert.strictEqual(response.stops[0].capacityStatus, 'AVAILABLE');
      assert.strictEqual(response.stops[1].capacityStatus, 'UNKNOWN');
    });

    it('20. should preserve existing C3 walking route generation behavior and metrics', async () => {
      const response = await CrowdManagementService.generateCapacityAwareRoute({
        title: 'Metric Trail',
        neighborhood: 'Malleswaram',
        stops: [
          {
            placeId: 'place_ctr_shri_sagar',
            coordinate: { latitude: 13.0075, longitude: 77.5714 },
          },
          {
            placeId: 'place_kadu_malleshwara',
            coordinate: { latitude: 13.0039, longitude: 77.5701 },
          },
        ],
        walkingPace: 'BRISK',
        allowMockFallback: true,
      });

      assert.ok(response.totalDistanceMeters > 0);
      assert.ok(response.totalDurationSeconds > 0);
      assert.ok(response.formattedDuration.length > 0);
      assert.ok(response.legs.length > 0);
    });
  });

  // ============================================================================
  // 5. Backend Transactional Integration Boundary & Failure Handling
  // ============================================================================
  describe('Backend Integration Boundary & Failures', () => {
    it('21. should handle backend capacity retrieval failure gracefully', async () => {
      const evaluation = await CrowdManagementService.evaluateVenueCapacity({
        placeId: 'error_trigger_venue',
        intendedVisitTime: '2026-11-20T14:00:00.000Z',
        allowMockFallback: false,
      });

      assert.strictEqual(evaluation.status, 'UNKNOWN');
    });

    it('22. should return error outcome when transactional booking fails without mock fallback', async () => {
      const result = await CrowdManagementService.scheduleVisit({
        placeId: 'non_existent_place_booking_fail',
        hourSlot: '2026-11-20T16:00:00.000Z',
        partySize: 1,
        travelerId: 'traveler_999',
        idempotencyKey: 'idemp_key_fail',
        allowMockFallback: false,
      });

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.status, 'REJECTED_UNKNOWN');
    });

    it('23. should reject route generation request with fewer than 2 stops', async () => {
      await assert.rejects(
        async () => {
          await CrowdManagementService.generateCapacityAwareRoute({
            stops: [
              {
                placeId: 'place_ctr_shri_sagar',
                coordinate: { latitude: 13.0075, longitude: 77.5714 },
              },
            ],
          });
        },
        {
          message: /At least 2 stops are required/,
        }
      );
    });

    it('24. should properly label mock/fallback data with isMockData: true', async () => {
      const evalMock = await CrowdManagementService.evaluateVenueCapacity({
        placeId: 'place_ctr_shri_sagar',
        intendedVisitTime: '2026-11-20T08:00:00.000Z',
        allowMockFallback: true,
      });
      assert.strictEqual(evalMock.isMockData, true);

      const alts = await CrowdManagementService.findAlternativesForVenue({
        placeId: 'place_ctr_shri_sagar',
        intendedVisitTime: '2026-11-20T09:00:00.000Z',
        allowMockFallback: true,
      });
      assert.ok(alts.every((a) => a.isMockData === true));
    });

    it('25. should serialize structured responses conforming to canonical schemas', async () => {
      const response = await CrowdManagementService.generateCapacityAwareRoute({
        stops: [
          {
            placeId: 'place_ctr_shri_sagar',
            coordinate: { latitude: 13.0075, longitude: 77.5714 },
          },
          {
            placeId: 'place_kadu_malleshwara',
            coordinate: { latitude: 13.0039, longitude: 77.5701 },
          },
        ],
        allowMockFallback: true,
      });

      const serialized = JSON.stringify(response);
      const parsed = JSON.parse(serialized);
      assert.strictEqual(parsed.routeId, response.routeId);
      assert.strictEqual(parsed.stops.length, 2);
      assert.strictEqual(typeof parsed.hasThrottledStops, 'boolean');
      assert.strictEqual(typeof parsed.hasUnknownCapacityStops, 'boolean');
    });

    it('26. refines scheduled arrival times using actual leg walking durations from generated route', async () => {
      const startTime = '2026-11-20T08:00:00.000Z';
      const response = await CrowdManagementService.generateCapacityAwareRoute({
        title: 'Timing Accuracy Trail',
        neighborhood: 'Malleswaram',
        startTime,
        stops: [
          {
            placeId: 'place_ctr_shri_sagar',
            spotName: 'CTR Shri Sagar',
            coordinate: { latitude: 13.0075, longitude: 77.5714 },
          },
          {
            placeId: 'place_kadu_malleshwara',
            spotName: 'Kadu Malleshwara Temple',
            coordinate: { latitude: 13.0039, longitude: 77.5701 },
          },
        ],
        allowMockFallback: true,
      });

      // Stop 0 arrives at startTime
      assert.strictEqual(response.stops[0].scheduledArrival, startTime);

      // Stop 1 arrival must match startTime + leg 0 duration
      const leg0DurationSeconds = response.legs[0].durationSeconds;
      const expectedStop1ArrivalMs = new Date(startTime).getTime() + leg0DurationSeconds * 1000;
      const actualStop1ArrivalMs = new Date(response.stops[1].scheduledArrival).getTime();

      assert.strictEqual(actualStop1ArrivalMs, expectedStop1ArrivalMs);
    });
  });

  // ===========================================================================
  // 6. Community Crowd Signals & Real-Time Intelligence Protocol
  // Replacing Missing Google Crowdsource API with Proprietary Community Engine
  // ===========================================================================
  describe('Community Crowd Signals & Real-Time Intelligence Protocol', () => {
    it('27. ingests 1-tap community crowd report and awards contributor reputation points', async () => {
      CrowdManagementService.clearCommunitySignalsStore();

      const result = await CrowdManagementService.submitCommunityCrowdSignal({
        placeId: 'place_veena_stores',
        crowdLevel: 'HIGH',
        estimatedWaitMinutes: 20,
        reporterType: 'LOCAL_RESIDENT',
        travelerId: 'local_resident_appu',
        note: 'Long queue for idli vada breakfast',
        allowMockFallback: true,
      });

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.signal.placeId, 'place_veena_stores');
      assert.strictEqual(result.signal.reportedCrowdLevel, 'HIGH');
      assert.strictEqual(result.signal.reporterType, 'LOCAL_RESIDENT');
      assert.strictEqual(result.signal.reporterWeight, 1.5);
      assert.strictEqual(result.rewardPointsEarned, 25); // Local resident rewarded 25 pts
      assert.ok(result.synthesizedEvaluation);
    });

    it('28. filters out expired community reports (>90 min freshness TTL) while retaining fresh ones', () => {
      CrowdManagementService.clearCommunitySignalsStore();

      // Veena stores has no active community signals initially
      const freshResult = CrowdManagementService.getActiveCommunitySignals('place_veena_stores');
      assert.strictEqual(freshResult.length, 0); // None yet for veena stores

      // Direct check with explicit timestamp filtering
      const activeSignals = CrowdManagementService.getActiveCommunitySignals(
        'place_8th_cross_market',
        new Date(Date.now() + 10 * 60 * 1000).toISOString()
      );
      // Fresh signals within 75 min expiresAt must be active
      assert.ok(activeSignals.length > 0);

      // Check far in the future (> 2 hours) where signals are expired
      const expiredSignals = CrowdManagementService.getActiveCommunitySignals(
        'place_8th_cross_market',
        new Date(Date.now() + 120 * 60 * 1000).toISOString()
      );
      assert.strictEqual(expiredSignals.length, 0);
    });

    it('29. verified local resident AT_CAPACITY report overrides stale low reservations and throttles venue', async () => {
      CrowdManagementService.clearCommunitySignalsStore();

      // Submit AT_CAPACITY report from verified local resident
      await CrowdManagementService.submitCommunityCrowdSignal({
        placeId: 'place_veena_stores',
        crowdLevel: 'AT_CAPACITY',
        estimatedWaitMinutes: 35,
        reporterType: 'LOCAL_RESIDENT',
        travelerId: 'resident_01',
        note: 'Complete rush; token counter closed temporarily',
        allowMockFallback: true,
      });

      const evaluation = await CrowdManagementService.evaluateVenueCapacity({
        placeId: 'place_veena_stores',
        intendedVisitTime: new Date().toISOString(),
        allowMockFallback: true,
      });

      // Assert venue is throttled based on community report
      assert.strictEqual(evaluation.status, 'AT_CAPACITY');
      assert.strictEqual(evaluation.isThrottled, true);
      assert.strictEqual(evaluation.remainingCapacity, 0);
      assert.ok(evaluation.communitySignalsSummary);
      assert.strictEqual(evaluation.communitySignalsSummary.activeReportsCount, 1);
      assert.strictEqual(evaluation.communitySignalsSummary.averageWaitMinutes, 35);
      assert.strictEqual(evaluation.communitySignalsSummary.predominantReportedLevel, 'AT_CAPACITY');
    });

    it('30. transparently attributes signal provenance and summary metadata', async () => {
      CrowdManagementService.clearCommunitySignalsStore();

      await CrowdManagementService.submitCommunityCrowdSignal({
        placeId: 'place_janatha_hotel',
        crowdLevel: 'MODERATE',
        estimatedWaitMinutes: 10,
        reporterType: 'VISITING_TRAVELER',
        travelerId: 'traveler_sam',
        allowMockFallback: true,
      });

      const evaluation = await CrowdManagementService.evaluateVenueCapacity({
        placeId: 'place_janatha_hotel',
        intendedVisitTime: new Date().toISOString(),
        allowMockFallback: true,
      });

      assert.ok(evaluation.signalSource);
      assert.ok(
        evaluation.signalSource === 'COMMUNITY_SIGNALS' ||
        evaluation.signalSource === 'HYBRID_BLENDED'
      );
      assert.ok(evaluation.communitySignalsSummary);
      assert.strictEqual(evaluation.communitySignalsSummary.predominantReportedLevel, 'MODERATE');
      assert.strictEqual(evaluation.communitySignalsSummary.averageWaitMinutes, 10);
    });

    it('31. resolves previously UNKNOWN venue capacity to confirmed state when community signals exist', async () => {
      CrowdManagementService.clearCommunitySignalsStore();
      const uncatalogedPlaceId = 'place_uncataloged_art_corner';

      // Before community report: UNKNOWN
      const beforeEval = await CrowdManagementService.evaluateVenueCapacity({
        placeId: uncatalogedPlaceId,
        intendedVisitTime: new Date().toISOString(),
        allowMockFallback: false,
      });
      assert.strictEqual(beforeEval.status, 'UNKNOWN');

      // Community report submitted
      await CrowdManagementService.submitCommunityCrowdSignal({
        placeId: uncatalogedPlaceId,
        crowdLevel: 'LOW',
        estimatedWaitMinutes: 0,
        reporterType: 'LOCAL_RESIDENT',
        travelerId: 'resident_deepa',
        allowMockFallback: false,
      });

      // After community report: AVAILABLE via community signals
      const afterEval = await CrowdManagementService.evaluateVenueCapacity({
        placeId: uncatalogedPlaceId,
        intendedVisitTime: new Date().toISOString(),
        allowMockFallback: false,
      });
      assert.strictEqual(afterEval.status, 'AVAILABLE');
      assert.strictEqual(afterEval.crowdLevel, 'LOW');
      assert.strictEqual(afterEval.signalSource, 'COMMUNITY_SIGNALS');
      assert.ok(afterEval.communitySignalsSummary);
      assert.strictEqual(afterEval.communitySignalsSummary.activeReportsCount, 1);
    });
  });
});
