/**
 * Maps, Places & Routing Controller — Firebase Callable Cloud Functions
 * Developer C — Google Maps Platform & Routing Integration
 *
 * Exports callable functions for Flutter client consumption:
 *   - computeWalkingRoute          — Compute multi-stop walking route via Google Routes API
 *   - computeCapacityAwareRoute    — Generate capacity-aware route with venue throttling & alternatives
 *   - computePlanBReroute          — One-tap dynamic rerouting responding to closures or weather
 *   - evaluateVenueCapacity        — Query hourly crowd capacity and alternatives for a venue
 *   - groundContributedPlace       — Ground local contribution against Places API New with discrepancy detection
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { randomUUID } from 'node:crypto';
import { geminiApiKey, mapsApiKey } from '../config/secrets.js';
import type { ApiSuccessResponse } from '../types/contracts/index.js';
import { RoutesService } from './services/routes.service.js';
import { CrowdManagementService } from './services/crowd-management.service.js';
import { PlanBReroutingService } from './services/plan-b.service.js';
import { GroundingService } from './services/grounding.service.js';
import type { GenerateWalkingRouteRequest } from './types/routes.types.js';
import type { CapacityAwareRouteRequest, ReportVenueCrowdRequest } from './types/crowd.types.js';
import type { PlanBRerouteRequest } from './types/weather.types.js';
import type { ContributedPlaceInput } from './types/evidence.types.js';

const routesService = new RoutesService();
const groundingService = new GroundingService();

function requestId(): string {
  return randomUUID().replace(/-/g, '').slice(0, 12);
}

function successEnvelope<T>(data: T, startMs: number): ApiSuccessResponse {
  return {
    success: true,
    data: data as Record<string, unknown>,
    metadata: {
      requestId: requestId(),
      timestamp: new Date().toISOString(),
      executionDurationMs: Date.now() - startMs,
      version: 'C6-FINAL',
    },
  };
}

const mapsCallableOptions = {
  secrets: [mapsApiKey, geminiApiKey],
  memory: '512MiB' as const,
};

/**
 * Callable: computeWalkingRoute
 * Computes a personalized walking route using Google Routes API conforming to CanonicalRouteDocument.
 */
export const computeWalkingRoute = onCall(mapsCallableOptions, async (request) => {
  const startMs = Date.now();
  const isGuest = (request.data as any)?.isGuestAccess === true;
  const callerUid = request.auth?.uid || (isGuest ? ((request.data as any)?.userId || 'guest_traveler') : undefined);
  if (!callerUid) {
    throw new HttpsError('unauthenticated', 'User must be authenticated to compute routes.');
  }

  const payload = request.data as GenerateWalkingRouteRequest;
  if (!payload || !payload.stops || !Array.isArray(payload.stops) || payload.stops.length < 2) {
    throw new HttpsError('invalid-argument', 'At least 2 valid stops are required to compute a walking route.');
  }

  try {
    const route = await routesService.generateWalkingRoute(payload);
    return successEnvelope(route, startMs);
  } catch (err: any) {
    if (err.statusCode === 400 || err.code === 'INVALID_COORDINATES' || err.code === 'INSUFFICIENT_STOPS') {
      throw new HttpsError('invalid-argument', err.message);
    }
    if (err.statusCode === 403 || err.code === 'PERMISSION_DENIED') {
      throw new HttpsError('permission-denied', err.message);
    }
    if (err.statusCode === 404 || err.code === 'NO_ROUTE_FOUND') {
      throw new HttpsError('not-found', err.message);
    }
    throw new HttpsError('internal', err.message || 'Route computation failed.');
  }
});

/**
 * Callable: computeCapacityAwareRoute
 * Generates walking route considering hourly venue capacity, crowd throttling and automatic substitution.
 */
export const computeCapacityAwareRoute = onCall(mapsCallableOptions, async (request) => {
  const startMs = Date.now();
  const isGuest = (request.data as any)?.isGuestAccess === true;
  const callerUid = request.auth?.uid || (isGuest ? ((request.data as any)?.userId || 'guest_traveler') : undefined);
  if (!callerUid) {
    throw new HttpsError('unauthenticated', 'User must be authenticated.');
  }

  const payload = request.data as CapacityAwareRouteRequest;
  if (!payload || !payload.stops || !Array.isArray(payload.stops) || payload.stops.length < 2) {
    throw new HttpsError('invalid-argument', 'At least 2 stops are required for capacity-aware route generation.');
  }

  try {
    const routeResponse = await CrowdManagementService.generateCapacityAwareRoute(payload);
    return successEnvelope(routeResponse, startMs);
  } catch (err: any) {
    throw new HttpsError('internal', err.message || 'Capacity-aware route generation failed.');
  }
});

/**
 * Callable: computePlanBReroute
 * One-tap dynamic rerouting responding to unexpected closures, weather disruptions, or crowd limits.
 */
export const computePlanBReroute = onCall(mapsCallableOptions, async (request) => {
  const startMs = Date.now();
  const isGuest = (request.data as any)?.isGuestAccess === true;
  const callerUid = request.auth?.uid || (isGuest ? ((request.data as any)?.userId || 'guest_traveler') : undefined);
  if (!callerUid) {
    throw new HttpsError('unauthenticated', 'User must be authenticated.');
  }

  const payload = request.data as PlanBRerouteRequest;
  if (!payload || !payload.originalRoute || !payload.disruptions || !Array.isArray(payload.disruptions)) {
    throw new HttpsError('invalid-argument', 'originalRoute and disruptions array are required for Plan-B rerouting.');
  }

  try {
    const planBResult = await PlanBReroutingService.reroutePlanB(payload);
    return successEnvelope(planBResult, startMs);
  } catch (err: any) {
    throw new HttpsError('internal', err.message || 'Plan-B rerouting calculation failed.');
  }
});

/**
 * Callable: evaluateVenueCapacity
 * Queries real-time hourly capacity and crowd status for a venue and intended visit time.
 */
export const evaluateVenueCapacity = onCall(mapsCallableOptions, async (request) => {
  const startMs = Date.now();
  const isGuest = (request.data as any)?.isGuestAccess === true;
  const callerUid = request.auth?.uid || (isGuest ? ((request.data as any)?.userId || 'guest_traveler') : undefined);
  if (!callerUid) {
    throw new HttpsError('unauthenticated', 'User must be authenticated.');
  }

  const { placeId, placeName, intendedVisitTime, partySize, allowMockFallback } =
    (request.data as Record<string, unknown>) || {};

  if (!placeId || typeof placeId !== 'string' || !intendedVisitTime || typeof intendedVisitTime !== 'string') {
    throw new HttpsError('invalid-argument', 'placeId and intendedVisitTime are required.');
  }

  try {
    const evaluation = await CrowdManagementService.evaluateVenueCapacity({
      placeId,
      placeName: typeof placeName === 'string' ? placeName : undefined,
      intendedVisitTime,
      partySize: typeof partySize === 'number' ? partySize : 1,
      allowMockFallback: allowMockFallback === true,
    });
    return successEnvelope(evaluation, startMs);
  } catch (err: any) {
    throw new HttpsError('internal', err.message || 'Venue capacity evaluation failed.');
  }
});

/**
 * Callable: groundContributedPlace
 * Grounds local contributor place submission against Google Places API (New) with discrepancy detection.
 */
export const groundContributedPlace = onCall(mapsCallableOptions, async (request) => {
  const startMs = Date.now();
  const isGuest = (request.data as any)?.isGuestAccess === true;
  const callerUid = request.auth?.uid || (isGuest ? ((request.data as any)?.userId || 'guest_traveler') : undefined);
  if (!callerUid) {
    throw new HttpsError('unauthenticated', 'User must be authenticated.');
  }

  const payload = request.data as ContributedPlaceInput;
  if (!payload || !payload.spotName || typeof payload.spotName !== 'string') {
    throw new HttpsError('invalid-argument', 'spotName is required.');
  }

  try {
    const groundedResult = await groundingService.groundContributedPlace(payload);
    return successEnvelope(groundedResult, startMs);
  } catch (err: any) {
    throw new HttpsError('internal', err.message || 'Place grounding failed.');
  }
});

/**
 * Callable: reportVenueCrowd
 * Submits a 1-tap real-time community crowd signal from an authenticated traveler or local resident.
 * Synthesizes signal with capacity records and returns updated crowd intelligence.
 */
export const reportVenueCrowd = onCall(mapsCallableOptions, async (request) => {
  const startMs = Date.now();
  const isGuest = (request.data as any)?.isGuestAccess === true;
  const callerUid = request.auth?.uid || (isGuest ? ((request.data as any)?.userId || 'guest_traveler') : undefined);
  if (!callerUid) {
    throw new HttpsError('unauthenticated', 'User must be authenticated to report crowd signals.');
  }

  const payload = request.data as ReportVenueCrowdRequest;
  if (!payload || !payload.placeId || !payload.crowdLevel) {
    throw new HttpsError('invalid-argument', 'placeId and crowdLevel are required.');
  }

  const validLevels = ['LOW', 'MODERATE', 'HIGH', 'AT_CAPACITY'];
  if (!validLevels.includes(payload.crowdLevel)) {
    throw new HttpsError('invalid-argument', `Invalid crowdLevel. Expected one of: ${validLevels.join(', ')}`);
  }

  try {
    const reportResult = await CrowdManagementService.submitCommunityCrowdSignal({
      ...payload,
      travelerId: callerUid,
    });
    return successEnvelope(reportResult, startMs);
  } catch (err: any) {
    throw new HttpsError('internal', err.message || 'Submitting crowd signal failed.');
  }
});
