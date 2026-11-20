# Shared Models & Contract Proposal — Maps & Routes Domain

**Author:** Developer C (Maps Platform, Grounding, Routes & Crowd Management)  
**Coordination Target:** Developer A (Firebase Infrastructure & Canonical Backend Contracts) & Developer D (Flutter Client)  
**Task Reference:** C1 — Google Maps Platform Foundation  
**Status:** PROPOSED FOR CANONICAL ADOPTION (A2 Contract Alignment)  

---

## 1. Overview

Developer C proposes the following normalized data models for adoption into the shared backend contracts (`functions/src/types` and Firestore collections) to ensure seamless interoperability between Cloud Functions, Gemini AI processing (Developer B), and the Flutter client (Developer D).

---

## 2. Core Domain Models

### A. Normalized Coordinate (`NormalizedCoordinate`)
Standardized geographic coordinate with guaranteed 6-decimal precision (~11 cm street accuracy).

```typescript
export interface NormalizedCoordinate {
  latitude: number;       // Range: -90.0 to 90.0
  longitude: number;      // Range: -180.0 to 180.0
  precision: number;      // Fixed to 6
  formatted: string;      // e.g. "12.971599, 77.594563"
  geohash?: string;       // Optional geohash for spatial Firestore queries
  isValid: boolean;       // Coordinate validity check
}
```

### B. Normalized Place (`NormalizedPlace`)
Unified place schema bridging Google Places API (New) details, insider recommendations, and client UI cards.

```typescript
export interface NormalizedPlace {
  placeId: string;                     // Google Place ID (e.g. "ChIJ...") or internal local ID
  name: string;                        // Localized spot name
  formattedAddress: string;            // Street address
  coordinate: NormalizedCoordinate;    // Verified lat/lng
  primaryCategory: string;             // e.g. "south_indian_restaurant", "market"
  categories: string[];                // Broader category taxonomy
  rating: number;                      // Aggregated rating (0.0 to 5.0)
  reviewCount: number;                 // User review count
  isOpenNow: boolean | null;           // Live opening state (null if unconfirmed)
  openingHoursDescriptions: string[];  // Daily operating hours
  summary: string;                     // Short editorial description / vibe summary
  mapsUrl: string;                     // External Google Maps deep-link
  isMockData: boolean;                 // Explicit flag indicating whether data is sample/mock
  lastVerifiedAt: string;              // ISO 8601 timestamp
}
```

### C. Walking Route (`WalkingRoute`)
Optimized pedestrian walking itinerary with stop sequencing, polylines, and navigation steps.

```typescript
export interface WalkingRoute {
  routeId: string;
  origin: NormalizedCoordinate;
  destination: NormalizedCoordinate;
  waypoints: NormalizedCoordinate[];
  optimizedWaypointOrder?: number[];    // Waypoint sequence order (0-indexed)
  totalDistanceMeters: number;          // Total walking distance in meters
  totalDurationSeconds: number;         // Total walking duration in seconds
  formattedDistance: string;            // e.g. "1.1 km"
  formattedDuration: string;            // e.g. "15 mins"
  encodedPolyline: string;              // Google Maps encoded polyline string for map rendering
  legs: {
    distanceMeters: number;
    durationSeconds: number;
    startCoordinate: NormalizedCoordinate;
    endCoordinate: NormalizedCoordinate;
    steps: {
      instruction: string;              // Pedestrian navigation prompt
      distanceMeters: number;
      durationSeconds: number;
    }[];
  }[];
  isMockData: boolean;
  generatedAt: string;
}
```

### D. Venue Capacity & Crowd Throttling (`VenueHourlyCapacity`)
Real-time capacity tracking to prevent overtourism in small family-run stalls and narrow alleys.

```typescript
export type CrowdLevel = 'LOW' | 'MODERATE' | 'HIGH' | 'AT_CAPACITY';

export interface VenueHourlyCapacity {
  venueId: string;
  hourSlot: string;                     // ISO 8601 hour e.g. "2026-11-20T14:00:00Z"
  maxCapacity: number;                  // Maximum allowed hourly visitors
  currentVisitorsCount: number;         // Live booked/checked-in travelers
  remainingCapacity: number;            // maxCapacity - currentVisitorsCount
  level: CrowdLevel;                    // Crowd tier
  isThrottled: boolean;                 // True if venue is capped for this hour slot
}
```

### E. Disruption Inputs & Plan-B Routing (`DisruptionInput`)
Inputs triggering dynamic rerouting due to weather or unplanned closures.

```typescript
export type DisruptionType =
  | 'HEAVY_RAIN'
  | 'WATERLOGGING'
  | 'EXTREME_HEAT'
  | 'UNSCHEDULED_CLOSURE'
  | 'OVERCROWDED_THROTTLED'
  | 'LOCAL_FESTIVAL_BLOCKED';

export interface DisruptionInput {
  disruptionId: string;
  impactedPlaceId: string;
  type: DisruptionType;
  severity: 'WARNING' | 'REROUTE_RECOMMENDED' | 'REROUTE_MANDATORY';
  description: string;
  alternativeOptions: {
    alternativePlaceId: string;
    alternativePlaceName: string;
    detourDistanceMeters: number;
    indoorAlternative: boolean;
  }[];
  reportedAt: string;
}
```

---

## 3. Coordination Action Items for Developer A
1. Review field naming conventions against Firestore collection structures (`places`, `routes`, `capacities`).
2. Confirm timestamps follow ISO 8601 strings or Firestore Timestamps.
3. Validate that `NormalizedPlace` satisfies Developer B's AI spot-card enrichment requirements.
