/**
 * Startup Buildathon 2026 — Neighborhood Guide App
 * Task B5: Street-Ready AI Assistance & Live Dialogue Schemas
 * Developer B — AI & Model Integration Lead
 * 
 * Defines structured output schemas and Zod validators for:
 * 1. Live conversational sessions and ephemeral token lifecycle
 * 2. Real-time translation & regional language Q&A
 * 3. Local greetings & vendor ordering assistance
 * 4. Contextual local etiquette assistance
 * 5. Camera-based sign & menu translation/understanding
 * 6. Audio guidance content generation (< 60 words for spoken delivery)
 * 7. Plan-B route change explanations (consuming C's PlanBExplanationContext)
 * 8. Continue in Gemini handoff context preparation
 * 
 * STRICT ARCHITECTURAL RULES:
 * - Preserves separation between LIVE_STREAMING, REQUEST_RESPONSE_FALLBACK, and OFFLINE_TEST_ADAPTER.
 * - Anti-Hallucination: missing dishes, unknown pricing, or unreadable signs are strictly undefined or marked unreadable.
 * - Never fabricates route metrics (uses Developer C's values exclusively).
 * - Never exposes raw server API keys to client devices.
 */

import { z } from 'zod';

export const DisruptionTypeSchema = z.enum([
  'HEAVY_RAIN',
  'WATERLOGGING',
  'EXTREME_HEAT',
  'THUNDERSTORM',
  'VENUE_CLOSED',
  'VENUE_OVERCROWDED',
  'STREET_BLOCKED',
  'OUTSIDE_HOURS',
  'CUSTOM_ALERT',
]);
export type DisruptionType = z.infer<typeof DisruptionTypeSchema>;

// ==============================================================================
// 1. Operational Mode and Provenance Metadata
// ==============================================================================

export const AssistanceDeliveryModeSchema = z.enum([
  'LIVE_STREAMING',            // Bidirectional WebSocket session via Gemini 3.8 Live
  'REQUEST_RESPONSE_FALLBACK', // Unary request/response via Gemini Flash
  'OFFLINE_MOCK_ADAPTER',      // In-memory test fixture for isolated validation
]);
export type AssistanceDeliveryMode = z.infer<typeof AssistanceDeliveryModeSchema>;

export const RegionalLanguageCodeSchema = z.enum([
  'kn-IN', // Kannada
  'ta-IN', // Tamil
  'hi-IN', // Hindi
  'te-IN', // Telugu
  'mr-IN', // Marathi
  'bn-IN', // Bengali
  'en-IN', // Indian English
  'en',    // General English
  'auto',  // Automatic detection
]);
export type RegionalLanguageCode = z.infer<typeof RegionalLanguageCodeSchema>;

export const OrderingCategorySchema = z.enum([
  'GREETING',
  'FOOD_ORDER',
  'PRICING',
  'DIETARY',
  'DIRECTIONS',
  'GRATITUDE',
]);
export type OrderingCategory = z.infer<typeof OrderingCategorySchema>;

// ==============================================================================
// 2. Gemini Live Session Handshake & Ephemeral Token Schema
// ==============================================================================

export const LiveSessionTokenRequestSchema = z.object({
  travelerId: z.string().min(1),
  sessionPurpose: z.enum(['STREET_WALKING', 'MARKET_BROWSING', 'VENDOR_ORDERING', 'ROUTE_NAVIGATION']),
  preferredLanguage: RegionalLanguageCodeSchema.default('kn-IN'),
  neighborhoodHint: z.string().optional(),
});
export type LiveSessionTokenRequest = z.infer<typeof LiveSessionTokenRequestSchema>;

export const LiveSessionTokenResponseSchema = z.object({
  sessionId: z.string().min(1),
  ephemeralToken: z.string().nullable(), // Null when provider token minting is unavailable
  webSocketEndpoint: z.string().url(),
  model: z.string(),
  expiresAt: z.string().nullable(), // Null when live session is unavailable
  ttlSeconds: z.number().int().nonnegative(),
  deliveryMode: AssistanceDeliveryModeSchema,
  systemInstructionsApplied: z.string(),
  isLiveSessionSupported: z.boolean(),
  diagnostics: z.object({
    status: z.enum(['ACTIVE', 'UNAVAILABLE', 'SERVICE_UNAVAILABLE']),
    notes: z.string(),
    providerMechanism: z.string(),
  }),
});
export type LiveSessionTokenResponse = z.infer<typeof LiveSessionTokenResponseSchema>;

// ==============================================================================
// 3. Conversational Street Copilot (Unary / Fallback) Schema
// ==============================================================================

export const StreetCopilotRequestSchema = z.object({
  query: z.string().min(1).max(1000),
  conversationHistory: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    text: z.string(),
  })).default([]),
  travelerContext: z.object({
    currentNeighborhood: z.string().optional(),
    currentCoordinates: z.object({
      latitude: z.number(),
      longitude: z.number(),
    }).optional(),
    activeDietaryRestrictions: z.array(z.string()).default([]),
    preferredLanguage: RegionalLanguageCodeSchema.default('en-IN'),
  }).optional(),
});
export type StreetCopilotRequest = z.infer<typeof StreetCopilotRequestSchema>;

export const StreetCopilotResponseSchema = z.object({
  answer: z.string().min(1),
  localLanguageSpoken: z.string().optional(),
  culturalContext: z.string().optional(),
  suggestedFollowUps: z.array(z.string()).default([]),
  deliveryMode: AssistanceDeliveryModeSchema,
  confidenceScore: z.number().min(0).max(1),
  modelUsed: z.string(),
  respondedAt: z.string(),
});
export type StreetCopilotResponse = z.infer<typeof StreetCopilotResponseSchema>;

// ==============================================================================
// 4. Real-Time Translation & Language Q&A Schema
// ==============================================================================

export const TranslationRequestSchema = z.object({
  sourceText: z.string().min(1).max(2000),
  sourceLanguage: RegionalLanguageCodeSchema.default('auto'),
  targetLanguage: RegionalLanguageCodeSchema.default('en'),
  conversationContext: z.string().optional(), // e.g. "Vendor negotiations at street fruit stall"
});
export type TranslationRequest = z.infer<typeof TranslationRequestSchema>;

export const TranslationResponseSchema = z.object({
  detectedSourceLanguage: z.string(),
  translatedText: z.string().min(1),
  phoneticTranscription: z.string().optional(),
  preservedPracticalDetails: z.object({
    extractedQuantities: z.array(z.string()).default([]),
    extractedPrices: z.array(z.string()).default([]),
    dietaryCuesDetected: z.array(z.string()).default([]),
  }),
  isLiteralTranslation: z.boolean(),
  culturalNuanceNote: z.string().optional(),
  deliveryMode: AssistanceDeliveryModeSchema,
  confidenceScore: z.number().min(0).max(1),
  modelUsed: z.string(),
  translatedAt: z.string(),
});
export type TranslationResponse = z.infer<typeof TranslationResponseSchema>;

// ==============================================================================
// 5. Local Greetings & Cultural Ordering Phrases Schema
// ==============================================================================

export const CulturalOrderingCardSchema = z.object({
  phraseRegional: z.string().min(1),
  phonetic: z.string().min(1),
  englishMeaning: z.string().min(1),
  category: OrderingCategorySchema,
  usageTip: z.string().min(1),
  formalityLevel: z.enum(['INFORMAL_WARM', 'POLITE_RESPECTFUL', 'FORMAL']),
  contextSuitability: z.string(), // e.g. "Darshini coffee counter batch order"
});
export type CulturalOrderingCard = z.infer<typeof CulturalOrderingCardSchema>;

export const OrderingAssistanceRequestSchema = z.object({
  category: OrderingCategorySchema.optional(),
  neighborhood: z.string().default('Malleshwaram'),
  targetVendorType: z.enum(['DARSHINI', 'SWEET_STALL', 'FLOWER_MARKET', 'TEMPLE_COUNTER', 'TEA_STALL', 'GENERAL']).default('GENERAL'),
  language: RegionalLanguageCodeSchema.default('kn-IN'),
  dietaryPreference: z.string().optional(),
});
export type OrderingAssistanceRequest = z.infer<typeof OrderingAssistanceRequestSchema>;

export const OrderingAssistanceResponseSchema = z.object({
  cards: z.array(CulturalOrderingCardSchema),
  neighborhood: z.string(),
  targetLanguage: RegionalLanguageCodeSchema,
  deliveryMode: AssistanceDeliveryModeSchema,
  modelUsed: z.string(),
  generatedAt: z.string(),
});
export type OrderingAssistanceResponse = z.infer<typeof OrderingAssistanceResponseSchema>;

// ==============================================================================
// 6. Contextual Etiquette Guidance Schema
// ==============================================================================

export const EtiquetteGuidanceRequestSchema = z.object({
  venueType: z.enum(['TEMPLE', 'HERITAGE_EATERY', 'FLOWER_BAZAAR', 'RESIDENTIAL_STREET', 'PUBLIC_PARK']),
  venueName: z.string().optional(),
  specificQuestion: z.string().optional(),
  travelerBackground: z.string().optional(),
});
export type EtiquetteGuidanceRequest = z.infer<typeof EtiquetteGuidanceRequestSchema>;

export const EtiquetteGuidanceResponseSchema = z.object({
  primaryGuidelines: z.array(z.string()).min(1),
  footwearProtocol: z.string(), // e.g. "Strictly remove at courtyard gateway"
  dressCodeAdvice: z.string(),  // e.g. "Cover shoulders and knees"
  photographyPermitted: z.enum(['YES', 'NO', 'PERMISSION_REQUIRED', 'OUTSIDE_ONLY']),
  diningOrPaymentCustoms: z.string(), // e.g. "Token first, stand along metal railings"
  taboosOrPitfallsToAvoid: z.array(z.string()),
  deliveryMode: AssistanceDeliveryModeSchema,
  confidenceScore: z.number().min(0).max(1),
  modelUsed: z.string(),
  assessedAt: z.string(),
});
export type EtiquetteGuidanceResponse = z.infer<typeof EtiquetteGuidanceResponseSchema>;

// ==============================================================================
// 7. Camera-Based Sign & Menu Translation Schema
// ==============================================================================

export const CameraVisualTranslationRequestSchema = z.object({
  imagePayload: z.object({
    base64Data: z.string().min(1),
    mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  }),
  captureContext: z.enum(['STOREFRONT_SIGN', 'MENU_BOARD', 'STREET_SIGN', 'NOTICE_PLAQUE']).default('STOREFRONT_SIGN'),
  targetLanguage: RegionalLanguageCodeSchema.default('en'),
});
export type CameraVisualTranslationRequest = z.infer<typeof CameraVisualTranslationRequestSchema>;

export const CameraVisualTranslationResponseSchema = z.object({
  detectedScript: z.string(),
  originalText: z.string(),
  translatedText: z.string(),
  culturalContext: z.string(),
  menuItemsDetected: z.array(z.object({
    itemName: z.string(),
    description: z.string(),
    priceDetected: z.string().nullable().default(null),
    dietaryFlags: z.array(z.string()).default([]),
  })).default([]),
  instructionsOrWarnings: z.array(z.string()).default([]),
  readabilityAssessment: z.enum(['CLEAR_READABLE', 'PARTIALLY_OBSCURED', 'BLURRY_OR_DARK', 'UNREADABLE']),
  deliveryMode: AssistanceDeliveryModeSchema,
  confidenceScore: z.number().min(0).max(1),
  modelUsed: z.string(),
  processedAt: z.string(),
});
export type CameraVisualTranslationResponse = z.infer<typeof CameraVisualTranslationResponseSchema>;

// ==============================================================================
// 8. Audio Guidance Content Generation Schema
// ==============================================================================

export const AudioGuidanceContentRequestSchema = z.object({
  currentLocationName: z.string().min(1),
  nextStopName: z.string().optional(),
  walkingDistanceMeters: z.number().min(0).optional(),
  walkingDurationSeconds: z.number().min(0).optional(),
  guidanceTrigger: z.enum(['ROUTE_START', 'APPROACHING_STOP', 'ARRIVED_AT_STOP', 'REROUTE_ALERT', 'BACKGROUND_TRIVIA']),
  travelerPacing: z.enum(['LEISURELY', 'NORMAL', 'BRISK']).default('NORMAL'),
});
export type AudioGuidanceContentRequest = z.infer<typeof AudioGuidanceContentRequestSchema>;

export const AudioGuidanceContentResponseSchema = z.object({
  spokenPromptText: z.string().min(1).max(600), // Enforced < 60 words for concise spoken audio
  wordCount: z.number().int().max(75),
  estimatedSpokenDurationSeconds: z.number().positive(),
  recommendedTtsLocale: z.string().default('en-IN'),
  deliveryMode: AssistanceDeliveryModeSchema,
  modelUsed: z.string(),
  generatedAt: z.string(),
});
export type AudioGuidanceContentResponse = z.infer<typeof AudioGuidanceContentResponseSchema>;

// ==============================================================================
// 9. Plan-B Reroute Explanation Schema (Consumes C's PlanBExplanationContext)
// ==============================================================================

export const PlanBExplanationRequestSchema = z.object({
  explanationContext: z.object({
    summary: z.string(),
    primaryDisruption: DisruptionTypeSchema,
    disruptedStopsCount: z.number().int().min(0),
    replacedStops: z.array(z.object({
      from: z.string(),
      to: z.string(),
      reason: z.string(),
    })),
    retainedStopsCount: z.number().int().min(0),
    distanceDeltaMeters: z.number(),
    durationDeltaSeconds: z.number(),
    weatherAdvisory: z.string().optional(),
    crowdNotice: z.string().optional(),
  }),
  spokenAudioPreferred: z.boolean().default(false),
});
export type PlanBExplanationRequest = z.infer<typeof PlanBExplanationRequestSchema>;

export const PlanBExplanationResponseSchema = z.object({
  conversationalSummary: z.string().min(1),
  spokenAudioSnippet: z.string().max(400), // Short script for immediate TTS walking cue
  disruptionExplanation: z.string(),
  replacementJustification: z.string(),
  deltaSummary: z.object({
    distanceChangeText: z.string(),
    timeChangeText: z.string(),
  }),
  crowdAndWeatherNote: z.string().optional(),
  deliveryMode: AssistanceDeliveryModeSchema,
  modelUsed: z.string(),
  generatedAt: z.string(),
});
export type PlanBExplanationResponse = z.infer<typeof PlanBExplanationResponseSchema>;

// ==============================================================================
// 10. Continue in Gemini Handoff Payload Schema
// ==============================================================================

export const GeminiHandoffContextSchema = z.object({
  travelerId: z.string(),
  activeNeighborhood: z.string(),
  currentCoordinates: z.object({
    latitude: z.number(),
    longitude: z.number(),
  }).optional(),
  currentRouteSummary: z.string().optional(),
  recentSpotCards: z.array(z.object({
    spotName: z.string(),
    category: z.string(),
    openHours: z.string().optional(),
  })).default([]),
  recentConversationSnippets: z.array(z.string()).default([]),
  userConsentGranted: z.boolean().default(false), // Explicit traveler confirmation required
});
export type GeminiHandoffContext = z.infer<typeof GeminiHandoffContextSchema>;

export const GeminiHandoffResponseSchema = z.object({
  consentStatus: z.enum(['CONSENT_GRANTED', 'CONSENT_REQUIRED', 'CANCELLED']),
  handoffUri: z.string().url().nullable(), // Null until traveler explicitly grants consent
  transferPayloadPreview: z.object({
    neighborhood: z.string(),
    coordinatesShared: z.boolean(),
    routeSummary: z.string().optional(),
    spotsCount: z.number(),
    conversationSnippetsCount: z.number(),
  }),
  transferPayloadJson: z.string().nullable(), // Null until traveler explicitly grants consent
  transferredAttributes: z.array(z.string()),
  omittedAttributes: z.array(z.string()),
  cancellationPath: z.string(), // Explicit cancellation action path (e.g. 'REMAIN_IN_APP')
  handoffDisclaimer: z.string(),
  generatedAt: z.string(),
});
export type GeminiHandoffResponse = z.infer<typeof GeminiHandoffResponseSchema>;
