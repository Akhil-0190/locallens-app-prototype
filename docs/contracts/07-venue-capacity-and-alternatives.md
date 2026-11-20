# Domain 07: Venue Capacity, Schedules & Alternatives

**Contract Reference:** `docs/contracts/07-venue-capacity-and-alternatives.md`
**Firestore Subcollection / Document:** `places/{placeId}/hourly_capacities/{slotId}`
**Primary Stakeholders:** Developer A (Backend Throttling), Developer C (Maps Crowd Logic), Developer D (Flutter Capacity Indicator)
**Sample Payload:** [docs/contracts/samples/07-venue-capacity-alternatives.sample.json](file:///d:/Judah/Projects/Hackthon/Google/BuildathonNew/neighborhoodguideapp/docs/contracts/samples/07-venue-capacity-alternatives.sample.json)

---

## 1. Scope & Ownership
Protects fragile neighborhood stalls and narrow residential alleys from overtourism by enforcing hourly traveler limits, real-time crowd status, and automatic plan-B alternative rerouting.

---

## 2. Canonical TypeScript Interface

```typescript
export type CrowdLevel = 'LOW' | 'MODERATE' | 'HIGH' | 'AT_CAPACITY';

export interface VenueHourlyCapacityDocument {
  slotId: string;                       // e.g. "slot_20261120_1400"
  placeId: string;                      // Reference to parent place
  hourSlot: string;                     // ISO 8601 hour timestamp e.g. "2026-11-20T14:00:00Z"
  maxCapacity: number;                  // Maximum allowed visitors (e.g. 8 travelers/hour)
  currentVisitorsCount: number;         // Active visitors checked in or booked
  remainingCapacity: number;            // maxCapacity - currentVisitorsCount
  level: CrowdLevel;                    // Real-time crowd classification
  isThrottled: boolean;                 // True if remainingCapacity <= 0
  suggestedAlternatives: {
    alternativePlaceId: string;         // Less crowded alternative nearby
    alternativeName: string;
    distanceMeters: number;
    walkingDurationMinutes: number;
    currentCrowdLevel: CrowdLevel;
  }[];
  updatedAt: string;                    // ISO 8601 UTC
}
```

---

## 3. Throttling Thresholds

| Crowd Level | Remaining Capacity | Client UI State |
| :--- | :---: | :--- |
| **LOW** | > 60% of maxCapacity | Green badge: "Spacious & authentic" |
| **MODERATE** | 30% - 60% of maxCapacity | Yellow badge: "Moderate crowd" |
| **HIGH** | 1% - 29% of maxCapacity | Orange badge: "Busy â€” visit recommended later" |
| **AT_CAPACITY** | 0 remaining | Red badge: "Throttled â€” Redirecting to Plan-B alternative" |
