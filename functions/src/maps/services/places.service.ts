/**
 * Google Places API (New) Client Service
 * Developer C - Google Maps Platform Integration
 */

import { getMapsConfig, type MapsPlatformConfig } from '../config';
import type {
  GooglePlaceNewRaw,
  NormalizedPlace,
  PlaceSearchNearbyRequest,
  PlaceSearchTextRequest,
  PlacesSearchResponse,
} from '../types/places.types';
import { NormalizationService } from './normalization.service';
import { QuotaHandlerService } from './quota-handler.service';
import { SAMPLE_PLACES_FIXTURE } from '../fixtures/sample-places.fixture';

export class PlacesService {
  private config: MapsPlatformConfig;

  constructor(customConfig?: Partial<MapsPlatformConfig>) {
    this.config = { ...getMapsConfig(), ...customConfig };
  }

  /**
   * Performs text search using Google Places API (New) (POST /v1/places:searchText).
   */
  public async searchText(request: PlaceSearchTextRequest): Promise<NormalizedPlace[]> {
    const key = this.config.placesApiKey || this.config.apiKey;
    if (!key) {
      if (this.config.allowMockFallback) {
        return this.getMockPlaces(request.textQuery);
      }
      throw new Error('Google Maps API Key is not configured. Live search cannot proceed.');
    }

    const endpoint = `${this.config.placesApiBaseUrl}:searchText`;

    try {
      const response = await QuotaHandlerService.executeWithRetry(
        async () => {
          const res = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Goog-Api-Key': key,
              'X-Goog-FieldMask': this.config.fieldMasks.placesSearch,
            },
            body: JSON.stringify(request),
            signal: AbortSignal.timeout(this.config.requestTimeoutMs),
          });

          if (!res.ok) {
            const body = await res.text();
            const classified = QuotaHandlerService.classifyError(res.status, body);
            const error: any = new Error(
              `Places API error [${classified.statusCode}]: ${classified.message}`
            );
            error.status = res.status;
            error.details = classified;
            throw error;
          }

          return (await res.json()) as PlacesSearchResponse;
        },
        this.config.maxRetryAttempts,
        this.config.retryInitialDelayMs
      );

      const rawPlaces = response.places || [];
      return rawPlaces.map((raw) => NormalizationService.normalizePlace(raw, false));
    } catch (err: any) {
      if (this.config.allowMockFallback && err.status === 403) {
        // Fallback to sample data when live API lacks permission/billing
        return this.getMockPlaces(request.textQuery);
      }
      throw err;
    }
  }

  /**
   * Performs nearby search using Google Places API (New) (POST /v1/places:searchNearby).
   */
  public async searchNearby(request: PlaceSearchNearbyRequest): Promise<NormalizedPlace[]> {
    const key = this.config.placesApiKey || this.config.apiKey;
    if (!key) {
      if (this.config.allowMockFallback) {
        return this.getMockPlaces('nearby');
      }
      throw new Error('Google Maps API Key is not configured.');
    }

    const endpoint = `${this.config.placesApiBaseUrl}:searchNearby`;

    try {
      const response = await QuotaHandlerService.executeWithRetry(
        async () => {
          const res = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Goog-Api-Key': key,
              'X-Goog-FieldMask': this.config.fieldMasks.placesSearch,
            },
            body: JSON.stringify(request),
            signal: AbortSignal.timeout(this.config.requestTimeoutMs),
          });

          if (!res.ok) {
            const body = await res.text();
            const classified = QuotaHandlerService.classifyError(res.status, body);
            const error: any = new Error(
              `Places API searchNearby error [${classified.statusCode}]: ${classified.message}`
            );
            error.status = res.status;
            error.details = classified;
            throw error;
          }

          return (await res.json()) as PlacesSearchResponse;
        },
        this.config.maxRetryAttempts,
        this.config.retryInitialDelayMs
      );

      const rawPlaces = response.places || [];
      return rawPlaces.map((raw) => NormalizationService.normalizePlace(raw, false));
    } catch (err: any) {
      if (this.config.allowMockFallback && err.status === 403) {
        return this.getMockPlaces('nearby');
      }
      throw err;
    }
  }

  /**
   * Fetches detailed place information (GET /v1/places/{placeId}).
   */
  public async getPlaceDetails(placeId: string): Promise<NormalizedPlace> {
    const key = this.config.placesApiKey || this.config.apiKey;
    if (!key) {
      if (this.config.allowMockFallback) {
        const found = SAMPLE_PLACES_FIXTURE.find((p) => p.id === placeId) || SAMPLE_PLACES_FIXTURE[0]!;
        return NormalizationService.normalizePlace(found, true);
      }
      throw new Error('Google Maps API Key is not configured.');
    }

    const endpoint = `${this.config.placesApiBaseUrl}/${encodeURIComponent(placeId)}`;

    try {
      const raw = await QuotaHandlerService.executeWithRetry(
        async () => {
          const res = await fetch(endpoint, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'X-Goog-Api-Key': key,
              'X-Goog-FieldMask': this.config.fieldMasks.placeDetails,
            },
            signal: AbortSignal.timeout(this.config.requestTimeoutMs),
          });

          if (!res.ok) {
            const body = await res.text();
            const classified = QuotaHandlerService.classifyError(res.status, body);
            const error: any = new Error(
              `Places API getPlaceDetails error [${classified.statusCode}]: ${classified.message}`
            );
            error.status = res.status;
            error.details = classified;
            throw error;
          }

          return (await res.json()) as GooglePlaceNewRaw;
        },
        this.config.maxRetryAttempts,
        this.config.retryInitialDelayMs
      );

      return NormalizationService.normalizePlace(raw, false);
    } catch (err: any) {
      if (this.config.allowMockFallback && err.status === 403) {
        const found = SAMPLE_PLACES_FIXTURE.find((p) => p.id === placeId) || SAMPLE_PLACES_FIXTURE[0]!;
        return NormalizationService.normalizePlace(found, true);
      }
      throw err;
    }
  }

  /**
   * Helper returning filtered mock places clearly marked as mock data.
   */
  private getMockPlaces(query: string): NormalizedPlace[] {
    const qLower = query.toLowerCase();
    const matches = SAMPLE_PLACES_FIXTURE.filter(
      (p) =>
        p.displayName?.text.toLowerCase().includes(qLower) ||
        p.primaryType?.toLowerCase().includes(qLower) ||
        p.formattedAddress?.toLowerCase().includes(qLower)
    );

    const candidates = matches.length > 0 ? matches : SAMPLE_PLACES_FIXTURE;
    return candidates.map((p) => NormalizationService.normalizePlace(p, true));
  }
}
