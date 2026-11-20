---
name: plan-b-rerouting
description: Dynamically recalculates personalized walking routes when disruptions (severe weather, closures, or crowd throttling) occur, selecting grounded alternatives and recalculating genuine polylines and arrival times.
---

# Plan-B Rerouting Skill

**Name:** plan-b-rerouting  
**Domain:** Dynamic Walking Route Adaptation, Capacity Throttling & Weather/Closure Mitigation  
**Primary Ownership:** Developer C (Routing & Infrastructure) & Developer B (AI Interpretation)  
**Status:** Active  

---

## 1. Overview & Purpose

The **Plan-B Rerouting Skill** enables the agent to dynamically recalculate and adapt a traveler's walking itinerary when an unexpected disruption occurs on the ground:
1. **Severe Weather Events:** Heavy monsoon rainfall, waterlogging, or extreme heat advisories.
2. **Venue Closures:** Scheduled afternoon temple sanctum closures, unscheduled repairs, or holiday closures.
3. **Crowd Saturation:** Narrow heritage spots and food stalls reaching hourly visitor limits (`AT_CAPACITY`, `isThrottled = true`).

Rather than returning a disconnected list of place recommendations or abandoning the trip, Plan-B:
- Evaluates which specific stops are impacted.
- Preserves all unaffected stops and original venue identities.
- Selects verified, capacity-checked alternative venues within reasonable walking proximity.
- Dynamically recalculates the complete multi-stop walking route using Google Routes API / C3 walking engine.
- Recomputes subsequent arrival times from regenerated route leg durations, re-checking C4 hourly capacity at updated times.
- Generates a structured explanation context for conversational guidance (e.g., via Gemini Live or voice co-pilot).

---

## 2. Trigger Conditions

Plan-B should be triggered automatically or via a one-tap traveler action when:
- A venue in the active walking itinerary reports `isClosed = true` or is outside current opening hours.
- A venue's hourly capacity reaches saturation (`remainingCapacity <= 0`).
- Google Maps Platform Weather API reports severe weather (`HEAVY_RAIN`, `THUNDERSTORM`, or `EXTREME_HEAT`).
- The traveler explicitly requests: *"Find me a plan B"* or *"It's pouring rain, where should we go instead?"*

---

## 3. Technical Service Pipeline

```
[Disruption Input] 
       │
       ▼
[Stop Disruption Evaluator] ──► Identify affected stop indices & genuine venue names
       │
       ▼
[C4 Alternatives Discovery] ──► Query grounded spots & evaluate capacity
       │
       ▼
[Itinerary Reconstruction]  ──► Retain unaffected stops, swap disrupted stops
       │
       ▼
[C3 Routes Recalculation]   ──► Recompute walking polyline, metric distance & duration
       │
       ▼
[Arrival Time & C4 Update]  ──► Recalculate subsequent arrival times via leg durations
       │
       ▼
[Plan-B Response & Context] ──► Return CanonicalRouteDocument + PlanBExplanationContext
```

---

## 4. Input & Output Schemas

### Input: `PlanBRerouteRequest`
- `originalRoute`: CanonicalRouteDocument (Domain 08)
- `disruptions`: Array of `PlanBDisruption` (`type`, `affectedPlaceId`, `severity`, `description`)
- `walkingPace`: `'RELAXED' | 'NORMAL' | 'BRISK'` (defaults to `'NORMAL'`)
- `preferredIndoorAlternatives`: boolean (prioritize covered/indoor spots during rain)
- `stopVisitDurationsMinutes`: Optional per-place visit duration mapping

### Output: `PlanBRerouteResponse`
- `rerouteId`: Unique identifier for the reroute session
- `originalRouteId`: Reference to parent route
- `updatedRoute`: CanonicalRouteDocument with new polyline, legs, steps, and metrics
- `alterations`: Array of `StopAlterationRecord` (`action`: `RETAINED | REPLACED | SKIPPED`)
- `explanationContext`: Structured facts for Gemini Live natural language explanation:
  - `summary`: High-level summary of the change
  - `primaryDisruption`: Root cause
  - `replacedStops`: List of `{ from, to, reason }`
  - `distanceDeltaMeters`: Change in walking distance
  - `durationDeltaSeconds`: Change in walking time

---

## 5. Behavioral Safeguards & Honesty Rules

1. **No Hallucinated Places:** Alternatives must come from verified candidate places with grounded coordinates.
2. **No False Availability:** If an alternative's capacity record is missing, it is labeled `UNKNOWN`, setting `hasCapacityUncertainty = true` and adding a warning to `crowdNotice`.
3. **No Discarding Unaffected Stops:** Unaffected traveler stops must be preserved in the itinerary with their real venue names.
4. **Leg & Polyline Consistency:** The returned route must have a recalculated polyline matching the actual updated stop sequence, and arrival times must be derived from actual leg durations.
