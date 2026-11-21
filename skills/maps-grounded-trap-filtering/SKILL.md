---
name: maps-grounded-trap-filtering
description: Synthesizes Google Maps Places API evidence with contributor narratives to evaluate authenticity, filter commercial tourist traps, and generate safety disclosures.
---

# Maps-Grounded Trap Filtering Skill

**Name:** maps-grounded-trap-filtering  
**Domain:** Venue Authenticity Assessment, Commercial Trap Detection & Safety Disclosures  
**Primary Ownership:** Developer B (AI Assessment) & Developer C (Maps Grounding & Evidence)  
**Status:** Active  

---

## 1. Overview & Purpose

The **Maps-Grounded Trap Filtering Skill** bridges spatial map data and AI narrative analysis to protect travelers from commercialized tourist traps, aggressive touting, and counterfeit heritage experiences:
1. **Spatial Evidence Synthesis:** Ingests Developer C's `PlaceGroundingEvidence` (Google Places API match, coordinate discrepancy check, review velocity, and business status).
2. **Authenticity Scoring:** Evaluates generational continuity, local resident patronage, traditional culinary equipment, and cultural fidelity.
3. **Tourist-Trap Risk Scoring (0–100):** Distinguishes genuinely beloved heritage institutions (which may have long lines and high tourist popularity) from commercial tourist traps (multi-chain outlets, aggressive street touts, inflated pricing, commission kickbacks).
4. **Safety & Hygiene Verification:** Formulates clear, evidence-based safety notices. Fails safe without making unfounded or disparaging accusations.

---

## 2. Trigger Conditions

This skill is invoked during the spot verification and pocket guide compilation pipeline (`Task A3 / B3 / C2`):
- After a newly contributed spot is spatial-grounded against Google Maps Platform (`groundContributedPlace`).
- When a traveler requests pocket guide recommendations filtered for high authenticity.
- When an active route includes an unverified spot requiring authenticity verification prior to inclusion.

---

## 3. Technical Service Pipeline

```
[Place Grounding Evidence] (from C2 Google Places API)
       │
       ▼
[Narrative Extraction] (from B2 Contributor Voice Note)
       │
       ▼
[Authenticity Assessment Engine] ──► Gemini Flash Assessment Model
       │
       ├─────────────────────────────────┼─────────────────────────────────┐
       ▼                                 ▼                                 ▼
[Authenticity Rating]          [Tourist Trap Risk]               [Safety & Hygiene]
(LOCAL_LEGEND, etc.)           (Price Inflation, Touting)        (Factual Disclosures)
       │                                 │                                 │
       └─────────────────────────────────┼─────────────────────────────────┘
                                         ▼
                     [Canonical Authenticity Enrichment] ──► CanonicalPlaceDocument
```

---

## 4. Input & Output Contract

### Input Parameters
- `placeName`: Name of the candidate venue.
- `groundingEvidence`: `PlaceGroundingEvidence` object (Google Place ID, coordinate distance delta, review count, rating, price level).
- `voiceExtraction`: `ExtractedPracticalDetails` from the contributor audio note.
- `photos`: Visual indicators from multimodal photo analysis (`hasGenerationalOrTraditionalSignage`, `hasTraditionalCulinaryEquipment`).

### Output Structure (`PlaceAuthenticityEnrichment`)
- `authenticityScore`: Integer rating (0 to 100).
- `authenticityBadge`: `'EXPERT_CURATED'` | `'HYPERLOCAL'` | `'COMMUNITY_VERIFIED'` | `'UNDER_REVIEW'`.
- `touristTrapRisk`:
  - `riskScore`: Integer (0 to 100, where higher indicates higher trap probability).
  - `isTouristTrapRisk`: boolean (true if riskScore >= 70).
  - `trapIndicators`: Detected commercial factors (e.g. corporate chain, aggressive touting, price markups).
- `safetyDisclosures`: Evidence-backed safety and hygiene observations.
- `curatorSummary`: Concise synthesis explaining why the spot is or is not authentic.

---

## 5. Representative Examples

### Example 1: Authentic Heritage Darshini (Positive Grounded Case)
* **Input:** Brahmin Coffee Bar (Shankarapuram), Google Place ID `places/ChIJb9x1`, coordinate delta 12m, 18,500 reviews, rating 4.6, inexpensive budget tier, traditional copper filter boiler photo.
* **Output:**
  - `authenticityScore`: `88 / 100`
  - `authenticityBadge`: `'HYPERLOCAL'`
  - `touristTrapRisk`: `{ riskScore: 15, isTouristTrapRisk: false, trapIndicators: [] }`
  - `recommendationVerdict`: `'STRONGLY_RECOMMENDED'`
  - `curatorSummary`: `"Generational breakfast landmark with sustained local resident patronage and verified spatial grounding. Authentic heritage standing counter."`

### Example 2: Commercial Tourist Trap / Counterfeit Storefront (Negative Flagged Case)
* **Input:** Counterfeit Darshini claiming heritage legacy, coordinate delta 1,420m from submitted pin, 42 reviews, rating 3.1, touting reports.
* **Output:**
  - `authenticityScore`: `20 / 100`
  - `authenticityBadge`: `'UNDER_REVIEW'`
  - `touristTrapRisk`: `{ riskScore: 78, isTouristTrapRisk: true, trapIndicators: ["Severe coordinate discrepancy (1420m)", "Counterfeit brand mimicry"] }`
  - `recommendationVerdict`: `'FLAGGED_TOURIST_TRAP'`
  - `safetyDisclosures`: `["WARNING: Location mismatch detected between submitted audio and Google Maps coordinates. High counterfeit risk."]`

### Example 3: Missing Spatial Evidence Case
* **Input:** Unregistered street flower stall without Google Maps Places grounding evidence.
* **Output:**
  - `authenticityScore`: `35 / 100`
  - `authenticityBadge`: `'UNDER_REVIEW'`
  - `recommendationVerdict`: `'UNVERIFIED_PENDING_GROUNDING'`
  - `evidenceSynthesis.mapsEvidenceStatus`: `'MISSING_EVIDENCE'`
  - `safetyDisclosures`: `["Location has not yet been confirmed via Google Maps Places API."]`

---

## 6. Behavioral Safeguards & Honesty Rules

1. **No Phantom Coordinates:** If Google Places does not return a matching location, the venue is marked `MISSING_EVIDENCE` rather than guessing nearby coordinates.
2. **Coordinate Delta Enforcement:** If the distance delta between the contributor's coordinate pin and Google Places exceeds 500m, it is automatically flagged as `SUSPICIOUS` and penalized.
3. **Evidence-Backed Safety Warnings:** Safety and hygiene disclosures must cite concrete evidence (e.g. "standing alley without handwashing sink"), avoiding unsubstantiated slander.

---

## 7. Execution Engine & Programmatic Service

* **TypeScript Implementation:** `functions/src/ai/skills/skill-trap-filtering.ts`
* **Firebase Callable:** `Skills-executeTrapFiltering`
* **Test Verification:** Verified via deterministic tests in `functions/test/test-b7-agent-skills.ts` (Suite 2).
