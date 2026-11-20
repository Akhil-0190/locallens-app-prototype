/**
 * Google Routes API Types & Route Engine Schemas
 * Developer C - Task C1 & C3
 */

import type { LatLng, NormalizedCoordinate } from './coordinates.types';

export type RouteTravelMode = 'WALK' | 'DRIVE' | 'BICYCLE' | 'TWO_WHEELER';

export type WalkingPace = 'RELAXED' | 'NORMAL' | 'BRISK';

export interface RouteWaypointLocation {
  location?: {
    latLng?: LatLng;
  };
  placeId?: string;
  address?: string;
  vehicleStopover?: boolean;
  sideOfRoad?: boolean;
}

export interface ComputeRoutesRequest {
  origin: RouteWaypointLocation;
  destination: RouteWaypointLocation;
  intermediates?: RouteWaypointLocation[];
  travelMode: RouteTravelMode;
  optimizeWaypointOrder?: boolean;
  languageCode?: string;
  units?: 'METRIC' | 'IMPERIAL';
  polylineQuality?: 'HIGH_QUALITY' | 'OVERVIEW';
  polylineEncoding?: 'ENCODED_POLYLINE' | 'GEO_JSON_LINESTRING';
}

export interface EncodedPolyline {
  encodedPolyline: string;
}

export interface RouteLocalizedValues {
  distance?: { text: string };
  duration?: { text: string };
  staticDuration?: { text: string };
}

export interface RouteStep {
  distanceMeters?: number;
  staticDuration?: string; // e.g. "120s"
  polyline?: EncodedPolyline;
  startLocation?: { latLng?: LatLng };
  endLocation?: { latLng?: LatLng };
  navigationInstruction?: {
    maneuver?: string;
    instructions?: string;
  };
  localizedValues?: RouteLocalizedValues;
}

export interface RouteLegRaw {
  distanceMeters?: number;
  duration?: string; // e.g. "540s"
  staticDuration?: string;
  polyline?: EncodedPolyline;
  startLocation?: { latLng?: LatLng };
  endLocation?: { latLng?: LatLng };
  steps?: RouteStep[];
  localizedValues?: RouteLocalizedValues;
}

export interface GoogleRouteRaw {
  legs?: RouteLegRaw[];
  distanceMeters?: number;
  duration?: string; // Duration format like "1450s"
  staticDuration?: string;
  polyline?: EncodedPolyline;
  description?: string;
  warnings?: string[];
  viewport?: {
    low: LatLng;
    high: LatLng;
  };
  localizedValues?: RouteLocalizedValues;
  optimizedIntermediateWaypointIndex?: number[];
}

export interface ComputeRoutesResponse {
  routes?: GoogleRouteRaw[];
  fallbackInfo?: {
    routingMode: string;
    reason: string;
  };
}

/**
 * Stop input specification for personalized route generation
 */
export interface RouteStopInput {
  placeId?: string;
  spotName?: string;
  coordinate: LatLng;
}

/**
 * High-level request payload for walking route generation
 */
export interface GenerateWalkingRouteRequest {
  title?: string;
  neighborhood?: string;
  theme?: string;
  stops: RouteStopInput[];
  optimizeStopOrder?: boolean;
  walkingPace?: WalkingPace;
  allowMockFallback?: boolean;
}

export type RouteErrorCode =
  | 'INSUFFICIENT_STOPS'
  | 'INVALID_COORDINATES'
  | 'NO_ROUTE_FOUND'
  | 'PERMISSION_DENIED'
  | 'QUOTA_EXHAUSTED'
  | 'NETWORK_ERROR'
  | 'INVALID_RESPONSE';

export class RouteGenerationError extends Error {
  public code: RouteErrorCode;
  public status: number;
  public details?: unknown;

  constructor(code: RouteErrorCode, message: string, status: number = 400, details?: unknown) {
    super(`[${code}] ${message}`);
    this.name = 'RouteGenerationError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

/**
 * Preliminary walking route model retained for backwards compatibility
 */
export interface WalkingRoute {
  routeId: string;
  origin: NormalizedCoordinate;
  destination: NormalizedCoordinate;
  waypoints: NormalizedCoordinate[];
  optimizedWaypointOrder?: number[];
  totalDistanceMeters: number;
  totalDurationSeconds: number;
  formattedDistance: string;
  formattedDuration: string;
  encodedPolyline: string;
  legs: {
    distanceMeters: number;
    durationSeconds: number;
    startCoordinate: NormalizedCoordinate;
    endCoordinate: NormalizedCoordinate;
    steps: {
      instruction: string;
      distanceMeters: number;
      durationSeconds: number;
    }[];
  }[];
  isMockData: boolean;
  generatedAt: string;
}
