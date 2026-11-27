/**
 * Maps, Places, Routes, and Crowd End-to-End Integration Test Suite
 * Developer C - Task C6
 *
 * Verifies the complete location, grounding, walking route, capacity-aware scheduling,
 * and Plan-B dynamic rerouting pipeline across C1 through C5:
 *
 * Test 1: Place lookup (SearchText, SearchNearby, error/quota/empty behavior)
 * Test 2: Place grounding & verification (Exact/High/Ambiguous/No-Match, discrepancies)
 * Test 3: Walking route generation (Routes API, polylines, legs, steps, metric units)
 * Test 4: Stop sequencing & walking metrics (Waypoints, personalized pace multipliers)
 * Test 5: Capacity & crowd management (Domain 07 4-tier thresholds, slot derivation, scheduling)
 * Test 6: Alternatives & Plan-B rerouting (Disruptions, genuine venue names, detour leg recalculated arrival times)
 * Test 7: Weather & closure signals (Current vs forecast distinction, UNAVAILABLE semantics)
 * Test 8: Failure & degraded-mode handling (Missing keys, permission denied, invalid inputs, safe fallbacks)
 * Test 9: Client-facing integration (Domain 08 CanonicalRouteDocument, PlanBExplanationContext, D5 offline pack alignment)
 * Test 10: End-to-end integration pipeline execution (Place grounding -> Route -> Capacity check -> Plan-B reroute)
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import './fixtures/register.js';
import { PlacesService } from '../services/places.service.js';
import { GroundingService } from '../services/grounding.service.js';
import { RoutesService } from '../services/routes.service.js';
import { CrowdManagementService } from '../services/crowd-management.service.js';
import { WeatherService } from '../services/weather.service.js';
import { PlanBReroutingService } from '../services/plan-b.service.js';
import { QuotaHandlerService } from '../services/quota-handler.service.js';
import { calculateCrowdLevel } from '../../capacity/capacity-service.js';
import type { CanonicalRouteDocument } from '../../types/contracts/index.js';

describe('Task C6: Maps, Places, Routes and Crowd Integration Test Suite', () => {
  const placesService = new PlacesService();
  const routesService = new RoutesService();
  const weatherService = new WeatherService();
  const groundingService = new GroundingService({}, placesService);

  // Helper to build a canonical baseline route
  async function getBaselineHeritageRoute(): Promise<CanonicalRouteDocument> {
    return await routesService.generateWalkingRoute({
      title: 'Malleshwaram Heritage Walk',
      neighborhood: 'Malleshwaram',
      theme: 'Heritage Trail',
      stops: [
        {
          placeId: 'place_ctr_shri_sagar',
          spotName: 'CTR Shri Sagar',
          coordinate: { latitude: 13.003185, longitude: 77.570258 },
        },
        {
          placeId: 'place_kadu_malleshwara',
          spotName: 'Kadu Malleshwara Temple',
          coordinate: { latitude: 13.00725, longitude: 77.57189 },
        },
      ],
      allowMockFallback: true,
    });
  }

  // ============================================================================
  // Test 1 — Place Lookup (C1)
  // ============================================================================
  describe('Test 1 — Place Lookup', () => {
    it('1.1 should construct search request and retrieve places with normalized coordinates', async () => {
      const places = await placesService.searchText({
        textQuery: 'CTR Shri Sagar Malleshwaram',
      });

      assert.ok(Array.isArray(places));
      assert.ok(places.length > 0);
      const place = places[0];
      assert.ok(place.placeId);
      assert.ok(place.name.includes('CTR'));
      assert.ok(place.coordinate.isValid);
      assert.strictEqual(typeof place.coordinate.latitude, 'number');
      assert.strictEqual(typeof place.coordinate.longitude, 'number');
      assert.strictEqual(place.isMockData, true); // Verified fallback mode
    });

    it('1.2 should retrieve nearby places using circular boundary constraint', async () => {
      const nearby = await placesService.searchNearby({
        locationRestriction: {
          circle: {
            center: { latitude: 13.003185, longitude: 77.570258 },
            radius: 1000,
          },
        },
      });

      assert.ok(Array.isArray(nearby));
      assert.ok(nearby.length > 0);
      assert.ok(nearby.some((p) => p.name.includes('Malleshwaram') || p.name.includes('CTR')));
    });

    it('1.3 should handle missing credentials without mock fallback by throwing', async () => {
      const strictPlacesService = new PlacesService({ apiKey: '', allowMockFallback: false });
      await assert.rejects(
        async () => {
          await strictPlacesService.searchText({ textQuery: 'CTR' });
        },
        {
          message: /Google Maps API Key is not configured/,
        }
      );
    });
  });

  // ============================================================================
  // Test 2 — Place Grounding & Verification (C2)
  // ============================================================================
  describe('Test 2 — Place Grounding and Verification', () => {
    it('2.1 should ground a local contribution to canonical place draft with high confidence', async () => {
      const grounded = await groundingService.groundContributedPlace({
        spotName: 'CTR Shri Sagar',
        neighborhoodHint: 'Malleshwaram',
        infoParagraph: 'Iconic heritage eatery in historic Malleshwaram.',
        contributorCoordinate: { latitude: 13.003185, longitude: 77.570258 },
      });

      assert.ok(grounded.canonicalPlaceDraft);
      assert.ok(
        grounded.evidence.matchConfidence === 'EXACT_MATCH' ||
        grounded.evidence.matchConfidence === 'HIGH_CONFIDENCE'
      );
      assert.strictEqual(grounded.canonicalPlaceDraft.spotName, 'CTR Shri Sagar (Malleshwaram)');
      assert.strictEqual(grounded.canonicalPlaceDraft.coordinate.precision, 6);
      assert.ok(
        grounded.evidence.sources.some(
          (s) => s.source === 'SAMPLE_FIXTURE_DATA' || s.source === 'GOOGLE_PLACES_API_NEW'
        )
      );
      assert.strictEqual(grounded.evidence.isMockData, true);
    });

    it('2.2 should detect distance discrepancies when user coordinate is far from grounded place', async () => {
      const grounded = await groundingService.groundContributedPlace({
        spotName: 'CTR Shri Sagar',
        neighborhoodHint: 'Malleshwaram',
        infoParagraph: 'Food stall.',
        contributorCoordinate: { latitude: 13.0500, longitude: 77.6000 }, // ~5km away
      });

      const distDisc = grounded.evidence.discrepancies.find((d) => d.type === 'LOCATION_DISTANCE_HIGH');
      assert.ok(distDisc);
      assert.strictEqual(distDisc.severity, 'SUSPICIOUS');
      assert.ok(distDisc.description.includes('away'));
    });

    it('2.3 should flag low confidence and unverified draft when place cannot be located with precision', async () => {
      const grounded = await groundingService.groundContributedPlace({
        spotName: 'NonExistentGhostVenue123456789',
        neighborhoodHint: 'Nowhere',
        infoParagraph: 'Ghost venue.',
      });

      assert.ok(
        grounded.evidence.matchConfidence === 'NO_MATCH' ||
        grounded.evidence.matchConfidence === 'AMBIGUOUS_MATCH'
      );
      assert.strictEqual(grounded.canonicalPlaceDraft.isVerified, false);
      assert.ok(grounded.evidence.discrepancies.some((d) => d.type === 'NAME_MISMATCH'));
    });
  });

  // ============================================================================
  // Test 3 — Walking Route Generation (C3)
  // ============================================================================
  describe('Test 3 — Walking Route Generation', () => {
    it('3.1 should generate canonical walking route with metric distance, duration, and polyline', async () => {
      const route = await getBaselineHeritageRoute();

      assert.ok(route.routeId);
      assert.strictEqual(route.theme, 'Heritage Trail');
      assert.ok(route.totalDistanceMeters > 0);
      assert.ok(route.totalDurationSeconds > 0);
      assert.ok(route.formattedDistance.includes('m') || route.formattedDistance.includes('km'));
      assert.ok(route.formattedDuration.includes('min'));
      assert.ok(route.encodedPolyline.length > 0);
      assert.ok(route.legs.length >= 1);
      assert.strictEqual(route.legs[0].steps.length > 0, true);
      assert.strictEqual(route.isMockData, true);
    });

    it('3.2 should reject route requests with fewer than 2 stops with typed error', async () => {
      await assert.rejects(
        async () => {
          await routesService.generateWalkingRoute({
            stops: [{ coordinate: { latitude: 13.003, longitude: 77.570 } }],
          });
        },
        {
          message: /At least 2 valid stops are required/,
        }
      );
    });
  });

  // ============================================================================
  // Test 4 — Stop Sequencing & Walking Metrics (C3)
  // ============================================================================
  describe('Test 4 — Stop Sequencing and Walking Metrics', () => {
    it('4.1 should apply personalized pace multipliers correctly (RELAXED, NORMAL, BRISK)', async () => {
      const stops = [
        { coordinate: { latitude: 13.003185, longitude: 77.570258 } },
        { coordinate: { latitude: 13.00725, longitude: 77.57189 } },
      ];

      const normalRoute = await routesService.generateWalkingRoute({ stops, walkingPace: 'NORMAL', allowMockFallback: true });
      const relaxedRoute = await routesService.generateWalkingRoute({ stops, walkingPace: 'RELAXED', allowMockFallback: true });
      const briskRoute = await routesService.generateWalkingRoute({ stops, walkingPace: 'BRISK', allowMockFallback: true });

      // Relaxed duration should be > normal; brisk duration should be < normal
      assert.ok(relaxedRoute.totalDurationSeconds > normalRoute.totalDurationSeconds);
      assert.ok(briskRoute.totalDurationSeconds < normalRoute.totalDurationSeconds);
      // Distance must remain identical
      assert.strictEqual(relaxedRoute.totalDistanceMeters, normalRoute.totalDistanceMeters);
      assert.strictEqual(briskRoute.totalDistanceMeters, normalRoute.totalDistanceMeters);
    });

    it('4.2 should associate intermediate waypoints and route legs consistently', async () => {
      const stops = [
        { placeId: 'place_ctr', spotName: 'CTR', coordinate: { latitude: 13.003185, longitude: 77.570258 } },
        { placeId: 'place_market', spotName: 'Flower Market', coordinate: { latitude: 13.00412, longitude: 77.57143 } },
        { placeId: 'place_temple', spotName: 'Temple', coordinate: { latitude: 13.00725, longitude: 77.57189 } },
      ];

      const multiStopRoute = await routesService.generateWalkingRoute({
        title: 'Multi-Stop Test Route',
        stops,
        allowMockFallback: true,
      });
      assert.strictEqual(multiStopRoute.legs.length, 2);
      assert.strictEqual(multiStopRoute.waypointPlaceIds?.length, 3);
      assert.strictEqual(multiStopRoute.legs[0].startPlaceId, 'place_ctr');
      assert.strictEqual(multiStopRoute.legs[0].endPlaceId, 'place_market');
      assert.strictEqual(multiStopRoute.legs[1].startPlaceId, 'place_market');
      assert.strictEqual(multiStopRoute.legs[1].endPlaceId, 'place_temple');
    });
  });

  // ============================================================================
  // Test 5 — Capacity & Crowd Management (C4)
  // ============================================================================
  describe('Test 5 — Capacity and Crowd Management', () => {
    it('5.1 should enforce exact Domain 07 4-bracket remaining capacity math', () => {
      // LOW: > 60%
      assert.deepStrictEqual(calculateCrowdLevel(7, 10), { level: 'LOW', isThrottled: false });
      // MODERATE: 30% - 60%
      assert.deepStrictEqual(calculateCrowdLevel(4, 10), { level: 'MODERATE', isThrottled: false });
      // HIGH: 1% - 29%
      assert.deepStrictEqual(calculateCrowdLevel(2, 10), { level: 'HIGH', isThrottled: false });
      // AT_CAPACITY: <= 0 (isThrottled = true)
      assert.deepStrictEqual(calculateCrowdLevel(0, 10), { level: 'AT_CAPACITY', isThrottled: true });
      assert.deepStrictEqual(calculateCrowdLevel(-1, 10), { level: 'AT_CAPACITY', isThrottled: true });
    });

    it('5.2 should evaluate hourly capacity for known and unknown places', async () => {
      // Known place in fixture
      const knownEval = await CrowdManagementService.evaluateVenueCapacity({
        placeId: 'place_ctr_shri_sagar',
        intendedVisitTime: '2026-11-20T08:00:00.000Z',
        allowMockFallback: true,
      });
      assert.strictEqual(knownEval.status, 'AVAILABLE');
      assert.strictEqual(knownEval.isThrottled, false);
      assert.strictEqual(knownEval.slotId, 'slot_20261120_0800');

      // Unknown place
      const unknownEval = await CrowdManagementService.evaluateVenueCapacity({
        placeId: 'unknown_stall_xyz',
        intendedVisitTime: '2026-11-20T08:00:00.000Z',
        allowMockFallback: true,
      });
      assert.strictEqual(unknownEval.status, 'UNKNOWN');
      assert.strictEqual(unknownEval.isThrottled, false);
    });

    it('5.3 should reject visit booking when slot is at capacity', async () => {
      const scheduleResult = await CrowdManagementService.scheduleVisit({
        placeId: 'place_ctr_shri_sagar',
        hourSlot: '2026-11-20T09:00:00.000Z', // AT_CAPACITY in fixture
        partySize: 2,
        travelerId: 'traveler_c6_test',
        idempotencyKey: 'idemp_key_c6_001',
        allowMockFallback: true,
      });

      assert.strictEqual(scheduleResult.success, false);
      assert.strictEqual(scheduleResult.status, 'REJECTED_FULL');
      assert.ok(scheduleResult.suggestedAlternativeSlots!.length > 0);
      assert.ok(scheduleResult.suggestedAlternativeVenues!.length > 0);
    });
  });

  // ============================================================================
  // Test 6 — Alternatives and Plan-B Rerouting (C5)
  // ============================================================================
  describe('Test 6 — Alternatives and Plan-B Routing', () => {
    it('6.1 should reroute affected closed stop, preserve unaffected stops and genuine venue names', async () => {
      const baseline = await getBaselineHeritageRoute();

      const rerouteResponse = await PlanBReroutingService.reroutePlanB({
        originalRoute: baseline,
        disruptions: [
          {
            type: 'VENUE_CLOSED',
            affectedPlaceId: 'place_kadu_malleshwara',
            description: 'Temple closed for rituals',
            severity: 'SEVERE',
            signalTimestamp: '2026-11-20T13:00:00.000Z',
          },
        ],
        allowMockFallback: true,
      });

      assert.strictEqual(rerouteResponse.originalRouteId, baseline.routeId);
      assert.ok(rerouteResponse.rerouteId.startsWith('plan_b_'));
      assert.strictEqual(rerouteResponse.alterations[0].action, 'RETAINED');
      assert.strictEqual(rerouteResponse.alterations[0].originalStopName, 'CTR Shri Sagar');

      const replaced = rerouteResponse.alterations.find((a) => a.action === 'REPLACED');
      assert.ok(replaced);
      assert.strictEqual(replaced.originalStopName, 'Kadu Malleshwara Temple');
      assert.ok(replaced.replacementStopName);
      assert.ok(rerouteResponse.explanationContext.summary.includes('Plan-B reroute generated'));
      assert.strictEqual(rerouteResponse.explanationContext.replacedStops[0].from, 'Kadu Malleshwara Temple');
    });

    it('6.2 should recalculate subsequent arrival times using regenerated leg durations', async () => {
      const baseline = await getBaselineHeritageRoute();
      const startTime = '2026-11-20T08:00:00.000Z';

      const rerouteResponse = await PlanBReroutingService.reroutePlanB({
        originalRoute: baseline,
        originalStartTime: startTime,
        disruptions: [
          {
            type: 'VENUE_CLOSED',
            affectedPlaceId: 'place_kadu_malleshwara',
            description: 'Closed',
            severity: 'SEVERE',
            signalTimestamp: startTime,
          },
        ],
        allowMockFallback: true,
      });

      const alterations = rerouteResponse.alterations;
      const leg0DurationSeconds = rerouteResponse.updatedRoute.legs[0].durationSeconds;
      const expectedStop1ArrivalMs = new Date(startTime).getTime() + leg0DurationSeconds * 1000;
      const actualStop1ArrivalMs = new Date(alterations[1].scheduledArrival!).getTime();

      assert.strictEqual(actualStop1ArrivalMs, expectedStop1ArrivalMs);
    });
  });

  // ============================================================================
  // Test 7 — Weather and Closure Signals (C5)
  // ============================================================================
  describe('Test 7 — Weather and Closure Information', () => {
    it('7.1 should evaluate current weather vs unverified future forecast correctly', async () => {
      // Current condition
      const current = await weatherService.getWeatherCondition({
        location: { latitude: 13.003185, longitude: 77.570258 },
        intendedVisitTime: new Date().toISOString(),
        allowMockFallback: true,
      });
      assert.strictEqual(current.dataType, 'CURRENT');

      // Future visit (> 2 hours)
      const futureTime = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
      const future = await weatherService.getWeatherCondition({
        location: { latitude: 13.003185, longitude: 77.570258 },
        intendedVisitTime: futureTime,
        allowMockFallback: true,
      });
      assert.strictEqual(future.dataType, 'FORECAST');
    });

    it('7.2 should return condition UNAVAILABLE when credentials missing and mock disabled', async () => {
      const unconfigured = new WeatherService({ apiKey: '', weatherApiKey: '', allowMockFallback: false });
      const weather = await unconfigured.getWeatherCondition({
        location: { latitude: 13.003185, longitude: 77.570258 },
        intendedVisitTime: new Date().toISOString(),
        allowMockFallback: false,
      });

      assert.strictEqual(weather.condition, 'UNAVAILABLE');
      assert.strictEqual(weather.dataType, 'UNAVAILABLE');
      assert.notStrictEqual(weather.condition, 'CLEAR');
    });
  });

  // ============================================================================
  // Test 8 — Failure and Degraded-Mode Handling
  // ============================================================================
  describe('Test 8 — Failure and Degraded-Mode Handling', () => {
    it('8.1 should classify errors correctly in QuotaHandlerService', () => {
      assert.strictEqual(QuotaHandlerService.classifyError(403).category, 'PERMISSION_DENIED');
      assert.strictEqual(QuotaHandlerService.classifyError(429).category, 'QUOTA_EXHAUSTED');
      assert.strictEqual(QuotaHandlerService.classifyError(503).category, 'TRANSIENT_SERVER_ERROR');
      assert.strictEqual(QuotaHandlerService.classifyError(400).category, 'INVALID_REQUEST');
    });

    it('8.2 should retry on transient errors and succeed', async () => {
      let attempts = 0;
      const result = await QuotaHandlerService.executeWithRetry(async () => {
        attempts++;
        if (attempts < 2) {
          const err: any = new Error('Service Unavailable');
          err.status = 503;
          throw err;
        }
        return 'success';
      }, 3, 10);

      assert.strictEqual(result, 'success');
      assert.strictEqual(attempts, 2);
    });

    it('8.3 should not retry on non-retryable 403 error', async () => {
      let attempts = 0;
      await assert.rejects(
        async () => {
          await QuotaHandlerService.executeWithRetry(async () => {
            attempts++;
            const err: any = new Error('Forbidden');
            err.status = 403;
            throw err;
          }, 3, 10);
        },
        {
          message: /Forbidden/,
        }
      );
      assert.strictEqual(attempts, 1);
    });
  });

  // ============================================================================
  // Test 9 — Client-Facing Integration Contract (Domain 08 & D5 Alignment)
  // ============================================================================
  describe('Test 9 — Client-Facing Integration Contract', () => {
    it('9.1 should produce CanonicalRouteDocument strictly conforming to Domain 08 schema', async () => {
      const route = await getBaselineHeritageRoute();

      assert.strictEqual(typeof route.routeId, 'string');
      assert.strictEqual(typeof route.title, 'string');
      assert.strictEqual(typeof route.neighborhood, 'string');
      assert.strictEqual(typeof route.totalDistanceMeters, 'number');
      assert.strictEqual(typeof route.totalDurationSeconds, 'number');
      assert.ok(route.origin.isValid);
      assert.ok(route.destination.isValid);
      assert.ok(Array.isArray(route.legs));
      assert.strictEqual(typeof route.isMockData, 'boolean');
      assert.ok(route.createdAt);
      assert.ok(route.updatedAt);
    });

    it('9.2 should produce structured PlanBExplanationContext compatible with Developer B / AI consumption', async () => {
      const baseline = await getBaselineHeritageRoute();
      const reroute = await PlanBReroutingService.reroutePlanB({
        originalRoute: baseline,
        disruptions: [{ type: 'VENUE_CLOSED', affectedPlaceId: 'place_kadu_malleshwara', description: 'Closed', severity: 'SEVERE', signalTimestamp: new Date().toISOString() }],
        allowMockFallback: true,
      });

      const exp = reroute.explanationContext;
      assert.ok(exp.summary);
      assert.strictEqual(exp.primaryDisruption, 'VENUE_CLOSED');
      assert.strictEqual(exp.disruptedStopsCount, 1);
      assert.strictEqual(exp.retainedStopsCount, 1);
      assert.strictEqual(typeof exp.distanceDeltaMeters, 'number');
      assert.strictEqual(typeof exp.durationDeltaSeconds, 'number');
    });
  });

  // ============================================================================
  // Test 10 — Complete End-to-End Pipeline Execution
  // ============================================================================
  describe('Test 10 — Complete End-to-End Pipeline Execution', () => {
    it('10.1 executes entire workflow: Place Grounding -> Route Generation -> Capacity Check -> Disruption -> Plan-B Rerouting', async () => {
      // Step 1: Ground contributed place
      const groundingResult = await groundingService.groundContributedPlace({
        spotName: 'CTR Shri Sagar',
        neighborhoodHint: 'Malleshwaram',
        infoParagraph: 'Authentic local dosa spot.',
        contributorCoordinate: { latitude: 13.003185, longitude: 77.570258 },
      });
      assert.ok(groundedIsMatch(groundingResult.evidence.matchConfidence));
      const stop1Coord = groundingResult.canonicalPlaceDraft!.coordinate;

      // Step 2: Generate Initial Route
      const initialRoute = await routesService.generateWalkingRoute({
        title: 'End-to-End Integration Trail',
        neighborhood: 'Malleshwaram',
        stops: [
          { placeId: 'place_ctr_shri_sagar', spotName: 'CTR Shri Sagar', coordinate: stop1Coord },
          { placeId: 'place_kadu_malleshwara', spotName: 'Kadu Malleshwara Temple', coordinate: { latitude: 13.00725, longitude: 77.57189 } },
        ],
        allowMockFallback: true,
      });
      assert.ok(initialRoute.encodedPolyline);

      // Step 3: Check capacity for scheduled visit
      const capCheck = await CrowdManagementService.evaluateVenueCapacity({
        placeId: 'place_ctr_shri_sagar',
        intendedVisitTime: '2026-11-20T08:00:00.000Z',
        allowMockFallback: true,
      });
      assert.strictEqual(capCheck.status, 'AVAILABLE');

      // Step 4: Disruption occurs at Stop 2 (Temple closure) -> Trigger Plan-B Rerouting
      const planBResult = await PlanBReroutingService.reroutePlanB({
        originalRoute: initialRoute,
        originalStartTime: '2026-11-20T08:00:00.000Z',
        disruptions: [
          {
            type: 'VENUE_CLOSED',
            affectedPlaceId: 'place_kadu_malleshwara',
            description: 'Temple closed for rituals',
            severity: 'SEVERE',
            signalTimestamp: '2026-11-20T08:00:00.000Z',
          },
        ],
        allowMockFallback: true,
      });

      // Assert complete pipeline integrity
      assert.strictEqual(planBResult.originalRouteId, initialRoute.routeId);
      assert.strictEqual(planBResult.alterations[0].action, 'RETAINED');
      assert.strictEqual(planBResult.alterations[0].originalStopName, 'CTR Shri Sagar');
      assert.strictEqual(planBResult.alterations[1].action, 'REPLACED');
      assert.strictEqual(planBResult.alterations[1].originalStopName, 'Kadu Malleshwara Temple');
      assert.ok(planBResult.updatedRoute.encodedPolyline);
      assert.ok(planBResult.updatedRoute.totalDistanceMeters > 0);
      assert.ok(planBResult.updatedRoute.totalDurationSeconds > 0);
    });
  });
});

function groundedIsMatch(confidence: string): boolean {
  return confidence === 'EXACT_MATCH' || confidence === 'HIGH_CONFIDENCE';
}
