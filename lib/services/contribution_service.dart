import 'dart:async';
import 'package:cloud_firestore/cloud_firestore.dart';
import '../models/contribution.dart';
import '../models/spot_card.dart';

/// Service managing contributor submissions, voice/photo pipelines, and contributor profile.
///
/// COORDINATION BOUNDARY:
/// - Developer A owns live Cloud Storage uploads and Firestore ingestion (Domain 03/04).
/// - Developer B owns live Gemini multimodal extraction (Domain 04).
/// - While A3/B2 are in progress, this service provides labeled mock/sample responses
///   strictly adhering to the agreed A2 TypeScript interfaces.
class ContributionService {
  // FLIP TO FALSE ONCE A3 & B2 ARE DEPLOYED
  static const bool useMockPipeline = true;

  // Contributor profile conforming to Domain 05 (docs/contracts/05-contributor-attribution-verification.md)
  ContributorVerificationProfile _currentProfile = const ContributorVerificationProfile(
    userId: 'usr_blr_782914',
    displayName: 'Aravinth S (Local Resident)',
    contributorTier: 'LOCAL_RESIDENT',
    reputationPoints: 175,
    spotsSubmittedCount: 5,
    spotsApprovedCount: 4,
    accuracyRate: 0.80,
    isVerifiedResident: true,
    neighborhoodOfResidency: 'Malleshwaram',
    earnedBadges: [
      ContributorBadge(
        badgeId: 'NEIGHBORHOOD_INSIDER',
        title: 'Neighborhood Insider',
        description: 'Verified authentic local spots in Malleshwaram',
        awardedAt: '2026-11-01T00:00:00.000Z',
      ),
      ContributorBadge(
        badgeId: 'FILTER_COFFEE_CONNOISSEUR',
        title: 'Filter Coffee Sage',
        description: 'Discovered hidden traditional roast house',
        awardedAt: '2026-11-15T00:00:00.000Z',
      ),
    ],
    totalTipsReceivedInr: 210,
  );

  ContributorVerificationProfile get currentProfile => _currentProfile;

  // In-memory list of recent contributions
  final List<ContributionDocument> _recentContributions = [];
  List<ContributionDocument> get recentContributions =>
      List.unmodifiable(_recentContributions);

  /// Submits a contribution adhering to Domain 03 ContributorSubmissionInput
  Future<ContributionDocument> submitContribution({
    required ContributorSubmissionInput input,
    bool simulateError = false,
  }) async {
    if (simulateError) {
      throw Exception('Network error: Unable to upload media assets to Cloud Storage.');
    }

    final contributionId = 'contrib_gem_${DateTime.now().millisecondsSinceEpoch}';

    if (useMockPipeline) {
      final newDoc = ContributionDocument(
        contributionId: contributionId,
        submission: input,
        status: ContributionStatus.submitted,
        createdAt: DateTime.now(),
        updatedAt: DateTime.now(),
      );
      _recentContributions.insert(0, newDoc);
      return newDoc;
    }

    // Live Firebase Firestore submission (Domain 03)
    final docRef = await FirebaseFirestore.instance.collection('contributions').add({
      'contributionId': contributionId,
      'submission': input.toMap(),
      'status': 'SUBMITTED',
      'groundedPlaceId': null,
      'createdAt': DateTime.now().toIso8601String(),
      'updatedAt': DateTime.now().toIso8601String(),
    });

    final doc = ContributionDocument(
      contributionId: docRef.id,
      submission: input,
      status: ContributionStatus.submitted,
      createdAt: DateTime.now(),
      updatedAt: DateTime.now(),
    );
    _recentContributions.insert(0, doc);
    return doc;
  }

  /// Simulates or queries processing pipeline lifecycle (Domain 03 & 04)
  Stream<ContributionDocument> trackContributionPipeline(ContributionDocument initialDoc) async* {
    yield initialDoc;

    if (!useMockPipeline) {
      // In live integration (A3/B2), listen to Firestore snapshots
      await for (final snapshot in FirebaseFirestore.instance
          .collection('contributions')
          .doc(initialDoc.contributionId)
          .snapshots()) {
        if (!snapshot.exists || snapshot.data() == null) continue;
        final data = snapshot.data()!;
        yield ContributionDocument(
          contributionId: initialDoc.contributionId,
          submission: initialDoc.submission,
          status: ContributionStatusX.fromString(data['status']),
          groundedPlaceId: data['groundedPlaceId'],
          createdAt: initialDoc.createdAt,
          updatedAt: DateTime.tryParse(data['updatedAt'] ?? '') ?? DateTime.now(),
        );
      }
      return;
    }

    // --- MOCK PIPELINE SIMULATION (Adheres to Domain 03/04/05 Contracts) ---
    // Stage 1 -> Stage 2: AI Multimodal Analysis (Developer B)
    await Future.delayed(const Duration(milliseconds: 1400));
    var updated = initialDoc.copyWith(
      status: ContributionStatus.aiAnalyzed,
      updatedAt: DateTime.now(),
    );
    yield updated;

    // Stage 2 -> Stage 3: Google Maps Grounding (Developer C)
    await Future.delayed(const Duration(milliseconds: 1200));
    updated = updated.copyWith(
      status: ContributionStatus.mapsGrounded,
      groundedPlaceId: 'place_blr_${DateTime.now().millisecondsSinceEpoch}',
      updatedAt: DateTime.now(),
    );
    yield updated;

    // Stage 3 -> Stage 4: Verified & Structured Spot Card Generated
    await Future.delayed(const Duration(milliseconds: 1000));
    final generatedSpot = SpotCard(
      id: updated.groundedPlaceId ?? 'spot_${DateTime.now().millisecondsSinceEpoch}',
      mapsLink: initialDoc.submission.mapsLink,
      infoParagraph: initialDoc.submission.infoParagraph,
      photoUrls: initialDoc.submission.photoUrls,
      spotName: 'Grounded Local Discovery (${_currentProfile.neighborhoodOfResidency})',
      openHours: '7:00 AM – 9:30 PM',
      practicalTips: 'Best visited in the morning. Cash and UPI accepted.',
      greetingCard: initialDoc.submission.selectedLanguage == 'kn-IN'
          ? 'Banni, Coffee Kudiyona! (Welcome, let us have coffee!)'
          : initialDoc.submission.selectedLanguage == 'ta-IN'
          ? 'Vanakkam! Vanga, sapudalam!'
          : 'Namaste! Welcome to our local neighborhood!',
      isTouristTrap: false,
      hourlyLimit: 8,
      currentVisitors: 1,
      vibeTags: ['Heritage', 'Street Food', 'Authentic Local'],
      contributedBy: ContributorAttribution(
        userId: _currentProfile.userId,
        displayName: _currentProfile.displayName,
        badgeTitle: 'Neighborhood Insider',
        isVerifiedResident: _currentProfile.isVerifiedResident,
      ),
    );

    updated = updated.copyWith(
      status: ContributionStatus.verified,
      generatedSpotCard: generatedSpot,
      updatedAt: DateTime.now(),
    );

    // Update in recent contributions list
    final index = _recentContributions.indexWhere(
            (c) => c.contributionId == initialDoc.contributionId);
    if (index != -1) {
      _recentContributions[index] = updated;
    }

    // Award reputation points for approved gem
    _currentProfile = ContributorVerificationProfile(
      userId: _currentProfile.userId,
      displayName: _currentProfile.displayName,
      contributorTier: _currentProfile.contributorTier,
      reputationPoints: _currentProfile.reputationPoints + 25,
      spotsSubmittedCount: _currentProfile.spotsSubmittedCount + 1,
      spotsApprovedCount: _currentProfile.spotsApprovedCount + 1,
      accuracyRate: (_currentProfile.spotsApprovedCount + 1) /
          (_currentProfile.spotsSubmittedCount + 1),
      isVerifiedResident: _currentProfile.isVerifiedResident,
      neighborhoodOfResidency: _currentProfile.neighborhoodOfResidency,
      earnedBadges: _currentProfile.earnedBadges,
      totalTipsReceivedInr: _currentProfile.totalTipsReceivedInr,
    );

    yield updated;
  }
}
