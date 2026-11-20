/**
 * Weather, Closure & Plan-B Rerouting Types
 * Developer C - Task C5
 *
 * Defines contracts for weather evaluation, closure signals, disruption triggers,
 * and dynamic Plan-B walking route recalculation.
 */

import type { NormalizedCoordinate, LatLng } from './coordinates.types.js';
import type { WalkingPace } from './routes.types.js';
import type { CanonicalRouteDocument } from '../../types/contracts/index.js';
import type {
  CrowdLevel,
  VenueCapacityStatus,
} from './crowd.types.js';

/**
 * Standard disruption classifications that can trigger Plan-B rerouting
 */
export type DisruptionType =
  | 'HEAVY_RAIN'
  | 'WATERLOGGING'
  | 'EXTREME_HEAT'
  | 'THUNDERSTORM'
  | 'VENUE_CLOSED'
  | 'VENUE_OVERCROWDED'
  | 'STREET_BLOCKED'
  | 'OUTSIDE_HOURS'
  | 'CUSTOM_ALERT';

/**
 * Weather severity classification
 */
export type WeatherSeverity = 'NONE' | 'LOW' | 'MODERATE' | 'SEVERE';

/**
 * Weather condition classification
 */
export type WeatherConditionType =
  | 'CLEAR'
  | 'CLOUDY'
  | 'DRIZZLE'
  | 'HEAVY_RAIN'
  | 'THUNDERSTORM'
  | 'EXTREME_HEAT'
  | 'UNAVAILABLE';

/**
 * Normalized weather condition representation
 */
export interface NormalizedWeather {
  provider: 'GOOGLE_MAPS_WEATHER' | 'MOCK_FIXTURE';
  location: LatLng;
  timestamp: string;               // ISO 8601 UTC
  condition: WeatherConditionType;
  temperatureCelsius: number;
  precipitationProbability: number; // 0 to 1
  windSpeedKmh: number;
  isWalkingImpaired: boolean;
  severity: WeatherSeverity;
  dataType: 'CURRENT' | 'FORECAST' | 'UNAVAILABLE';
  advisory?: string;
  isMockData: boolean;
  freshnessSeconds: number;
}

/**
 * Closure signal representation from Google Places or external signal
 */
export interface VenueClosureSignal {
  placeId: string;
  placeName?: string;
  isClosed: boolean;
  businessStatus?: 'OPERATIONAL' | 'CLOSED_TEMPORARILY' | 'CLOSED_PERMANENTLY';
  outsidePublishedHours?: boolean;
  reason?: string;
  source: 'GOOGLE_PLACES_NEW' | 'USER_REPORT' | 'SCHEDULE_CHECK' | 'MOCK_FIXTURE';
  timestamp: string;
  confidence: 'CONFIRMED' | 'HIGH' | 'ESTIMATED' | 'UNKNOWN';
  isMockData: boolean;
}

/**
 * Disruption trigger submitted for Plan-B rerouting
 */
export interface PlanBDisruption {
  type: DisruptionType;
  affectedPlaceId?: string;
  affectedStopIndex?: number;
  description: string;
  severity: WeatherSeverity;
  signalTimestamp: string;
}

/**
 * One-tap Plan-B rerouting request
 */
export interface PlanBRerouteRequest {
  originalRoute: CanonicalRouteDocument;
  disruptions: PlanBDisruption[];
  currentTravelerCoordinate?: LatLng;
  originalStartTime?: string;      // ISO 8601 UTC, defaults to originalRoute.createdAt or now
  stopVisitDurationsMinutes?: Record<string, number>; // Per-place visit durations in minutes
  walkingPace?: WalkingPace;
  preferredIndoorAlternatives?: boolean;
  allowMockFallback?: boolean;
}

/**
 * Individual stop alteration record in Plan-B route
 */
export interface StopAlterationRecord {
  originalPlaceId?: string;
  originalStopName?: string;
  action: 'RETAINED' | 'REPLACED' | 'SKIPPED';
  replacementPlaceId?: string;
  replacementStopName?: string;
  replacementCoordinate?: NormalizedCoordinate;
  reason: string;
  disruptionType?: DisruptionType;
  scheduledArrival?: string;       // ISO 8601 UTC recalculated arrival time
  capacityStatusAtArrival: VenueCapacityStatus;
  crowdLevelAtArrival?: CrowdLevel;
}

/**
 * Structured explanation context designed for Developer B (AI / Gemini Live)
 */
export interface PlanBExplanationContext {
  summary: string;
  primaryDisruption: DisruptionType;
  disruptedStopsCount: number;
  replacedStops: {
    from: string;
    to: string;
    reason: string;
  }[];
  retainedStopsCount: number;
  distanceDeltaMeters: number;
  durationDeltaSeconds: number;
  weatherAdvisory?: string;
  crowdNotice?: string;
}

/**
 * Complete Plan-B rerouting response conforming to Domain 08 contracts
 */
export interface PlanBRerouteResponse {
  rerouteId: string;
  originalRouteId: string;
  updatedRoute: CanonicalRouteDocument;
  alterations: StopAlterationRecord[];
  explanationContext: PlanBExplanationContext;
  hasCapacityUncertainty: boolean;
  hasWeatherImpact: boolean;
  warnings: string[];
  isMockData: boolean;
  generatedAt: string;
}
