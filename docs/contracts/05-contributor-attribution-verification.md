# Domain 05: Contributor Attribution & Verification

**Contract Reference:** `docs/contracts/05-contributor-attribution-verification.md`
**Firestore Subcollection / Document:** `users/{userId}/contributor_profile` & `contributions/{contributionId}/audit_trail`
**Primary Stakeholders:** Developer A (Backend Credibility & Audit), Developer D (Flutter Contributor Screen)
**Sample Payload:** [docs/contracts/samples/05-contributor-verification.sample.json](file:///d:/Judah/Projects/Hackthon/Google/BuildathonNew/neighborhoodguideapp/docs/contracts/samples/05-contributor-verification.sample.json)

---

## 1. Scope & Ownership
Tracks local resident credibility, badges, authenticity verification scores, and public attribution on approved spot cards.

---

## 2. Canonical TypeScript Interface

```typescript
export type ContributorTier = 'LOCAL_RESIDENT' | 'HERITAGE_SAGE' | 'COMMUNITY_PILLAR' | 'COMMUNITY_SCOUT';

export interface ContributorVerificationProfile {
  userId: string;
  contributorTier: ContributorTier;
  reputationPoints: number;             // Gamified points earned per approved gem
  spotsSubmittedCount: number;
  spotsApprovedCount: number;
  accuracyRate: number;                 // (approved / submitted) as decimal 0.0 - 1.0
  isVerifiedResident: boolean;          // Neighborhood residency verified
  neighborhoodOfResidency: string;      // e.g. "Malleshwaram"
  earnedBadges: {
    badgeId: string;                    // e.g. "NEIGHBORHOOD_INSIDER", "FILTER_COFFEE_CONNOISSEUR"
    title: string;
    description: string;
    awardedAt: string;                  // ISO 8601 UTC
  }[];
  totalTipsReceivedInr: number;         // Total micro-tips received from grateful travelers
}

export interface ContributionAuditTrailEntry {
  auditId: string;
  contributionId: string;
  event: 'SUBMITTED' | 'AI_FLAGGED_AUTHENTIC' | 'AI_FLAGGED_TOURIST_TRAP' | 'MODERATOR_APPROVED' | 'MODERATOR_REJECTED';
  actorId: string;                      // 'SYSTEM_AI' or moderator UID
  notes: string;
  timestamp: string;                    // ISO 8601 UTC
}
```

---

## 3. Public Attribution on Spot Cards
Approved spot cards display:
```json
{
  "contributedBy": {
    "userId": "usr_blr_782914",
    "displayName": "Priya Sharma",
    "badgeTitle": "Neighborhood Insider",
    "isVerifiedResident": true
  }
}
```
Ensures community contributors receive transparent, public recognition.
