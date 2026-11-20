/**
 * Place Grounding & Verification Evidence Service
 * Developer C - Task C2
 * 
 * Grounds contributed spots against Google Maps Platform (Places API New),
 * detects data discrepancies, synthesizes evidence for Developer B's authenticity assessment,
 * and drafts CanonicalPlaceDocument structures adhering to A2 contracts.
 */

import { getMapsConfig, type MapsPlatformConfig } from '../config';
import { NormalizedPlace } from '../types/places.types';
import {
  ContributedPlaceInput,
  EvidenceDiscrepancy,
  GroundedPlaceResult,
  PlaceGroundingEvidence,
  PlaceMatchConfidence,
  TouristTrapSignalsEvidence,
  AuthenticitySignalsEvidence,
} from '../types/evidence.types';
import { CanonicalPlaceDocument } from '../../types/contracts';
import { PlacesService } from './places.service';
import { NormalizationService } from './normalization.service';
import { MapsUrlParserService } from './url-parser.service';
import { SAMPLE_PLACES_FIXTURE } from '../fixtures/sample-places.fixture';

export class GroundingService {
  private placesService: PlacesService;
  private config: MapsPlatformConfig;

  constructor(customConfig?: Partial<MapsPlatformConfig>, placesService?: PlacesService) {
    this.config = { ...getMapsConfig(), ...customConfig };
    this.placesService = placesService || new PlacesService(this.config);
  }

  /**
   * Grounds a contributed place against Google Maps Platform and generates verification evidence.
   */
  public async groundContributedPlace(
    input: ContributedPlaceInput
  ): Promise<GroundedPlaceResult> {
    const { match, candidates, confidence, score } = await this.matchPlace(input);
    const discrepancies = this.detectDiscrepancies(input, match);
    const touristTrapSignals = this.evaluateTouristTrapSignals(match, discrepancies);
    const authenticitySignals = this.evaluateAuthenticitySignals(match, discrepancies, input);

    // Compute preliminary authenticity score (base 50 + additions + deductions)
    let preliminaryScore = 50;
    authenticitySignals.scoreAdditions.forEach((add) => (preliminaryScore += add.points));
    touristTrapSignals.scoreDeductions.forEach((ded) => (preliminaryScore += ded.points));
    preliminaryScore = Math.max(0, Math.min(100, Math.round(preliminaryScore)));

    let suggestedTrapLikelihood: 'LOW' | 'MODERATE' | 'HIGH' | 'SEVERE' = 'LOW';
    if (preliminaryScore < 30 || touristTrapSignals.commercialChainDetected) {
      suggestedTrapLikelihood = 'HIGH';
    } else if (preliminaryScore < 60 || discrepancies.some((d) => d.severity === 'SUSPICIOUS')) {
      suggestedTrapLikelihood = 'MODERATE';
    }

    const isMock = match ? match.isMockData : true;
    const nowIso = new Date().toISOString();

    const evidence: PlaceGroundingEvidence = {
      evidenceId: `evidence_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      matchConfidence: confidence,
      matchScore: score,
      matchedPlace: match,
      candidatePlaces: candidates,
      discrepancies,
      touristTrapSignals,
      authenticitySignals,
      preliminaryAuthenticityRecommendation: {
        suggestedTrapLikelihood,
        preliminaryScore,
        rationale: this.synthesizeRationale(confidence, match, discrepancies, preliminaryScore),
      },
      sources: [
        {
          source: isMock ? 'SAMPLE_FIXTURE_DATA' : 'GOOGLE_PLACES_API_NEW',
          retrievedAt: nowIso,
          details: match
            ? `Google Place: ${match.name} (${match.placeId})`
            : 'No matching Google Place identified',
        },
        {
          source: 'LOCAL_CONTRIBUTOR_SUBMISSION',
          retrievedAt: nowIso,
          details: `Contributed spot: "${input.spotName}" by local resident`,
        },
      ],
      isMockData: isMock,
      groundedAt: nowIso,
    };

    const canonicalPlaceDraft = this.buildCanonicalPlaceDraft(input, evidence);

    return {
      evidence,
      canonicalPlaceDraft,
    };
  }

  /**
   * Matches a contributed place to Google Maps Places API (New) candidates.
   */
  public async matchPlace(input: ContributedPlaceInput): Promise<{
    match: NormalizedPlace | null;
    candidates: NormalizedPlace[];
    confidence: PlaceMatchConfidence;
    score: number;
  }> {
    const parsedUrl = input.mapsLink ? MapsUrlParserService.parse(input.mapsLink) : null;

    // 1. Direct Place ID lookup if extracted from URL
    if (parsedUrl?.placeId) {
      try {
        const directPlace = await this.placesService.getPlaceDetails(parsedUrl.placeId);
        if (directPlace) {
          return {
            match: directPlace,
            candidates: [directPlace],
            confidence: 'EXACT_MATCH',
            score: 0.99,
          };
        }
      } catch {
        // Fall back to search
      }
    }

    // 2. Text Search using place name + neighborhood hint
    const searchTerms = [
      input.spotName,
      parsedUrl?.query,
      input.neighborhoodHint || 'Bengaluru',
    ]
      .filter(Boolean)
      .join(' ');

    let candidates: NormalizedPlace[] = [];
    try {
      candidates = await this.placesService.searchText({
        textQuery: searchTerms,
        locationBias: input.contributorCoordinate
          ? {
              circle: {
                center: input.contributorCoordinate,
                radius: 1000,
              },
            }
          : undefined,
      });
    } catch {
      // If live API unavailable, use mock candidates
      candidates = SAMPLE_PLACES_FIXTURE.map((p) =>
        NormalizationService.normalizePlace(p, true)
      );
    }

    if (candidates.length === 0) {
      return {
        match: null,
        candidates: [],
        confidence: 'NO_MATCH',
        score: 0.0,
      };
    }

    // 3. Score candidates against contributed input
    const bestMatch = candidates[0]!;
    const nameSimilarity = this.calculateNameSimilarity(input.spotName, bestMatch.name);

    let distanceMeters = 0;
    if (input.contributorCoordinate && bestMatch.coordinate.isValid) {
      const dist = NormalizationService.calculateDistance(
        input.contributorCoordinate,
        bestMatch.coordinate
      );
      distanceMeters = dist.meters;
    }

    let confidence: PlaceMatchConfidence = 'HIGH_CONFIDENCE';
    let score = nameSimilarity;

    if (nameSimilarity > 0.85 && distanceMeters <= 50) {
      confidence = 'EXACT_MATCH';
      score = 0.95;
    } else if (nameSimilarity > 0.6 && distanceMeters <= 300) {
      confidence = 'HIGH_CONFIDENCE';
      score = 0.85;
    } else if (candidates.length > 1 && nameSimilarity < 0.5) {
      confidence = 'AMBIGUOUS_MATCH';
      score = 0.5;
    } else if (nameSimilarity < 0.3 && distanceMeters > 1000) {
      confidence = 'NO_MATCH';
      score = 0.2;
    }

    return {
      match: confidence !== 'NO_MATCH' ? bestMatch : null,
      candidates,
      confidence,
      score,
    };
  }

  /**
   * Detects discrepancies between contributor claims and Google Maps facts.
   */
  public detectDiscrepancies(
    input: ContributedPlaceInput,
    matched: NormalizedPlace | null
  ): EvidenceDiscrepancy[] {
    const discrepancies: EvidenceDiscrepancy[] = [];

    if (!matched) {
      discrepancies.push({
        type: 'NAME_MISMATCH',
        severity: 'CRITICAL',
        contributedValue: input.spotName,
        mapsValue: undefined,
        description: `Could not identify any real place on Google Maps matching "${input.spotName}".`,
      });
      return discrepancies;
    }

    // Check name similarity
    const sim = this.calculateNameSimilarity(input.spotName, matched.name);
    if (sim < 0.6) {
      discrepancies.push({
        type: 'NAME_MISMATCH',
        severity: 'INFORMATIONAL',
        contributedValue: input.spotName,
        mapsValue: matched.name,
        description: `Contributed name "${input.spotName}" differs from Google Maps official name "${matched.name}".`,
      });
    }

    // Check distance discrepancy (> 200m)
    if (input.contributorCoordinate && matched.coordinate.isValid) {
      const dist = NormalizationService.calculateDistance(
        input.contributorCoordinate,
        matched.coordinate
      );
      if (dist.meters > 500) {
        discrepancies.push({
          type: 'LOCATION_DISTANCE_HIGH',
          severity: 'SUSPICIOUS',
          contributedValue: `${input.contributorCoordinate.latitude}, ${input.contributorCoordinate.longitude}`,
          mapsValue: matched.coordinate.formatted,
          description: `Contributed coordinates are ${dist.formattedMeters} away from verified Google Place location.`,
        });
      } else if (dist.meters > 200) {
        discrepancies.push({
          type: 'LOCATION_DISTANCE_HIGH',
          severity: 'INFORMATIONAL',
          contributedValue: `${input.contributorCoordinate.latitude}, ${input.contributorCoordinate.longitude}`,
          mapsValue: matched.coordinate.formatted,
          description: `Minor coordinate variation: venue is ${dist.formattedMeters} from contributor position.`,
        });
      }
    }

    // Check opening hours
    if (matched.openingHoursDescriptions.length === 0) {
      discrepancies.push({
        type: 'MISSING_HOURS_ON_MAPS',
        severity: 'INFORMATIONAL',
        description: 'Google Maps does not have verified weekly operating hours for this establishment.',
      });
    } else if (input.claimedHours) {
      // Check for obvious conflict
      const hasLateNightClaim = input.claimedHours.toLowerCase().includes('late');
      const allCloseEarly = matched.openingHoursDescriptions.every(
        (desc) => desc.includes('9:00 PM') || desc.includes('9:30 PM') || desc.includes('8:00 PM')
      );
      if (hasLateNightClaim && allCloseEarly) {
        discrepancies.push({
          type: 'OPERATING_HOURS_MISMATCH',
          severity: 'INFORMATIONAL',
          contributedValue: input.claimedHours,
          mapsValue: matched.openingHoursDescriptions[0],
          description: `Contributor claimed late night availability, but Maps lists earlier closing hours.`,
        });
      }
    }

    // Check low review count
    if (matched.reviewCount < 10) {
      discrepancies.push({
        type: 'LOW_REVIEW_DATA',
        severity: 'INFORMATIONAL',
        mapsValue: `${matched.reviewCount} reviews`,
        description: 'Very few Google Maps reviews available. Spot may be newly opened or unverified.',
      });
    }

    return discrepancies;
  }

  /**
   * Evaluates signals indicating a potential commercialized tourist trap.
   */
  public evaluateTouristTrapSignals(
    matched: NormalizedPlace | null,
    discrepancies: EvidenceDiscrepancy[]
  ): TouristTrapSignalsEvidence {
    if (!matched) {
      return {
        hasMassTouristReviewCount: false,
        hasDisproportionateNegativeRatings: false,
        commercialChainDetected: false,
        extremePriceLevelDetected: false,
        potentialToutingReported: false,
        scoreDeductions: [],
      };
    }

    const scoreDeductions: { reason: string; points: number }[] = [];
    const isMassCount = matched.reviewCount > 15000;
    const hasLowRatingForHighCount = matched.reviewCount > 5000 && matched.rating < 3.8;

    if (hasLowRatingForHighCount) {
      scoreDeductions.push({
        reason: 'Low rating (under 3.8) despite very high review volume',
        points: -25,
      });
    }

    // Commercial chain / franchise keywords in category
    const commercialTypes = ['shopping_mall', 'department_store', 'fast_food_restaurant'];
    const isCommercial = matched.categories.some((c) => commercialTypes.includes(c));
    if (isCommercial) {
      scoreDeductions.push({
        reason: 'Category matches commercial chain / shopping mall type',
        points: -30,
      });
    }

    // Check for critical discrepancies
    if (discrepancies.some((d) => d.severity === 'SUSPICIOUS')) {
      scoreDeductions.push({
        reason: 'Suspicious coordinate or operational discrepancy detected',
        points: -15,
      });
    }

    return {
      hasMassTouristReviewCount: isMassCount,
      hasDisproportionateNegativeRatings: hasLowRatingForHighCount,
      commercialChainDetected: isCommercial,
      extremePriceLevelDetected: false,
      potentialToutingReported: false,
      scoreDeductions,
    };
  }

  /**
   * Evaluates signals confirming genuine local neighborhood authenticity.
   */
  public evaluateAuthenticitySignals(
    matched: NormalizedPlace | null,
    discrepancies: EvidenceDiscrepancy[],
    input: ContributedPlaceInput
  ): AuthenticitySignalsEvidence {
    if (!matched) {
      return {
        isHeritageOrVernacularType: false,
        hasConsistentHighRatingWithModerateVolume: false,
        isLocatedInHistoricQuarterOrAlley: false,
        verifiedOperationalHoursMatch: false,
        hasLocalResidentSentimentMarkers: false,
        scoreAdditions: [],
      };
    }

    const scoreAdditions: { reason: string; points: number }[] = [];

    // Heritage / local food categories
    const heritageTypes = [
      'south_indian_restaurant',
      'indian_restaurant',
      'hindu_temple',
      'place_of_worship',
      'market',
      'bakery',
      'coffee_shop',
    ];
    const isHeritage = matched.categories.some((c) => heritageTypes.includes(c));
    if (isHeritage) {
      scoreAdditions.push({
        reason: 'Traditional regional establishment category',
        points: 20,
      });
    }

    // High rating with moderate volume (classic authentic gem profile)
    const isAuthenticRatingBand =
      matched.rating >= 4.2 && matched.reviewCount >= 100 && matched.reviewCount <= 40000;
    if (isAuthenticRatingBand) {
      scoreAdditions.push({
        reason: `Strong verified rating (${matched.rating}) with authentic patron volume`,
        points: 25,
      });
    }

    // Located in historic quarter (e.g. Malleshwaram, Basavanagudi, Chickpet)
    const historicKeywords = ['malleshwaram', 'basavanagudi', 'chickpet', 'gandhi bazaar'];
    const isHistoricQuarter = historicKeywords.some((q) =>
      matched.formattedAddress.toLowerCase().includes(q)
    );
    if (isHistoricQuarter) {
      scoreAdditions.push({
        reason: 'Located within historic cultural quarter',
        points: 15,
      });
    }

    // Contributor narrative length and depth
    if (input.infoParagraph && input.infoParagraph.length > 50) {
      scoreAdditions.push({
        reason: 'Detailed local resident narrative provided',
        points: 10,
      });
    }

    return {
      isHeritageOrVernacularType: isHeritage,
      hasConsistentHighRatingWithModerateVolume: isAuthenticRatingBand,
      isLocatedInHistoricQuarterOrAlley: isHistoricQuarter,
      verifiedOperationalHoursMatch: matched.openingHoursDescriptions.length > 0,
      hasLocalResidentSentimentMarkers: true,
      scoreAdditions,
    };
  }

  /**
   * Drafts a CanonicalPlaceDocument adhering strictly to A2's Domain 06 contract.
   */
  public buildCanonicalPlaceDraft(
    input: ContributedPlaceInput,
    evidence: PlaceGroundingEvidence
  ): CanonicalPlaceDocument {
    const matched = evidence.matchedPlace;
    const nowIso = new Date().toISOString();

    const placeId = matched?.placeId || `gem_${Date.now()}`;
    const spotName = matched?.name || input.spotName;
    const formattedAddress = matched?.formattedAddress || 'Address unconfirmed on Maps';
    const coordinate = matched?.coordinate || {
      latitude: input.contributorCoordinate?.latitude || 0,
      longitude: input.contributorCoordinate?.longitude || 0,
      precision: 6,
      formatted: `${input.contributorCoordinate?.latitude || 0}, ${input.contributorCoordinate?.longitude || 0}`,
      isValid: Boolean(input.contributorCoordinate),
    };

    const openHours =
      matched?.openingHoursDescriptions?.join('; ') || 'Check Maps for hours';

    return {
      id: placeId,
      placeId,
      spotName,
      formattedAddress,
      coordinate,
      mapsLink:
        matched?.mapsUrl ||
        input.mapsLink ||
        `https://maps.google.com/?q=${encodeURIComponent(spotName)}`,
      primaryCategory: matched?.primaryCategory || 'point_of_interest',
      categories: matched?.categories || ['point_of_interest'],
      infoParagraph: input.infoParagraph,
      photoUrls: input.photoUrls || [],
      openHours,
      isOpenNow: matched?.isOpenNow ?? null,
      authenticity: {
        authenticityScore: evidence.preliminaryAuthenticityRecommendation.preliminaryScore,
        touristTrapLikelihood:
          evidence.preliminaryAuthenticityRecommendation.suggestedTrapLikelihood,
        isTouristTrap:
          evidence.preliminaryAuthenticityRecommendation.suggestedTrapLikelihood === 'HIGH' ||
          evidence.preliminaryAuthenticityRecommendation.suggestedTrapLikelihood === 'SEVERE',
        localSentimentSummary: `Grounded against Google Maps: ${matched?.name || spotName}. ${evidence.preliminaryAuthenticityRecommendation.rationale}`,
        recommendedTiming: 'Morning or early evening for uncrowded visits',
        practicalTips: 'Locals recommend arriving early; check opening hours.',
        greetingCard: `Welcome to ${spotName}! A cherished local gem.`,
        vibeTags: matched?.categories?.slice(0, 3) || ['authentic', 'local'],
      },
      capacity: {
        hourlyLimit: 12,
        currentVisitors: 0,
        remainingCapacity: 12,
        crowdLevel: 'LOW',
        isThrottled: false,
        lastUpdatedSlot: `${nowIso.substring(0, 13)}:00:00Z`,
      },
      isVerified: evidence.matchConfidence === 'EXACT_MATCH' || evidence.matchConfidence === 'HIGH_CONFIDENCE',
      isMockData: evidence.isMockData,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
  }

  private calculateNameSimilarity(str1: string, str2: string): number {
    const s1 = (str1 || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const s2 = (str2 || '').toLowerCase().replace(/[^a-z0-9]/g, '');

    if (!s1 || !s2) return 0;
    if (s1 === s2) return 1.0;
    if (s1.includes(s2) || s2.includes(s1)) return 0.85;

    // Word intersection score
    const w1 = (str1 || '').toLowerCase().split(/\s+/).filter(Boolean);
    const w2 = (str2 || '').toLowerCase().split(/\s+/).filter(Boolean);
    const common = w1.filter((w) => w2.includes(w));
    return (2 * common.length) / (w1.length + w2.length);
  }

  private synthesizeRationale(
    confidence: PlaceMatchConfidence,
    match: NormalizedPlace | null,
    discrepancies: EvidenceDiscrepancy[],
    score: number
  ): string {
    if (!match) {
      return 'Place could not be verified on Google Maps Platform. Manual verification recommended.';
    }
    const discCount = discrepancies.length;
    if (confidence === 'EXACT_MATCH' && discCount === 0) {
      return `Exact match with ${match.name}. Verified active venue with zero discrepancies (Score: ${score}/100).`;
    }
    if (discCount > 0) {
      const topDesc = discrepancies[0]!.description;
      return `Matched with ${match.name} with ${discCount} noted discrepancy: ${topDesc}`;
    }
    return `Grounded against ${match.name} with ${confidence} confidence (Score: ${score}/100).`;
  }
}
