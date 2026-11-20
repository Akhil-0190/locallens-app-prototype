# Domain 12: Route Passes, Payments & Partner Subscriptions

**Contract Reference:** `docs/contracts/12-route-passes-and-subscriptions.md`  
**Firestore Collections:** `passes/{passId}`, `subscriptions/{subscriptionId}`  
**Primary Stakeholders:** Developer A (Backend Monetization), Developer D (Flutter Pass & Checkout UI), Developer C (Route & Place IDs)  
**Sample Payloads:** 
- [docs/contracts/samples/12-route-pass-subscription.sample.json](file:///d:/Judah/Projects/Hackthon/Google/BuildathonNew/neighborhoodguideapp/docs/contracts/samples/12-route-pass-subscription.sample.json)
- [docs/contracts/samples/12-partner-merchant-subscription.sample.json](file:///d:/Judah/Projects/Hackthon/Google/BuildathonNew/neighborhoodguideapp/docs/contracts/samples/12-partner-merchant-subscription.sample.json)

---

## 1. Scope & Ownership
Governs premium neighborhood walking route passes (unlocking audio walking co-pilot, curated offline maps, and exclusive artisan/stall discounts) and local merchant partner subscriptions.

---

## 2. Canonical TypeScript Interface

```typescript
export type PaymentMode = 'SANDBOX' | 'LIVE';
export type PassTier = 'SINGLE_ROUTE' | 'NEIGHBORHOOD_ALL_ACCESS' | 'ANNUAL_EXPLORER';
export type PassStatus = 'PENDING' | 'ACTIVE' | 'EXPIRED' | 'REVOKED';

export interface RoutePassDocument {
  passId: string;                       // Unique pass UUID (prefix: pass_)
  userId: string;                       // Buyer UID
  tier: PassTier;
  neighborhood: string;                 // e.g. "Malleshwaram"
  accessibleRouteIds: string[];         // Routes unlocked by this pass (Domain 08 routeIds)
  pricePaidInr: number;                 // Amount in INR (>= 0)
  currency: string;                     // "INR"
  paymentMode: PaymentMode;             // 'SANDBOX' or 'LIVE'
  paymentGatewayReference?: string;     // Gateway ref (sandbox: "sandbox_sim_pass_...")
  status: PassStatus;
  perksIncluded: {
    audioGuidanceUnlocked: boolean;
    offlinePackUnlocked: boolean;
    merchantPartnerDiscountPercent: number; // e.g. 10% discount at partner stalls
  };
  validFrom: string;                    // ISO 8601 UTC
  validUntil: string;                   // ISO 8601 UTC
  purchasedAt: string;                  // ISO 8601 UTC
}

export type MerchantPlanTier = 'COMMUNITY_FREE' | 'VERIFIED_PARTNER' | 'FEATURED_HERITAGE';

export interface PartnerMerchantSubscription {
  subscriptionId: string;               // Unique sub UUID (prefix: sub_)
  ownerUserId?: string;                 // Authenticated Firebase UID of merchant owner
  merchantPlaceId: string;              // Canonical placeId (Domain 06)
  businessName: string;
  contactEmail: string;
  subscriptionPlan: MerchantPlanTier;
  activeDiscountOffer?: {
    discountPercent: number;
    terms: string;                      // e.g. "Free filter coffee with any breakfast thali"
  };
  paymentMode: PaymentMode;             // 'SANDBOX' or 'LIVE'
  paymentGatewayReference?: string;     // Gateway transaction ref (sandbox: "sandbox_sim_sub_...")
  isActive: boolean;                    // true for COMMUNITY_FREE; false for paid plans until confirmed
  expiresAt: string;                    // ISO 8601 UTC
  createdAt: string;                    // ISO 8601 UTC
  updatedAt: string;                    // ISO 8601 UTC
}
```

---

## 3. Route Access Verification Logic

When a traveler initiates audio navigation (Domain 08) or downloads an offline pack (Domain 10), access eligibility is determined by:
1. Finding an active pass for `userId` where `status === 'ACTIVE'` and `validUntil > now()`.
2. Verifying pass tier and route eligibility:
   - `ANNUAL_EXPLORER`: Unlocks all routes and neighborhoods globally.
   - `NEIGHBORHOOD_ALL_ACCESS`: Unlocks any route matching `pass.neighborhood`.
   - `SINGLE_ROUTE`: Unlocks if `accessibleRouteIds.includes(requestedRouteId)`.

---

## 4. Sandbox Payment Isolation & Durable Idempotency

1. **Strict Mode Attribute:** All passes and subscriptions record `paymentMode: 'SANDBOX' | 'LIVE'`.
2. **Explicit Reference Naming:** Sandbox transactions carry `sandbox_sim_...` references.
3. **Transparent Status:** Mock activation does not generate bank settlement or fake gateway claims.
4. **Durable Sandbox Refund Idempotency:** Sandbox simulated refunds are durably persisted to `_sandbox_simulated_refunds/{idempotencyKey}` via atomic Firestore transactions, ensuring cross-instance idempotency and resilience to Cloud Functions cold-starts or restarts without double-disbursement.

---

## 5. Callable Functions & Server-Side Security

1. **Authentication & Ownership:**
   - Callables independently verify `request.auth != null`.
   - Passes are strictly created under `userId = request.auth.uid`.
   - Partner merchant subscriptions bind strictly to `ownerUserId = request.auth.uid` during registration.
   - Only admin users may modify or revoke passes out-of-band.
2. **Endpoints:**
   - `purchaseRoutePass({ tier, neighborhood, accessibleRouteIds?, mode? })`
   - `verifyRoutePassAccess({ routeId, neighborhood? })`
   - `listUserPasses()`
   - `registerPartnerSubscription({ merchantPlaceId, businessName, contactEmail, subscriptionPlan, activeDiscountOffer?, durationDays? })`
   - `confirmPartnerSubscriptionPayment({ subscriptionId, simulatedOutcome? })`
   - `getPublicPartnerOffer({ merchantPlaceId })`

---

## 6. Partner Merchant Subscription Lifecycle & Payment Gating (A5-V-04)

1. **Tier Pricing & Gating:**
   - `COMMUNITY_FREE`: ₹0 — Activates immediately upon registration (`isActive: true`).
   - `VERIFIED_PARTNER`: ₹999/year — Initial status `isActive: false`, `isPendingPayment: true`.
   - `FEATURED_HERITAGE`: ₹2,499/year — Initial status `isActive: false`, `isPendingPayment: true`.
2. **Server-Side Activation Guard:**
   - Paid tiers are only activated (`isActive: true`) via `confirmPartnerSubscriptionPayment` after adapter payment verification and fail-closed environment validation.
   - Public discount offers are strictly filtered on `isActive === true` and valid expiration, ensuring unconfirmed subscriptions cannot be published.
3. **Idempotency & Verified Ownership Authorization:**
   - Replay confirmation returns `isIdempotentReplay: true` without duplicate mutations.
   - **Ownership Model:** Registration captures `ownerUserId = request.auth.uid` directly from the authenticated context. Client attempts to supply an arbitrary owner UID are strictly ignored.
   - **Payment Confirmation Guard:** Restricts confirmation to `sub.ownerUserId === request.auth.uid` or an administrator/moderator (`request.auth.token.role in ['admin', 'moderator']`).
   - **Legacy Record Migration:** Existing subscriptions predating the `ownerUserId` field cannot be activated by unverified callers. Non-admin confirmation attempts on unassigned records throw `"Unauthorized: Subscription lacks a verified owner association. An administrator must verify and migrate this legacy record."` Administrators can confirm or backfill legacy records securely.
