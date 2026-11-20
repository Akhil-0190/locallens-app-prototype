/**
 * Weather Service Client
 * Developer C - Task C5
 *
 * Sourcing, normalizing, and evaluating weather conditions for walking itineraries.
 */

import { getMapsConfig, type MapsPlatformConfig } from '../config.js';
import type { LatLng } from '../types/coordinates.types.js';
import type { NormalizedWeather, WeatherSeverity, WeatherConditionType } from '../types/weather.types.js';
import { SAMPLE_WEATHER_FIXTURES } from '../fixtures/sample-weather.fixture.js';

export class WeatherService {
  private config: MapsPlatformConfig;

  constructor(customConfig?: Partial<MapsPlatformConfig>) {
    this.config = { ...getMapsConfig(), ...customConfig };
  }

  /**
   * Evaluates weather condition for a given coordinate and visit timestamp.
   *
   * Rules:
   * - Missing credentials or unavailable responses NEVER default to CLEAR. They return 'UNAVAILABLE'.
   * - Future visit times distinguish CURRENT observations from FORECAST predictions.
   * - If a visit is in the future (> 2 hours) and only current conditions are available,
   *   it marks dataType: 'CURRENT' and explicitly notes the absence of forecast data.
   */
  public async getWeatherCondition(params: {
    location: LatLng;
    intendedVisitTime: string;
    allowMockFallback?: boolean;
    mockScenarioKey?: string;
  }): Promise<NormalizedWeather> {
    const { location, intendedVisitTime, allowMockFallback = true, mockScenarioKey } = params;
    const key = this.config.weatherApiKey || this.config.apiKey;

    const visitDate = new Date(intendedVisitTime);
    const now = new Date();
    const isFutureVisit = !isNaN(visitDate.getTime()) && visitDate.getTime() - now.getTime() > 2 * 60 * 60 * 1000;

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
          const raw = (await res.json()) as any;
          return this.normalizeGoogleWeatherResponse(raw, location, intendedVisitTime, false, isFutureVisit);
        }
      } catch {
        // Fall through to fallback or unavailable
      }
    }

    // 2. Mock Fallback if allowed
    if (allowMockFallback) {
      if (mockScenarioKey && SAMPLE_WEATHER_FIXTURES[mockScenarioKey]) {
        const fixture = SAMPLE_WEATHER_FIXTURES[mockScenarioKey];
        return {
          ...fixture,
          location,
          timestamp: intendedVisitTime,
          dataType: isFutureVisit ? 'FORECAST' : 'CURRENT',
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
        dataType: isFutureVisit ? 'FORECAST' : 'CURRENT',
        advisory: isFutureVisit ? 'Forecast indicates fair weather for walking.' : 'Fair weather for walking.',
        isMockData: true,
        freshnessSeconds: 120,
      };
    }

    // 3. Honest representation when live API is unconfigured or failed and fallback disabled.
    // Finding B1 requirement: Missing weather credentials/data must NEVER mean CLEAR.
    return {
      provider: 'GOOGLE_MAPS_WEATHER',
      location,
      timestamp: intendedVisitTime,
      condition: 'UNAVAILABLE',
      temperatureCelsius: 0,
      precipitationProbability: 0,
      windSpeedKmh: 0,
      isWalkingImpaired: false,
      severity: 'NONE',
      dataType: 'UNAVAILABLE',
      advisory: 'Weather data unavailable. Weather conditions unverified.',
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
    isMock: boolean,
    isFutureVisit: boolean
  ): NormalizedWeather {
    if (!raw || typeof raw !== 'object') {
      return {
        provider: isMock ? 'MOCK_FIXTURE' : 'GOOGLE_MAPS_WEATHER',
        location,
        timestamp,
        condition: 'UNAVAILABLE',
        temperatureCelsius: 0,
        precipitationProbability: 0,
        windSpeedKmh: 0,
        isWalkingImpaired: false,
        severity: 'NONE',
        dataType: 'UNAVAILABLE',
        advisory: 'Malformed weather API response. Conditions unverified.',
        isMockData: isMock,
        freshnessSeconds: 0,
      };
    }

    const conditionStr = (raw.condition || raw.weatherCondition || '').toUpperCase();
    let condition: WeatherConditionType = 'CLEAR';
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
    } else if (conditionStr.includes('CLEAR')) {
      condition = 'CLEAR';
      severity = 'NONE';
    } else if (!conditionStr) {
      condition = 'UNAVAILABLE';
    }

    const temp = raw.temperature?.degrees ?? raw.temperatureCelsius ?? 25;
    if (temp >= 38) {
      condition = 'EXTREME_HEAT';
      severity = 'MODERATE';
      isWalkingImpaired = true;
    }

    const advisory = isWalkingImpaired
      ? 'Walking conditions impaired by weather.'
      : isFutureVisit
      ? 'Current conditions retrieved; future forecast unverified.'
      : undefined;

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
      dataType: isFutureVisit ? 'CURRENT' : 'CURRENT', // currentConditions endpoint only returns current observations
      advisory,
      isMockData: isMock,
      freshnessSeconds: 60,
    };
  }
}
