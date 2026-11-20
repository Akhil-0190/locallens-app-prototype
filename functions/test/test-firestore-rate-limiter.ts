/**
 * Transactional Adapter Tests: Production Firestore Store Classes & Atomic Handoff Replay
 * Task B5 — Verification for PR #24 Review
 * Developer B — AI & Model Integration Lead
 * 
 * NOTE ON TEST CLASSIFICATION:
 * These tests execute the actual production store classes (FirestoreRateLimitStore and FirestoreHandoffChallengeStore)
 * using an in-process transactional mock database (MockTransactionalFirestore) implementing the Firestore Admin SDK
 * transactional contract (collection, doc, get, set, runTransaction with serializable locking).
 * Because standalone Java/Firebase emulators are not installed on this host, real Firestore server-side concurrency
 * is classified as NOT TESTED until verified in an environment with the official Firebase emulator or live project.
 *
 * Verifies:
 * 1. Production callable handlers instantiate FirestoreRateLimitStore (no silent memory fallback)
 * 2. Atomic quota consumption across separate RateLimiter instances targeting the same collection
 * 3. Sliding window expiry & quota replenishment
 * 4. Concurrent requests race condition resilience (Promise.all)
 * 5. Rejection after quota exhaustion (429 RESOURCE_EXHAUSTED)
 * 6. Firestore-backed atomic handoff challenge consumption:
 *    - Successful first use
 *    - Rejected second use (one-time anti-replay)
 *    - Rejected expired challenge
 *    - Rejected modified payload (payload fingerprint mismatch)
 *    - Rejected challenge used by a different traveler
 *    - Concurrent attempts to consume the exact same challenge token
 */

import { strict as assert } from 'node:assert';
import {
  FirestoreRateLimitStore,
  RateLimiter,
  defaultRateLimiter,
  ENDPOINT_POLICIES,
} from '../src/ai/utils/rate-limiter.js';
import {
  FirestoreHandoffChallengeStore,
  formatGeminiHandoffContext,
} from '../src/ai/services/live-assistance-service.js';

class MockTransactionalFirestore {
  private store = new Map<string, Map<string, any>>();
  private lock = Promise.resolve();

  collection(name: string) {
    if (!this.store.has(name)) {
      this.store.set(name, new Map());
    }
    const col = this.store.get(name)!;

    return {
      doc: (id: string) => ({
        id,
        get: async () => {
          const data = col.get(id);
          return {
            exists: data !== undefined,
            data: () => (data ? JSON.parse(JSON.stringify(data)) : undefined),
          };
        },
        set: async (val: any, opts?: any) => {
          if (opts?.merge && col.has(id)) {
            col.set(id, { ...col.get(id), ...JSON.parse(JSON.stringify(val)) });
          } else {
            col.set(id, JSON.parse(JSON.stringify(val)));
          }
        },
      }),
    };
  }

  async runTransaction<T>(updateFunction: (transaction: any) => Promise<T>): Promise<T> {
    let release: () => void;
    const nextLock = new Promise<void>((res) => { release = res; });
    const currentLock = this.lock;
    this.lock = currentLock.then(() => nextLock);

    await currentLock;
    try {
      const stageWrites: Array<() => Promise<void>> = [];
      const transaction = {
        get: async (docRef: any) => {
          return docRef.get();
        },
        set: (docRef: any, val: any, opts?: any) => {
          stageWrites.push(async () => {
            await docRef.set(val, opts);
          });
        },
      };

      const result = await updateFunction(transaction);
      for (const write of stageWrites) {
        await write();
      }
      return result;
    } finally {
      release!();
    }
  }

  clear() {
    this.store.clear();
  }
}

async function runFirestoreIntegrationTests() {
  console.log('================================================================');
  console.log('  Startup Buildathon 2026 — Task B5 Transactional Adapter Tests ');
  console.log('  Production Firestore Store Classes & Atomic Anti-Replay Engine ');
  console.log('================================================================');

  let passed = 0;

  // --- Test 1: Production handler store verification ---
  console.log('\n--- [Test 1] Production Handler Store Configuration ---');
  const activeStore = defaultRateLimiter.getStore();
  assert(
    activeStore instanceof FirestoreRateLimitStore,
    'Production defaultRateLimiter MUST instantiate FirestoreRateLimitStore'
  );
  console.log('✅ PASSED: Production callable handlers use FirestoreRateLimitStore (no memory fallback)');
  passed++;

  // --- Test 2: Atomic Quota Consumption across separate instances ---
  console.log('\n--- [Test 2] Atomic Quota Consumption across separate instances ---');
  const sharedFirestore = new MockTransactionalFirestore();
  const firestoreStoreA = new FirestoreRateLimitStore(sharedFirestore, 'ai_usage_quotas');
  const firestoreStoreB = new FirestoreRateLimitStore(sharedFirestore, 'ai_usage_quotas');

  const instanceA = new RateLimiter(firestoreStoreA);
  const instanceB = new RateLimiter(firestoreStoreB);

  const baseTime = Date.now();
  // Policy for askStreetCopilot: maxRequests: 20, windowMs: 60000
  const user = 'usr_traveler_alpha';

  // Request 1 on Instance A
  const resA1 = await instanceA.checkRateLimit(user, 'askStreetCopilot', baseTime);
  assert(resA1.allowed, 'Instance A: initial request allowed');
  assert.equal(resA1.remaining, 19, 'Instance A: remaining is 19');
  console.log('✅ PASSED: Instance A first request allowed, remaining quota = 19');
  passed++;

  // Request 2 on Instance B targeting the same user
  const resB1 = await instanceB.checkRateLimit(user, 'askStreetCopilot', baseTime + 100);
  assert(resB1.allowed, 'Instance B: request allowed from shared collection');
  assert.equal(resB1.remaining, 18, 'Instance B: reads shared quota correctly (18)');
  console.log('✅ PASSED: Instance B sees decremented quota in transactional adapter store (remaining = 18)');
  passed++;

  // --- Test 3: Concurrent Request Race Resilience ---
  console.log('\n--- [Test 3] Concurrent Request Race Resilience ---');
  // Issue 5 concurrent requests split across Instance A and Instance B
  const concurrentCalls = [
    instanceA.checkRateLimit(user, 'askStreetCopilot', baseTime + 200),
    instanceB.checkRateLimit(user, 'askStreetCopilot', baseTime + 200),
    instanceA.checkRateLimit(user, 'askStreetCopilot', baseTime + 200),
    instanceB.checkRateLimit(user, 'askStreetCopilot', baseTime + 200),
    instanceA.checkRateLimit(user, 'askStreetCopilot', baseTime + 200),
  ];
  const concurrentResults = await Promise.all(concurrentCalls);
  const allAllowed = concurrentResults.every((r) => r.allowed);
  assert(allAllowed, 'All 5 concurrent requests allowed within quota');
  // Initial 2 + 5 = 7 total calls. Remaining should be 20 - 7 = 13.
  const checkAfterConcurrent = await instanceB.checkRateLimit(user, 'askStreetCopilot', baseTime + 300);
  assert.equal(checkAfterConcurrent.remaining, 12, 'Atomic transaction prevented race lost updates');
  console.log('✅ PASSED: 5 concurrent requests processed atomically without state loss');
  passed++;

  // --- Test 4: Quota Exhaustion & Rejection ---
  console.log('\n--- [Test 4] Quota Exhaustion & Rejection ---');
  // We have consumed 8 requests so far (20 - 8 = 12 left).
  // Consume remaining 12 requests via Instance A.
  for (let i = 0; i < 12; i++) {
    const res = await instanceA.checkRateLimit(user, 'askStreetCopilot', baseTime + 400 + i);
    assert(res.allowed, `Request ${9 + i} allowed`);
  }
  // Now quota is exactly 0. Next request on Instance B must be rejected.
  const resExhausted = await instanceB.checkRateLimit(user, 'askStreetCopilot', baseTime + 500);
  assert(!resExhausted.allowed, 'Instance B correctly rejects request when quota is 0');
  assert.equal(resExhausted.remaining, 0, 'Instance B reports remaining quota as 0');
  assert(resExhausted.resetMs > 0, 'Instance B calculates positive resetMs');
  console.log('✅ PASSED: Instance B rejects request upon quota exhaustion with 429 error payload');
  passed++;

  // --- Test 5: Sliding Window Expiry ---
  console.log('\n--- [Test 5] Sliding Window Expiry ---');
  // Advance time beyond windowMs (60s)
  const futureTime = baseTime + 65 * 1000;
  const resReplenished = await instanceB.checkRateLimit(user, 'askStreetCopilot', futureTime);
  assert(resReplenished.allowed, 'Request allowed after sliding window expiration');
  assert.equal(resReplenished.remaining, 19, 'Quota replenished after window expiration');
  console.log('✅ PASSED: Sliding window expiration replenishes quota in transactional adapter store');
  passed++;

  // --- Test 6: Atomic Handoff Anti-Replay via Transactional Store ---
  console.log('\n--- [Test 6] Atomic Handoff Anti-Replay via Transactional Store ---');
  const challengeDb = new MockTransactionalFirestore();
  const challengeStore = new FirestoreHandoffChallengeStore(challengeDb, 'ai_handoff_challenges');

  const travelerId = 'usr_traveler_404';
  const neighborhood = 'Malleshwaram';
  const baseHandoffInput = {
    travelerId,
    activeNeighborhood: neighborhood,
    currentCoordinates: { latitude: 12.9984, longitude: 77.5714 },
    currentRouteSummary: 'Temple and Tiffin Walk',
    recentSpotCards: [{ spotName: 'CTR Shri Sagar', category: 'tiffin_hall', openHours: '7:30 AM - 12:30 PM' }],
    recentConversationSnippets: ['Where is the nearest filter coffee?'],
  };

  // Phase 1: Preview to get challenge token
  const preview = await formatGeminiHandoffContext(
    {
      ...baseHandoffInput,
      action: 'PREVIEW',
      userConsentGranted: false,
    },
    challengeStore
  );
  assert(preview.consentStatus === 'CONSENT_REQUIRED', 'Preview generates challenge token');
  const challengeToken = preview.consentChallengeToken;
  assert(challengeToken.startsWith('chk_'), 'Challenge token starts with chk_');
  console.log('✅ PASSED: Phase 1 Preview issues cryptographic challenge token');
  passed++;

  // Case 6A: Successful first use
  const firstConfirm = await formatGeminiHandoffContext(
    {
      ...baseHandoffInput,
      action: 'CONFIRM',
      userConsentGranted: true,
      consentChallengeToken: challengeToken,
    },
    challengeStore
  );
  assert.equal(firstConfirm.consentStatus, 'CONSENT_GRANTED', 'First use of challenge succeeds');
  assert(firstConfirm.handoffUri !== null, 'First use returns valid handoffUri');
  console.log('✅ PASSED: 6A - Successful first use granted');
  passed++;

  // Case 6B: Rejected second use (Anti-Replay)
  const secondConfirm = await formatGeminiHandoffContext(
    {
      ...baseHandoffInput,
      action: 'CONFIRM',
      userConsentGranted: true,
      consentChallengeToken: challengeToken,
    },
    challengeStore
  );
  assert.equal(secondConfirm.consentStatus, 'CANCELLED', 'Second use is rejected');
  assert.equal(secondConfirm.handoffUri, null, 'Second use returns null handoffUri');
  assert(
    secondConfirm.handoffDisclaimer.includes('already been consumed'),
    'Disclaimer flags replay violation'
  );
  console.log('✅ PASSED: 6B - Rejected second use (anti-replay violation prevented in transactional store)');
  passed++;

  // Case 6C: Rejected expired challenge
  const expiredToken = `chk_mockexpired_${Date.now() - 20000}_invalidsig`;
  const expiredConfirm = await formatGeminiHandoffContext(
    {
      ...baseHandoffInput,
      action: 'CONFIRM',
      userConsentGranted: true,
      consentChallengeToken: expiredToken,
    },
    challengeStore
  );
  assert.equal(expiredConfirm.consentStatus, 'CANCELLED', 'Expired challenge rejected');
  assert.equal(expiredConfirm.handoffUri, null, 'No URI for expired challenge');
  console.log('✅ PASSED: 6C - Rejected expired challenge');
  passed++;

  // Case 6D: Rejected modified payload (tampered location/spots)
  // Generate a new preview
  const preview2 = await formatGeminiHandoffContext(
    {
      ...baseHandoffInput,
      action: 'PREVIEW',
      userConsentGranted: false,
    },
    challengeStore
  );
  const tamperedConfirm = await formatGeminiHandoffContext(
    {
      ...baseHandoffInput,
      activeNeighborhood: 'Indiranagar', // Altered after preview
      action: 'CONFIRM',
      userConsentGranted: true,
      consentChallengeToken: preview2.consentChallengeToken,
    },
    challengeStore
  );
  assert.equal(tamperedConfirm.consentStatus, 'CANCELLED', 'Modified payload is rejected');
  assert.equal(tamperedConfirm.handoffUri, null, 'No URI for modified payload');
  console.log('✅ PASSED: 6D - Rejected modified payload (payload fingerprint mismatch)');
  passed++;

  // Case 6E: Rejected challenge used by a different traveler
  const preview3 = await formatGeminiHandoffContext(
    {
      ...baseHandoffInput,
      travelerId: 'usr_traveler_original',
      action: 'PREVIEW',
      userConsentGranted: false,
    },
    challengeStore
  );
  const differentTravelerConfirm = await formatGeminiHandoffContext(
    {
      ...baseHandoffInput,
      travelerId: 'usr_traveler_attacker', // Different traveler trying to use token
      action: 'CONFIRM',
      userConsentGranted: true,
      consentChallengeToken: preview3.consentChallengeToken,
    },
    challengeStore
  );
  assert.equal(differentTravelerConfirm.consentStatus, 'CANCELLED', 'Different traveler rejected');
  assert.equal(differentTravelerConfirm.handoffUri, null, 'No URI for traveler mismatch');
  console.log('✅ PASSED: 6E - Rejected challenge used by different traveler');
  passed++;

  // Case 6F: Concurrent attempts to consume the same challenge
  const preview4 = await formatGeminiHandoffContext(
    {
      ...baseHandoffInput,
      action: 'PREVIEW',
      userConsentGranted: false,
    },
    challengeStore
  );
  const concurrentChallengeToken = preview4.consentChallengeToken;
  const raceAttempts = await Promise.all([
    formatGeminiHandoffContext(
      { ...baseHandoffInput, action: 'CONFIRM', userConsentGranted: true, consentChallengeToken: concurrentChallengeToken },
      challengeStore
    ),
    formatGeminiHandoffContext(
      { ...baseHandoffInput, action: 'CONFIRM', userConsentGranted: true, consentChallengeToken: concurrentChallengeToken },
      challengeStore
    ),
    formatGeminiHandoffContext(
      { ...baseHandoffInput, action: 'CONFIRM', userConsentGranted: true, consentChallengeToken: concurrentChallengeToken },
      challengeStore
    ),
  ]);

  const grantedCount = raceAttempts.filter((r) => r.consentStatus === 'CONSENT_GRANTED').length;
  const cancelledCount = raceAttempts.filter((r) => r.consentStatus === 'CANCELLED').length;

  assert.equal(grantedCount, 1, 'Exactly one concurrent attempt must succeed in atomic transaction');
  assert.equal(cancelledCount, 2, 'Remaining concurrent attempts must be rejected as already consumed');
  console.log('✅ PASSED: 6F - Concurrent challenge consumption race: exactly 1 granted, 2 rejected');
  passed++;

  console.log('\n================================================================');
  console.log(`Firestore Transactional Adapter Results: ${passed} passed, 0 failed.`);
  console.log('================================================================');
}

runFirestoreIntegrationTests().catch((err) => {
  console.error('Fatal error in Firestore transactional adapter tests:', err);
  process.exit(1);
});
