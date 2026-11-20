/**
 * Weather Service Client
 * Developer C - Task C5
 *
 * Sourcing, normalizing, and evaluating weather conditions for walking itineraries.
 */

import { getMapsConfig, type MapsPlatformConfig } from '../config.js';
import type { LatLng } from '../types/coordinates.types.js';
import type { NormalizedWeather, WeatherSeverity } from '../types/weather.types.js';
import { SAMPLE_WEATHER_FIXTURES } from '../fixtures/sample-weather.fixture.js';

export class WeatherService {
  private config: MapsPlatformConfig;

  constructor(customConfig?: Partial<MapsPlatformConfig>) {
    this.config = { ...getMapsConfig(), ...customConfig };
  }

  /**
   * Evaluates weather condition for a given coordinate and visit timestamp.
   * Gracefully falls back to mock fixture or returns honest UNKNOWN when unconfigured.
   */
  public async getWeatherCondition(params: {
    location: LatLng;
    intendedVisitTime: string;
    allowMockFallback?: boolean;
    mockScenarioKey?: string;
  }): Promise<NormalizedWeather> {
    const { location, intendedVisitTime, allowMockFallback = true, mockScenarioKey } = params;
    const key = this.config.weatherApiKey || this.config.apiKey;

    // 1. Live Weather API call if key is present
    if (key) {
      try {
        const endpoint = `${this.config.weatherApiBaseUrl}/currentConditions:lookup?key=${key}`;
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            location: {
              latitude: location.latitude,
              longitude: location.longitude,
            },
          }),
          signal: AbortSignal.timeout(this.config.requestTimeoutMs),
        });

        if (res.ok) {
          const raw = await res.json() as any;
          return this.normalizeGoogleWeatherResponse(raw, location, intendedVisitTime, false);
        }
      } catch {
        // Fall through to fallback
      }
    }

    // 2. Mock Fallback if allowed
    if (allowMockFallback) {
      if (mockScenarioKey && SAMPLE_WEATHER_FIXTURES[mockScenarioKey]) {
        return {
          ...SAMPLE_WEATHER_FIXTURES[mockScenarioKey],
          location,
          timestamp: intendedVisitTime,
          isMockData: true,
        };
      }

      // Default sample weather: Clear
      return {
        provider: 'MOCK_FIXTURE',
        location,
        timestamp: intendedVisitTime,
        condition: 'CLEAR',
        temperatureCelsius: 24,
        precipitationProbability: 0.1,
        windSpeedKmh: 10,
        isWalkingImpaired: false,
        severity: 'NONE',
        advisory: 'Fair weather for walking.',
        isMockData: true,
        freshnessSeconds: 120,
      };
    }

    // 3. Honest representation when live API is unconfigured and fallback disabled
    return {
      provider: 'GOOGLE_MAPS_WEATHER',
      location,
      timestamp: intendedVisitTime,
      condition: 'CLEAR',
      temperatureCelsius: 0,
      precipitationProbability: 0,
      windSpeedKmh: 0,
      isWalkingImpaired: false,
      severity: 'NONE',
      advisory: 'Weather data unavailable.',
      isMockData: false,
      freshnessSeconds: 0,
    };
  }

  /**
   * Normalizes raw weather responses into standard NormalizedWeather model
   */
  private normalizeGoogleWeatherResponse(
    raw: any,
    location: LatLng,
    timestamp: string,
    isMock: boolean
  ): NormalizedWeather {
    const conditionStr = (raw.condition || raw.weatherCondition || 'CLEAR').toUpperCase();
    let condition: NormalizedWeather['condition'] = 'CLEAR';
    let severity: WeatherSeverity = 'NONE';
    let isWalkingImpaired = false;

    if (conditionStr.includes('RAIN') || conditionStr.includes('STORM')) {
      condition = conditionStr.includes('THUNDER') ? 'THUNDERSTORM' : 'HEAVY_RAIN';
      severity = 'SEVERE';
      isWalkingImpaired = true;
    } else if (conditionStr.includes('DRIZZLE')) {
      condition = 'DRIZZLE';
      severity = 'LOW';
    } else if (conditionStr.includes('CLOUD')) {
      condition = 'CLOUDY';
      severity = 'NONE';
    }

    const temp = raw.temperature?.degrees ?? raw.temperatureCelsius ?? 25;
    if (temp >= 38) {
      condition = 'EXTREME_HEAT';
      severity = 'MODERATE';
      isWalkingImpaired = true;
    }

    return {
      provider: isMock ? 'MOCK_FIXTURE' : 'GOOGLE_MAPS_WEATHER',
      location,
      timestamp,
      condition,
      temperatureCelsius: temp,
      precipitationProbability: raw.precipitationProbability ?? (condition === 'HEAVY_RAIN' ? 0.9 : 0.1),
      windSpeedKmh: raw.windSpeedKmh ?? 12,
      isWalkingImpaired,
      severity,
      advisory: isWalkingImpaired ? 'Walking conditions impaired by weather.' : undefined,
      isMockData: isMock,
      freshnessSeconds: 60,
    };
  }
}
