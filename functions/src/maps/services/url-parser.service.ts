/**
 * Google Maps URL Parser Service
 * Developer C - Task C2
 * 
 * Safely parses contributor-submitted Google Maps URLs to extract Place IDs,
 * coordinates, or query search strings without fabricating details.
 */

import { LatLng } from '../types/coordinates.types';

export interface ParsedMapsUrlResult {
  rawUrl: string;
  placeId?: string;
  cid?: string;
  coordinates?: LatLng;
  query?: string;
  isShortLink: boolean;
  isValidMapsUrl: boolean;
}

export class MapsUrlParserService {
  /**
   * Parses a Google Maps URL or search string.
   */
  public static parse(urlOrQuery: string): ParsedMapsUrlResult {
    const trimmed = (urlOrQuery || '').trim();
    if (!trimmed) {
      return { rawUrl: '', isShortLink: false, isValidMapsUrl: false };
    }

    const isShortLink =
      trimmed.includes('maps.app.goo.gl') || trimmed.includes('goo.gl/maps');

    const result: ParsedMapsUrlResult = {
      rawUrl: trimmed,
      isShortLink,
      isValidMapsUrl:
        trimmed.includes('google.com/maps') ||
        trimmed.includes('maps.google') ||
        isShortLink,
    };

    // 1. Direct Place ID query parameter (e.g. ?query_place_id=ChIJ...)
    const placeIdParam = trimmed.match(/[?&]query_place_id=([^&]+)/);
    if (placeIdParam && placeIdParam[1]) {
      result.placeId = decodeURIComponent(placeIdParam[1]);
    }

    // 2. CID parameter (e.g. ?cid=1001 or &cid=1234567890)
    const cidParam = trimmed.match(/[?&]cid=([^&]+)/);
    if (cidParam && cidParam[1]) {
      result.cid = decodeURIComponent(cidParam[1]);
    }

    // 3. Coordinate extraction from @lat,lng,zoom (e.g. /@12.998233,77.569539,17z)
    const atCoordMatch = trimmed.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (atCoordMatch && atCoordMatch[1] && atCoordMatch[2]) {
      result.coordinates = {
        latitude: parseFloat(atCoordMatch[1]),
        longitude: parseFloat(atCoordMatch[2]),
      };
    }

    // 4. Coordinate extraction from query params (e.g. ?query=12.998233,77.569539 or ?q=12.998233,77.569539)
    const queryCoordMatch = trimmed.match(/[?&](?:query|q)=(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (queryCoordMatch && queryCoordMatch[1] && queryCoordMatch[2]) {
      result.coordinates = {
        latitude: parseFloat(queryCoordMatch[1]),
        longitude: parseFloat(queryCoordMatch[2]),
      };
    }

    // 5. Place name from URL path (/place/Central+Tiffin+Room/@...)
    const placePathMatch = trimmed.match(/\/place\/([^/@]+)/);
    if (placePathMatch && placePathMatch[1]) {
      result.query = decodeURIComponent(placePathMatch[1].replace(/\+/g, ' '));
    } else {
      // Query param text (e.g. ?query=CTR+Malleshwaram)
      const queryTextMatch = trimmed.match(/[?&](?:query|q)=([^&]+)/);
      if (queryTextMatch && queryTextMatch[1] && !result.coordinates) {
        result.query = decodeURIComponent(queryTextMatch[1].replace(/\+/g, ' '));
      }
    }

    return result;
  }
}
