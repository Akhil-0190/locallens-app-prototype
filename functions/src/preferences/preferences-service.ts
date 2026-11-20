/**
 * Traveler Preferences Service
 * Task A4 — Preferences, Groups, Capacity, and Scheduling Backend
 *
 * Implements CRUD operations for traveler preferences stored at `preferences/{userId}`,
 * adhering strictly to the Domain 02 canonical contract.
 */

import { db } from '../config/firebase.js';
import {
  TravelerPreferencesDocument,
  TravelerPreferencesDocumentSchema,
  BudgetTier,
} from '../types/contracts/index.js';

export const PREFERENCES_COLLECTION = 'preferences';

function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Default preferences for a newly registered traveler.
 */
export function getDefaultPreferences(userId: string): TravelerPreferencesDocument {
  return {
    userId,
    favoriteVibes: ['heritage', 'vintage_filter_coffee', 'street_food'],
    dietaryRestrictions: [],
    budgetTier: 'MODERATE' as BudgetTier,
    maxBudgetPerMealInr: 250,
    preferredPacing: 'BALANCED',
    preferredNeighborhoods: ['Malleshwaram', 'Basavanagudi'],
    accessibilityNeeds: [],
    updatedAt: nowIso(),
  };
}

/**
 * Retrieves preferences for a user by UID.
 * Returns null if not found.
 */
export async function getPreferences(
  userId: string
): Promise<TravelerPreferencesDocument | null> {
  const docSnap = await db.collection(PREFERENCES_COLLECTION).doc(userId).get();
  if (!docSnap.exists) {
    return null;
  }
  const data = docSnap.data();
  return TravelerPreferencesDocumentSchema.parse(data);
}

/**
 * Saves or updates preferences for a user by UID.
 * Validates the full document with TravelerPreferencesDocumentSchema before writing.
 */
export async function savePreferences(
  userId: string,
  input: Partial<Omit<TravelerPreferencesDocument, 'userId' | 'updatedAt'>>
): Promise<TravelerPreferencesDocument> {
  const existing = await getPreferences(userId);
  const base = existing || getDefaultPreferences(userId);

  const merged: TravelerPreferencesDocument = {
    ...base,
    ...input,
    userId,
    updatedAt: nowIso(),
  };

  const validated = TravelerPreferencesDocumentSchema.parse(merged);
  await db.collection(PREFERENCES_COLLECTION).doc(userId).set(validated);
  return validated;
}
