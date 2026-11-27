/**
 * Test-only fixture registration helper.
 * Imported by unit tests in `src/maps/tests/` to populate `fixture-registry.ts`.
 * Never imported by production code.
 */

import { registerMapsFixtures } from '../../fixture-registry.js';
import {
  SAMPLE_HOURLY_CAPACITIES_FIXTURE,
  SAMPLE_FALLBACK_ALTERNATIVES_FIXTURE,
  SAMPLE_COMMUNITY_CROWD_SIGNALS_FIXTURE,
} from './sample-crowd.fixture.js';
import { SAMPLE_PLACES_FIXTURE } from './sample-places.fixture.js';
import {
  SAMPLE_NORMALIZED_WALKING_ROUTE,
  SAMPLE_CANONICAL_WALKING_ROUTE,
} from './sample-routes.fixture.js';
import {
  SAMPLE_WEATHER_FIXTURES,
  SAMPLE_CLOSURE_FIXTURES,
} from './sample-weather.fixture.js';

export function installTestMapsFixtures(): void {
  registerMapsFixtures({
    places: SAMPLE_PLACES_FIXTURE,
    hourlyCapacities: SAMPLE_HOURLY_CAPACITIES_FIXTURE,
    fallbackAlternatives: SAMPLE_FALLBACK_ALTERNATIVES_FIXTURE,
    communitySignals: SAMPLE_COMMUNITY_CROWD_SIGNALS_FIXTURE,
    weatherScenarios: SAMPLE_WEATHER_FIXTURES,
    closures: SAMPLE_CLOSURE_FIXTURES,
    normalizedWalkingRoute: SAMPLE_NORMALIZED_WALKING_ROUTE,
    canonicalWalkingRoute: SAMPLE_CANONICAL_WALKING_ROUTE,
    venueNames: {
      place_ctr_shri_sagar: 'CTR Shri Sagar',
      place_kadu_malleshwara: 'Kadu Malleshwara Temple',
      place_veena_stores: 'Veena Stores',
      place_janatha_hotel: 'Janatha Hotel',
      place_closed_stall_01: 'Heritage Spice Stall',
      ChIJN1t_tDeuEmsRUsoyG83frY4_sample_1: 'CTR Shri Sagar (Malleshwaram)',
      ChIJN1t_tDeuEmsRUsoyG83frY4_sample_2: 'Malleshwaram 8th Cross Flower Market',
      ChIJN1t_tDeuEmsRUsoyG83frY4_sample_3: 'Kadu Malleshwara Temple',
      ChIJN1t_tDeuEmsRUsoyG83frY4_sample_4: 'Sankey Tank Forest Walk',
      ChIJN1t_tDeuEmsRUsoyG83frY4_sample_5: 'Veena Stores (Malleshwaram)',
    },
  });
}

// Auto-install when imported by a test file
installTestMapsFixtures();

export * from './sample-crowd.fixture.js';
export * from './sample-evidence.fixture.js';
export * from './sample-places.fixture.js';
export * from './sample-routes.fixture.js';
export * from './sample-weather.fixture.js';
