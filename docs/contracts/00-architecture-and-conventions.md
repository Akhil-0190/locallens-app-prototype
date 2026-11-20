# Shared Architecture & API Conventions

**Document Reference:** `docs/contracts/00-architecture-and-conventions.md`
**Author:** Developer A (Backend Infrastructure & Canonical Contracts)
**Target:** Developers B (AI), C (Maps), D (Flutter Client)

---

## 1. Firestore Collection & Document Conventions

### A. Collection Hierarchy & Naming
- All collection names use `snake_case` plural nouns.
- Top-level collections:
  - `users/{userId}`: User accounts and authentication profiles.
  - `preferences/{userId}`: Detailed personalization and dietary vectors.
  - `contributions/{contributionId}`: Unverified & verified community gem submissions.
  - `places/{placeId}`: Canonical verified neighborhood places.
  - `places/{placeId}/hourly_capacities/{slotId}`: Real-time hourly crowd tracking.
  - `routes/{routeId}`: Pedestrian walking routes and itineraries.
  - `disruptions/{disruptionId}`: Weather and congestion dynamic reroutes.
  - `group_sessions/{sessionId}`: Collaborative group taste-matching sessions.
  - `offline_packs/{packId}`: Offline downloadable neighborhood packs.
  - `tips/{tipId}`: Micro-tipping transactions to local contributors.
  - `passes/{passId}`: Paid route passes and partner merchant subscriptions.
  - `audit_logs/{logId}`: Security and moderation audit events.

### B. Identifier Prefix Scheme
All document IDs are universally unique strings prefixed by domain entity type:
- `usr_<nanoid>`: User profiles (or Firebase Auth UID)
- `contrib_<nanoid>`: Community contributions
- `place_<nanoid>`: Canonical place records (or Google Place ID `ChIJ...`)
- `route_<nanoid>`: Pedestrian routes
- `slot_<timestamp_hour>`: Hourly capacity records (e.g. `slot_20261120_1400`)
- `sess_<nanoid>`: Group planning sessions
- `pack_<neighborhood>_<v>`: Offline pack manifest
- `tip_<nanoid>`: Contributor tip records
- `pass_<nanoid>`: Route passes / subscriptions

### C. Timestamps
- All persisted timestamps are strict **ISO 8601 UTC strings** formatted as `YYYY-MM-DDTHH:mm:ss.sssZ`.
- Client and server timestamps are normalized to UTC before Firestore storage or API serialization.
- Every mutable document contains `createdAt` and `updatedAt`.

### D. Ownership and Attribution
- Every user-created record stores `createdBy` (Firebase Auth UID).
- Modified records track `updatedBy`.
- Contributed places preserve `contributorId` and `attributionDisplayName` for public credit.

---

## 2. API Request & Response Conventions

All Cloud Functions callable and HTTPS endpoints return a standardized envelope.

### A. Successful Response Envelope (`ApiResponse<T>`)
```typescript
export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  metadata: {
    requestId: string;
    timestamp: string;          // ISO 8601
    executionDurationMs: number;
    version: string;
  };
}
```

### B. Error Response Envelope (`ApiErrorResponse`)
```typescript
export type ErrorCategory =
  | 'VALIDATION_ERROR'
  | 'AUTHENTICATION_REQUIRED'
  | 'PERMISSION_DENIED'
  | 'NOT_FOUND'
  | 'CAPACITY_EXCEEDED'
  | 'AI_PROCESSING_ERROR'
  | 'MAPS_QUOTA_ERROR'
  | 'TRANSIENT_SERVER_ERROR';

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;               // e.g. "CAPACITY_THROTTLED", "INVALID_COORDINATES"
    category: ErrorCategory;
    message: string;            // Human-readable error description
    details?: Record<string, unknown>;
    retryable: boolean;         // True if client should retry with exponential backoff
  };
  metadata: {
    requestId: string;
    timestamp: string;
  };
}
```

---

## 3. Versioning & Backward Compatibility
- Schema modifications must remain backward-compatible by defaulting new fields.
- Breaking schema changes require coordination across Developers A, B, C, and D, documented in `COORDINATION_LOG.md`.
