import { test, describe } from 'node:test';
import * as assert from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';

import {
  validateUserAccount,
  validateTravelerPreferences,
  validateContribution,
  validateVoicePhotoAsset,
  validateContributorProfile,
  validateCanonicalPlace,
  validateVenueHourlyCapacity,
  validateCanonicalRoute,
  validateGroupSession,
  validateOfflinePackManifest,
  validateContributorTip,
  validateRoutePass,
  validateApiSuccessEnvelope,
  validateApiErrorEnvelope,
  NormalizedCoordinateSchema,
  UserAccountDocumentSchema,
  ContributorTipDocumentSchema,
} from '../src/types/contracts/index';

const SAMPLES_DIR = path.resolve(__dirname, '../../../docs/contracts/samples');

function loadSampleJson<T = any>(filename: string): T {
  const filePath = path.join(SAMPLES_DIR, filename);
  const raw = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(raw);
}

describe('Task A2 — Canonical Shared Contracts Validation (All 12 Domains)', () => {
  // Domain 01: Users and Roles
  test('Domain 01: Users and Roles sample validates', () => {
    const sample = loadSampleJson('01-user-role.sample.json');
    const validated = validateUserAccount(sample);
    assert.strictEqual(validated.userId, 'usr_blr_782914');
    assert.strictEqual(validated.role, 'LOCAL_CONTRIBUTOR');
    assert.strictEqual(validated.isAnonymous, false);
  });

  test('Domain 01: Rejects invalid user role', () => {
    const sample = loadSampleJson('01-user-role.sample.json');
    assert.throws(() =>
      UserAccountDocumentSchema.parse({ ...sample, role: 'UNAUTHORIZED_SUPERUSER' })
    );
  });

  // Domain 02: Traveler Preferences
  test('Domain 02: Traveler Preferences sample validates', () => {
    const sample = loadSampleJson('02-traveler-preferences.sample.json');
    const validated = validateTravelerPreferences(sample);
    assert.strictEqual(validated.userId, 'usr_blr_782914');
    assert.strictEqual(validated.budgetTier, 'MODERATE');
    assert.strictEqual(validated.favoriteVibes.includes('heritage'), true);
  });

  // Domain 03: Local Contributions
  test('Domain 03: Local Contributions sample validates', () => {
    const sample = loadSampleJson('03-local-contribution.sample.json');
    const validated = validateContribution(sample);
    assert.strictEqual(validated.contributionId, 'contrib_gem_981273');
    assert.strictEqual(validated.status, 'AI_ANALYZED');
    assert.ok(validated.submission.mapsLink);
  });

  // Domain 04: Voice/Photo Assets & Processing Status
  test('Domain 04: Voice/Photo Assets sample validates', () => {
    const sample = loadSampleJson('04-voice-photo-asset.sample.json');
    const validated = validateVoicePhotoAsset(sample);
    assert.strictEqual(validated.assetId, 'asset_audio_891234');
    assert.strictEqual(validated.assetType, 'AUDIO_VOICE_NOTE');
    assert.strictEqual(validated.processingStatus, 'COMPLETED');
    assert.strictEqual(validated.aiExtractionResult?.detectedLanguage, 'kn-IN');
  });

  // Domain 05: Contributor Attribution & Verification
  test('Domain 05: Contributor Attribution sample validates', () => {
    const sample = loadSampleJson('05-contributor-verification.sample.json');
    const validated = validateContributorProfile(sample);
    assert.strictEqual(validated.userId, 'usr_blr_782914');
    assert.strictEqual(validated.contributorTier, 'HERITAGE_SAGE');
    assert.strictEqual(validated.earnedBadges.length, 2);
  });

  // Domain 06: Structured Places and Spot Cards
  test('Domain 06: Structured Places & Spot Cards sample validates', () => {
    const sample = loadSampleJson('06-place-spot-card.sample.json');
    const validated = validateCanonicalPlace(sample);
    assert.strictEqual(validated.id, 'place_ctr_malleshwaram_01');
    assert.strictEqual(validated.spotName, 'Central Tiffin Room (Shri Sagar)');
    assert.strictEqual(validated.authenticity.authenticityScore, 96);
    assert.strictEqual(validated.capacity.hourlyLimit, 12);
  });

  // Domain 07: Venue Capacity, Schedules and Alternatives
  test('Domain 07: Venue Capacity & Alternatives sample validates', () => {
    const sample = loadSampleJson('07-venue-capacity-alternatives.sample.json');
    const validated = validateVenueHourlyCapacity(sample);
    assert.strictEqual(validated.slotId, 'slot_20261120_1400');
    assert.strictEqual(validated.level, 'AT_CAPACITY');
    assert.strictEqual(validated.isThrottled, true);
    assert.strictEqual(validated.suggestedAlternatives[0].alternativeName, 'Veena Stores');
  });

  // Domain 08: Routes and Route Stops
  test('Domain 08: Routes & Route Stops sample validates', () => {
    const sample = loadSampleJson('08-walking-route.sample.json');
    const validated = validateCanonicalRoute(sample);
    assert.strictEqual(validated.routeId, 'route_malleshwaram_heritage_01');
    assert.strictEqual(validated.totalDistanceMeters, 1150);
    assert.ok(validated.encodedPolyline);
  });

  // Domain 09: Groups and Taste-Matching Results
  test('Domain 09: Groups & Taste-Matching sample validates', () => {
    const sample = loadSampleJson('09-group-taste-matching.sample.json');
    const validated = validateGroupSession(sample);
    assert.strictEqual(validated.sessionId, 'grp_sess_blr_90123');
    assert.strictEqual(validated.sessionCode, 'BLR892');
    assert.strictEqual(validated.status, 'FINALIZED');
    assert.strictEqual(validated.consensusBlend?.dietaryConstraintsUnion.includes('vegetarian'), true);
  });

  // Domain 10: Offline Neighborhood Packs
  test('Domain 10: Offline Neighborhood Packs sample validates and maps to Drift SQLite', () => {
    const sample = loadSampleJson('10-offline-pack-manifest.sample.json');
    const validated = validateOfflinePackManifest(sample);
    assert.strictEqual(validated.packId, 'pack_malleshwaram_v1');
    assert.strictEqual(validated.spots.length, 1);

    const spot = validated.spots[0];
    assert.strictEqual(spot.spotName, 'Central Tiffin Room (Shri Sagar)');

    // Verify stringified JSON fields for Developer D's Drift SQLite LocalSpots table
    const photoUrls = JSON.parse(spot.photoUrlsJson);
    const vibeTags = JSON.parse(spot.vibeTagsJson);
    assert.ok(Array.isArray(photoUrls));
    assert.ok(Array.isArray(vibeTags));
  });

  // Domain 11: Contributor Rewards, Tips & Guidance
  test('Domain 11: Contributor Rewards & Tips sample validates', () => {
    const sample = loadSampleJson('11-contributor-reward-tip.sample.json');
    const validated = validateContributorTip(sample);
    assert.strictEqual(validated.tipId, 'tip_blr_561234');
    assert.strictEqual(validated.amountInr, 100);
    assert.strictEqual(validated.contributorNetInr, 95);
    assert.strictEqual(validated.paymentStatus, 'COMPLETED');
  });

  test('Domain 11: Rejects zero or negative tip amount', () => {
    const sample = loadSampleJson('11-contributor-reward-tip.sample.json');
    assert.throws(() =>
      ContributorTipDocumentSchema.parse({ ...sample, amountInr: -50 })
    );
  });

  // Domain 12: Route Passes, Payments & Subscriptions
  test('Domain 12: Route Passes & Subscriptions sample validates', () => {
    const sample = loadSampleJson('12-route-pass-subscription.sample.json');
    const validated = validateRoutePass(sample);
    assert.strictEqual(validated.passId, 'pass_malleshwaram_781290');
    assert.strictEqual(validated.tier, 'NEIGHBORHOOD_ALL_ACCESS');
    assert.strictEqual(validated.perksIncluded.audioGuidanceUnlocked, true);
  });

  // API Envelopes
  test('API Envelopes: Success and Error envelopes validate', () => {
    const successSample = loadSampleJson('api-success-envelope.sample.json');
    const validatedSuccess = validateApiSuccessEnvelope(successSample);
    assert.strictEqual(validatedSuccess.success, true);
    assert.ok(validatedSuccess.data.spotName);

    const errorSample = loadSampleJson('api-error-envelope.sample.json');
    const validatedError = validateApiErrorEnvelope(errorSample);
    assert.strictEqual(validatedError.success, false);
    assert.strictEqual(validatedError.error.category, 'CAPACITY_EXCEEDED');
    assert.strictEqual(validatedError.error.code, 'CAPACITY_THROTTLED');
  });

  // Spatial Coordinate Validation
  test('Coordinate Validation: Rejects invalid latitude (> 90)', () => {
    assert.throws(() =>
      NormalizedCoordinateSchema.parse({
        latitude: 91.5,
        longitude: 77.57,
        formatted: '91.5, 77.57',
      })
    );
  });
});
