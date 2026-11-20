# C6 — Maps, Places, Routes and Crowd Integration Testing Report

**Project:** Startup Buildathon India 2026 — InnovoTribe  
**Developer:** Developer C (Maps, Places, Routes, Capacity/Crowd Management & Dynamic Rerouting)  
**Task ID:** C6  
**Target Branch:** `feature/C6-maps-integration-tests`  
**Base Branch:** `main`  
**Date:** November 2026  
**Status:** PASS (All 23 integration tests passing; 220/220 backend test suite passing)

---

## 1. Executive Summary & Scope

Task C6 executes comprehensive end-to-end integration testing across all Maps, Places, Routes, Capacity, and Crowd Management capabilities built throughout Tasks C1 through C5.

### Subsystem Verification Scope
1. **C1 — Google Maps Platform & Places API (New):**
   - Text search (`PlacesService.searchText`) and spatial nearby search (`PlacesService.searchNearby`) with circular boundary restrictions.
   - Coordinate normalization to 6 decimal places (~0.1m precision) and WGS84 range validation.
   - Fault-tolerant URL parsing (`MapsUrlParserService`) extracting coordinates, CIDs, and place IDs.
   - API quota, timeout, and exponential backoff handling (`QuotaHandlerService`).

2. **C2 — Place Grounding & Discrepancy Evidence:**
   - Grounding local contributor submissions against authoritative Google Maps Places data (`GroundingService`).
   - Discrepancy detection (`NAME_MISMATCH`, `LOCATION_DISTANCE_HIGH`, `OPERATING_HOURS_MISMATCH`).
   - Tourist trap and authenticity scoring producing structured `PlaceGroundingEvidence` for Developer B's AI Authenticity pipeline (B3) and `CanonicalPlaceDocument` draft for Developer A (Domain 06).

3. **C3 — Walking Route Generation & Metrics:**
   - Single-leg and multi-stop walking route generation via Google Routes API (`RoutesService`).
   - Personalized walking pace adjustments (`RELAXED` 1.25x, `NORMAL` 1.0x, `BRISK` 0.85x duration multipliers) preserving metric distances.
   - Dynamic waypoint ordering, polyline generation, and leg segmentation adhering to `CanonicalRouteDocument` (Domain 08).

4. **C4 — Venue Capacity, Crowd Throttling & Alternatives:**
   - Hourly capacity evaluation and slot-level visit scheduling (`CrowdManagementService`).
   - Enforcement of Domain 07 4-bracket remaining capacity math (`LOW` > 60%, `MODERATE` 30-60%, `HIGH` 1-29%, `AT_CAPACITY` <= 0).
   - Capacity-aware walking route generation with automatic substitution and alternative venue discovery.

5. **C5 — Weather, Closures & Plan-B Dynamic Rerouting:**
   - Current weather condition evaluation vs. honest differentiation of unverified future forecasts (`WeatherService`).
   - In-route disruption handling for closed or weather-impaired stops (`PlanBReroutingService`).
   - True arrival time recalculation from start time and walking leg durations, preserving genuine venue names and propagating capacity uncertainty.

---

## 2. Test Matrix Covering All 10 Integration Flows

| # | Test Scenario / Flow | Implementation Component | Target Contract / Subsystem | Result | Execution Mode |
|---|----------------------|--------------------------|-----------------------------|:------:|:--------------:|
| **Test 1** | **Place Lookup** | `PlacesService` | Google Places API (New) | **PASS** | Mock Fallback (Keys Unconfigured) |
| 1.1 | Text search request & coordinate normalization | `searchText` | `NormalizedPlace`, WGS84 6 decimals | PASS | Mock Fixture |
| 1.2 | Nearby search with circular boundary constraint | `searchNearby` | `LocationRestriction`, `circle` | PASS | Mock Fixture |
| 1.3 | Strict credential enforcement | `PlacesService` | Missing API key with `allowMockFallback: false` throws | PASS | Deterministic Error Assertion |
| **Test 2** | **Place Grounding & Verification** | `GroundingService` | Developer A Domain 06 / Developer B Task B3 | **PASS** | Mock Fallback |
| 2.1 | Ground local contribution to canonical draft | `groundContributedPlace` | `PlaceGroundingEvidence`, `CanonicalPlaceDraft` | PASS | Mock Fixture |
| 2.2 | Distance discrepancy detection (> 500m) | `detectDiscrepancies` | `LOCATION_DISTANCE_HIGH`, `SUSPICIOUS` | PASS | Deterministic Math |
| 2.3 | Low confidence / unverified place flagging | `groundContributedPlace` | `AMBIGUOUS_MATCH` / `NO_MATCH`, `isVerified: false` | PASS | Deterministic Fixture |
| **Test 3** | **Walking Route Generation** | `RoutesService` | Google Routes API / Domain 08 | **PASS** | Mock Fallback |
| 3.1 | Canonical walking route generation with metrics | `generateWalkingRoute` | `CanonicalRouteDocument`, Polyline, Distance/Duration | PASS | Mock Geodesic Calculation |
| 3.2 | Rejection of routes with < 2 stops | `generateWalkingRoute` | `INSUFFICIENT_STOPS` error | PASS | Input Validation |
| **Test 4** | **Stop Sequencing & Walking Metrics** | `RoutesService` | Personalized Pacing / Legs | **PASS** | Synthetic Fixture |
| 4.1 | Personalized pace duration scaling | `getPaceMultiplier` | `RELAXED` (> 1.0x), `NORMAL` (1.0x), `BRISK` (< 1.0x) | PASS | Deterministic Duration Math |
| 4.2 | Intermediate waypoint & leg consistency | `generateWalkingRoute` | Ordered `RouteLeg` array & `waypointPlaceIds` | PASS | Multi-Stop Routing |
| **Test 5** | **Capacity & Crowd Management** | `CrowdManagementService` | Developer A Domain 07 / Scheduled Visits | **PASS** | In-Memory Engine & Fixture |
| 5.1 | Exact Domain 07 4-bracket threshold math | `calculateCrowdLevel` | Remaining capacity: >60%, 30-60%, 1-29%, <=0 | PASS | Mathematical Invariants |
| 5.2 | Hourly capacity evaluation (known vs unknown) | `evaluateVenueCapacity` | `CONFIRMED` vs `UNKNOWN`, UTC top-of-hour | PASS | Deterministic Records |
| 5.3 | Visit booking rejection at full capacity | `scheduleVisit` | Reject when remaining capacity <= 0 | PASS | Transactional Check |
| **Test 6** | **Alternatives & Plan-B Routing** | `PlanBReroutingService` | Disruption Rerouting / Plan-B | **PASS** | Integrated Pipeline |
| 6.1 | Reroute affected stop, preserve unaffected stops | `generatePlanBRoute` | Unaffected stops retained, genuine venue names preserved | PASS | Plan-B Recalculation |
| 6.2 | Sequential arrival time recalculation | `generatePlanBRoute` | Recalculated arrival times derived from leg durations | PASS | Dynamic Walking Timestamps |
| **Test 7** | **Weather & Closure Information** | `WeatherService` | Weather API / Disruption Grounding | **PASS** | Deterministic Weather Model |
| 7.1 | Current weather vs future unverified forecast | `getWeatherForLocation` | Hourly observation vs unverified future warning | PASS | Timestamp Analysis |
| 7.2 | Condition UNAVAILABLE on missing credentials | `getWeatherForLocation` | `isAvailable: false`, condition `UNAVAILABLE` | PASS | Fail-Closed Fallback |
| **Test 8** | **Failure & Degraded-Mode Handling** | `QuotaHandlerService` | Resilience & Error Classification | **PASS** | Transient Fault Simulation |
| 8.1 | Error classification by HTTP status code | `classifyError` | 403 (Permanent), 429 (Retryable), 503 (Retryable) | PASS | Error Classification |
| 8.2 | Exponential backoff and retry success | `executeWithRetry` | Succeeded after transient simulated 503 errors | PASS | Async Retry Loop |
| 8.3 | Fail-fast on non-retryable 403 error | `executeWithRetry` | No retry on `PERMISSION_DENIED` | PASS | Fast-Failure Path |
| **Test 9** | **Client-Facing Integration Contract** | `contracts.ts` | Mobile / AI Shared Schemas | **PASS** | Schema Validation |
| 9.1 | Strict CanonicalRouteDocument compliance | `validateCanonicalRoute` | All Domain 08 fields (origin, destination, polyline, legs) | PASS | Runtime Zod / Assertion |
| 9.2 | Rich structured PlanBExplanationContext | `PlanBExplanationContext` | `triggerReason`, `originalStop`, `alternativeStop`, delta | PASS | AI Consumption Schema |
| **Test 10** | **End-to-End Pipeline Execution** | Multi-Service Integration | Complete Discovery to Plan-B Loop | **PASS** | End-to-End Integration |
| 10.1 | Full workflow execution | End-to-End | Grounding -> Routing -> Capacity -> Disruption -> Plan-B | PASS | Multi-Service Pipeline |

---

## 3. Live API Integration vs. Mock-Backed Execution

### Environment Credential Status
- Environment variables: `GOOGLE_MAPS_API_KEY`, `PLACES_API_KEY`, `ROUTES_API_KEY`, `WEATHER_API_KEY` are not provisioned in the local development/CI environment (`.env` is unpopulated; `.env.example` provides templates).
- Because no live secrets are injected into the workspace, **no live HTTP requests were made to Google Maps Platform endpoints**.
- In strict adherence to project ground rules, **mock data is never reported as live API data**. All responses generated during test execution explicitly set `isMockData: true` and are flagged with deterministic sample fixtures.

### Live API Call Readiness & Production Switching
Every service (`PlacesService`, `RoutesService`, `WeatherService`, `GroundingService`, `PlanBReroutingService`) is engineered with full live API client code:
1. **Google Places API (New):**
   - Endpoints: `https://places.googleapis.com/v1/places:searchText`, `https://places.googleapis.com/v1/places:searchNearby`, `https://places.googleapis.com/v1/places/{placeId}`.
   - Header: `X-Goog-Api-Key` and `X-Goog-FieldMask: places.id,places.displayName,places.formattedAddress,places.location,places.primaryType,places.types,places.regularOpeningHours,places.currentOpeningHours,places.rating,places.userRatingCount,places.googleMapsUri`.
2. **Google Routes API:**
   - Endpoint: `https://routes.googleapis.com/directions/v2:computeRoutes`.
   - Headers: `X-Goog-Api-Key`, `X-Goog-FieldMask: routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline,routes.legs,routes.optimizedIntermediateWaypointIndex`.
   - Travel mode: `WALK`, polyline quality: `HIGH_QUALITY`.
3. **Google Maps Platform Weather API:**
   - Endpoint: `https://weather.googleapis.com/v1/currentConditions:lookup` and `forecast/hourly:lookup`.
   - Header: `X-Goog-Api-Key`.
4. **Credential Activation:**
   - When valid Google Maps Platform API keys are injected into Firebase Secret Manager or the local `.env` file, the services automatically detect the non-empty key, skip mock fallback, and issue genuine live network calls with automatic retries and exponential backoff via `QuotaHandlerService`.

---

## 4. Cross-Developer Contract Compliance

### Alignment with Developer A (Shared Backend, Security & Persistence)
- **Domain 06 (`CanonicalPlaceDocument`):**
  - Canonical places generated by `GroundingService` strictly include `id`, `placeId`, `spotName`, `formattedAddress`, normalized `coordinate` (with 6-decimal precision and format `lat, lng`), `primaryCategory`, `categories`, `authenticity`, and `capacity`.
  - Discrepancy evidence correctly flags unverified submissions when match confidence is low (`isVerified: false`).
- **Domain 07 (`VenueHourlyCapacityDocument` & Scheduled Visits):**
  - Capacity calculation implements the exact mathematical 4-bracket rule: `LOW` (> 60%), `MODERATE` (30%–60%), `HIGH` (1%–29%), `AT_CAPACITY` (<= 0).
  - Slot IDs format strictly as `${placeId}_${hourSlotUtc}` at top-of-hour UTC.
  - Visit scheduling enforces remaining capacity checks and prevents overbooking.
- **Domain 08 (`CanonicalRouteDocument`):**
  - Output documents strictly conform to Developer A's schema: `routeId`, `title`, `neighborhood`, `theme`, `origin`, `destination`, `waypoints`, `waypointPlaceIds`, `totalDistanceMeters`, `totalDurationSeconds`, `formattedDistance`, `formattedDuration`, `encodedPolyline`, `legs`, `isMockData`, `createdAt`, `updatedAt`.

### Alignment with Developer B (AI Grounding & Authentic Recommendations)
- `PlaceGroundingEvidence` output provides structured signals (`touristTrapSignals`, `authenticitySignals`, `discrepancies`, `preliminaryAuthenticityRecommendation`) consumed directly by Developer B's Task B3 AI Authenticity Assessment.
- `PlanBExplanationContext` delivers rich structured context (`triggerReason`, `weatherCondition`, `originalStop`, `alternativeStop`, `durationDeltaSeconds`, `distanceDeltaMeters`, `preservedStopCount`, `totalStopCount`, `crowdNotice`) enabling Developer B's Task B4 dynamic reroute AI narration without halluncinating place names or details.

### Alignment with Developer D (Mobile Application & Flutter Client)
- All walking durations respect personalized traveler walking paces (`RELAXED`, `NORMAL`, `BRISK`).
- Route legs and turn-by-turn steps include human-readable instructions and coordinate endpoints suitable for client map rendering (e.g., Google Maps Flutter plugin polyline and markers).
- Client-facing callable endpoints handle errors gracefully with typed error codes (`INSUFFICIENT_STOPS`, `INVALID_COORDINATES`, `VENUE_AT_CAPACITY`, `REJECTED_UNKNOWN`).

---

## 5. Known Limitations & Production Recommendations

1. **Production Google Maps API Keys:**
   - Ensure Maps API keys have appropriate API restrictions (restricted to Places API New, Routes API, and Weather API) and application restrictions (IP address restriction for Cloud Functions 2nd Gen, SHA-1 fingerprint for Android release keystore).
2. **Quota Management & Billing Budgets:**
   - Google Places API (New) charges per field mask category (Essentials, Pro, Enterprise). Ensure field masks in `PlacesService` only request required fields (`places.id`, `places.displayName`, `places.location`, etc.) to minimize billing overhead.
   - Configure Google Cloud budget alerts at 50%, 75%, and 90% of expected monthly spend.
3. **Weather Forecast Horizon:**
   - Weather forecasts beyond 24 hours must remain labeled as unverified forecasts, as short-term urban walking microclimates are volatile. Real-time Plan-B rerouting should always be re-evaluated within 15–30 minutes of intended walking departure.
4. **Offline Neighborhood Packs:**
   - For offline execution (Task D5/C1/C3), pre-downloaded GeoJSON routes and Drift/SQLite cached place documents should be utilized directly when device connectivity is lost.

---

## 6. Verification Commands & Reproducibility

To run the dedicated C6 Maps Integration Test Suite:
```bash
npm --prefix functions run test:maps-integration
```

To run all Maps unit, functional, and integration tests across Tasks C1–C6:
```bash
npm --prefix functions run test:maps
```

To run the entire Firebase Cloud Functions backend test suite (220 tests):
```bash
npm --prefix functions test
```

To verify TypeScript build and strict type compliance:
```bash
npm --prefix functions run lint
npm --prefix functions run build
```
