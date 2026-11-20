/**
 * Sample Walking Route Fixture (Malleshwaram Heritage Walk)
 * Developer C - Google Maps Platform Integration
 * 
 * IMPORTANT: Labeled offline sample data representing Routes API output.
 */

import type { GoogleRouteRaw, WalkingRoute } from '../types/routes.types';
import { NormalizationService } from '../services/normalization.service';

export const SAMPLE_RAW_ROUTE_FIXTURE: GoogleRouteRaw = {
  distanceMeters: 1150,
  duration: '870s',
  staticDuration: '870s',
  polyline: {
    encodedPolyline: '_{~jA}w_sMrAiB`@q@nAoBvB}CxAgBh@_@dAs@nBy@',
  },
  description: 'Walking via 7th Cross Rd and Temple St',
  legs: [
    {
      distanceMeters: 450,
      duration: '340s',
      startLocation: { latLng: { latitude: 13.003185, longitude: 77.570258 } },
      endLocation: { latLng: { latitude: 13.00412, longitude: 77.57143 } },
      steps: [
        {
          distanceMeters: 200,
          staticDuration: '150s',
          navigationInstruction: {
            maneuver: 'HEAD_EAST',
            instructions: 'Walk east on 7th Cross Rd toward Margosa Rd',
          },
        },
        {
          distanceMeters: 250,
          staticDuration: '190s',
          navigationInstruction: {
            maneuver: 'TURN_LEFT',
            instructions: 'Turn left onto 8th Cross Rd into Flower Market',
          },
        },
      ],
    },
    {
      distanceMeters: 700,
      duration: '530s',
      startLocation: { latLng: { latitude: 13.00412, longitude: 77.57143 } },
      endLocation: { latLng: { latitude: 13.00725, longitude: 77.57189 } },
      steps: [
        {
          distanceMeters: 700,
          staticDuration: '530s',
          navigationInstruction: {
            maneuver: 'CONTINUE_NORTH',
            instructions: 'Walk north on Temple St toward Kadu Malleshwara Temple',
          },
        },
      ],
    },
  ],
};

export const SAMPLE_NORMALIZED_WALKING_ROUTE: WalkingRoute = {
  routeId: 'route_sample_malleshwaram_001',
  origin: NormalizationService.normalizeCoordinate({
    latitude: 13.003185,
    longitude: 77.570258,
  }),
  destination: NormalizationService.normalizeCoordinate({
    latitude: 13.00725,
    longitude: 77.57189,
  }),
  waypoints: [
    NormalizationService.normalizeCoordinate({
      latitude: 13.00412,
      longitude: 77.57143,
    }),
  ],
  totalDistanceMeters: 1150,
  totalDurationSeconds: 870,
  formattedDistance: '1.2 km',
  formattedDuration: '15 mins',
  encodedPolyline: '_{~jA}w_sMrAiB`@q@nAoBvB}CxAgBh@_@dAs@nBy@',
  legs: [
    {
      distanceMeters: 450,
      durationSeconds: 340,
      startCoordinate: NormalizationService.normalizeCoordinate({
        latitude: 13.003185,
        longitude: 77.570258,
      }),
      endCoordinate: NormalizationService.normalizeCoordinate({
        latitude: 13.00412,
        longitude: 77.57143,
      }),
      steps: [
        {
          instruction: 'Walk east on 7th Cross Rd toward Margosa Rd',
          distanceMeters: 200,
          durationSeconds: 150,
        },
        {
          instruction: 'Turn left onto 8th Cross Rd into Flower Market',
          distanceMeters: 250,
          durationSeconds: 190,
        },
      ],
    },
    {
      distanceMeters: 700,
      durationSeconds: 530,
      startCoordinate: NormalizationService.normalizeCoordinate({
        latitude: 13.00412,
        longitude: 77.57143,
      }),
      endCoordinate: NormalizationService.normalizeCoordinate({
        latitude: 13.00725,
        longitude: 77.57189,
      }),
      steps: [
        {
          instruction: 'Walk north on Temple St toward Kadu Malleshwara Temple',
          distanceMeters: 700,
          durationSeconds: 530,
        },
      ],
    },
  ],
  isMockData: true,
  generatedAt: new Date().toISOString(),
};
