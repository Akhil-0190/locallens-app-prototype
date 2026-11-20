import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import { MapsUrlParserService } from '../services/url-parser.service';

describe('MapsUrlParserService', () => {
  it('should parse Place ID from query_place_id parameter', () => {
    const url = 'https://www.google.com/maps/search/?api=1&query=CTR&query_place_id=ChIJ82NqvCUWrjsRC33A4yTYQWk';
    const parsed = MapsUrlParserService.parse(url);

    assert.strictEqual(parsed.placeId, 'ChIJ82NqvCUWrjsRC33A4yTYQWk');
    assert.strictEqual(parsed.isValidMapsUrl, true);
    assert.strictEqual(parsed.isShortLink, false);
  });

  it('should parse CID from CID parameter', () => {
    const url = 'https://maps.google.com/?cid=123456789012345';
    const parsed = MapsUrlParserService.parse(url);

    assert.strictEqual(parsed.cid, '123456789012345');
    assert.strictEqual(parsed.isValidMapsUrl, true);
  });

  it('should extract coordinates from standard /@lat,lng URL path', () => {
    const url = 'https://www.google.com/maps/place/Central+Tiffin+Room/@12.998233,77.569539,17z/data=!3m1!4b1';
    const parsed = MapsUrlParserService.parse(url);

    assert.ok(parsed.coordinates);
    assert.strictEqual(parsed.coordinates.latitude, 12.998233);
    assert.strictEqual(parsed.coordinates.longitude, 77.569539);
    assert.strictEqual(parsed.query, 'Central Tiffin Room');
  });

  it('should extract coordinates from query parameters', () => {
    const url = 'https://www.google.com/maps/search/?api=1&query=13.003185,77.570258';
    const parsed = MapsUrlParserService.parse(url);

    assert.ok(parsed.coordinates);
    assert.strictEqual(parsed.coordinates.latitude, 13.003185);
    assert.strictEqual(parsed.coordinates.longitude, 77.570258);
  });

  it('should detect Google Maps short links (maps.app.goo.gl)', () => {
    const url = 'https://maps.app.goo.gl/wJk8z9Qwerty12345';
    const parsed = MapsUrlParserService.parse(url);

    assert.strictEqual(parsed.isShortLink, true);
    assert.strictEqual(parsed.isValidMapsUrl, true);
  });

  it('should handle empty or malformed strings gracefully', () => {
    const parsed = MapsUrlParserService.parse('');
    assert.strictEqual(parsed.isValidMapsUrl, false);
    assert.strictEqual(parsed.isShortLink, false);
  });
});
