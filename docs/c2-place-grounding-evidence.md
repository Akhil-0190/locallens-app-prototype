# Task C2 — Place Grounding & Verification Evidence

**Task ID:** C2  
**Task Name:** Place Grounding and Verification Evidence  
**Owner:** Developer C (Maps Platform, Grounding, Routes & Crowd Management)  
**Stakeholders:** Developer B (AI Authenticity Assessment - Task B3), Developer A (Canonical Persistence - Task A3), Developer D (Flutter Client)  
**Branch:** `feature/C2-place-verification`  
**Date:** November 20, 2026  

---

## 1. Overview & Architecture

Task C2 bridges unstructured local contributor submissions (Google Maps links, neighborhood hints, claimed hours, photo/device coordinates) with verified Google Maps Platform facts (`places:searchText`, `getPlaceDetails`).

It produces two unified deliverables:
1. **`PlaceGroundingEvidence`:** A rich, structured evidence document consumable by Developer B's Gemini 3.8 Flash pipeline (Task B3) for authenticity scoring, tourist trap likelihood detection, and sentiment synthesis.
2. **`CanonicalPlaceDocument` Draft:** A fully validated draft document conforming to Developer A's canonical Domain 06 contract (`validateCanonicalPlace()`), ready for persistence in Firestore `places/{placeId}` by Developer A (Task A3).

```
Contributor Submission (D1/D2)
       │
       ▼
MapsUrlParserService ──► Extracts Place ID, CID, or Coordinates from URL
       │
       ▼
GroundingService (C2) ──► Queries Places API (New) (Live or Sample Fixture)
       │
       ├─────────────────────────────────┬─────────────────────────────────┐
       ▼                                 ▼                                 ▼
Match Confidence                Discrepancy Engine             Signal Extraction
(EXACT / HIGH / AMBIGUOUS)     (Distance, Hours, Names)     (Trap vs. Authenticity)
       │                                 │                                 │
       └─────────────────────────────────┼─────────────────────────────────┘
                                         ▼
                             PlaceGroundingEvidence (For B3)
                                         │
                                         ▼
                          CanonicalPlaceDocument Draft (For A3/D)
```

---

## 2. Evidence Interface Specification (For Developer B — Task B3)

Developer B can import the evidence models directly from `src/maps`:

```typescript
import {
  PlaceGroundingEvidence,
  EvidenceDiscrepancy,
  TouristTrapSignalsEvidence,
  AuthenticitySignalsEvidence,
} from '../maps';
```

### Data Contract: `PlaceGroundingEvidence`

| Field | Type | Description |
| :--- | :--- | :--- |
| `evidenceId` | `string` | Unique evidence identification UUID. |
| `matchConfidence` | `'EXACT_MATCH' \| 'HIGH_CONFIDENCE' \| 'AMBIGUOUS_MATCH' \| 'NO_MATCH'` | Confidence classification. |
| `matchScore` | `number` (0.0 to 1.0) | Quantitative match certainty score. |
| `matchedPlace` | `NormalizedPlace \| null` | Verified Google Maps venue details (address, coordinates, hours, ratings). |
| `candidatePlaces` | `NormalizedPlace[]` | Top Google Places search results for ambiguity resolution. |
| `discrepancies` | `EvidenceDiscrepancy[]` | Detected factual conflicts between contributor submission and Google Maps. |
| `touristTrapSignals` | `TouristTrapSignalsEvidence` | High-review/low-rating, commercial chain, or touting indicators. |
| `authenticitySignals` | `AuthenticitySignalsEvidence` | Traditional category, generational recipe, historic alleyway markers. |
| `preliminaryAuthenticityRecommendation` | `{ suggestedTrapLikelihood, preliminaryScore, rationale }` | Baseline heuristic score (0–100) and recommendation for Gemini 3.8 Flash. |
| `sources` | `EvidenceSource[]` | Explicit provenance tracking (`GOOGLE_PLACES_API_NEW`, `LOCAL_CONTRIBUTOR_SUBMISSION`, `SAMPLE_FIXTURE_DATA`). |
| `isMockData` | `boolean` | True if grounded against sample fixtures; false if live Google Maps API. |

---

## 3. Discrepancy Detection & Severity Classification

| Discrepancy Type | Trigger Condition | Severity | Impact on Authenticity Score |
| :--- | :--- | :--- | :--- |
| `NAME_MISMATCH` | Contributor spot name differs from Maps `displayName` | `INFORMATIONAL` | Flagged for AI dialect check; vernacular names accepted. |
| `LOCATION_DISTANCE_HIGH` | Contributor GPS fix is 200m–500m from venue | `INFORMATIONAL` | Coordinate drift recorded. |
| `LOCATION_DISTANCE_HIGH` | Contributor GPS fix is > 500m from venue | `SUSPICIOUS` | Deducts 15 points; flags possible spoofing or wrong pin. |
| `OPERATING_HOURS_MISMATCH` | Contributor claims "late night" but Maps shows 9:30 PM closing | `INFORMATIONAL` | Prompts Gemini to check whether night service is informal/street cart. |
| `MISSING_HOURS_ON_MAPS` | Venue has no regular hours listed on Google Maps | `INFORMATIONAL` | Typical for informal street food stalls; not penalized. |
| `PERMANENTLY_CLOSED` | Google Place status indicates closed permanently | `CRITICAL` | Rejects recommendation. |

---

## 4. Investigation Findings: Google Search Grounding & Google Crowdsource

### A. Google Search Grounding
- **Status:** **Integrated via Gemini AI Architecture.**
- Google Search Grounding is executed through the official `@google/genai` TypeScript SDK tool declaration (`{ tools: [{ googleSearch: {} }] }`).
- Developer B configures search grounding prompts in Cloud Functions to verify live local events, festival closures, and regional food terminology.
- Developer C provides structured Google Maps Place IDs and normalized queries that Developer B's grounded search prompt references.

### B. Google Crowdsource
- **Status:** **Unavailable as a Live Developer REST API (Confirmed).**
- Google Crowdsource has **no public REST API, OAuth client, or programmatic SDK** for third-party querying.
- In strict adherence to Buildathon working rules, **no fabricated Crowdsource API integration or stub is claimed**.
- Real community dialect signals are captured directly through:
  1. Contributor regional voice notes (processed via Gemini 3.8 Live / Flash in Task B2).
  2. Local resident sentiment synthesis in `PlaceGroundingEvidence`.
  3. Regional dialect tagging in Firestore `places`.

---

## 5. Live vs. Sample Data Governance

- **Live Mode:** Used when `GOOGLE_MAPS_PLACES_API_KEY` or `MAPS_API_KEY` is configured in `.env.local` or Secret Manager. Connects to `places.googleapis.com` (New) with HTTP 200 verification. `isMockData = false`.
- **Sample/Mock Fallback Mode:** Used during offline development or testing without credentials. Uses authentic, pre-verified Bengaluru heritage fixtures (`SAMPLE_PLACES_FIXTURE`). Every returned document explicitly carries `isMockData: true`.
