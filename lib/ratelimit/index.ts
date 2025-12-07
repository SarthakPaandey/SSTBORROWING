/**
 * Rate Limiting Module
 * 
 * Provides rate limiting with pluggable backends:
 * - InMemoryAdapter: Default for local dev and single-instance deployments
 * - RedisAdapter: For distributed multi-instance deployments (requires REDIS_URL)
 * 
 * The adapter is selected automatically based on configuration.
 */

export type { RateLimitAdapter, RateLimitResult } from './types';
export { InMemoryAdapter, rateLimit, getSharedInMemoryAdapter } from './memory-adapter';
export { RedisAdapter, isRedisConfigured } from './redis-adapter';

import { NextRequest, NextResponse } from 'next/server';
import type { RateLimitAdapter } from './types';
import { InMemoryAdapter } from './memory-adapter';
import { RedisAdapter, isRedisConfigured } from './redis-adapter';

// Singleton adapter instance
let _adapter: RateLimitAdapter | null = null;

/**
 * Get or create the rate limit adapter.
 * Uses Redis if REDIS_URL is configured, otherwise falls back to in-memory.
 */
export function getAdapter(): RateLimitAdapter {
    if (_adapter) return _adapter;

    if (isRedisConfigured()) {
        console.log('[RateLimit] Using Redis adapter for distributed rate limiting');
        _adapter = new RedisAdapter();
    } else {
        console.log('[RateLimit] Using in-memory adapter (single-node mode)');
        _adapter = new InMemoryAdapter();
    }

    return _adapter;
}

/**
 * Higher-order function to wrap API handlers with rate limiting.
 * 
 * @param handler The API handler to wrap
 * @param limit Maximum requests per window (default: 20)
 * @param windowMs Window duration in milliseconds (default: 60000 = 1 minute)
 */
export function withRateLimit(
    handler: (req: NextRequest, ...args: unknown[]) => Promise<NextResponse>,
    limit: number = 20,
    windowMs: number = 60000
) {
    return async (req: NextRequest, ...args: unknown[]) => {
        const adapter = getAdapter();
        const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';

        const result = await adapter.check(ip, limit, windowMs);

        if (!result.allowed) {
            const response = NextResponse.json(
                { error: 'Too many requests, please try again later.' },
                { status: 429 }
            );
            response.headers.set('X-RateLimit-Mode', adapter.getMode());
            response.headers.set('X-RateLimit-Limit', limit.toString());
            response.headers.set('X-RateLimit-Remaining', '0');
            response.headers.set('X-RateLimit-Reset', result.reset.toString());
            response.headers.set('Retry-After', Math.ceil((result.reset - Date.now()) / 1000).toString());
            return response;
        }

        const res = await handler(req, ...args);

        // Add rate limit headers to successful responses
        res.headers.set('X-RateLimit-Mode', adapter.getMode());
        res.headers.set('X-RateLimit-Limit', limit.toString());
        res.headers.set('X-RateLimit-Remaining', result.remaining.toString());
        res.headers.set('X-RateLimit-Reset', result.reset.toString());

        return res;
    };
}
