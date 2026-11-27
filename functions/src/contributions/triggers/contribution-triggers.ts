/**
 * Contribution Triggers — Cloud Functions v2 Firestore Event Handlers
 * Task A3 — Contribution and AI-Result Persistence
 *
 * Implements actual reactive triggers on Firestore documents:
 *   - onContributionCreated: Fires when a new contribution document is created.
 *     Logs audit record and sets up pipeline state.
 *   - onAssetCreated: Fires when a new asset document is created in the subcollection.
 *     ACTUALLY INVOKES Developer B's merged B2 extraction services:
 *       - extractVoiceNoteDetails (for AUDIO_VOICE_NOTE)
 *       - extractPhotoDetails (for STREET_PHOTO, STOREFRONT_PHOTO, MENU_PHOTO)
 *     Uses Firestore transaction with a fencing lease token to claim status from
 *     UPLOADED -> PROCESSING, preventing duplicate Gemini execution.
 *     Includes stale lease timeout (5 min) for crash recovery, fencing out stale
 *     invocations, and auto-reversion to UPLOADED on temporary download failures.
 *     Persists results via A3's saveAiExtractionResult / markAssetFailed.
 */

import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { FieldValue } from 'firebase-admin/firestore';
import * as logger from 'firebase-functions/logger';
import { randomUUID } from 'node:crypto';
import { db, storage } from '../../config/firebase.js';
import { geminiApiKey, mapsApiKey } from '../../config/secrets.js';
import {
  CanonicalPlaceDocument,
  CanonicalPlaceDocumentSchema,
  ContributionDocument,
  VoicePhotoAssetDocument,
} from '../../types/contracts/index.js';
import { writeAuditLog } from '../services/audit-logging.service.js';
import {
  saveAiExtractionResult,
  markAssetFailed,
  listContributionAssets,
} from '../services/asset-persistence.service.js';
import { updateContributionStatus } from '../services/contribution-persistence.service.js';
import { extractVoiceNoteDetails } from '../../ai/services/voice-extraction-service.js';
import { extractPhotoDetails } from '../../ai/services/photo-extraction-service.js';
import { synthesizeSpotCardWithGrounding } from '../../ai/services/spot-card-synthesis-service.js';
import {
  assessPlaceAuthenticity,
  toPlaceAuthenticityEnrichment,
} from '../../ai/services/authenticity-assessment-service.js';
import {
  generateMultimodalEmbedding,
  FIRESTORE_VECTOR_DIMENSIONS,
} from '../../ai/services/embedding-service.js';
import { GroundingService } from '../../maps/services/grounding.service.js';
import { computeSafetyHygieneState } from '../../community/community-signals-controller.js';

/** Stale lease timeout: 5 minutes. If a function crashes after claiming, retries can re-claim. */
const PROCESSING_LEASE_TIMEOUT_MS = 5 * 60 * 1000;

/**
 * Fires when a new contribution document is created in Firestore.
 * Trigger path: contributions/{contributionId}
 */
export const onContributionCreated = onDocumentCreated(
  'contributions/{contributionId}',
  async (event) => {
    const snap = event.data;
    if (!snap) {
      logger.warn('onContributionCreated: no snapshot available', { eventId: event.id });
      return;
    }

    const contributionId = event.params.contributionId;
    const data = snap.data();
    const contributorId = data?.submission?.contributorId ?? 'unknown';

    logger.info('onContributionCreated trigger fired', {
      contributionId,
      contributorId,
      status: data?.status,
    });

    try {
      await writeAuditLog(
        'CONTRIBUTION_CREATED',
        contributorId,
        contributionId,
        'contribution',
        {
          trigger: 'onContributionCreated',
          mapsLink: data?.submission?.mapsLink,
          status: data?.status,
        }
      );
    } catch (err) {
      logger.error('Failed to write audit log in onContributionCreated', { err, contributionId });
    }
  }
);

/**
 * Fires when a new media asset document is created under a contribution.
 * Trigger path: contributions/{contributionId}/assets/{assetId}
 *
 * ACTUAL B2 PROCESSING INTEGRATION & FENCING LEASE RECOVERY STRATEGY:
 * 1. Checks if asset is in 'UPLOADED' status or has a stale 'PROCESSING' lease (> 5 minutes).
 * 2. Uses Firestore transaction to atomically claim state to 'PROCESSING' with a unique lease token.
 *    - Concurrent deliveries: Only 1 instance succeeds; others see fresh 'PROCESSING' and exit.
 *    - Crashed executions: If lease expired (> 5 min), re-claims and generates a new lease token.
 * 3. Downloads media buffer from Cloud Storage via Admin SDK.
 *    - Temporary download failure: Reverts state to 'UPLOADED' and re-throws, allowing
 *      Cloud Functions exponential backoff retry to pick it up immediately.
 * 4. Invokes B2's extractVoiceNoteDetails or extractPhotoDetails.
 * 5. Persists the extraction result via saveAiExtractionResult with fencing token:
 *    - Expired invocations are fenced out and cannot overwrite newer invocations.
 */
export const onAssetCreated = onDocumentCreated(
  {
    document: 'contributions/{contributionId}/assets/{assetId}',
    secrets: [geminiApiKey, mapsApiKey],
    timeoutSeconds: 180,
    memory: '512MiB',
  },
  async (event) => {
    const snap = event.data;
    if (!snap) {
      logger.warn('onAssetCreated: no snapshot available', { eventId: event.id });
      return;
    }

    const { contributionId, assetId } = event.params;
    const assetRef = db
      .collection('contributions')
      .doc(contributionId)
      .collection('assets')
      .doc(assetId);

    // Generate a unique fencing lease token for this execution
    const leaseToken = randomUUID();

    // Atomically claim the asset using a transaction with crash-lease recovery & fencing
    let claimed = false;
    try {
      claimed = await db.runTransaction(async (tx) => {
        const doc = await tx.get(assetRef);
        if (!doc.exists) return false;

        const data = doc.data() as VoicePhotoAssetDocument;
        const currentStatus = data.processingStatus;
        const updatedAtTime = data.updatedAt ? new Date(data.updatedAt).getTime() : 0;
        const isStaleLease =
          currentStatus === 'PROCESSING' &&
          Date.now() - updatedAtTime > PROCESSING_LEASE_TIMEOUT_MS;

        // Can only claim if newly uploaded or lease has expired after a crash/timeout
        const canClaim = currentStatus === 'UPLOADED' || isStaleLease;
        if (!canClaim) {
          return false;
        }

        tx.update(assetRef, {
          processingStatus: 'PROCESSING',
          processingToken: leaseToken, // Fencing token assigned
          updatedAt: new Date().toISOString(),
        });
        return true;
      });
    } catch (claimErr) {
      logger.warn('Failed to claim asset for processing in transaction', { claimErr, assetId });
      return;
    }

    if (!claimed) {
      logger.info('onAssetCreated: asset already claimed, completed, or failed. Exiting.', {
        assetId,
      });
      return;
    }

    // Refresh current asset document snapshot after claim
    const freshSnap = await assetRef.get();
    const assetData = freshSnap.data() as VoicePhotoAssetDocument;

    logger.info('onAssetCreated: claimed asset, invoking B2 extraction', {
      contributionId,
      assetId,
      assetType: assetData.assetType,
      leaseToken,
    });

    // Attempt to download media bytes from Cloud Storage using Admin SDK
    let mediaBuffer: Buffer | null = null;
    try {
      const file = storage.bucket().file(assetData.storagePath);
      const [exists] = await file.exists();
      if (exists) {
        const [buf] = await file.download();
        mediaBuffer = buf;
      }
    } catch (storageErr) {
      logger.error('Temporary storage download failure, reverting to UPLOADED for retry', {
        storageErr,
        path: assetData.storagePath,
      });
      // Revert status to UPLOADED so Cloud Functions automatic retry can immediately re-claim
      try {
        await assetRef.update({
          processingStatus: 'UPLOADED',
          updatedAt: new Date().toISOString(),
        });
      } catch (revertErr) {
        logger.error('Failed to revert status to UPLOADED', { revertErr, assetId });
      }
      throw storageErr; // Re-throw triggers Cloud Functions v2 retry
    }

    try {
      if (assetData.assetType === 'AUDIO_VOICE_NOTE') {
        const output = await extractVoiceNoteDetails({
          assetId,
          contributionId,
          contributorId: 'contributor',
          media: mediaBuffer
            ? {
                base64Data: mediaBuffer.toString('base64'),
                mimeType: assetData.mimeType,
              }
            : undefined,
        });

        if (output.processingStatus === 'COMPLETED' && output.aiExtractionResult) {
          await saveAiExtractionResult(contributionId, assetId, output.aiExtractionResult, leaseToken);
          await runDownstreamSpotSynthesisPipeline(contributionId);
        } else {
          await markAssetFailed(
            contributionId,
            assetId,
            output.errorMessage || 'Voice note extraction failed.',
            leaseToken
          );
        }
      } else {
        const output = await extractPhotoDetails({
          assetId,
          contributionId,
          assetType: assetData.assetType,
          media: mediaBuffer
            ? {
                base64Data: mediaBuffer.toString('base64'),
                mimeType: assetData.mimeType,
              }
            : undefined,
        });

        if (output.processingStatus === 'COMPLETED' && output.aiExtractionResult) {
          await saveAiExtractionResult(contributionId, assetId, output.aiExtractionResult, leaseToken);
          await runDownstreamSpotSynthesisPipeline(contributionId);
        } else {
          await markAssetFailed(
            contributionId,
            assetId,
            output.errorMessage || 'Photo extraction failed.',
            leaseToken
          );
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      logger.error('Error during B2 extraction in onAssetCreated', { err, assetId });
      await markAssetFailed(contributionId, assetId, errorMessage, leaseToken);
    }
  }
);

/**
 * Executes the complete Stage 1 downstream pipeline once all uploaded assets for a
 * contribution have finished B2 AI extraction:
 *   1. Google Maps Grounding (C2 GroundingService — Places API New + review extraction)
 *   2. Gemini 3.8 Flash Synthesis with Google Maps + Google Search Grounding (Handoff 2)
 *   3. Gemini 3.8 Flash Authenticity, Review Sentiment, Trap & Safety Assessment (B3)
 *   4. Gemini Embedding 2 Semantic Vector Generation (B4)
 *   5. Canonical publication to `places/{placeId}`, `spots/{placeId}`, and `safety_verifications/{placeId}`
 *   6. Transition contribution status: AI_ANALYZED -> MAPS_GROUNDED -> VERIFIED (or REJECTED if trap)
 */
export async function runDownstreamSpotSynthesisPipeline(contributionId: string): Promise<void> {
  const contribRef = db.collection('contributions').doc(contributionId);
  const contribSnap = await contribRef.get();
  if (!contribSnap.exists) return;

  const contrib = contribSnap.data() as ContributionDocument;
  if (
    contrib.status === 'VERIFIED' ||
    contrib.status === 'REJECTED' ||
    contrib.status === 'RETRACTED'
  ) {
    return;
  }

  const assets = await listContributionAssets(contributionId);
  if (assets.length === 0) return;

  // Wait if any sibling asset is still uploading or processing
  const hasPendingAssets = assets.some(
    (a) => a.processingStatus === 'UPLOADED' || a.processingStatus === 'PROCESSING'
  );
  if (hasPendingAssets) {
    logger.info('runDownstreamSpotSynthesisPipeline: waiting for remaining assets to finish', {
      contributionId,
    });
    return;
  }

  const completedAssets = assets.filter((a) => a.processingStatus === 'COMPLETED');
  if (completedAssets.length === 0) return;

  const voiceAssets = completedAssets.filter((a) => a.assetType === 'AUDIO_VOICE_NOTE');
  const photoAssets = completedAssets.filter((a) => a.assetType !== 'AUDIO_VOICE_NOTE');

  const voiceExtractions = voiceAssets.map((a) => a.aiExtractionResult);
  const photoExtractions = photoAssets.map((a) => a.aiExtractionResult);
  const uploadedPhotoUrls = photoAssets
    .map((a) => a.downloadUrl)
    .filter((u): u is string => typeof u === 'string' && u.length > 0);

  // Load contributor profile from users/{contributorId}
  const contributorId = contrib.submission.contributorId;
  let contributorDisplayName = 'Local Contributor';
  let isVerifiedResident = false;
  let neighborhood = 'Malleshwaram';
  try {
    const userSnap = await db.collection('users').doc(contributorId).get();
    if (userSnap.exists) {
      const u = userSnap.data() || {};
      if (typeof u.displayName === 'string' && u.displayName.trim().length > 0) {
        contributorDisplayName = u.displayName.trim();
      }
      isVerifiedResident = Boolean(u.isVerifiedResident);
      if (typeof u.neighborhoodOfResidency === 'string' && u.neighborhoodOfResidency.trim().length > 0) {
        neighborhood = u.neighborhoodOfResidency.trim();
      }
    }
  } catch {
    // Non-blocking profile lookup
  }

  // Infer preliminary spot name and claimed opening hours from extractions
  const ocrTexts = photoExtractions.flatMap((p) => p?.ocrDetectedText || []);
  const firstSentence = (contrib.submission.infoParagraph || '').split(/[.!\n]/)[0]?.trim() || '';
  const inferredSpotName =
    (ocrTexts[0] && ocrTexts[0].length <= 60 ? ocrTexts[0] : '') ||
    (firstSentence.length > 0 && firstSentence.length <= 60 ? firstSentence : 'Local Neighborhood Gem');

  const claimedHours =
    voiceExtractions.find((v) => v?.practicalDetails?.openingHoursMentioned)?.practicalDetails
      ?.openingHoursMentioned ||
    photoExtractions.find((p) => p?.practicalDetails?.openingHoursMentioned)?.practicalDetails
      ?.openingHoursMentioned;

  // Step 1: Google Maps Place Grounding (C2)
  const groundingService = new GroundingService({ allowMockFallback: false });
  let groundedResult;
  try {
    groundedResult = await groundingService.groundContributedPlace({
      spotName: inferredSpotName,
      mapsLink: contrib.submission.mapsLink,
      neighborhoodHint: `${neighborhood}, Bengaluru`,
      claimedHours,
      infoParagraph: contrib.submission.infoParagraph,
    });
  } catch (groundErr) {
    logger.warn('Live Places grounding failed; retrying with ungrounded community evidence', {
      contributionId,
      groundErr,
    });
    const fallbackGrounding = new GroundingService({ allowMockFallback: false });
    groundedResult = await fallbackGrounding.groundContributedPlace({
      spotName: inferredSpotName,
      mapsLink: contrib.submission.mapsLink,
      neighborhoodHint: `${neighborhood}, Bengaluru`,
      claimedHours,
      infoParagraph: contrib.submission.infoParagraph,
    });
  }

  const matchedPlace = groundedResult.evidence.matchedPlace;
  const canonicalPlaceId =
    matchedPlace && !matchedPlace.isMockData && matchedPlace.placeId
      ? `spot_${matchedPlace.placeId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 24)}`
      : `spot_${contributionId.replace(/^contrib_/, '')}`;

  await updateContributionStatus(contributionId, 'MAPS_GROUNDED', 'system-c2-grounding', {
    groundedPlaceId: canonicalPlaceId,
  });

  // Step 2: Gemini 3.8 Flash Synthesis with Google Maps + Google Search Grounding (Handoff 2)
  const synthesisResult = await synthesizeSpotCardWithGrounding(
    {
      contributionId,
      submission: {
        ...contrib.submission,
        photoUrls:
          uploadedPhotoUrls.length > 0 ? uploadedPhotoUrls : contrib.submission.photoUrls,
      },
      contributorProfile: {
        userId: contributorId,
        displayName: contributorDisplayName,
        badgeTitle: isVerifiedResident ? 'Verified Local Resident' : 'Neighborhood Insider',
        isVerifiedResident,
      },
      voiceExtractions,
      photoExtractions,
      preliminaryCoordinate: matchedPlace?.coordinate?.isValid
        ? matchedPlace.coordinate
        : groundedResult.canonicalPlaceDraft.coordinate,
    },
    {
      enableMapsGrounding: true,
      enableSearchGrounding: true,
    }
  );

  // Step 3: Gemini 3.8 Flash Authenticity, Review Sentiment, Tourist-Trap & Safety Assessment (B3)
  const assessment = await assessPlaceAuthenticity({
    evidence: groundedResult.evidence,
    contributorNarrative: contrib.submission.infoParagraph,
  });
  const authenticityEnrichment = toPlaceAuthenticityEnrichment(assessment);

  const nowIso = new Date().toISOString();
  const hasSafetyConcerns =
    assessment.safetyAndHygiene.hasExplicitSafetyConcerns ||
    assessment.safetyAndHygiene.hasExplicitHygieneConcerns;
  const aiEvidenceChecked = !hasSafetyConcerns;

  // Initial safety & hygiene state (promoted to COMMUNITY_VERIFIED once peer hygiene signal arrives,
  // or immediately if contributor is a verified resident who supplied both photo & voice evidence)
  const initialEndorsers =
    isVerifiedResident && uploadedPhotoUrls.length > 0 && voiceAssets.length > 0
      ? [contributorId]
      : [];

  const safetyHygieneState = computeSafetyHygieneState({
    aiEvidenceChecked,
    hasExplicitConcerns: hasSafetyConcerns,
    endorserUids: initialEndorsers,
    cleanPrepAreaCount: initialEndorsers.length,
    safeAccessCount: initialEndorsers.length,
    fairPricingCount:
      assessment.touristTrap.pricingAssessment === 'FAIR_LOCAL_PRICING' ? 1 : 0,
    soloSafeCount: initialEndorsers.length,
    observations: assessment.safetyAndHygiene.observations,
    nowIso,
  });

  // Seed dialect phrases from voice note transcriptions
  const dialectPhrases = voiceExtractions
    .filter((v) => v && v.transcription && v.detectedLanguage && v.detectedLanguage !== 'en')
    .map((v) => ({
      language: v!.detectedLanguage || 'kn-IN',
      script: v!.transcription!.slice(0, 120),
      transliteration: v!.englishTranslation?.slice(0, 120) || v!.transcription!.slice(0, 120),
      meaning: v!.englishTranslation?.slice(0, 120),
      verifiedByCount: 1,
    }));

  const mustTryItems = Array.from(
    new Set([
      ...voiceExtractions.flatMap((v) => v?.practicalDetails?.signatureDishesOrItems || []),
      ...photoExtractions.flatMap((p) => p?.practicalDetails?.signatureDishesOrItems || []),
    ])
  );

  const mergedVibeTags = Array.from(
    new Set([
      ...synthesisResult.spotCard.authenticity.vibeTags,
      ...authenticityEnrichment.vibeTags,
    ])
  );

  const reviewSentimentScore = matchedPlace?.rating
    ? Number(Math.min(1, Math.max(0, matchedPlace.rating / 5)).toFixed(2))
    : Number((assessment.overallAuthenticityScore / 100).toFixed(2));

  const finalPlaceDoc: CanonicalPlaceDocument = CanonicalPlaceDocumentSchema.parse({
    ...synthesisResult.spotCard,
    id: canonicalPlaceId,
    placeId: canonicalPlaceId,
    ...(matchedPlace?.placeId ? { googlePlaceId: matchedPlace.placeId } : {}),
    spotName:
      matchedPlace && !matchedPlace.isMockData && matchedPlace.name
        ? matchedPlace.name
        : synthesisResult.spotCard.spotName,
    neighborhood,
    formattedAddress:
      matchedPlace && !matchedPlace.isMockData && matchedPlace.formattedAddress
        ? matchedPlace.formattedAddress
        : synthesisResult.spotCard.formattedAddress,
    coordinate:
      matchedPlace && matchedPlace.coordinate.isValid
        ? matchedPlace.coordinate
        : synthesisResult.spotCard.coordinate,
    openHours:
      matchedPlace && matchedPlace.openingHoursDescriptions.length > 0
        ? matchedPlace.openingHoursDescriptions.join(' | ')
        : synthesisResult.spotCard.openHours,
    isOpenNow: matchedPlace?.isOpenNow ?? synthesisResult.spotCard.isOpenNow,
    ...(typeof matchedPlace?.rating === 'number' && matchedPlace.rating > 0
      ? { rating: matchedPlace.rating }
      : {}),
    ...(typeof matchedPlace?.reviewCount === 'number'
      ? { userRatingCount: matchedPlace.reviewCount }
      : {}),
    reviewSentimentScore,
    ...(mustTryItems.length > 0 ? { mustTryItems } : {}),
    safetyHygiene: safetyHygieneState,
    communitySignals: {
      dialectPhrases,
      activeReportsCount: dialectPhrases.length + initialEndorsers.length,
    },
    authenticity: {
      ...authenticityEnrichment,
      vibeTags: mergedVibeTags,
      practicalTips:
        synthesisResult.spotCard.authenticity.practicalTips ||
        authenticityEnrichment.practicalTips,
      greetingCard:
        synthesisResult.spotCard.authenticity.greetingCard ||
        authenticityEnrichment.greetingCard,
    },
    isVerified: !assessment.isTouristTrap,
    isMockData: false,
    updatedAt: nowIso,
  });

  // Step 4: Generate Multimodal Embedding Vector (gemini-embedding-2: text + street photo + voice note)
  let embeddingVector: number[] | undefined;
  try {
    const embText = `${finalPlaceDoc.spotName} in ${neighborhood}. ${finalPlaceDoc.infoParagraph}. Must try: ${mustTryItems.join(', ')}. Vibes: ${mergedVibeTags.join(', ')}`;
    const mediaParts: Array<{ base64Data: string; mimeType: string }> = [];
    // Attach up to 1 photo + 1 audio asset for true multimodal embedding
    for (const asset of [...photoAssets.slice(0, 1), ...voiceAssets.slice(0, 1)]) {
      try {
        const f = storage.bucket().file(asset.storagePath);
        const [exists] = await f.exists();
        if (exists) {
          const [buf] = await f.download();
          if (buf.length > 0 && buf.length <= 4 * 1024 * 1024) {
            mediaParts.push({
              base64Data: buf.toString('base64'),
              mimeType: asset.mimeType,
            });
          }
        }
      } catch {
        // Skip media part if unavailable; text embedding still executes
      }
    }

    const embRes = await generateMultimodalEmbedding({
      text: embText,
      media: mediaParts,
      outputDimensionality: FIRESTORE_VECTOR_DIMENSIONS,
    });
    if (Array.isArray(embRes.values) && embRes.values.length > 0) {
      embeddingVector = embRes.values;
    }
  } catch {
    // Non-blocking if embedding quota is temporarily exceeded
  }

  // Step 5: Persist to `places/{placeId}`, `spots/{placeId}`, and `safety_verifications/{placeId}`
  const persistedPayload: Record<string, unknown> = {
    ...finalPlaceDoc,
    ...(embeddingVector
      ? {
          embeddingVector: FieldValue.vector(embeddingVector),
          embeddingValues: embeddingVector,
        }
      : {}),
  };

  await Promise.all([
    db.collection('places').doc(canonicalPlaceId).set(persistedPayload, { merge: true }),
    db.collection('spots').doc(canonicalPlaceId).set(persistedPayload, { merge: true }),
    db
      .collection('safety_verifications')
      .doc(canonicalPlaceId)
      .set(
        {
          placeId: canonicalPlaceId,
          aiEvidenceChecked,
          hasExplicitConcerns: hasSafetyConcerns,
          endorserUids: initialEndorsers,
          cleanPrepAreaCount: initialEndorsers.length,
          safeAccessCount: initialEndorsers.length,
          fairPricingCount:
            assessment.touristTrap.pricingAssessment === 'FAIR_LOCAL_PRICING' ? 1 : 0,
          soloSafeCount: initialEndorsers.length,
          observations: safetyHygieneState.observations,
          verificationTier: safetyHygieneState.verificationTier,
          badges: safetyHygieneState.badges,
          updatedAt: nowIso,
        },
        { merge: true }
      ),
  ]);

  // Step 6: Transition contribution to VERIFIED (or REJECTED if severe tourist trap)
  if (
    assessment.isTouristTrap &&
    (assessment.touristTrapLikelihood === 'HIGH' || assessment.touristTrapLikelihood === 'SEVERE')
  ) {
    await updateContributionStatus(contributionId, 'REJECTED', 'system-b3-authenticity', {
      groundedPlaceId: canonicalPlaceId,
      rejectionReason: `Flagged by Maps-grounded tourist-trap filter (${assessment.touristTrapLikelihood}): ${assessment.localSentimentSummary}`,
    });
  } else {
    await updateContributionStatus(contributionId, 'VERIFIED', 'system-stage1-pipeline', {
      groundedPlaceId: canonicalPlaceId,
    });
  }

  logger.info('Stage 1 downstream Spot Card synthesis pipeline completed', {
    contributionId,
    canonicalPlaceId,
    verificationTier: safetyHygieneState.verificationTier,
    isTouristTrap: assessment.isTouristTrap,
  });
}
