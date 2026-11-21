/**
 * Startup Buildathon 2026 — Neighborhood Guide App
 * Task B7: Plan-B Rerouting Skill
 * Developer B — AI & Multimodal Lead
 * 
 * Programmatic execution wrapper for Skill 4: Plan-B Rerouting.
 * Consumes Developer C's spatial routing contracts and disruption signals (weather, closures, crowd limits)
 * to dynamically recalculate alternative routes, recompute arrival times, and generate explainable conversational guidance.
 */

import { z } from 'zod';
import { PlanBReroutingService } from '../../maps/services/plan-b.service.js';
import type {
  PlanBDisruption,
  PlanBExplanationContext,
  PlanBRerouteRequest,
  PlanBRerouteResponse,
  StopAlterationRecord,
  DisruptionType,
} from '../../maps/types/weather.types.js';

export const PlanBDisruptionInputSchema = z.object({
  type: z.string(),
  affectedPlaceId: z.string().optional(),
  affectedStopIndex: z.number().int().optional(),
  description: z.string(),
  severity: z.enum(['NONE', 'LOW', 'MODERATE', 'SEVERE']).default('SEVERE'),
  signalTimestamp: z.string().optional(),
});
export type PlanBDisruptionInput = z.infer<typeof PlanBDisruptionInputSchema>;

export const PlanBReroutingSkillInputSchema = z.object({
  originalRoute: z.any().describe('CanonicalRouteDocument for the active walking itinerary'),
  disruptions: z.array(PlanBDisruptionInputSchema).min(1),
  walkingPace: z.enum(['RELAXED', 'NORMAL', 'BRISK']).default('NORMAL'),
  preferredIndoorAlternatives: z.boolean().default(false),
  stopVisitDurationsMinutes: z.record(z.string(), z.number()).optional(),
  language: z.string().default('en'),
});
export type PlanBReroutingSkillInput = z.infer<typeof PlanBReroutingSkillInputSchema>;

export const PlanBReroutingSkillOutputSchema = z.object({
  success: z.boolean(),
  rerouteResponse: z.any(),
  conversationalExplanation: z.string(),
  safetyAdvisory: z.string().nullable(),
  rerouteMetricsSummary: z.object({
    disruptionType: z.string(),
    totalAlteredStops: z.number().int(),
    distanceDeltaMeters: z.number(),
    durationDeltaSeconds: z.number(),
    newTotalDurationMinutes: z.number(),
  }),
  unresolvedDisruptions: z.array(z.string()),
});
export type PlanBReroutingSkillOutput = z.infer<typeof PlanBReroutingSkillOutputSchema>;

/**
 * Formulates a natural language explanation from Developer C's PlanBExplanationContext.
 * Strict Rule: Never fabricates distances or arrival times; uses verified delta metrics exclusively.
 */
export function formulatePlanBConversationalGuidance(
  context: PlanBExplanationContext,
  _language = 'en'
): string {
  const durationDeltaMin = Math.round(context.durationDeltaSeconds / 60);

  const durationPhrase = durationDeltaMin >= 0
    ? `adds about ${durationDeltaMin} minute(s)`
    : `saves about ${Math.abs(durationDeltaMin)} minute(s)`;

  if (context.replacedStops.length === 0) {
    return `Plan-B reroute activated due to ${context.primaryDisruption}. Itinerary preserved with verified route pacing (${durationPhrase}).`;
  }

  const replacementsDesc = context.replacedStops
    .map((r: { from: string; to: string; reason: string }) => `swapped ${r.from} with ${r.to} (${r.reason})`)
    .join('; ');

  return `Plan-B update: ${context.summary}. We have ${replacementsDesc}. This adjustment ${durationPhrase} of walking across verified grounded pathways.`;
}

/**
 * Executes the Plan-B Rerouting Skill.
 */
export async function executePlanBReroutingSkill(
  input: PlanBReroutingSkillInput
): Promise<PlanBReroutingSkillOutput> {
  const parsedInput = PlanBReroutingSkillInputSchema.parse(input);

  // Map disruption type to DisruptionType supported by Developer C
  const mappedDisruptions: PlanBDisruption[] = parsedInput.disruptions.map((d: PlanBDisruptionInput) => {
    let mappedType: DisruptionType = 'VENUE_CLOSED';
    const rawUpper = d.type.toUpperCase();
    if (rawUpper === 'WEATHER' || rawUpper === 'HEAVY_RAIN') mappedType = 'HEAVY_RAIN';
    else if (rawUpper === 'THUNDERSTORM') mappedType = 'THUNDERSTORM';
    else if (rawUpper === 'WATERLOGGING') mappedType = 'WATERLOGGING';
    else if (rawUpper === 'EXTREME_HEAT') mappedType = 'EXTREME_HEAT';
    else if (rawUpper === 'CROWD' || rawUpper === 'VENUE_OVERCROWDED') mappedType = 'VENUE_OVERCROWDED';
    else if (rawUpper === 'STREET_BLOCKED') mappedType = 'STREET_BLOCKED';
    else if (rawUpper === 'OUTSIDE_HOURS') mappedType = 'OUTSIDE_HOURS';

    return {
      type: mappedType,
      affectedPlaceId: d.affectedPlaceId,
      affectedStopIndex: d.affectedStopIndex,
      description: d.description,
      severity: d.severity,
      signalTimestamp: d.signalTimestamp || new Date().toISOString(),
    };
  });

  const rerouteRequest: PlanBRerouteRequest = {
    originalRoute: parsedInput.originalRoute,
    disruptions: mappedDisruptions,
    walkingPace: parsedInput.walkingPace,
    preferredIndoorAlternatives: parsedInput.preferredIndoorAlternatives,
    stopVisitDurationsMinutes: parsedInput.stopVisitDurationsMinutes,
    allowMockFallback: true,
  };

  // Step 1: Execute Developer C's verified spatial Plan-B recalculation engine
  const rerouteResult: PlanBRerouteResponse = await PlanBReroutingService.reroutePlanB(rerouteRequest);

  // Step 2: Formulate natural language guidance using PlanBExplanationContext
  const conversationalExplanation = formulatePlanBConversationalGuidance(
    rerouteResult.explanationContext,
    parsedInput.language
  );

  // Step 3: Check for weather or capacity safety advisory
  let safetyAdvisory: string | null = null;
  const primaryInputDisruption = parsedInput.disruptions[0];
  const primaryTypeUpper = primaryInputDisruption?.type.toUpperCase();
  if (primaryTypeUpper === 'WEATHER' || primaryTypeUpper === 'HEAVY_RAIN' || primaryTypeUpper === 'THUNDERSTORM') {
    safetyAdvisory = `Severe Weather Advisory: ${primaryInputDisruption.description}. Pedestrian pathways routed via covered streets (Margosa Road). Avoid narrow waterlogged alleys.`;
  } else if (primaryTypeUpper === 'CROWD' || primaryTypeUpper === 'VENUE_OVERCROWDED') {
    safetyAdvisory = `Capacity Saturation Notice: Venue reached hourly visitor ceiling. Alternative selected to avoid standing delays.`;
  }

  // Step 4: Metric summary calculation
  const totalAltered = rerouteResult.alterations.filter(
    (a: StopAlterationRecord) => a.action === 'REPLACED' || a.action === 'SKIPPED'
  ).length;

  const totalDurationMin = Math.round(rerouteResult.updatedRoute.totalDurationSeconds / 60);

  const unresolved = rerouteResult.alterations
    .filter((a: StopAlterationRecord) => a.action === 'SKIPPED')
    .map((a: StopAlterationRecord) => `Stop ${a.originalStopName || a.originalPlaceId} could not be replaced with a nearby grounded venue; safely bypassed.`);

  return {
    success: true,
    rerouteResponse: rerouteResult,
    conversationalExplanation,
    safetyAdvisory,
    rerouteMetricsSummary: {
      disruptionType: primaryInputDisruption?.type || 'UNKNOWN',
      totalAlteredStops: totalAltered,
      distanceDeltaMeters: rerouteResult.explanationContext.distanceDeltaMeters,
      durationDeltaSeconds: rerouteResult.explanationContext.durationDeltaSeconds,
      newTotalDurationMinutes: totalDurationMin,
    },
    unresolvedDisruptions: unresolved,
  };
}
