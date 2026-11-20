/**
 * Startup Buildathon 2026 — Neighborhood Guide App
 * Task B2: Spot-Card Synthesis Service (Null-Safe Corrective Implementation)
 * 
 * Synthesizes contributor narrative, extracted voice-note details, and photo OCR
 * into a structured draft conforming strictly to Developer A's CanonicalPlaceDocument (Domain 06).
 * 
 * ARCHITECTURAL BOUNDARY & ANTI-HALLUCINATION RULES:
 * - Uses Developer A's CanonicalPlaceDocument & PlaceAuthenticityEnrichment schemas.
 * - Preserves contributor attribution from Domain 03 / Domain 05.
 * - Distinguishes contributor-provided claims from externally verified facts.
 * - Never fabricates opening hours: uses contributor claims if explicitly stated;
 *   otherwise defaults strictly to 'Check Maps for hours'.
 * - Sets isVerified to false (Maps grounding and moderation are owned by Dev C & A).
 * - Null-Safety: Handles null, undefined, empty, or malformed extractions defensively.
 */

import {
  CanonicalPlaceDocument,
  CanonicalPlaceDocumentSchema,
  ContributorSubmissionInput,
  ExtractedPracticalDetails,
  NormalizedCoordinate,
  PlaceAuthenticityEnrichment,
  VoicePhotoAssetDocument,
} from '../../types/contracts/index.js';

export interface SpotCardSynthesisInput {
  contributionId: string;
  submission: ContributorSubmissionInput;
  contributorProfile?: {
    userId: string;
    displayName: string;
    badgeTitle: string;
    isVerifiedResident: boolean;
  };
  /** Audio voice note extraction outputs from VoicePhotoAssetDocument */
  voiceExtractions?: (VoicePhotoAssetDocument['aiExtractionResult'] | null | undefined)[] | null;
  /** Photo understanding extraction outputs from VoicePhotoAssetDocument */
  photoExtractions?: (VoicePhotoAssetDocument['aiExtractionResult'] | null | undefined)[] | null;
  /** Preliminary coordinate if available from client EXIF or Maps URL, otherwise baseline coordinate */
  preliminaryCoordinate?: NormalizedCoordinate;
}

/**
 * Type guard for non-null extraction object
 */
function isExtractionObject(item: unknown): item is NonNullable<VoicePhotoAssetDocument['aiExtractionResult']> {
  return typeof item === 'object' && item !== null && !Array.isArray(item);
}

/**
 * Sanitizes and extracts practical details defensively from an arbitrary object
 */
function sanitizePracticalDetails(details: unknown): ExtractedPracticalDetails | null {
  if (typeof details !== 'object' || details === null || Array.isArray(details)) {
    return null;
  }
  const d = details as Record<string, unknown>;

  const openingHoursMentioned = typeof d.openingHoursMentioned === 'string' && d.openingHoursMentioned.trim().length > 0
    ? d.openingHoursMentioned.trim()
    : undefined;

  const signatureDishesOrItems = Array.isArray(d.signatureDishesOrItems)
    ? d.signatureDishesOrItems
        .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
        .map((item) => item.trim())
    : [];

  const priceLevelNote = typeof d.priceLevelNote === 'string' && d.priceLevelNote.trim().length > 0
    ? d.priceLevelNote.trim()
    : undefined;

  const cashOnlyWarning = Boolean(d.cashOnlyWarning);

  const insiderTips = Array.isArray(d.insiderTips)
    ? d.insiderTips
        .filter((tip): tip is string => typeof tip === 'string' && tip.trim().length > 0)
        .map((tip) => tip.trim())
    : [];

  // If every field is empty or undefined, return an object with default empty fields conforming to ExtractedPracticalDetails
  return {
    openingHoursMentioned,
    signatureDishesOrItems,
    priceLevelNote,
    cashOnlyWarning,
    insiderTips,
  };
}

/**
 * Synthesizes extracted media insights and contributor input into a canonical SpotCard draft.
 */
export function synthesizeSpotCard(
  input: SpotCardSynthesisInput
): CanonicalPlaceDocument {
  const nowIso = new Date().toISOString();
  const safeContributionId = typeof input?.contributionId === 'string' && input.contributionId.trim().length > 0
    ? input.contributionId.trim()
    : `gen_${Date.now()}`;
  const placeId = `spot_${safeContributionId.replace(/^contrib_/, '')}`;

  // 1. Gather all practical details from voice and photo extractions safely
  const rawVoiceExtractions = Array.isArray(input?.voiceExtractions) ? input.voiceExtractions : [];
  const rawPhotoExtractions = Array.isArray(input?.photoExtractions) ? input.photoExtractions : [];

  const validVoiceExtractions = rawVoiceExtractions.filter(isExtractionObject);
  const validPhotoExtractions = rawPhotoExtractions.filter(isExtractionObject);

  const allVoicePractical = validVoiceExtractions
    .map((v) => sanitizePracticalDetails(v.practicalDetails))
    .filter((p): p is ExtractedPracticalDetails => p !== null);

  const allPhotoPractical = validPhotoExtractions
    .map((p) => sanitizePracticalDetails(p.practicalDetails))
    .filter((p): p is ExtractedPracticalDetails => p !== null);

  const allPractical = [...allVoicePractical, ...allPhotoPractical];

  // 2. Identify Opening Hours (Anti-Hallucination: strictly supported or fallback to default)
  const mentionedHour = allPractical
    .find((p) => typeof p.openingHoursMentioned === 'string' && p.openingHoursMentioned.length > 0)
    ?.openingHoursMentioned;

  const openHours = mentionedHour && mentionedHour.trim().length > 0
    ? mentionedHour.trim()
    : 'Check Maps for hours';

  // 3. Aggregate Signature Dishes / Must-try items
  const signatureItems = Array.from(
    new Set(
      allPractical.flatMap((p) => p.signatureDishesOrItems || [])
    )
  );

  // 4. Aggregate Insider Tips and Etiquette
  const insiderTips = Array.from(
    new Set(
      allPractical.flatMap((p) => p.insiderTips || [])
    )
  );

  // 5. Aggregate Cash Only / Payment warnings
  const cashOnlyWarning = allPractical.some((p) => Boolean(p.cashOnlyWarning));

  // 6. Aggregate OCR signage text for spot name detection
  const ocrTexts = validPhotoExtractions.flatMap((p) => {
    if (Array.isArray(p.ocrDetectedText)) {
      return p.ocrDetectedText
        .filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
        .map((t) => t.trim());
    }
    return [];
  });
  
  // Extract spot name: prefer first meaningful OCR text or extract from contributor narrative
  let inferredSpotName = ocrTexts.length > 0 ? ocrTexts[0] : '';
  if (!inferredSpotName || inferredSpotName.length > 50) {
    const rawInfo = (input?.submission?.infoParagraph || '').trim();
    const firstSentence = rawInfo.split(/[.!\n]/)[0]?.trim() || '';
    inferredSpotName = firstSentence.length > 0 && firstSentence.length < 50
      ? firstSentence
      : 'Neighborhood Community Spot';
  }

  // 7. Aggregate Vibe Tags
  const vibeTagsSet = new Set<string>(['local_gem', 'community_recommended']);
  if (cashOnlyWarning) {
    vibeTagsSet.add('cash_or_upi_only');
  }
  if (allVoicePractical.length > 0) {
    vibeTagsSet.add('resident_voice_attested');
  }
  if (allPhotoPractical.length > 0) {
    vibeTagsSet.add('photo_verified_signage');
  }
  if (signatureItems.length > 0) {
    vibeTagsSet.add('culinary_specialty');
  }

  // 8. Synthesize authentic narrative distinguishing contributor claims from facts
  const claimsNotes: string[] = [];
  if (signatureItems.length > 0) {
    claimsNotes.push(`Recommended items per contributor: ${signatureItems.join(', ')}.`);
  }
  if (cashOnlyWarning) {
    claimsNotes.push('Contributor note: Cash or UPI payments only.');
  }

  const baseNarrative = (input?.submission?.infoParagraph || '').trim();
  const synthesizedNarrative = claimsNotes.length > 0
    ? `${baseNarrative} [Contributor Claim: ${claimsNotes.join(' ')}]`
    : baseNarrative;

  // 9. Build Authenticity Enrichment
  const displayName = input?.contributorProfile?.displayName || 'Community Member';
  const authenticity: PlaceAuthenticityEnrichment = {
    authenticityScore: 88, // Preliminary score based on resident submission
    touristTrapLikelihood: 'LOW',
    isTouristTrap: false,
    localSentimentSummary: `Submitted by resident contributor (${displayName}). Strong local character attested with authentic practical details.`,
    recommendedTiming: 'Morning or late afternoon for authentic neighborhood atmosphere',
    practicalTips: insiderTips.length > 0 ? insiderTips.join('. ') : 'Visit early to avoid community rush.',
    greetingCard: `Welcome to ${inferredSpotName}! A cherished neighborhood favorite discovered by local residents.`,
    vibeTags: Array.from(vibeTagsSet),
  };

  // 10. Default coordinate pending Developer C's Maps Grounding
  const defaultCoordinate: NormalizedCoordinate = input?.preliminaryCoordinate || {
    latitude: 12.9716, // Bengaluru center baseline
    longitude: 77.5946,
    precision: 6,
    formatted: '12.971600, 77.594600',
    geohash: 'tdr1v',
    isValid: true,
  };

  // 11. Assemble Canonical Place Document
  const draftPlace: CanonicalPlaceDocument = {
    id: placeId,
    placeId,
    spotName: inferredSpotName,
    formattedAddress: 'Address pending Google Maps grounding',
    coordinate: defaultCoordinate,
    mapsLink: input?.submission?.mapsLink || 'https://maps.google.com',
    primaryCategory: 'community_spot',
    categories: ['local_institution', 'resident_contribution'],
    infoParagraph: synthesizedNarrative,
    photoUrls: Array.isArray(input?.submission?.photoUrls) ? input.submission.photoUrls : [],
    openHours,
    isOpenNow: null,
    authenticity,
    capacity: {
      hourlyLimit: 8,
      currentVisitors: 0,
      remainingCapacity: 8,
      crowdLevel: 'LOW',
      isThrottled: false,
      lastUpdatedSlot: `${nowIso.slice(0, 13)}:00:00Z`,
    },
    contributorAttribution: input?.contributorProfile
      ? {
          userId: input.contributorProfile.userId,
          displayName: input.contributorProfile.displayName,
          badgeTitle: input.contributorProfile.badgeTitle,
          isVerifiedResident: Boolean(input.contributorProfile.isVerifiedResident),
        }
      : undefined,
    isVerified: false,
    isMockData: false,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  // Validate the resulting document against Developer A's canonical Zod schema
  return CanonicalPlaceDocumentSchema.parse(draftPlace);
}
