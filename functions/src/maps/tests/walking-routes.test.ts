import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import { RoutesService } from '../services/routes.service';
import { RouteGenerationError } from '../types/routes.types';
import { SAMPLE_RAW_ROUTE_FIXTURE } from '../fixtures/sample-routes.fixture';
import { validateCanonicalRoute } from '../../types/contracts';

describe('Task C3 - Walking Routes Service & Generator', () => {
  const ctrStop = {
    placeId: 'place_ctr_malleshwaram_01',
    spotName: 'CTR (Shri Sagar)',
    coordinate: { latitude: 13.003185, longitude: 77.570258 },
  };

  const flowerMarketStop = {
    placeId: 'place_flower_market_02',
    spotName: 'Malleshwaram Flower Market',
    coordinate: { latitude: 13.00412, longitude: 77.57143 },
  };

  const templeStop = {
    placeId: 'place_kadu_temple_03',
    spotName: 'Kadu Malleshwara Temple',
    coordinate: { latitude: 13.00725, longitude: 77.57189 },
  };

  it('should generate a valid 2-stop canonical walking route', async () => {
    const service = new RoutesService({ apiKey: '', allowMockFallback: true });
    const route = await service.generateWalkingRoute({
      title: 'Quick Malleshwaram Stroll',
      neighborhood: 'Malleshwaram',
      stops: [ctrStop, flowerMarketStop],
    });

    assert.ok(route.routeId.length > 0);
    assert.strictEqual(route.title, 'Quick Malleshwaram Stroll');
    assert.strictEqual(route.neighborhood, 'Malleshwaram');
    assert.strictEqual(route.isMockData, true);
    assert.strictEqual(route.legs.length, 1);
    assert.strictEqual(route.legs[0]?.startPlaceId, 'place_ctr_malleshwaram_01');
    assert.strictEqual(route.legs[0]?.endPlaceId, 'place_flower_market_02');
    assert.ok(route.totalDistanceMeters > 0);
    assert.ok(route.totalDurationSeconds > 0);
    assert.ok(route.formattedDistance.length > 0);
    assert.ok(route.formattedDuration.length > 0);
    assert.ok(route.legs[0]?.steps[0]?.instruction.includes('[Offline Approximation]'));

    // Validate schema contract
    const validated = validateCanonicalRoute(route);
    assert.strictEqual(validated.routeId, route.routeId);
  });

  it('should generate a multi-stop canonical walking route with waypoints', async () => {
    const service = new RoutesService({ apiKey: '', allowMockFallback: true });
    const route = await service.generateWalkingRoute({
      title: 'Malleshwaram Heritage Walk',
      neighborhood: 'Malleshwaram',
      theme: 'Heritage / Street Food Trail',
      stops: [ctrStop, flowerMarketStop, templeStop],
      optimizeStopOrder: false,
    });

    assert.strictEqual(route.legs.length, 2);
    assert.strictEqual(route.waypoints.length, 1);
    assert.deepStrictEqual(route.waypointPlaceIds, [
      'place_ctr_malleshwaram_01',
      'place_flower_market_02',
      'place_kadu_temple_03',
    ]);
    assert.strictEqual(route.legs[0]?.startPlaceId, 'place_ctr_malleshwaram_01');
    assert.strictEqual(route.legs[0]?.endPlaceId, 'place_flower_market_02');
    assert.strictEqual(route.legs[1]?.startPlaceId, 'place_flower_market_02');
    assert.strictEqual(route.legs[1]?.endPlaceId, 'place_kadu_temple_03');

    // Confirm navigation steps exist
    assert.ok(route.legs[0]?.steps.length && route.legs[0].steps.length > 0);
    assert.ok(route.legs[1]?.steps.length && route.legs[1].steps.length > 0);

    validateCanonicalRoute(route);
  });

  it('should adjust walking durations based on walking pace (RELAXED, NORMAL, BRISK)', async () => {
    const service = new RoutesService({ apiKey: '', allowMockFallback: true });

    const normalRoute = await service.generateWalkingRoute({
      stops: [ctrStop, flowerMarketStop],
      walkingPace: 'NORMAL',
    });

    const relaxedRoute = await service.generateWalkingRoute({
      stops: [ctrStop, flowerMarketStop],
      walkingPace: 'RELAXED',
    });

    const briskRoute = await service.generateWalkingRoute({
      stops: [ctrStop, flowerMarketStop],
      walkingPace: 'BRISK',
    });

    // Relaxed should take ~1.25x longer than Normal
    assert.ok(
      relaxedRoute.totalDurationSeconds > normalRoute.totalDurationSeconds,
      'Relaxed duration should exceed normal duration'
    );

    // Brisk should take ~0.85x of Normal
    assert.ok(
      briskRoute.totalDurationSeconds < normalRoute.totalDurationSeconds,
      'Brisk duration should be less than normal duration'
    );

    // Verify mathematical ratio
    const relaxedRatio = relaxedRoute.totalDurationSeconds / normalRoute.totalDurationSeconds;
    assert.ok(
      Math.abs(relaxedRatio - 1.25) < 0.05,
      `Expected relaxed ratio ~1.25, got ${relaxedRatio}`
    );

    const briskRatio = briskRoute.totalDurationSeconds / normalRoute.totalDurationSeconds;
    assert.ok(
      Math.abs(briskRatio - 0.85) < 0.05,
      `Expected brisk ratio ~0.85, got ${briskRatio}`
    );
  });

  it('should parse raw Google Routes API response into CanonicalRouteDocument', () => {
    const service = new RoutesService({ apiKey: '' });
    const stops = [ctrStop, flowerMarketStop, templeStop];

    const parsed = service.parseRawCanonicalRoute(
      SAMPLE_RAW_ROUTE_FIXTURE,
      {
        title: 'Malleshwaram Cultural Loop',
        neighborhood: 'Malleshwaram',
        stops,
        walkingPace: 'NORMAL',
      },
      stops,
      1.0,
      false
    );

    assert.strictEqual(parsed.title, 'Malleshwaram Cultural Loop');
    assert.strictEqual(parsed.neighborhood, 'Malleshwaram');
    assert.strictEqual(parsed.isMockData, false);
    assert.strictEqual(parsed.totalDistanceMeters, 1150);
    assert.strictEqual(parsed.totalDurationSeconds, 870);
    assert.strictEqual(parsed.legs.length, 2);
    assert.strictEqual(parsed.legs[0]?.startPlaceId, 'place_ctr_malleshwaram_01');
    assert.strictEqual(parsed.legs[0]?.endPlaceId, 'place_flower_market_02');
    assert.strictEqual(parsed.legs[1]?.startPlaceId, 'place_flower_market_02');
    assert.strictEqual(parsed.legs[1]?.endPlaceId, 'place_kadu_temple_03');

    // Steps parsing
    assert.strictEqual(
      parsed.legs[0]?.steps[0]?.instruction,
      'Walk east on 7th Cross Rd toward Margosa Rd'
    );
    assert.strictEqual(parsed.legs[0]?.steps[0]?.distanceMeters, 200);

    // Schema validation
    validateCanonicalRoute(parsed);
  });

  it('should preserve waypoint reordering when API returns optimized intermediate order', () => {
    const service = new RoutesService({ apiKey: '' });
    const stopA = { placeId: 'A', spotName: 'Start', coordinate: { latitude: 13.0, longitude: 77.5 } };
    const stopB = { placeId: 'B', spotName: 'Intermediate 1', coordinate: { latitude: 13.1, longitude: 77.6 } };
    const stopC = { placeId: 'C', spotName: 'Intermediate 2', coordinate: { latitude: 13.2, longitude: 77.7 } };
    const stopD = { placeId: 'D', spotName: 'End', coordinate: { latitude: 13.3, longitude: 77.8 } };

    const rawWithOptimization = {
      ...SAMPLE_RAW_ROUTE_FIXTURE,
      optimizedIntermediateWaypointIndex: [1, 0], // C visited before B
      legs: [
        {
          distanceMeters: 300,
          duration: '200s',
          steps: [],
        },
        {
          distanceMeters: 400,
          duration: '300s',
          steps: [],
        },
        {
          distanceMeters: 500,
          duration: '400s',
          steps: [],
        },
      ],
    };

    const parsed = service.parseRawCanonicalRoute(
      rawWithOptimization,
      {
        title: 'Optimized Trail',
        stops: [stopA, stopB, stopC, stopD],
        optimizeStopOrder: true,
      },
      [stopA, stopB, stopC, stopD],
      1.0,
      false
    );

    assert.deepStrictEqual(parsed.optimizedWaypointOrder, [1, 0]);
    assert.deepStrictEqual(parsed.waypointPlaceIds, ['A', 'C', 'B', 'D']);
    // Leg 0: Start (A) -> Intermediate 2 (C)
    assert.strictEqual(parsed.legs[0]?.startPlaceId, 'A');
    assert.strictEqual(parsed.legs[0]?.endPlaceId, 'C');
    // Leg 1: Intermediate 2 (C) -> Intermediate 1 (B)
    assert.strictEqual(parsed.legs[1]?.startPlaceId, 'C');
    assert.strictEqual(parsed.legs[1]?.endPlaceId, 'B');
    // Leg 2: Intermediate 1 (B) -> End (D)
    assert.strictEqual(parsed.legs[2]?.startPlaceId, 'B');
    assert.strictEqual(parsed.legs[2]?.endPlaceId, 'D');

    validateCanonicalRoute(parsed);
  });

  it('should reject requests with fewer than 2 stops with INSUFFICIENT_STOPS error', async () => {
    const service = new RoutesService({ apiKey: '', allowMockFallback: true });

    await assert.rejects(
      async () => {
        await service.generateWalkingRoute({
          stops: [ctrStop],
        });
      },
      (err: any) => {
        assert.ok(err instanceof RouteGenerationError);
        assert.strictEqual(err.code, 'INSUFFICIENT_STOPS');
        assert.strictEqual(err.status, 400);
        return true;
      }
    );
  });

  it('should reject requests with invalid coordinates with INVALID_COORDINATES error', async () => {
    const service = new RoutesService({ apiKey: '', allowMockFallback: true });

    await assert.rejects(
      async () => {
        await service.generateWalkingRoute({
          stops: [
            ctrStop,
            {
              placeId: 'bad_stop',
              coordinate: { latitude: 999, longitude: 77.57 }, // Invalid latitude
            },
          ],
        });
      },
      (err: any) => {
        assert.ok(err instanceof RouteGenerationError);
        assert.strictEqual(err.code, 'INVALID_COORDINATES');
        assert.strictEqual(err.status, 400);
        return true;
      }
    );
  });

  it('should throw PERMISSION_DENIED when API key missing and allowMockFallback is false', async () => {
    const service = new RoutesService({ apiKey: '', allowMockFallback: false });

    await assert.rejects(
      async () => {
        await service.generateWalkingRoute({
          stops: [ctrStop, flowerMarketStop],
          allowMockFallback: false,
        });
      },
      (err: any) => {
        assert.ok(err instanceof RouteGenerationError);
        assert.strictEqual(err.code, 'PERMISSION_DENIED');
        assert.strictEqual(err.status, 403);
        return true;
      }
    );
  });
});
