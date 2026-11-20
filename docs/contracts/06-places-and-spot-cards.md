# Domain 06: Structured Places & Spot Cards

**Contract Reference:** `docs/contracts/06-places-and-spot-cards.md`
**Firestore Collection:** `places/{placeId}`
**Primary Stakeholders:** Developer A (Backend Store), Developer B (Gemini Authenticity), Developer C (Maps Grounding), Developer D (Flutter Spot Card & Drift SQLite)
**Sample Payload:** [docs/contracts/samples/06-place-spot-card.sample.json](file:///d:/Judah/Projects/Hackthon/Google/BuildathonNew/neighborhoodguideapp/docs/contracts/samples/06-place-spot-card.sample.json)

---

## 1. Scope & Ownership
The definitive **Place** document unifying Google Places API (New) details, Gemini 3.8 Flash authenticity/tourist trap assessment, real-time crowd throttling, and Flutter UI `SpotCard` / Drift SQLite.

---

## 2. Canonical TypeScript Interface

```typescript
import { NormalizedCoordinate } from '../maps/types/coordinates.types';

export type TouristTrapRisk = 'LOW' | 'MODERATE' | 'HIGH' | 'SEVERE';
export type CrowdLevel = 'LOW' | 'MODERATE' | 'HIGH' | 'AT_CAPACITY';

export interface PlaceAuthenticityEnrichment {
  authenticityScore: number;            // 0 (tourist trap) to 100 (deeply authentic local staple)
  touristTrapLikelihood: TouristTrapRisk;
  isTouristTrap: boolean;               // True if touristTrapLikelihood in ['HIGH', 'SEVERE']
  localSentimentSummary: string;        // Summary synthesized from resident inputs
  recommendedTiming: string;            // Optimal hours to visit
  practicalTips: string;                // Insider tips (e.g. enter through back alley)
  greetingCard: string;                 // Warm welcoming narrative synthesized by Gemini
  vibeTags: string[];                   // e.g. ["heritage", "vintage_filter_coffee", "generational"]
}

export interface PlaceCapacityState {
  hourlyLimit: number;                  // Maximum allowed hourly visitors (e.g. 6-12)
  currentVisitors: number;              // Current active checked-in or scheduled visitors
  remainingCapacity: number;            // hourlyLimit - currentVisitors
  crowdLevel: CrowdLevel;               // Real-time crowd band
  isThrottled: boolean;                 // True when remainingCapacity <= 0
  lastUpdatedSlot: string;              // ISO 8601 hour slot e.g. "2026-11-20T14:00:00Z"
}

export interface CanonicalPlaceDocument {
  id: string;                           // Google Place ID (e.g. "ChIJ...") or internal gem UUID
  placeId: string;                      // Canonical alias
  spotName: string;                     // Primary display name
  formattedAddress: string;             // Physical street address
  coordinate: NormalizedCoordinate;     // 6-decimal lat/lng with geohash
  mapsLink: string;                     // Google Maps URL
  primaryCategory: string;              // e.g. "south_indian_restaurant"
  categories: string[];                 // Broad taxonomy
  infoParagraph: string;                // Resident narrative
  photoUrls: string[];                  // Verified photos
  openHours: string;                    // Operating hours string
  isOpenNow: boolean | null;            // Live open status
  authenticity: PlaceAuthenticityEnrichment;
  capacity: PlaceCapacityState;
  contributorAttribution?: {
    userId: string;
    displayName: string;
    badgeTitle: string;
    isVerifiedResident: boolean;
  };
  isVerified: boolean;
  isMockData: boolean;
  createdAt: string;                    // ISO 8601 UTC
  updatedAt: string;                    // ISO 8601 UTC
}
```

---

## 3. Drift SQLite Table Mapping (Developer D)
Matches `LocalSpots` table in `lib/database/app_database.dart`:
- `id` -> `id`
- `spotName` -> `spotName`
- `mapsLink` -> `mapsLink`
- `infoParagraph` -> `infoParagraph`
- `photoUrls` -> `photoUrlsJson` (serialized JSON array)
- `openHours` -> `openHours`
- `authenticity.practicalTips` -> `practicalTips`
- `authenticity.greetingCard` -> `greetingCard`
- `authenticity.isTouristTrap` -> `isTouristTrap`
- `capacity.hourlyLimit` -> `hourlyLimit`
- `capacity.currentVisitors` -> `currentVisitors`
- `authenticity.vibeTags` -> `vibeTagsJson` (serialized JSON array)
