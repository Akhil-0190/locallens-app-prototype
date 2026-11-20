/**
 * Coordinate and Spatial Data Types
 * Developer C - Google Maps Platform Integration
 */

export interface LatLng {
  latitude: number;
  longitude: number;
}

export interface NormalizedCoordinate {
  latitude: number;
  longitude: number;
  precision: number;
  formatted: string; // e.g. "12.971599, 77.594563"
  geohash?: string;
  isValid: boolean;
}

export interface GeoBoundingBox {
  southwest: LatLng;
  northeast: LatLng;
}

export interface DistanceResult {
  meters: number;
  kilometers: number;
  miles: number;
  formattedMeters: string;
}

export interface SpatialCluster {
  center: LatLng;
  radiusMeters: number;
  pointCount: number;
  points: LatLng[];
}
