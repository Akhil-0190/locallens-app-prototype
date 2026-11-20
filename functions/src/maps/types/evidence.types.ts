/**
 * Place Grounding and Verification Evidence Types
 * Developer C - Task C2
 * 
 * Provides structured evidence for Developer B's Authenticity & Tourist Trap Assessment (Task B3)
 * and feeds Developer A's CanonicalPlaceDocument (Domain 06).
 */

import type { NormalizedPlace } from './places.types';
import type { CanonicalPlaceDocument } from '../../types/contracts';

export type PlaceMatchConfidence =
  | 'EXACT_MATCH'       // Direct place ID or name + coordinates <= 50m
  | 'HIGH_CONFIDENCE'   // Name + neighborhood / address match
  | 'AMBIGUOUS_MATCH'   // Multiple candidate places with similar names
  | 'NO_MATCH';         // No place found on Google Maps Platform

export type DiscrepancySeverity = 'INFORMATIONAL' | 'SUSPICIOUS' | 'CRITICAL';

export type DiscrepancyType =
  | 'NAME_MISMATCH'
  | 'LOCATION_DISTANCE_HIGH'
  | 'OPERATING_HOURS_MISMATCH'
  | 'MISSING_HOURS_ON_MAPS'
  | 'CATEGORY_MISMATCH'
  | 'PERMANENTLY_CLOSED'
  | 'TEMPORARILY_CLOSED'
  | 'LOW_REVIEW_DATA'
  | 'EXTREME_REVIEW_VELOCITY';

export interface EvidenceDiscrepancy {
  type: DiscrepancyType;
  severity: DiscrepancySeverity;
  contributedValue?: string;
  mapsValue?: string;
  description: string;
}

export interface TouristTrapSignalsEvidence {
  hasMassTouristReviewCount: boolean; // e.g. > 15,000 reviews with generic ratings
  hasDisproportionateNegativeRatings: boolean; // low rating relative to high volume
  commercialChainDetected: boolean;
  extremePriceLevelDetected: boolean;
  potentialToutingReported: boolean;
  scoreDeductions: {
    reason: string;
    points: number;
  }[];
}

export interface AuthenticitySignalsEvidence {
  isHeritageOrVernacularType: boolean; // e.g. traditional south indian restaurant, temple, historic market
  hasConsistentHighRatingWithModerateVolume: boolean; // e.g. 4.3 - 4.9 rating with 500 - 5,000 reviews
  isLocatedInHistoricQuarterOrAlley: boolean; // pedestrian-accessible pete or heritage lane
  verifiedOperationalHoursMatch: boolean;
  hasLocalResidentSentimentMarkers: boolean;
  scoreAdditions: {
    reason: string;
    points: number;
  }[];
}

export type EvidenceSourceType =
  | 'GOOGLE_PLACES_API_NEW'
  | 'LOCAL_CONTRIBUTOR_SUBMISSION'
  | 'LOCAL_CONTRIBUTOR_EXIF'
  | 'SAMPLE_FIXTURE_DATA';

export interface ContributedPlaceInput {
  spotName: string;
  mapsLink?: string;
  infoParagraph: string;
  photoUrls?: string[];
  audioNoteUrl?: string;
  contributorCoordinate?: {
    latitude: number;
    longitude: number;
  };
  neighborhoodHint?: string;
  claimedHours?: string;
}

export interface PlaceGroundingEvidence {
  evidenceId: string;
  matchConfidence: PlaceMatchConfidence;
  matchScore: number; // 0.0 to 1.0
  matchedPlace: NormalizedPlace | null;
  candidatePlaces: NormalizedPlace[];
  discrepancies: EvidenceDiscrepancy[];
  touristTrapSignals: TouristTrapSignalsEvidence;
  authenticitySignals: AuthenticitySignalsEvidence;
  preliminaryAuthenticityRecommendation: {
    suggestedTrapLikelihood: 'LOW' | 'MODERATE' | 'HIGH' | 'SEVERE';
    preliminaryScore: number; // 0 to 100
    rationale: string;
  };
  sources: {
    source: EvidenceSourceType;
    retrievedAt: string;
    details: string;
  }[];
  isMockData: boolean;
  groundedAt: string; // ISO 8601 UTC
}

export interface GroundedPlaceResult {
  evidence: PlaceGroundingEvidence;
  canonicalPlaceDraft: CanonicalPlaceDocument;
}
