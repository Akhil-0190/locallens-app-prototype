/**
 * Weather & Closure Fixtures
 * Developer C - Task C5
 *
 * Sample weather conditions and closure signals for Malleswaram and Bangalore.
 * All fixtures in this file are explicitly labeled with isMockData: true.
 * DO NOT TREAT AS REAL OR LIVE DATA.
 */

import type { NormalizedWeather, VenueClosureSignal } from '../../types/weather.types.js';

export const SAMPLE_WEATHER_FIXTURES: Record<string, NormalizedWeather> = {
  // Clear day in Malleswaram
  'malleswaram_clear': {
    provider: 'MOCK_FIXTURE',
    location: { latitude: 13.0075, longitude: 77.5714 },
    timestamp: '2026-11-20T08:00:00.000Z',
    condition: 'CLEAR',
    temperatureCelsius: 24,
    precipitationProbability: 0.05,
    windSpeedKmh: 8,
    isWalkingImpaired: false,
    severity: 'NONE',
    dataType: 'CURRENT',
    advisory: 'Pleasant morning weather for walking.',
    isMockData: true,
    freshnessSeconds: 120,
  },

  // Sudden Monsoon Heavy Rain
  'malleswaram_heavy_rain': {
    provider: 'MOCK_FIXTURE',
    location: { latitude: 13.0075, longitude: 77.5714 },
    timestamp: '2026-11-20T09:00:00.000Z',
    condition: 'HEAVY_RAIN',
    temperatureCelsius: 21,
    precipitationProbability: 0.95,
    windSpeedKmh: 35,
    isWalkingImpaired: true,
    severity: 'SEVERE',
    dataType: 'CURRENT',
    advisory: 'Heavy monsoon downpour with local waterlogging. Indoor alternatives recommended.',
    isMockData: true,
    freshnessSeconds: 60,
  },

  // Extreme Afternoon Heat
  'malleswaram_extreme_heat': {
    provider: 'MOCK_FIXTURE',
    location: { latitude: 13.0075, longitude: 77.5714 },
    timestamp: '2026-11-20T13:00:00.000Z',
    condition: 'EXTREME_HEAT',
    temperatureCelsius: 38,
    precipitationProbability: 0.0,
    windSpeedKmh: 5,
    isWalkingImpaired: true,
    severity: 'MODERATE',
    dataType: 'CURRENT',
    advisory: 'High temperature advisory. Shaded paths and air-conditioned spots recommended.',
    isMockData: true,
    freshnessSeconds: 300,
  },
};

export const SAMPLE_CLOSURE_FIXTURES: Record<string, VenueClosureSignal> = {
  'place_ctr_shri_sagar': {
    placeId: 'place_ctr_shri_sagar',
    placeName: 'CTR Shri Sagar',
    isClosed: false,
    businessStatus: 'OPERATIONAL',
    outsidePublishedHours: false,
    source: 'GOOGLE_PLACES_NEW',
    timestamp: '2026-11-20T08:00:00.000Z',
    confidence: 'CONFIRMED',
    isMockData: true,
  },

  // Temple closed for afternoon rituals (12:30 PM - 4:00 PM)
  'place_kadu_malleshwara': {
    placeId: 'place_kadu_malleshwara',
    placeName: 'Kadu Malleshwara Temple',
    isClosed: true,
    businessStatus: 'OPERATIONAL',
    outsidePublishedHours: true,
    reason: 'Temple sanctum closed for afternoon rituals (reopens at 16:00 IST)',
    source: 'SCHEDULE_CHECK',
    timestamp: '2026-11-20T13:00:00.000Z',
    confidence: 'CONFIRMED',
    isMockData: true,
  },

  // Emergency renovation closure
  'place_closed_stall_01': {
    placeId: 'place_closed_stall_01',
    placeName: 'Heritage Spice Stall',
    isClosed: true,
    businessStatus: 'CLOSED_TEMPORARILY',
    outsidePublishedHours: false,
    reason: 'Temporarily closed for road maintenance in alley',
    source: 'SCHEDULE_CHECK',
    timestamp: '2026-11-20T09:00:00.000Z',
    confidence: 'HIGH',
    isMockData: true,
  },
};
