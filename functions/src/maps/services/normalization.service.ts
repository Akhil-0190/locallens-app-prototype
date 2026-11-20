/**
 * Coordinate and Place Normalization Service
 * Developer C - Google Maps Platform Integration
 */

import type {
  LatLng,
  NormalizedCoordinate,
  DistanceResult,
} from '../types/coordinates.types.ts';
import type { GooglePlaceNewRaw, NormalizedPlace } from '../types/places.types.ts';

export class NormalizationService {
  /**
   * Normalizes a latitude/longitude coordinate to standard 6-decimal precision (~11 cm).
   */
  public static normalizeCoordinate(coord: LatLng): NormalizedCoordinate {
    const lat = Number(coord.latitude);
    const lng = Number(coord.longitude);

    const isValid =
      !isNaN(lat) &&
      !isNaN(lng) &&
      lat >= -90 &&
      lat <= 90 &&
      lng >= -180 &&
      lng <= 180;

    const roundedLat = isValid ? Number(lat.toFixed(6)) : 0;
    const roundedLng = isValid ? Number(lng.toFixed(6)) : 0;

    return {
      latitude: roundedLat,
      longitude: roundedLng,
      precision: 6,
      formatted: `${roundedLat}, ${roundedLng}`,
      isValid,
    };
  }

  /**
   * Calculates geodesic distance between two points using the Haversine formula.
   */
  public static calculateDistance(from: LatLng, to: LatLng): DistanceResult {
    const R = 6371000; // Earth radius in meters
    const toRad = (deg: number) => (deg * Math.PI) / 180;

    const dLat = toRad(to.latitude - from.latitude);
    const dLon = toRad(to.longitude - from.longitude);

    const lat1 = toRad(from.latitude);
    const lat2 = toRad(to.latitude);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const meters = Math.round(R * c);
    const kilometers = Number((meters / 1000).toFixed(2));
    const miles = Number((meters / 1609.344).toFixed(2));

    const formattedMeters =
      meters < 1000 ? `${meters} m` : `${(meters / 1000).toFixed(1)} km`;

    return { meters, kilometers, miles, formattedMeters };
  }

  /**
   * Parses duration string from Routes API (e.g. "540s") into integer seconds.
   */
  public static parseDurationSeconds(durationStr?: string): number {
    if (!durationStr) return 0;
    const match = durationStr.match(/^(\d+)(?:\.\d+)?s$/);
    if (match && match[1]) {
      return parseInt(match[1], 10);
    }
    const rawNum = parseInt(durationStr, 10);
    return isNaN(rawNum) ? 0 : rawNum;
  }

  /**
   * Formats seconds into human-readable duration (e.g. "9 mins", "1 hr 15 mins").
   */
  public static formatDuration(seconds: number): string {
    if (seconds <= 0) return '0 mins';
    const mins = Math.round(seconds / 60);
    if (mins < 60) {
      return `${mins} min${mins === 1 ? '' : 's'}`;
    }
    const hours = Math.floor(mins / 60);
    const remMins = mins % 60;
    return remMins > 0
      ? `${hours} hr ${remMins} min${remMins === 1 ? '' : 's'}`
      : `${hours} hr${hours === 1 ? '' : 's'}`;
  }

  /**
   * Normalizes raw Google Places API (New) object into canonical NormalizedPlace.
   */
  public static normalizePlace(
    raw: GooglePlaceNewRaw,
    isMock: boolean = false
  ): NormalizedPlace {
    const coord = raw.location
      ? this.normalizeCoordinate(raw.location)
      : {
          latitude: 0,
          longitude: 0,
          precision: 6,
          formatted: '0, 0',
          isValid: false,
        };

    const name = raw.displayName?.text || raw.name || 'Unnamed Spot';
    const formattedAddress = raw.formattedAddress || 'Address unavailable';
    const primaryCategory = raw.primaryType || (raw.types && raw.types[0]) || 'point_of_interest';
    const categories = raw.types || (primaryCategory ? [primaryCategory] : []);
    const rating = typeof raw.rating === 'number' ? raw.rating : 0;
    const reviewCount = typeof raw.userRatingCount === 'number' ? raw.userRatingCount : 0;

    let isOpenNow: boolean | null = null;
    if (raw.currentOpeningHours && typeof raw.currentOpeningHours.openNow === 'boolean') {
      isOpenNow = raw.currentOpeningHours.openNow;
    } else if (raw.regularOpeningHours && typeof raw.regularOpeningHours.openNow === 'boolean') {
      isOpenNow = raw.regularOpeningHours.openNow;
    }

    const openingHoursDescriptions =
      raw.currentOpeningHours?.weekdayDescriptions ||
      raw.regularOpeningHours?.weekdayDescriptions ||
      [];

    const summary = raw.editorialSummary?.text || '';
    const mapsUrl = raw.googleMapsUri || `https://maps.google.com/?q=${encodeURIComponent(name)}`;

    return {
      placeId: raw.id,
      name,
      formattedAddress,
      coordinate: coord,
      primaryCategory,
      categories,
      rating,
      reviewCount,
      isOpenNow,
      openingHoursDescriptions,
      summary,
      mapsUrl,
      isMockData: isMock,
      lastVerifiedAt: new Date().toISOString(),
    };
  }
}
