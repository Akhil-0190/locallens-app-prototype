# Domain 08: Routes & Route Stops

**Contract Reference:** `docs/contracts/08-routes-and-route-stops.md`
**Firestore Collections:** `routes/{routeId}`, `disruptions/{disruptionId}`
**Primary Stakeholders:** Developer A (Backend Store), Developer C (Google Maps Routes API), Developer D (Flutter Walking Mode)
**Sample Payload:** [docs/contracts/samples/08-walking-route.sample.json](file:///d:/Judah/Projects/Hackthon/Google/BuildathonNew/neighborhoodguideapp/docs/contracts/samples/08-walking-route.sample.json)

---

## 1. Scope & Ownership
Defines pedestrian walking routes with waypoint sequencing, encoded polylines for map rendering, turn-by-turn navigation steps, and geodesic pedestrian fallback routes when API quota is exhausted.

---

## 2. Canonical TypeScript Interface

```typescript
import { NormalizedCoordinate } from '../maps/types/coordinates.types';

export interface RouteNavigationStep {
  instruction: string;                  // e.g. "Head west on 8th Cross Rd toward Margosa Rd"
  distanceMeters: number;
  durationSeconds: number;
  startCoordinate: NormalizedCoordinate;
  endCoordinate: NormalizedCoordinate;
}

export interface RouteLeg {
  startPlaceId?: string;
  endPlaceId?: string;
  distanceMeters: number;
  durationSeconds: number;
  startCoordinate: NormalizedCoordinate;
  endCoordinate: NormalizedCoordinate;
  steps: RouteNavigationStep[];
}

export interface CanonicalRouteDocument {
  routeId: string;                      // Unique route UUID
  title: string;                        // Display title
  neighborhood: string;                 // e.g. "Malleshwaram"
  theme: string;                        // e.g. "Heritage & Coffee Trail"
  origin: NormalizedCoordinate;
  destination: NormalizedCoordinate;
  waypoints: NormalizedCoordinate[];
  waypointPlaceIds: string[];           // Sequence of visited spot IDs
  optimizedWaypointOrder: number[];     // Stop ordering
  totalDistanceMeters: number;
  totalDurationSeconds: number;
  formattedDistance: string;            // e.g. "1.1 km"
  formattedDuration: string;            // e.g. "15 mins"
  encodedPolyline: string;              // Google Maps encoded polyline string
  legs: RouteLeg[];
  isMockData: boolean;
  createdAt: string;                    // ISO 8601 UTC
  updatedAt: string;                    // ISO 8601 UTC
}

export interface RouteDisruptionDocument {
  disruptionId: string;
  impactedPlaceId: string;
  impactedRouteIds: string[];
  type: 'HEAVY_RAIN' | 'WATERLOGGING' | 'EXTREME_HEAT' | 'UNSCHEDULED_CLOSURE' | 'OVERCROWDED_THROTTLED' | 'LOCAL_FESTIVAL_BLOCKED';
  severity: 'WARNING' | 'REROUTE_RECOMMENDED' | 'REROUTE_MANDATORY';
  description: string;
  alternativeOptions: {
    alternativePlaceId: string;
    alternativePlaceName: string;
    detourDistanceMeters: number;
    indoorAlternative: boolean;
  }[];
  activeFrom: string;
  expiresAt: string;
  reportedAt: string;
}
```
