/**
 * Sample Evidence Fixtures for Place Grounding
 * Developer C - Task C2
 * 
 * Clearly labeled mock/sample fixtures for testing and fallback evaluation.
 */

import { PlaceGroundingEvidence } from '../../types/evidence.types';
import { SAMPLE_PLACES_FIXTURE } from './sample-places.fixture';
import { NormalizationService } from '../../services/normalization.service';

const ctrPlace = NormalizationService.normalizePlace(SAMPLE_PLACES_FIXTURE[0], true);

export const SAMPLE_HIGH_CONFIDENCE_EVIDENCE: PlaceGroundingEvidence = {
  evidenceId: 'evidence_ctr_sample_001',
  matchConfidence: 'EXACT_MATCH',
  matchScore: 0.98,
  matchedPlace: ctrPlace,
  candidatePlaces: [ctrPlace],
  discrepancies: [],
  touristTrapSignals: {
    hasMassTouristReviewCount: false,
    hasDisproportionateNegativeRatings: false,
    commercialChainDetected: false,
    extremePriceLevelDetected: false,
    potentialToutingReported: false,
    scoreDeductions: [],
  },
  authenticitySignals: {
    isHeritageOrVernacularType: true,
    hasConsistentHighRatingWithModerateVolume: true,
    isLocatedInHistoricQuarterOrAlley: true,
    verifiedOperationalHoursMatch: true,
    hasLocalResidentSentimentMarkers: true,
    scoreAdditions: [
      { reason: 'Generational heritage restaurant established in Malleshwaram', points: 30 },
      { reason: 'Consistent 4.6 rating with verified resident patron reviews', points: 25 },
      { reason: 'Located on historic 7th Cross residential/cultural corridor', points: 20 },
      { reason: 'Traditional benne dosa recipe with zero commercial franchise expansion', points: 17 },
    ],
  },
  preliminaryAuthenticityRecommendation: {
    suggestedTrapLikelihood: 'LOW',
    preliminaryScore: 92,
    rationale: 'Deeply authentic local institution with verifiable heritage credentials and genuine neighborhood resident patronage.',
  },
  sources: [
    {
      source: 'GOOGLE_PLACES_API_NEW',
      retrievedAt: new Date().toISOString(),
      details: 'Google Place Details for CTR Shri Sagar (ChIJ82NqvCUWrjsRC33A4yTYQWk)',
    },
    {
      source: 'LOCAL_CONTRIBUTOR_SUBMISSION',
      retrievedAt: new Date().toISOString(),
      details: 'Local resident voice memo and photo submission',
    },
  ],
  isMockData: true,
  groundedAt: new Date().toISOString(),
};

export const SAMPLE_DISCREPANCY_EVIDENCE: PlaceGroundingEvidence = {
  evidenceId: 'evidence_discrepancy_sample_002',
  matchConfidence: 'AMBIGUOUS_MATCH',
  matchScore: 0.55,
  matchedPlace: ctrPlace,
  candidatePlaces: [ctrPlace],
  discrepancies: [
    {
      type: 'LOCATION_DISTANCE_HIGH',
      severity: 'SUSPICIOUS',
      contributedValue: '13.007250, 77.571890',
      mapsValue: '13.003185, 77.570258',
      description: 'Contributed coordinates are 480 meters away from the matched Google Place location.',
    },
    {
      type: 'OPERATING_HOURS_MISMATCH',
      severity: 'INFORMATIONAL',
      contributedValue: 'Open till 11:30 PM',
      mapsValue: 'Closes at 9:30 PM',
      description: 'Contributor claims late night operations, but verified Google Places hours indicate closing at 9:30 PM.',
    },
  ],
  touristTrapSignals: {
    hasMassTouristReviewCount: false,
    hasDisproportionateNegativeRatings: false,
    commercialChainDetected: false,
    extremePriceLevelDetected: false,
    potentialToutingReported: false,
    scoreDeductions: [
      { reason: 'Operating hours claim conflicts with verified closing time', points: -15 },
      { reason: 'Moderate spatial distance discrepancy between submission fix and venue', points: -15 },
    ],
  },
  authenticitySignals: {
    isHeritageOrVernacularType: true,
    hasConsistentHighRatingWithModerateVolume: false,
    isLocatedInHistoricQuarterOrAlley: true,
    verifiedOperationalHoursMatch: false,
    hasLocalResidentSentimentMarkers: true,
    scoreAdditions: [
      { reason: 'Located in historic Malleshwaram quarter', points: 15 },
    ],
  },
  preliminaryAuthenticityRecommendation: {
    suggestedTrapLikelihood: 'MODERATE',
    preliminaryScore: 52,
    rationale: 'Uncertain match due to 480m spatial discrepancy and conflicting hours. Requires AI or community review.',
  },
  sources: [
    {
      source: 'SAMPLE_FIXTURE_DATA',
      retrievedAt: new Date().toISOString(),
      details: 'Simulated discrepancy fixture for unit testing and fallback',
    },
  ],
  isMockData: true,
  groundedAt: new Date().toISOString(),
};
