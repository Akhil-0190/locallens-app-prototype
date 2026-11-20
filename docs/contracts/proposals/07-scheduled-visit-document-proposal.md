# Proposal: Domain 07 Extension â€” ScheduledVisitDocument (Final Proposed Specification)

**Proposal Reference:** `docs/contracts/proposals/07-scheduled-visit-document-proposal.md`
**Target Collection:** `scheduled_visits/{visitId}`
**Primary Stakeholders:** Developer A (Backend Persistence & Capacity Transactions), Developer C (Crowd Throttling), Developer D (Traveler Booking UI)
**Sample Payload:** [docs/contracts/samples/07-scheduled-visit.sample.json](file:///d:/Judah/Projects/Hackthon/Google/BuildathonNew/neighborhoodguideapp/docs/contracts/samples/07-scheduled-visit.sample.json)

---

## 1. Context & Motivation
While Domain 07 (`07-venue-capacity-and-alternatives.md`) defines the aggregate venue slot capacity record (`places/{placeId}/hourly_capacities/{slotId}`), it lacks an individual reservation document schema.

To support traveler visits, protect sensitive neighborhood spots from overtourism, and ensure atomic booking/cancellation with transaction-safe idempotency, this document specifies the finalized `ScheduledVisitDocument`.

---

## 2. Technical Decisions & Invariant Specifications

### 2.1 Capacity Counter Semantics & Developer C Confirmation
* **Definition of `currentVisitorsCount`:**
  - Each document at `places/{placeId}/hourly_capacities/{slotId}` represents one discrete 60-minute slot window.
  - `currentVisitorsCount` is the **cumulative visitor allocation** for that specific 60-minute window, encompassing active reservations and checked-in visitors.
* **Confirmed Counter Lifecycle (Agreed with Developer C):**
  1. **Booking:** Atomically increments `currentVisitorsCount += partySize` and decrements `remainingCapacity -= partySize`.
  2. **Check-In:** Does **NOT** increment capacity again; the traveler was already allocated capacity at booking time. Check-in simply marks physical presence.
  3. **Cancellation:** Atomically releases capacity: `currentVisitorsCount -= partySize` and `remainingCapacity += partySize`.
  4. **Completion:** Does **NOT** alter capacity; the visit occurred during its historical window, and past slot capacity remains an immutable audit record.

### 2.2 Group Roster Invariants & Immutable Snapshot
* **Strict Roster Invariants:**
  1. `memberUserIds.length === partySize` (the array of traveler UIDs must exactly match the allocated party size).
  2. `memberUserIds.includes(travelerId)` (the booking traveler / host must be an included member of the roster).
* **Immutable Snapshot Behavior:**
  - The reservation's `memberUserIds` is an **immutable snapshot** captured at the moment of booking.
  - Subsequent changes to the group session (e.g. members joining or leaving the session in Domain 09) do **NOT** silently alter existing reservations.
  - Any change to party size requires an explicit, separate transaction executed by the group host that verifies slot capacity before adjusting the booking.

### 2.3 Strict Slot Validation & `slotId` / `hourSlot` Consistency
* **UTC Date & Hour Consistency:**
  - `hourSlot` must be a valid ISO 8601 UTC timestamp strictly at the top of the hour (minutes, seconds, and milliseconds must be `00:00.000Z`).
  - `slotId` must be deterministically derived from `hourSlot` as `slot_<YYYYMMDD>_<HH00>` in UTC.
  - Zod validation enforces this consistency with a `.refine()` rule that rejects any mismatch between `slotId` and `hourSlot`.

### 2.4 Timezone Derivation & Places API Field Mask
* **Places API Field Mask:**
  - Primary Request: Google Places API (New) Place Details with `X-Goog-FieldMask: timeZone,location`.
  - Canonical IANA timezone (e.g. `"Asia/Kolkata"`, `"Asia/Tokyo"`) is extracted directly when returned by the API.
  - Fallback: If `timeZone` is omitted by Places API, Google Maps Time Zone API (`/maps/api/timezone/json?location=lat,lng&timestamp=...`) resolves the canonical IANA timezone.
  - **No Silent Default:** The system will **never** rely on `utcOffsetMinutes` alone or guess a timezone. If timezone resolution fails completely, the booking is rejected with `FAILED_PRECONDITION`.

### 2.5 Proximity Verification Disclosures (GPS vs QR)
* **GPS Proximity Limitation:** Client-submitted GPS coordinates provide only a proximity check (within 150m geofence), not tamper-proof cryptographic proof of physical arrival.
* **Dual Check-in Support:**
  - Proximity Check-in: GPS coordinates validated server-side against `places/{placeId}.coordinate`.
  - QR-based Verification: For merchant-verified check-in, an authorized merchant/spot QR token scan provides physical confirmation.

### 2.6 Transaction-Safe Idempotency & Parameter Validation
* **Deterministic Reservation Key:**
  ```typescript
  visitId = "visit_" + crypto.createHash('sha256').update(`${travelerId}:${idempotencyKey}`).digest('hex').slice(0, 20);
  ```
* **Strict Validation on Reuse:**
  If an existing document is found at `visitRef`:
  - Request parameters `(placeId, slotId, partySize)` are checked against `(existing.placeId, existing.slotId, existing.partySize)`.
  - Any mismatch immediately throws `already-exists` (`Idempotency key previously used with different booking parameters`).
  - If status is `CANCELLED`, rejects re-using the idempotency key.
  - If status is `CONFIRMED` and parameters match, returns existing reservation without touching slot capacity.

---

## 3. Canonical TypeScript Interface

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
  status: ScheduledVisitStatus;         // Current lifecycle state
  hourSlot: string;                     // ISO 8601 UTC timestamp: "YYYY-MM-DDTHH:00:00.000Z"
  timeZone: string;                     // Canonical IANA timezone derived from place (e.g. "Asia/Kolkata")
  localTimeSlot: string;                // Derived human display: "19:30 - 20:30 IST"
  completedAt?: string | null;          // ISO 8601 UTC timestamp of check-in / completion
  completedBy?: 'TRAVELER_CHECKIN' | 'SYSTEM_EXPIRATION' | null;
  createdAt: string;                    // ISO 8601 UTC
  updatedAt: string;                    // ISO 8601 UTC
}
```

---

## 4. Final Proposed Zod Validation Schema

```typescript
export const ScheduledVisitStatusSchema = z.enum(['CONFIRMED', 'CANCELLED', 'COMPLETED']);

export const ScheduledVisitDocumentSchema = z
  .object({
    visitId: z.string().regex(/^visit_[a-f0-9]{20}$/),
    placeId: z.string().min(1),
    slotId: z.string().regex(/^slot_\d{8}_\d{2}00$/),
    travelerId: z.string().min(1),
    partySize: z.number().int().min(1),
    groupSessionId: z.string().nullable().optional(),
    memberUserIds: z.array(z.string()).min(1),
    idempotencyKey: z.string().min(1),
    status: ScheduledVisitStatusSchema.default('CONFIRMED'),
    hourSlot: z.string().datetime(),
    timeZone: z.string().min(1),
    localTimeSlot: z.string().min(1),
    completedAt: z.string().datetime().nullable().optional(),
    completedBy: z.enum(['TRAVELER_CHECKIN', 'SYSTEM_EXPIRATION']).nullable().optional(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .refine(
    (data) => data.memberUserIds.length === data.partySize,
    { message: 'memberUserIds.length must equal partySize' }
  )
  .refine(
    (data) => data.memberUserIds.includes(data.travelerId),
    { message: 'travelerId must be included in memberUserIds' }
  )
  .refine(
    (data) => {
      const d = new Date(data.hourSlot);
      if (isNaN(d.getTime())) return false;
      if (d.getUTCMinutes() !== 0 || d.getUTCSeconds() !== 0 || d.getUTCMilliseconds() !== 0) return false;
      const year = d.getUTCFullYear();
      const month = String(d.getUTCMonth() + 1).padStart(2, '0');
      const day = String(d.getUTCDate()).padStart(2, '0');
      const hour = String(d.getUTCHours()).padStart(2, '0');
      const expectedSlotId = `slot_${year}${month}${day}_${hour}00`;
      return data.slotId === expectedSlotId;
    },
    { message: 'slotId must be derived from and match hourSlot (must be top-of-the-hour in UTC)' }
  );
```
