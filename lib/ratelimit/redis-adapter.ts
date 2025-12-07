/**
 * Redis Rate Limit Adapter
 * 
 * Distributed rate limiting using Redis for multi-instance deployments.
 * Uses sliding window algorithm with atomic Redis commands.
 * 
 * Requires: REDIS_URL environment variable (Upstash Redis URL)
 */

import type { RateLimitAdapter, RateLimitResult } from './types';

// Dynamic import to avoid requiring redis in environments where it's not needed
let redisClient: any = null;

async function getRedisClient() {
    if (redisClient) return redisClient;

    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
        throw new Error('REDIS_URL environment variable is required for Redis rate limiting');
    }

    // Use dynamic import to avoid bundling @upstash/redis when not needed
    try {
        const { Redis } = await import('@upstash/redis');
        redisClient = Redis.fromEnv();
        return redisClient;
    } catch (error) {
        throw new Error(
            'Failed to initialize Redis client. Ensure @upstash/redis is installed: npm install @upstash/redis'
        );
    }
}

export class RedisAdapter implements RateLimitAdapter {
    private connectionError: Error | null = null;

    async check(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
        try {
            const redis = await getRedisClient();
            const now = Date.now();
            const windowKey = `ratelimit:${key}`;
            const windowSeconds = Math.ceil(windowMs / 1000);

            // Use Redis INCR with expiry for simple fixed window
            // INCR atomically increments and returns new value
            const count = await redis.incr(windowKey);

            // Set expiry only on first request in window (when count is 1)
            if (count === 1) {
                await redis.expire(windowKey, windowSeconds);
            }

            // Get TTL to calculate reset time
            const ttl = await redis.ttl(windowKey);
            const reset = now + (ttl > 0 ? ttl * 1000 : windowMs);
            const remaining = Math.max(0, limit - count);

            return {
                allowed: count <= limit,
                count,
                reset,
                remaining,
            };
        } catch (error) {
            // Store error for diagnostics
            this.connectionError = error instanceof Error ? error : new Error(String(error));

            // Fail-open: allow request but log warning
            console.warn('[RateLimit] Redis error, failing open:', error);
            return {
                allowed: true,
                count: 0,
                reset: Date.now() + windowMs,
                remaining: limit,
            };
        }
    }

    getMode(): string {
        if (this.connectionError) {
            return 'redis-distributed-degraded';
        }
        return 'redis-distributed';
    }
}

// Check if Redis is configured
export function isRedisConfigured(): boolean {
    return Boolean(process.env.REDIS_URL);
}
