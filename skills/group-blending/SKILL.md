---
name: group-blending
description: Combines multiple traveler preference profiles into a unified group consensus blend using strict dietary safety unions and Gemini Embedding 2 vector matching.
---

# Group Blending Skill

**Name:** group-blending  
**Domain:** Group Expeditions, Preference Synthesis & Consensus Taste Matching  
**Primary Ownership:** Developer B (AI Matching Service) & Developer A (Group Sessions Backend)  
**Status:** Active  

---

## 1. Overview & Purpose

The **Group Blending Skill** solves the fundamental friction of group travel: choosing places and walking itineraries that satisfy diverse, often conflicting traveler tastes while strictly protecting health and dietary safety:
1. **Strict Dietary Safety Union:** If even one member in the group is strictly vegan, vegetarian, halal, celiac/gluten-free, or has severe nut allergies, the group's dietary safety requirements are the union of all member restrictions. Dietary safety is never compromised through voting.
2. **Budget Consensus Calculation:** Synthesizes group budget preferences into an overlapping consensus range without pricing out budget-conscious members.
3. **Pace & Atmosphere Harmonization:** Evaluates walking speed, walking endurance, and vibe preferences to identify balanced middle-ground venues.
4. **Semantic Vector Matching:** Employs 3,072-dimensional `gemini-embedding-2` dense vector representations to rank spots based on multi-party cosine similarity and explainable satisfaction breakdowns.

---

## 2. Trigger Conditions

This skill is invoked during collaborative session planning (`Task A4 / B4 / D3 / D7`):
- When a group session host initiates consensus blending (`saveConsensusBlend`).
- When a new traveler joins an active group expedition and preferences are re-synchronized.
- When generating personalized group pocket guides or collaborative walking routes.

---

## 3. Technical Service Pipeline

```
[Group Member Profiles] (MemberPreferenceInput[])
       │
       ▼
[Dietary Union Guard] ──► Union of all allergen, dietary, and religious restrictions
       │
       ▼
[Budget & Pace Synthesizer] ──► Overlapping budget envelope & normalized walking speed
       │
       ▼
[Consensus Preference Blend] ──► ConsensusBlendOutput
       │
       ▼
[Gemini Embedding 2 Matcher] ──► Computes 3,072-dim Cosine Similarity vs Candidate Places
       │
       ▼
[Ranked Group Recommendations] ──► GroupPlaceMatchResult[] (Group score, member satisfaction breakdown)
```

---

## 4. Input & Output Contract

### Input Parameters
- `sessionId`: Unique group session identifier.
- `hostUserId`: Firebase UID of the session creator.
- `members`: Array of member preference profiles:
  - `userId`: string
  - `dietaryRestrictions`: string[] (e.g. `'VEGETARIAN'`, `'VEGAN'`, `'HALAL'`, `'GLUTEN_FREE'`, `'NUT_ALLERGY'`)
  - `budgetTier`: `'BUDGET'` | `'MODERATE'` | `'PREMIUM'`
  - `preferredPace`: `'LEISURELY'` | `'MODERATE'` | `'BRISK'`
  - `interestTags`: string[] (e.g. `'HERITAGE'`, `'STREET_FOOD'`, `'ART'`, `'TEMPLES'`)

### Output Structure (`ConsensusBlendOutput`)
- `sessionId`: string
- `dietaryUnion`: Complete, non-negotiable set of all group members' dietary and allergen restrictions.
- `consensusBudgetTier`: Compromise budget bracket.
- `recommendedPace`: Harmonized walking pace.
- `blendedInterests`: Weighted interest tags representing group alignment.
- `compromiseFactors`: Human-readable summary of accommodations made for specific members.
- `matchScores`: Candidate places ranked with overall group score and per-member satisfaction ratings.

---

## 5. Representative Examples

### Example 1: Strict Dietary Safety Union (Vegan + Celiac + Nut Allergy)
* **Input:**
  - Member 1: `{ dietaryRestrictions: ['VEGAN'], budgetTier: 'MODERATE', preferredPace: 'MODERATE' }`
  - Member 2: `{ dietaryRestrictions: ['GLUTEN_FREE'], budgetTier: 'MODERATE', preferredPace: 'MODERATE' }`
  - Member 3: `{ dietaryRestrictions: ['NUT_ALLERGY'], budgetTier: 'BUDGET', preferredPace: 'MODERATE' }`
* **Output:**
  - `dietaryUnion`: `['VEGAN', 'GLUTEN_FREE', 'NUT_ALLERGY']` (Strict non-negotiable union)
  - `consensusBudgetTier`: `'MODERATE'`
  - `recommendedPace`: `'MODERATE'`
  - `groupCohesionScore`: `82 / 100`
  - `dietarySafetyGuarantees`: `["All group spot recommendations must strictly satisfy VEGAN, GLUTEN_FREE, and NUT_ALLERGY requirements."]`

### Example 2: Polar Preference Divergence (Budget & Pace Conflict)
* **Input:**
  - Member A: `{ budgetTier: 'BUDGET', preferredPace: 'LEISURELY', interestTags: ['STREET_FOOD'] }`
  - Member B: `{ budgetTier: 'PREMIUM', preferredPace: 'BRISK', interestTags: ['HERITAGE', 'LUXURY'] }`
* **Output:**
  - `consensusBudgetTier`: `'MODERATE'` (Compromise envelope)
  - `recommendedPace`: `'MODERATE'`
  - `conflictWarnings`: `["Polar budget divergence: Capped at MODERATE to preserve accessibility", "Walking pace harmonized to MODERATE with extended rest stops"]`
  - `groupCohesionScore`: `65 / 100`

### Example 3: Solo Traveler Baseline
* **Input:** Single member with Jain dietary restriction and Budget tier.
* **Output:**
  - `dietaryUnion`: `['JAIN']`
  - `consensusBudgetTier`: `'BUDGET'`
  - `groupCohesionScore`: `95 / 100` (Zero internal friction)

---

## 6. Dietary Safety & Consensus Invariants

1. **Dietary Union Invariant:** Dietary restrictions and medical food allergies are **NEVER voted on** or averaged out. The group requirement is strictly the mathematical union of all individual restrictions.
2. **Budget Floor Invariant:** The group budget is capped to ensure the most budget-conscious member is never priced out of an expedition.
3. **Pace Harmonization:** Paces spanning Leisurely to Brisk default to Moderate with explicit buffer time added between walking legs.

---

## 7. Execution Engine & Programmatic Service

* **TypeScript Implementation:** `functions/src/ai/skills/skill-group-blending.ts`
* **Firebase Callable:** `Skills-executeGroupBlending`
* **Test Verification:** Verified via deterministic tests in `functions/test/test-b7-agent-skills.ts` (Suite 3).
