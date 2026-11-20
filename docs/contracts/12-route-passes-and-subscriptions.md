# Domain 12: Route Passes, Payments & Partner Subscriptions

**Contract Reference:** `docs/contracts/12-route-passes-and-subscriptions.md`
**Firestore Collections:** `passes/{passId}`, `subscriptions/{subscriptionId}`
**Primary Stakeholders:** Developer A (Backend Monetization), Developer D (Flutter Checkout & Pass Screen)
**Sample Payload:** [docs/contracts/samples/12-route-pass-subscription.sample.json](file:///d:/Judah/Projects/Hackthon/Google/BuildathonNew/neighborhoodguideapp/docs/contracts/samples/12-route-pass-subscription.sample.json)

---

## 1. Scope & Ownership
Governs premium neighborhood route passes (unlocking audio walking co-pilot, curated offline maps, and exclusive artisan discounts) and local merchant partner subscriptions.

---

## 2. Canonical TypeScript Interface

```typescript
export type PassTier = 'SINGLE_ROUTE' | 'NEIGHBORHOOD_ALL_ACCESS' | 'ANNUAL_EXPLORER';
export type PassStatus = 'ACTIVE' | 'EXPIRED' | 'REVOKED';

export interface RoutePassDocument {
  passId: string;                       // Unique pass UUID
  userId: string;                       // Buyer UID
  tier: PassTier;
  neighborhood: string;                 // e.g. "Malleshwaram"
  accessibleRouteIds: string[];         // Routes unlocked by this pass
  pricePaidInr: number;
  currency: string;                     // "INR"
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

export interface PartnerMerchantSubscription {
  subscriptionId: string;
  merchantPlaceId: string;              // Canonical placeId
  businessName: string;
  contactEmail: string;
  subscriptionPlan: 'COMMUNITY_FREE' | 'VERIFIED_PARTNER' | 'FEATURED_HERITAGE';
  activeDiscountOffer?: {
    discountPercent: number;
    terms: string;                      // e.g. "Free filter coffee with any breakfast thali"
  };
  isActive: boolean;
  expiresAt: string;
  createdAt: string;
}
```
