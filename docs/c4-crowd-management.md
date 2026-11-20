# Task C4: Venue Capacity, Crowd Throttling and Alternatives

**Task ID:** C4  
**Developer:** Developer C (Maps, Location, Routes & Crowd Management)  
**Branch:** `feature/C4-crowd-management`  
**Dependencies:** A4 Capacity Backend (`functions/src/capacity/capacity-service.ts`, Domain 07 Contracts)  
**Date:** 2026-11-20

---

## 1. Scope & Responsibility

Task C4 implements capacity-aware routing, crowd management, and alternative place recommendation for the street companion:
1. **Hourly Capacity Evaluation:** Evaluates hourly capacity limits and remaining allocations across time slots.
2. **Visit Scheduling Coordination:** Integrates with Developer A's transaction-safe booking engine (`bookScheduledVisit`).
3. **Crowd Throttling & Rotation:** Detects saturated venues (`isThrottled = true`, `remainingCapacity <= 0`), suggests alternative time slots on the same day, and rotates recommendations away from crowded hotspots.
4. **Capacity-Aware Walking Routes:** Enhances multi-stop walking route generation to evaluate stop arrival times against hourly capacity limits, automatically substituting full stops with grounded alternatives when requested.
5. **Honest Uncertainty:** Clearly distinguishes confirmed available (`AVAILABLE`), confirmed full (`AT_CAPACITY`), explicitly unavailable (`UNAVAILABLE`), and unknown (`UNKNOWN`). Missing records are never assumed to be available.
6. **Mock vs Live Distinction:** All sample fixtures and fallbacks are explicitly tagged with `isMockData: true`.

---

## 2. Canonical Contracts & Domain Alignment

C4 directly consumes and adheres to **Domain 07 Canonical Contracts** (`docs/contracts/07-venue-capacity-and-alternatives.md`):

### 4-Bracket Remaining Capacity Thresholds
$$\text{remainingPercentage} = \frac{\text{remainingCapacity}}{\text{maxCapacity}} \times 100$$

| Crowd Level | Remaining Percentage Range | `isThrottled` | Description |
| :--- | :---: | :---: | :--- |
| **LOW** | $> 60.0\%$ | `false` | Green: Spacious & authentic |
| **MODERATE** | $30.0\% \le \text{pct} \le 60.0\%$ | `false` | Yellow: Moderate crowd |
| **HIGH** | $0\% < \text{pct} < 30.0\%$ | `false` | Orange: Busy — visit recommended later |
| **AT_CAPACITY** | $\le 0\%$ | `true` | Red: Throttled — redirect to Plan-B alternative |

### UTC Top-of-the-Hour Slot Invariant
- Slots are strictly aligned to UTC top-of-the-hour: `slot_YYYYMMDD_HH00`.
- Display times in local time zones (e.g. `Asia/Kolkata` -> `19:30 - 20:30 IST`) are derived for human presentation.

---

## 3. Architecture & Service Breakdown

### `CrowdManagementService` (`functions/src/maps/services/crowd-management.service.ts`)
- `evaluateVenueCapacity`: Evaluates capacity for a place and time slot from Firestore or labeled fixtures. Returns `VenueCapacityEvaluation`.
- `findAlternativesForVenue`: Discovers grounded alternatives using suggested alternatives from the venue capacity record or proximity searches via `PlacesService`.
- `evaluateRouteStops`: Batch-evaluates multiple candidate stops, returning recommended actions (`PROCEED`, `ROTATE_TO_ALTERNATIVE`, `RESCHEDULE_SLOT`, `PROCEED_WITH_UNKNOWN`).
- `findAlternativeTimeSlots`: Discovers available time slots (+1h, +2h, etc.) on the same day when a venue is full in the intended slot.
- `scheduleVisit`: Coordinates with backend `bookScheduledVisit` using deterministic idempotency keys (`visitId = "visit_" + sha256(travelerId + ":" + idempotencyKey).slice(0, 20)`).
- `generateCapacityAwareRoute`: Generates walking routes via `RoutesService`, evaluating arrival times against capacity, and substituting full stops with grounded alternatives.

---

## 4. Test Verification Summary

Automated tests cover all 25 minimum required scenarios (`functions/src/maps/tests/crowd-management.test.ts`):
- **Capacity Representation:** Valid records, variable capacities across hours, unknown capacity handling, invalid timestamp handling, exact 4-bracket threshold math.
- **Visit Scheduling:** Successful booking, rejection when full, party size exceeding remaining capacity, rejection of unknown capacity without mock fallback, slotId derivation.
- **Crowd Throttling & Rotation:** Full venue exclusion, re-evaluation at later hours, alternative time slot discovery, nearby alternative options, unknown capacity preservation.
- **Capacity-Aware Routes:** Walking route generation with capacity checks, auto-substitution of full stops, retention of full stops with warnings when auto-substitution is disabled, mixed confirmed/unknown routes, preservation of C3 route metrics and polylines.
- **Backend Boundaries & Failures:** Graceful retrieval failure handling, transactional booking failure propagation, stop count validation, `isMockData: true` validation, and JSON serialization.

### Test Execution Command
```bash
npm --prefix functions test
```
All **158 tests across 39 suites** pass with 0 failures, 0 skipped.
