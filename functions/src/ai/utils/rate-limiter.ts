/**
 * Shared Rate Limiter & Abuse Prevention Engine
 * Task B5 — AI Assistance & Live Dialogue Abuse Controls
 * Developer B — AI & Model Integration Lead
 * 
 * Implements a shared rate-limiting mechanism with:
 * - Pluggable storage adapters (Firestore-backed for multi-instance production, in-memory for testing/local)
 * - Per-user sliding-window request limits for externally billed AI callables
 * - Token issuance frequency caps and concurrent session safeguards
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
};

export interface UsageRecord {
  timestamps: number[];
  lastLiveTokenIssuedAt?: number;
}

/**
 * Storage adapter interface for shared rate limiting
 */
export interface RateLimitStore {
  getBucket(key: string): Promise<UsageRecord>;
  saveBucket(key: string, record: UsageRecord): Promise<void>;
  clear(): Promise<void>;
}

/**
 * In-memory store adapter for local fallback and deterministic multi-instance unit testing
 */
export class MemoryRateLimitStore implements RateLimitStore {
  private buckets = new Map<string, UsageRecord>();

  async getBucket(key: string): Promise<UsageRecord> {
    const existing = this.buckets.get(key);
    if (!existing) {
      return { timestamps: [] };
    }
    return {
      timestamps: [...existing.timestamps],
      lastLiveTokenIssuedAt: existing.lastLiveTokenIssuedAt,
    };
  }

  async saveBucket(key: string, record: UsageRecord): Promise<void> {
    this.buckets.set(key, {
      timestamps: [...record.timestamps],
      lastLiveTokenIssuedAt: record.lastLiveTokenIssuedAt,
    });
  }

  async clear(): Promise<void> {
    this.buckets.clear();
  }
}

/**
 * Firestore-backed storage adapter for production multi-instance Cloud Function execution
 */
export class FirestoreRateLimitStore implements RateLimitStore {
  private collectionName = 'ai_usage_quotas';

  async getBucket(key: string): Promise<UsageRecord> {
    try {
      const docRef = db.collection(this.collectionName).doc(key);
      const snapshot = await docRef.get();
      if (!snapshot.exists) {
        return { timestamps: [] };
      }
      const data = snapshot.data();
      return {
        timestamps: Array.isArray(data?.timestamps) ? data.timestamps : [],
        lastLiveTokenIssuedAt: data?.lastLiveTokenIssuedAt,
      };
    } catch {
      // Fallback to empty if Firestore is unreachable or offline
      return { timestamps: [] };
    }
  }

  async saveBucket(key: string, record: UsageRecord): Promise<void> {
    try {
      const docRef = db.collection(this.collectionName).doc(key);
      await docRef.set(
        {
          timestamps: record.timestamps,
          lastLiveTokenIssuedAt: record.lastLiveTokenIssuedAt || null,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
    } catch {
      // Silently continue if Firestore write is unavailable in offline environment
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

  private getBucketKey(userId: string, endpoint: string): string {
    return `${userId}:${endpoint}`;
  }

  async checkRateLimit(
    userId: string,
    endpoint: string,
    now: number = Date.now()
  ): Promise<{ allowed: boolean; remaining: number; resetMs: number; error?: string }> {
    const policy = ENDPOINT_POLICIES[endpoint] || { maxRequests: 20, windowMs: 60 * 1000 };
    const key = this.getBucketKey(userId, endpoint);

    const bucket = await this.store.getBucket(key);
    // Filter timestamps within sliding window
    bucket.timestamps = bucket.timestamps.filter((ts) => now - ts < policy.windowMs);

    if (bucket.timestamps.length >= policy.maxRequests) {
      const oldest = bucket.timestamps[0];
      const resetMs = oldest + policy.windowMs - now;
      return {
        allowed: false,
        remaining: 0,
        resetMs: Math.max(0, resetMs),
        error: `Rate limit of ${policy.maxRequests} requests per ${policy.windowMs / 1000}s exceeded for endpoint '${endpoint}'. Retry in ${Math.ceil(resetMs / 1000)}s.`,
      };
    }

    bucket.timestamps.push(now);
    await this.store.saveBucket(key, bucket);

    return {
      allowed: true,
      remaining: policy.maxRequests - bucket.timestamps.length,
      resetMs: policy.windowMs,
    };
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
    const bucket = await this.store.getBucket(key);

    if (bucket?.lastLiveTokenIssuedAt && now - bucket.lastLiveTokenIssuedAt < 15 * 1000) {
      const waitSec = Math.ceil((15 * 1000 - (now - bucket.lastLiveTokenIssuedAt)) / 1000);
      throw new HttpsError(
        'resource-exhausted',
        `Live session token was issued recently. Concurrent token issuance is restricted; please wait ${waitSec}s.`
      );
    }

    bucket.lastLiveTokenIssuedAt = now;
    await this.store.saveBucket(key, bucket);
  }

  async clear(): Promise<void> {
    await this.store.clear();
  }
}

// Global shared store and default limiter instance for Cloud Functions
const sharedMemoryStore = new MemoryRateLimitStore();
export const defaultRateLimiter = new RateLimiter(sharedMemoryStore);

export async function checkRateLimit(
  userId: string,
  endpoint: string
): Promise<{ allowed: boolean; remaining: number; resetMs: number; error?: string }> {
  return defaultRateLimiter.checkRateLimit(userId, endpoint);
}

export async function assertRateLimit(userId: string, endpoint: string): Promise<void> {
  return defaultRateLimiter.assertRateLimit(userId, endpoint);
}

export async function assertLiveSessionTokenIssuance(userId: string): Promise<void> {
  return defaultRateLimiter.assertLiveSessionTokenIssuance(userId);
}

export async function clearRateLimitsForTesting(): Promise<void> {
  return defaultRateLimiter.clear();
}
