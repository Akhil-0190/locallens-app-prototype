# Domain 11: Contributor Rewards, Tips & Guidance

**Contract Reference:** `docs/contracts/11-contributor-rewards-and-tips.md`  
**Firestore Collections:** `tips/{tipId}`, `contributor_rewards/{userId}`  
**Primary Stakeholders:** Developer A (Backend Monetization & Accounting), Developer D (Flutter Tip Sheet & Reward Dashboard)  
**Sample Payloads:** 
- [docs/contracts/samples/11-contributor-reward-tip.sample.json](file:///d:/Judah/Projects/Hackthon/Google/BuildathonNew/neighborhoodguideapp/docs/contracts/samples/11-contributor-reward-tip.sample.json)
- [docs/contracts/samples/11-contributor-reward-ledger.sample.json](file:///d:/Judah/Projects/Hackthon/Google/BuildathonNew/neighborhoodguideapp/docs/contracts/samples/11-contributor-reward-ledger.sample.json)

---

## 1. Scope & Ownership
Enables grateful travelers to send micro-tips directly to local community contributors whose curated spots they visited, and tracks community guidance rewards, earnings, and withdrawal balances.

---

## 2. Canonical TypeScript Interfaces

```typescript
export type PaymentMode = 'SANDBOX' | 'LIVE';
export type TipPaymentStatus = 'INITIATED' | 'COMPLETED' | 'FAILED' | 'DISBURSED';

export interface ContributorTipDocument {
  tipId: string;                        // Unique tip UUID (prefix: tip_)
  payerUserId: string;                  // Traveler UID (authenticated sender)
  recipientUserId: string;              // Local Contributor UID (recipient)
  spotId: string;                       // Related spot ID (Domain 06 canonical placeId)
  spotName: string;                     // For receipt & UI display
  amountInr: number;                    // Tip amount in INR (positive integer/float, e.g. 50, 100, 200)
  platformFeeInr: number;               // Nominal fee (e.g. 5% or fixed INR, non-negative)
  contributorNetInr: number;            // Net amount: amountInr - platformFeeInr (positive)
  currency: string;                     // "INR"
  paymentMode: PaymentMode;             // 'SANDBOX' or 'LIVE'
  paymentStatus: TipPaymentStatus;      // State machine status
  paymentGatewayReference?: string;     // Gateway transaction ref (sandbox: "sandbox_sim_upi_...")
  personalNote?: string;                // Traveler thank-you note (max 500 chars)
  createdAt: string;                    // ISO 8601 UTC
  settledAt?: string;                   // ISO 8601 UTC (present when COMPLETED)
}

export interface ContributorRewardLedger {
  userId: string;                       // Contributor UID (document ID)
  totalEarningsInr: number;             // Cumulative historical earnings (INR >= 0)
  availableBalanceInr: number;          // Current withdrawable balance (INR >= 0)
  withdrawnTotalInr: number;            // Total previously disbursed/withdrawn (INR >= 0)
  unrecoveredAdjustmentInr: number;     // Negative debt balance from refunds exceeding available funds (INR >= 0)
  payoutUpiId?: string;                 // Contributor payout UPI ID (e.g. name@bank)
  reputationPoints: number;             // Gamified points earned per approved contribution & tip
  guidanceRank: string;                 // e.g. "Malleshwaram Heritage Master"
  lastPayoutAt?: string;                // ISO 8601 UTC
  updatedAt: string;                    // ISO 8601 UTC
}
```

---

## 3. Agreed Accounting Model: Transactional Event-Log & Materialized Balance

Rather than imposing an over-engineered multi-entity double-entry ledger for simple micro-payments, the agreed accounting model is a **Transactional Event-Log & Materialized Balance Model**:

1. **Source of Truth (Transaction Event Log):**  
   Every tip transaction is stored as an immutable document in `tips/{tipId}`.
2. **Materialized Summary Document:**  
   `contributor_rewards/{userId}` maintains the active balance and cumulative figures.
3. **Strict Invariants:**  
   - $\text{totalEarningsInr} + \text{unrecoveredAdjustmentInr} = \text{availableBalanceInr} + \text{withdrawnTotalInr}$
   - $\text{availableBalanceInr} \ge 0$ (negative available balances are strictly prohibited)
   - $\text{withdrawnTotalInr} \ge 0, \quad \text{unrecoveredAdjustmentInr} \ge 0$
   - $\text{contributorNetInr} = \text{amountInr} - \text{platformFeeInr} > 0$
4. **Refund & Reversal Accounting:**
   - If a tip is refunded when funds remain in available balance ($\text{availableBalanceInr} \ge \text{contributorNetInr}$):
     - $\text{availableBalanceInr} \leftarrow \text{availableBalanceInr} - \text{contributorNetInr}$
     - $\text{totalEarningsInr} \leftarrow \text{totalEarningsInr} - \text{contributorNetInr}$
   - If a tip is refunded after funds have already been withdrawn ($\text{availableBalanceInr} < \text{contributorNetInr}$):
     - Funds cannot be withdrawn backwards from the contributor's bank account.
     - Available balance is capped at $0$ (preserving $\text{availableBalanceInr} \ge 0$).
     - The unrecovered delta is recorded in $\text{unrecoveredAdjustmentInr} \leftarrow \text{unrecoveredAdjustmentInr} + (\text{contributorNetInr} - \text{availableBalanceInr})$.
     - $\text{totalEarningsInr} \leftarrow \text{totalEarningsInr} - \text{contributorNetInr}$.
     - When subsequent tips arrive, $\text{unrecoveredAdjustmentInr}$ is automatically offset and paid down first before any funds are credited to $\text{availableBalanceInr}$.
     - In all cases, the identity $\text{totalEarningsInr} + \text{unrecoveredAdjustmentInr} = \text{availableBalanceInr} + \text{withdrawnTotalInr}$ remains mathematically exact.
4. **Atomic State Mutations:**  
   When a tip transitions to `'COMPLETED'`, Firestore transactions atomically update `tips/{tipId}` and increment `contributor_rewards/{recipientUserId}` (`totalEarningsInr += net`, `availableBalanceInr += net`).
5. **Idempotency Protection:**  
   If a tip is already in `'COMPLETED'` or `'FAILED'`, re-settlement attempts are strictly rejected to prevent double crediting.

---

## 4. Sandbox Payment Simulation vs. Real Payment Isolation

1. **Strict Mode Separation:**  
   All transactions explicitly carry `paymentMode: 'SANDBOX' | 'LIVE'`.
2. **Deterministic Gateway References:**  
   In sandbox mode, gateway references MUST use the explicit prefix `sandbox_sim_...` (e.g., `sandbox_sim_upi_987213892`).
3. **No False Representation:**  
   Simulated UPI intents or mock settlement outcomes must never be represented to the user or logged as real banking transactions.
4. **Future Gateway Extensibility:**  
   The `PaymentGatewayAdapter` interface cleanly isolates gateway interaction so that when live credentials (e.g. Razorpay/Cashfree) are provisioned, live calls route through the real provider without modifying data structures.

---

## 5. Contributor Attribution & No Residency Tracking

In alignment with frozen project requirements:
- Contributor credibility is established through **curation quality, approved submissions, traveler tips, and accuracy metrics**.
- **No residency tracking, geofence surveillance, or identity documentation checks** are introduced.

---

## 6. Callable API & Security Architecture

1. **Independent Server-Side Authorization:**  
   Cloud Functions do NOT rely solely on Firestore security rules. Every callable verifies:
   - `request.auth != null` (Caller must be authenticated).
   - `request.auth.uid !== recipientUserId` (Users cannot tip themselves).
   - Caller cannot inspect another contributor's reward ledger unless granted `ADMIN` or `MODERATOR` role.
2. **Endpoints:**
   - `initiateTip({ recipientUserId, spotId, amountInr, personalNote?, mode? })`
   - `settleTip({ tipId, simulatedOutcome })` (Server enforces payment environment)
   - `getContributorRewardSummary({ userId? })`

---

## 7. One-on-One Paid Local Guidance Lifecycle (A5-V-01)

### 7.1 Guidance Offering Schema
```typescript
interface GuidanceOfferingDocument {
  offeringId: string;
  guideUserId: string;
  neighborhood: string;
  title: string;
  description: string;
  durationMinutes: number; // 15 to 480 mins
  priceInr: number; // ₹100 to ₹10,000
  meetingPoint: string;
  languages: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
```

### 7.2 Guidance Booking Lifecycle & State Machine
```
[Traveler Requests & Pays] ---> REQUESTED (paymentStatus: INITIATED -> COMPLETED)
                                     |
              +----------------------+----------------------+
              |                                             |
     [Guide Accepts]                                 [Guide Rejects]
              |                                             |
              v                                             v
          CONFIRMED                                      REJECTED
              |                                     (paymentStatus: FAILED/REFUND)
    +---------+---------+
    |                   |
[Completed]         [Cancelled]
    |                   |
    v                   v
COMPLETED           CANCELLED
(Escrow credited    (paymentStatus: FAILED/REFUND)
 to guide ledger)
```

### 7.3 Financial Escrow, Refund Concurrency & Ledger Invariant
- Platform Fee: 10%, minimum ₹25 (`priceInr - platformFeeInr = guideNetInr`).
- Upon `completeGuidanceBooking`, `guideNetInr` is credited to `contributor_rewards/{guideUserId}` inside a Firestore transaction.
- If `unrecoveredAdjustmentInr > 0`, net earnings offset clawback debt first.
- Strict invariant enforced:
  $$\text{totalEarningsInr} + \text{unrecoveredAdjustmentInr} = \text{availableBalanceInr} + \text{withdrawnTotalInr}$$
- Guide receives +50 reputation points per completed guidance session.

#### Refund Concurrency, Idempotency & Failure Recovery:
- Rejection and cancellation of paid sessions trigger a genuine payment gateway refund outside the Firestore transaction.
- **Two-Phase Atomic Refund Locking:**
  1. *Phase 1 (Transaction):* Asserts authorization and status, derives deterministic idempotency key (`ref_<bookingId>`), checks that no in-flight refund is active, and atomically sets `refundStatus: 'PENDING'`, `refundIdempotencyKey`, and `refundInitiatedAt`. Concurrent requests seeing `PENDING` within the 60s timeout window are blocked.
  2. *Phase 2 (External Call):* Invokes `paymentAdapter.refundPayment(...)` with `idempotencyKey` outside of any transaction to prevent holding database locks across network operations.
  3. *Phase 3 (Transaction):* Upon adapter confirmation, atomically finalizes document status (`CANCELLED` or `REJECTED`), `paymentStatus: 'FAILED'`, `refundStatus: 'COMPLETED'`, `refundReference`, and `refundedAt`.
- If the external refund fails or throws, `refundStatus` is marked `'FAILED'`. Stale or interrupted operations can be safely recovered via retry with the identical idempotency key without issuing duplicate disbursements.

### 7.4 Callables
- `registerGuidanceOffering`
- `listGuidanceOfferings`
- `requestLocalGuidance`
- `confirmGuidancePayment`
- `acceptGuidanceRequest`
- `rejectGuidanceRequest`
- `cancelGuidanceBooking`
- `completeGuidanceBooking`
- `getGuidanceBooking`
- `listMyGuidanceBookings`
