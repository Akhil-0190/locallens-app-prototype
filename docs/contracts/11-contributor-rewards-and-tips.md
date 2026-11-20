# Domain 11: Contributor Rewards, Tips & Guidance

**Contract Reference:** `docs/contracts/11-contributor-rewards-and-tips.md`
**Firestore Collections:** `tips/{tipId}`, `contributor_rewards/{userId}`
**Primary Stakeholders:** Developer A (Backend Payments & Gamification), Developer D (Flutter Tip Sheet)
**Sample Payload:** [docs/contracts/samples/11-contributor-reward-tip.sample.json](file:///d:/Judah/Projects/Hackthon/Google/BuildathonNew/neighborhoodguideapp/docs/contracts/samples/11-contributor-reward-tip.sample.json)

---

## 1. Scope & Ownership
Enables grateful travelers to send micro-tips directly to local contributors whose insider spots they visited, and tracks community guidance rewards.

---

## 2. Canonical TypeScript Interface

```typescript
export type TipPaymentStatus = 'INITIATED' | 'COMPLETED' | 'FAILED' | 'DISBURSED';

export interface ContributorTipDocument {
  tipId: string;                        // Unique tip UUID
  payerUserId: string;                  // Traveler UID
  recipientUserId: string;              // Local Contributor UID
  spotId: string;                       // Related spot ID
  spotName: string;                     // For receipt & UI display
  amountInr: number;                    // Tip amount in INR (e.g. 50, 100, 200)
  platformFeeInr: number;               // Transparent nominal fee
  contributorNetInr: number;            // amountInr - platformFeeInr
  currency: string;                     // "INR"
  paymentStatus: TipPaymentStatus;
  paymentGatewayReference?: string;     // UPI / Payment Gateway Transaction ID
  personalNote?: string;                // Traveler thank-you note
  createdAt: string;                    // ISO 8601 UTC
  settledAt?: string;                   // ISO 8601 UTC
}

export interface ContributorRewardLedger {
  userId: string;
  totalEarningsInr: number;
  availableBalanceInr: number;
  withdrawnTotalInr: number;
  payoutUpiId?: string;                 // Encrypted contributor payout UPI ID
  reputationPoints: number;
  guidanceRank: string;                 // e.g. "Malleshwaram Heritage Master"
  lastPayoutAt?: string;
  updatedAt: string;
}
```
