# Domain 09: Groups & Taste-Matching Results

**Contract Reference:** `docs/contracts/09-groups-and-taste-matching.md`
**Firestore Collection:** `group_sessions/{sessionId}`
**Primary Stakeholders:** Developer A (Backend Storage), Developer B (Gemini Taste Blending), Developer D (Flutter Group Screen)
**Sample Payload:** [docs/contracts/samples/09-group-taste-matching.sample.json](file:///d:/Judah/Projects/Hackthon/Google/BuildathonNew/neighborhoodguideapp/docs/contracts/samples/09-group-taste-matching.sample.json)

---

## 1. Scope & Ownership
Governs collaborative multi-traveler group planning where individual preferences are submitted, blended using **Gemini 3.8 Flash** via Developer B's `GroupPreferenceBlendSchema`, and matched with agreed spots.

---

## 2. Canonical TypeScript Interface

```typescript
export interface MemberPreferenceInput {
  userId: string;
  displayName: string;
  vibes: string[];
  dietaryRestrictions: string[];
  maxBudgetAmount: number;
  weighting: number;                    // 0.1 to 2.0 (default 1.0)
}

export interface ConsensusBlendOutput {
  consensusAtmosphere: string[];
  dietaryConstraintsUnion: string[];    // Strict union: all restrictions honored
  budgetConsensusRange: {
    minCurrencyAmount: number;
    maxCurrencyAmount: number;
    currencyCode: string;               // e.g. "INR"
  };
  individualWeightings: Record<string, number>;
  compromiseFactors: string[];          // Transparent explanations for trade-offs
  recommendedCategoryFocus: string[];
}

export interface GroupSessionDocument {
  sessionId: string;                    // Unique session UUID
  hostUserId: string;                   // Creator UID
  sessionCode: string;                  // 6-character short code (e.g. "BLR892")
  neighborhood: string;                 // Target neighborhood
  status: 'INVITING' | 'BLENDING' | 'FINALIZED' | 'EXPIRED';
  members: MemberPreferenceInput[];
  consensusBlend: ConsensusBlendOutput | null;
  recommendedSpotIds: string[];         // Matched canonical place IDs
  createdAt: string;                    // ISO 8601 UTC
  expiresAt: string;                    // ISO 8601 UTC
}
```
