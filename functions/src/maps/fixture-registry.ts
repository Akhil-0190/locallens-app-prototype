/**
 * Maps Fixture Registry (test-injection seam)
 *
 * PRODUCTION BEHAVIOUR: this registry is EMPTY. No sample places, routes, weather,
 * closures, or crowd records ship with production code, and `getMapsConfig()`
 * derives `allowMockFallback = false` whenever nothing is registered. When a live
 * Google API is unconfigured or fails, services return honest UNKNOWN / UNAVAILABLE
 * / error states instead of fabricated data.
 *
 * TEST BEHAVIOUR: unit tests register deterministic fixtures from
 * `src/maps/tests/fixtures/register.ts`. Production source MUST NOT import anything
 * from a `tests/` directory (enforced by `npm run audit:mocks`).
 */

import type { GooglePlaceNewRaw } from './types/places.types';
import type { WalkingRoute } from './types/routes.types';
import type { CanonicalRouteDocument, VenueHourlyCapacityDocument } from '../types/contracts';
import type { AlternativeVenueOption, CommunityCrowdSignal } from './types/crowd.types';
import type { NormalizedWeather, VenueClosureSignal } from './types/weather.types';

export interface MapsFixtureBundle {
  places: GooglePlaceNewRaw[];
  hourlyCapacities: Record<string, Record<string, VenueHourlyCapacityDocument>>;
  fallbackAlternatives: Record<string, AlternativeVenueOption[]>;
  communitySignals: Record<string, CommunityCrowdSignal[]>;
  weatherScenarios: Record<string, NormalizedWeather>;
  defaultWeather?: NormalizedWeather;
  closures: Record<string, VenueClosureSignal>;
  venueNames: Record<string, string>;
  normalizedWalkingRoute?: WalkingRoute;
  canonicalWalkingRoute?: CanonicalRouteDocument;
}

function emptyBundle(): MapsFixtureBundle {
  return {
    places: [],
    hourlyCapacities: {},
    fallbackAlternatives: {},
    communitySignals: {},
    weatherScenarios: {},
    closures: {},
    venueNames: {},
  };
}

let activeBundle: MapsFixtureBundle = emptyBundle();
let registered = false;

/** Registers deterministic fixtures. Intended for unit tests only. */
export function registerMapsFixtures(bundle: Partial<MapsFixtureBundle>): void {
  activeBundle = { ...emptyBundle(), ...bundle };
  registered = true;
}

/** Restores the production (empty) state. */
export function clearMapsFixtures(): void {
  activeBundle = emptyBundle();
  registered = false;
}

export function getMapsFixtures(): MapsFixtureBundle {
  return activeBundle;
}

/** True only when a test explicitly registered fixtures. Always false in production. */
export function hasMapsFixtures(): boolean {
  return registered;
}
