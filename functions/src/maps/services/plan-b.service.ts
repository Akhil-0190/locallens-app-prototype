/**
 * Plan-B Rerouting Service
 * Developer C - Task C5
 *
 * Implements one-tap dynamic walking route recalculation responding to:
 * 1. Severe weather disruptions (monsoon downpours, heatwaves).
 * 2. Venue closures (scheduled rituals, unexpected alley works).
 * 3. Venue saturation & crowd throttling (C4 capacity integration).
 *
 * Reuses:
 * - RoutesService (C3) for genuine polyline, distance/duration, legs & steps generation.
 * - CrowdManagementService (C4) for hourly slot capacity, alternatives discovery & rotation.
 */

import { randomUUID } from 'node:crypto';
import { RoutesService } from './routes.service.js';
import { CrowdManagementService } from './crowd-management.service.js';
import type {
  PlanBRerouteRequest,
  PlanBRerouteResponse,
  StopAlterationRecord,
  PlanBExplanationContext,
  DisruptionType,
} from '../types/weather.types.js';
import type { RouteStopInput } from '../types/routes.types.js';
import { SAMPLE_CLOSURE_FIXTURES } from '../fixtures/sample-weather.fixture.js';

export class PlanBReroutingService {
  private static routesService = new RoutesService();

  /**
   * One-tap Plan-B dynamic rerouting entry point
   */
  public static async reroutePlanB(request: PlanBRerouteRequest): Promise<PlanBRerouteResponse> {
    const {
      originalRoute,
      disruptions,
      currentTravelerCoordinate,
      walkingPace = 'NORMAL',
      preferredIndoorAlternatives = false,
      allowMockFallback = true,
    } = request;

    if (!originalRoute || !originalRoute.routeId) {
      throw new Error('Valid originalRoute is required for Plan-B rerouting.');
    }

    const rerouteId = `plan_b_${randomUUID().replace(/-/g, '').slice(0, 16)}`;

    // Extract stops sequence from original route legs
    const orderedStops: { placeId: string; spotName: string; coordinate: { latitude: number; longitude: number } }[] = [];

    // Add origin
    const startCoord = currentTravelerCoordinate || {
      latitude: originalRoute.origin.latitude,
      longitude: originalRoute.origin.longitude,
    };

    orderedStops.push({
      placeId: originalRoute.legs[0]?.startPlaceId || 'start_stop',
      spotName: 'Start Stop',
      coordinate: startCoord,
    });

    // Add intermediate/end stops from legs
    for (const leg of originalRoute.legs) {
      orderedStops.push({
        placeId: leg.endPlaceId || `stop_${orderedStops.length}`,
        spotName: `Stop ${orderedStops.length}`,
        coordinate: {
          latitude: leg.endCoordinate.latitude,
          longitude: leg.endCoordinate.longitude,
        },
      });
    }

    const alterations: StopAlterationRecord[] = [];
    const newRouteStops: RouteStopInput[] = [];
    const warnings: string[] = [];

    let hasCapacityUncertainty = false;
    let hasWeatherImpact = false;
    let anyMockUsed = false;
    let primaryDisruption: DisruptionType = disruptions[0]?.type || 'VENUE_CLOSED';

    // Estimated start timestamp: now or base date
    let currentEstimatedTime = new Date().toISOString();

    // 1. Process each stop in sequence
    for (let i = 0; i < orderedStops.length; i++) {
      const stop = orderedStops[i];
      const placeId = stop.placeId;

      // Check if this stop is explicitly affected by a disruption input
      const matchedDisruption = disruptions.find(
        (d) =>
          d.affectedPlaceId === placeId ||
          d.affectedStopIndex === i ||
          (d.type === 'HEAVY_RAIN' && preferredIndoorAlternatives)
      );

      // Evaluate closure from fixture or Places API
      const closureSignal = SAMPLE_CLOSURE_FIXTURES[placeId];
      const isConfirmedClosed = closureSignal?.isClosed || matchedDisruption?.type === 'VENUE_CLOSED';

      // Evaluate Weather at stop coordinate if relevant
      if (matchedDisruption?.type === 'HEAVY_RAIN' || matchedDisruption?.type === 'THUNDERSTORM') {
        hasWeatherImpact = true;
      }

      // Evaluate Capacity at current arrival time
      const capEval = await CrowdManagementService.evaluateVenueCapacity({
        placeId,
        placeName: stop.spotName,
        intendedVisitTime: currentEstimatedTime,
        allowMockFallback,
      });

      if (capEval.isMockData) anyMockUsed = true;
      if (capEval.status === 'UNKNOWN') hasCapacityUncertainty = true;

      const isOvercrowded = capEval.status === 'AT_CAPACITY' || matchedDisruption?.type === 'VENUE_OVERCROWDED';

      // 2. Decide: Retain or Replace or Skip
      if (!isConfirmedClosed && !isOvercrowded && !matchedDisruption) {
        // Stop is unaffected: RETAIN
        alterations.push({
          originalPlaceId: placeId,
          originalStopName: stop.spotName,
          action: 'RETAINED',
          capacityStatusAtArrival: capEval.status,
          crowdLevelAtArrival: capEval.crowdLevel,
          reason: 'Stop is operational and within capacity limits.',
        });

        newRouteStops.push({
          placeId,
          spotName: stop.spotName,
          coordinate: stop.coordinate,
        });
      } else {
        // Disruption occurred: Search grounded alternative via C4
        const reasonType: DisruptionType = isConfirmedClosed
          ? 'VENUE_CLOSED'
          : isOvercrowded
          ? 'VENUE_OVERCROWDED'
          : matchedDisruption?.type || 'VENUE_CLOSED';

        primaryDisruption = reasonType;

        const alternatives = await CrowdManagementService.findAlternativesForVenue({
          placeId,
          coordinate: stop.coordinate,
          intendedVisitTime: currentEstimatedTime,
          allowMockFallback,
        });

        if (alternatives.length > 0) {
          // Select best candidate with positive capacity
          const chosenAlt = alternatives.find((a) => a.capacityStatus === 'AVAILABLE') || alternatives[0];

          alterations.push({
            originalPlaceId: placeId,
            originalStopName: stop.spotName,
            action: 'REPLACED',
            replacementPlaceId: chosenAlt.alternativePlaceId,
            replacementStopName: chosenAlt.alternativeName,
            replacementCoordinate: chosenAlt.coordinate,
            disruptionType: reasonType,
            capacityStatusAtArrival: chosenAlt.capacityStatus,
            crowdLevelAtArrival: chosenAlt.currentCrowdLevel,
            reason: `Replaced ${stop.spotName} (${reasonType}) with ${chosenAlt.alternativeName} (${chosenAlt.distanceMeters}m detour).`,
          });

          newRouteStops.push({
            placeId: chosenAlt.alternativePlaceId,
            spotName: chosenAlt.alternativeName,
            coordinate: {
              latitude: chosenAlt.coordinate.latitude,
              longitude: chosenAlt.coordinate.longitude,
            },
          });

          warnings.push(`Rotated from ${stop.spotName} to ${chosenAlt.alternativeName} due to ${reasonType}.`);
        } else {
          // No alternative available: SKIP stop if route has at least 2 other stops
          if (orderedStops.length > 2) {
            alterations.push({
              originalPlaceId: placeId,
              originalStopName: stop.spotName,
              action: 'SKIPPED',
              disruptionType: reasonType,
              capacityStatusAtArrival: 'UNAVAILABLE',
              reason: `No verified alternative found for ${stop.spotName}. Stop omitted from revised route.`,
            });
            warnings.push(`Skipped ${stop.spotName}: no verified alternative available.`);
          } else {
            // Cannot omit: retain with warning
            alterations.push({
              originalPlaceId: placeId,
              originalStopName: stop.spotName,
              action: 'RETAINED',
              disruptionType: reasonType,
              capacityStatusAtArrival: capEval.status,
              reason: `Stop retained because route cannot have fewer than 2 stops.`,
            });
            newRouteStops.push({
              placeId,
              spotName: stop.spotName,
              coordinate: stop.coordinate,
            });
          }
        }
      }

      // Advance clock ~20 min for visit
      currentEstimatedTime = new Date(new Date(currentEstimatedTime).getTime() + 20 * 60 * 1000).toISOString();
    }

    // Ensure at least 2 stops for walking route calculation
    if (newRouteStops.length < 2) {
      throw new Error('Plan-B recalculation requires at least 2 valid stops.');
    }

    // 3. Recalculate walking route using C3 RoutesService
    const recalculatedRoute = await PlanBReroutingService.routesService.generateWalkingRoute({
      title: `${originalRoute.title} (Plan-B Revised)`,
      neighborhood: originalRoute.neighborhood,
      theme: originalRoute.theme,
      stops: newRouteStops,
      walkingPace,
      allowMockFallback,
    });

    if (recalculatedRoute.isMockData) anyMockUsed = true;

    // 4. Build Structured Explanation Context for Developer B (AI)
    const replacedStops = alterations
      .filter((a) => a.action === 'REPLACED')
      .map((a) => ({
        from: a.originalStopName || a.originalPlaceId || 'Original Stop',
        to: a.replacementStopName || a.replacementPlaceId || 'Alternative',
        reason: a.reason,
      }));

    const retainedCount = alterations.filter((a) => a.action === 'RETAINED').length;
    const distanceDelta = recalculatedRoute.totalDistanceMeters - originalRoute.totalDistanceMeters;
    const durationDelta = recalculatedRoute.totalDurationSeconds - originalRoute.totalDurationSeconds;

    const explanationContext: PlanBExplanationContext = {
      summary: `Plan-B reroute generated due to ${primaryDisruption}. ${replacedStops.length} stop(s) replaced.`,
      primaryDisruption,
      disruptedStopsCount: replacedStops.length,
      replacedStops,
      retainedStopsCount: retainedCount,
      distanceDeltaMeters: distanceDelta,
      durationDeltaSeconds: durationDelta,
      weatherAdvisory: hasWeatherImpact ? 'Weather disruption active. Indoor alternatives prioritized.' : undefined,
      crowdNotice: hasCapacityUncertainty ? 'Some stops have unconfirmed capacity records.' : undefined,
    };

    return {
      rerouteId,
      originalRouteId: originalRoute.routeId,
      updatedRoute: recalculatedRoute,
      alterations,
      explanationContext,
      hasCapacityUncertainty,
      hasWeatherImpact,
      warnings,
      isMockData: anyMockUsed,
      generatedAt: new Date().toISOString(),
    };
  }
}
