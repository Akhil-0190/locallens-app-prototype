/**
 * Weather & Closure Inputs for Plan-B Rerouting
 * Developer C - Weather/Closure Inputs and Plan-B Routing
 */

export type DisruptionType =
  | 'HEAVY_RAIN'
  | 'WATERLOGGING'
  | 'EXTREME_HEAT'
  | 'UNSCHEDULED_CLOSURE'
  | 'OVERCROWDED_THROTTLED'
  | 'LOCAL_FESTIVAL_BLOCKED';

export interface WeatherConditionInput {
  recordedAt: string;
  condition: 'CLEAR' | 'CLOUDY' | 'DRIZZLE' | 'HEAVY_RAIN' | 'THUNDERSTORM';
  temperatureCelsius: number;
  precipitationProbability: number; // 0 to 1
  isWalkingImpaired: boolean;
  advisoryMessage?: string;
}

export interface VenueClosureInput {
  placeId: string;
  isClosed: boolean;
  reason?: string;
  expectedReopenTime?: string; // ISO 8601
  source: 'GOOGLE_PLACES_HOURS' | 'COMMUNITY_REPORT' | 'VENUE_NOTICE';
}

export interface PlanBTrigger {
  routeId: string;
  impactedStopPlaceId: string;
  reason: DisruptionType;
  triggerTime: string;
  userAcceptedAlternative?: boolean;
}

export interface PlanBRerouteOption {
  alternativePlaceId: string;
  alternativePlaceName: string;
  reasonForSelection: string;
  detourDistanceMeters: number;
  detourDurationSeconds: number;
  indoorAlternative: boolean;
}
