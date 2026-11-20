# Task C3 — Personalized Walking Route Generation

**Task ID:** C3  
**Task Name:** Personalized Walking Route Generation  
**Owner:** Developer C (Maps Platform, Grounding, Routes & Crowd Management)  
**Stakeholders:** Developer D (Flutter Walking Mode & Map UI — Task D3), Developer A (Firestore Route Persistence — Task A2/A3)  
**Branch:** `feature/C3-walking-routes`  
**Date:** November 20, 2026  

---

## 1. Overview & Architecture

Task C3 implements multi-stop personalized walking route generation using the **Google Routes API** (`computeRoutes` endpoint, `travelMode: 'WALK'`), strictly outputting the canonical shared contract **`CanonicalRouteDocument` (Domain 08)** agreed with Developer A (`validateCanonicalRoute()`).

Key capabilities:
1. **Multi-Stop Walking Route Engine:** Accepts an ordered list of 2 or more stops (`origin`, `destination`, and intermediate `waypoints`), generating turn-by-turn navigation steps and detailed leg metrics.
2. **Stop Order Optimization (`optimizeStopOrder`):** Leverages Google Routes API waypoint optimization (`optimizeWaypointOrder: true`) to find the most efficient walking sequence and returns `optimizedWaypointOrder`.
3. **Pace-Scaled Walking Durations:** Dynamically scales route durations according to the traveler's preferred walking pace (`RELAXED` = 1.25x, `NORMAL` = 1.0x, `BRISK` = 0.85x).
4. **Leg & Navigation Step Breakdown:** Each route leg connects consecutive stops with distance, duration, start/end place IDs, start/end coordinates, and step-by-step instructions.
5. **Resilient Quota & Error Handling:** Integrates with `QuotaHandlerService` for exponential backoff retries and typed `RouteGenerationError` error codes.
6. **Live API Integration with Labeled Fallback:** Uses live Google Routes API when available (`isMockData: false`), with clearly labeled geodesic fallback routes (`isMockData: true`) when unauthenticated or offline.

```
Client / Agent Request (GenerateWalkingRouteRequest)
                       │
                       ▼
       ┌───────────────────────────────┐
       │     Stop Input Validation     │ ──► Checks >= 2 stops & coordinates
       └───────────────────────────────┘
                       │
                       ▼
       ┌───────────────────────────────┐
       │      RoutesService (C3)       │
       └───────────────────────────────┘
          │ (Live Routes API Key)         │ (Key Missing / Unauthenticated)
          ▼                               ▼
┌───────────────────────────┐   ┌───────────────────────────┐
│     Google Routes API     │   │ Dynamic Geodesic Fallback │
│  (computeRoutes - WALK)   │   │     (Urban Factor 1.3x)   │
└───────────────────────────┘   └───────────────────────────┘
          │                               │
          ▼                               ▼
    Live Raw Route                Fallback Raw Route
          │                               │
          └───────────────┬───────────────┘
                          ▼
       ┌─────────────────────────────────────┐
       │   Pace Scaler & Leg Step Mapper     │
       │   (RELAXED: 1.25x, BRISK: 0.85x)    │
       └─────────────────────────────────────┘
                          │
                          ▼
       ┌─────────────────────────────────────┐
       │      validateCanonicalRoute()       │ ──► Enforces Domain 08 Contract
       └─────────────────────────────────────┘
                          │
                          ▼
       CanonicalRouteDocument Output (For D & A)
```

---

## 2. API Contract & Interface Specification

Exported from `src/maps`:

```typescript
import {
  RoutesService,
  GenerateWalkingRouteRequest,
  RouteStopInput,
  WalkingPace,
  RouteGenerationError,
} from './maps';
import { CanonicalRouteDocument } from './types/contracts';
```

### Request Schema: `GenerateWalkingRouteRequest`

| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `stops` | `RouteStopInput[]` | **Yes** | Minimum 2 stops. Each stop requires `{ coordinate: LatLng, placeId?: string, spotName?: string }`. |
| `title` | `string` | No | Route title (e.g., "Malleshwaram Heritage Walk"). |
| `neighborhood` | `string` | No | Neighborhood name (e.g., "Malleshwaram"). |
| `theme` | `string` | No | Route theme (e.g., "Heritage & Street Food Trail"). Default: `"Walking Trail"`. |
| `optimizeStopOrder` | `boolean` | No | Whether to optimize intermediate waypoint ordering. Default: `false`. |
| `walkingPace` | `WalkingPace` | No | `'RELAXED'` (1.25x), `'NORMAL'` (1.0x), or `'BRISK'` (0.85x). Default: `'NORMAL'`. |
| `allowMockFallback`| `boolean` | No | Whether to allow labeled mock fallback if live API fails. |

### Response Schema: `CanonicalRouteDocument` (Domain 08)

The output strictly validates against `validateCanonicalRoute()`:

```json
{
  "routeId": "route_1763641200000_a1b2c",
  "title": "Malleshwaram Heritage Walk",
  "neighborhood": "Malleshwaram",
  "theme": "Heritage & Street Food Trail",
  "origin": { "latitude": 13.003185, "longitude": 77.570258, "precision": 6, "formatted": "13.003185,77.570258", "isValid": true },
  "destination": { "latitude": 13.00725, "longitude": 77.57189, "precision": 6, "formatted": "13.00725,77.57189", "isValid": true },
  "waypoints": [
    { "latitude": 13.00412, "longitude": 77.57143, "precision": 6, "formatted": "13.00412,77.57143", "isValid": true }
  ],
  "waypointPlaceIds": [
    "place_ctr_malleshwaram_01",
    "place_flower_market_02",
    "place_kadu_temple_03"
  ],
  "optimizedWaypointOrder": [0],
  "totalDistanceMeters": 686,
  "totalDurationSeconds": 654,
  "formattedDistance": "686 m",
  "formattedDuration": "11 mins",
  "encodedPolyline": "mujnAcmmxM?b@M?u@@DOBSBQ@Q?CAC...",
  "legs": [
    {
      "startPlaceId": "place_ctr_malleshwaram_01",
      "endPlaceId": "place_flower_market_02",
      "distanceMeters": 184,
      "durationSeconds": 162,
      "startCoordinate": { "latitude": 13.003185, "longitude": 77.570258, "precision": 6, "formatted": "13.003185,77.570258", "isValid": true },
      "endCoordinate": { "latitude": 13.00412, "longitude": 77.57143, "precision": 6, "formatted": "13.00412,77.57143", "isValid": true },
      "steps": [
        {
          "instruction": "Head east on 7th Cross Rd toward Margosa Rd",
          "distanceMeters": 184,
          "durationSeconds": 162,
          "startCoordinate": { "latitude": 13.003185, "longitude": 77.570258, "precision": 6, "formatted": "13.003185,77.570258", "isValid": true },
          "endCoordinate": { "latitude": 13.00412, "longitude": 77.57143, "precision": 6, "formatted": "13.00412,77.57143", "isValid": true }
        }
      ]
    }
  ],
  "isMockData": false,
  "createdAt": "2026-11-20T12:54:35.000Z",
  "updatedAt": "2026-11-20T12:54:35.000Z"
}
```

---

## 3. Walking Pace Adjustments & Duration Distinctions

### Baseline vs. Personalized Duration
- **Google Routes API Baseline:** The Google Routes API (`computeRoutes`) only measures standard pedestrian travel at a fixed average walking speed of approximately $1.25\text{ m/s}$ ($4.5\text{ km/h}$). The API returns this unpersonalized baseline in `raw.duration` and per-leg `leg.duration` / `step.staticDuration`. The Google Routes API does **not** accept a walking pace parameter or measure individual walking speeds.
- **Application-Level Personalized Transformation:** `RoutesService` transforms Google's raw baseline into a personalized duration estimate using application-level scaling:
  $$\text{durationSeconds}_{\text{personalized}} = \text{round}\left(\text{durationSeconds}_{\text{Google baseline}} \times \text{paceMultiplier}\right)$$

| Pace Mode | Duration Multiplier | Calculation Details | Primary Use Case |
| :--- | :--- | :--- | :--- |
| `RELAXED` | **1.25x** | Adds 25% to baseline duration | Leisurely walking, shopping, photography, families with children |
| `NORMAL` | **1.00x** | Matches Google API baseline | Standard baseline pedestrian pace (~1.25 m/s) |
| `BRISK` | **0.85x** | Reduces duration by 15% | Commuters, active travelers, fitness walkers |

Duration adjustments are applied consistently across `totalDurationSeconds`, each leg's `durationSeconds`, and each step's `durationSeconds`.

---

## 4. Multi-Stop Sequencing & Waypoint Optimization

When `optimizeStopOrder: true` is requested:
1. **Endpoint Preservation:** Origin (`stops[0]`) and Destination (`stops[stops.length - 1]`) remain fixed.
2. **Intermediate Waypoint Dispatch:** Intermediate stops are passed to Google Routes API with `optimizeWaypointOrder: true`.
3. **Index Mapping:** The Google Routes API calculates the optimal path and returns `optimizedIntermediateWaypointIndex` (e.g., `[1, 0]`, signifying that the second intermediate stop should be visited before the first).
4. **Synchronized Stop Sequence:** `RoutesService` constructs `orderedStops`:
   $$\text{orderedStops} = [\text{origin}, \text{intermediateStops}[\text{index}[0]], \dots, \text{intermediateStops}[\text{index}[K-1]], \text{destination}]$$
5. **Leg & Place Association:**
   - Each leg $i$ connects `orderedStops[i]` to `orderedStops[i + 1]`.
   - `startPlaceId` is set to `orderedStops[i].placeId`.
   - `endPlaceId` is set to `orderedStops[i + 1].placeId`.
   - `waypointPlaceIds` reflects the visited sequence.
   - `optimizedWaypointOrder` stores the index mapping for UI itinerary rendering.

---

## 5. Offline Geodesic Fallback & Turn-by-Turn Disclaimers

When the live Google Routes API is unavailable (missing credentials, unauthenticated environment, or network failure) and `allowMockFallback` is enabled:
1. **Dynamic Geodesic Estimation:** Distance between consecutive stops is calculated using the Haversine formula, multiplied by a standard urban street routing factor ($1.3\times$).
2. **Strict Mock Status Communication:**
   - `isMockData` is explicitly set to `true`.
   - The route ID is prefixed with `route_fallback_` or `route_sample_`.
3. **Turn-by-Turn Prevention:** Geodesic fallback routes **cannot and must not be used for street-level turn-by-turn navigation**. To prevent client misinterpretation:
   - Each leg step explicitly states: `[Offline Approximation] Direct path from <Stop A> toward <Stop B> (Approximate straight-line; turn-by-turn navigation unavailable offline)`.
   - No granular turn maneuvers (e.g., `TURN_LEFT`, `HEAD_EAST`) are manufactured.
   - Developer D's UI displays an "Estimated offline trail" indicator and suppresses turn-by-turn voice prompts when `isMockData === true`.

---

## 6. Error Handling & Status Codes

All errors thrown during route generation are typed instances of `RouteGenerationError`:

| Error Code | HTTP Status | Description | Action |
| :--- | :--- | :--- | :--- |
| `INSUFFICIENT_STOPS` | 400 | Fewer than 2 stops provided | Prompt user to add at least 2 stops |
| `INVALID_COORDINATES`| 400 | Coordinates out of bounds or NaN | Validate GPS data before submission |
| `NO_ROUTE_FOUND` | 404 | No pedestrian path connects the locations | Check if points are in walkable areas |
| `PERMISSION_DENIED` | 403 | API key missing or restricted | Verify Google Routes API key in Secrets |
| `QUOTA_EXHAUSTED` | 429 | Google Routes API rate limit exceeded | Retry with exponential backoff |
| `NETWORK_ERROR` | 500 | Network or timeout error during request | Fall back to offline route pack |

---

## 7. Live Google Routes API Verification

Live API access was verified on Google Cloud project `neighborhoodguideapp-35856` with Routes API key configured via Cloud Secret `GOOGLE_MAPS_ROUTES_API_KEY` (`AIzaSy...2rc`).

### Test Scenario: Malleshwaram Heritage Walk
- **Origin:** CTR Shri Sagar (`13.003185, 77.570258`)
- **Intermediate Stop:** Malleshwaram 8th Cross Flower Market (`13.00412, 77.57143`)
- **Destination:** Kadu Malleshwara Temple (`13.00725, 77.57189`)
- **Mode:** `WALK`
- **Stop Order Optimization:** `true`

### Live API Output:
- **HTTP Status:** 200 OK
- **Total Walking Distance:** 686 meters
- **Total Walking Duration:** 11 minutes (654 seconds)
- **Leg Count:** 2 legs
- **Polyline:** Generated High-Quality Encoded Polyline (`mujnAcmmxM...`)
- **`isMockData`:** `false`
- **Schema Validation:** `validateCanonicalRoute(doc)` passed with 0 errors.

---

## 8. Developer Handoffs

### For Developer D (Flutter Maps & Walking Route UI — Task D3)
- Render the polyline from `route.encodedPolyline` using `google_maps_flutter` Polyline overlay.
- Display `route.formattedDistance` and `route.formattedDuration` in the Route Summary Card.
- Display turn-by-turn navigation by iterating through `route.legs[i].steps[j].instruction`.
- When `route.isMockData === true`, display a subtle badge: "Estimated offline walking trail".

### For Developer A (Backend Persistence — Task A3)
- Store generated routes in Firestore collection `routes/{routeId}`.
- All fields strictly comply with `CanonicalRouteDocumentSchema`.
