import { test, describe } from 'node:test';
import * as assert from 'node:assert';
import * as fs from 'node:fs';
import * as path from 'node:path';

import {
  ContributorSubmissionInputSchema,
  ContributionStatusSchema,
  AssetTypeSchema,
  ProcessingStatusSchema,
  validateContribution,
  validateVoicePhotoAsset,
  validateApiSuccessEnvelope,
  validateApiErrorEnvelope,
} from '../src/types/contracts/index.js';

import {
  submitContribution,
  getContributionStatus,
  listMyContributions,
  recordAssetUpload,
  saveAiResult,
  markAssetAsFailed,
  onContributionCreated,
  onAssetCreated,
  createContribution,
  getContribution,
  listUserContributions,
  updateContributionStatus,
  persistAssetUpload,
  saveAiExtractionResult,
  markAssetFailed,
} from '../src/contributions/index.js';

describe('Task A3 — Contribution Backend & AI-Result Persistence', () => {
  // ---------------------------------------------------------------------------
  // 1. Export Verification
  // ---------------------------------------------------------------------------
  describe('Cloud Function Exports & In-Process Services', () => {
    test('All 6 Contribution Cloud Functions are exported properly', () => {
      assert.strictEqual(typeof submitContribution, 'function');
      assert.strictEqual(typeof getContributionStatus, 'function');
      assert.strictEqual(typeof listMyContributions, 'function');
      assert.strictEqual(typeof recordAssetUpload, 'function');
      assert.strictEqual(typeof saveAiResult, 'function');
      assert.strictEqual(typeof markAssetAsFailed, 'function');
    });

    test('Both reactive Firestore triggers are exported properly', () => {
      assert.strictEqual(typeof onContributionCreated, 'function');
      assert.strictEqual(typeof onAssetCreated, 'function');
    });

    test('All in-process persistence services for B2 are exported properly', () => {
      assert.strictEqual(typeof createContribution, 'function');
      assert.strictEqual(typeof getContribution, 'function');
      assert.strictEqual(typeof listUserContributions, 'function');
      assert.strictEqual(typeof updateContributionStatus, 'function');
      assert.strictEqual(typeof persistAssetUpload, 'function');
      assert.strictEqual(typeof saveAiExtractionResult, 'function');
      assert.strictEqual(typeof markAssetFailed, 'function');
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Schema & Validation Constraints
  // ---------------------------------------------------------------------------
  describe('Contribution Submission Schema & Validation', () => {
    test('Valid submission input passes validation', () => {
      const validPayload = {
        mapsLink: 'https://maps.google.com/?cid=123456789',
        infoParagraph: 'Authentic local spot with traditional filter coffee.',
        photoUrls: ['https://storage.googleapis.com/test-bucket/photo1.jpg'],
        audioNoteUrl: 'https://storage.googleapis.com/test-bucket/audio.m4a',
        contributorId: 'usr_test_contributor_123',
      };

      const parsed = ContributorSubmissionInputSchema.parse(validPayload);
      assert.strictEqual(parsed.contributorId, 'usr_test_contributor_123');
      assert.strictEqual(parsed.photoUrls.length, 1);
      assert.strictEqual(parsed.audioNoteUrl, validPayload.audioNoteUrl);
    });

    test('Submission input rejects missing mapsLink', () => {
      const invalid = {
        mapsLink: '',
        infoParagraph: 'Great food',
        contributorId: 'usr_123',
      };
      assert.throws(() => ContributorSubmissionInputSchema.parse(invalid));
    });

    test('Submission input rejects missing contributorId', () => {
      const invalid = {
        mapsLink: 'https://maps.google.com',
        infoParagraph: 'Great food',
      };
      assert.throws(() => ContributorSubmissionInputSchema.parse(invalid));
    });

    test('ContributionDocument initializes with SUBMITTED status and timestamps', () => {
      const now = new Date().toISOString();
      const doc = {
        contributionId: 'contrib_abc12345',
        submission: {
          mapsLink: 'https://maps.google.com/?cid=987',
          infoParagraph: 'Historic bakery known for fresh buns.',
          photoUrls: [],
          contributorId: 'usr_contributor_99',
        },
        status: 'SUBMITTED',
        groundedPlaceId: null,
        createdAt: now,
        updatedAt: now,
      };

      const validated = validateContribution(doc);
      assert.strictEqual(validated.status, 'SUBMITTED');
      assert.strictEqual(validated.groundedPlaceId, null);
      assert.strictEqual(validated.contributionId, 'contrib_abc12345');
    });

    test('ContributionStatus accepts canonical progression and rejects invalid values', () => {
      const validStatuses = ['SUBMITTED', 'AI_ANALYZED', 'MAPS_GROUNDED', 'VERIFIED', 'REJECTED'];
      for (const st of validStatuses) {
        assert.strictEqual(ContributionStatusSchema.parse(st), st);
      }

      assert.throws(() => ContributionStatusSchema.parse('PENDING'));
      assert.throws(() => ContributionStatusSchema.parse('APPROVED'));
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Asset & AI Extraction Validation
  // ---------------------------------------------------------------------------
  describe('Asset Document & AI Extraction Schema', () => {
    test('Valid VoicePhotoAsset parses correctly with null initial extraction result', () => {
      const asset = {
        assetId: 'asset_test_audio_01',
        contributionId: 'contrib_abc12345',
        assetType: 'AUDIO_VOICE_NOTE',
        storagePath: 'contributions/contrib_abc12345/audio/asset_test_audio_01.m4a',
        downloadUrl: 'https://storage.googleapis.com/test-bucket/asset.m4a',
        mimeType: 'audio/x-m4a',
        fileSizeBytes: 2048576,
        processingStatus: 'UPLOADED',
        aiExtractionResult: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const validated = validateVoicePhotoAsset(asset);
      assert.strictEqual(validated.assetType, 'AUDIO_VOICE_NOTE');
      assert.strictEqual(validated.processingStatus, 'UPLOADED');
      assert.strictEqual(validated.aiExtractionResult, null);
    });

    test('Validates asset with full AI extraction result', () => {
      const asset = {
        assetId: 'asset_test_photo_01',
        contributionId: 'contrib_abc12345',
        assetType: 'STOREFRONT_PHOTO',
        storagePath: 'contributions/contrib_abc12345/photos/asset_test_photo_01.jpg',
        downloadUrl: 'https://storage.googleapis.com/test-bucket/asset.jpg',
        mimeType: 'image/jpeg',
        fileSizeBytes: 1048576,
        processingStatus: 'COMPLETED',
        aiExtractionResult: {
          detectedLanguage: 'en',
          transcription: 'Best dosa in Malleshwaram since 1950',
          englishTranslation: 'Best dosa in Malleshwaram since 1950',
          practicalDetails: {
            openingHoursMentioned: '7am to 12:30pm, 4pm to 8:30pm',
            signatureDishesOrItems: ['Benne Masala Dosa', 'Filter Coffee'],
            cashOnlyWarning: true,
            insiderTips: ['Go before 8am on weekends to beat the rush'],
          },
          ocrDetectedText: ['Shri Sagar', 'CTR'],
          confidenceScore: 0.95,
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const validated = validateVoicePhotoAsset(asset);
      assert.strictEqual(validated.processingStatus, 'COMPLETED');
      assert.strictEqual(validated.aiExtractionResult?.confidenceScore, 0.95);
      assert.strictEqual(validated.aiExtractionResult?.practicalDetails?.cashOnlyWarning, true);
    });

    test('Validates asset with partial AI extraction result (low confidence / partial)', () => {
      const asset = {
        assetId: 'asset_test_photo_02',
        contributionId: 'contrib_abc12345',
        assetType: 'STREET_PHOTO',
        storagePath: 'contributions/contrib_abc12345/photos/asset_test_photo_02.jpg',
        downloadUrl: 'https://storage.googleapis.com/test-bucket/asset2.jpg',
        mimeType: 'image/jpeg',
        fileSizeBytes: 524288,
        processingStatus: 'COMPLETED',
        aiExtractionResult: {
          detectedLanguage: 'en',
          ocrDetectedText: ['Bakery'],
          confidenceScore: 0.45,
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const validated = validateVoicePhotoAsset(asset);
      assert.strictEqual(validated.processingStatus, 'COMPLETED');
      assert.strictEqual(validated.aiExtractionResult?.confidenceScore, 0.45);
      assert.strictEqual(validated.aiExtractionResult?.transcription, undefined);
    });

    test('AssetTypeSchema rejects invalid asset types', () => {
      assert.throws(() => AssetTypeSchema.parse('VIDEO_CLIP'));
      assert.throws(() => AssetTypeSchema.parse('PDF_DOCUMENT'));
    });

    test('ProcessingStatusSchema accepts standard statuses and rejects invalid ones', () => {
      for (const s of ['UPLOADED', 'PROCESSING', 'COMPLETED', 'FAILED']) {
        assert.strictEqual(ProcessingStatusSchema.parse(s), s);
      }
      assert.throws(() => ProcessingStatusSchema.parse('IN_PROGRESS'));
    });
  });

  // ---------------------------------------------------------------------------
  // 4. API Envelopes
  // ---------------------------------------------------------------------------
  describe('API Envelopes for Contribution Endpoints', () => {
    test('Validates ApiSuccessResponse for contribution stub creation', () => {
      const response = {
        success: true,
        data: {
          contributionId: 'contrib_123',
          status: 'SUBMITTED',
        },
        metadata: {
          requestId: 'req_test_01',
          timestamp: new Date().toISOString(),
          executionDurationMs: 42,
          version: 'A3',
        },
      };

      const validated = validateApiSuccessEnvelope(response);
      assert.strictEqual(validated.success, true);
      assert.strictEqual(validated.metadata.requestId, 'req_test_01');
    });

    test('Validates ApiErrorResponse for permission denied or validation error', () => {
      const errorResponse = {
        success: false,
        error: {
          code: 'PERMISSION_DENIED',
          category: 'PERMISSION_DENIED',
          message: 'Permission denied: not the contributor or a moderator.',
          retryable: false,
        },
        metadata: {
          requestId: 'req_err_01',
          timestamp: new Date().toISOString(),
        },
      };

      const validated = validateApiErrorEnvelope(errorResponse);
      assert.strictEqual(validated.success, false);
      assert.strictEqual(validated.error.category, 'PERMISSION_DENIED');
      assert.strictEqual(validated.error.retryable, false);
    });
  });

  // ---------------------------------------------------------------------------
  // 5. Security Rules Static Analysis (AST / Pattern Verification)
  // Note: Emulator-based rules execution (@firebase/rules-unit-testing) is not
  // configured in the repo; these tests perform static structural validation.
  // ---------------------------------------------------------------------------
  describe('Security Rules Verification (Static Analysis)', () => {
    const firestoreRulesPath = path.resolve(__dirname, '../../../firestore.rules');
    const storageRulesPath = path.resolve(__dirname, '../../../storage.rules');

    test('firestore.rules disallows direct client creation and enforces backend submitContribution', () => {
      const rules = fs.readFileSync(firestoreRulesPath, 'utf-8');

      // Check helper functions
      assert.ok(rules.includes('function isAuthenticated()'), 'Must check authentication');
      assert.ok(rules.includes('function isOwner('), 'Must define isOwner check');
      assert.ok(rules.includes('function isModerator()'), 'Must define isModerator check');
      assert.ok(rules.includes('function isContributionOwner('), 'Must check contribution ownership');

      // Check contributions collection rules: direct client create MUST be disallowed
      assert.ok(rules.includes('match /contributions/{contributionId}'), 'Must match contributions collection');
      assert.ok(
        rules.includes('allow create: if false;'),
        'Direct Firestore creation must be disabled to require submitContribution callable'
      );
      assert.ok(
        rules.includes('allow update: if false;'),
        'Clients must never be able to update contribution documents directly'
      );
      assert.ok(
        rules.includes('allow delete: if false;'),
        'Clients must never be able to delete contribution documents'
      );

      // Check assets subcollection rules
      assert.ok(rules.includes('match /assets/{assetId}'), 'Must match assets subcollection');
      assert.ok(
        rules.includes('allow create, update, delete: if false;'),
        'Client writes to assets subcollection must be disallowed'
      );

      // Check audit_logs collection rules
      assert.ok(rules.includes('match /audit_logs/{logId}'), 'Must match audit_logs');
      assert.ok(
        rules.includes('allow read, write: if false;'),
        'audit_logs must be completely disallowed for clients'
      );
    });

    test('storage.rules enforces cross-read submission.contributorId, media types, MIME types, and immutability', () => {
      const rules = fs.readFileSync(storageRulesPath, 'utf-8');

      // Cross-read on actual A2 field submission.contributorId
      assert.ok(
        rules.includes('.data.submission.contributorId == request.auth.uid'),
        'Must cross-read actual A2 field submission.contributorId'
      );
      assert.ok(
        rules.includes('firestore.get('),
        'Must use firestore.get to read contribution owner'
      );

      // Media category restriction
      assert.ok(
        rules.includes("mediaType in ['photos', 'audio']"),
        'Must restrict media folders to photos and audio'
      );

      // MIME types and size limits
      assert.ok(
        rules.includes('isAllowedMimeForType(mediaType)'),
        'Must restrict MIME types per media category'
      );
      assert.ok(
        rules.includes('isWithinSizeLimit(mediaType)'),
        'Must enforce file size limits per media category'
      );
      assert.ok(rules.includes('10 * 1024 * 1024'), 'Must enforce 10MB photo size limit');
      assert.ok(rules.includes('25 * 1024 * 1024'), 'Must enforce 25MB audio size limit');

      // Immutability & Anti-deletion
      assert.ok(
        rules.includes('allow update: if false;'),
        'Must prohibit overwriting uploaded media assets'
      );
      assert.ok(
        rules.includes('allow delete: if false;'),
        'Must prohibit client-side deletion of media assets'
      );
      assert.ok(rules.includes('match /offline_packs/{packId}'), 'Must support offline packs read');
    });
  });
});
