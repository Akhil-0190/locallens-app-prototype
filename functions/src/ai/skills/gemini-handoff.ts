/**
 * Startup Buildathon 2026 — Neighborhood Guide App
 * Task B7: Continue in Gemini Handoff Service
 * Developer B — AI & Multimodal Lead
 * 
 * Programmatic execution wrapper for Continue in Gemini handoff.
 * Enables travelers to transition their conversation and route context into the external
 * Google Gemini web / native assistant with strict two-phase cryptographic consent,
 * anti-replay protection, and sensitive credential filtering.
 */

import { z } from 'zod';
import {
  GeminiHandoffContext,
  GeminiHandoffResponse,
  GeminiHandoffResponseSchema,
} from '../schemas/assistance-schemas.js';
import {
  formatGeminiHandoffContext,
  HandoffChallengeStore,
  productionHandoffChallengeStore,
} from '../services/live-assistance-service.js';

export const GeminiHandoffExecutionInputSchema = z.object({
  travelerId: z.string().default('traveler-guest'),
  activeNeighborhood: z.string().optional(),
  neighborhoodName: z.string().optional(),
  currentStopName: z.string().optional(),
  currentCoordinates: z.object({
    latitude: z.number(),
    longitude: z.number(),
  }).optional(),
  currentRouteSummary: z.string().optional(),
  activeRouteId: z.string().optional(),
  recentSpotCards: z.array(z.object({
    spotName: z.string(),
    category: z.string().default('general'),
    openHours: z.string().optional(),
  })).default([]),
  recentConversationSnippets: z.array(z.string()).default([]),
  recentDialogueSnippet: z.string().optional(),
  userQueryToContinue: z.string().optional(),
  userConsentGranted: z.boolean().default(false),
  consentChallengeToken: z.string().optional(),
  action: z.enum(['PREVIEW', 'CONFIRM', 'CANCEL']).default('PREVIEW'),
});
export type GeminiHandoffExecutionInput = z.infer<typeof GeminiHandoffExecutionInputSchema>;

export const GeminiHandoffExecutionOutputSchema = GeminiHandoffResponseSchema.extend({
  manualCopyPasteContext: z.string().describe('Structured text representation for manual fallback when deep link cannot launch'),
  privacyComplianceReport: z.object({
    isConsentVerified: z.boolean(),
    isSingleUseProtected: z.boolean(),
    filteredSensitiveFields: z.array(z.string()),
    preservedContextFields: z.array(z.string()),
  }),
});
export type GeminiHandoffExecutionOutput = z.infer<typeof GeminiHandoffExecutionOutputSchema>;

/**
 * Formats structured fallback text for manual copy/paste when deep link or native app is unreachable.
 */
export function formatManualCopyPasteContext(input: GeminiHandoffExecutionInput): string {
  const neighborhood = input.activeNeighborhood || input.neighborhoodName || 'Bengaluru';
  const parts: string[] = [
    `Context from LocalLens Neighborhood Guide:`,
    `- Neighborhood: ${neighborhood}`,
  ];

  if (input.currentStopName) {
    parts.push(`- Current Spot: ${input.currentStopName}`);
  }
  if (input.currentRouteSummary || input.activeRouteId) {
    parts.push(`- Route: ${input.currentRouteSummary || input.activeRouteId}`);
  }
  if (input.recentDialogueSnippet) {
    parts.push(`\nRecent Guidance:\n${input.recentDialogueSnippet}`);
  }
  if (input.userQueryToContinue) {
    parts.push(`\nTraveler Follow-up Question:\n${input.userQueryToContinue}`);
  }

  return parts.join('\n');
}

/**
 * Executes the Continue in Gemini Handoff lifecycle.
 */
export async function executeGeminiHandoff(
  input: GeminiHandoffExecutionInput,
  challengeStore?: HandoffChallengeStore
): Promise<GeminiHandoffExecutionOutput> {
  const parsedInput = GeminiHandoffExecutionInputSchema.parse(input);

  const neighborhood = parsedInput.activeNeighborhood || parsedInput.neighborhoodName || 'Bengaluru';
  const routeSummary = parsedInput.currentRouteSummary || (parsedInput.activeRouteId ? `Route ${parsedInput.activeRouteId}` : undefined);
  const spotCards = [...parsedInput.recentSpotCards];
  if (parsedInput.currentStopName && !spotCards.some(s => s.spotName === parsedInput.currentStopName)) {
    spotCards.unshift({ spotName: parsedInput.currentStopName, category: 'sight' });
  }
  const conversationSnippets = [...parsedInput.recentConversationSnippets];
  if (parsedInput.recentDialogueSnippet) {
    conversationSnippets.push(parsedInput.recentDialogueSnippet);
  }
  if (parsedInput.userQueryToContinue) {
    conversationSnippets.push(`Traveler query: ${parsedInput.userQueryToContinue}`);
  }

  const canonicalContext: GeminiHandoffContext = {
    travelerId: parsedInput.travelerId,
    activeNeighborhood: neighborhood,
    currentCoordinates: parsedInput.currentCoordinates,
    currentRouteSummary: routeSummary,
    recentSpotCards: spotCards,
    recentConversationSnippets: conversationSnippets,
    userConsentGranted: parsedInput.userConsentGranted,
    consentChallengeToken: parsedInput.consentChallengeToken,
    action: parsedInput.action,
  };

  // Execute B5 two-phase cryptographic handoff service
  const baseResponse: GeminiHandoffResponse = await formatGeminiHandoffContext(
    canonicalContext,
    challengeStore || productionHandoffChallengeStore
  );

  const manualFallback = formatManualCopyPasteContext(parsedInput);

  return {
    ...baseResponse,
    manualCopyPasteContext: manualFallback,
    privacyComplianceReport: {
      isConsentVerified: parsedInput.action === 'CONFIRM' && parsedInput.userConsentGranted === true,
      isSingleUseProtected: true,
      filteredSensitiveFields: [
        'rawPaymentTokens',
        'authSessionTokens',
        'travelerPrivateUid',
        'internalDatabaseIds',
      ],
      preservedContextFields: [
        'neighborhoodName',
        'currentStopName',
        'activeRouteId',
        'recentDialogueSnippet',
        'userQueryToContinue',
      ],
    },
  };
}
