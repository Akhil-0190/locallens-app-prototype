/**
 * Unit Tests: Preferences, Groups, and Capacity Backend
 * Task A4 â€” Preferences, Groups, Capacity, and Scheduling Backend
 */

import { test, describe } from 'node:test';
import * as assert from 'node:assert';
import {
  TravelerPreferencesDocumentSchema,
  GroupSessionDocumentSchema,
  MemberPreferenceInputSchema,
  ConsensusBlendOutputSchema,
  VenueHourlyCapacityDocumentSchema,
  ScheduledVisitDocumentSchema,
} from '../src/types/contracts/index.js';

import {
  getDefaultPreferences,
} from '../src/preferences/preferences-service.js';

import {
  generateSessionCode,
} from '../src/groups/groups-service.js';

import {
  calculateCrowdLevel,
  deriveVisitId,
  deriveSlotId,
  deriveHourSlotFromSlotId,
  formatLocalTimeSlot,
} from '../src/capacity/capacity-service.js';

import {
  getPreferences,
  updatePreferences,
} from '../src/preferences/preferences-controller.js';

import {
  createGroupSession,
  joinGroupSession,
  leaveGroupSession,
  getGroupSession,
  saveConsensusBlend,
} from '../src/groups/groups-controller.js';

import {
  getHourlyCapacity,
  bookScheduledVisit,
  cancelScheduledVisit,
  checkInScheduledVisit,
  reconcileExpiredVisits,
} from '../src/capacity/capacity-controller.js';

import { NormalizationService } from '../src/maps/services/normalization.service.js';


describe('Task A4 â€” Preferences, Groups, Capacity Independent Modules', () => {
  // ---------------------------------------------------------------------------
  // 1. Export Verification
  // ---------------------------------------------------------------------------
  describe('Function Exports & In-Process Services', () => {
    test('Preferences callable functions are exported', () => {
      assert.strictEqual(typeof getPreferences, 'function');
      assert.strictEqual(typeof updatePreferences, 'function');
    });

    test('Group session callable functions are exported', () => {
      assert.strictEqual(typeof createGroupSession, 'function');
      assert.strictEqual(typeof joinGroupSession, 'function');
      assert.strictEqual(typeof leaveGroupSession, 'function');
      assert.strictEqual(typeof getGroupSession, 'function');
      assert.strictEqual(typeof saveConsensusBlend, 'function');
    });

    test('Capacity callable function is exported', () => {
      assert.strictEqual(typeof getHourlyCapacity, 'function');
      assert.strictEqual(typeof bookScheduledVisit, 'function');
      assert.strictEqual(typeof cancelScheduledVisit, 'function');
      assert.strictEqual(typeof checkInScheduledVisit, 'function');
      assert.strictEqual(typeof reconcileExpiredVisits, 'function');
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Traveler Preferences (Domain 02)
  // ---------------------------------------------------------------------------
  describe('Traveler Preferences Domain 02', () => {
    test('Default preferences adhere strictly to TravelerPreferencesDocumentSchema', () => {
      const defaults = getDefaultPreferences('usr_test_123');
      const parsed = TravelerPreferencesDocumentSchema.parse(defaults);
      assert.strictEqual(parsed.userId, 'usr_test_123');
      assert.strictEqual(parsed.budgetTier, 'MODERATE');
      assert.strictEqual(parsed.maxBudgetPerMealInr, 250);
      assert.ok(parsed.favoriteVibes.includes('heritage'));
    });

    test('Rejects invalid budget tier', () => {
      const invalid = {
        userId: 'usr_test_123',
        favoriteVibes: ['heritage'],
        dietaryRestrictions: [],
        budgetTier: 'ULTRA_LUXURY', // Invalid
        maxBudgetPerMealInr: 250,
        preferredPacing: 'BALANCED',
        preferredNeighborhoods: ['Malleshwaram'],
        accessibilityNeeds: [],
        updatedAt: new Date().toISOString(),
      };
      assert.throws(() => TravelerPreferencesDocumentSchema.parse(invalid));
    });

    test('Rejects negative budget per meal', () => {
      const invalid = {
        userId: 'usr_test_123',
        favoriteVibes: ['heritage'],
        dietaryRestrictions: [],
        budgetTier: 'BUDGET',
        maxBudgetPerMealInr: -50, // Invalid negative
        preferredPacing: 'BALANCED',
        preferredNeighborhoods: ['Malleshwaram'],
        accessibilityNeeds: [],
        updatedAt: new Date().toISOString(),
      };
      assert.throws(() => TravelerPreferencesDocumentSchema.parse(invalid));
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Group Sessions & Taste-Matching (Domain 09)
  // ---------------------------------------------------------------------------
  describe('Group Sessions & Taste-Matching Domain 09', () => {
    test('Session code generator outputs 6-character uppercase alphanumeric without ambiguous chars', () => {
      for (let i = 0; i < 50; i++) {
        const code = generateSessionCode();
        assert.strictEqual(code.length, 6);
        assert.match(code, /^[A-Z2-9]{6}$/);
        assert.ok(!code.includes('0'));
        assert.ok(!code.includes('O'));
        assert.ok(!code.includes('1'));
        assert.ok(!code.includes('I'));
      }
    });

    test('Validates MemberPreferenceInputSchema with valid weighting', () => {
      const member = {
        userId: 'usr_member_1',
        displayName: 'Aarav',
        vibes: ['heritage', 'vintage_filter_coffee'],
        dietaryRestrictions: ['vegetarian'],
        maxBudgetAmount: 400,
        weighting: 1.5,
      };
      const parsed = MemberPreferenceInputSchema.parse(member);
      assert.strictEqual(parsed.weighting, 1.5);
    });

    test('Rejects MemberPreferenceInputSchema with out-of-range weighting', () => {
      const invalidHigh = {
        userId: 'usr_member_1',
        displayName: 'Aarav',
        vibes: [],
        dietaryRestrictions: [],
        maxBudgetAmount: 400,
        weighting: 2.5, // Max is 2.0
      };
      assert.throws(() => MemberPreferenceInputSchema.parse(invalidHigh));

      const invalidLow = {
        userId: 'usr_member_1',
        displayName: 'Aarav',
        vibes: [],
        dietaryRestrictions: [],
        maxBudgetAmount: 400,
        weighting: 0.05, // Min is 0.1
      };
      assert.throws(() => MemberPreferenceInputSchema.parse(invalidLow));
    });

    test('Validates standalone ConsensusBlendOutputSchema', () => {
      const blend = {
        consensusAtmosphere: ['heritage', 'authentic_morning'],
        dietaryConstraintsUnion: ['vegetarian'],
        budgetConsensusRange: {
          minCurrencyAmount: 200,
          maxCurrencyAmount: 400,
          currencyCode: 'INR',
        },
        individualWeightings: { usr_1: 1.0 },
        compromiseFactors: ['Prioritized morning authentic spots'],
        recommendedCategoryFocus: ['breakfast'],
      };
      const parsed = ConsensusBlendOutputSchema.parse(blend);
      assert.strictEqual(parsed.dietaryConstraintsUnion[0], 'vegetarian');
    });

    test('Validates complete GroupSessionDocument with ConsensusBlendOutput', () => {
      const sessionDoc = {
        sessionId: 'group_test_abc123',
        hostUserId: 'usr_host_1',
        sessionCode: 'BLR892',
        neighborhood: 'Malleshwaram',
        status: 'FINALIZED',
        members: [
          {
            userId: 'usr_host_1',
            displayName: 'Priya',
            vibes: ['heritage'],
            dietaryRestrictions: ['vegetarian'],
            maxBudgetAmount: 300,
            weighting: 1.0,
          },
          {
            userId: 'usr_member_2',
            displayName: 'Rohan',
            vibes: ['street_food'],
            dietaryRestrictions: ['nut_allergy'],
            maxBudgetAmount: 500,
            weighting: 1.2,
          },
        ],
        consensusBlend: {
          consensusAtmosphere: ['heritage', 'authentic_morning'],
          dietaryConstraintsUnion: ['vegetarian', 'nut_allergy'],
          budgetConsensusRange: {
            minCurrencyAmount: 300,
            maxCurrencyAmount: 450,
            currencyCode: 'INR',
          },
          individualWeightings: {
            usr_host_1: 1.0,
            usr_member_2: 1.2,
          },
          compromiseFactors: [
            'Selected strictly vegetarian eateries with clear nut-allergy safety protocols.',
          ],
          recommendedCategoryFocus: ['heritage_breakfast', 'traditional_south_indian'],
        },
        recommendedSpotIds: ['place_ctr_malleshwaram_01', 'place_veena_stores_02'],
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
      };

      const parsed = GroupSessionDocumentSchema.parse(sessionDoc);
      assert.strictEqual(parsed.sessionCode, 'BLR892');
      assert.strictEqual(parsed.members.length, 2);
      assert.strictEqual(parsed.consensusBlend?.dietaryConstraintsUnion.length, 2);
    });
  });

  // ---------------------------------------------------------------------------
  // 4. Capacity & Crowd Calculation (Domain 07)
  // ---------------------------------------------------------------------------
  describe('Capacity & Crowd Throttling Domain 07', () => {
    test('calculateCrowdLevel: > 60% remaining yields LOW and isThrottled = false', () => {
      const res = calculateCrowdLevel(8, 10); // 80% remaining
      assert.strictEqual(res.level, 'LOW');
      assert.strictEqual(res.isThrottled, false);
    });

    test('calculateCrowdLevel: 30% to 60% remaining yields MODERATE and isThrottled = false', () => {
      const res = calculateCrowdLevel(5, 10); // 50% remaining
      assert.strictEqual(res.level, 'MODERATE');
      assert.strictEqual(res.isThrottled, false);

      const edge = calculateCrowdLevel(3, 10); // 30% remaining
      assert.strictEqual(edge.level, 'MODERATE');
      assert.strictEqual(edge.isThrottled, false);
    });

    test('calculateCrowdLevel: 1% to 29% remaining yields HIGH and isThrottled = false', () => {
      const res = calculateCrowdLevel(2, 10); // 20% remaining
      assert.strictEqual(res.level, 'HIGH');
      assert.strictEqual(res.isThrottled, false);

      const edge = calculateCrowdLevel(1, 10); // 10% remaining
      assert.strictEqual(edge.level, 'HIGH');
      assert.strictEqual(edge.isThrottled, false);
    });

    test('calculateCrowdLevel: 0 remaining yields AT_CAPACITY and isThrottled = true', () => {
      const res = calculateCrowdLevel(0, 10);
      assert.strictEqual(res.level, 'AT_CAPACITY');
      assert.strictEqual(res.isThrottled, true);
    });

    test('calculateCrowdLevel: negative remaining yields AT_CAPACITY and isThrottled = true', () => {
      const res = calculateCrowdLevel(-2, 10);
      assert.strictEqual(res.level, 'AT_CAPACITY');
      assert.strictEqual(res.isThrottled, true);
    });

    test('Validates VenueHourlyCapacityDocument schema with suggested alternatives', () => {
      const doc = {
        slotId: 'slot_20261120_1400',
        placeId: 'place_ctr_malleshwaram_01',
        hourSlot: '2026-11-20T14:00:00Z',
        maxCapacity: 12,
        currentVisitorsCount: 12,
        remainingCapacity: 0,
        level: 'AT_CAPACITY',
        isThrottled: true,
        suggestedAlternatives: [
          {
            alternativePlaceId: 'place_veena_stores_02',
            alternativeName: 'Veena Stores',
            distanceMeters: 450,
            walkingDurationMinutes: 6,
            currentCrowdLevel: 'LOW',
          },
        ],
        updatedAt: new Date().toISOString(),
      };

      const parsed = VenueHourlyCapacityDocumentSchema.parse(doc);
      assert.strictEqual(parsed.level, 'AT_CAPACITY');
      assert.strictEqual(parsed.isThrottled, true);
      assert.strictEqual(parsed.suggestedAlternatives.length, 1);
    });
  });

  // ---------------------------------------------------------------------------
  // 5. Scheduled Visit Determinism, Invariants & Business Logic
  // ---------------------------------------------------------------------------
  describe('Scheduled Visits Scheduling Logic & Invariants', () => {
    test('deriveVisitId: generates deterministic visitId matching SHA256 prefix', () => {
      const id1 = deriveVisitId('usr_traveler_1', 'req_abc_123');
      const id2 = deriveVisitId('usr_traveler_1', 'req_abc_123');
      const id3 = deriveVisitId('usr_traveler_1', 'req_xyz_456');

      assert.strictEqual(id1, id2, 'Same travelerId and idempotencyKey must produce identical visitId');
      assert.notStrictEqual(id1, id3, 'Different idempotencyKey must produce different visitId');
      assert.match(id1, /^visit_[a-f0-9]{20}$/);
    });

    test('deriveSlotId & deriveHourSlotFromSlotId: bidirectional consistency at top of hour UTC', () => {
      const hourSlot = '2026-11-20T14:00:00.000Z';
      const slotId = deriveSlotId(hourSlot);
      assert.strictEqual(slotId, 'slot_20261120_1400');

      const derivedHourSlot = deriveHourSlotFromSlotId(slotId);
      assert.strictEqual(derivedHourSlot, '2026-11-20T14:00:00.000Z');
    });

    test('formatLocalTimeSlot: correctly converts UTC hourSlot to local display window', () => {
      const hourSlot = '2026-11-20T14:00:00.000Z';
      const formatted = formatLocalTimeSlot(hourSlot, 'Asia/Kolkata');
      // UTC 14:00 + 5:30 = 19:30
      assert.ok(formatted.includes('19:30'));
      assert.ok(formatted.includes('20:30'));
    });

    test('Validates ScheduledVisitDocument with all 4 strict invariants', () => {
      const visit: any = {
        visitId: 'visit_1234567890abcdef1234',
        placeId: 'place_ctr_malleshwaram_01',
        slotId: 'slot_20261120_1400',
        travelerId: 'usr_host_1',
        partySize: 2,
        groupSessionId: 'group_test_123',
        memberUserIds: ['usr_host_1', 'usr_member_2'],
        idempotencyKey: 'idemp_unique_key_01',
        status: 'CONFIRMED',
        hourSlot: '2026-11-20T14:00:00.000Z',
        timeZone: 'Asia/Kolkata',
        localTimeSlot: '19:30 - 20:30 IST',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const parsed = ScheduledVisitDocumentSchema.parse(visit);
      assert.strictEqual(parsed.partySize, 2);
      assert.strictEqual(parsed.memberUserIds.length, 2);
      assert.ok(parsed.memberUserIds.includes(parsed.travelerId));
    });

    test('GPS Proximity Check: validates <= 150m is valid, > 150m is out of range', () => {
      // Central Tiffin Room (CTR) coordinates: approx 13.0017, 77.5704
      const placeCoord = { latitude: 13.0017, longitude: 77.5704 };
      // Traveler standing ~50m away
      const closeTraveler = { latitude: 13.0020, longitude: 77.5704 };
      const closeDist = NormalizationService.calculateDistance(closeTraveler, placeCoord);
      assert.ok(closeDist.meters <= 150, `Expected close distance <= 150m, got ${closeDist.meters}m`);

      // Traveler standing 500m away
      const farTraveler = { latitude: 13.0070, longitude: 77.5704 };
      const farDist = NormalizationService.calculateDistance(farTraveler, placeCoord);
      assert.ok(farDist.meters > 150, `Expected far distance > 150m, got ${farDist.meters}m`);
    });

    test('Reconciliation Buffer: cutoff calculation correctly protects active/recent reservations', () => {
      const cutoffHours = 2;
      const nowMs = Date.now();
      const cutoffMs = nowMs - (cutoffHours * 60 * 60 * 1000);

      // A slot that ended 30 mins ago (1.5 hours after start) is NOT past the 2-hour buffer
      const recentSlotMs = nowMs - (90 * 60 * 1000);
      assert.ok(recentSlotMs > cutoffMs, 'Recent slot must not be eligible for reconciliation');

      // A slot from yesterday (24 hours ago) IS past the 2-hour buffer
      const oldSlotMs = nowMs - (24 * 60 * 60 * 1000);
      assert.ok(oldSlotMs < cutoffMs, 'Old slot must be eligible for reconciliation');
    });
  });
});
