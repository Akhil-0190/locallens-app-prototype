/**
 * Shared Rate Limiter & Abuse Prevention Engine
 * Task B5 — AI Assistance & Live Dialogue Abuse Controls
 * Developer B — AI & Model Integration Lead
 * 
 * Implements a shared rate-limiting mechanism with:
 * - Pluggable storage adapters (Firestore-backed for multi-instance production, in-memory for testing/local)
 * - Atomic Firestore transactions (runTransaction) guaranteeing consistency across concurrent serverless instances
 * - Per-user sliding-window request limits for externally billed AI callables
 * - Token issuance frequency caps (cooldown) and concurrent session safeguards
 * - Multi-instance isolation and verification support
 */

import { HttpsError } from 'firebase-functions/v2/https';
import { db } from '../../config/firebase.js';

export interface RateLimitPolicy {
  maxRequests: number;
  windowMs: number;
}

export const ENDPOINT_POLICIES: Record<string, RateLimitPolicy> = {
  initializeLiveSession: { maxRequests: 5, windowMs: 15 * 60 * 1000 }, // Max 5 token mints per 15 min per user
  askStreetCopilot: { maxRequests: 20, windowMs: 60 * 1000 },           // Max 20 Q&A prompts per min
  translateText: { maxRequests: 30, windowMs: 60 * 1000 },              // Max 30 translations per min
  translateCameraSignage: { maxRequests: 10, windowMs: 60 * 1000 },     // Max 10 OCR requests per min (multimodal)
  generateAudioGuidance: { maxRequests: 15, windowMs: 60 * 1000 },      // Max 15 audio scripts per min
  explainPlanBReroute: { maxRequests: 10, windowMs: 60 * 1000 },        // Max 10 Plan-B explanations per min
  formatGeminiHandoff: { maxRequests: 5, windowMs: 60 * 1000 },         // Max 5 handoffs per min
  generateTripPlan: { maxRequests: 20, windowMs: 60 * 1000 },           // Max 20 trip plan generations per min
};

export interface UsageRecord {
  timestamps: number[];
  lastLiveTokenIssuedAt?: number;
}

export interface RateLimitConsumptionResult {
  allowed: boolean;
  remaining: number;
  resetMs: number;
  error?: string;
}

export interface CooldownResult {
  allowed: boolean;
  waitSec?: number;
}

/**
 * Storage adapter interface for shared rate limiting
 */
export interface RateLimitStore {
  consumeQuota(
    key: string,
    policy: RateLimitPolicy,
    now?: number
  ): Promise<RateLimitConsumptionResult>;

  checkLiveTokenCooldown(
    key: string,
    cooldownMs: number,
    now?: number
  ): Promise<CooldownResult>;

  clear(): Promise<void>;
}

/**
 * In-memory store adapter for local fallback and deterministic unit testing
 */
export class MemoryRateLimitStore implements RateLimitStore {
  private buckets = new Map<string, UsageRecord>();

  async consumeQuota(
    key: string,
    policy: RateLimitPolicy,
    now: number = Date.now()
  ): Promise<RateLimitConsumptionResult> {
    const record = this.buckets.get(key) || { timestamps: [] };
    record.timestamps = record.timestamps.filter((ts) => now - ts < policy.windowMs);

    if (record.timestamps.length >= policy.maxRequests) {
      const oldest = record.timestamps[0];
      const resetMs = Math.max(0, oldest + policy.windowMs - now);
      return {
        allowed: false,
        remaining: 0,
        resetMs,
        error: `Rate limit of ${policy.maxRequests} requests per ${policy.windowMs / 1000}s exceeded for key '${key}'. Retry in ${Math.ceil(resetMs / 1000)}s.`,
      };
    }

    record.timestamps.push(now);
    this.buckets.set(key, record);

    return {
      allowed: true,
      remaining: policy.maxRequests - record.timestamps.length,
      resetMs: policy.windowMs,
    };
  }

  async checkLiveTokenCooldown(
    key: string,
    cooldownMs: number,
    now: number = Date.now()
  ): Promise<CooldownResult> {
    const record = this.buckets.get(key) || { timestamps: [] };
    if (record.lastLiveTokenIssuedAt && now - record.lastLiveTokenIssuedAt < cooldownMs) {
      const waitSec = Math.ceil((cooldownMs - (now - record.lastLiveTokenIssuedAt)) / 1000);
      return { allowed: false, waitSec };
    }

    record.lastLiveTokenIssuedAt = now;
    this.buckets.set(key, record);
    return { allowed: true };
  }

  async clear(): Promise<void> {
    this.buckets.clear();
  }
}

/**
 * Firestore-backed storage adapter for production multi-instance Cloud Function execution
 * Uses runTransaction for atomic quota consumption, surviving instance restarts and concurrent requests.
 */
export class FirestoreRateLimitStore implements RateLimitStore {
  private collectionName: string;
  private firestore: any;

  constructor(customDb?: any, collectionName = 'ai_usage_quotas') {
    this.firestore = customDb || db;
    this.collectionName = collectionName;
  }

  async consumeQuota(
    key: string,
    policy: RateLimitPolicy,
    now: number = Date.now()
  ): Promise<RateLimitConsumptionResult> {
    const docRef = this.firestore.collection(this.collectionName).doc(key);

    try {
      return await this.firestore.runTransaction(async (transaction: any) => {
        const snap = await transaction.get(docRef);
        const data = snap.exists ? snap.data() : null;
        const rawTimestamps: number[] = Array.isArray(data?.timestamps) ? data.timestamps : [];

        // Filter timestamps within sliding window
        const validTimestamps = rawTimestamps.filter((ts: number) => now - ts < policy.windowMs);

        if (validTimestamps.length >= policy.maxRequests) {
          const oldest = validTimestamps[0];
          const resetMs = Math.max(0, oldest + policy.windowMs - now);
          return {
            allowed: false,
            remaining: 0,
            resetMs,
            error: `Rate limit of ${policy.maxRequests} requests per ${policy.windowMs / 1000}s exceeded for key '${key}'. Retry in ${Math.ceil(resetMs / 1000)}s.`,
          };
        }

        validTimestamps.push(now);
        const remaining = policy.maxRequests - validTimestamps.length;

        transaction.set(
          docRef,
          {
            timestamps: validTimestamps,
            lastLiveTokenIssuedAt: data?.lastLiveTokenIssuedAt || null,
            remainingQuota: remaining,
            totalCalls: (data?.totalCalls || 0) + 1,
            updatedAt: new Date(now).toISOString(),
          },
          { merge: true }
        );

        return {
          allowed: true,
          remaining,
          resetMs: policy.windowMs,
        };
      });
    } catch {
      // If Firestore is offline or unavailable, fallback safely
      return {
        allowed: true,
        remaining: 1,
        resetMs: policy.windowMs,
      };
    }
  }

  async checkLiveTokenCooldown(
    key: string,
    cooldownMs: number,
    now: number = Date.now()
  ): Promise<CooldownResult> {
    const docRef = this.firestore.collection(this.collectionName).doc(key);

    try {
      return await this.firestore.runTransaction(async (transaction: any) => {
        const snap = await transaction.get(docRef);
        const data = snap.exists ? snap.data() : null;
        const lastIssued = data?.lastLiveTokenIssuedAt || 0;

        if (lastIssued && now - lastIssued < cooldownMs) {
          const waitSec = Math.ceil((cooldownMs - (now - lastIssued)) / 1000);
          return { allowed: false, waitSec };
        }

        transaction.set(
          docRef,
          {
            lastLiveTokenIssuedAt: now,
            updatedAt: new Date(now).toISOString(),
          },
          { merge: true }
        );

        return { allowed: true };
      });
    } catch {
      return { allowed: true };
    }
  }

  async clear(): Promise<void> {
    // In production, collections are pruned by TTL policies or scheduled tasks
  }
}

/**
 * Rate Limiter Engine supporting multiple limiter instances sharing the same store
 */
export class RateLimiter {
  constructor(private store: RateLimitStore) {}

  public getStore(): RateLimitStore {
    return this.store;
  }

  private getBucketKey(userId: string, endpoint: string): string {
    return `${userId}:${endpoint}`;
  }

  async checkRateLimit(
    userId: string,
    endpoint: string,
    now: number = Date.now()
  ): Promise<RateLimitConsumptionResult> {
    const policy = ENDPOINT_POLICIES[endpoint] || { maxRequests: 20, windowMs: 60 * 1000 };
    const key = this.getBucketKey(userId, endpoint);
    return this.store.consumeQuota(key, policy, now);
  }

  async assertRateLimit(userId: string, endpoint: string, now: number = Date.now()): Promise<void> {
    const result = await this.checkRateLimit(userId, endpoint, now);
    if (!result.allowed) {
      throw new HttpsError('resource-exhausted', result.error || 'Rate limit exceeded.');
    }
  }

  async assertLiveSessionTokenIssuance(userId: string, now: number = Date.now()): Promise<void> {
    await this.assertRateLimit(userId, 'initializeLiveSession', now);
    const key = this.getBucketKey(userId, 'initializeLiveSession');
    const cooldown = await this.store.checkLiveTokenCooldown(key, 15 * 1000, now);
    if (!cooldown.allowed) {
      throw new HttpsError(
        'resource-exhausted',
        `Live session token was issued recently. Concurrent token issuance is restricted; please wait ${cooldown.waitSec}s.`
      );
    }
  }

  async clear(): Promise<void> {
    await this.store.clear();
  }
}

// Global production store: uses FirestoreRateLimitStore backed by the 'ai_usage_quotas' collection!
export const productionFirestoreStore = new FirestoreRateLimitStore();
export let defaultRateLimiter = new RateLimiter(productionFirestoreStore);

export function setRateLimiterForTesting(limiter: RateLimiter): void {
  defaultRateLimiter = limiter;
}

export async function checkRateLimit(
  userId: string,
  endpoint: string,
  now?: number
): Promise<RateLimitConsumptionResult> {
  return defaultRateLimiter.checkRateLimit(userId, endpoint, now);
}

export async function assertRateLimit(userId: string, endpoint: string, now?: number): Promise<void> {
  return defaultRateLimiter.assertRateLimit(userId, endpoint, now);
}

export async function assertLiveSessionTokenIssuance(userId: string, now?: number): Promise<void> {
  return defaultRateLimiter.assertLiveSessionTokenIssuance(userId, now);
}

export async function clearRateLimitsForTesting(): Promise<void> {
  return defaultRateLimiter.clear();
}
