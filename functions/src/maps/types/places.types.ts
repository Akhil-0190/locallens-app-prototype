/**
 * Google Places API (New) Types & Normalization Schemas
 * Developer C - Google Maps Platform Integration
 */

import type { LatLng, NormalizedCoordinate } from './coordinates.types';

export interface LocalizedText {
  text: string;
  languageCode: string;
}

export interface PlaceOpeningHoursPeriod {
  open: { day: number; hour: number; minute: number };
  close?: { day: number; hour: number; minute: number };
}

export interface PlaceOpeningHours {
  openNow?: boolean;
  periods?: PlaceOpeningHoursPeriod[];
  weekdayDescriptions?: string[];
}

export interface PlaceAddressComponent {
  longText: string;
  shortText: string;
  types: string[];
  languageCode: string;
}

export interface GooglePlaceNewRaw {
  id: string;
  name?: string; // Resource name format: places/PLACE_ID
  displayName?: LocalizedText;
  formattedAddress?: string;
  addressComponents?: PlaceAddressComponent[];
  location?: LatLng;
  types?: string[];
  primaryType?: string;
  primaryTypeDisplayName?: LocalizedText;
  rating?: number;
  userRatingCount?: number;
  regularOpeningHours?: PlaceOpeningHours;
  currentOpeningHours?: PlaceOpeningHours;
  editorialSummary?: LocalizedText;
  priceLevel?: string;
  websiteUri?: string;
  googleMapsUri?: string;
  utcOffsetMinutes?: number;
}

export interface PlaceSearchTextRequest {
  textQuery: string;
  languageCode?: string;
  maxResultCount?: number;
  locationBias?: {
    circle?: {
      center: LatLng;
      radius: number; // in meters
    };
  };
  locationRestriction?: {
    rectangle?: {
      low: LatLng;
      high: LatLng;
    };
  };
  minRating?: number;
  openNow?: boolean;
  includedType?: string;
  strictTypeFiltering?: boolean;
}

export interface PlaceSearchNearbyRequest {
  locationRestriction: {
    circle: {
      center: LatLng;
      radius: number; // in meters, max 50000
    };
  };
  includedTypes?: string[];
  excludedTypes?: string[];
  maxResultCount?: number;
  rankPreference?: 'DISTANCE' | 'POPULARITY';
  languageCode?: string;
}

export interface PlacesSearchResponse {
  places?: GooglePlaceNewRaw[];
  nextPageToken?: string;
}

/**
 * Canonical Normalized Place Model proposed for cross-team coordination (Developer A & D)
 */
export interface NormalizedPlace {
  placeId: string;
  name: string;
  formattedAddress: string;
  coordinate: NormalizedCoordinate;
  primaryCategory: string;
  categories: string[];
  rating: number;
  reviewCount: number;
  isOpenNow: boolean | null;
  openingHoursDescriptions: string[];
  summary: string;
  mapsUrl: string;
  isMockData: boolean;
  lastVerifiedAt: string; // ISO 8601
}
