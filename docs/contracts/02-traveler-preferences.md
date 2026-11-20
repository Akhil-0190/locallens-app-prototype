# Domain 02: Traveler Preferences

**Contract Reference:** `docs/contracts/02-traveler-preferences.md`
**Firestore Collection:** `preferences/{userId}`
**Primary Stakeholders:** Developer A (Backend Storage), Developer B (Gemini Personalization), Developer D (Flutter Vibe Selector)
**Sample Payload:** [docs/contracts/samples/02-traveler-preferences.sample.json](file:///d:/Judah/Projects/Hackthon/Google/BuildathonNew/neighborhoodguideapp/docs/contracts/samples/02-traveler-preferences.sample.json)

---

## 1. Scope & Ownership
Defines personal taste vectors, dietary requirements, spending budget, and mobility needs used by Developer B for AI recommendations and Developer D's UI filters.

---

## 2. Canonical TypeScript Interface

```typescript
export type BudgetTier = 'BUDGET' | 'MODERATE' | 'PREMIUM';

export interface TravelerPreferencesDocument {
  userId: string;                       // Primary Key (Auth UID)
  favoriteVibes: string[];              // e.g. ["heritage", "vintage_filter_coffee", "quiet_courtyard", "traditional_crafts"]
  dietaryRestrictions: string[];        // e.g. ["vegetarian", "vegan", "halal", "jain", "gluten_free", "nut_allergy"]
  budgetTier: BudgetTier;               // Spending preference
  maxBudgetPerMealInr: number;          // Maximum per-meal target in INR
  preferredPacing: 'RELAXED' | 'BALANCED' | 'PACKED';
  preferredNeighborhoods: string[];     // e.g. ["Malleshwaram", "Basavanagudi", "Indiranagar"]
  accessibilityNeeds: string[];         // e.g. ["wheelchair_accessible", "step_free", "audio_descriptions"]
  updatedAt: string;                    // ISO 8601 UTC
}
```

---

## 3. Coordination with Developer D's Vibe Chip Selector
Developer D's `VibeChipSelector` widget displays:
- `heritage`
- `vintage_filter_coffee`
- `street_food`
- `quiet_courtyard`
- `artisanal_crafts`
- `generational_recipes`
- `pocket_friendly`
All vibe chips map directly to `favoriteVibes` array items.
