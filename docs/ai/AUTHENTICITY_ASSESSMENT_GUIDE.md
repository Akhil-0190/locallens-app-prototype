# Task B3 — Authenticity, Tourist-Trap and Safety Assessment Guide

**Task ID:** B3  
**Task Name:** Authenticity, Tourist-Trap and Safety Assessment  
**Owner:** Developer B (AI & Model Integration)  
**Stakeholders:** Developer C (Maps Grounding & Evidence — Task C2), Developer A (Canonical Persistence — Task A3), Developer D (Flutter Client UI — Task D3)  
**Branch:** `feature/B3-authenticity-filtering`  
**Date:** November 20, 2026  

---

## 1. Architecture Overview

Task B3 provides the AI assessment layer that synthesizes **Developer C's `PlaceGroundingEvidence`** (from Google Maps Platform) with **Developer B's local contributor narratives and voice extractions** (from Task B2) to produce nuanced, evidence-backed authenticity ratings, tourist-trap risk classifications, and safety observations.

```
       Local Contributor Submission (D2)
       & Voice Extraction (B2)
                   │
                   ▼
     Maps Grounding Service (C2) ──► Queries Places API (New) / Matches Coordinates
                   │
                   ▼
        PlaceGroundingEvidence
  (Discrepancies, Match Confidence,
   Tourist Trap & Authenticity Signals)
                   │
                   ▼
 AuthenticityAssessmentService (B3) ──► Google Gemini Models (@google/genai)
                   │
                   ├─────────────────────────────────┬─────────────────────────────────┐
                   ▼                                 ▼                                 ▼
         Tourist-Trap Evaluation          Authenticity Scoring              Safety & Hygiene
     (Chains, Touting, Markups)      (Generational, Local Patronage)    (Concrete Evidence Only)
                   │                                 │                                 │
                   └─────────────────────────────────┼─────────────────────────────────┘
                                                     ▼
                              ComprehensiveAuthenticityAssessment (B3)
                                                     │
                                                     ▼
                                 toPlaceAuthenticityEnrichment()
                                                     │
                                                     ▼
                            CanonicalPlaceDocument.authenticity (Domain 06)
```

---

## 2. Strict Anti-Hallucination & Ethical Guardrails

### A. Tourist-Trap & Overcommercialization Principles
- **Popularity is NOT Tourist-Trap Evidence:** A bustling, world-renowned heritage institution (e.g. CTR Shri Sagar, Vidyarthi Bhavan, Murugan Idli Shop) is NOT a tourist trap simply because it attracts visitors or has long lines.
- **Evidence-Based Trap Signals:** An establishment is only flagged as a tourist trap if concrete evidence exists:
  1. Multi-outlet commercial chain or corporate franchise ownership.
  2. Documented aggressive street touting, commission-seeking guides, or tour-bus kickbacks.
  3. Extreme price inflation relative to neighborhood standards for identical products.
  4. Inorganic or suspicious generic tourist review velocity.

### B. Safety & Hygiene Guardrails
- **No Baseless Accusations:** An establishment must **never** be labeled unsafe, dirty, or hazardous without explicit, corroborated evidence (e.g. health department citations or recurrent food poisoning reports in verified reviews).
- **Missing Information is Neutral:** Missing safety or hygiene data **never** implies an establishment is unsafe. If no incidents are recorded, safety concerns remain strictly `false`.
- **No AI Safety Badges:** AI assessments **never** grant an official government health certification or verified safety badge (`isOfficialVerificationBadge` is strictly `false`).

### C. Authenticity Transparency
- Authenticity is partly subjective. Assessments explicitly distinguish:
  - **Evidence-backed facts:** (e.g., registered operational since 1924, physical address in heritage quarter).
  - **Contributor claims:** (e.g., "best filter coffee in South India").
  - **AI inferences:** (e.g., estimated local resident patronage ratio).

---

## 3. Data Contracts & Mapping

### A. Input: Consuming C2's `PlaceGroundingEvidence`
```typescript
import { assessPlaceAuthenticity } from '../ai/services/ai-service';
import { PlaceGroundingEvidence } from '../maps';

const assessment = await assessPlaceAuthenticity({
  evidence: placeGroundingEvidence, // C2 Grounding Evidence
  contributorNarrative: 'Generational benne dosa spot since 1924.', // Optional B2 audio/text
  travelerPreferences: { favoriteVibes: ['heritage'] }, // Optional A2 preferences
});
```

### B. Output: Mapping to Developer A's Canonical Contract (Domain 06)
Task B3 provides `toPlaceAuthenticityEnrichment()` which converts the detailed assessment directly into Developer A's canonical `PlaceAuthenticityEnrichment` schema:

```typescript
export function toPlaceAuthenticityEnrichment(
  assessment: ComprehensiveAuthenticityAssessment
): PlaceAuthenticityEnrichment {
  return PlaceAuthenticityEnrichmentSchema.parse({
    authenticityScore: assessment.overallAuthenticityScore,
    touristTrapLikelihood: assessment.touristTrapLikelihood,
    isTouristTrap: assessment.isTouristTrap,
    localSentimentSummary: assessment.localSentimentSummary,
    recommendedTiming: assessment.travelerRelevance.recommendedVisitingWindow,
    practicalTips: assessment.travelerRelevance.practicalTips,
    greetingCard: assessment.travelerRelevance.greetingCardNarrative,
    vibeTags: assessment.travelerRelevance.vibeTags,
  });
}
```

---

## 4. Verification & Test Scenarios

The test suite in `functions/test/test-b3-authenticity-assessment.ts` validates all 12 required scenarios:

1. **Positive Authenticity:** Generational heritage venue (score >= 75, trap risk LOW).
2. **Overcommercialization:** Commercial souvenir chain with touting (flagged HIGH/SEVERE trap, score < 40).
3. **Conflicting Evidence:** Spatial and operating hours mismatches between contributor and Maps.
4. **Insufficient Evidence:** `NO_MATCH` handled safely without fabricated data.
5. **Missing Reviews:** Sparse data on micro-stalls is not falsely penalized as a tourist trap.
6. **Conflicting Contributor Claims:** Exaggerated contributor claims flagged as unverified.
7. **Concrete Safety Concerns:** Verified health inspection violations trigger explicit warnings.
8. **Missing Safety Data:** Absence of safety records does not penalize venue (`isOfficialVerificationBadge: false`).
9. **Explanations & Confidence:** Actionable tips, recommended visiting windows, and vibe tags.
10. **Source Attribution:** Preserves C2 evidence sources (`GOOGLE_PLACES_API_NEW`, etc.).
11. **Malformed Input Rejection:** Rejects empty or invalid evidence inputs safely.
12. **Canonical Contract Validation:** Validated against Developer A's `PlaceAuthenticityEnrichmentSchema`.
