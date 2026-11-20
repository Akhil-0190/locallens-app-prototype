/**
 * Maps, Places & Routes Controller Tests
 * Developer C - Master Technical Audit
 *
 * Verifies callable Cloud Function endpoints exported for Flutter clients and shared backends:
 * - computeWalkingRoute
 * - computeCapacityAwareRoute
 * - computePlanBReroute
 * - evaluateVenueCapacity
 * - groundContributedPlace
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  computeWalkingRoute,
  computeCapacityAwareRoute,
  computePlanBReroute,
  evaluateVenueCapacity,
  groundContributedPlace,
  reportVenueCrowd,
} from '../maps-controller.js';
import * as MapsExports from '../index.js';
import * as RootIndexExports from '../../index.js';

describe('Maps Controller — Firebase Callable Cloud Functions', () => {
  const mockAuthContext = {
    auth: {
      uid: 'user_audit_test_01',
      token: {} as any,
    },
    rawRequest: {} as any,
  };

  describe('1. Endpoint Export Verification', () => {
    it('should export all 6 callable functions from maps-controller', () => {
      assert.strictEqual(typeof computeWalkingRoute, 'function');
      assert.strictEqual(typeof computeCapacityAwareRoute, 'function');
      assert.strictEqual(typeof computePlanBReroute, 'function');
      assert.strictEqual(typeof evaluateVenueCapacity, 'function');
      assert.strictEqual(typeof groundContributedPlace, 'function');
      assert.strictEqual(typeof reportVenueCrowd, 'function');
    });

    it('should export maps module in maps/index.ts', () => {
      assert.strictEqual(typeof MapsExports.computeWalkingRoute, 'function');
      assert.strictEqual(typeof MapsExports.computeCapacityAwareRoute, 'function');
      assert.strictEqual(typeof MapsExports.computePlanBReroute, 'function');
      assert.strictEqual(typeof MapsExports.evaluateVenueCapacity, 'function');
      assert.strictEqual(typeof MapsExports.groundContributedPlace, 'function');
      assert.strictEqual(typeof MapsExports.reportVenueCrowd, 'function');
    });

    it('should export Maps namespace in root functions/src/index.ts', () => {
      assert.ok((RootIndexExports as any).Maps, 'Root index must export Maps module');
      assert.strictEqual(typeof (RootIndexExports as any).Maps.computeWalkingRoute, 'function');
      assert.strictEqual(typeof (RootIndexExports as any).Maps.computeCapacityAwareRoute, 'function');
      assert.strictEqual(typeof (RootIndexExports as any).Maps.computePlanBReroute, 'function');
      assert.strictEqual(typeof (RootIndexExports as any).Maps.evaluateVenueCapacity, 'function');
      assert.strictEqual(typeof (RootIndexExports as any).Maps.groundContributedPlace, 'function');
      assert.strictEqual(typeof (RootIndexExports as any).Maps.reportVenueCrowd, 'function');
    });
  });

  describe('2. Authentication and Argument Validation Guardrails', () => {
    it('computeWalkingRoute should reject unauthenticated invocation', async () => {
      await assert.rejects(
        async () => {
          await (computeWalkingRoute as any).run({
            auth: null,
            data: { stops: [] },
          });
        },
        {
          code: 'unauthenticated',
        }
      );
    });

    it('computeWalkingRoute should reject payload with fewer than 2 stops', async () => {
      await assert.rejects(
        async () => {
          await (computeWalkingRoute as any).run({
            ...mockAuthContext,
            data: {
              stops: [{ coordinate: { latitude: 13.0075, longitude: 77.5714 } }],
            },
          });
        },
        {
          code: 'invalid-argument',
        }
      );
    });

    it('computeCapacityAwareRoute should reject unauthenticated invocation', async () => {
      await assert.rejects(
        async () => {
          await (computeCapacityAwareRoute as any).run({
            auth: null,
            data: { stops: [] },
          });
        },
        {
          code: 'unauthenticated',
        }
      );
    });

    it('computePlanBReroute should reject missing originalRoute or disruptions', async () => {
      await assert.rejects(
        async () => {
          await (computePlanBReroute as any).run({
            ...mockAuthContext,
            data: { originalRoute: null, disruptions: null },
          });
        },
        {
          code: 'invalid-argument',
        }
      );
    });

    it('evaluateVenueCapacity should reject missing placeId or intendedVisitTime', async () => {
      await assert.rejects(
        async () => {
          await (evaluateVenueCapacity as any).run({
            ...mockAuthContext,
            data: { placeId: 'place_ctr_shri_sagar' },
          });
        },
        {
          code: 'invalid-argument',
        }
      );
    });

    it('groundContributedPlace should reject missing spotName', async () => {
      await assert.rejects(
        async () => {
          await (groundContributedPlace as any).run({
            ...mockAuthContext,
            data: { neighborhood: 'Malleswaram' },
          });
        },
        {
          code: 'invalid-argument',
        }
      );
    });

    it('reportVenueCrowd should reject unauthenticated invocation', async () => {
      await assert.rejects(
        async () => {
          await (reportVenueCrowd as any).run({
            auth: null,
            data: { placeId: 'place_veena_stores', crowdLevel: 'HIGH' },
          });
        },
        {
          code: 'unauthenticated',
        }
      );
    });

    it('reportVenueCrowd should reject missing placeId or crowdLevel', async () => {
      await assert.rejects(
        async () => {
          await (reportVenueCrowd as any).run({
            ...mockAuthContext,
            data: { placeId: 'place_veena_stores' },
          });
        },
        {
          code: 'invalid-argument',
        }
      );
    });

    it('reportVenueCrowd should reject invalid crowdLevel', async () => {
      await assert.rejects(
        async () => {
          await (reportVenueCrowd as any).run({
            ...mockAuthContext,
            data: { placeId: 'place_veena_stores', crowdLevel: 'SUPER_PACKED' },
          });
        },
        {
          code: 'invalid-argument',
        }
      );
    });
  });

  describe('3. Successful End-to-End Execution via Controller Callables', () => {
    it('computeWalkingRoute should return success envelope with valid canonical route', async () => {
      const response = await (computeWalkingRoute as any).run({
        ...mockAuthContext,
        data: {
          title: 'Audit Test Route',
          neighborhood: 'Malleswaram',
          stops: [
            { placeId: 'place_ctr_shri_sagar', spotName: 'CTR Shri Sagar', coordinate: { latitude: 13.0075, longitude: 77.5714 } },
            { placeId: 'place_veena_stores', spotName: 'Veena Stores', coordinate: { latitude: 13.0082, longitude: 77.5703 } },
          ],
          allowMockFallback: true,
        },
      });

      assert.strictEqual(response.success, true);
      assert.ok(response.data);
      assert.strictEqual(response.data.title, 'Audit Test Route');
      assert.strictEqual(response.data.legs.length, 1);
      assert.strictEqual(response.data.isMockData, true);
      assert.ok(response.metadata?.requestId);
      assert.ok(response.metadata?.executionDurationMs >= 0);
    });

    it('evaluateVenueCapacity should return success envelope with capacity evaluation', async () => {
      const response = await (evaluateVenueCapacity as any).run({
        ...mockAuthContext,
        data: {
          placeId: 'place_ctr_shri_sagar',
          intendedVisitTime: '2026-11-20T08:00:00.000Z',
          allowMockFallback: true,
        },
      });

      assert.strictEqual(response.success, true);
      assert.strictEqual(response.data.placeId, 'place_ctr_shri_sagar');
      assert.strictEqual(response.data.crowdLevel, 'MODERATE');
      assert.strictEqual(response.data.isMockData, true);
    });

    it('groundContributedPlace should return success envelope with canonical place draft', async () => {
      const response = await (groundContributedPlace as any).run({
        ...mockAuthContext,
        data: {
          spotName: 'CTR Shri Sagar',
          neighborhoodHint: 'Malleswaram',
          submittedCoordinate: { latitude: 13.0075, longitude: 77.5714 },
          allowMockFallback: true,
        },
      });

      assert.strictEqual(response.success, true);
      assert.ok(response.data.canonicalPlaceDraft);
      assert.strictEqual(response.data.canonicalPlaceDraft.spotName, 'CTR Shri Sagar (Malleshwaram)');
      assert.ok(response.data.evidence);
      assert.strictEqual(response.data.evidence.isMockData, true);
    });

    it('reportVenueCrowd should return success envelope with crowd report and updated capacity evaluation', async () => {
      const response = await (reportVenueCrowd as any).run({
        ...mockAuthContext,
        data: {
          placeId: 'place_veena_stores',
          crowdLevel: 'HIGH',
          estimatedWaitMinutes: 20,
          reporterType: 'LOCAL_RESIDENT',
          note: 'Breakfast rush on Margosa road',
        },
      });

      assert.strictEqual(response.success, true);
      assert.ok(response.data.signal);
      assert.strictEqual(response.data.signal.placeId, 'place_veena_stores');
      assert.strictEqual(response.data.signal.reportedCrowdLevel, 'HIGH');
      assert.strictEqual(response.data.rewardPointsEarned, 25);
      assert.ok(response.data.synthesizedEvaluation);
      assert.strictEqual(response.data.synthesizedEvaluation.placeId, 'place_veena_stores');
      assert.ok(response.metadata?.requestId);
    });
  });
});
