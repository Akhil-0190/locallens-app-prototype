# Task C5: Weather, Closures and Plan-B Rerouting

**Task ID:** C5  
**Developer:** Developer C (Maps, Location, Routes & Crowd Management)  
**Branch:** `feature/C5-plan-b-rerouting`  
**Dependencies:** C3 Routes Engine, C4 Capacity & Crowd Management, Domain 07 & Domain 08 Contracts  
**Date:** 2026-11-20

---

## 1. Scope & Responsibility

Task C5 implements weather evaluation, closure signal processing, and dynamic **Plan-B walking route recalculation**:
1. **Weather Integration:** Connects with Google Maps Platform Weather API client specifications, normalizing weather conditions (clear, cloudy, drizzle, heavy rain, thunderstorm, extreme heat), calculating walking impairment, and generating advisories.
2. **Closure Signals:** Ingests operational status from Google Places and community reports, distinguishing confirmed closures, unscheduled repairs, and published opening hours conflicts.
3. **Plan-B Route Recalculation:** When a route is disrupted:
   - Identifies affected stops while strictly preserving unaffected stops and genuine venue names.
   - Searches grounded, capacity-checked alternatives using C4 `CrowdManagementService.findAlternativesForVenue()`.
   - Derives arrival times strictly from route start time and actual leg durations.
   - Re-evaluates subsequent arrival times and C4 hourly capacity slot limits (`slot_YYYYMMDD_HH00`) after detours.
   - Recalculates the complete multi-stop walking route via C3 `RoutesService.generateWalkingRoute()` to ensure genuine polyline, distance, duration, legs, and steps.
4. **Structured Explanation Context:** Produces a typed `PlanBExplanationContext` designed specifically for Developer B (Gemini Live / AI) to provide conversational, fact-grounded travel assistance.
5. **Agent Skill:** Formalizes `skills/plan-b-rerouting/SKILL.md` following Google Agent Skill standards with valid YAML frontmatter.

---

## 2. Weather & Forecast Limitations (Addressing Review Finding A5 & B2)

To preserve honesty and prevent ungrounded decision-making:
- **Current Conditions vs Forecast:**
  - Google Maps Platform Weather API's `/currentConditions:lookup` endpoint returns **real-time weather observations** for the current hour.
  - When evaluating future visits (> 2 hours ahead), current conditions must **never** be presented as confirmed forecast data. The response explicitly flags `dataType: 'CURRENT'` with an advisory: `"Current conditions retrieved; future forecast unverified."`
  - When true forecast endpoints are unavailable or unconfigured, the system marks conditions as `UNAVAILABLE` rather than defaulting to `CLEAR`.
- **Honest Uncertainty on Missing Credentials:**
  - If API credentials are missing, API calls fail, or responses are malformed, `WeatherService` returns `condition: 'UNAVAILABLE'` (`dataType: 'UNAVAILABLE'`). It never defaults to `CLEAR`.

---

## 3. Arrival Times & C4 Capacity Synchronization (Findings B3, B4, B5)

- **Elimination of Arbitrary Increments:** The system no longer uses fixed arbitrary increments (e.g., 20 minutes).
- **Leg Duration Derivation:** Each stop's arrival time is computed strictly as:
  $$\text{Arrival}_{i} = \text{Arrival}_{i-1} + \text{VisitDuration}_{i-1} + \text{LegDuration}(\text{Stop}_{i-1} \rightarrow \text{Stop}_{i})$$
- **Detour Recalculation:** When a stop is substituted with an alternative, the route is recalculated through `RoutesService`, obtaining updated leg walking durations.
- **Capacity Re-evaluation:** C4 capacity checks for all subsequent stops are re-run against the **updated arrival time slot**, ensuring that detour delays that push a visit across an hour boundary (e.g., 08:50 $\rightarrow$ 09:10) evaluate the correct hourly capacity slot (`slot_YYYYMMDD_0900`).

---

## 4. Test Verification Summary

Automated tests cover all required scenarios (`functions/src/maps/tests/plan-b.test.ts`):
- **Weather Evaluation:** Clear weather baseline, heavy rain walking impairment, extreme heat advisory, honest `UNAVAILABLE` reporting when API is unconfigured (no false `CLEAR`), future visit forecast distinction.
- **Closure Detection:** Sanctum rituals closure detection, replacement with grounded alternative, preservation of unaffected stops and genuine venue names.
- **Capacity Saturation:** Hourly visitor limits triggering C4 alternative substitution.
- **Unknown Capacity Propagation:** Replacement with `UNKNOWN` capacity propagates `hasCapacityUncertainty = true` and updates `crowdNotice`.
- **Leg-Duration Driven Arrival Times:** Recalculates arrival times from actual leg durations and re-checks C4 capacity at new times.
- **Route Recalculation:** Genuine Routes API polyline and metric computation, rich explanation context generation, invalid input rejection, and explicit `isMockData: true` labeling.

### Full Test Suite Run
```bash
npm --prefix functions test
```
**170 tests across 45 suites** pass with 0 failures, 0 skipped.
