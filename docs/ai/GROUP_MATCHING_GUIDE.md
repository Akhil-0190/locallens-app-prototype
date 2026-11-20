# Task B4 — Gemini Embeddings, Solo & Group Taste Matching Guide

**Task ID:** B4  
**Task Name:** Gemini Embeddings, Solo and Group Taste Matching  
**Owner:** Developer B (AI & Model Integration)  
**Stakeholders:** Developer A (Backend Persistence — Task A2/A4), Developer D (Flutter Client Discovery — Task D3), Developer C (Maps Grounding — Task C2/C3)  
**Branch:** `feature/B4-group-matching`  
**Date:** November 20, 2026  

---

## 1. Architecture & Cross-Team Integration

Task B4 implements semantic vector representation, solo traveler preference matching, and group consensus preference blending. It integrates Developer A's canonical contracts (Domain 02 and Domain 09) and powers Developer D's Flutter Discovery experience (Task D3).

```
   Solo Traveler (Domain 02)                Group Expedition (Domain 09)
   TravelerPreferencesDocument               MemberPreferenceInput[]
              │                                        │
              ▼                                        ▼
    matchSoloPreferences()                   blendGroupPreferences()
              │                                        │
              │                                        ▼
              │                              ConsensusBlendOutput
              │                               (Strict Dietary Union,
              │                                Budget Consensus Range,
              │                                Compromise Factors)
              │                                        │
              ▼                                        ▼
   ┌──────────────────────────────────────────────────────────────┐
   │          Gemini Embedding 2 (gemini-embedding-2)             │
   │               3,072-Dimensional Dense Vectors                │
   │                Cosine Similarity Mathematics                 │
   └──────────────────────────────────────────────────────────────┘
              │                                        │
              ▼                                        ▼
     SoloPlaceMatchResult                     GroupPlaceMatchResult
(Score Breakdown, Matched Vibes,         (Group Score, Member Satisfaction,
   Explainable Match Reasons)             Dietary Safety, Compromise Notes)
              │                                        │
              └───────────────────┬────────────────────┘
                                  ▼
                   Client UI (D3 MatchVibeScreen)
```

---

## 2. Gemini Embedding 2 Integration

### A. Live Model Specifications
- **Model ID:** `gemini-embedding-2` (Verified via live Google AI Studio API call).
- **Vector Dimensions:** Exactly **3,072** floating-point dimensions.
- **API Call Structure:**
  ```typescript
  const response = await client.models.embedContent({
    model: 'gemini-embedding-2',
    contents: textInput,
  });
  const vector = response.embedding?.values; // 3,072 floats
  ```

### B. Offline Sandbox Test Adapter
In isolated or offline sandboxed testing where external egress to Google endpoints is unavailable:
- Deterministic 3,072-dimensional hashing vector generator `generateOfflineTestVector(text)` preserves token-level semantic relationships.
- Vectors are explicitly tagged with `isOfflineMock: true` and `model: 'gemini-embedding-2-test-adapter'` to prevent mistaking test vectors for live embeddings.

---

## 3. Solo Traveler Preference Matching Engine

### A. Preference Dimensions Evaluated
1. **Semantic Vibe Similarity (45% weight):** Cosine similarity between user preference embedding and place profile embedding.
2. **Budget Fit Score (20% weight):** Evaluated against user's `budgetTier` ('BUDGET' | 'MODERATE' | 'PREMIUM') and `maxBudgetPerMealInr`.
3. **Dietary Compliance Score (20% weight):** Places violating user restrictions (e.g., pure vegetarian, jain, halal) are penalized and trigger a `dietaryAlert`.
4. **Pacing Suitability Score (15% weight):**
   - `RELAXED`: Prioritizes serene alleys, historic temples, and quiet cafes.
   - `PACKED`: Prioritizes bustling commercial corridors and high-density zones.
5. **Authenticity Bonus (+0 to +15 pts):** Places with verified authenticity scores >= 80 receive bonus points.

---

## 4. Group Preference Blending Engine (Domain 09)

### A. Strict Dietary Constraints Union (Non-Negotiable Safety Rule)
If **any** single group member has a dietary restriction or allergen (e.g., vegan, nut allergy, jain), it is added to `dietaryConstraintsUnion`.
- **Safety Enforcement:** A place that violates **any** member's dietary restriction is marked `dietarySafetyVerified: false` and **cannot** be recommended (`isRecommended: false`).

### B. Budget Consensus Range
- `minCurrencyAmount`: The **lowest** budget cap among all members (ensuring no member is priced out).
- `maxCurrencyAmount`: Weighted average budget across all members.

### C. Atmosphere Consensus & Minority Preservation
- Individual member weightings ($0.1$ to $2.0$, default $1.0$) are normalized.
- Shared majority vibes are prioritized in `consensusAtmosphere`.
- Minority preferences (vibes selected by only 1 member) are preserved and articulated in `compromiseFactors` rather than silently erased.

### D. Member Satisfaction Scoring
Each group recommendation calculates a per-member satisfaction score (`memberSatisfactionScores[userId]` from 0 to 100), ensuring transparency on how well each traveler's tastes are served.

---

## 5. Verification Scenarios (16 Passed)

| # | Scenario | Verification Focus | Result |
|---|---|---|---|
| 1 | Individual Preference Model | Supports vibes, budget, pacing, neighborhood filters | **PASSED** |
| 2 | Embedding Vector Output | Confirms exact 3,072 dimensions | **PASSED** |
| 3 | Cosine Vector Math | Identical concepts ~1.0; divergent concepts lower | **PASSED** |
| 4 | Strong Solo Match | High score (>=80), recommended, matched vibes | **PASSED** |
| 5 | Weak Solo Match | Penalized score, dietary alert emitted | **PASSED** |
| 6 | Incomplete Preferences | Zero-bias graceful handling without errors | **PASSED** |
| 7 | Group Preference Blending | Domain 09 ConsensusBlendOutput schema validation | **PASSED** |
| 8 | Shared Group Vibes | Shared majority vibes prioritized | **PASSED** |
| 9 | Conflicting Group Preferences | Compromise factors articulated; min budget preserved | **PASSED** |
| 10 | Dietary Constraints Union | Strict union of distinct member restrictions | **PASSED** |
| 11 | Minority Preservation | Minority member vibes documented in compromises | **PASSED** |
| 12 | Group-to-Place Matching | High group score with member satisfaction breakdown | **PASSED** |
| 13 | Group Dietary Disqualification | Meat spot disqualified for group with vegetarian member | **PASSED** |
| 14 | Explainable Match Reasons | Clear group rationale and compromise notes | **PASSED** |
| 15 | Malformed Input Rejection | Rejects empty member lists and empty texts safely | **PASSED** |
| 16 | Output Schema Validation | Zod schema parse and offline adapter labeling | **PASSED** |
