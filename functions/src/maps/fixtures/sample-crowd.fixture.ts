/**
 * Venue Capacity & Crowd Throttling Fixtures
 * Developer C - Task C4
 *
 * Sample hourly capacity records and alternative venue definitions for testing,
 * offline simulation, and development.
 *
 * ALL FIXTURES IN THIS FILE ARE EXPLICITLY LABELED WITH isMockData: true.
 * DO NOT TREAT AS REAL OR LIVE VENUE CAPACITIES.
 */

import type { VenueHourlyCapacityDocument } from '../../types/contracts/index.js';
import type { AlternativeVenueOption } from '../types/crowd.types.js';

export const SAMPLE_HOURLY_CAPACITIES_FIXTURE: Record<string, Record<string, VenueHourlyCapacityDocument>> = {
  // CTR Shri Sagar (Malleswaram) - popular breakfast/tiffin spot
  'place_ctr_shri_sagar': {
    // 08:00 UTC - Moderate crowd
    'slot_20261120_0800': {
      slotId: 'slot_20261120_0800',
      placeId: 'place_ctr_shri_sagar',
      hourSlot: '2026-11-20T08:00:00.000Z',
      maxCapacity: 15,
      currentVisitorsCount: 8,
      remainingCapacity: 7,
      level: 'MODERATE',
      isThrottled: false,
      suggestedAlternatives: [
        {
          alternativePlaceId: 'place_veena_stores',
          alternativeName: 'Veena Stores',
          distanceMeters: 450,
          walkingDurationMinutes: 6,
          currentCrowdLevel: 'LOW',
        },
      ],
      updatedAt: '2026-11-20T07:00:00.000Z',
    },
    // 09:00 UTC - AT_CAPACITY / Throttled
    'slot_20261120_0900': {
      slotId: 'slot_20261120_0900',
      placeId: 'place_ctr_shri_sagar',
      hourSlot: '2026-11-20T09:00:00.000Z',
      maxCapacity: 15,
      currentVisitorsCount: 15,
      remainingCapacity: 0,
      level: 'AT_CAPACITY',
      isThrottled: true,
      suggestedAlternatives: [
        {
          alternativePlaceId: 'place_veena_stores',
          alternativeName: 'Veena Stores',
          distanceMeters: 450,
          walkingDurationMinutes: 6,
          currentCrowdLevel: 'MODERATE',
        },
        {
          alternativePlaceId: 'place_janatha_hotel',
          alternativeName: 'Janatha Hotel',
          distanceMeters: 600,
          walkingDurationMinutes: 8,
          currentCrowdLevel: 'LOW',
        },
      ],
      updatedAt: '2026-11-20T08:00:00.000Z',
    },
    // 10:00 UTC - HIGH crowd (remaining 2/15)
    'slot_20261120_1000': {
      slotId: 'slot_20261120_1000',
      placeId: 'place_ctr_shri_sagar',
      hourSlot: '2026-11-20T10:00:00.000Z',
      maxCapacity: 15,
      currentVisitorsCount: 13,
      remainingCapacity: 2,
      level: 'HIGH',
      isThrottled: false,
      suggestedAlternatives: [],
      updatedAt: '2026-11-20T09:00:00.000Z',
    },
    // 11:00 UTC - LOW crowd (remaining 11/15)
    'slot_20261120_1100': {
      slotId: 'slot_20261120_1100',
      placeId: 'place_ctr_shri_sagar',
      hourSlot: '2026-11-20T11:00:00.000Z',
      maxCapacity: 15,
      currentVisitorsCount: 4,
      remainingCapacity: 11,
      level: 'LOW',
      isThrottled: false,
      suggestedAlternatives: [],
      updatedAt: '2026-11-20T10:00:00.000Z',
    },
  },

  // Veena Stores
  'place_veena_stores': {
    'slot_20261120_0900': {
      slotId: 'slot_20261120_0900',
      placeId: 'place_veena_stores',
      hourSlot: '2026-11-20T09:00:00.000Z',
      maxCapacity: 20,
      currentVisitorsCount: 10,
      remainingCapacity: 10,
      level: 'MODERATE',
      isThrottled: false,
      suggestedAlternatives: [],
      updatedAt: '2026-11-20T08:00:00.000Z',
    },
    'slot_20261120_1000': {
      slotId: 'slot_20261120_1000',
      placeId: 'place_veena_stores',
      hourSlot: '2026-11-20T10:00:00.000Z',
      maxCapacity: 20,
      currentVisitorsCount: 6,
      remainingCapacity: 14,
      level: 'LOW',
      isThrottled: false,
      suggestedAlternatives: [],
      updatedAt: '2026-11-20T09:00:00.000Z',
    },
  },

  // Janatha Hotel (Malleswaram)
  'place_janatha_hotel': {
    'slot_20261120_0900': {
      slotId: 'slot_20261120_0900',
      placeId: 'place_janatha_hotel',
      hourSlot: '2026-11-20T09:00:00.000Z',
      maxCapacity: 25,
      currentVisitorsCount: 5,
      remainingCapacity: 20,
      level: 'LOW',
      isThrottled: false,
      suggestedAlternatives: [],
      updatedAt: '2026-11-20T08:00:00.000Z',
    },
  },

  // Kadu Malleshwara Temple
  'place_kadu_malleshwara': {
    'slot_20261120_0900': {
      slotId: 'slot_20261120_0900',
      placeId: 'place_kadu_malleshwara',
      hourSlot: '2026-11-20T09:00:00.000Z',
      maxCapacity: 50,
      currentVisitorsCount: 15,
      remainingCapacity: 35,
      level: 'LOW',
      isThrottled: false,
      suggestedAlternatives: [],
      updatedAt: '2026-11-20T08:00:00.000Z',
    },
  },
};

/**
 * Fallback alternative venues with coordinates in Malleswaram
 */
export const SAMPLE_FALLBACK_ALTERNATIVES_FIXTURE: Record<string, AlternativeVenueOption[]> = {
  'place_ctr_shri_sagar': [
    {
      alternativePlaceId: 'place_veena_stores',
      alternativeName: 'Veena Stores',
      coordinate: {
        latitude: 13.0075,
        longitude: 77.5714,
        precision: 6,
        formatted: '13.007500, 77.571400',
        isValid: true,
      },
      distanceMeters: 450,
      walkingDurationMinutes: 6,
      currentCrowdLevel: 'MODERATE',
      remainingCapacity: 10,
      capacityStatus: 'AVAILABLE',
      reason: 'Authentic local tiffin alternative within 6 minutes walking distance',
      isMockData: true,
    },
    {
      alternativePlaceId: 'place_janatha_hotel',
      alternativeName: 'Janatha Hotel',
      coordinate: {
        latitude: 13.0019,
        longitude: 77.5702,
        precision: 6,
        formatted: '13.001900, 77.570200',
        isValid: true,
      },
      distanceMeters: 620,
      walkingDurationMinutes: 8,
      currentCrowdLevel: 'LOW',
      remainingCapacity: 20,
      capacityStatus: 'AVAILABLE',
      reason: 'Spacious vintage tiffin room with ample capacity',
      isMockData: true,
    },
  ],
};
