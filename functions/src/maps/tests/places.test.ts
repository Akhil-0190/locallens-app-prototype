import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import { PlacesService } from '../services/places.service';
import { SAMPLE_PLACES_FIXTURE } from '../fixtures/sample-places.fixture';

describe('PlacesService', () => {
  it('should fall back gracefully to labeled mock places when API key is missing', async () => {
    const service = new PlacesService({ apiKey: '', allowMockFallback: true });
    const results = await service.searchText({ textQuery: 'CTR Dosa' });

    assert.ok(results.length > 0);
    assert.strictEqual(results[0]?.name, 'CTR Shri Sagar (Malleshwaram)');
    assert.strictEqual(results[0]?.isMockData, true);
    assert.strictEqual(results[0]?.coordinate.isValid, true);
  });

  it('should throw an error when API key is missing and mock fallback is disabled', async () => {
    const service = new PlacesService({ apiKey: '', allowMockFallback: false });

    await assert.rejects(async () => {
      await service.searchText({ textQuery: 'CTR Dosa' });
    }, /Google Maps API Key is not configured/);
  });

  it('should fetch place details from fallback fixture with isMockData=true', async () => {
    const service = new PlacesService({ apiKey: '', allowMockFallback: true });
    const sampleId = SAMPLE_PLACES_FIXTURE[1]!.id;

    const details = await service.getPlaceDetails(sampleId);

    assert.strictEqual(details.placeId, sampleId);
    assert.strictEqual(details.name, 'Malleshwaram 8th Cross Flower Market');
    assert.strictEqual(details.isMockData, true);
  });

  it('should correctly handle searchNearby fallback', async () => {
    const service = new PlacesService({ apiKey: '', allowMockFallback: true });
    const results = await service.searchNearby({
      locationRestriction: {
        circle: {
          center: { latitude: 13.003185, longitude: 77.570258 },
          radius: 1000,
        },
      },
    });

    assert.ok(results.length > 0);
    assert.strictEqual(results[0]?.isMockData, true);
  });
});
