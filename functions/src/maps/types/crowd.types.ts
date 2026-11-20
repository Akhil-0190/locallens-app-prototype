/**
 * Venue Capacity and Crowd Management Types
 * Developer C - Crowd Throttling & Scheduling Logic
 */

export type CrowdLevel = 'LOW' | 'MODERATE' | 'HIGH' | 'AT_CAPACITY';

export interface VenueHourlyCapacity {
  venueId: string;
  hourSlot: string; // ISO 8601 hour string or "14:00-15:00"
  maxCapacity: number;
  currentVisitorsCount: number;
  remainingCapacity: number;
  level: CrowdLevel;
  isThrottled: boolean;
}

export interface CrowdThrottlingRule {
  venueId: string;
  maxHourlyVisitors: number;
  bufferPercentage: number; // e.g. 10% safety buffer before throttling
  throttleThreshold: number;
}

export interface RouteStopCrowdCheck {
  placeId: string;
  placeName: string;
  scheduledArrival: string; // ISO 8601
  crowdLevel: CrowdLevel;
  canAccommodate: boolean;
  suggestedAlternativePlaceId?: string;
}
