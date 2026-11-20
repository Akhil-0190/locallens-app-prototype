/**
 * Contributor Profile & Public Attribution Service
 * Task A5 — Contributor Ecosystem & Monetization Backend
 *
 * Manages contributor tier progressions, badge awards, approved spot tallies,
 * and public attribution profiles. Strictly isolates public attribution from
 * private payment ledgers.
 */

import { db } from '../../config/firebase.js';
import {
  ContributorVerificationProfile,
  ContributorVerificationProfileSchema,
  ContributorTier,
} from '../../types/contracts/index.js';

export interface ContributorAttribution {
  userId: string;
  contributorTier: ContributorTier;
  reputationPoints: number;
  spotsApprovedCount: number;
  accuracyRate: number;
  earnedBadges: {
    badgeId: string;
    title: string;
    description: string;
    awardedAt: string;
  }[];
}

export class ContributorProfileService {
  /**
   * Retrieves public contributor attribution profile.
   */
  public async getContributorAttribution(userId: string): Promise<ContributorAttribution> {
    const profileRef = db.collection('users').doc(userId).collection('contributor_profile').doc('public');
    const snap = await profileRef.get();

    if (!snap.exists) {
      return {
        userId,
        contributorTier: 'LOCAL_RESIDENT',
        reputationPoints: 0,
        spotsApprovedCount: 0,
        accuracyRate: 1.0,
        earnedBadges: [],
      };
    }

    const data = snap.data() as ContributorVerificationProfile;
    return {
      userId: data.userId,
      contributorTier: data.contributorTier,
      reputationPoints: data.reputationPoints,
      spotsApprovedCount: data.spotsApprovedCount,
      accuracyRate: data.accuracyRate,
      earnedBadges: data.earnedBadges,
    };
  }

  /**
   * Updates contributor profile when a gem is approved by moderator or AI.
   */
  public async recordApprovedContribution(userId: string): Promise<ContributorVerificationProfile> {
    const profileRef = db.collection('users').doc(userId).collection('contributor_profile').doc('public');
    const snap = await profileRef.get();

    let profile: ContributorVerificationProfile;
    const now = new Date().toISOString();

    if (!snap.exists) {
      profile = {
        userId,
        contributorTier: 'COMMUNITY_SCOUT',
        reputationPoints: 50,
        spotsSubmittedCount: 1,
        spotsApprovedCount: 1,
        accuracyRate: 1.0,
        isVerifiedResident: false,
        neighborhoodOfResidency: '',
        earnedBadges: [
          {
            badgeId: 'FIRST_GEM_APPROVED',
            title: 'First Gem Scout',
            description: 'Submitted first approved community recommendation.',
            awardedAt: now,
          },
        ],
        totalTipsReceivedInr: 0,
      };
    } else {
      const existing = snap.data() as ContributorVerificationProfile;
      const submitted = existing.spotsSubmittedCount + 1;
      const approved = existing.spotsApprovedCount + 1;
      const accuracyRate = parseFloat((approved / submitted).toFixed(2));
      const repPoints = existing.reputationPoints + 50;

      let tier: ContributorTier = existing.contributorTier;
      if (repPoints >= 500) tier = 'HERITAGE_SAGE';
      else if (repPoints >= 200) tier = 'COMMUNITY_PILLAR';
      else tier = 'COMMUNITY_SCOUT';

      const earnedBadges = [...existing.earnedBadges];
      if (approved >= 5 && !earnedBadges.some((b) => b.badgeId === 'FIVE_GEMS_MILESTONE')) {
        earnedBadges.push({
          badgeId: 'FIVE_GEMS_MILESTONE',
          title: 'Neighborhood Insider',
          description: 'Successfully contributed 5 verified local spots.',
          awardedAt: now,
        });
      }

      profile = {
        ...existing,
        contributorTier: tier,
        reputationPoints: repPoints,
        spotsSubmittedCount: submitted,
        spotsApprovedCount: approved,
        accuracyRate,
        earnedBadges,
      };
    }

    ContributorVerificationProfileSchema.parse(profile);
    await profileRef.set(profile);
    return profile;
  }
}
