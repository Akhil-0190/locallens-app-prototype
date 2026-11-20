import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import { NormalizationService } from '../services/normalization.service';
import type { GooglePlaceNewRaw } from '../types/places.types';

describe('NormalizationService', () => {
  describe('normalizeCoordinate', () => {
    it('should normalize coordinates to 6 decimal precision', () => {
      const coord = { latitude: 12.9715987654, longitude: 77.5945628912 };
      const normalized = NormalizationService.normalizeCoordinate(coord);

      assert.strictEqual(normalized.latitude, 12.971599);
      assert.strictEqual(normalized.longitude, 77.594563);
      assert.strictEqual(normalized.precision, 6);
      assert.strictEqual(normalized.isValid, true);
      assert.strictEqual(normalized.formatted, '12.971599, 77.594563');
    });

    it('should invalidate coordinates with latitude outside [-90, 90]', () => {
      const coord = { latitude: 95.123, longitude: 77.594 };
      const normalized = NormalizationService.normalizeCoordinate(coord);

      assert.strictEqual(normalized.isValid, false);
      assert.strictEqual(normalized.latitude, 0);
      assert.strictEqual(normalized.longitude, 0);
    });

    it('should invalidate coordinates with longitude outside [-180, 180]', () => {
      const coord = { latitude: 12.971, longitude: 185.234 };
      const normalized = NormalizationService.normalizeCoordinate(coord);

      assert.strictEqual(normalized.isValid, false);
    });

    it('should invalidate NaN coordinates', () => {
      const coord = { latitude: NaN, longitude: 77.594 };
      const normalized = NormalizationService.normalizeCoordinate(coord);

      assert.strictEqual(normalized.isValid, false);
    });
  });

  describe('calculateDistance', () => {
    it('should accurately calculate distance between CTR and Kadu Malleshwara Temple', () => {
      const ctr = { latitude: 13.003185, longitude: 77.570258 };
      const temple = { latitude: 13.00725, longitude: 77.57189 };

      const result = NormalizationService.calculateDistance(ctr, temple);

      // Distance should be ~480-500 meters straight line
      assert.ok(result.meters > 400 && result.meters < 600);
      assert.strictEqual(result.kilometers, Number((result.meters / 1000).toFixed(2)));
      assert.ok(result.formattedMeters.includes('m'));
    });

    it('should return 0 meters for identical coordinates', () => {
      const point = { latitude: 12.9716, longitude: 77.5946 };
      const result = NormalizationService.calculateDistance(point, point);

      assert.strictEqual(result.meters, 0);
      assert.strictEqual(result.kilometers, 0);
    });
  });

  describe('parseDurationSeconds & formatDuration', () => {
    it('should parse standard Google duration string with "s" suffix', () => {
      assert.strictEqual(NormalizationService.parseDurationSeconds('540s'), 540);
      assert.strictEqual(NormalizationService.parseDurationSeconds('120.5s'), 120);
      assert.strictEqual(NormalizationService.parseDurationSeconds('0s'), 0);
    });

    it('should handle missing or malformed duration string', () => {
      assert.strictEqual(NormalizationService.parseDurationSeconds(undefined), 0);
      assert.strictEqual(NormalizationService.parseDurationSeconds('invalid'), 0);
    });

    it('should format seconds into human-readable strings', () => {
      assert.strictEqual(NormalizationService.formatDuration(540), '9 mins');
      assert.strictEqual(NormalizationService.formatDuration(60), '1 min');
      assert.strictEqual(NormalizationService.formatDuration(3600), '1 hr');
      assert.strictEqual(NormalizationService.formatDuration(4500), '1 hr 15 mins');
      assert.strictEqual(NormalizationService.formatDuration(0), '0 mins');
    });
  });

  describe('normalizePlace', () => {
    it('should convert raw Google Place object into canonical NormalizedPlace', () => {
      const raw: GooglePlaceNewRaw = {
        id: 'place_ctr_001',
        displayName: { text: 'CTR Shri Sagar', languageCode: 'en' },
        formattedAddress: '7th Cross Rd, Malleshwaram, Bengaluru',
        location: { latitude: 13.003185, longitude: 77.570258 },
        primaryType: 'south_indian_restaurant',
        types: ['restaurant', 'food'],
        rating: 4.6,
        userRatingCount: 32000,
        currentOpeningHours: { openNow: true, weekdayDescriptions: ['Open today'] },
        editorialSummary: { text: 'Famous heritage dosa spot', languageCode: 'en' },
      };

      const normalized = NormalizationService.normalizePlace(raw, false);

      assert.strictEqual(normalized.placeId, 'place_ctr_001');
      assert.strictEqual(normalized.name, 'CTR Shri Sagar');
      assert.strictEqual(normalized.primaryCategory, 'south_indian_restaurant');
      assert.strictEqual(normalized.rating, 4.6);
      assert.strictEqual(normalized.reviewCount, 32000);
      assert.strictEqual(normalized.isOpenNow, true);
      assert.strictEqual(normalized.isMockData, false);
      assert.strictEqual(normalized.coordinate.latitude, 13.003185);
      assert.strictEqual(normalized.coordinate.longitude, 77.570258);
      assert.strictEqual(normalized.coordinate.isValid, true);
    });
  });
});
