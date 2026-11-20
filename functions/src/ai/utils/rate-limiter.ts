/**
 * In-Memory Sliding-Window Rate Limiter & Abuse Prevention
 * Task B5 — AI Assistance & Live Dialogue Abuse Controls
 * Developer B — AI & Model Integration Lead
 * 
 * Implements per-user sliding-window rate limiting, token issuance caps,
 * and concurrent session controls without introducing external infrastructure.
 */

import { HttpsError } from 'firebase-functions/v2/https';

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

interface UserBucket {
  timestamps: number[];
  lastLiveTokenIssuedAt?: number;
}

const userBuckets = new Map<string, UserBucket>();

function getBucketKey(userId: string, endpoint: string): string {
  return `${userId}:${endpoint}`;
}

/**
 * Checks sliding-window rate limit for a user on a specific endpoint.
 */
export function checkRateLimit(
  userId: string,
  endpoint: string
): { allowed: boolean; remaining: number; resetMs: number; error?: string } {
  const policy = ENDPOINT_POLICIES[endpoint] || { maxRequests: 20, windowMs: 60 * 1000 };
  const key = getBucketKey(userId, endpoint);
  const now = Date.now();

  let bucket = userBuckets.get(key);
  if (!bucket) {
    bucket = { timestamps: [] };
    userBuckets.set(key, bucket);
  }

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
  return {
    allowed: true,
    remaining: policy.maxRequests - bucket.timestamps.length,
    resetMs: policy.windowMs,
  };
}

/**
 * Asserts rate limit, throwing HttpsError('resource-exhausted') if exceeded.
 */
export function assertRateLimit(userId: string, endpoint: string): void {
  const result = checkRateLimit(userId, endpoint);
  if (!result.allowed) {
    throw new HttpsError('resource-exhausted', result.error || 'Rate limit exceeded.');
  }
}

/**
 * Checks concurrent Live session token minting.
 * Prevents rapid token mint loops by enforcing at least 15 seconds between successive token mints.
 */
export function assertLiveSessionTokenIssuance(userId: string): void {
  // First assert overall endpoint limit
  assertRateLimit(userId, 'initializeLiveSession');

  const key = getBucketKey(userId, 'initializeLiveSession');
  const bucket = userBuckets.get(key);
  const now = Date.now();

  if (bucket?.lastLiveTokenIssuedAt && now - bucket.lastLiveTokenIssuedAt < 15 * 1000) {
    const waitSec = Math.ceil((15 * 1000 - (now - bucket.lastLiveTokenIssuedAt)) / 1000);
    throw new HttpsError(
      'resource-exhausted',
      `Live session token was issued recently. Concurrent token issuance is restricted; please wait ${waitSec}s.`
    );
  }

  if (bucket) {
    bucket.lastLiveTokenIssuedAt = now;
  }
}

/**
 * Clears in-memory buckets (used for isolated test runs).
 */
export function clearRateLimitsForTesting(): void {
  userBuckets.clear();
}
