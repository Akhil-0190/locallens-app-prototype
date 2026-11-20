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
   - Identifies affected stops while strictly preserving unaffected stops.
   - Searches grounded, capacity-checked alternatives using C4 `CrowdManagementService.findAlternativesForVenue()`.
   - Re-evaluates arrival times and capacity slot limits (`slot_YYYYMMDD_HH00`).
   - Recalculates the complete multi-stop walking route via C3 `RoutesService.generateWalkingRoute()` to ensure genuine polyline, distance, duration, legs, and steps.
4. **Structured Explanation Context:** Produces a typed `PlanBExplanationContext` designed specifically for Developer B (Gemini Live / AI) to provide conversational, fact-grounded travel assistance.
5. **Agent Skill:** Formalizes `skills/plan-b-rerouting/SKILL.md` following Google Agent Skill standards.

---

## 2. Service Architecture

```
[PlanBRerouteRequest]
         │
         ▼
[PlanBReroutingService]
    ├─► WeatherService (Google Maps Platform Weather API lookup & normalization)
    ├─► PlacesService / Fixtures (Closure & opening hours detection)
    ├─► CrowdManagementService (C4 capacity evaluation & alternative discovery)
    └─► RoutesService (C3 genuine walking route recalculation & polylines)
         │
         ▼
[PlanBRerouteResponse]
    ├─► Updated CanonicalRouteDocument (Domain 08)
    ├─► StopAlterationRecord[] (RETAINED, REPLACED, SKIPPED)
    └─► PlanBExplanationContext (Structured facts for Developer B / AI)
```

---

## 3. Test Verification Summary

Automated tests cover all required scenarios (`functions/src/maps/tests/plan-b.test.ts`):
- **Weather Evaluation:** Clear weather baseline, heavy rain walking impairment, extreme heat advisory, honest reporting when API is unconfigured.
- **Closure Detection:** Sanctum rituals closure detection, replacement with grounded alternative, preservation of unaffected stops.
- **Weather Disruption:** Severe monsoon rain triggering indoor-preferred rerouting.
- **Capacity Saturation:** Hourly visitor limits triggering C4 alternative substitution.
- **Route Recalculation:** Genuine Routes API polyline and metric computation, rich explanation context generation, invalid input rejection, and explicit `isMockData: true` labeling.

### Full Test Suite Run
```bash
npm --prefix functions test
```
**170 tests across 45 suites** pass with 0 failures, 0 skipped.
- C5 focused tests: 12/12 passed
- C4 crowd management tests: 25/25 passed
- C3 walking route tests: 8/8 passed
- C1–C2 maps & grounding tests: 25/25 passed
- A1–A4 backend foundation tests: 100/100 passed
