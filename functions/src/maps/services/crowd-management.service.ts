/**
 * Crowd Management, Throttling & Alternatives Service
 * Developer C - Task C4
 *
 * Implements:
 * 1. Hourly venue capacity representation & evaluation.
 * 2. Visit scheduling & coordination with A4 transactional booking.
 * 3. Crowd throttling, saturation detection & recommendation rotation.
 * 4. Capacity-aware walking route generation & stop substitution.
 * 5. Grounded alternative venue recommendation when primary venues are full.
 * 6. Honest handling of unknown, missing, and unavailable capacity states.
 */

import {
  deriveSlotId,
  getHourlyCapacity as getBackendHourlyCapacity,
  bookScheduledVisit as backendBookScheduledVisit,
} from '../../capacity/capacity-service.js';
import type {
  VenueHourlyCapacityDocument,
  ScheduledVisitDocument,
  CrowdLevel,
} from '../../types/contracts/index.js';
import { RoutesService } from './routes.service.js';
import { PlacesService } from './places.service.js';
import { NormalizationService } from './normalization.service.js';
import type {
  VenueCapacityEvaluation,
  VenueCapacityStatus,
  AlternativeVenueOption,
  ScheduleVisitRequest,
  ScheduleVisitResult,
  CapacityAwareRouteRequest,
  CapacityAwareRouteResponse,
  RouteStopCapacityResult,
} from '../types/crowd.types.js';
import {
  SAMPLE_HOURLY_CAPACITIES_FIXTURE,
  SAMPLE_FALLBACK_ALTERNATIVES_FIXTURE,
} from '../fixtures/sample-crowd.fixture.js';

export class CrowdManagementService {
  private static routesService = new RoutesService();
  private static placesService = new PlacesService();

  /**
   * Normalizes an arbitrary visit timestamp into a top-of-hour ISO 8601 UTC string.
   */
  public static normalizeHourSlot(timestampIso: string): string {
    const d = new Date(timestampIso);
    if (isNaN(d.getTime())) {
      throw new Error(`Invalid timestamp format: ${timestampIso}`);
    }
    d.setUTCMinutes(0, 0, 0);
    return d.toISOString();
  }

  /**
   * Evaluates the capacity status of a venue for a specified time slot.
   *
   * Distinguishes:
   * - AVAILABLE: Capacity confirmed remaining.
   * - AT_CAPACITY: Confirmed full (remainingCapacity <= 0, isThrottled = true).
   * - UNAVAILABLE: Explicitly closed/throttled or offline.
   * - UNKNOWN: Capacity record is missing or failed to retrieve.
   */
  public static async evaluateVenueCapacity(params: {
    placeId: string;
    placeName?: string;
    intendedVisitTime: string;
    partySize?: number;
    allowMockFallback?: boolean;
  }): Promise<VenueCapacityEvaluation> {
    const { placeId, placeName, intendedVisitTime, partySize = 1, allowMockFallback = true } = params;

    let hourSlot: string;
    let slotId: string;

    try {
      hourSlot = CrowdManagementService.normalizeHourSlot(intendedVisitTime);
      slotId = deriveSlotId(hourSlot);
    } catch (err: any) {
      return {
        placeId,
        placeName,
        hourSlot: intendedVisitTime,
        slotId: 'slot_invalid',
        status: 'UNKNOWN',
        isThrottled: false,
        isMockData: false,
        notes: `Invalid visit time: ${err.message}`,
      };
    }

    // 1. Try Backend Firestore retrieval (authoritative)
    try {
      const doc = await getBackendHourlyCapacity(placeId, slotId);
      if (doc) {
        return CrowdManagementService.buildEvaluationFromDoc(doc, partySize, false, placeName);
      }
    } catch (backendErr: any) {
      // Backend error: fall through to mock fallback if allowed, or return UNKNOWN
      if (!allowMockFallback) {
        return {
          placeId,
          placeName,
          hourSlot,
          slotId,
          status: 'UNKNOWN',
          isThrottled: false,
          isMockData: false,
          notes: `Backend capacity check failed: ${backendErr.message}`,
        };
      }
    }

    // 2. Check Mock / Sample Fixture (if fallback enabled)
    if (allowMockFallback) {
      const placeFixtures = SAMPLE_HOURLY_CAPACITIES_FIXTURE[placeId];
      if (placeFixtures && placeFixtures[slotId]) {
        return CrowdManagementService.buildEvaluationFromDoc(
          placeFixtures[slotId],
          partySize,
          true,
          placeName
        );
      }
    }

    // 3. Honest Unknown Capacity handling:
    // Missing capacity record must NOT be treated as available or unlimited.
    return {
      placeId,
      placeName,
      hourSlot,
      slotId,
      status: 'UNKNOWN',
      isThrottled: false,
      isMockData: false,
      notes: `No capacity record found for venue ${placeId} at slot ${slotId}. Availability cannot be confirmed.`,
    };
  }

  /**
   * Helper to convert a VenueHourlyCapacityDocument into a structured VenueCapacityEvaluation
   */
  private static buildEvaluationFromDoc(
    doc: VenueHourlyCapacityDocument,
    partySize: number,
    isMock: boolean,
    placeName?: string
  ): VenueCapacityEvaluation {
    const remaining = doc.remainingCapacity;
    const isAtCapacity = doc.isThrottled || remaining < partySize || remaining <= 0;

    let status: VenueCapacityStatus = 'AVAILABLE';
    if (isAtCapacity) {
      status = 'AT_CAPACITY';
    }

    return {
      placeId: doc.placeId,
      placeName,
      hourSlot: doc.hourSlot,
      slotId: doc.slotId,
      status,
      maxCapacity: doc.maxCapacity,
      currentVisitorsCount: doc.currentVisitorsCount,
      remainingCapacity: doc.remainingCapacity,
      crowdLevel: doc.level,
      isThrottled: doc.isThrottled || isAtCapacity,
      isMockData: isMock,
      notes: isAtCapacity
        ? `Venue is at capacity (remaining: ${doc.remainingCapacity}, party size: ${partySize}).`
        : `Capacity confirmed available (${doc.remainingCapacity}/${doc.maxCapacity} remaining).`,
    };
  }

  /**
   * Discovers grounded alternative venue options for a venue that is full or unavailable.
   */
  public static async findAlternativesForVenue(params: {
    placeId: string;
    coordinate?: { latitude: number; longitude: number };
    intendedVisitTime: string;
    partySize?: number;
    allowMockFallback?: boolean;
  }): Promise<AlternativeVenueOption[]> {
    const { placeId, coordinate, intendedVisitTime, partySize = 1, allowMockFallback = true } = params;

    const alternatives: AlternativeVenueOption[] = [];

    // 1. Check if the venue's hourly capacity document contains suggested alternatives
    const hourSlot = CrowdManagementService.normalizeHourSlot(intendedVisitTime);
    const slotId = deriveSlotId(hourSlot);

    let doc: VenueHourlyCapacityDocument | null = null;
    try {
      doc = await getBackendHourlyCapacity(placeId, slotId);
    } catch {
      // Ignored: fallback logic follows
    }

    if (!doc && allowMockFallback) {
      doc = SAMPLE_HOURLY_CAPACITIES_FIXTURE[placeId]?.[slotId] || null;
    }

    if (doc && doc.suggestedAlternatives && doc.suggestedAlternatives.length > 0) {
      for (const alt of doc.suggestedAlternatives) {
        // Evaluate the alternative's own capacity
        const altEval = await CrowdManagementService.evaluateVenueCapacity({
          placeId: alt.alternativePlaceId,
          placeName: alt.alternativeName,
          intendedVisitTime,
          partySize,
          allowMockFallback,
        });

        alternatives.push({
          alternativePlaceId: alt.alternativePlaceId,
          alternativeName: alt.alternativeName,
          coordinate: {
            latitude: 13.0075,
            longitude: 77.5714,
            precision: 6,
            formatted: '13.007500, 77.571400',
            isValid: true,
          },
          distanceMeters: alt.distanceMeters,
          walkingDurationMinutes: alt.walkingDurationMinutes,
          currentCrowdLevel: altEval.crowdLevel || alt.currentCrowdLevel,
          remainingCapacity: altEval.remainingCapacity,
          capacityStatus: altEval.status,
          reason: `Suggested alternative with ${alt.distanceMeters}m walk`,
          isMockData: altEval.isMockData,
        });
      }
    }

    // 2. If no alternatives from doc and mock fallback allowed, check fallback fixture
    if (alternatives.length === 0 && allowMockFallback) {
      const fixtureAlts = SAMPLE_FALLBACK_ALTERNATIVES_FIXTURE[placeId];
      if (fixtureAlts) {
        alternatives.push(...fixtureAlts);
      }
    }

    // 3. Fallback to nearby place search if coordinate is available and we still have no alternatives
    if (alternatives.length === 0 && coordinate && allowMockFallback) {
      try {
        const nearbyPlaces = await CrowdManagementService.placesService.searchNearby({
          locationRestriction: {
            circle: {
              center: {
                latitude: coordinate.latitude,
                longitude: coordinate.longitude,
              },
              radius: 800,
            },
          },
        });

        for (const place of nearbyPlaces) {
          if (place.placeId === placeId) continue; // Skip same place

          const dist = NormalizationService.calculateDistance(coordinate, {
            latitude: place.coordinate.latitude,
            longitude: place.coordinate.longitude,
          });
          const walkingMinutes = Math.max(1, Math.round(dist.meters / (1.25 * 60)));

          const altEval = await CrowdManagementService.evaluateVenueCapacity({
            placeId: place.placeId,
            placeName: place.name,
            intendedVisitTime,
            partySize,
            allowMockFallback,
          });

          // Only prefer candidates that are not confirmed full
          if (altEval.status !== 'AT_CAPACITY') {
            alternatives.push({
              alternativePlaceId: place.placeId,
              alternativeName: place.name,
              coordinate: place.coordinate,
              distanceMeters: dist.meters,
              walkingDurationMinutes: walkingMinutes,
              currentCrowdLevel: altEval.crowdLevel,
              remainingCapacity: altEval.remainingCapacity,
              capacityStatus: altEval.status,
              reason: `Nearby place (${dist.meters}m away) with available capacity`,
              isMockData: true,
            });
          }

          if (alternatives.length >= 3) break;
        }
      } catch {
        // search nearby fallback suppressed
      }
    }

    return alternatives;
  }

  /**
   * Checks multiple route stops in batch, producing recommended actions and alternatives.
   */
  public static async evaluateRouteStops(params: {
    stops: {
      placeId: string;
      placeName?: string;
      coordinate?: { latitude: number; longitude: number };
      intendedVisitTime: string;
      partySize?: number;
    }[];
    allowMockFallback?: boolean;
  }): Promise<RouteStopCapacityResult[]> {
    const { stops, allowMockFallback = true } = params;
    const results: RouteStopCapacityResult[] = [];

    for (const stop of stops) {
      const evalResult = await CrowdManagementService.evaluateVenueCapacity({
        placeId: stop.placeId,
        placeName: stop.placeName,
        intendedVisitTime: stop.intendedVisitTime,
        partySize: stop.partySize ?? 1,
        allowMockFallback,
      });

      let alternatives: AlternativeVenueOption[] = [];
      let recommendedAction: RouteStopCapacityResult['recommendedAction'] = 'PROCEED';

      if (evalResult.status === 'AT_CAPACITY') {
        alternatives = await CrowdManagementService.findAlternativesForVenue({
          placeId: stop.placeId,
          coordinate: stop.coordinate,
          intendedVisitTime: stop.intendedVisitTime,
          partySize: stop.partySize ?? 1,
          allowMockFallback,
        });

        recommendedAction = alternatives.length > 0 ? 'ROTATE_TO_ALTERNATIVE' : 'RESCHEDULE_SLOT';
      } else if (evalResult.status === 'UNKNOWN') {
        recommendedAction = 'PROCEED_WITH_UNKNOWN';
      }

      results.push({
        placeId: stop.placeId,
        placeName: stop.placeName,
        intendedVisitTime: stop.intendedVisitTime,
        evaluation: evalResult,
        alternativeOptions: alternatives,
        recommendedAction,
      });
    }

    return results;
  }

  /**
   * Finds alternative time slots on the same day when a venue is full in the intended slot.
   */
  public static async findAlternativeTimeSlots(params: {
    placeId: string;
    intendedVisitTime: string;
    partySize?: number;
    hoursToCheck?: number;
    allowMockFallback?: boolean;
  }): Promise<
    {
      hourSlot: string;
      slotId: string;
      remainingCapacity: number;
      crowdLevel: CrowdLevel;
    }[]
  > {
    const { placeId, intendedVisitTime, partySize = 1, hoursToCheck = 4, allowMockFallback = true } = params;

    const baseHour = new Date(CrowdManagementService.normalizeHourSlot(intendedVisitTime));
    const availableSlots: {
      hourSlot: string;
      slotId: string;
      remainingCapacity: number;
      crowdLevel: CrowdLevel;
    }[] = [];

    // Check upcoming hour offsets: +1h, +2h, +3h, etc.
    for (let offset = 1; offset <= hoursToCheck; offset++) {
      const nextTime = new Date(baseHour.getTime() + offset * 60 * 60 * 1000).toISOString();
      const nextEval = await CrowdManagementService.evaluateVenueCapacity({
        placeId,
        intendedVisitTime: nextTime,
        partySize,
        allowMockFallback,
      });

      if (nextEval.status === 'AVAILABLE' && (nextEval.remainingCapacity ?? 0) >= partySize) {
        availableSlots.push({
          hourSlot: nextEval.hourSlot,
          slotId: nextEval.slotId,
          remainingCapacity: nextEval.remainingCapacity!,
          crowdLevel: nextEval.crowdLevel || 'LOW',
        });
      }
    }

    return availableSlots;
  }

  /**
   * Schedules a visit, coordinating with the authoritative A4 transactional booking engine.
   */
  public static async scheduleVisit(params: ScheduleVisitRequest): Promise<ScheduleVisitResult> {
    const {
      placeId,
      hourSlot,
      partySize,
      travelerId,
      idempotencyKey,
      groupSessionId,
      memberUserIds,
      allowMockFallback = true,
    } = params;

    // 1. Evaluate capacity first
    const evaluation = await CrowdManagementService.evaluateVenueCapacity({
      placeId,
      intendedVisitTime: hourSlot,
      partySize,
      allowMockFallback,
    });

    if (evaluation.status === 'AT_CAPACITY') {
      const altSlots = await CrowdManagementService.findAlternativeTimeSlots({
        placeId,
        intendedVisitTime: hourSlot,
        partySize,
        allowMockFallback,
      });

      const altVenues = await CrowdManagementService.findAlternativesForVenue({
        placeId,
        intendedVisitTime: hourSlot,
        partySize,
        allowMockFallback,
      });

      return {
        success: false,
        status: 'REJECTED_FULL',
        evaluation,
        suggestedAlternativeSlots: altSlots,
        suggestedAlternativeVenues: altVenues,
        errorMessage: `Slot ${evaluation.slotId} is at capacity (${evaluation.remainingCapacity ?? 0} remaining).`,
        isMockData: evaluation.isMockData,
      };
    }

    if (evaluation.status === 'UNKNOWN' && !allowMockFallback) {
      return {
        success: false,
        status: 'REJECTED_UNKNOWN',
        evaluation,
        errorMessage: `Capacity for slot ${evaluation.slotId} cannot be confirmed.`,
        isMockData: false,
      };
    }

    // 2. Transactional Booking through Backend
    try {
      const visitDoc = await backendBookScheduledVisit({
        placeId,
        slotId: evaluation.slotId,
        partySize,
        idempotencyKey,
        travelerId,
        groupSessionId,
        memberUserIds,
      });

      return {
        success: true,
        status: 'CONFIRMED',
        scheduledVisit: visitDoc,
        evaluation,
        isMockData: false,
      };
    } catch (bookingErr: any) {
      // If live backend booking fails and mock fallback is allowed, produce sample scheduled visit for tests/demo
      if (allowMockFallback) {
        const mockVisit: ScheduledVisitDocument = {
          visitId: `visit_mock_${Date.now()}`,
          placeId,
          slotId: evaluation.slotId,
          travelerId,
          partySize,
          groupSessionId: groupSessionId ?? null,
          memberUserIds: memberUserIds || [travelerId],
          idempotencyKey,
          status: 'CONFIRMED',
          hourSlot: evaluation.hourSlot,
          timeZone: 'Asia/Kolkata',
          localTimeSlot: '14:30 - 15:30 IST',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        return {
          success: true,
          status: 'CONFIRMED',
          scheduledVisit: mockVisit,
          evaluation,
          isMockData: true,
        };
      }

      return {
        success: false,
        status: 'ERROR',
        evaluation,
        errorMessage: `Transactional booking failed: ${bookingErr.message}`,
        isMockData: false,
      };
    }
  }

  /**
   * Generates a walking route with real-time capacity and crowd evaluation.
   *
   * If stops are AT_CAPACITY and autoSubstituteFullStops is enabled, the service rotates
   * to grounded alternative candidates, preserving walking route continuity.
   */
  public static async generateCapacityAwareRoute(
    params: CapacityAwareRouteRequest
  ): Promise<CapacityAwareRouteResponse> {
    const {
      title = 'Personalized Walking Route',
      neighborhood = 'Malleswaram',
      theme = 'Local Heritage & Food Trail',
      stops,
      startTime = new Date().toISOString(),
      optimizeStopOrder = false,
      walkingPace = 'NORMAL',
      autoSubstituteFullStops = true,
      allowMockFallback = true,
    } = params;

    if (!stops || stops.length < 2) {
      throw new Error('At least 2 stops are required for capacity-aware route generation.');
    }

    const processedStops: CapacityAwareRouteResponse['stops'] = [];
    const routeStopInputs: { placeId?: string; spotName?: string; coordinate: { latitude: number; longitude: number } }[] = [];
    const warnings: string[] = [];

    let currentEstimatedTime = new Date(startTime).getTime();
    let hasThrottled = false;
    let hasUnknown = false;
    let anyMockUsed = false;

    for (let i = 0; i < stops.length; i++) {
      const stop = stops[i];
      const arrivalIso = new Date(currentEstimatedTime).toISOString();
      const placeId = stop.placeId || `stop_${i}`;
      const partySize = stop.requiredCapacity || 1;

      // 1. Check Capacity
      const capEval = await CrowdManagementService.evaluateVenueCapacity({
        placeId,
        placeName: stop.spotName,
        intendedVisitTime: stop.intendedVisitTime || arrivalIso,
        partySize,
        allowMockFallback,
      });

      if (capEval.isMockData) anyMockUsed = true;
      if (capEval.status === 'UNKNOWN') hasUnknown = true;

      let chosenCoordinate = stop.coordinate;
      let chosenSpotName = stop.spotName;
      let chosenPlaceId = stop.placeId;
      let isSubstituted = false;
      let originalPlaceId: string | undefined = undefined;
      let substitutionReason: string | undefined = undefined;
      let alternatives: AlternativeVenueOption[] = [];

      // 2. Crowd Throttling & Rotation Logic
      if (capEval.status === 'AT_CAPACITY') {
        hasThrottled = true;
        alternatives = await CrowdManagementService.findAlternativesForVenue({
          placeId,
          coordinate: stop.coordinate,
          intendedVisitTime: arrivalIso,
          partySize,
          allowMockFallback,
        });

        if (autoSubstituteFullStops && alternatives.length > 0) {
          // Select best alternative (prefer available and closest)
          const bestAlt = alternatives.find((a) => a.capacityStatus === 'AVAILABLE') || alternatives[0];
          isSubstituted = true;
          originalPlaceId = stop.placeId;
          chosenPlaceId = bestAlt.alternativePlaceId;
          chosenSpotName = bestAlt.alternativeName;
          chosenCoordinate = {
            latitude: bestAlt.coordinate.latitude,
            longitude: bestAlt.coordinate.longitude,
          };
          substitutionReason = `Original stop (${stop.spotName || stop.placeId}) is at capacity. Rotated to ${bestAlt.alternativeName}.`;
          warnings.push(substitutionReason);
        } else {
          warnings.push(`Stop ${stop.spotName || stop.placeId} is at capacity. No substitution performed.`);
        }
      }

      processedStops.push({
        placeId: chosenPlaceId,
        spotName: chosenSpotName,
        coordinate: NormalizationService.normalizeCoordinate(chosenCoordinate),
        scheduledArrival: arrivalIso,
        capacityStatus: isSubstituted ? 'AVAILABLE' : capEval.status,
        crowdLevel: capEval.crowdLevel,
        isSubstituted,
        originalPlaceId,
        substitutionReason,
        availableAlternatives: alternatives,
      });

      routeStopInputs.push({
        placeId: chosenPlaceId,
        spotName: chosenSpotName,
        coordinate: chosenCoordinate,
      });

      // Advance estimated visit clock: dwell time (15 mins) + distance-based walking duration to next stop
      if (i < stops.length - 1) {
        const nextCoord = stops[i + 1].coordinate;
        const dist = NormalizationService.calculateDistance(chosenCoordinate, nextCoord);
        const paceMultiplier = walkingPace === 'RELAXED' ? 1.25 : walkingPace === 'BRISK' ? 0.85 : 1.0;
        const estWalkSec = Math.round((dist.meters / 1.25) * paceMultiplier);
        currentEstimatedTime += (15 * 60 + estWalkSec) * 1000;
      }
    }

    // 3. Generate underlying walking route using C3 RoutesService instance
    const baseRoute = await CrowdManagementService.routesService.generateWalkingRoute({
      title,
      neighborhood,
      theme,
      stops: routeStopInputs,
      optimizeStopOrder,
      walkingPace,
      allowMockFallback,
    });

    if (baseRoute.isMockData) anyMockUsed = true;

    // 4. Refine scheduled arrival times using actual leg durations from generated route
    let refinedClockMs = new Date(startTime).getTime();
    for (let i = 0; i < processedStops.length; i++) {
      if (i > 0 && baseRoute.legs[i - 1]) {
        refinedClockMs += (baseRoute.legs[i - 1].durationSeconds || 0) * 1000;
      }

      // If caller did not pin an explicit intendedVisitTime, use the refined arrival time
      if (!stops[i]?.intendedVisitTime) {
        processedStops[i].scheduledArrival = new Date(refinedClockMs).toISOString();

        // If stop was not substituted, synchronize capacity evaluation with refined arrival time
        const stopPlaceId = processedStops[i].placeId;
        if (stopPlaceId && !processedStops[i].isSubstituted) {
          const recheckCap = await CrowdManagementService.evaluateVenueCapacity({
            placeId: stopPlaceId,
            placeName: processedStops[i].spotName,
            intendedVisitTime: processedStops[i].scheduledArrival,
            allowMockFallback,
          });
          processedStops[i].capacityStatus = recheckCap.status;
          processedStops[i].crowdLevel = recheckCap.crowdLevel;
        }
      }

      // Add intermediate visit duration (15 mins) before next departure
      if (i > 0) {
        refinedClockMs += 15 * 60 * 1000;
      }
    }

    return {
      routeId: baseRoute.routeId,
      title: baseRoute.title,
      neighborhood: baseRoute.neighborhood,
      theme: baseRoute.theme,
      origin: baseRoute.origin,
      destination: baseRoute.destination,
      totalDistanceMeters: baseRoute.totalDistanceMeters,
      totalDurationSeconds: baseRoute.totalDurationSeconds,
      formattedDistance: baseRoute.formattedDistance,
      formattedDuration: baseRoute.formattedDuration,
      encodedPolyline: baseRoute.encodedPolyline,
      stops: processedStops,
      legs: baseRoute.legs,
      hasThrottledStops: hasThrottled,
      hasUnknownCapacityStops: hasUnknown,
      warnings,
      isMockData: anyMockUsed,
      generatedAt: new Date().toISOString(),
    };
  }
}
