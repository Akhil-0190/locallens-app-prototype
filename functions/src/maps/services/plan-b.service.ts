/**
 * Plan-B Rerouting Service
 * Developer C - Task C5
 *
 * Implements one-tap dynamic walking route recalculation responding to:
 * 1. Severe weather disruptions (monsoon downpours, heatwaves).
 * 2. Venue closures (scheduled rituals, unexpected alley works).
 * 3. Venue saturation & crowd throttling (C4 capacity integration).
 *
 * Corrective implementation addressing Developer A review findings:
 * - A2: Preserves genuine venue names from original route legs and spot inputs (no hardcoded "Start Stop").
 * - A3: Propagates UNKNOWN capacity status, setting hasCapacityUncertainty = true and updating crowdNotice.
 * - B3: Derives arrival times strictly from original route start time and actual route-leg durations.
 * - B4: Recalculates subsequent arrival times after detour substitutions using regenerated C3 route leg durations.
 * - B5: Re-evaluates C4 hourly capacity using updated arrival times.
 */

import { randomUUID } from 'node:crypto';
import { RoutesService } from './routes.service.js';
import { CrowdManagementService } from './crowd-management.service.js';
import { WeatherService } from './weather.service.js';
import { PlacesService } from './places.service.js';
import type {
  PlanBRerouteRequest,
  PlanBRerouteResponse,
  StopAlterationRecord,
  PlanBExplanationContext,
  DisruptionType,
} from '../types/weather.types.js';
import type { RouteStopInput } from '../types/routes.types.js';
import { getMapsFixtures } from '../fixture-registry.js';

interface ResolvedStopItem {
  placeId: string;
  spotName: string;
  coordinate: { latitude: number; longitude: number };
  visitDurationMinutes: number;
}

export class PlanBReroutingService {
  private static routesService = new RoutesService();
  private static weatherService = new WeatherService();
  private static placesService = new PlacesService({ allowMockFallback: false });

  /**
   * Helper to resolve genuine venue name from leg metadata, registered test names, or clean placeId.
   */
  public static resolveVenueName(placeId: string, fallbackName?: string): string {
    const knownNames = getMapsFixtures().venueNames;

    if (fallbackName && fallbackName !== 'Start Stop' && !fallbackName.startsWith('Stop ')) {
      return fallbackName;
    }

    if (knownNames[placeId]) {
      return knownNames[placeId];
    }

    if (placeId.startsWith('place_')) {
      const clean = placeId
        .replace(/^place_/, '')
        .split('_')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
      return clean;
    }

    return fallbackName || placeId;
  }

  /**
   * One-tap Plan-B dynamic rerouting entry point
   */
  public static async reroutePlanB(request: PlanBRerouteRequest): Promise<PlanBRerouteResponse> {
    const {
      originalRoute,
      disruptions,
      currentTravelerCoordinate,
      originalStartTime,
      stopVisitDurationsMinutes = {},
      walkingPace = 'NORMAL',
      preferredIndoorAlternatives = false,
      allowMockFallback = true,
    } = request;

    if (!originalRoute || !originalRoute.routeId) {
      throw new Error('Valid originalRoute is required for Plan-B rerouting.');
    }

    const rerouteId = `plan_b_${randomUUID().replace(/-/g, '').slice(0, 16)}`;

    // 1. Resolve genuine original stop list from route legs and waypointPlaceIds
    const orderedStops: ResolvedStopItem[] = [];

    // Origin
    const startCoord = currentTravelerCoordinate || {
      latitude: originalRoute.origin.latitude,
      longitude: originalRoute.origin.longitude,
    };
    const startPlaceId =
      originalRoute.legs[0]?.startPlaceId ||
      originalRoute.waypointPlaceIds?.[0] ||
      'start_stop';
    const startName = PlanBReroutingService.resolveVenueName(startPlaceId);

    orderedStops.push({
      placeId: startPlaceId,
      spotName: startName,
      coordinate: startCoord,
      visitDurationMinutes: stopVisitDurationsMinutes[startPlaceId] ?? 0,
    });

    // Intermediate and end stops from route legs
    for (let legIdx = 0; legIdx < originalRoute.legs.length; legIdx++) {
      const leg = originalRoute.legs[legIdx];
      const endPlaceId =
        leg.endPlaceId ||
        originalRoute.waypointPlaceIds?.[legIdx + 1] ||
        `stop_${legIdx + 1}`;
      const endName = PlanBReroutingService.resolveVenueName(endPlaceId);

      orderedStops.push({
        placeId: endPlaceId,
        spotName: endName,
        coordinate: {
          latitude: leg.endCoordinate.latitude,
          longitude: leg.endCoordinate.longitude,
        },
        visitDurationMinutes: stopVisitDurationsMinutes[endPlaceId] ?? 0,
      });
    }

    // Base start time
    const baseStartTimeMs = originalStartTime
      ? new Date(originalStartTime).getTime()
      : originalRoute.createdAt
      ? new Date(originalRoute.createdAt).getTime()
      : Date.now();

    const alterations: StopAlterationRecord[] = [];
    const newRouteStops: RouteStopInput[] = [];
    const warnings: string[] = [];

    let hasCapacityUncertainty = false;
    let hasWeatherImpact = false;
    let anyMockUsed = false;
    let primaryDisruption: DisruptionType = disruptions[0]?.type || 'VENUE_CLOSED';

    // Track running arrival time strictly from actual leg durations and visit durations
    let currentStopArrivalMs = baseStartTimeMs;

    // Live Weather Check (Stage 2 Promise #10): when running live (allowMockFallback: false),
    // automatically query Google Weather API at traveler's active coordinate.
    let liveWeatherImpaired = false;
    if (!allowMockFallback) {
      try {
        const weather = await PlanBReroutingService.weatherService.getWeatherCondition({
          location: startCoord,
          intendedVisitTime: new Date(baseStartTimeMs).toISOString(),
          allowMockFallback: false,
        });
        if (weather.isWalkingImpaired) {
          liveWeatherImpaired = true;
          hasWeatherImpact = true;
          warnings.push(
            `Live Weather Alert (${weather.condition}, ${weather.temperatureCelsius}°C): ${weather.advisory || 'Preferring indoor/covered alternatives.'}`
          );
        }
      } catch {
        // Non-blocking if Weather API is transiently unreachable
      }
    }

    // 2. Evaluate each stop in the original sequence
    for (let i = 0; i < orderedStops.length; i++) {
      const stop = orderedStops[i];
      const placeId = stop.placeId;

      // Add preceding leg walking duration (if i > 0, from original leg)
      if (i > 0 && originalRoute.legs[i - 1]) {
        currentStopArrivalMs += (originalRoute.legs[i - 1].durationSeconds || 0) * 1000;
      }

      const arrivalIso = new Date(currentStopArrivalMs).toISOString();

      // Check if this stop is affected by disruptions
      const matchedDisruption = disruptions.find(
        (d) =>
          d.affectedPlaceId === placeId ||
          d.affectedStopIndex === i ||
          ((d.type === 'HEAVY_RAIN' || d.type === 'THUNDERSTORM') && preferredIndoorAlternatives)
      );

      // Evaluate venue closure:
      // - In live mode (allowMockFallback === false): query live Google Places API (New) businessStatus & currentOpeningHours.
      // - In test mode (allowMockFallback === true): check test-registered closures.
      let isConfirmedClosed = matchedDisruption?.type === 'VENUE_CLOSED';
      if (allowMockFallback) {
        const closureSignal = getMapsFixtures().closures[placeId];
        if (closureSignal?.isClosed) isConfirmedClosed = true;
      } else if (!isConfirmedClosed && placeId.startsWith('ChIJ')) {
        try {
          const livePlace = await PlanBReroutingService.placesService.getPlaceDetails(placeId);
          if (
            livePlace.businessStatus === 'CLOSED_TEMPORARILY' ||
            livePlace.businessStatus === 'CLOSED_PERMANENTLY' ||
            livePlace.isOpenNow === false
          ) {
            isConfirmedClosed = true;
            warnings.push(`Live Google Maps status indicates ${stop.spotName} is currently closed.`);
          }
        } catch {
          // Non-blocking if live place lookup fails
        }
      }

      if (
        matchedDisruption?.type === 'HEAVY_RAIN' ||
        matchedDisruption?.type === 'THUNDERSTORM' ||
        (liveWeatherImpaired && preferredIndoorAlternatives)
      ) {
        hasWeatherImpact = true;
      }

      // Evaluate Capacity at the calculated arrival time
      const capEval = await CrowdManagementService.evaluateVenueCapacity({
        placeId,
        placeName: stop.spotName,
        intendedVisitTime: arrivalIso,
        allowMockFallback,
      });

      if (capEval.isMockData) anyMockUsed = true;
      if (capEval.status === 'UNKNOWN') hasCapacityUncertainty = true;

      const isOvercrowded = capEval.status === 'AT_CAPACITY' || matchedDisruption?.type === 'VENUE_OVERCROWDED';

      // Decide: Retain or Replace or Skip
      if (!isConfirmedClosed && !isOvercrowded && !matchedDisruption) {
        // RETAIN
        alterations.push({
          originalPlaceId: placeId,
          originalStopName: stop.spotName,
          action: 'RETAINED',
          scheduledArrival: arrivalIso,
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
        // Disruption occurred: Replace with grounded alternative via C4
        const reasonType: DisruptionType = isConfirmedClosed
          ? 'VENUE_CLOSED'
          : isOvercrowded
          ? 'VENUE_OVERCROWDED'
          : matchedDisruption?.type || 'VENUE_CLOSED';

        primaryDisruption = reasonType;

        const alternatives = await CrowdManagementService.findAlternativesForVenue({
          placeId,
          coordinate: stop.coordinate,
          intendedVisitTime: arrivalIso,
          allowMockFallback,
        });

        if (alternatives.length > 0) {
          // Select best candidate
          const chosenAlt = alternatives.find((a) => a.capacityStatus === 'AVAILABLE') || alternatives[0];

          // Finding A3: Propagate UNKNOWN capacity status appropriately
          if (chosenAlt.capacityStatus === 'UNKNOWN') {
            hasCapacityUncertainty = true;
          }

          alterations.push({
            originalPlaceId: placeId,
            originalStopName: stop.spotName,
            action: 'REPLACED',
            replacementPlaceId: chosenAlt.alternativePlaceId,
            replacementStopName: chosenAlt.alternativeName,
            replacementCoordinate: chosenAlt.coordinate,
            disruptionType: reasonType,
            scheduledArrival: arrivalIso,
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
          // No alternative available: SKIP if possible
          if (orderedStops.length > 2) {
            alterations.push({
              originalPlaceId: placeId,
              originalStopName: stop.spotName,
              action: 'SKIPPED',
              disruptionType: reasonType,
              scheduledArrival: arrivalIso,
              capacityStatusAtArrival: 'UNAVAILABLE',
              reason: `No verified alternative found for ${stop.spotName}. Stop omitted from revised route.`,
            });
            warnings.push(`Skipped ${stop.spotName}: no verified alternative available.`);
          } else {
            alterations.push({
              originalPlaceId: placeId,
              originalStopName: stop.spotName,
              action: 'RETAINED',
              disruptionType: reasonType,
              scheduledArrival: arrivalIso,
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

      // Add visit duration (if any) to current arrival time for next stop departure
      currentStopArrivalMs += (stop.visitDurationMinutes || 0) * 60 * 1000;
    }

    if (newRouteStops.length < 2) {
      throw new Error('Plan-B recalculation requires at least 2 valid stops.');
    }

    // 3. Finding B4: Regenerate the walking route via C3 RoutesService to get genuine leg durations
    const recalculatedRoute = await PlanBReroutingService.routesService.generateWalkingRoute({
      title: `${originalRoute.title} (Plan-B Revised)`,
      neighborhood: originalRoute.neighborhood,
      theme: originalRoute.theme,
      stops: newRouteStops,
      walkingPace,
      allowMockFallback,
    });

    if (recalculatedRoute.isMockData) anyMockUsed = true;

    // 4. Finding B4 & B5: Recalculate subsequent arrival times from the NEW route leg durations
    // and re-evaluate C4 capacity at those updated times.
    // Map legs to non-skipped alterations (which correspond 1:1 with newRouteStops).
    const nonSkippedAlterations = alterations.filter((a) => a.action !== 'SKIPPED');
    let recalculatedClockMs = baseStartTimeMs;
    for (let legIdx = 0; legIdx < recalculatedRoute.legs.length; legIdx++) {
      const leg = recalculatedRoute.legs[legIdx];
      recalculatedClockMs += (leg.durationSeconds || 0) * 1000;
      const updatedArrivalIso = new Date(recalculatedClockMs).toISOString();

      // The stop corresponding to this leg end is nonSkippedAlterations[legIdx + 1]
      const stopRecord = nonSkippedAlterations[legIdx + 1];
      if (stopRecord) {
        stopRecord.scheduledArrival = updatedArrivalIso;

        // Re-evaluate capacity at the updated arrival time
        const recheckPlaceId = stopRecord.replacementPlaceId || stopRecord.originalPlaceId;
        if (recheckPlaceId) {
          const recheckCap = await CrowdManagementService.evaluateVenueCapacity({
            placeId: recheckPlaceId,
            placeName: stopRecord.replacementStopName || stopRecord.originalStopName,
            intendedVisitTime: updatedArrivalIso,
            allowMockFallback,
          });

          stopRecord.capacityStatusAtArrival = recheckCap.status;
          stopRecord.crowdLevelAtArrival = recheckCap.crowdLevel;

          if (recheckCap.status === 'UNKNOWN') {
            hasCapacityUncertainty = true;
          }
        }

        // Add visit duration if any
        const visitDuration = stopVisitDurationsMinutes[recheckPlaceId || ''] ?? 0;
        recalculatedClockMs += visitDuration * 60 * 1000;
      }
    }

    // 5. Build Structured Explanation Context for Developer B (AI)
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

    const crowdNotice = hasCapacityUncertainty
      ? 'One or more replacement stops have unconfirmed (UNKNOWN) capacity records. Capacity cannot be guaranteed.'
      : undefined;

    const explanationContext: PlanBExplanationContext = {
      summary: `Plan-B reroute generated due to ${primaryDisruption}. ${replacedStops.length} stop(s) replaced.`,
      primaryDisruption,
      disruptedStopsCount: replacedStops.length,
      replacedStops,
      retainedStopsCount: retainedCount,
      distanceDeltaMeters: distanceDelta,
      durationDeltaSeconds: durationDelta,
      weatherAdvisory: hasWeatherImpact ? 'Weather disruption active. Indoor alternatives prioritized.' : undefined,
      crowdNotice,
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
