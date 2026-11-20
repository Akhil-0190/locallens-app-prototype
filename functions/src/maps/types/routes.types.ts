/**
 * Google Routes API Types & Route Engine Schemas
 * Developer C - Google Maps Platform Integration
 */

import type { LatLng, NormalizedCoordinate } from './coordinates.types';

export type RouteTravelMode = 'WALK' | 'DRIVE' | 'BICYCLE' | 'TWO_WHEELER';

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

export interface RouteLeg {
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
  legs?: RouteLeg[];
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
 * Canonical Walking Route Model for LocalLens itinerary and co-pilot
 */
export interface WalkingRoute {
  routeId: string;
  origin: NormalizedCoordinate;
  destination: NormalizedCoordinate;
  waypoints: NormalizedCoordinate[];
  optimizedWaypointOrder?: number[];
  totalDistanceMeters: number;
  totalDurationSeconds: number;
  formattedDistance: string; // e.g. "1.2 km"
  formattedDuration: string; // e.g. "16 mins"
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
  generatedAt: string; // ISO 8601
}
