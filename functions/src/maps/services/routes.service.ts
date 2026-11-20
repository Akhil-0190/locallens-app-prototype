/**
 * Google Routes API Client Service
 * Developer C - Google Maps Platform Integration
 */

import { getMapsConfig, type MapsPlatformConfig } from '../config.ts';
import type { LatLng } from '../types/coordinates.types.ts';
import type {
  ComputeRoutesRequest,
  ComputeRoutesResponse,
  GoogleRouteRaw,
  WalkingRoute,
} from '../types/routes.types.ts';
import { NormalizationService } from './normalization.service.ts';
import { QuotaHandlerService } from './quota-handler.service.ts';
import { SAMPLE_NORMALIZED_WALKING_ROUTE } from '../fixtures/sample-routes.fixture.ts';

export class RoutesService {
  private config: MapsPlatformConfig;

  constructor(customConfig?: Partial<MapsPlatformConfig>) {
    this.config = { ...getMapsConfig(), ...customConfig };
  }

  /**
   * Computes a walking route between origin, destination, and optional intermediate stops.
   */
  public async computeWalkingRoute(
    origin: LatLng,
    destination: LatLng,
    intermediates?: LatLng[],
    optimizeWaypoints: boolean = false
  ): Promise<WalkingRoute> {
    if (!this.config.apiKey) {
      if (this.config.allowMockFallback) {
        return this.createFallbackRoute(origin, destination, intermediates);
      }
      throw new Error('Google Maps API Key is not configured for Routes API.');
    }

    const payload: ComputeRoutesRequest = {
      origin: {
        location: {
          latLng: {
            latitude: origin.latitude,
            longitude: origin.longitude,
          },
        },
      },
      destination: {
        location: {
          latLng: {
            latitude: destination.latitude,
            longitude: destination.longitude,
          },
        },
      },
      intermediates: intermediates?.map((pt) => ({
        location: {
          latLng: {
            latitude: pt.latitude,
            longitude: pt.longitude,
          },
        },
      })),
      travelMode: 'WALK',
      optimizeWaypointOrder: optimizeWaypoints,
      units: 'METRIC',
      polylineQuality: 'HIGH_QUALITY',
      polylineEncoding: 'ENCODED_POLYLINE',
    };

    try {
      const response = await QuotaHandlerService.executeWithRetry(
        async () => {
          const res = await fetch(this.config.routesApiBaseUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Goog-Api-Key': this.config.apiKey,
              'X-Goog-FieldMask': this.config.fieldMasks.routesCompute,
            },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(this.config.requestTimeoutMs),
          });

          if (!res.ok) {
            const body = await res.text();
            const classified = QuotaHandlerService.classifyError(res.status, body);
            const error: any = new Error(
              `Routes API error [${classified.statusCode}]: ${classified.message}`
            );
            error.status = res.status;
            error.details = classified;
            throw error;
          }

          return (await res.json()) as ComputeRoutesResponse;
        },
        this.config.maxRetryAttempts,
        this.config.retryInitialDelayMs
      );

      const routeRaw = response.routes?.[0];
      if (!routeRaw) {
        throw new Error('No route returned by Google Routes API.');
      }

      return this.parseRawRoute(routeRaw, origin, destination, intermediates, false);
    } catch (err: any) {
      if (this.config.allowMockFallback && err.status === 403) {
        return this.createFallbackRoute(origin, destination, intermediates);
      }
      throw err;
    }
  }

  /**
   * Normalizes raw Google Route response into canonical WalkingRoute model.
   */
  public parseRawRoute(
    raw: GoogleRouteRaw,
    origin: LatLng,
    destination: LatLng,
    intermediates?: LatLng[],
    isMock: boolean = false
  ): WalkingRoute {
    const totalDistanceMeters = raw.distanceMeters || 0;
    const totalDurationSeconds = NormalizationService.parseDurationSeconds(raw.duration);

    const legs = (raw.legs || []).map((leg) => {
      const legDist = leg.distanceMeters || 0;
      const legDur = NormalizationService.parseDurationSeconds(leg.duration);
      const startCoord = leg.startLocation?.latLng
        ? NormalizationService.normalizeCoordinate(leg.startLocation.latLng)
        : NormalizationService.normalizeCoordinate(origin);
      const endCoord = leg.endLocation?.latLng
        ? NormalizationService.normalizeCoordinate(leg.endLocation.latLng)
        : NormalizationService.normalizeCoordinate(destination);

      const steps = (leg.steps || []).map((step) => ({
        instruction: step.navigationInstruction?.instructions || 'Walk along path',
        distanceMeters: step.distanceMeters || 0,
        durationSeconds: NormalizationService.parseDurationSeconds(step.staticDuration),
      }));

      return {
        distanceMeters: legDist,
        durationSeconds: legDur,
        startCoordinate: startCoord,
        endCoordinate: endCoord,
        steps,
      };
    });

    const normOrigin = NormalizationService.normalizeCoordinate(origin);
    const normDest = NormalizationService.normalizeCoordinate(destination);
    const normWaypoints = (intermediates || []).map((w) =>
      NormalizationService.normalizeCoordinate(w)
    );

    const formattedDist =
      totalDistanceMeters < 1000
        ? `${totalDistanceMeters} m`
        : `${(totalDistanceMeters / 1000).toFixed(1)} km`;

    const formattedDur = NormalizationService.formatDuration(totalDurationSeconds);

    return {
      routeId: `route_${Date.now()}`,
      origin: normOrigin,
      destination: normDest,
      waypoints: normWaypoints,
      optimizedWaypointOrder: raw.optimizedIntermediateWaypointIndex,
      totalDistanceMeters,
      totalDurationSeconds,
      formattedDistance: formattedDist,
      formattedDuration: formattedDur,
      encodedPolyline: raw.polyline?.encodedPolyline || '',
      legs,
      isMockData: isMock,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Generates geodesic distance & estimated walking time fallback when live API is unavailable.
   */
  private createFallbackRoute(
    origin: LatLng,
    destination: LatLng,
    intermediates?: LatLng[]
  ): WalkingRoute {
    // If standard Malleshwaram coordinates, return pre-calculated sample
    const isMalleshwaramSample =
      Math.abs(origin.latitude - 13.003185) < 0.01 &&
      Math.abs(origin.longitude - 77.570258) < 0.01;

    if (isMalleshwaramSample && !intermediates) {
      return SAMPLE_NORMALIZED_WALKING_ROUTE;
    }

    // Dynamic geodesic estimate (average walking speed = 4.5 km/h = 1.25 m/s)
    let totalDist = 0;
    let prev = origin;
    const allPoints = [...(intermediates || []), destination];

    for (const pt of allPoints) {
      const seg = NormalizationService.calculateDistance(prev, pt);
      // Street walking distance is typically ~1.3x geodesic straight-line distance in cities
      totalDist += Math.round(seg.meters * 1.3);
      prev = pt;
    }

    const totalSeconds = Math.round(totalDist / 1.25);

    return {
      routeId: `fallback_route_${Date.now()}`,
      origin: NormalizationService.normalizeCoordinate(origin),
      destination: NormalizationService.normalizeCoordinate(destination),
      waypoints: (intermediates || []).map((w) => NormalizationService.normalizeCoordinate(w)),
      totalDistanceMeters: totalDist,
      totalDurationSeconds: totalSeconds,
      formattedDistance:
        totalDist < 1000 ? `${totalDist} m` : `${(totalDist / 1000).toFixed(1)} km`,
      formattedDuration: NormalizationService.formatDuration(totalSeconds),
      encodedPolyline: '_{~jA}w_sMrAiB`@q@nAoBvB}CxAgBh@_@dAs@nBy@',
      legs: [
        {
          distanceMeters: totalDist,
          durationSeconds: totalSeconds,
          startCoordinate: NormalizationService.normalizeCoordinate(origin),
          endCoordinate: NormalizationService.normalizeCoordinate(destination),
          steps: [
            {
              instruction: 'Follow street route toward destination',
              distanceMeters: totalDist,
              durationSeconds: totalSeconds,
            },
          ],
        },
      ],
      isMockData: true,
      generatedAt: new Date().toISOString(),
    };
  }
}
