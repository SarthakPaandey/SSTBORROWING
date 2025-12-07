/**
 * Rate Limiting Module (Backward Compatibility Layer)
 * 
 * This file now re-exports from the modular lib/ratelimit/ directory.
 * 
 * New features:
 * - Distributed rate limiting via Redis (when REDIS_URL is configured)
 * - In-memory fallback for local development
 * - X-RateLimit-* headers on all responses
 * 
 * @see lib/ratelimit/index.ts for the main implementation
 */

// Re-export everything from the new modular implementation
export {
    rateLimit,
    withRateLimit,
    getAdapter,
    InMemoryAdapter,
    RedisAdapter,
    isRedisConfigured,
} from './ratelimit/index';
export type { RateLimitAdapter, RateLimitResult } from './ratelimit/types';
