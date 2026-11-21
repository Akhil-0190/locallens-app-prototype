import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import { GroundingService } from '../services/grounding.service';
import { PlacesService } from '../services/places.service';
import { SAMPLE_PLACES_FIXTURE } from '../fixtures/sample-places.fixture';
import { validateCanonicalPlace } from '../../types/contracts';

describe('GroundingService', () => {
  it('should ground a contributed spot using place name and neighborhood hint', async () => {
    const placesService = new PlacesService({ apiKey: '', allowMockFallback: true });
    const groundingService = new GroundingService({}, placesService);

    const result = await groundingService.groundContributedPlace({
      spotName: 'CTR Shri Sagar',
      neighborhoodHint: 'Malleshwaram',
      infoParagraph: 'Iconic heritage eatery famous for butter benne dosas and filter coffee in historic Malleshwaram.',
      contributorCoordinate: {
        latitude: 13.003185,
        longitude: 77.570258,
      },
      claimedHours: '7:30 AM – 9:30 PM',
    });

    assert.ok(result.evidence);
    assert.ok(result.canonicalPlaceDraft);
    assert.strictEqual(result.evidence.isMockData, true);
    assert.ok(
      result.evidence.matchConfidence === 'EXACT_MATCH' ||
        result.evidence.matchConfidence === 'HIGH_CONFIDENCE'
    );
    assert.ok(result.evidence.matchScore >= 0.8);
    assert.strictEqual(result.evidence.matchedPlace?.name, 'CTR Shri Sagar (Malleshwaram)');
    assert.strictEqual(result.evidence.authenticitySignals.isHeritageOrVernacularType, true);
    assert.strictEqual(result.evidence.authenticitySignals.isLocatedInHistoricQuarterOrAlley, true);
    assert.strictEqual(result.evidence.preliminaryAuthenticityRecommendation.suggestedTrapLikelihood, 'LOW');
    assert.ok(result.evidence.preliminaryAuthenticityRecommendation.preliminaryScore >= 80);
  });

  it('should detect location distance and operating hours discrepancies', async () => {
    const placesService = new PlacesService({ apiKey: '', allowMockFallback: true });
    const groundingService = new GroundingService({}, placesService);

    // Contributed spot with coordinates ~500m away and conflicting hours
    const result = await groundingService.groundContributedPlace({
      spotName: 'CTR Shri Sagar',
      neighborhoodHint: 'Malleshwaram',
      infoParagraph: 'Food stall near the corner.',
      contributorCoordinate: {
        latitude: 13.00725, // ~480m north near Kadu Malleshwara
        longitude: 77.57189,
      },
      claimedHours: 'Open till late night 1:00 AM',
    });

    assert.ok(result.evidence.discrepancies.length >= 1);
    const distDiscrepancy = result.evidence.discrepancies.find(
      (d) => d.type === 'LOCATION_DISTANCE_HIGH'
    );
    assert.ok(distDiscrepancy);
    assert.strictEqual(distDiscrepancy.severity, 'INFORMATIONAL'); // ~480m is < 500m
  });

  it('should flag severe distance discrepancy (> 500m) as SUSPICIOUS', async () => {
    const placesService = new PlacesService({ apiKey: '', allowMockFallback: true });
    const groundingService = new GroundingService({}, placesService);

    const result = await groundingService.groundContributedPlace({
      spotName: 'CTR Shri Sagar',
      neighborhoodHint: 'Malleshwaram',
      infoParagraph: 'A breakfast stall.',
      contributorCoordinate: {
        latitude: 12.9716, // In Majestic / Central Bengaluru (> 3.5 km away)
        longitude: 77.5946,
      },
    });

    const severeDist = result.evidence.discrepancies.find(
      (d) => d.type === 'LOCATION_DISTANCE_HIGH' && d.severity === 'SUSPICIOUS'
    );
    assert.ok(severeDist, 'Should detect suspicious coordinate discrepancy for distance > 500m');
    assert.ok(result.evidence.touristTrapSignals.scoreDeductions.length > 0);
  });

  it('should produce a canonical place document draft that strictly validates against A2 contracts', async () => {
    const placesService = new PlacesService({ apiKey: '', allowMockFallback: true });
    const groundingService = new GroundingService({}, placesService);

    const result = await groundingService.groundContributedPlace({
      spotName: 'Kadu Malleshwara Temple',
      neighborhoodHint: 'Malleshwaram',
      infoParagraph: '17th-century Dravidian temple giving Malleshwaram its name.',
      contributorCoordinate: {
        latitude: 13.00725,
        longitude: 77.57189,
      },
      photoUrls: ['https://storage.googleapis.com/test-bucket/temple.jpg'],
    });

    // Validate using A2's canonical Zod validator
    const validated = validateCanonicalPlace(result.canonicalPlaceDraft);
    assert.ok(validated);
    assert.strictEqual(validated.spotName, 'Kadu Malleshwara Temple');
    assert.strictEqual(validated.coordinate.isValid, true);
    assert.strictEqual(validated.capacity.hourlyLimit, 12);
    assert.strictEqual(validated.capacity.crowdLevel, 'LOW');
    assert.strictEqual(validated.authenticity.isTouristTrap, false);
    assert.ok(validated.authenticity.authenticityScore >= 70);
  });

  it('should extract direct place ID from Google Maps URL if present', async () => {
    const placesService = new PlacesService({ apiKey: '', allowMockFallback: true });
    const groundingService = new GroundingService({}, placesService);
    const sampleId = SAMPLE_PLACES_FIXTURE[1]!.id;

    const result = await groundingService.groundContributedPlace({
      spotName: 'Flower Market',
      mapsLink: `https://maps.google.com/search?query=Flower+Market&query_place_id=${sampleId}`,
      infoParagraph: 'Traditional flower market filled with marigold garlands.',
    });

    assert.strictEqual(result.evidence.matchConfidence, 'EXACT_MATCH');
    assert.strictEqual(result.evidence.matchedPlace?.placeId, sampleId);
    assert.strictEqual(result.evidence.matchedPlace?.name, 'Malleshwaram 8th Cross Flower Market');
  });

  it('should label data provenance truthfully as MAPS_GROUNDED and COMMUNITY_VERIFIED', async () => {
    const placesService = new PlacesService({ apiKey: '', allowMockFallback: true });
    const groundingService = new GroundingService({}, placesService);

    const result = await groundingService.groundContributedPlace({
      spotName: 'CTR Shri Sagar',
      neighborhoodHint: 'Malleshwaram',
      infoParagraph: 'Iconic heritage eatery.',
    });

    assert.ok(result.evidence.provenanceLabel);
    assert.ok(result.evidence.provenanceNote);
    assert.ok(
      result.evidence.provenanceNote.includes('Google Crowdsource lacks a public API')
    );

    // Verify truthful source attribution tags
    const sources = result.evidence.sources.map((s) => s.source);
    assert.ok(sources.includes('MAPS_GROUNDED'));
    assert.ok(sources.includes('COMMUNITY_VERIFIED'));
  });
});
