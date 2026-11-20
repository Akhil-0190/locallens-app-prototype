/**
 * Plan-B Rerouting, Weather & Closure Test Suite
 * Developer C - Task C5
 *
 * Verifies:
 * 1. Weather retrieval, normalization, freshness & severity evaluation.
 * 2. Closure detection & unavailability signals.
 * 3. Stop re-evaluation, unaffected stop preservation & grounded alternative substitution.
 * 4. Dynamic walking route recalculation via C3 RoutesService.
 * 5. Bounded recalculation loop & arrival-time / capacity coherence.
 * 6. Structured explanation context generation for Developer B (AI).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { WeatherService } from '../services/weather.service.js';
import { PlanBReroutingService } from '../services/plan-b.service.js';
import { RoutesService } from '../services/routes.service.js';
import type { CanonicalRouteDocument } from '../../types/contracts/index.js';

describe('Task C5 - Weather, Closures & Plan-B Rerouting', () => {
  const routesService = new RoutesService();

  // Helper to generate a baseline canonical route
  async function createBaselineRoute(): Promise<CanonicalRouteDocument> {
    return await routesService.generateWalkingRoute({
      title: 'Malleswaram Heritage Walk',
      neighborhood: 'Malleswaram',
      theme: 'Heritage Trail',
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
  }

  // ============================================================================
  // 1. Weather Service Tests
  // ============================================================================
  describe('Weather Service Evaluation', () => {
    const weatherService = new WeatherService();

    it('1. should retrieve clear weather fixture with appropriate metadata', async () => {
      const weather = await weatherService.getWeatherCondition({
        location: { latitude: 13.0075, longitude: 77.5714 },
        intendedVisitTime: '2026-11-20T08:00:00.000Z',
        allowMockFallback: true,
        mockScenarioKey: 'malleswaram_clear',
      });

      assert.strictEqual(weather.condition, 'CLEAR');
      assert.strictEqual(weather.severity, 'NONE');
      assert.strictEqual(weather.isWalkingImpaired, false);
      assert.strictEqual(weather.isMockData, true);
      assert.strictEqual(weather.temperatureCelsius, 24);
    });

    it('2. should evaluate heavy monsoon rain as severe walking impairment', async () => {
      const weather = await weatherService.getWeatherCondition({
        location: { latitude: 13.0075, longitude: 77.5714 },
        intendedVisitTime: '2026-11-20T09:00:00.000Z',
        allowMockFallback: true,
        mockScenarioKey: 'malleswaram_heavy_rain',
      });

      assert.strictEqual(weather.condition, 'HEAVY_RAIN');
      assert.strictEqual(weather.severity, 'SEVERE');
      assert.strictEqual(weather.isWalkingImpaired, true);
      assert.ok(weather.precipitationProbability > 0.8);
      assert.ok(weather.advisory?.includes('downpour'));
    });

    it('3. should evaluate extreme heat as moderate impairment', async () => {
      const weather = await weatherService.getWeatherCondition({
        location: { latitude: 13.0075, longitude: 77.5714 },
        intendedVisitTime: '2026-11-20T13:00:00.000Z',
        allowMockFallback: true,
        mockScenarioKey: 'malleswaram_extreme_heat',
      });

      assert.strictEqual(weather.condition, 'EXTREME_HEAT');
      assert.strictEqual(weather.severity, 'MODERATE');
      assert.strictEqual(weather.isWalkingImpaired, true);
      assert.strictEqual(weather.temperatureCelsius, 38);
    });

    it('4. should honestly return unavailable weather when live API unconfigured and fallback disabled', async () => {
      const unconfiguredWeather = new WeatherService({ apiKey: '' });
      const weather = await unconfiguredWeather.getWeatherCondition({
        location: { latitude: 13.0075, longitude: 77.5714 },
        intendedVisitTime: '2026-11-20T10:00:00.000Z',
        allowMockFallback: false,
      });

      assert.strictEqual(weather.isMockData, false);
      assert.strictEqual(weather.advisory, 'Weather data unavailable.');
    });
  });

  // ============================================================================
  // 2. Closure and Disruption Evaluation
  // ============================================================================
  describe('Closure and Disruption Signals', () => {
    it('5. should identify venue closed for rituals and replace with grounded alternative', async () => {
      const baseline = await createBaselineRoute();

      const rerouteResponse = await PlanBReroutingService.reroutePlanB({
        originalRoute: baseline,
        disruptions: [
          {
            type: 'VENUE_CLOSED',
            affectedPlaceId: 'place_kadu_malleshwara',
            description: 'Temple closed for afternoon rituals',
            severity: 'SEVERE',
            signalTimestamp: '2026-11-20T13:00:00.000Z',
          },
        ],
        allowMockFallback: true,
      });

      assert.strictEqual(rerouteResponse.originalRouteId, baseline.routeId);
      assert.ok(rerouteResponse.rerouteId.startsWith('plan_b_'));
      assert.ok(rerouteResponse.alterations.length >= 2);

      const replaced = rerouteResponse.alterations.find((a) => a.action === 'REPLACED');
      assert.ok(replaced, 'A stop should be replaced');
      assert.strictEqual(replaced.originalPlaceId, 'place_kadu_malleshwara');
      assert.ok(replaced.replacementPlaceId);
      assert.ok(replaced.reason.includes('VENUE_CLOSED'));
    });

    it('6. should preserve unaffected stops when one stop is closed', async () => {
      const baseline = await createBaselineRoute();

      const rerouteResponse = await PlanBReroutingService.reroutePlanB({
        originalRoute: baseline,
        disruptions: [
          {
            type: 'VENUE_CLOSED',
            affectedPlaceId: 'place_kadu_malleshwara',
            description: 'Sanctum closed',
            severity: 'SEVERE',
            signalTimestamp: '2026-11-20T13:00:00.000Z',
          },
        ],
        allowMockFallback: true,
      });

      const retained = rerouteResponse.alterations.find((a) => a.action === 'RETAINED');
      assert.ok(retained, 'CTR Shri Sagar should be retained');
      assert.strictEqual(retained.originalPlaceId, 'place_ctr_shri_sagar');
    });
  });

  // ============================================================================
  // 3. Weather-Driven Plan-B Rerouting
  // ============================================================================
  describe('Weather-Driven Plan-B Recalculation', () => {
    it('7. should trigger Plan-B on severe monsoon rain with indoor preference', async () => {
      const baseline = await createBaselineRoute();

      const rerouteResponse = await PlanBReroutingService.reroutePlanB({
        originalRoute: baseline,
        disruptions: [
          {
            type: 'HEAVY_RAIN',
            description: 'Severe monsoon downpour and waterlogging',
            severity: 'SEVERE',
            signalTimestamp: '2026-11-20T09:00:00.000Z',
          },
        ],
        preferredIndoorAlternatives: true,
        allowMockFallback: true,
      });

      assert.strictEqual(rerouteResponse.hasWeatherImpact, true);
      assert.ok(rerouteResponse.explanationContext.weatherAdvisory?.includes('Weather disruption active'));
      assert.ok(rerouteResponse.updatedRoute.encodedPolyline.length > 0);
    });
  });

  // ============================================================================
  // 4. Capacity and Crowd Throttling Plan-B Rerouting
  // ============================================================================
  describe('Capacity Saturation Plan-B Rerouting', () => {
    it('8. should reroute when a stop reaches hourly capacity limit', async () => {
      const baseline = await createBaselineRoute();

      const rerouteResponse = await PlanBReroutingService.reroutePlanB({
        originalRoute: baseline,
        disruptions: [
          {
            type: 'VENUE_OVERCROWDED',
            affectedPlaceId: 'place_ctr_shri_sagar',
            description: 'Venue reached maximum capacity (isThrottled = true)',
            severity: 'SEVERE',
            signalTimestamp: '2026-11-20T09:00:00.000Z',
          },
        ],
        allowMockFallback: true,
      });

      const ctrAlt = rerouteResponse.alterations.find((a) => a.originalPlaceId === 'place_ctr_shri_sagar');
      assert.ok(ctrAlt);
      assert.strictEqual(ctrAlt.action, 'REPLACED');
      assert.strictEqual(ctrAlt.disruptionType, 'VENUE_OVERCROWDED');
      assert.strictEqual(ctrAlt.replacementPlaceId, 'place_veena_stores');
    });
  });

  // ============================================================================
  // 5. Route Recalculation & Polyline Integrity via C3
  // ============================================================================
  describe('Route Recalculation & Metric Integrity', () => {
    it('9. should recalculate genuine polyline, distance and duration via RoutesService', async () => {
      const baseline = await createBaselineRoute();

      const rerouteResponse = await PlanBReroutingService.reroutePlanB({
        originalRoute: baseline,
        disruptions: [
          {
            type: 'VENUE_CLOSED',
            affectedPlaceId: 'place_kadu_malleshwara',
            description: 'Sanctum closed',
            severity: 'SEVERE',
            signalTimestamp: '2026-11-20T13:00:00.000Z',
          },
        ],
        walkingPace: 'BRISK',
        allowMockFallback: true,
      });

      const updated = rerouteResponse.updatedRoute;
      assert.ok(updated.routeId);
      assert.ok(updated.totalDistanceMeters > 0);
      assert.ok(updated.totalDurationSeconds > 0);
      assert.ok(updated.encodedPolyline.length > 0);
      assert.ok(updated.legs.length > 0);
      assert.ok(updated.legs[0].steps.length > 0);
    });

    it('10. should produce rich structured explanation context for Developer B', async () => {
      const baseline = await createBaselineRoute();

      const rerouteResponse = await PlanBReroutingService.reroutePlanB({
        originalRoute: baseline,
        disruptions: [
          {
            type: 'VENUE_CLOSED',
            affectedPlaceId: 'place_kadu_malleshwara',
            description: 'Sanctum closed for rituals',
            severity: 'SEVERE',
            signalTimestamp: '2026-11-20T13:00:00.000Z',
          },
        ],
        allowMockFallback: true,
      });

      const exp = rerouteResponse.explanationContext;
      assert.ok(exp.summary.includes('Plan-B reroute generated'));
      assert.strictEqual(exp.primaryDisruption, 'VENUE_CLOSED');
      assert.strictEqual(exp.replacedStops.length, 1);
      assert.strictEqual(exp.retainedStopsCount, 1);
      assert.strictEqual(typeof exp.distanceDeltaMeters, 'number');
      assert.strictEqual(typeof exp.durationDeltaSeconds, 'number');
    });

    it('11. should reject reroute requests with missing or invalid original route', async () => {
      await assert.rejects(
        async () => {
          await PlanBReroutingService.reroutePlanB({
            originalRoute: null as any,
            disruptions: [],
          });
        },
        {
          message: /Valid originalRoute is required/,
        }
      );
    });

    it('12. should explicitly label sample and fallback responses with isMockData: true', async () => {
      const baseline = await createBaselineRoute();

      const rerouteResponse = await PlanBReroutingService.reroutePlanB({
        originalRoute: baseline,
        disruptions: [
          {
            type: 'VENUE_CLOSED',
            affectedPlaceId: 'place_kadu_malleshwara',
            description: 'Closed',
            severity: 'SEVERE',
            signalTimestamp: '2026-11-20T13:00:00.000Z',
          },
        ],
        allowMockFallback: true,
      });

      assert.strictEqual(rerouteResponse.isMockData, true);
      assert.strictEqual(rerouteResponse.updatedRoute.isMockData, true);
    });
  });
});
