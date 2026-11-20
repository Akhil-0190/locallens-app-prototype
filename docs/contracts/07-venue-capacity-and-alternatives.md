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

Thresholds strictly measure **remaining capacity percentage**:
$$\text{remainingPercentage} = \frac{\text{remainingCapacity}}{\text{maxCapacity}} \times 100$$

| Crowd Level | Remaining Percentage Range | Remaining Capacity Math | Throttling Flag (`isThrottled`) | Client UI State |
| :--- | :---: | :---: | :---: | :--- |
| **LOW** | $> 60.0\%$ | $\text{remainingCapacity} > 0.60 \times \text{maxCapacity}$ | `false` | Green badge: "Spacious & authentic" |
| **MODERATE** | $30.0\% \le \text{pct} \le 60.0\%$ | $0.30 \times \text{maxCapacity} \le \text{remainingCapacity} \le 0.60 \times \text{maxCapacity}$ | `false` | Yellow badge: "Moderate crowd" |
| **HIGH** | $0\% < \text{pct} < 30.0\%$ | $0 < \text{remainingCapacity} < 0.30 \times \text{maxCapacity}$ | `false` | Orange badge: "Busy â€” visit recommended later" |
| **AT_CAPACITY** | $\le 0\%$ | $\text{remainingCapacity} \le 0$ | `true` | Red badge: "Throttled â€” Redirecting to Plan-B alternative" |

---

## 4. Scheduled Visit Reservation Document

**Firestore Collection:** `scheduled_visits/{visitId}`
**Sample Payload:** [docs/contracts/samples/07-scheduled-visit.sample.json](file:///d:/Judah/Projects/Hackthon/Google/BuildathonNew/neighborhoodguideapp/docs/contracts/samples/07-scheduled-visit.sample.json)

```typescript
export type ScheduledVisitStatus = 'CONFIRMED' | 'CANCELLED' | 'COMPLETED';

export interface ScheduledVisitDocument {
  visitId: string;                      // Deterministic: "visit_" + sha256(travelerId + ":" + idempotencyKey).slice(0, 20)
  placeId: string;                      // Canonical Place ID
  slotId: string;                       // Strictly "slot_YYYYMMDD_HH00" in UTC
  travelerId: string;                   // Auth UID of booking traveler / group host
  partySize: number;                    // Number of visitors allocated (>= 1)
  groupSessionId?: string | null;       // Optional group session foreign key (Domain 09)
  memberUserIds: string[];              // Immutable snapshot: traveler UIDs covered (length === partySize, includes travelerId)
  idempotencyKey: string;               // Client UUID guaranteeing exactly-once transaction
  status: ScheduledVisitStatus;         // Current lifecycle state ('CONFIRMED' | 'CANCELLED' | 'COMPLETED')
  hourSlot: string;                     // ISO 8601 UTC timestamp: "YYYY-MM-DDTHH:00:00.000Z"
  timeZone: string;                     // Canonical IANA timezone derived from place (e.g. "Asia/Kolkata")
  localTimeSlot: string;                // Derived human display: "19:30 - 20:30 IST"
  completedAt?: string | null;          // ISO 8601 UTC timestamp of check-in / completion
  completedBy?: 'TRAVELER_CHECKIN' | 'SYSTEM_EXPIRATION' | null;
  createdAt: string;                    // ISO 8601 UTC
  updatedAt: string;                    // ISO 8601 UTC
}
```

### Key Invariants:
1. `memberUserIds.length === partySize`.
2. `memberUserIds.includes(travelerId)`.
3. `slotId` must match `hourSlot` derived at top of the hour UTC (`slot_YYYYMMDD_HH00`).
4. `currentVisitorsCount` on `places/{placeId}/hourly_capacities/{slotId}` increments on booking, does not re-increment on check-in, decrements on cancellation before slot begins, and remains unaffected by completion.
