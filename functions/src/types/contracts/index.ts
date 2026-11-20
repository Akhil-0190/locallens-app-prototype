/**
 * ==============================================================================
 * CANONICAL SHARED CONTRACTS & SCHEMAS (Developer A Ownership)
 * Task A2 — Shared Data Models and API Contracts
 * ==============================================================================
 * Authoritative TypeScript interfaces and Zod runtime schemas covering all 12
 * domains and API envelopes.
 * ==============================================================================
 */

import { z } from 'zod';

// ==============================================================================
// 0. Spatial & Coordinate Baseline (Reconciling Developer C)
// ==============================================================================

export const NormalizedCoordinateSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  precision: z.number().default(6),
  formatted: z.string(),
  geohash: z.string().optional(),
  isValid: z.boolean().default(true),
});

export type NormalizedCoordinate = z.infer<typeof NormalizedCoordinateSchema>;

// ==============================================================================
// 1. Users and Roles (Domain 01)
// ==============================================================================

export const UserRoleSchema = z.enum(['TRAVELER', 'LOCAL_CONTRIBUTOR', 'MODERATOR', 'ADMIN']);

export const UserAccountDocumentSchema = z.object({
  userId: z.string().min(1),
  email: z.string().email().nullable().default(null),
  phoneNumber: z.string().nullable().default(null),
  displayName: z.string().min(1),
  photoUrl: z.string().url().nullable().default(null),
  role: UserRoleSchema.default('TRAVELER'),
  isAnonymous: z.boolean().default(false),
  accountStatus: z.enum(['ACTIVE', 'SUSPENDED', 'PENDING_VERIFICATION']).default('ACTIVE'),
  savedSpotIds: z.array(z.string()).default([]),
  savedRouteIds: z.array(z.string()).default([]),
  createdAt: z.string(),
  updatedAt: z.string(),
  lastLoginAt: z.string().optional(),
});

export type UserRole = z.infer<typeof UserRoleSchema>;
export type UserAccountDocument = z.infer<typeof UserAccountDocumentSchema>;

// ==============================================================================
// 2. Traveler Preferences (Domain 02)
// ==============================================================================

export const BudgetTierSchema = z.enum(['BUDGET', 'MODERATE', 'PREMIUM']);

export const TravelerPreferencesDocumentSchema = z.object({
  userId: z.string().min(1),
  favoriteVibes: z.array(z.string()).default([]),
  dietaryRestrictions: z.array(z.string()).default([]),
  budgetTier: BudgetTierSchema.default('MODERATE'),
  maxBudgetPerMealInr: z.number().min(0).default(250),
  preferredPacing: z.enum(['RELAXED', 'BALANCED', 'PACKED']).default('BALANCED'),
  preferredNeighborhoods: z.array(z.string()).default([]),
  accessibilityNeeds: z.array(z.string()).default([]),
  updatedAt: z.string(),
});

export type BudgetTier = z.infer<typeof BudgetTierSchema>;
export type TravelerPreferencesDocument = z.infer<typeof TravelerPreferencesDocumentSchema>;

// ==============================================================================
// 3. Local Contributions (Domain 03)
// ==============================================================================

export const ContributionStatusSchema = z.enum([
  'SUBMITTED',
  'AI_ANALYZED',
  'MAPS_GROUNDED',
  'VERIFIED',
  'REJECTED',
]);

export const ContributorSubmissionInputSchema = z.object({
  mapsLink: z.string().min(1),
  infoParagraph: z.string().min(1),
  photoUrls: z.array(z.string()).default([]),
  audioNoteUrl: z.string().optional(),
  contributorId: z.string().min(1),
});

export const ContributionDocumentSchema = z.object({
  contributionId: z.string().min(1),
  submission: ContributorSubmissionInputSchema,
  status: ContributionStatusSchema.default('SUBMITTED'),
  groundedPlaceId: z.string().nullable().default(null),
  rejectionReason: z.string().optional(),
  moderatedBy: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type ContributionStatus = z.infer<typeof ContributionStatusSchema>;
export type ContributorSubmissionInput = z.infer<typeof ContributorSubmissionInputSchema>;
export type ContributionDocument = z.infer<typeof ContributionDocumentSchema>;

// ==============================================================================
// 4. Voice/Photo Assets & Processing Status (Domain 04)
// ==============================================================================

export const AssetTypeSchema = z.enum([
  'AUDIO_VOICE_NOTE',
  'STREET_PHOTO',
  'MENU_PHOTO',
  'STOREFRONT_PHOTO',
]);

export const ProcessingStatusSchema = z.enum(['UPLOADED', 'PROCESSING', 'COMPLETED', 'FAILED']);

export const ExtractedPracticalDetailsSchema = z.object({
  openingHoursMentioned: z.string().optional(),
  signatureDishesOrItems: z.array(z.string()).default([]),
  priceLevelNote: z.string().optional(),
  cashOnlyWarning: z.boolean().default(false),
  insiderTips: z.array(z.string()).default([]),
});

export const VoicePhotoAssetDocumentSchema = z.object({
  assetId: z.string().min(1),
  contributionId: z.string().min(1),
  assetType: AssetTypeSchema,
  storagePath: z.string().min(1),
  downloadUrl: z.string().url(),
  mimeType: z.string().min(1),
  fileSizeBytes: z.number().min(0),
  processingStatus: ProcessingStatusSchema.default('UPLOADED'),
  aiExtractionResult: z
    .object({
      detectedLanguage: z.string().optional(),
      transcription: z.string().optional(),
      englishTranslation: z.string().optional(),
      practicalDetails: ExtractedPracticalDetailsSchema.optional(),
      ocrDetectedText: z.array(z.string()).optional(),
      confidenceScore: z.number().min(0).max(1).optional(),
    })
    .nullable()
    .default(null),
  errorMessage: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type AssetType = z.infer<typeof AssetTypeSchema>;
export type ProcessingStatus = z.infer<typeof ProcessingStatusSchema>;
export type ExtractedPracticalDetails = z.infer<typeof ExtractedPracticalDetailsSchema>;
export type VoicePhotoAssetDocument = z.infer<typeof VoicePhotoAssetDocumentSchema>;

// ==============================================================================
// 5. Contributor Attribution & Verification (Domain 05)
// ==============================================================================

export const ContributorTierSchema = z.enum([
  'LOCAL_RESIDENT',
  'HERITAGE_SAGE',
  'COMMUNITY_PILLAR',
  'COMMUNITY_SCOUT',
]);

export const EarnedBadgeSchema = z.object({
  badgeId: z.string().min(1),
  title: z.string().min(1),
  description: z.string(),
  awardedAt: z.string(),
});

export const ContributorVerificationProfileSchema = z.object({
  userId: z.string().min(1),
  contributorTier: ContributorTierSchema.default('LOCAL_RESIDENT'),
  reputationPoints: z.number().int().min(0).default(0),
  spotsSubmittedCount: z.number().int().min(0).default(0),
  spotsApprovedCount: z.number().int().min(0).default(0),
  accuracyRate: z.number().min(0).max(1).default(0),
  isVerifiedResident: z.boolean().default(false),
  neighborhoodOfResidency: z.string().default(''),
  earnedBadges: z.array(EarnedBadgeSchema).default([]),
  totalTipsReceivedInr: z.number().min(0).default(0),
});

export type ContributorTier = z.infer<typeof ContributorTierSchema>;
export type EarnedBadge = z.infer<typeof EarnedBadgeSchema>;
export type ContributorVerificationProfile = z.infer<typeof ContributorVerificationProfileSchema>;

// ==============================================================================
// 6. Structured Places and Spot Cards (Domain 06)
// ==============================================================================

export const CrowdLevelSchema = z.enum(['LOW', 'MODERATE', 'HIGH', 'AT_CAPACITY']);
export const TouristTrapRiskSchema = z.enum(['LOW', 'MODERATE', 'HIGH', 'SEVERE']);

export const PlaceAuthenticityEnrichmentSchema = z.object({
  authenticityScore: z.number().min(0).max(100),
  touristTrapLikelihood: TouristTrapRiskSchema,
  isTouristTrap: z.boolean(),
  localSentimentSummary: z.string(),
  recommendedTiming: z.string(),
  practicalTips: z.string().default(''),
  greetingCard: z.string().default(''),
  vibeTags: z.array(z.string()).default([]),
});

export const PlaceCapacityStateSchema = z.object({
  hourlyLimit: z.number().int().min(1).default(6),
  currentVisitors: z.number().int().min(0).default(0),
  remainingCapacity: z.number().int(),
  crowdLevel: CrowdLevelSchema.default('LOW'),
  isThrottled: z.boolean().default(false),
  lastUpdatedSlot: z.string(),
});

export const CanonicalPlaceDocumentSchema = z.object({
  id: z.string().min(1),
  placeId: z.string().min(1),
  spotName: z.string().min(1),
  formattedAddress: z.string(),
  coordinate: NormalizedCoordinateSchema,
  mapsLink: z.string(),
  primaryCategory: z.string(),
  categories: z.array(z.string()).default([]),
  infoParagraph: z.string(),
  photoUrls: z.array(z.string()).default([]),
  openHours: z.string().default('Check Maps for hours'),
  isOpenNow: z.boolean().nullable().default(null),
  authenticity: PlaceAuthenticityEnrichmentSchema,
  capacity: PlaceCapacityStateSchema,
  contributorAttribution: z
    .object({
      userId: z.string(),
      displayName: z.string(),
      badgeTitle: z.string(),
      isVerifiedResident: z.boolean(),
    })
    .optional(),
  isVerified: z.boolean().default(false),
  isMockData: z.boolean().default(false),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type CrowdLevel = z.infer<typeof CrowdLevelSchema>;
export type TouristTrapRisk = z.infer<typeof TouristTrapRiskSchema>;
export type PlaceAuthenticityEnrichment = z.infer<typeof PlaceAuthenticityEnrichmentSchema>;
export type PlaceCapacityState = z.infer<typeof PlaceCapacityStateSchema>;
export type CanonicalPlaceDocument = z.infer<typeof CanonicalPlaceDocumentSchema>;

// ==============================================================================
// 7. Venue Capacity, Schedules and Alternatives (Domain 07)
// ==============================================================================

export const SuggestedAlternativeSchema = z.object({
  alternativePlaceId: z.string().min(1),
  alternativeName: z.string().min(1),
  distanceMeters: z.number().min(0),
  walkingDurationMinutes: z.number().min(0),
  currentCrowdLevel: CrowdLevelSchema,
});

export const VenueHourlyCapacityDocumentSchema = z.object({
  slotId: z.string().min(1),
  placeId: z.string().min(1),
  hourSlot: z.string(),
  maxCapacity: z.number().int().min(1),
  currentVisitorsCount: z.number().int().min(0),
  remainingCapacity: z.number().int(),
  level: CrowdLevelSchema,
  isThrottled: z.boolean().default(false),
  suggestedAlternatives: z.array(SuggestedAlternativeSchema).default([]),
  updatedAt: z.string(),
});

export type SuggestedAlternative = z.infer<typeof SuggestedAlternativeSchema>;
export type VenueHourlyCapacityDocument = z.infer<typeof VenueHourlyCapacityDocumentSchema>;

export const ScheduledVisitStatusSchema = z.enum(['CONFIRMED', 'CANCELLED', 'COMPLETED']);

export const ScheduledVisitDocumentSchema = z
  .object({
    visitId: z.string().regex(/^visit_[a-f0-9]{20}$/),
    placeId: z.string().min(1),
    slotId: z.string().regex(/^slot_\d{8}_\d{2}00$/),
    travelerId: z.string().min(1),
    partySize: z.number().int().min(1),
    groupSessionId: z.string().nullable().optional(),
    memberUserIds: z.array(z.string()).min(1),
    idempotencyKey: z.string().min(1),
    status: ScheduledVisitStatusSchema.default('CONFIRMED'),
    hourSlot: z.string().datetime(),
    timeZone: z.string().min(1),
    localTimeSlot: z.string().min(1),
    completedAt: z.string().datetime().nullable().optional(),
    completedBy: z.enum(['TRAVELER_CHECKIN', 'SYSTEM_EXPIRATION']).nullable().optional(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .refine(
    (data) => data.memberUserIds.length === data.partySize,
    { message: 'memberUserIds.length must equal partySize' }
  )
  .refine(
    (data) => data.memberUserIds.includes(data.travelerId),
    { message: 'travelerId must be included in memberUserIds' }
  )
  .refine(
    (data) => {
      const d = new Date(data.hourSlot);
      if (isNaN(d.getTime())) return false;
      if (d.getUTCMinutes() !== 0 || d.getUTCSeconds() !== 0 || d.getUTCMilliseconds() !== 0) return false;
      const year = d.getUTCFullYear();
      const month = String(d.getUTCMonth() + 1).padStart(2, '0');
      const day = String(d.getUTCDate()).padStart(2, '0');
      const hour = String(d.getUTCHours()).padStart(2, '0');
      const expectedSlotId = `slot_${year}${month}${day}_${hour}00`;
      return data.slotId === expectedSlotId;
    },
    { message: 'slotId must be derived from and match hourSlot (must be top-of-the-hour in UTC)' }
  );

export type ScheduledVisitStatus = z.infer<typeof ScheduledVisitStatusSchema>;
export type ScheduledVisitDocument = z.infer<typeof ScheduledVisitDocumentSchema>;


// ==============================================================================
// 8. Routes and Route Stops (Domain 08)
// ==============================================================================

export const RouteNavigationStepSchema = z.object({
  instruction: z.string(),
  distanceMeters: z.number().min(0),
  durationSeconds: z.number().min(0),
  startCoordinate: NormalizedCoordinateSchema,
  endCoordinate: NormalizedCoordinateSchema,
});

export const RouteLegSchema = z.object({
  startPlaceId: z.string().optional(),
  endPlaceId: z.string().optional(),
  distanceMeters: z.number().min(0),
  durationSeconds: z.number().min(0),
  startCoordinate: NormalizedCoordinateSchema,
  endCoordinate: NormalizedCoordinateSchema,
  steps: z.array(RouteNavigationStepSchema).default([]),
});

export const CanonicalRouteDocumentSchema = z.object({
  routeId: z.string().min(1),
  title: z.string().min(1),
  neighborhood: z.string().min(1),
  theme: z.string().default('Walking Trail'),
  origin: NormalizedCoordinateSchema,
  destination: NormalizedCoordinateSchema,
  waypoints: z.array(NormalizedCoordinateSchema).default([]),
  waypointPlaceIds: z.array(z.string()).default([]),
  optimizedWaypointOrder: z.array(z.number().int()).default([]),
  totalDistanceMeters: z.number().min(0),
  totalDurationSeconds: z.number().min(0),
  formattedDistance: z.string(),
  formattedDuration: z.string(),
  encodedPolyline: z.string(),
  legs: z.array(RouteLegSchema).default([]),
  isMockData: z.boolean().default(false),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type RouteNavigationStep = z.infer<typeof RouteNavigationStepSchema>;
export type RouteLeg = z.infer<typeof RouteLegSchema>;
export type CanonicalRouteDocument = z.infer<typeof CanonicalRouteDocumentSchema>;

// ==============================================================================
// 9. Groups and Taste-Matching Results (Domain 09)
// ==============================================================================

export const MemberPreferenceInputSchema = z.object({
  userId: z.string().min(1),
  displayName: z.string().min(1),
  vibes: z.array(z.string()).default([]),
  dietaryRestrictions: z.array(z.string()).default([]),
  maxBudgetAmount: z.number().min(0),
  weighting: z.number().min(0.1).max(2.0).default(1.0),
});

export const ConsensusBlendOutputSchema = z.object({
  consensusAtmosphere: z.array(z.string()),
  dietaryConstraintsUnion: z.array(z.string()),
  budgetConsensusRange: z.object({
    minCurrencyAmount: z.number().min(0),
    maxCurrencyAmount: z.number().min(0),
    currencyCode: z.string().default('INR'),
  }),
  individualWeightings: z.record(z.string(), z.number()),
  compromiseFactors: z.array(z.string()),
  recommendedCategoryFocus: z.array(z.string()),
});

export const GroupSessionDocumentSchema = z.object({
  sessionId: z.string().min(1),
  hostUserId: z.string().min(1),
  sessionCode: z.string().length(6),
  neighborhood: z.string().min(1),
  status: z.enum(['INVITING', 'BLENDING', 'FINALIZED', 'EXPIRED']),
  members: z.array(MemberPreferenceInputSchema),
  memberUserIds: z.array(z.string()).default([]),
  consensusBlend: ConsensusBlendOutputSchema.nullable().default(null),
  recommendedSpotIds: z.array(z.string()).default([]),
  createdAt: z.string(),
  expiresAt: z.string(),
});


export type MemberPreferenceInput = z.infer<typeof MemberPreferenceInputSchema>;
export type ConsensusBlendOutput = z.infer<typeof ConsensusBlendOutputSchema>;
export type GroupSessionDocument = z.infer<typeof GroupSessionDocumentSchema>;

// ==============================================================================
// 10. Offline Neighborhood Packs (Domain 10)
// ==============================================================================

export const OfflineSpotItemSchema = z.object({
  id: z.string().min(1),
  spotName: z.string().min(1),
  mapsLink: z.string(),
  infoParagraph: z.string(),
  photoUrlsJson: z.string(),
  openHours: z.string().default('Check Maps for hours'),
  practicalTips: z.string().default(''),
  greetingCard: z.string().default(''),
  isTouristTrap: z.boolean().default(false),
  hourlyLimit: z.number().int().default(6),
  currentVisitors: z.number().int().default(0),
  vibeTagsJson: z.string(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

export const OfflinePackManifestDocumentSchema = z.object({
  packId: z.string().min(1),
  neighborhood: z.string().min(1),
  city: z.string().min(1),
  version: z.number().int().min(1),
  totalSpotsCount: z.number().int().min(0),
  totalRoutesCount: z.number().int().min(0),
  downloadSizeBytes: z.number().min(0),
  downloadUrl: z.string().url(),
  sha256Checksum: z.string().length(64),
  spots: z.array(OfflineSpotItemSchema),
  routes: z.array(CanonicalRouteDocumentSchema),
  publishedAt: z.string(),
});

export type OfflineSpotItem = z.infer<typeof OfflineSpotItemSchema>;
export type OfflinePackManifestDocument = z.infer<typeof OfflinePackManifestDocumentSchema>;

// ==============================================================================
// 11. Contributor Rewards, Tips & Guidance (Domain 11)
// ==============================================================================

export const PaymentModeSchema = z.enum(['SANDBOX', 'LIVE']);
export type PaymentMode = z.infer<typeof PaymentModeSchema>;

export const TipPaymentStatusSchema = z.enum(['INITIATED', 'COMPLETED', 'FAILED', 'DISBURSED']);

export const ContributorTipDocumentSchema = z.object({
  tipId: z.string().min(1),
  payerUserId: z.string().min(1),
  recipientUserId: z.string().min(1),
  spotId: z.string().min(1),
  spotName: z.string().min(1),
  amountInr: z.number().positive(),
  platformFeeInr: z.number().min(0),
  contributorNetInr: z.number().positive(),
  currency: z.string().default('INR'),
  paymentMode: PaymentModeSchema.default('SANDBOX'),
  paymentStatus: TipPaymentStatusSchema.default('INITIATED'),
  paymentGatewayReference: z.string().optional(),
  personalNote: z.string().max(500).optional(),
  createdAt: z.string(),
  settledAt: z.string().optional(),
});

export type TipPaymentStatus = z.infer<typeof TipPaymentStatusSchema>;
export type ContributorTipDocument = z.infer<typeof ContributorTipDocumentSchema>;

export const ContributorRewardLedgerSchema = z.object({
  userId: z.string().min(1),
  totalEarningsInr: z.number().min(0).default(0),
  availableBalanceInr: z.number().min(0).default(0),
  withdrawnTotalInr: z.number().min(0).default(0),
  unrecoveredAdjustmentInr: z.number().min(0).default(0),
  payoutUpiId: z.string().optional(),
  reputationPoints: z.number().min(0).default(0),
  guidanceRank: z.string().default('Community Scout'),
  lastPayoutAt: z.string().optional(),
  updatedAt: z.string(),
});

export type ContributorRewardLedger = z.infer<typeof ContributorRewardLedgerSchema>;

// ==============================================================================
// 12. Route Passes, Payments & Subscriptions (Domain 12)
// ==============================================================================

export const PassTierSchema = z.enum([
  'SINGLE_ROUTE',
  'NEIGHBORHOOD_ALL_ACCESS',
  'ANNUAL_EXPLORER',
]);

export const PassStatusSchema = z.enum(['PENDING', 'ACTIVE', 'EXPIRED', 'REVOKED']);

export const RoutePassDocumentSchema = z.object({
  passId: z.string().min(1),
  userId: z.string().min(1),
  tier: PassTierSchema,
  neighborhood: z.string().min(1),
  accessibleRouteIds: z.array(z.string()).default([]),
  pricePaidInr: z.number().min(0),
  currency: z.string().default('INR'),
  paymentMode: PaymentModeSchema.default('SANDBOX'),
  paymentGatewayReference: z.string().optional(),
  status: PassStatusSchema.default('PENDING'),
  perksIncluded: z.object({
    audioGuidanceUnlocked: z.boolean().default(true),
    offlinePackUnlocked: z.boolean().default(true),
    merchantPartnerDiscountPercent: z.number().min(0).max(100).default(0),
  }),
  validFrom: z.string(),
  validUntil: z.string(),
  purchasedAt: z.string(),
});

export type PassTier = z.infer<typeof PassTierSchema>;
export type PassStatus = z.infer<typeof PassStatusSchema>;
export type RoutePassDocument = z.infer<typeof RoutePassDocumentSchema>;

export const MerchantPlanTierSchema = z.enum([
  'COMMUNITY_FREE',
  'VERIFIED_PARTNER',
  'FEATURED_HERITAGE',
]);

export const PartnerMerchantSubscriptionSchema = z.object({
  subscriptionId: z.string().min(1),
  merchantPlaceId: z.string().min(1),
  businessName: z.string().min(1),
  contactEmail: z.string().email(),
  subscriptionPlan: MerchantPlanTierSchema.default('COMMUNITY_FREE'),
  activeDiscountOffer: z.object({
    discountPercent: z.number().min(0).max(100),
    terms: z.string().min(1),
  }).optional(),
  paymentMode: PaymentModeSchema.default('SANDBOX'),
  isActive: z.boolean().default(true),
  expiresAt: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type MerchantPlanTier = z.infer<typeof MerchantPlanTierSchema>;
export type PartnerMerchantSubscription = z.infer<typeof PartnerMerchantSubscriptionSchema>;

// ==============================================================================
// Standard API Envelopes
// ==============================================================================

export const ErrorCategorySchema = z.enum([
  'VALIDATION_ERROR',
  'AUTHENTICATION_REQUIRED',
  'PERMISSION_DENIED',
  'NOT_FOUND',
  'CAPACITY_EXCEEDED',
  'AI_PROCESSING_ERROR',
  'MAPS_QUOTA_ERROR',
  'TRANSIENT_SERVER_ERROR',
]);

export const ApiSuccessResponseSchema = z.object({
  success: z.literal(true),
  data: z.record(z.string(), z.unknown()),
  metadata: z.object({
    requestId: z.string(),
    timestamp: z.string(),
    executionDurationMs: z.number().min(0).optional(),
    version: z.string().optional(),
  }),
});

export const ApiErrorResponseSchema = z.object({
  success: z.literal(false),
  error: z.object({
    code: z.string(),
    category: ErrorCategorySchema,
    message: z.string(),
    details: z.record(z.string(), z.unknown()).optional(),
    retryable: z.boolean(),
  }),
  metadata: z.object({
    requestId: z.string(),
    timestamp: z.string(),
  }),
});

export type ErrorCategory = z.infer<typeof ErrorCategorySchema>;
export type ApiSuccessResponse = z.infer<typeof ApiSuccessResponseSchema>;
export type ApiErrorResponse = z.infer<typeof ApiErrorResponseSchema>;

// ==============================================================================
// Validation Helpers
// ==============================================================================

export function validateUserAccount(data: unknown): UserAccountDocument {
  return UserAccountDocumentSchema.parse(data);
}

export function validateTravelerPreferences(data: unknown): TravelerPreferencesDocument {
  return TravelerPreferencesDocumentSchema.parse(data);
}

export function validateContribution(data: unknown): ContributionDocument {
  return ContributionDocumentSchema.parse(data);
}

export function validateVoicePhotoAsset(data: unknown): VoicePhotoAssetDocument {
  return VoicePhotoAssetDocumentSchema.parse(data);
}

export function validateContributorProfile(data: unknown): ContributorVerificationProfile {
  return ContributorVerificationProfileSchema.parse(data);
}

export function validateCanonicalPlace(data: unknown): CanonicalPlaceDocument {
  return CanonicalPlaceDocumentSchema.parse(data);
}

export function validateVenueHourlyCapacity(data: unknown): VenueHourlyCapacityDocument {
  return VenueHourlyCapacityDocumentSchema.parse(data);
}

export function validateScheduledVisit(data: unknown): ScheduledVisitDocument {
  return ScheduledVisitDocumentSchema.parse(data);
}


export function validateCanonicalRoute(data: unknown): CanonicalRouteDocument {
  return CanonicalRouteDocumentSchema.parse(data);
}

export function validateGroupSession(data: unknown): GroupSessionDocument {
  return GroupSessionDocumentSchema.parse(data);
}

export function validateOfflinePackManifest(data: unknown): OfflinePackManifestDocument {
  return OfflinePackManifestDocumentSchema.parse(data);
}

export function validateContributorTip(data: unknown): ContributorTipDocument {
  return ContributorTipDocumentSchema.parse(data);
}

export function validateContributorRewardLedger(data: unknown): ContributorRewardLedger {
  return ContributorRewardLedgerSchema.parse(data);
}

export function validateRoutePass(data: unknown): RoutePassDocument {
  return RoutePassDocumentSchema.parse(data);
}

export function validatePartnerMerchantSubscription(data: unknown): PartnerMerchantSubscription {
  return PartnerMerchantSubscriptionSchema.parse(data);
}

export function validateApiSuccessEnvelope(data: unknown): ApiSuccessResponse {
  return ApiSuccessResponseSchema.parse(data);
}

export function validateApiErrorEnvelope(data: unknown): ApiErrorResponse {
  return ApiErrorResponseSchema.parse(data);
}
