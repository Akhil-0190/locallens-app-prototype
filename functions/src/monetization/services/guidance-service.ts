/**
 * One-on-One Paid Local Guidance Service
 * Task A5 Corrective Work — Contributor Ecosystem & Monetization Backend
 *
 * Implements complete guidance lifecycle:
 *   - Offering registration and discovery
 *   - Session request, guide acceptance, and rejection
 *   - Payment initiation and confirmation via configured payment adapter
 *   - Cancellation and session completion
 *   - Escrow crediting to guide reward ledger enforcing the accounting invariant:
 *       totalEarningsInr + unrecoveredAdjustmentInr = availableBalanceInr + withdrawnTotalInr
 */

import { randomUUID } from 'node:crypto';
import { db } from '../../config/firebase.js';
import {
  GuidanceOfferingDocument,
  GuidanceOfferingDocumentSchema,
  GuidanceBookingDocument,
  GuidanceBookingDocumentSchema,
  ContributorRewardLedger,
  ContributorRewardLedgerSchema,
} from '../../types/contracts/index.js';
import {
  PaymentGatewayAdapter,
  PaymentIntentResult,
  PaymentRefundResult,
} from '../adapters/payment-gateway-adapter.js';
import { defaultPaymentAdapter } from '../adapters/sandbox-payment-adapter.js';
import { validateSettlementEnvironment } from '../config/payment-environment.js';
import { calculateGuidanceRank } from './tipping-service.js';

export interface RegisterOfferingInput {
  guideUserId: string;
  neighborhood: string;
  title: string;
  description: string;
  durationMinutes: number;
  priceInr: number;
  meetingPoint: string;
  languages: string[];
}

export interface RequestGuidanceInput {
  travelerUserId: string;
  offeringId: string;
  scheduledDateTime: string;
  specialNotes?: string;
}

export interface ConfirmGuidancePaymentInput {
  bookingId: string;
  callerUserId: string;
  simulatedOutcome?: 'SUCCESS' | 'FAILURE';
  isAdminOverride?: boolean;
}

export interface CompleteGuidanceInput {
  bookingId: string;
  callerUserId: string;
  isAdminOverride?: boolean;
}

export interface GuidanceActionInput {
  bookingId: string;
  callerUserId: string;
  reason?: string;
  isAdminOverride?: boolean;
}

export class GuidanceService {
  constructor(private readonly paymentAdapter: PaymentGatewayAdapter = defaultPaymentAdapter) {}

  /**
   * Registers a local guidance offering by a verified local guide.
   */
  public async registerOffering(input: RegisterOfferingInput): Promise<GuidanceOfferingDocument> {
    if (input.priceInr < 100 || input.priceInr > 10000) {
      throw new Error('Guidance offering price must be between ₹100 and ₹10,000.');
    }
    if (input.durationMinutes < 15 || input.durationMinutes > 480) {
      throw new Error('Guidance duration must be between 15 minutes and 8 hours (480 mins).');
    }
    if (!input.neighborhood || input.neighborhood.trim().length === 0) {
      throw new Error('Neighborhood is required for guidance offering.');
    }
    if (!input.title || input.title.trim().length === 0) {
      throw new Error('Title is required for guidance offering.');
    }
    if (!input.meetingPoint || input.meetingPoint.trim().length === 0) {
      throw new Error('Meeting point is required for guidance offering.');
    }

    const offeringId = `guide_offering_${input.guideUserId}_${randomUUID().replace(/-/g, '').slice(0, 8)}`;
    const now = new Date().toISOString();

    const offering: GuidanceOfferingDocument = {
      offeringId,
      guideUserId: input.guideUserId,
      neighborhood: input.neighborhood,
      title: input.title,
      description: input.description,
      durationMinutes: input.durationMinutes,
      priceInr: input.priceInr,
      meetingPoint: input.meetingPoint,
      languages: input.languages.length > 0 ? input.languages : ['English'],
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };

    GuidanceOfferingDocumentSchema.parse(offering);
    await db.collection('guidance_offerings').doc(offeringId).set(offering);
    return offering;
  }

  /**
   * Lists active guidance offerings, optionally filtered by neighborhood.
   */
  public async listOfferings(neighborhood?: string): Promise<GuidanceOfferingDocument[]> {
    let query: FirebaseFirestore.Query = db
      .collection('guidance_offerings')
      .where('isActive', '==', true);

    if (neighborhood && neighborhood.trim().length > 0) {
      query = query.where('neighborhood', '==', neighborhood.trim());
    }

    const snap = await query.get();
    return snap.docs.map((d) => d.data() as GuidanceOfferingDocument);
  }

  /**
   * Traveler requests a guidance session.
   * Generates a payment intent and stores booking in REQUESTED / INITIATED state.
   */
  public async requestLocalGuidance(
    input: RequestGuidanceInput
  ): Promise<{ booking: GuidanceBookingDocument; paymentIntent: PaymentIntentResult }> {
    const offeringRef = db.collection('guidance_offerings').doc(input.offeringId);
    const offeringSnap = await offeringRef.get();

    if (!offeringSnap.exists) {
      throw new Error(`Guidance offering ${input.offeringId} not found.`);
    }

    const offering = offeringSnap.data() as GuidanceOfferingDocument;

    if (!offering.isActive) {
      throw new Error('This guidance offering is currently inactive.');
    }

    if (offering.guideUserId === input.travelerUserId) {
      throw new Error('Self-booking is strictly prohibited.');
    }

    // Platform fee: 10%, minimum ₹25
    const platformFeeInr = Math.max(25, Math.round(offering.priceInr * 0.1));
    const guideNetInr = offering.priceInr - platformFeeInr;

    const bookingId = `guidance_blr_${Date.now()}_${randomUUID().replace(/-/g, '').slice(0, 6)}`;
    const now = new Date().toISOString();

    const paymentIntent = await this.paymentAdapter.createPaymentIntent({
      transactionId: bookingId,
      payerUserId: input.travelerUserId,
      recipientUserId: offering.guideUserId,
      amountInr: offering.priceInr,
      currency: 'INR',
      description: `1-on-1 Guidance: ${offering.title} in ${offering.neighborhood}`,
    });

    const booking: GuidanceBookingDocument = {
      bookingId,
      offeringId: offering.offeringId,
      travelerUserId: input.travelerUserId,
      guideUserId: offering.guideUserId,
      neighborhood: offering.neighborhood,
      offeringTitle: offering.title,
      scheduledDateTime: input.scheduledDateTime,
      durationMinutes: offering.durationMinutes,
      meetingPoint: offering.meetingPoint,
      specialNotes: input.specialNotes,
      priceInr: offering.priceInr,
      platformFeeInr,
      guideNetInr,
      currency: 'INR',
      paymentMode: this.paymentAdapter.getMode(),
      paymentStatus: 'INITIATED',
      paymentGatewayReference: paymentIntent.gatewayReference,
      status: 'REQUESTED',
      createdAt: now,
      updatedAt: now,
    };

    GuidanceBookingDocumentSchema.parse(booking);
    await db.collection('guidance_bookings').doc(bookingId).set(booking);

    return { booking, paymentIntent };
  }

  /**
   * Confirms payment for a guidance booking.
   * Enforces server environment checks, adapter verification, and idempotent activation.
   */
  public async confirmGuidancePayment(
    input: ConfirmGuidancePaymentInput
  ): Promise<{ booking: GuidanceBookingDocument; isIdempotentReplay: boolean }> {
    const bookingRef = db.collection('guidance_bookings').doc(input.bookingId);
    const snap = await bookingRef.get();

    if (!snap.exists) {
      throw new Error(`Guidance booking ${input.bookingId} not found.`);
    }

    const booking = snap.data() as GuidanceBookingDocument;

    if (booking.travelerUserId !== input.callerUserId && !input.isAdminOverride) {
      throw new Error('Unauthorized: Only the booking traveler or administrator may confirm payment.');
    }

    validateSettlementEnvironment({
      transactionPaymentMode: booking.paymentMode,
      isSimulationRequested: input.simulatedOutcome !== undefined,
    });

    if (booking.paymentStatus === 'COMPLETED') {
      return { booking, isIdempotentReplay: true };
    }

    if (booking.status === 'CANCELLED' || booking.status === 'REJECTED') {
      throw new Error(`Cannot confirm payment for a booking with status ${booking.status}.`);
    }

    const verification = await this.paymentAdapter.verifyPayment({
      transactionId: input.bookingId,
      gatewayReference: booking.paymentGatewayReference || '',
      simulatedOutcome: input.simulatedOutcome,
    });

    if (!verification.verified) {
      await bookingRef.update({
        paymentStatus: 'FAILED',
        updatedAt: new Date().toISOString(),
      });
      throw new Error(`Payment verification failed: ${verification.failureReason || 'Declined'}`);
    }

    const now = new Date().toISOString();
    // If guide already accepted, payment completes transition to CONFIRMED
    const newStatus = booking.status === 'ACCEPTED' ? 'CONFIRMED' : 'REQUESTED';

    const updatedBooking: GuidanceBookingDocument = {
      ...booking,
      paymentStatus: 'COMPLETED',
      status: newStatus,
      updatedAt: now,
    };

    GuidanceBookingDocumentSchema.parse(updatedBooking);
    await bookingRef.set(updatedBooking);

    return { booking: updatedBooking, isIdempotentReplay: false };
  }

  /**
   * Guide accepts a requested guidance session.
   */
  public async acceptGuidanceRequest(input: GuidanceActionInput): Promise<GuidanceBookingDocument> {
    const bookingRef = db.collection('guidance_bookings').doc(input.bookingId);
    const snap = await bookingRef.get();

    if (!snap.exists) {
      throw new Error(`Guidance booking ${input.bookingId} not found.`);
    }

    const booking = snap.data() as GuidanceBookingDocument;

    if (booking.guideUserId !== input.callerUserId && !input.isAdminOverride) {
      throw new Error('Unauthorized: Only the assigned local guide or administrator may accept this request.');
    }

    if (booking.status !== 'REQUESTED') {
      throw new Error(`Cannot accept booking in ${booking.status} status. Must be REQUESTED.`);
    }

    const now = new Date().toISOString();
    // If traveler has already completed payment, transition straight to CONFIRMED
    const nextStatus = booking.paymentStatus === 'COMPLETED' ? 'CONFIRMED' : 'ACCEPTED';

    const updatedBooking: GuidanceBookingDocument = {
      ...booking,
      status: nextStatus,
      updatedAt: now,
    };

    GuidanceBookingDocumentSchema.parse(updatedBooking);
    await bookingRef.set(updatedBooking);
    return updatedBooking;
  }

  /**
   * Internal processor for rejecting or cancelling guidance bookings with safe refund concurrency,
   * deterministic idempotency keys, and recovery guarantees.
   */
  private async processRefundAndTransition(
    input: GuidanceActionInput,
    targetStatus: 'REJECTED' | 'CANCELLED',
    defaultReason: string
  ): Promise<GuidanceBookingDocument> {
    const bookingRef = db.collection('guidance_bookings').doc(input.bookingId);
    const idempotencyKey = `ref_${input.bookingId}`;
    const claimTimeoutMs = 60000; // 60s timeout for stale in-flight operations

    // Phase 1: Atomic transaction to validate caller, verify status, and claim refund lock
    const claimedBooking = await db.runTransaction(async (tx) => {
      const snap = await tx.get(bookingRef);
      if (!snap.exists) {
        throw new Error(`Guidance booking ${input.bookingId} not found.`);
      }
      const booking = snap.data() as GuidanceBookingDocument;

      // Authorization and state guards
      if (targetStatus === 'REJECTED') {
        if (booking.guideUserId !== input.callerUserId && !input.isAdminOverride) {
          throw new Error('Unauthorized: Only the assigned local guide or administrator may reject this request.');
        }
        if (booking.status === 'REJECTED') {
          return booking; // Idempotent replay
        }
        if (booking.status !== 'REQUESTED') {
          throw new Error(`Cannot reject booking in ${booking.status} status. Must be REQUESTED.`);
        }
      } else {
        // CANCELLED
        const isTraveler = booking.travelerUserId === input.callerUserId;
        const isGuide = booking.guideUserId === input.callerUserId;
        if (!isTraveler && !isGuide && !input.isAdminOverride) {
          throw new Error('Unauthorized: Only the traveler, guide, or administrator may cancel this booking.');
        }
        if (booking.status === 'CANCELLED') {
          return booking; // Idempotent replay
        }
        if (booking.status === 'COMPLETED' || booking.status === 'REJECTED') {
          throw new Error(`Cannot cancel booking with status ${booking.status}.`);
        }
      }

      // If payment was not completed, no external refund needed: transition immediately
      if (booking.paymentStatus !== 'COMPLETED') {
        const now = new Date().toISOString();
        const updated: GuidanceBookingDocument = {
          ...booking,
          status: targetStatus,
          ...(targetStatus === 'REJECTED'
            ? { rejectionReason: input.reason || defaultReason }
            : { cancellationReason: input.reason || defaultReason }),
          updatedAt: now,
        };
        GuidanceBookingDocumentSchema.parse(updated);
        tx.set(bookingRef, updated);
        return updated;
      }

      // If already refunded successfully, return
      if (booking.refundStatus === 'COMPLETED') {
        return booking;
      }

      // Concurrency Lock: Check if another refund operation is currently PENDING
      if (booking.refundStatus === 'PENDING') {
        const initiatedTime = booking.refundInitiatedAt ? new Date(booking.refundInitiatedAt).getTime() : 0;
        const elapsed = Date.now() - initiatedTime;
        if (elapsed < claimTimeoutMs) {
          throw new Error('A refund operation is currently pending for this booking. Please try again shortly.');
        }
        // If elapsed >= claimTimeoutMs, permit safe recovery retry using the same idempotency key
      }

      const now = new Date().toISOString();
      const updated: GuidanceBookingDocument = {
        ...booking,
        refundStatus: 'PENDING',
        refundIdempotencyKey: idempotencyKey,
        refundInitiatedAt: now,
        updatedAt: now,
      };
      GuidanceBookingDocumentSchema.parse(updated);
      tx.set(bookingRef, updated);
      return updated;
    });

    // If already finalized (unpaid or already completed), return immediately
    if (
      claimedBooking.status === targetStatus &&
      (claimedBooking.paymentStatus !== 'COMPLETED' || claimedBooking.refundStatus === 'COMPLETED')
    ) {
      return claimedBooking;
    }

    // Phase 2: External payment adapter refund call OUTSIDE Firestore transaction
    let refundResult: PaymentRefundResult;
    try {
      refundResult = await this.paymentAdapter.refundPayment({
        transactionId: claimedBooking.bookingId,
        gatewayReference: claimedBooking.paymentGatewayReference || '',
        amountInr: claimedBooking.priceInr,
        reason: input.reason || defaultReason,
        idempotencyKey,
      });
    } catch (err: any) {
      // Record FAILED state so subsequent retry can safely re-attempt
      await bookingRef.update({
        refundStatus: 'FAILED',
        updatedAt: new Date().toISOString(),
      });
      throw err;
    }

    if (!refundResult.refunded) {
      await bookingRef.update({
        refundStatus: 'FAILED',
        updatedAt: new Date().toISOString(),
      });
      throw new Error(`Refund failed: ${refundResult.failureReason || 'Declined by payment processor'}`);
    }

    // Phase 3: Finalize booking status and refund record in Firestore transaction
    const finalizedBooking = await db.runTransaction(async (tx) => {
      const snap = await tx.get(bookingRef);
      const booking = (snap.data() || claimedBooking) as GuidanceBookingDocument;
      const now = new Date().toISOString();

      const updated: GuidanceBookingDocument = {
        ...booking,
        status: targetStatus,
        ...(targetStatus === 'REJECTED'
          ? { rejectionReason: input.reason || defaultReason }
          : { cancellationReason: input.reason || defaultReason }),
        paymentStatus: 'FAILED',
        refundStatus: 'COMPLETED',
        refundReference: refundResult.refundReference,
        refundedAt: now,
        updatedAt: now,
      };

      GuidanceBookingDocumentSchema.parse(updated);
      tx.set(bookingRef, updated);
      return updated;
    });

    return finalizedBooking;
  }

  /**
   * Guide rejects a requested guidance session.
   * Atomically claims refund lock, executes external refund outside transaction,
   * and finalizes booking state with refund evidence.
   */
  public async rejectGuidanceRequest(input: GuidanceActionInput): Promise<GuidanceBookingDocument> {
    return this.processRefundAndTransition(
      input,
      'REJECTED',
      'Guide is unavailable at the requested time.'
    );
  }

  /**
   * Traveler or Guide cancels a guidance booking prior to completion.
   * Atomically claims refund lock, executes external refund outside transaction,
   * and finalizes booking state with refund evidence.
   */
  public async cancelGuidanceBooking(input: GuidanceActionInput): Promise<GuidanceBookingDocument> {
    return this.processRefundAndTransition(
      input,
      'CANCELLED',
      'Guidance session cancelled by participant.'
    );
  }

  /**
   * Completes a guidance booking and releases escrow funds to the guide's reward ledger.
   * Enforces the mathematical accounting invariant:
   *   totalEarningsInr + unrecoveredAdjustmentInr = availableBalanceInr + withdrawnTotalInr
   */
  public async completeGuidanceBooking(input: CompleteGuidanceInput): Promise<{
    booking: GuidanceBookingDocument;
    rewardLedger: ContributorRewardLedger;
  }> {
    const bookingRef = db.collection('guidance_bookings').doc(input.bookingId);
    const snap = await bookingRef.get();

    if (!snap.exists) {
      throw new Error(`Guidance booking ${input.bookingId} not found.`);
    }

    const bookingData = snap.data() as GuidanceBookingDocument;

    const isGuide = bookingData.guideUserId === input.callerUserId;
    const isTraveler = bookingData.travelerUserId === input.callerUserId;

    if (!isGuide && !isTraveler && !input.isAdminOverride) {
      throw new Error('Unauthorized: Only session participants or administrator may mark booking completed.');
    }

    if (bookingData.status === 'COMPLETED') {
      const ledgerSnap = await db.collection('contributor_rewards').doc(bookingData.guideUserId).get();
      return {
        booking: bookingData,
        rewardLedger: ledgerSnap.data() as ContributorRewardLedger,
      };
    }

    if (bookingData.status !== 'CONFIRMED' && bookingData.status !== 'ACCEPTED') {
      throw new Error(`Cannot complete booking in status ${bookingData.status}. Must be CONFIRMED.`);
    }

    if (bookingData.paymentStatus !== 'COMPLETED') {
      throw new Error('Cannot complete booking: Payment has not been confirmed.');
    }

    const rewardRef = db.collection('contributor_rewards').doc(bookingData.guideUserId);

    const result = await db.runTransaction(async (transaction) => {
      const liveBookingSnap = await transaction.get(bookingRef);
      if (!liveBookingSnap.exists) throw new Error('Booking not found during transaction.');
      const currentBooking = liveBookingSnap.data() as GuidanceBookingDocument;

      if (currentBooking.status === 'COMPLETED') {
        const liveLedgerSnap = await transaction.get(rewardRef);
        return {
          booking: currentBooking,
          rewardLedger: liveLedgerSnap.data() as ContributorRewardLedger,
        };
      }

      const now = new Date().toISOString();
      const updatedBooking: GuidanceBookingDocument = {
        ...currentBooking,
        status: 'COMPLETED',
        completedAt: now,
        updatedAt: now,
      };

      const ledgerSnap = await transaction.get(rewardRef);
      let ledger: ContributorRewardLedger;

      if (!ledgerSnap.exists) {
        ledger = {
          userId: currentBooking.guideUserId,
          totalEarningsInr: currentBooking.guideNetInr,
          availableBalanceInr: currentBooking.guideNetInr,
          withdrawnTotalInr: 0,
          unrecoveredAdjustmentInr: 0,
          reputationPoints: 50,
          guidanceRank: calculateGuidanceRank(50),
          updatedAt: now,
        };
      } else {
        const existing = ledgerSnap.data() as ContributorRewardLedger;
        const currentUnrecovered = existing.unrecoveredAdjustmentInr || 0;
        let debtRecovery = 0;
        let netToAdd = currentBooking.guideNetInr;

        // Offset any clawback debt first
        if (currentUnrecovered > 0) {
          debtRecovery = Math.min(currentUnrecovered, netToAdd);
          netToAdd -= debtRecovery;
        }

        const newTotal = existing.totalEarningsInr + currentBooking.guideNetInr;
        const newAvailable = existing.availableBalanceInr + netToAdd;
        const newUnrecovered = currentUnrecovered - debtRecovery;
        const newRepPoints = existing.reputationPoints + 50; // +50 rep per guidance session

        ledger = {
          ...existing,
          totalEarningsInr: newTotal,
          availableBalanceInr: newAvailable,
          unrecoveredAdjustmentInr: newUnrecovered,
          reputationPoints: newRepPoints,
          guidanceRank: calculateGuidanceRank(newRepPoints),
          updatedAt: now,
        };
      }

      // Enforce strict accounting invariant
      if (ledger.availableBalanceInr < 0) {
        throw new Error('Accounting invariant violated: availableBalanceInr cannot be negative.');
      }
      if (
        ledger.totalEarningsInr + ledger.unrecoveredAdjustmentInr !==
        ledger.availableBalanceInr + ledger.withdrawnTotalInr
      ) {
        throw new Error(
          'Accounting invariant violated: totalEarnings + unrecoveredAdjustment must equal availableBalance + withdrawnTotal.'
        );
      }

      ContributorRewardLedgerSchema.parse(ledger);
      GuidanceBookingDocumentSchema.parse(updatedBooking);

      transaction.set(bookingRef, updatedBooking);
      transaction.set(rewardRef, ledger);

      return {
        booking: updatedBooking,
        rewardLedger: ledger,
      };
    });

    return result;
  }

  /**
   * Retrieves guidance booking by ID with authorization checks.
   */
  public async getGuidanceBooking(
    bookingId: string,
    callerUserId: string,
    callerRole?: string
  ): Promise<GuidanceBookingDocument> {
    const snap = await db.collection('guidance_bookings').doc(bookingId).get();
    if (!snap.exists) {
      throw new Error(`Guidance booking ${bookingId} not found.`);
    }

    const booking = snap.data() as GuidanceBookingDocument;
    const isParticipant =
      booking.travelerUserId === callerUserId || booking.guideUserId === callerUserId;
    const isModerator = callerRole === 'ADMIN' || callerRole === 'MODERATOR';

    if (!isParticipant && !isModerator) {
      throw new Error('Permission denied: Cannot inspect another user\'s guidance booking.');
    }

    return booking;
  }

  /**
   * Lists bookings for a user by role ('traveler' or 'guide').
   */
  public async listMyGuidanceBookings(
    userId: string,
    role: 'traveler' | 'guide'
  ): Promise<GuidanceBookingDocument[]> {
    const field = role === 'traveler' ? 'travelerUserId' : 'guideUserId';
    const snap = await db.collection('guidance_bookings').where(field, '==', userId).get();
    return snap.docs.map((d) => d.data() as GuidanceBookingDocument);
  }
}
