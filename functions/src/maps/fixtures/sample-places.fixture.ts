/**
 * Sample Places Fixture (Bengaluru Heritage & Culinary Quarter)
 * Developer C - Google Maps Platform Integration
 * 
 * IMPORTANT: This is clearly labeled offline mock data for testing,
 * fallback demonstration, and test scenario validation when live API is unavailable.
 */

import type { GooglePlaceNewRaw } from '../types/places.types';

export const SAMPLE_PLACES_FIXTURE: GooglePlaceNewRaw[] = [
  {
    id: 'ChIJN1t_tDeuEmsRUsoyG83frY4_sample_1',
    name: 'places/ChIJN1t_tDeuEmsRUsoyG83frY4_sample_1',
    displayName: {
      text: 'CTR Shri Sagar (Malleshwaram)',
      languageCode: 'en',
    },
    formattedAddress: '7th Cross Rd, Malleshwaram, Bengaluru, Karnataka 560003',
    location: {
      latitude: 13.003185,
      longitude: 77.570258,
    },
    primaryType: 'south_indian_restaurant',
    types: ['south_indian_restaurant', 'restaurant', 'food', 'point_of_interest'],
    rating: 4.6,
    userRatingCount: 32450,
    currentOpeningHours: {
      openNow: true,
      weekdayDescriptions: [
        'Monday: 7:30 AM – 12:30 PM, 4:00 PM – 9:30 PM',
        'Tuesday: 7:30 AM – 12:30 PM, 4:00 PM – 9:30 PM',
        'Wednesday: 7:30 AM – 12:30 PM, 4:00 PM – 9:30 PM',
        'Thursday: 7:30 AM – 12:30 PM, 4:00 PM – 9:30 PM',
        'Friday: 7:30 AM – 12:30 PM, 4:00 PM – 9:30 PM',
        'Saturday: 7:30 AM – 12:30 PM, 4:00 PM – 9:30 PM',
        'Sunday: 7:30 AM – 12:30 PM, 4:00 PM – 9:30 PM',
      ],
    },
    editorialSummary: {
      text: 'Iconic heritage eatery famed for crispy butter benne masala dosa and filter coffee.',
      languageCode: 'en',
    },
    googleMapsUri: 'https://maps.google.com/?cid=1001',
  },
  {
    id: 'ChIJN1t_tDeuEmsRUsoyG83frY4_sample_2',
    name: 'places/ChIJN1t_tDeuEmsRUsoyG83frY4_sample_2',
    displayName: {
      text: 'Malleshwaram 8th Cross Flower Market',
      languageCode: 'en',
    },
    formattedAddress: '8th Cross Rd, Malleshwaram, Bengaluru, Karnataka 560003',
    location: {
      latitude: 13.004120,
      longitude: 77.571430,
    },
    primaryType: 'market',
    types: ['market', 'point_of_interest'],
    rating: 4.4,
    userRatingCount: 5200,
    currentOpeningHours: {
      openNow: true,
      weekdayDescriptions: ['Monday – Sunday: 6:00 AM – 9:00 PM'],
    },
    editorialSummary: {
      text: 'Bustling traditional market filled with fragrant jasmine garlands, fresh marigolds, and local crafts.',
      languageCode: 'en',
    },
    googleMapsUri: 'https://maps.google.com/?cid=1002',
  },
  {
    id: 'ChIJN1t_tDeuEmsRUsoyG83frY4_sample_3',
    name: 'places/ChIJN1t_tDeuEmsRUsoyG83frY4_sample_3',
    displayName: {
      text: 'Kadu Malleshwara Temple',
      languageCode: 'en',
    },
    formattedAddress: 'Temple St, Malleshwaram, Bengaluru, Karnataka 560003',
    location: {
      latitude: 13.007250,
      longitude: 77.571890,
    },
    primaryType: 'hindu_temple',
    types: ['hindu_temple', 'place_of_worship', 'point_of_interest'],
    rating: 4.8,
    userRatingCount: 14890,
    currentOpeningHours: {
      openNow: true,
      weekdayDescriptions: [
        'Monday – Sunday: 6:00 AM – 12:00 PM, 5:30 PM – 9:00 PM',
      ],
    },
    editorialSummary: {
      text: '17th-century Dravidian temple giving the Malleshwaram neighborhood its historic name.',
      languageCode: 'en',
    },
    googleMapsUri: 'https://maps.google.com/?cid=1003',
  },
];
