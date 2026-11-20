/**
 * Google Maps Platform Configuration
 * Developer C - Google Maps Platform Integration
 * 
 * NOTE: API keys must be supplied via environment variables or Secret Manager.
 * Never commit keys or hardcode them in client apps.
 */

export interface MapsPlatformConfig {
  apiKey: string;
  placesApiBaseUrl: string;
  routesApiBaseUrl: string;
  requestTimeoutMs: number;
  maxRetryAttempts: number;
  retryInitialDelayMs: number;
  allowMockFallback: boolean;
  fieldMasks: {
    placesSearch: string;
    placeDetails: string;
    routesCompute: string;
  };
}

export function getMapsConfig(): MapsPlatformConfig {
  const apiKey =
    process.env['GOOGLE_MAPS_API_KEY'] ||
    process.env['MAPS_API_KEY'] ||
    '';

  return {
    apiKey,
    placesApiBaseUrl: 'https://places.googleapis.com/v1/places',
    routesApiBaseUrl: 'https://routes.googleapis.com/directions/v2:computeRoutes',
    requestTimeoutMs: 10000,
    maxRetryAttempts: 3,
    retryInitialDelayMs: 500,
    allowMockFallback: true, // Gracefully use labeled sample data when live API is unconfigured/denied
    fieldMasks: {
      placesSearch: [
        'places.id',
        'places.displayName',
        'places.formattedAddress',
        'places.location',
        'places.primaryType',
        'places.types',
        'places.rating',
        'places.userRatingCount',
        'places.currentOpeningHours',
        'places.editorialSummary'
      ].join(','),
      placeDetails: [
        'id',
        'displayName',
        'formattedAddress',
        'location',
        'primaryType',
        'types',
        'rating',
        'userRatingCount',
        'regularOpeningHours',
        'currentOpeningHours',
        'editorialSummary',
        'googleMapsUri'
      ].join(','),
      routesCompute: [
        'routes.duration',
        'routes.distanceMeters',
        'routes.polyline.encodedPolyline',
        'routes.legs',
        'routes.optimizedIntermediateWaypointIndex'
      ].join(','),
    },
  };
}
