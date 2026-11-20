/**
 * Venue Capacity, Crowd Management & Throttling Types
 * Developer C - Task C4
 *
 * Reconciles Domain 07 contracts (A4) with Developer C's Routing & Maps Engine.
 */

import type { NormalizedCoordinate, LatLng } from './coordinates.types.js';
import type { WalkingPace, RouteStopInput } from './routes.types.js';
import type {
  CrowdLevel,
  VenueHourlyCapacityDocument,
  ScheduledVisitDocument,
} from '../../types/contracts/index.js';

export type { CrowdLevel, VenueHourlyCapacityDocument, ScheduledVisitDocument };

/**
 * Capacity Availability Status for a venue at a specific hour slot
 */
export type VenueCapacityStatus =
  | 'AVAILABLE'      // Capacity is confirmed available (remainingCapacity > 0)
  | 'AT_CAPACITY'    // Venue is confirmed full (remainingCapacity <= 0, isThrottled = true)
  | 'UNAVAILABLE'    // Venue is explicitly closed or unavailable for visits in this slot
  | 'UNKNOWN';       // Capacity record does not exist or could not be verified

/**
 * Structured evaluation result for a venue at a given visit time
 */
export interface VenueCapacityEvaluation {
  placeId: string;
  placeName?: string;
  hourSlot: string;                  // ISO 8601 UTC top-of-hour
  slotId: string;                    // e.g. "slot_20261120_1400"
  status: VenueCapacityStatus;
  maxCapacity?: number;
  currentVisitorsCount?: number;
  remainingCapacity?: number;
  crowdLevel?: CrowdLevel;
  isThrottled: boolean;
  isMockData: boolean;
  notes?: string;
}

/**
 * Alternative venue candidate when preferred venue is full or unavailable
 */
export interface AlternativeVenueOption {
  alternativePlaceId: string;
  alternativeName: string;
  coordinate: NormalizedCoordinate;
  distanceMeters: number;
  walkingDurationMinutes: number;
  currentCrowdLevel?: CrowdLevel;
  remainingCapacity?: number;
  capacityStatus: VenueCapacityStatus;
  reason: string;
  isMockData: boolean;
}

/**
 * Request to check venue capacity across multiple candidate places or route stops
 */
export interface BatchCapacityCheckRequest {
  stops: {
    placeId: string;
    placeName?: string;
    coordinate?: LatLng;
    intendedVisitTime: string; // ISO 8601 UTC timestamp
  }[];
  partySize?: number;
  allowMockFallback?: boolean;
}

/**
 * Result of checking a route stop's capacity
 */
export interface RouteStopCapacityResult {
  placeId: string;
  placeName?: string;
  intendedVisitTime: string;
  evaluation: VenueCapacityEvaluation;
  alternativeOptions: AlternativeVenueOption[];
  recommendedAction: 'PROCEED' | 'ROTATE_TO_ALTERNATIVE' | 'RESCHEDULE_SLOT' | 'PROCEED_WITH_UNKNOWN';
}

/**
 * Request to schedule a visit (integrating with A4 transactional booking)
 */
export interface ScheduleVisitRequest {
  placeId: string;
  hourSlot: string;           // ISO 8601 UTC timestamp
  partySize: number;
  travelerId: string;
  idempotencyKey: string;
  groupSessionId?: string | null;
  memberUserIds?: string[];
  allowMockFallback?: boolean;
}

/**
 * Outcome of visit scheduling
 */
export interface ScheduleVisitResult {
  success: boolean;
  status: 'CONFIRMED' | 'REJECTED_FULL' | 'REJECTED_UNAVAILABLE' | 'REJECTED_UNKNOWN' | 'ERROR';
  scheduledVisit?: ScheduledVisitDocument;
  evaluation: VenueCapacityEvaluation;
  suggestedAlternativeSlots?: {
    hourSlot: string;
    slotId: string;
    remainingCapacity: number;
    crowdLevel: CrowdLevel;
  }[];
  suggestedAlternativeVenues?: AlternativeVenueOption[];
  errorMessage?: string;
  isMockData: boolean;
}

/**
 * Capacity-aware walking route generation request
 */
export interface CapacityAwareRouteRequest {
  title?: string;
  neighborhood?: string;
  theme?: string;
  stops: (RouteStopInput & {
    intendedVisitTime?: string; // ISO 8601 UTC timestamp
    requiredCapacity?: number;  // party size for capacity checking
  })[];
  startTime?: string;           // ISO 8601 UTC, defaults to now if omitted
  optimizeStopOrder?: boolean;
  walkingPace?: WalkingPace;
  autoSubstituteFullStops?: boolean; // If true, replaces AT_CAPACITY stops with best alternative
  allowMockFallback?: boolean;
}

/**
 * Capacity-aware walking route response
 */
export interface CapacityAwareRouteResponse {
  routeId: string;
  title: string;
  neighborhood: string;
  theme: string;
  origin: NormalizedCoordinate;
  destination: NormalizedCoordinate;
  totalDistanceMeters: number;
  totalDurationSeconds: number;
  formattedDistance: string;
  formattedDuration: string;
  encodedPolyline: string;
  stops: {
    placeId?: string;
    spotName?: string;
    coordinate: NormalizedCoordinate;
    scheduledArrival: string;
    capacityStatus: VenueCapacityStatus;
    crowdLevel?: CrowdLevel;
    isSubstituted: boolean;
    originalPlaceId?: string;
    substitutionReason?: string;
    availableAlternatives: AlternativeVenueOption[];
  }[];
  legs: {
    startCoordinate: NormalizedCoordinate;
    endCoordinate: NormalizedCoordinate;
    distanceMeters: number;
    durationSeconds: number;
    steps: {
      instruction: string;
      distanceMeters: number;
      durationSeconds: number;
    }[];
  }[];
  hasThrottledStops: boolean;
  hasUnknownCapacityStops: boolean;
  warnings: string[];
  isMockData: boolean;
  generatedAt: string;
}
