# Task A4 Coordination Notes â€” Preferences, Groups, Capacity & Scheduling

**Developer:** Developer A
**Task ID:** A4
**Branch:** `feature/A4-preferences-capacity-backend`
**Date:** 2026-11-20

---

## 1. Preference Storage Path & Developer D Integration

### Findings & Agreements:
1. **Canonical Path:** Domain 02 canonical contract specifies root collection `preferences/{userId}`.
2. **Developer D Implementation:**
   - Inspected `lib/services/traveler_service.dart` and `lib/models/traveler_preferences.dart`.
   - In D3, Developer D implemented traveler discovery using an in-memory `_currentPreferences` state and sample spot cards conforming to Domain 06.
   - Flutter has no existing live database writes to `users/{userId}/preferences/{prefDoc}`.
3. **Decision & Alignment:**
   - `preferences/{userId}` is confirmed as the single source of truth.
   - The obsolete placeholder rule `users/{userId}/preferences/{prefDoc}` in `firestore.rules` will be replaced with `preferences/{userId}` allowing owner read/write.
   - Callable functions `getPreferences` and `updatePreferences` provide a validated, versioned API envelope for D's client without needing direct client Firestore writes.

---

## 2. Developer B Coordination (AI Matching & Group Lifecycle)

### Agreements:
1. **Ownership Separation:**
   - Developer B owns AI model execution (Gemini 3.8 Flash), preference weighting algorithms, and candidate place ranking.
   - Developer A owns persistence for group sessions, membership, consensus blend output, and recommended spot IDs.
2. **Persistence Interface:**
   - Developer A provides:
     - In-process service function: `saveConsensusBlend(sessionId, blend, recommendedSpotIds)`
     - Firebase Callable: `saveConsensusBlend` accepting `{ sessionId, blend, recommendedSpotIds }`
   - Data structure strictly enforces `ConsensusBlendOutputSchema`:
     - `consensusAtmosphere`: string[]
     - `dietaryConstraintsUnion`: string[] (strict union honoring all member constraints)
     - `budgetConsensusRange`: `{ minCurrencyAmount, maxCurrencyAmount, currencyCode }`
     - `individualWeightings`: Record<string, number>
     - `compromiseFactors`: string[]
     - `recommendedCategoryFocus`: string[]
3. **Group Lifecycle Status & Invariants:**
   - Preserves canonical Domain 09 status values strictly: `'INVITING' | 'BLENDING' | 'FINALIZED' | 'EXPIRED'`.
   - Booking Eligibility: A group is eligible for booking **only when `status === 'FINALIZED'`**.
   - Host Authority: Only `session.hostUserId` can execute bookings or cancellations on behalf of the group.
   - **Immutable Roster Invariant:** The reservation snapshots `memberUserIds: string[]` at booking time (`memberUserIds.length === partySize`, `memberUserIds.includes(travelerId)`). Changes to the group session after booking do **not** silently change an existing reservation.

---

## 3. Developer C Coordination (Maps & Venue Capacity Alignment)

### Agreements & Explicit Confirmations:
1. **Capacity Counter Semantics (Confirmed by C):**
   - Developer C explicitly confirms that `currentVisitorsCount` on `places/{placeId}/hourly_capacities/{slotId}` represents the **cumulative visitor allocation for that specific 60-minute window**.
   - Counter Lifecycle Invariants:
     1. **Booking:** Atomically increments `currentVisitorsCount += partySize` and decrements `remainingCapacity -= partySize`.
     2. **Check-In:** Does **NOT** increment capacity again; capacity was already reserved.
     3. **Cancellation:** Atomically releases capacity: `currentVisitorsCount -= partySize` and `remainingCapacity += partySize`.
     4. **Completion:** Does **NOT** alter capacity; historical slot record is preserved.
2. **UTC-Aligned Slots vs Local Time:**
   - Capacity slots are strictly **UTC-aligned 60-minute buckets** (`slot_<YYYYMMDD>_<HH00>Z`).
   - Local time is used strictly for client UI display (e.g. UTC 14:00 corresponds to "19:30 - 20:30 IST").
   - Developer C's `RouteStopCrowdCheck.scheduledArrival` and `VenueHourlyCapacity.hourSlot` consume ISO 8601 UTC timestamps, maintaining complete cross-system alignment.
3. **Timezone Derivation & Places API Field Mask:**
   - Primary request uses `X-Goog-FieldMask: timeZone,location` on Google Places API (New) Place Details.
   - Falls back to Google Maps Time Zone API (`/maps/api/timezone/json?location=lat,lng&timestamp=...`) if `timeZone` is omitted by Places API.
   - Do not rely on `utcOffsetMinutes` alone to identify an IANA timezone.
   - If timezone metadata is missing, booking is strictly rejected with `FAILED_PRECONDITION`. Silent default timezones are prohibited.
4. **Threshold Agreement:**
   - Thresholds strictly measure **remaining capacity percentage**:
     - $\text{remainingCapacity} \le 0$ â†’ `AT_CAPACITY` (`isThrottled = true`)
     - $0 < \text{remainingPercentage} < 30.0\%$ â†’ `HIGH` (`isThrottled = false`)
     - $30.0\% \le \text{remainingPercentage} \le 60.0\%$ â†’ `MODERATE` (`isThrottled = false`)
     - $\text{remainingPercentage} > 60.0\%$ â†’ `LOW` (`isThrottled = false`)

---

## 4. Developer D Coordination (Callable Conventions & Envelopes)

### Agreements:
1. **API Envelope Format:**
   - Success responses adhere to A2 canonical envelope:
     ```json
     {
       "success": true,
       "data": { ... },
       "metadata": {
         "requestId": "...",
         "timestamp": "...",
         "executionDurationMs": 12,
         "version": "A4"
       }
     }
     ```
2. **Booking Callables Interface (Proposed):**
   - `Capacity.getHourlyCapacity({ placeId, slotId })` (Implemented)
   - `Capacity.bookScheduledVisit({ placeId, slotId, partySize, idempotencyKey, groupSessionId? })` (Proposed)
   - `Capacity.cancelScheduledVisit({ visitId })` (Proposed)
   - `Capacity.checkInScheduledVisit({ visitId, travelerCoordinate? })` (Proposed)
3. **Arrival Verification Disclosures:**
   - Client-submitted GPS coordinates provide only a proximity check (within 150m geofence), not tamper-proof proof of arrival.
   - QR-based verification will be supported as a separate merchant/physical confirmation option where required.

---

## 5. Technical Decision: Transaction-Safe Idempotency & Validation

* **Deterministic Reservation Key:**
  ```typescript
  visitId = "visit_" + sha256(`${travelerId}:${idempotencyKey}`).slice(0, 20)
  ```
* **Validation on Reuse:**
  - If a reservation already exists with matching `(travelerId, idempotencyKey)`:
    - Verifies that `(placeId, slotId, partySize)` exactly match the existing reservation.
    - If parameters mismatch, rejects with `already-exists` (`Idempotency key previously used with different booking parameters`).
    - If parameters match and status is `CONFIRMED`, safely returns the existing reservation without duplicate capacity deduction.
    - If status is `CANCELLED`, rejects re-using the idempotency key for a new booking.

---

## 6. Status of A4 Modules

| Module | Status | Verification |
| :--- | :---: | :--- |
| **Traveler Preferences CRUD** | **COMPLETE** | Verified by unit tests & schema validation |
| **Group Sessions & Membership** | **COMPLETE** | Verified by unit tests (code gen, weighting, lifecycle) |
| **Consensus Blend Persistence** | **COMPLETE** | Verified by unit tests (`ConsensusBlendOutputSchema`) |
| **Capacity & Crowd Level Calculation** | **COMPLETE** | Verified by unit tests (exact 4-bracket math) |
| **Final Proposed ScheduledVisitDocument Spec** | **SUBMITTED** | Awaiting review/approval |
| **Transactional Booking & Cancellation** | **HELD** | Awaiting proposal approval |
| **Dependent Firestore Security Rules** | **HELD** | Awaiting proposal approval |
