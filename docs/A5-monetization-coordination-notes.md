# Task A5 Coordination Notes — Contributor Ecosystem & Monetization Backend

**Developer:** Developer A (Backend, Firebase, Shared Contracts and Integration Lead)  
**Task ID:** A5  
**Branch:** `feature/A5-contributor-monetization-backend`  
**Date:** 2026-11-20  

---

## 1. Scope & Delivered Architecture

Task A5 delivers the complete backend, persistence, security, and callable API layer for community contributor micro-tipping, reward ledger accounting, route pass purchasing/verification, and partner merchant subscriptions.

### Delivered Components:
1. **Firestore Security Rules:** Dedicated rules in `firestore.rules` for `tips/{tipId}`, `contributor_rewards/{userId}`, `passes/{passId}`, `subscriptions/{subscriptionId}`, and `users/{userId}/contributor_profile`.
2. **Pluggable Payment Gateway Architecture:** Clean `PaymentGatewayAdapter` interface with a robust, production-isolated `SandboxPaymentAdapter`.
3. **Transactional Event-Log & Materialized Balance Accounting:** Deterministic double-check idempotency, zero double-crediting on webhooks/retries, and strict invariant validation.
4. **Route Pass Access Engine:** Tiered pricing, durations, audio/offline perk allocation, and route-level verification.
5. **Partner Merchant Privacy Barrier:** Public offer sanitization stripping private merchant contact emails and billing references.
6. **Public Contributor Attribution:** Community scout to heritage sage gamification, milestone badges, and approved gem counts separated from private financial ledgers.
7. **Firebase v2 Callable Functions:** Independent authentication, authorization, and validation wrapped in canonical A2 `ApiSuccessResponse` and `ApiErrorResponse` envelopes.

---

## 2. Agreed Accounting Model & Invariants

### The Model: Transactional Event-Log & Materialized Balance
- **Transaction Event Log (`tips/{tipId}`):** Every tip is an immutable document storing `payerUserId`, `recipientUserId`, `spotId`, `amountInr`, `platformFeeInr`, `contributorNetInr`, `paymentMode`, and `paymentStatus`.
- **Materialized Contributor Ledger (`contributor_rewards/{userId}`):** Tracks cumulative lifetime earnings, available balance for withdrawal, total withdrawn, and gamified reputation points.

### Strict Invariants Enforced in Firestore Transactions:
1. $\text{totalEarningsInr} = \text{availableBalanceInr} + \text{withdrawnTotalInr}$
2. $\text{availableBalanceInr} \ge 0$ (negative balances are strictly prohibited)
3. $\text{contributorNetInr} = \text{amountInr} - \text{platformFeeInr} > 0$

### Refund, Reversal & Adjustment Accounting:
- When a tip is reversed or refunded:
  - If $\text{availableBalanceInr} \ge \text{contributorNetInr}$: the net amount is deducted from both `availableBalanceInr` and `totalEarningsInr`.
  - If $\text{availableBalanceInr} < \text{contributorNetInr}$ (because the contributor already withdrew their earnings): `availableBalanceInr` is set to $0$ (preserving $\text{availableBalanceInr} \ge 0$), and the remaining unrecovered delta is tracked in `unrecoveredAdjustmentInr` to be offset against future tip earnings.

### Idempotency Protection:
- Settlement checks current `paymentStatus`. If already `'COMPLETED'`, the existing record is returned immediately with `isIdempotentReplay: true` without re-crediting the balance.
- Webhook retries or duplicate network requests cannot mint duplicate balances.

---

## 3. Sandbox Payment Gateway Isolation

1. **Strict Mode Separation:** All monetary transaction documents carry `paymentMode: 'SANDBOX' | 'LIVE'`.
2. **Deterministic Gateway References:** Sandbox references strictly use the prefix:
   - Micro-tips: `sandbox_sim_upi_<hash>`
   - Route passes: `sandbox_sim_pass_<hash>`
3. **No False Claims:** Simulated UPI payment intents and mock QR codes (`SANDBOX_MOCK_QR_...`) are strictly marked `isSimulated: true` and are never routed to live banking rails.
4. **Protection Against Arbitrary Minting:** Sandbox settlement requires an existing, recorded, valid `INITIATED` tip document with server-computed platform fees and net amounts. The client cannot inject arbitrary credit amounts.

---

## 4. Route Passes & Partner Merchant Subscriptions

### Route Pass Tier Matrix:
| Tier | Price (INR) | Validity Duration | Perks Included |
| :--- | :---: | :---: | :--- |
| `SINGLE_ROUTE` | ₹99 | 48 Hours | Audio Guidance, Offline Pack, 5% Partner Discount |
| `NEIGHBORHOOD_ALL_ACCESS` | ₹299 | 7 Days | Audio Guidance, Offline Pack, 10% Partner Discount |
| `ANNUAL_EXPLORER` | ₹999 | 365 Days | Audio Guidance, Offline Pack, 20% Partner Discount across all neighborhoods |

### Partner Merchant Privacy:
- Public queries to `getPublicPartnerMerchantOffer` return:
  `{ merchantPlaceId, businessName, subscriptionPlan, activeDiscountOffer, isActive }`
- Private billing details (e.g. `contactEmail`, subscription internal IDs) are strictly excluded from public responses.

---

## 5. Client Callable APIs for Developer D (Task D6 Integration)

All callables require `request.auth != null` and return canonical A2 envelopes:

### 1. `initiateTip`
* **Request:** `{ recipientUserId: string, spotId: string, spotName: string, amountInr: number, personalNote?: string }`
* **Response `data`:** `{ tip: ContributorTipDocument, paymentIntent: PaymentIntentResult }`
* **Errors:** `unauthenticated`, `invalid-argument` (e.g. self-tipping, invalid amount).

### 2. `settleTip`
* **Request:** `{ tipId: string, simulatedOutcome?: 'SUCCESS' | 'FAILURE' }`
* **Response `data`:** `{ tip: ContributorTipDocument, rewardLedger: ContributorRewardLedger, isIdempotentReplay: boolean }`
* **Errors:** `unauthenticated`, `permission-denied` (if caller is not payer/admin), `failed-precondition`.

### 3. `getContributorRewardSummary`
* **Request:** `{ userId?: string }` (defaults to caller UID)
* **Response `data`:** `ContributorRewardLedger`
* **Errors:** `unauthenticated`, `permission-denied` (cannot inspect other users' balances without admin role).

### 4. `purchaseRoutePass`
* **Request:** `{ tier: PassTier, neighborhood: string, accessibleRouteIds?: string[] }`
* **Response `data`:** `{ pass: RoutePassDocument, paymentIntent: PaymentIntentResult }`
* **Errors:** `unauthenticated`, `invalid-argument`.

### 5. `verifyRoutePassAccess`
* **Request:** `{ routeId?: string, neighborhood?: string }`
* **Response `data`:** `{ hasAccess: boolean, unlockedAudio: boolean, unlockedOfflinePack: boolean, partnerDiscountPercent: number, grantingPassId?: string }`

### 6. `listUserPasses`
* **Request:** `{}`
* **Response `data`:** `RoutePassDocument[]`

### 7. `getPublicPartnerMerchantOffer`
* **Request:** `{ merchantPlaceId: string }`
* **Response `data`:** `PublicPartnerOffer | null`

### 8. `getContributorAttribution`
* **Request:** `{ userId: string }`
* **Response `data`:** `ContributorAttribution`

---

## 6. Verification Status

* **Static Analysis:** `tsc --noEmit` passed with 0 errors.
* **Unit Test Suite:** 155 automated tests passing across contracts, maps, ai, contributions, preferences, groups, capacity, and monetization.
* **Emulator/Deployment Status:** Unexecuted (as per guidelines; unit tests execute in Node.js test runner with in-memory validation).
* **Git Cleanliness:** On branch `feature/A5-contributor-monetization-backend`, ready for review.
