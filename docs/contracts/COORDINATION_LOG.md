# Team Coordination Log & Interface Alignment

**Task Reference:** Task A2 - Shared Data Models and API Contracts
**Coordinator:** Developer A (Backend Infrastructure & Canonical Contracts)
**Stakeholders:** Developer B (AI Integration), Developer C (Maps & Routing), Developer D (Flutter Client & Offline Storage)
**Status Date:** 2026-11-20

---

## 1. Domain Coverage & Owner Agreement Status

| # | Domain | Primary Owners | Status | Verification Reference |
| :---: | :--- | :--- | :---: | :--- |
| **01** | **Users & Roles** | Developer A & D | **AGREED** | Aligned with D1 Firebase Auth & Flutter profile state. |
| **02** | **Traveler Preferences** | Developer A, B & D | **AGREED** | Reconciled with D1 `VibeChipSelector` & B1 taste matching. |
| **03** | **Local Contributions** | Developer A, B, C & D | **AGREED** | Reconciled with D1 `toSubmissionMap()` & B1 extraction format. |
| **04** | **Voice & Photo Assets** | Developer A, B & D | **AGREED** | Reconciled with B1 `VoicePhotoExtractionSchema` & Cloud Storage paths. |
| **05** | **Contributor Attribution & Verification** | Developer A & D | **AGREED** | Reconciled with public spot-card attribution & reputation tiers. |
| **06** | **Structured Places & Spot Cards** | Developer A, B, C & D | **AGREED** | Bridges C1 `NormalizedPlace`, B1 `AuthenticityAssessment`, D1 `SpotCard` & Drift `LocalSpots`. |
| **07** | **Venue Capacity & Alternatives** | Developer A & C | **AGREED** | Reconciled with C1 `VenueHourlyCapacity` & crowd thresholds. |
| **08** | **Routes & Route Stops** | Developer A, C & D | **AGREED** | Reconciled with C1 `WalkingRoute` & D1 walking mode UI. |
| **09** | **Groups & Taste-Matching** | Developer A, B & D | **AGREED** | Aligned with B1 `GroupPreferenceBlendSchema` & D1 group screen. |
| **10** | **Offline Neighborhood Packs** | Developer A & D | **AGREED** | Reconciled with D1 Drift SQLite `app_database.dart` bulk insertion. |
| **11** | **Contributor Rewards & Tips** | Developer A & D | **AGREED** | Reconciled accounting model (event log + balance), sandbox simulation isolation, and Flutter tip sheet integration. |
| **12** | **Route Passes & Subscriptions** | Developer A, C & D | **AGREED** | Reconciled route pass tiers, route ID access check, merchant subscription schema, and sandbox isolation. |

---

## 2. Review Requests & Specific Coordination Inputs

### Developer B (AI Models & Gemini Integration)
- **Inputs Reviewed from B1:**
  - `functions/src/ai/schemas/types.ts`: `AuthenticityAssessmentSchema`, `VoicePhotoExtractionSchema`, `GroupPreferenceBlendSchema`.
  - B1's explicit note: *"During Task B2, Developer B will reconcile and map these preliminary AI output schemas directly to Developer A's canonical contribution and place schema contracts established under Task A2."*
- **A2 Alignment Action:**
  - Embedded B1's authenticity output (`authenticityScore`, `touristTrapLikelihood`, `localSentimentSummary`, `recommendedTiming`, `practicalTips`, `greetingCard`, `vibeTags`) directly into `CanonicalPlaceDocument.authenticity` (Domain 06).
  - Adopted B1's extraction fields (`detectedLanguage`, `transcription`, `englishTranslation`, `practicalDetails`, `cashOnlyWarning`, `signatureDishesOrItems`) directly into `VoicePhotoAssetDocument` (Domain 04) and `ContributionDocument` (Domain 03).
  - Adopted B1's group blend output (`consensusAtmosphere`, `dietaryConstraintsUnion`, `budgetConsensusRange`, `compromiseFactors`, `individualWeightings`) directly into `GroupSessionDocument.consensusBlend` (Domain 09).

### Developer C (Maps Platform, Places & Routing Engine)
- **Inputs Reviewed from C1:**
  - `contracts/shared-models-coordination.md`: Proposed `NormalizedCoordinate`, `NormalizedPlace`, `WalkingRoute`, `VenueHourlyCapacity`, and `DisruptionInput`.
  - `functions/src/maps/types/`: Verified 6-decimal coordinate normalization, distance calculations, and geodesic fallback handling.
- **A2 Alignment Action:**
  - Adopted `NormalizedCoordinate` as the standard spatial schema across all Firestore collections (`latitude`, `longitude`, `precision: 6`, `formatted`, `geohash`, `isValid`).
  - Adopted `NormalizedPlace` core fields (`placeId`, `formattedAddress`, `primaryCategory`, `categories`, `isOpenNow`, `openHours`) into `CanonicalPlaceDocument` (Domain 06).
  - Adopted `WalkingRoute` structure (`origin`, `destination`, `waypoints`, `optimizedWaypointOrder`, `totalDistanceMeters`, `totalDurationSeconds`, `encodedPolyline`, `legs`, `steps`) into `CanonicalRouteDocument` (Domain 08).
  - Adopted `VenueHourlyCapacity` (`maxCapacity`, `currentVisitorsCount`, `remainingCapacity`, `level`, `isThrottled`) into `VenueHourlyCapacityDocument` (Domain 07).

### Developer D (Flutter Client, Drift SQLite & Android Native)
- **Inputs Reviewed from D1:**
  - `lib/models/spot_card.dart`: Client `SpotCard` fields, `fromMap`, `toSubmissionMap`.
  - `lib/database/app_database.dart`: Drift SQLite table `LocalSpots` (`locallens_offline.sqlite`).
  - `contracts/client-location-interface.md`: Android permissions, `UserLocation` class, turn-by-turn prompts.
- **A2 Alignment Action:**
  - Verified 1:1 field compatibility between canonical `CanonicalPlaceDocument` and `SpotCard`.
  - Mapped `OfflineSpotItem` directly to Drift `LocalSpotsCompanion` fields (`photoUrlsJson`, `vibeTagsJson`, `practicalTips`, `greetingCard`, `isTouristTrap`, `hourlyLimit`, `currentVisitors`).
  - Aligned `ContributionDocument.submission` with `toSubmissionMap()` (`mapsLink`, `infoParagraph`, `photoUrls`).
- **A5 Monetization & Rewards Alignment (Domains 11 & 12):**
  - **Accounting Model:** Agreed on a Transactional Event-Log & Materialized Balance Model (`tips/{tipId}` as transaction event log + `contributor_rewards/{userId}` as balance summary) with atomic Firestore transaction mutations instead of multi-entity double-entry complexity.
  - **Sandbox Simulation Isolation:** Added mandatory `paymentMode: 'SANDBOX' | 'LIVE'` to all tip, pass, and subscription contracts. Sandbox references strictly use `sandbox_sim_...` prefix; no simulated transaction is ever represented as a real banking or UPI payment.
  - **No Residency Tracking:** Confirmed that contributor reputation and badges are tied strictly to community curation quality, approved spots, and traveler tips. No invasive residency verification, geofencing, or document upload is introduced.
  - **Pass Tiers & Access:** Agreed on tiers (`SINGLE_ROUTE`, `NEIGHBORHOOD_ALL_ACCESS`, `ANNUAL_EXPLORER`) and canonical route validation matching Developer C's `routeId` and `neighborhood`.
  - **Independent Authorization:** Cloud Functions enforce `request.auth`, ownership (cannot tip self, cannot read other users' reward ledgers without admin role), and bounds validation at the callable layer.

---

## 3. List of Unresolved Decisions & Limitations

1. **Payment Gateway Provider (Domain 11 & 12):**
   - UPI integration for micro-tipping (`ContributorTipDocument`) and route passes (`RoutePassDocument`) uses abstract transaction reference fields (`paymentGatewayReference`). Selection of the live payment partner (e.g. Razorpay vs Cashfree) is deferred to the monetization implementation task.
2. **Audio File Transcoding (Domain 04):**
   - Developer D's client records audio in `.m4a` / AAC format. Cloud Functions will receive this directly and pass the audio bytes to Gemini 3.8 Flash multimodal API. No server-side ffmpeg transcoding is planned unless required by Gemini.
3. **Dynamic Geohash Precision (Domain 06 & 08):**
   - Canonical coordinates include an optional `geohash` string. Geohash queries for bounding-box search will be standardized in Task A3/A4 Firestore indices.
