import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import { RoutesService } from '../services/routes.service';
import { SAMPLE_RAW_ROUTE_FIXTURE } from '../fixtures/sample-routes.fixture';

describe('RoutesService', () => {
  it('should fall back gracefully to labeled mock walking route when API key is missing', async () => {
    const service = new RoutesService({ apiKey: '', allowMockFallback: true });
    const origin = { latitude: 13.003185, longitude: 77.570258 };
    const destination = { latitude: 13.00725, longitude: 77.57189 };

    const route = await service.computeWalkingRoute(origin, destination);

    assert.ok(route.totalDistanceMeters > 0);
    assert.ok(route.totalDurationSeconds > 0);
    assert.strictEqual(route.isMockData, true);
    assert.strictEqual(route.origin.latitude, 13.003185);
    assert.strictEqual(route.destination.latitude, 13.00725);
    assert.ok(route.formattedDistance.length > 0);
    assert.ok(route.formattedDuration.length > 0);
    assert.ok(route.legs.length > 0);
  });

  it('should parse raw Google Routes API response into canonical WalkingRoute', () => {
    const service = new RoutesService({ apiKey: '' });
    const origin = { latitude: 13.003185, longitude: 77.570258 };
    const destination = { latitude: 13.00725, longitude: 77.57189 };

    const parsed = service.parseRawRoute(
      SAMPLE_RAW_ROUTE_FIXTURE,
      origin,
      destination,
      undefined,
      false
    );

    assert.strictEqual(parsed.totalDistanceMeters, 1150);
    assert.strictEqual(parsed.totalDurationSeconds, 870);
    assert.strictEqual(parsed.formattedDistance, '1.1 km');
    assert.strictEqual(parsed.formattedDuration, '15 mins');
    assert.strictEqual(parsed.isMockData, false);
    assert.strictEqual(parsed.legs.length, 2);
    assert.strictEqual(parsed.legs[0]?.steps.length, 2);
    assert.strictEqual(
      parsed.legs[0]?.steps[0]?.instruction,
      'Walk east on 7th Cross Rd toward Margosa Rd'
    );
  });

  it('should compute geodesic fallback route for arbitrary coordinates', async () => {
    const service = new RoutesService({ apiKey: '', allowMockFallback: true });
    // Basavanagudi Gandhi Bazaar to Bull Temple
    const origin = { latitude: 12.9438, longitude: 77.5694 };
    const destination = { latitude: 12.9424, longitude: 77.5681 };

    const route = await service.computeWalkingRoute(origin, destination);

    assert.ok(route.totalDistanceMeters > 0);
    assert.ok(route.totalDurationSeconds > 0);
    assert.strictEqual(route.isMockData, true);
    assert.ok(route.routeId.startsWith('fallback_route_'));
  });
});
