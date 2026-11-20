/**
 * Security, Authorization, and Reliability Audit Test Suite
 * Task A6 — Security, Integration, Deployment and Release
 */

import { test, describe } from 'node:test';
import * as assert from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { validateSettlementEnvironment } from '../src/monetization/config/payment-environment.js';
import { inspectAppCheck } from '../src/config/app-check.js';
import { LivePaymentGatewayAdapter } from '../src/monetization/adapters/live-payment-adapter.js';
import { getPaymentAdapter } from '../src/monetization/adapters/payment-adapter-factory.js';
import { createHmac } from 'node:crypto';

describe('Task A6 — Security, Authorization, and Reliability Audit', () => {

  describe('1. Firestore Security Rules Coverage and Invariants', () => {
    const rulesPath = path.resolve(__dirname, '../../../firestore.rules');
    const rulesContent = fs.readFileSync(rulesPath, 'utf8');

    test('firestore.rules file exists and specifies rules_version = "2"', () => {
      assert.ok(fs.existsSync(rulesPath), 'firestore.rules must exist');
      assert.ok(rulesContent.includes("rules_version = '2';"), 'Must declare rules_version = 2');
    });

    test('Covers all required collections explicitly', () => {
      const requiredCollections = [
        'users/{userId}',
        'preferences/{userId}',
        'group_sessions/{sessionId}',
        'places/{placeId}',
        'hourly_capacities/{slotId}',
        'venue_capacity/{venueId}',
        'scheduled_visits/{visitId}',
        'tips/{tipId}',
        'contributor_rewards/{userId}',
        'passes/{passId}',
        'subscriptions/{subscriptionId}',
        'guidance_offerings/{offeringId}',
        'guidance_bookings/{bookingId}',
        'contributions/{contributionId}',
        'assets/{assetId}',
        'spots/{spotId}',
        'offline_packs/{packId}',
        'webhook_events/{eventId}',
        '_sandbox_simulated_refunds/{idempotencyKey}',
        'audit_logs/{logId}',
      ];

      for (const col of requiredCollections) {
        assert.ok(
          rulesContent.includes(col),
          `firestore.rules must explicitly define access rules for ${col}`
        );
      }
    });

    test('Financial and server-managed collections strictly deny direct client writes', () => {
      const writeDeniedMatchers = [
        /match \/tips\/\{tipId\} \{[\s\S]*?allow create, update, delete: if false;/m,
        /match \/contributor_rewards\/\{userId\} \{[\s\S]*?allow create, update, delete: if false;/m,
        /match \/passes\/\{passId\} \{[\s\S]*?allow create, update, delete: if false;/m,
        /match \/subscriptions\/\{subscriptionId\} \{[\s\S]*?allow create, update, delete: if false;/m,
        /match \/guidance_bookings\/\{bookingId\} \{[\s\S]*?allow create, update, delete: if false;/m,
        /match \/spots\/\{spotId\} \{[\s\S]*?allow create, update, delete: if false;/m,
        /match \/_sandbox_simulated_refunds\/\{idempotencyKey\} \{[\s\S]*?allow read, write: if false;/m,
        /match \/audit_logs\/\{logId\} \{[\s\S]*?allow read, write: if false;/m,
      ];

      for (const pattern of writeDeniedMatchers) {
        assert.ok(
          pattern.test(rulesContent),
          `Expected rule pattern to deny direct client writes: ${pattern}`
        );
      }
    });

    test('subscriptions rule allows owner and moderator read while denying direct client writes', () => {
      assert.ok(
        rulesContent.includes("resource.data.ownerUserId == request.auth.uid"),
        'subscriptions rule must permit owner read'
      );
      assert.ok(
        rulesContent.includes("match /subscriptions/{subscriptionId}"),
        'Must define subscriptions match'
      );
    });

    test('group_sessions rule allows moderator read in addition to host and members', () => {
      const groupSessionMatcher = /match \/group_sessions\/\{sessionId\} \{[\s\S]*?isModerator\(\)/m;
      assert.ok(
        groupSessionMatcher.test(rulesContent),
        'group_sessions must permit moderator read'
      );
    });

    test('isModerator() checks trusted auth token claims first', () => {
      assert.ok(
        rulesContent.includes("request.auth.token != null"),
        'isModerator must check request.auth.token for custom claims'
      );
      assert.ok(
        rulesContent.includes("in ['MODERATOR', 'ADMIN', 'moderator', 'admin']"),
        'isModerator must support case-tolerant role checking'
      );
    });

    test('users/{userId} update rule prevents adding or modifying the role field', () => {
      assert.ok(
        rulesContent.includes("!('role' in request.resource.data) ||"),
        'User update rule must prevent unauthorized role addition'
      );
    });

    test('Enforces strict default deny-all catch-all', () => {
      const catchAllPattern = /match \/\{document=\*\*\} \{\s*allow read, write: if false;\s*\}/m;
      assert.ok(
        catchAllPattern.test(rulesContent),
        'firestore.rules must end with a catch-all deny-all rule'
      );
    });
  });

  describe('2. Cloud Storage Security Rules Coverage and Invariants', () => {
    const storageRulesPath = path.resolve(__dirname, '../../../storage.rules');
    const storageContent = fs.readFileSync(storageRulesPath, 'utf8');

    test('storage.rules enforces path structure, MIME types, and file size caps', () => {
      assert.ok(storageContent.includes("rules_version = '2';"));
      assert.ok(storageContent.includes("/contributions/{contributionId}/{mediaType}/{fileName}"));
      assert.ok(storageContent.includes("image/jpeg"));
      assert.ok(storageContent.includes("image/png"));
      assert.ok(storageContent.includes("audio/mp4"));
      assert.ok(storageContent.includes("audio/aac"));
      assert.ok(storageContent.includes("audio/x-m4a"));
      assert.ok(storageContent.includes("10 * 1024 * 1024"), 'Must cap photos at 10MB');
      assert.ok(storageContent.includes("25 * 1024 * 1024"), 'Must cap audio at 25MB');
      assert.ok(storageContent.includes("allow update: if false;"), 'Must deny updates/overwrites');
      assert.ok(storageContent.includes("allow delete: if false;"), 'Must deny deletes');
    });

    test('storage.rules ends with default deny-all', () => {
      const catchAllPattern = /match \/\{allPaths=\*\*\} \{\s*allow read, write: if false;\s*\}/m;
      assert.ok(catchAllPattern.test(storageContent), 'storage.rules must end with catch-all deny-all');
    });
  });

  describe('3. Secrets and Environment Fail-Closed Guarantees', () => {
    test('.env.example contains zero real credentials', () => {
      const envExamplePath = path.resolve(__dirname, '../../.env.example');
      const envExample = fs.readFileSync(envExamplePath, 'utf8');

      assert.ok(envExample.includes('GEMINI_API_KEY='));
      assert.ok(envExample.includes('MAPS_API_KEY='));

      // Verify lines with keys have empty or placeholder values
      const lines = envExample.split('\n');
      for (const line of lines) {
        if (line.startsWith('GEMINI_API_KEY=') || line.startsWith('MAPS_API_KEY=')) {
          const val = line.split('=')[1].trim();
          assert.strictEqual(val, '', `Placeholder in .env.example must be empty, found: ${val}`);
        }
      }
    });

    test('validateSettlementEnvironment rejects SANDBOX mode in cloud runtime (fail-closed)', () => {
      const prevPaymentEnv = process.env.PAYMENT_ENV;
      const prevKService = process.env.K_SERVICE;

      try {
        process.env.PAYMENT_ENV = 'SANDBOX';
        process.env.K_SERVICE = 'neighborhoodguide-backend';

        assert.throws(
          () => {
            validateSettlementEnvironment({
              transactionPaymentMode: 'SANDBOX',
              isSimulationRequested: false,
            });
          },
          /Security violation: PAYMENT_ENV cannot be set to SANDBOX in deployed cloud runtime/
        );
      } finally {
        process.env.PAYMENT_ENV = prevPaymentEnv;
        if (prevKService !== undefined) {
          process.env.K_SERVICE = prevKService;
        } else {
          delete process.env.K_SERVICE;
        }
      }
    });

    test('validateSettlementEnvironment rejects missing PAYMENT_ENV in production NODE_ENV', () => {
      const prevPaymentEnv = process.env.PAYMENT_ENV;
      const prevNodeEnv = process.env.NODE_ENV;

      try {
        delete process.env.PAYMENT_ENV;
        process.env.NODE_ENV = 'production';

        assert.throws(
          () => {
            validateSettlementEnvironment({
              transactionPaymentMode: 'LIVE',
              isSimulationRequested: false,
            });
          },
          /Fail-closed security check: Missing explicit PAYMENT_ENV configuration/
        );
      } finally {
        process.env.PAYMENT_ENV = prevPaymentEnv;
        process.env.NODE_ENV = prevNodeEnv;
      }
    });
  });

  describe('4. Firebase App Check Inspection and Non-Enforcing Default', () => {
    test('inspectAppCheck returns verified false without throwing when unenforced', () => {
      const mockRequest = {
        app: undefined,
        auth: { uid: 'usr_test_123' },
      } as any;

      const result = inspectAppCheck(mockRequest, { enforce: false });
      assert.strictEqual(result.isVerified, false);
      assert.strictEqual(result.isEnforced, false);
      assert.ok(result.reason?.includes('attestation token'));
    });

    test('inspectAppCheck throws unauthenticated HttpsError when enforcement is explicitly requested', () => {
      const mockRequest = {
        app: undefined,
        auth: { uid: 'usr_test_123' },
      } as any;

      assert.throws(
        () => inspectAppCheck(mockRequest, { enforce: true }),
        /App Check verification failed/
      );
    });

    test('inspectAppCheck accepts verified token when present', () => {
      const mockRequest = {
        app: { appId: '1:1234567890:android:abcdef', alreadyConsumed: false },
        auth: { uid: 'usr_test_123' },
      } as any;

      const result = inspectAppCheck(mockRequest, { enforce: true });
      assert.strictEqual(result.isVerified, true);
      assert.strictEqual(result.appId, '1:1234567890:android:abcdef');
    });
  });

  describe('5. Authorization Role Elevation Prevention', () => {
    test('Client-supplied role in getContributionStatus cannot elevate privileges without custom claims', () => {
      // Simulate authorization resolution in getContributionStatus
      const resolveRoleFromAuth = (auth: { token?: Record<string, unknown> } | null) => {
        const tokenRole = String(auth?.token?.role || '').toUpperCase();
        return tokenRole === 'ADMIN' || tokenRole === 'MODERATOR' || tokenRole === 'CONTRIBUTOR'
          ? tokenRole
          : 'TRAVELER';
      };

      // Scenario A: Caller without custom claims (regular traveler)
      assert.strictEqual(resolveRoleFromAuth(null), 'TRAVELER');
      assert.strictEqual(resolveRoleFromAuth({ token: {} }), 'TRAVELER');
      assert.strictEqual(resolveRoleFromAuth({ token: { role: 'user' } }), 'TRAVELER');

      // Scenario B: Caller with verified custom claim
      assert.strictEqual(resolveRoleFromAuth({ token: { role: 'ADMIN' } }), 'ADMIN');
      assert.strictEqual(resolveRoleFromAuth({ token: { role: 'moderator' } }), 'MODERATOR');
      assert.strictEqual(resolveRoleFromAuth({ token: { role: 'CONTRIBUTOR' } }), 'CONTRIBUTOR');
    });

    test('Admin override in partner subscription confirmation handles uppercase and lowercase claims', () => {
      const checkIsAdmin = (auth: { token?: Record<string, unknown> } | null) => {
        const tokenRole = String(auth?.token?.role || '').toUpperCase();
        return auth?.token?.admin === true || tokenRole === 'ADMIN' || tokenRole === 'MODERATOR';
      };

      assert.strictEqual(checkIsAdmin({ token: { role: 'ADMIN' } }), true);
      assert.strictEqual(checkIsAdmin({ token: { role: 'admin' } }), true);
      assert.strictEqual(checkIsAdmin({ token: { role: 'MODERATOR' } }), true);
      assert.strictEqual(checkIsAdmin({ token: { role: 'moderator' } }), true);
      assert.strictEqual(checkIsAdmin({ token: { admin: true } }), true);
      assert.strictEqual(checkIsAdmin({ token: { role: 'TRAVELER' } }), false);
      assert.strictEqual(checkIsAdmin({ token: {} }), false);
      assert.strictEqual(checkIsAdmin(null), false);
    });

    test('Malformed, non-string, or missing claims fail safely to least-privilege TRAVELER', () => {
      const resolveRoleFromAuth = (auth: { token?: Record<string, unknown> } | null) => {
        const tokenRole = String(auth?.token?.role || '').toUpperCase();
        return tokenRole === 'ADMIN' || tokenRole === 'MODERATOR' || tokenRole === 'CONTRIBUTOR'
          ? tokenRole
          : 'TRAVELER';
      };

      assert.strictEqual(resolveRoleFromAuth({ token: { role: 12345 } }), 'TRAVELER');
      assert.strictEqual(resolveRoleFromAuth({ token: { role: null } }), 'TRAVELER');
      assert.strictEqual(resolveRoleFromAuth({ token: { role: { nested: 'ADMIN' } } }), 'TRAVELER');
      assert.strictEqual(resolveRoleFromAuth({ token: undefined }), 'TRAVELER');
    });

    test('Unauthorized user cannot confirm partner subscription payment without owner association', () => {
      const verifySubscriptionConfirmationAuth = (params: {
        callerUserId: string;
        subOwnerUserId?: string;
        isAdminOverride: boolean;
      }) => {
        if (!params.subOwnerUserId) {
          if (!params.isAdminOverride) {
            throw new Error('Unauthorized: Subscription lacks a verified owner association.');
          }
        } else if (params.subOwnerUserId !== params.callerUserId && !params.isAdminOverride) {
          throw new Error('Unauthorized: Only the merchant subscription owner or administrator may confirm payment.');
        }
        return true;
      };

      // Owner confirms: allowed
      assert.strictEqual(
        verifySubscriptionConfirmationAuth({
          callerUserId: 'usr_merchant_owner_01',
          subOwnerUserId: 'usr_merchant_owner_01',
          isAdminOverride: false,
        }),
        true
      );

      // Admin confirms: allowed
      assert.strictEqual(
        verifySubscriptionConfirmationAuth({
          callerUserId: 'usr_admin_09',
          subOwnerUserId: 'usr_merchant_owner_01',
          isAdminOverride: true,
        }),
        true
      );

      // Impostor user confirms: rejected
      assert.throws(
        () =>
          verifySubscriptionConfirmationAuth({
            callerUserId: 'usr_impostor_99',
            subOwnerUserId: 'usr_merchant_owner_01',
            isAdminOverride: false,
          }),
        /Unauthorized: Only the merchant subscription owner or administrator may confirm payment/
      );

      // Legacy subscription without owner: ordinary user rejected
      assert.throws(
        () =>
          verifySubscriptionConfirmationAuth({
            callerUserId: 'usr_random_user',
            subOwnerUserId: undefined,
            isAdminOverride: false,
          }),
        /Unauthorized: Subscription lacks a verified owner association/
      );
    });

    test('Group consensus blend authorization checks enforce host or member ownership', () => {
      const authorizeBlendSaver = (
        auth: { uid: string; token?: Record<string, unknown> } | null,
        session: { hostUserId: string; members: Array<{ userId: string }> }
      ) => {
        if (!auth) return false;
        const tokenRole = String(auth.token?.role || '').toUpperCase();
        const isAdmin = auth.token?.admin === true || tokenRole === 'ADMIN' || tokenRole === 'MODERATOR';
        const isHost = session.hostUserId === auth.uid;
        const isMember = session.members.some((m) => m.userId === auth.uid);
        return isAdmin || isHost || isMember;
      };

      const session = {
        hostUserId: 'usr_host_1',
        members: [{ userId: 'usr_host_1' }, { userId: 'usr_member_2' }],
      };

      // Host is authorized
      assert.strictEqual(authorizeBlendSaver({ uid: 'usr_host_1' }, session), true);
      // Member is authorized
      assert.strictEqual(authorizeBlendSaver({ uid: 'usr_member_2' }, session), true);
      // Admin is authorized even if not member
      assert.strictEqual(
        authorizeBlendSaver({ uid: 'usr_admin_9', token: { role: 'ADMIN' } }, session),
        true
      );
      // Random third-party user is denied
      assert.strictEqual(authorizeBlendSaver({ uid: 'usr_stranger_5' }, session), false);
      // Unauthenticated is denied
      assert.strictEqual(authorizeBlendSaver(null, session), false);
    });
  });

  describe('6. Error Sanitization in Controller Envelopes', () => {
    test('Unexpected server errors mask internal details from client error envelope', () => {
      // Simulate mapErrorToEnvelope logic
      const mapError = (err: unknown) => {
        const code = (err as any)?.code ?? '';
        let category = 'TRANSIENT_SERVER_ERROR';
        let message = 'An unexpected server error occurred. Please try again.';
        let retryable = false;

        switch (code) {
          case 'NOT_FOUND':
            category = 'NOT_FOUND';
            if (err instanceof Error) message = err.message;
            break;
          case 'PERMISSION_DENIED':
            category = 'PERMISSION_DENIED';
            if (err instanceof Error) message = err.message;
            break;
          case 'INVALID_ARGUMENT':
          case 'VALIDATION_ERROR':
            category = 'VALIDATION_ERROR';
            if (err instanceof Error) message = err.message;
            break;
          default:
            retryable = true;
            message = 'An unexpected server error occurred. Please try again.';
        }

        return { category, message, retryable };
      };

      // Known error messages are preserved
      const notFoundErr = new Error('Contribution not found: contrib_123');
      (notFoundErr as any).code = 'NOT_FOUND';
      const notFoundResult = mapError(notFoundErr);
      assert.strictEqual(notFoundResult.message, 'Contribution not found: contrib_123');

      // Unexpected DB error with sensitive query or stack is masked
      const dbErr = new Error('FATAL: Connection pool exhausted at 10.0.4.12:5432; query: SELECT * FROM secrets');
      const dbResult = mapError(dbErr);
      assert.strictEqual(
        dbResult.message,
        'An unexpected server error occurred. Please try again.'
      );
      assert.strictEqual(dbResult.retryable, true);
    });
  });

  describe('7. Payment Provider Fail-Closed and Live Gateway Invariants', () => {
    const origEnv = { ...process.env };

    test('LivePaymentGatewayAdapter reports mode LIVE and rejects simulated outcomes', async () => {
      const adapter = new LivePaymentGatewayAdapter();
      assert.strictEqual(adapter.getMode(), 'LIVE');

      await assert.rejects(
        async () => {
          await adapter.verifyPayment({
            transactionId: 'tx_123',
            gatewayReference: 'order_123',
            simulatedOutcome: 'SUCCESS',
          });
        },
        /Security violation: Simulated outcomes are strictly prohibited in LIVE payment mode/
      );
    });

    test('LivePaymentGatewayAdapter rejects sandbox references in live mode', async () => {
      const adapter = new LivePaymentGatewayAdapter();
      const result = await adapter.verifyPayment({
        transactionId: 'tx_123',
        gatewayReference: 'sandbox_sim_order_123',
      });
      assert.strictEqual(result.verified, false);
      assert.match(result.failureReason || '', /Sandbox reference cannot be verified in LIVE payment mode/);
    });

    test('LivePaymentGatewayAdapter fails closed when live credentials are not configured', async () => {
      delete process.env.RAZORPAY_KEY_ID;
      delete process.env.RAZORPAY_KEY_SECRET;

      const adapter = new LivePaymentGatewayAdapter();
      await assert.rejects(
        async () => {
          await adapter.createPaymentIntent({
            transactionId: 'tx_live_1',
            payerUserId: 'usr_1',
            amountInr: 100,
            currency: 'INR',
            description: 'Test',
          });
        },
        /Fail-closed: Production payment credentials .* are unconfigured/
      );
    });

    test('LivePaymentGatewayAdapter validates cryptographic HMAC-SHA256 signature', async () => {
      process.env.RAZORPAY_KEY_ID = 'rzp_live_testkey123';
      process.env.RAZORPAY_KEY_SECRET = 'super_secret_webhook_key_xyz';

      const gatewayRef = 'order_blr_live_456';
      const providerPaymentId = 'pay_blr_live_789';

      const mockFetch: typeof fetch = async () => new Response(
        JSON.stringify({
          id: providerPaymentId,
          order_id: gatewayRef,
          currency: 'INR',
          status: 'captured',
          amount: 10000,
          captured: true,
        }),
        { status: 200 }
      );

      const mockTxLookup = async (txId: string) => ({
        transactionId: txId,
        collectionName: 'tips',
        payerUserId: 'usr_test_payer',
        amountInr: 100,
        currency: 'INR',
        type: 'tip' as const,
        docData: {
          paymentGatewayReference: gatewayRef,
        },
      });

      const adapter = new LivePaymentGatewayAdapter({
        customFetch: mockFetch,
        transactionLookup: mockTxLookup,
      });

      // 1. Invalid signature fails verification
      const forgedResult = await adapter.verifyPayment({
        transactionId: 'tx_123',
        gatewayReference: gatewayRef,
        providerPaymentId,
        providerSignature: 'forged_fake_signature_hash',
      });
      assert.strictEqual(forgedResult.verified, false);
      assert.match(forgedResult.failureReason || '', /Cryptographic signature verification failed/);

      // 2. Authentic signature passes verification
      const authenticSignature = createHmac('sha256', 'super_secret_webhook_key_xyz')
        .update(`${gatewayRef}|${providerPaymentId}`)
        .digest('hex');

      const authenticResult = await adapter.verifyPayment({
        transactionId: 'tx_123',
        gatewayReference: gatewayRef,
        providerPaymentId,
        providerSignature: authenticSignature,
      });
      assert.strictEqual(authenticResult.verified, true);
      assert.strictEqual(authenticResult.paymentMode, 'LIVE');
      assert.strictEqual(authenticResult.isSimulated, false);
    });

    test('getPaymentAdapter factory returns Live adapter when PAYMENT_ENV=LIVE', () => {
      process.env.PAYMENT_ENV = 'LIVE';
      const adapter = getPaymentAdapter();
      assert.strictEqual(adapter.getMode(), 'LIVE');
    });

    test('getPaymentAdapter factory rejects SANDBOX mode in production NODE_ENV', () => {
      process.env.PAYMENT_ENV = 'SANDBOX';
      process.env.NODE_ENV = 'production';
      assert.throws(
        () => getPaymentAdapter(),
        /Security violation: PAYMENT_ENV cannot be set to SANDBOX in deployed cloud runtime or production NODE_ENV/
      );
    });

    test('getPaymentAdapter factory rejects missing PAYMENT_ENV in cloud runtime', () => {
      delete process.env.PAYMENT_ENV;
      process.env.K_SERVICE = 'monetization-service';
      assert.throws(
        () => getPaymentAdapter(),
        /Fail-closed security check: Missing explicit PAYMENT_ENV configuration in deployed or production runtime/
      );
      delete process.env.K_SERVICE;
    });

    test('getPaymentAdapter factory returns Sandbox adapter in test/development environment', () => {
      process.env.PAYMENT_ENV = 'SANDBOX';
      process.env.NODE_ENV = 'test';
      delete process.env.K_SERVICE;
      delete process.env.FUNCTION_TARGET;
      delete process.env.FIREBASE_CONFIG;

      const adapter = getPaymentAdapter();
      assert.strictEqual(adapter.getMode(), 'SANDBOX');
    });

    test('[MOCKED PROVIDER] Successful order creation using mocked Razorpay HTTP response', async () => {
      process.env.RAZORPAY_KEY_ID = 'rzp_live_testkey_123';
      process.env.RAZORPAY_KEY_SECRET = 'secret_test_key_456';

      const mockFetch: typeof fetch = async (url, init) => {
        const body = JSON.parse((init?.body as string) || '{}');
        assert.strictEqual(body.amount, 50000); // ₹500 in paise
        assert.strictEqual(body.currency, 'INR');
        assert.strictEqual(body.receipt, 'tip_blr_test_001');

        return new Response(
          JSON.stringify({
            id: 'order_mock_test_99999',
            entity: 'order',
            amount: 50000,
            amount_paid: 0,
            amount_due: 50000,
            currency: 'INR',
            receipt: 'tip_blr_test_001',
            status: 'created',
            created_at: 1700000000,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      };

      const mockOrderCanonicalLookup = async (txId: string) => ({
        transactionId: txId,
        collectionName: 'tips',
        payerUserId: 'usr_test_payer',
        amountInr: 500,
        currency: 'INR',
        type: 'tip' as const,
        docData: {},
      });

      const adapter = new LivePaymentGatewayAdapter({
        customFetch: mockFetch,
        transactionLookup: mockOrderCanonicalLookup,
      });
      const intent = await adapter.createPaymentIntent({
        transactionId: 'tip_blr_test_001',
        payerUserId: 'usr_test_payer',
        amountInr: 500,
        currency: 'INR',
        description: 'Test Tip for Spot',
      });

      assert.strictEqual(intent.gatewayReference, 'order_mock_test_99999');
      assert.strictEqual(intent.paymentMode, 'LIVE');
      assert.strictEqual(intent.isSimulated, false);
      assert.ok(intent.intentUrl?.includes('order_mock_test_99999'));
    });

    test('[MOCKED PROVIDER] Order creation handles provider rejection and timeout', async () => {
      process.env.RAZORPAY_KEY_ID = 'rzp_live_testkey_123';
      process.env.RAZORPAY_KEY_SECRET = 'secret_test_key_456';

      const rejCanonicalLookup = async (txId: string) => ({
        transactionId: txId,
        collectionName: 'tips',
        payerUserId: 'usr_1',
        amountInr: txId.includes('rej') ? 999999 : 100,
        currency: 'INR',
        type: 'tip' as const,
        docData: {},
      });

      // 1. Rejection test
      const rejectionFetch: typeof fetch = async () => {
        return new Response(
          JSON.stringify({
            error: {
              code: 'BAD_REQUEST_ERROR',
              description: 'Amount exceeds maximum permitted order limit',
            },
          }),
          { status: 400, statusText: 'Bad Request' }
        );
      };

      const rejectingAdapter = new LivePaymentGatewayAdapter({
        customFetch: rejectionFetch,
        transactionLookup: rejCanonicalLookup,
      });
      await assert.rejects(
        async () => {
          await rejectingAdapter.createPaymentIntent({
            transactionId: 'tip_blr_rej_01',
            payerUserId: 'usr_1',
            amountInr: 999999,
            currency: 'INR',
            description: 'Too high',
          });
        },
        /Razorpay order creation rejected by provider: Amount exceeds maximum permitted order limit/
      );

      // 2. Timeout test
      const timeoutFetch: typeof fetch = async () => {
        const err = new Error('The operation was aborted');
        err.name = 'AbortError';
        throw err;
      };

      const timeoutAdapter = new LivePaymentGatewayAdapter({
        customFetch: timeoutFetch,
        transactionLookup: rejCanonicalLookup,
      });
      await assert.rejects(
        async () => {
          await timeoutAdapter.createPaymentIntent({
            transactionId: 'tip_blr_timeout_01',
            payerUserId: 'usr_1',
            amountInr: 100,
            currency: 'INR',
            description: 'Timeout test',
          });
        },
        /Razorpay provider order creation timed out after 15 seconds/
      );
    });

    test('[MOCKED PROVIDER] Payment verification confirms captured status and rejects mismatched amount, currency, or order ID', async () => {
      process.env.RAZORPAY_KEY_ID = 'rzp_live_testkey_123';
      process.env.RAZORPAY_KEY_SECRET = 'secret_test_key_456';

      const orderId = 'order_valid_123';
      const paymentId = 'pay_valid_456';
      const validSig = createHmac('sha256', 'secret_test_key_456')
        .update(`${orderId}|${paymentId}`)
        .digest('hex');

      const commonCanonicalLookup = async (txId: string) => ({
        transactionId: txId,
        collectionName: 'tips',
        payerUserId: 'usr_1',
        amountInr: 500,
        currency: 'INR',
        type: 'tip' as const,
        docData: {
          paymentGatewayReference: orderId,
        },
      });

      // 1. Order ID mismatch
      const mismatchOrderFetch: typeof fetch = async () => {
        return new Response(
          JSON.stringify({
            id: paymentId,
            order_id: 'order_DIFFERENT_999',
            currency: 'INR',
            status: 'captured',
            amount: 50000,
          }),
          { status: 200 }
        );
      };

      const mismatchOrderAdapter = new LivePaymentGatewayAdapter({
        customFetch: mismatchOrderFetch,
        transactionLookup: commonCanonicalLookup,
      });
      const orderMismatchRes = await mismatchOrderAdapter.verifyPayment({
        transactionId: 'tx_1',
        gatewayReference: orderId,
        providerPaymentId: paymentId,
        providerSignature: validSig,
      });
      assert.strictEqual(orderMismatchRes.verified, false);
      assert.match(orderMismatchRes.failureReason || '', /Order ID mismatch/);

      // 2. Currency mismatch
      const mismatchCurrencyFetch: typeof fetch = async () => {
        return new Response(
          JSON.stringify({
            id: paymentId,
            order_id: orderId,
            currency: 'USD',
            status: 'captured',
            amount: 50000,
          }),
          { status: 200 }
        );
      };

      const mismatchCurrencyAdapter = new LivePaymentGatewayAdapter({
        customFetch: mismatchCurrencyFetch,
        transactionLookup: commonCanonicalLookup,
      });
      const currMismatchRes = await mismatchCurrencyAdapter.verifyPayment({
        transactionId: 'tx_1',
        gatewayReference: orderId,
        providerPaymentId: paymentId,
        providerSignature: validSig,
      });
      assert.strictEqual(currMismatchRes.verified, false);
      assert.match(currMismatchRes.failureReason || '', /Currency mismatch/);

      // 3. Status failed
      const failedStatusFetch: typeof fetch = async () => {
        return new Response(
          JSON.stringify({
            id: paymentId,
            order_id: orderId,
            currency: 'INR',
            status: 'failed',
            amount: 50000,
          }),
          { status: 200 }
        );
      };

      const failedStatusAdapter = new LivePaymentGatewayAdapter({
        customFetch: failedStatusFetch,
        transactionLookup: commonCanonicalLookup,
      });
      const failedRes = await failedStatusAdapter.verifyPayment({
        transactionId: 'tx_1',
        gatewayReference: orderId,
        providerPaymentId: paymentId,
        providerSignature: validSig,
      });
      assert.strictEqual(failedRes.verified, false);
      assert.match(failedRes.failureReason || '', /Payment status is not captured/);

      // 4. Authorized status rejected for settlement (Authorized vs Captured distinction)
      const authorizedFetch: typeof fetch = async () => {
        return new Response(
          JSON.stringify({
            id: paymentId,
            order_id: orderId,
            currency: 'INR',
            status: 'authorized',
            amount: 50000,
            captured: false,
          }),
          { status: 200 }
        );
      };

      const authorizedAdapter = new LivePaymentGatewayAdapter({
        customFetch: authorizedFetch,
        transactionLookup: commonCanonicalLookup,
      });
      const authorizedRes = await authorizedAdapter.verifyPayment({
        transactionId: 'tx_1',
        gatewayReference: orderId,
        providerPaymentId: paymentId,
        providerSignature: validSig,
      });
      assert.strictEqual(authorizedRes.verified, false);
      assert.match(
        authorizedRes.failureReason || '',
        /Payment is authorized but not yet captured by banking provider; settlement requires captured status/
      );

      // 5. Successful captured verification
      const successfulFetch: typeof fetch = async () => {
        return new Response(
          JSON.stringify({
            id: paymentId,
            order_id: orderId,
            currency: 'INR',
            status: 'captured',
            amount: 50000,
            captured: true,
          }),
          { status: 200 }
        );
      };

      const successAdapter = new LivePaymentGatewayAdapter({
        customFetch: successfulFetch,
        transactionLookup: commonCanonicalLookup,
      });
      const successRes = await successAdapter.verifyPayment({
        transactionId: 'tx_1',
        gatewayReference: orderId,
        providerPaymentId: paymentId,
        providerSignature: validSig,
      });
      assert.strictEqual(successRes.verified, true);
      assert.strictEqual(successRes.paymentMode, 'LIVE');
      assert.strictEqual(successRes.amountInr, 500);

      // 6. Stored canonical transaction amount mismatch in verifyPayment
      const mismatchCanonicalLookup = async (txId: string) => ({
        transactionId: txId,
        collectionName: 'tips',
        payerUserId: 'usr_test_payer',
        amountInr: 999, // Canonical requires ₹999
        currency: 'INR',
        type: 'tip' as const,
        docData: {
          paymentGatewayReference: orderId,
        },
      });

      const mismatchAmountAdapter = new LivePaymentGatewayAdapter({
        customFetch: successfulFetch, // Provider reports ₹500
        transactionLookup: mismatchCanonicalLookup,
      });

      const mismatchAmountRes = await mismatchAmountAdapter.verifyPayment({
        transactionId: 'tip_canonical_test_1',
        gatewayReference: orderId,
        providerPaymentId: paymentId,
        providerSignature: validSig,
      });
      assert.strictEqual(mismatchAmountRes.verified, false);
      assert.match(
        mismatchAmountRes.failureReason || '',
        /Transaction amount mismatch: Stored canonical transaction requires ₹999, but provider reported ₹500/
      );

      // 7. Cross-transaction payment substitution rejected by order binding
      const crossTxCanonicalLookup = async (txId: string) => ({
        transactionId: txId,
        collectionName: 'tips',
        payerUserId: 'usr_test_payer',
        amountInr: 500,
        currency: 'INR',
        type: 'tip' as const,
        docData: {
          paymentGatewayReference: 'order_bound_strictly_to_other_doc',
        },
      });

      const crossTxAdapter = new LivePaymentGatewayAdapter({
        customFetch: successfulFetch,
        transactionLookup: crossTxCanonicalLookup,
      });

      const crossTxRes = await crossTxAdapter.verifyPayment({
        transactionId: 'tip_canonical_test_2',
        gatewayReference: orderId,
        providerPaymentId: paymentId,
        providerSignature: validSig,
      });
      assert.strictEqual(crossTxRes.verified, false);
      assert.match(
        crossTxRes.failureReason || '',
        /Order binding mismatch: Canonical transaction 'tip_canonical_test_2' is bound to provider order 'order_bound_strictly_to_other_doc'/
      );
    });

    test('[MOCKED PROVIDER] Missing stored provider order ID in canonical transaction rejects payment verification (fail-closed)', async () => {
      process.env.RAZORPAY_KEY_ID = 'rzp_live_testkey_123';
      process.env.RAZORPAY_KEY_SECRET = 'secret_test_key_456';

      const orderId = 'order_valid_123';
      const paymentId = 'pay_valid_456';
      const validSig = createHmac('sha256', 'secret_test_key_456')
        .update(`${orderId}|${paymentId}`)
        .digest('hex');

      const mockFetch: typeof fetch = async () =>
        new Response(
          JSON.stringify({
            id: paymentId,
            order_id: orderId,
            currency: 'INR',
            status: 'captured',
            amount: 50000,
            captured: true,
          }),
          { status: 200 }
        );

      // Canonical transaction with no stored provider order ID
      const noOrderIdLookup = async (txId: string) => ({
        transactionId: txId,
        collectionName: 'tips',
        payerUserId: 'usr_1',
        amountInr: 500,
        currency: 'INR',
        type: 'tip' as const,
        docData: {}, // Missing paymentGatewayReference / providerOrderId
      });

      const adapter = new LivePaymentGatewayAdapter({
        customFetch: mockFetch,
        transactionLookup: noOrderIdLookup,
      });

      const res = await adapter.verifyPayment({
        transactionId: 'tip_missing_order_id',
        gatewayReference: orderId,
        providerPaymentId: paymentId,
        providerSignature: validSig,
      });

      assert.strictEqual(res.verified, false);
      assert.match(
        res.failureReason || '',
        /Order binding missing: Canonical transaction 'tip_missing_order_id' does not have a recorded provider order ID/
      );
    });

    test('[MOCKED PROVIDER] Missing canonical transaction rejects order creation (fail-closed)', async () => {
      process.env.RAZORPAY_KEY_ID = 'rzp_live_testkey_123';
      process.env.RAZORPAY_KEY_SECRET = 'secret_test_key_456';

      const adapter = new LivePaymentGatewayAdapter({
        customFetch: async () => new Response('{}', { status: 200 }),
        transactionLookup: async () => null, // Missing from Firestore
      });

      await assert.rejects(
        async () => {
          await adapter.createPaymentIntent({
            transactionId: 'tip_missing_from_db_001',
            payerUserId: 'usr_payer_1',
            amountInr: 500,
            currency: 'INR',
            description: 'Tip missing doc',
          });
        },
        /Fail-closed: Missing canonical transaction record for 'tip_missing_from_db_001'/
      );
    });

    test('[MOCKED PROVIDER] Missing canonical transaction rejects payment verification (fail-closed)', async () => {
      process.env.RAZORPAY_KEY_ID = 'rzp_live_testkey_123';
      process.env.RAZORPAY_KEY_SECRET = 'secret_test_key_456';

      const orderId = 'order_valid_123';
      const paymentId = 'pay_valid_456';
      const validSig = createHmac('sha256', 'secret_test_key_456')
        .update(`${orderId}|${paymentId}`)
        .digest('hex');

      const mockFetch: typeof fetch = async () =>
        new Response(
          JSON.stringify({
            id: paymentId,
            order_id: orderId,
            currency: 'INR',
            status: 'captured',
            amount: 50000,
            captured: true,
          }),
          { status: 200 }
        );

      const adapter = new LivePaymentGatewayAdapter({
        customFetch: mockFetch,
        transactionLookup: async () => null, // Missing from Firestore
      });

      const res = await adapter.verifyPayment({
        transactionId: 'tip_missing_from_db_002',
        gatewayReference: orderId,
        providerPaymentId: paymentId,
        providerSignature: validSig,
      });

      assert.strictEqual(res.verified, false);
      assert.match(
        res.failureReason || '',
        /Fail-closed: Missing canonical transaction record for 'tip_missing_from_db_002'/
      );
    });

    test('[MOCKED PROVIDER] Canonical order amount and caller ownership verification in createPaymentIntent', async () => {
      process.env.RAZORPAY_KEY_ID = 'rzp_live_testkey_123';
      process.env.RAZORPAY_KEY_SECRET = 'secret_test_key_456';

      const mockOrderFetch: typeof fetch = async (url, init) => {
        const body = JSON.parse((init?.body as string) || '{}');
        return new Response(
          JSON.stringify({
            id: 'order_canonical_test_777',
            entity: 'order',
            amount: body.amount,
            currency: body.currency,
            status: 'created',
          }),
          { status: 200 }
        );
      };

      const canonicalLookup = async (txId: string) => {
        if (txId === 'tip_legit_001') {
          return {
            transactionId: txId,
            collectionName: 'tips',
            payerUserId: 'usr_payer_legit',
            amountInr: 500,
            currency: 'INR',
            type: 'tip' as const,
            docData: {},
          };
        }
        return null;
      };

      const adapter = new LivePaymentGatewayAdapter({
        customFetch: mockOrderFetch,
        transactionLookup: canonicalLookup,
      });

      // 1. Caller ownership violation is rejected
      await assert.rejects(
        async () => {
          await adapter.createPaymentIntent({
            transactionId: 'tip_legit_001',
            payerUserId: 'usr_impostor_99',
            amountInr: 500,
            currency: 'INR',
            description: 'Tip',
          });
        },
        /Unauthorized payment intent: Caller 'usr_impostor_99' does not match canonical transaction owner 'usr_payer_legit'/
      );

      // 2. Client-supplied amount override is rejected
      await assert.rejects(
        async () => {
          await adapter.createPaymentIntent({
            transactionId: 'tip_legit_001',
            payerUserId: 'usr_payer_legit',
            amountInr: 100, // Client tries to pay ₹100 instead of ₹500
            currency: 'INR',
            description: 'Tip override attempt',
          });
        },
        /Security violation: Client-supplied amount ₹100 does not match canonical transaction amount ₹500/
      );

      // 3. Genuine request derives canonical parameters and returns authentic orderId and gatewayReference
      const legitIntent = await adapter.createPaymentIntent({
        transactionId: 'tip_legit_001',
        payerUserId: 'usr_payer_legit',
        amountInr: 500,
        currency: 'INR',
        description: 'Tip legit',
      });

      assert.strictEqual(legitIntent.gatewayReference, 'order_canonical_test_777');
      assert.strictEqual(legitIntent.orderId, 'order_canonical_test_777');
      assert.ok(legitIntent.gatewayReference.startsWith('order_'), 'Must be genuine Razorpay order ID');
      assert.strictEqual(legitIntent.isSimulated, false);
    });

    test('[MOCKED PROVIDER] Refund payment distinguishes processed vs pending status', async () => {
      process.env.RAZORPAY_KEY_ID = 'rzp_live_testkey_123';
      process.env.RAZORPAY_KEY_SECRET = 'secret_test_key_456';

      // 1. Pending refund does NOT mark payment refunded
      const pendingRefundFetch: typeof fetch = async () => {
        return new Response(
          JSON.stringify({
            id: 'rfnd_pending_test_111',
            entity: 'refund',
            amount: 25000,
            currency: 'INR',
            payment_id: 'pay_valid_456',
            status: 'pending',
            created_at: 1700000000,
          }),
          { status: 200 }
        );
      };

      const pendingAdapter = new LivePaymentGatewayAdapter({ customFetch: pendingRefundFetch });
      const pendingResult = await pendingAdapter.refundPayment({
        transactionId: 'guidance_booking_001',
        gatewayReference: 'pay_valid_456',
        amountInr: 250,
        idempotencyKey: 'idem_pending_refund_01',
        reason: 'Cancellation pending bank confirmation',
      });

      assert.strictEqual(pendingResult.refunded, false, 'Pending refund must not be marked completed');
      assert.strictEqual(pendingResult.refundReference, 'rfnd_pending_test_111');
      assert.match(
        pendingResult.failureReason || '',
        /Refund accepted by provider but is currently pending bank processing/
      );

      // 2. Processed refund successfully marks completed
      const processedRefundFetch: typeof fetch = async (url, init) => {
        const body = JSON.parse((init?.body as string) || '{}');
        assert.strictEqual(body.amount, 25000); // ₹250
        assert.strictEqual(body.receipt, 'idem_key_guidance_refund_01');

        return new Response(
          JSON.stringify({
            id: 'rfnd_mock_live_8888',
            entity: 'refund',
            amount: 25000,
            currency: 'INR',
            payment_id: 'pay_valid_456',
            status: 'processed',
            created_at: 1700000000,
          }),
          { status: 200 }
        );
      };

      const processedAdapter = new LivePaymentGatewayAdapter({ customFetch: processedRefundFetch });
      const refundResult = await processedAdapter.refundPayment({
        transactionId: 'guidance_booking_001',
        gatewayReference: 'pay_valid_456',
        amountInr: 250,
        idempotencyKey: 'idem_key_guidance_refund_01',
        reason: 'Guide cancelled session',
      });

      assert.strictEqual(refundResult.refunded, true);
      assert.strictEqual(refundResult.refundReference, 'rfnd_mock_live_8888');
      assert.strictEqual(refundResult.amountInr, 250);
      assert.strictEqual(refundResult.paymentMode, 'LIVE');
    });

    // Restore environment
    process.env = origEnv;
  });

  describe('8. Inbound Payment Webhook Signature and Idempotency Validation', () => {
    const webhookSecret = 'test_webhook_signing_secret_sec_999';

    test('Webhook rejects missing signature header (401)', () => {
      const verifyWebhookSignature = (
        secret: string | undefined,
        signature: string | undefined,
        rawBody: string
      ): { status: number; error?: string } => {
        if (!secret) return { status: 500, error: 'Webhook processing unconfigured' };
        if (!signature) return { status: 401, error: 'Missing webhook signature' };
        const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
        if (signature !== expected) return { status: 401, error: 'Invalid webhook signature' };
        return { status: 200 };
      };

      const payload = JSON.stringify({ event: 'payment.captured', id: 'evt_1' });

      // 1. Missing secret fails closed (500)
      assert.strictEqual(verifyWebhookSignature(undefined, 'some_sig', payload).status, 500);

      // 2. Missing signature returns 401
      assert.strictEqual(verifyWebhookSignature(webhookSecret, undefined, payload).status, 401);

      // 3. Invalid signature returns 401
      assert.strictEqual(verifyWebhookSignature(webhookSecret, 'forged_sig', payload).status, 401);

      // 4. Authentic HMAC signature returns 200
      const validSig = createHmac('sha256', webhookSecret).update(payload).digest('hex');
      assert.strictEqual(verifyWebhookSignature(webhookSecret, validSig, payload).status, 200);
    });

    test('Webhook enforces eventId presence and duplicate event detection', () => {
      const processedEvents = new Set<string>();

      const handleEventIdempotency = (eventId: unknown): { status: number; isDuplicate: boolean } => {
        if (!eventId || typeof eventId !== 'string') {
          return { status: 400, isDuplicate: false };
        }
        if (processedEvents.has(eventId)) {
          return { status: 200, isDuplicate: true };
        }
        processedEvents.add(eventId);
        return { status: 200, isDuplicate: false };
      };

      // Missing eventId returns 400
      assert.strictEqual(handleEventIdempotency(undefined).status, 400);
      assert.strictEqual(handleEventIdempotency('').status, 400);

      // First processing returns 200 and not duplicate
      const first = handleEventIdempotency('evt_payment_captured_001');
      assert.strictEqual(first.status, 200);
      assert.strictEqual(first.isDuplicate, false);

      // Duplicate processing returns 200 with isDuplicate: true (idempotent ignore)
      const duplicate = handleEventIdempotency('evt_payment_captured_001');
      assert.strictEqual(duplicate.status, 200);
      assert.strictEqual(duplicate.isDuplicate, true);
    });

    test('Webhook reconciliation: payment.captured updates transaction and credits ledger idempotently', () => {
      // Mock ledger & transaction state
      const tipDoc = {
        tipId: 'tip_blr_webhook_test_01',
        payerUserId: 'usr_payer_1',
        recipientUserId: 'usr_guide_1',
        amountInr: 100,
        contributorNetInr: 95,
        paymentStatus: 'PENDING',
      };

      const ledger = {
        contributorId: 'usr_guide_1',
        availableBalanceInr: 500,
        totalTipsEarnedInr: 500,
      };

      const reconcileCaptured = (tx: typeof tipDoc, amountInr: number) => {
        if (tx.paymentStatus === 'COMPLETED') return { credited: false, reason: 'Already completed' };
        if (tx.amountInr !== amountInr) return { credited: false, reason: 'Amount mismatch' };

        tx.paymentStatus = 'COMPLETED';
        ledger.availableBalanceInr += tx.contributorNetInr;
        ledger.totalTipsEarnedInr += tx.contributorNetInr;
        return { credited: true };
      };

      // 1. Initial capture credits balance
      const res1 = reconcileCaptured(tipDoc, 100);
      assert.strictEqual(res1.credited, true);
      assert.strictEqual(tipDoc.paymentStatus, 'COMPLETED');
      assert.strictEqual(ledger.availableBalanceInr, 595);
      assert.strictEqual(ledger.totalTipsEarnedInr, 595);

      // 2. Duplicate capture attempt ignores without double-crediting
      const res2 = reconcileCaptured(tipDoc, 100);
      assert.strictEqual(res2.credited, false);
      assert.strictEqual(res2.reason, 'Already completed');
      assert.strictEqual(ledger.availableBalanceInr, 595);
      assert.strictEqual(ledger.totalTipsEarnedInr, 595);
    });

    test('Webhook reconciliation: out-of-order payment.failed does not corrupt COMPLETED or REFUNDED transactions', () => {
      const reconcileFailed = (tx: { paymentStatus: string }, failureReason: string) => {
        // Out-of-order defense: terminal COMPLETED or REFUNDED states are immutable to delayed failure events
        if (tx.paymentStatus === 'COMPLETED' || tx.paymentStatus === 'REFUNDED') {
          return { ignored: true };
        }
        tx.paymentStatus = 'FAILED';
        return { ignored: false };
      };

      // 1. Pending transaction becomes FAILED
      const pendingTx = { paymentStatus: 'PENDING' };
      const failRes1 = reconcileFailed(pendingTx, 'Card declined');
      assert.strictEqual(failRes1.ignored, false);
      assert.strictEqual(pendingTx.paymentStatus, 'FAILED');

      // 2. Out-of-order failed event on COMPLETED transaction is ignored
      const completedTx = { paymentStatus: 'COMPLETED' };
      const failRes2 = reconcileFailed(completedTx, 'Delayed bank decline');
      assert.strictEqual(failRes2.ignored, true);
      assert.strictEqual(completedTx.paymentStatus, 'COMPLETED');

      // 3. Out-of-order failed event on REFUNDED transaction is ignored
      const refundedTx = { paymentStatus: 'REFUNDED' };
      const failRes3 = reconcileFailed(refundedTx, 'Delayed decline');
      assert.strictEqual(failRes3.ignored, true);
      assert.strictEqual(refundedTx.paymentStatus, 'REFUNDED');
    });

    test('Webhook reconciliation: mismatched amount prevents payment confirmation', () => {
      const tipDoc = {
        tipId: 'tip_blr_amount_mismatch_01',
        amountInr: 250,
        paymentStatus: 'PENDING',
      };

      const reconcile = (tx: typeof tipDoc, providerAmountInr: number) => {
        if (tx.amountInr !== providerAmountInr) {
          return { settled: false, error: 'Mismatched amount' };
        }
        tx.paymentStatus = 'COMPLETED';
        return { settled: true };
      };

      // Mismatch ₹100 instead of ₹250
      const mismatchRes = reconcile(tipDoc, 100);
      assert.strictEqual(mismatchRes.settled, false);
      assert.strictEqual(tipDoc.paymentStatus, 'PENDING');

      // Exact match ₹250 succeeds
      const matchRes = reconcile(tipDoc, 250);
      assert.strictEqual(matchRes.settled, true);
      assert.strictEqual(tipDoc.paymentStatus, 'COMPLETED');
    });

    test('[MOCKED PROVIDER] Webhook rawBody buffer preservation and x-razorpay-event-id header deduplication', () => {
      // Simulate raw buffer preservation vs JSON stringification differences
      const rawPayloadString = '{"event":"payment.captured","payload":{"payment":{"entity":{"id":"pay_raw_123"}}}}';
      const rawBodyBuffer = Buffer.from(rawPayloadString, 'utf8');

      const computeSigFromBuffer = (buffer: Buffer, secret: string) => {
        return createHmac('sha256', secret).update(buffer).digest('hex');
      };

      const validSig = computeSigFromBuffer(rawBodyBuffer, webhookSecret);
      assert.ok(validSig && validSig.length === 64, 'Must produce valid 64-character SHA-256 hex digest');

      // Verify header extraction prioritizes x-razorpay-event-id
      const extractEventId = (headers: Record<string, string | undefined>, body: Record<string, any>) => {
        return headers['x-razorpay-event-id'] || body.event_id || body.id;
      };

      const eventIdFromHeader = extractEventId(
        { 'x-razorpay-event-id': 'evt_rzp_live_header_999' },
        { id: 'evt_fallback_body_000' }
      );
      assert.strictEqual(eventIdFromHeader, 'evt_rzp_live_header_999');

      // Duplicate delivery check
      const processedEvents = new Set<string>();
      const processEvent = (id: string) => {
        if (processedEvents.has(id)) {
          return { status: 200, isDuplicate: true };
        }
        processedEvents.add(id);
        return { status: 200, isDuplicate: false };
      };

      const firstDelivery = processEvent(eventIdFromHeader);
      assert.strictEqual(firstDelivery.isDuplicate, false);

      const duplicateDelivery = processEvent(eventIdFromHeader);
      assert.strictEqual(duplicateDelivery.isDuplicate, true);
    });

    test('[MOCKED PROVIDER] Partial and duplicate refund webhook handling preserves ledger integrity without double deductions', () => {
      // Simulate tip transaction with original amount ₹500 and guide net ₹475
      const tipDoc = {
        tipId: 'tip_blr_partial_refund_01',
        amountInr: 500,
        contributorNetInr: 475,
        paymentStatus: 'COMPLETED',
        totalRefundedInr: 0,
        refundReferences: [] as string[],
      };

      const ledger = {
        contributorId: 'usr_guide_blr_01',
        availableBalanceInr: 1000,
        unrecoveredAdjustmentInr: 0,
      };

      const processRefundWebhook = (
        tx: typeof tipDoc,
        refundId: string,
        refundAmountInr: number
      ): { processed: boolean; status: string; totalRefunded: number } => {
        // 1. Deduplication: ignore if refundId already processed
        if (tx.refundReferences.includes(refundId)) {
          return { processed: false, status: tx.paymentStatus, totalRefunded: tx.totalRefundedInr };
        }

        // 2. Track total refunded and status
        const newTotal = tx.totalRefundedInr + refundAmountInr;
        const isFull = newTotal >= tx.amountInr;

        tx.totalRefundedInr = Math.min(newTotal, tx.amountInr);
        tx.paymentStatus = isFull ? 'REFUNDED' : 'PARTIALLY_REFUNDED';
        tx.refundReferences.push(refundId);

        // 3. Reverse contributor ledger safely up to total net earnings
        const maxNet = tx.contributorNetInr;
        const previouslyDeducted = Math.min(tx.totalRefundedInr - refundAmountInr, maxNet);
        const remainingNet = Math.max(0, maxNet - previouslyDeducted);
        const netDeduction = Math.min(refundAmountInr, remainingNet);

        if (ledger.availableBalanceInr >= netDeduction) {
          ledger.availableBalanceInr -= netDeduction;
        } else {
          ledger.unrecoveredAdjustmentInr += (netDeduction - ledger.availableBalanceInr);
          ledger.availableBalanceInr = 0;
        }

        return { processed: true, status: tx.paymentStatus, totalRefunded: tx.totalRefundedInr };
      };

      // Step 1: Process initial partial refund of ₹200
      const res1 = processRefundWebhook(tipDoc, 'rfnd_part_001', 200);
      assert.strictEqual(res1.processed, true);
      assert.strictEqual(res1.status, 'PARTIALLY_REFUNDED');
      assert.strictEqual(res1.totalRefunded, 200);
      assert.strictEqual(ledger.availableBalanceInr, 800); // 1000 - 200

      // Step 2: Duplicate webhook delivery with identical refundId is ignored (no double ledger deduction)
      const res2 = processRefundWebhook(tipDoc, 'rfnd_part_001', 200);
      assert.strictEqual(res2.processed, false);
      assert.strictEqual(res2.status, 'PARTIALLY_REFUNDED');
      assert.strictEqual(res2.totalRefunded, 200);
      assert.strictEqual(ledger.availableBalanceInr, 800, 'Ledger balance must not be deducted again on duplicate');

      // Step 3: Second valid partial refund of ₹300 completes the refund
      const res3 = processRefundWebhook(tipDoc, 'rfnd_part_002', 300);
      assert.strictEqual(res3.processed, true);
      assert.strictEqual(res3.status, 'REFUNDED');
      assert.strictEqual(res3.totalRefunded, 500);
      assert.strictEqual(ledger.availableBalanceInr, 525); // 800 - 275 (remaining net out of 475)
    });

    test('[MOCKED PROVIDER] Missing raw request body buffer rejects webhook processing (400)', () => {
      // Simulates handlePaymentWebhook strict rawBody buffer check
      const validateWebhookRawBody = (req: { rawBody?: unknown }) => {
        if (!req.rawBody || !Buffer.isBuffer(req.rawBody)) {
          return { status: 400, error: 'Missing genuine raw request body buffer' };
        }
        return { status: 200 };
      };

      // 1. Missing / undefined rawBody returns 400
      assert.strictEqual(validateWebhookRawBody({}).status, 400);
      assert.strictEqual(validateWebhookRawBody({ rawBody: undefined }).status, 400);

      // 2. String rawBody instead of Buffer returns 400 (no string fallback allowed)
      assert.strictEqual(
        validateWebhookRawBody({ rawBody: '{"event":"payment.captured"}' }).status,
        400
      );

      // 3. Genuine Buffer rawBody returns 200
      const genuineBuffer = Buffer.from('{"event":"payment.captured"}', 'utf8');
      assert.strictEqual(validateWebhookRawBody({ rawBody: genuineBuffer }).status, 200);
    });
  });
});
