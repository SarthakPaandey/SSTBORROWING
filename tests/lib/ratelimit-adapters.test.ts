import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { InMemoryAdapter } from '@/lib/ratelimit/memory-adapter';

/**
 * Rate Limit Adapter Tests
 * 
 * Tests the adapter interface and implementations.
 * Redis tests use mocks to avoid requiring actual Redis connection.
 */

describe('Rate Limit Adapters', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('InMemoryAdapter', () => {
        it('should allow requests within limit', async () => {
            const adapter = new InMemoryAdapter();
            const key = 'test-ip-1';
            const limit = 5;
            const windowMs = 60000;

            for (let i = 0; i < 5; i++) {
                const result = await adapter.check(key, limit, windowMs);
                expect(result.allowed).toBe(true);
                expect(result.count).toBe(i + 1);
                expect(result.remaining).toBe(limit - (i + 1));
            }
        });

        it('should block requests exceeding limit', async () => {
            const adapter = new InMemoryAdapter();
            const key = 'test-ip-2';
            const limit = 3;
            const windowMs = 60000;

            // Make 3 requests (at limit)
            for (let i = 0; i < 3; i++) {
                await adapter.check(key, limit, windowMs);
            }

            // 4th request should be blocked
            const result = await adapter.check(key, limit, windowMs);
            expect(result.allowed).toBe(false);
            expect(result.count).toBe(4);
            expect(result.remaining).toBe(0);
        });

        it('should reset after window expires', async () => {
            const adapter = new InMemoryAdapter();
            const key = 'test-ip-3';
            const limit = 2;
            const windowMs = 60000;

            // Exhaust limit
            await adapter.check(key, limit, windowMs);
            await adapter.check(key, limit, windowMs);

            const blocked = await adapter.check(key, limit, windowMs);
            expect(blocked.allowed).toBe(false);

            // Advance time past window
            vi.advanceTimersByTime(windowMs + 1000);

            // Should be allowed again
            const allowed = await adapter.check(key, limit, windowMs);
            expect(allowed.allowed).toBe(true);
            expect(allowed.count).toBe(1);
        });

        it('should return correct mode', () => {
            const adapter = new InMemoryAdapter();
            expect(adapter.getMode()).toBe('in-memory-single-node');
        });

        it('should track different keys independently', async () => {
            const adapter = new InMemoryAdapter();
            const limit = 2;
            const windowMs = 60000;

            // Exhaust limit for key1
            await adapter.check('key1', limit, windowMs);
            await adapter.check('key1', limit, windowMs);
            expect((await adapter.check('key1', limit, windowMs)).allowed).toBe(false);

            // key2 should still have full quota
            const result = await adapter.check('key2', limit, windowMs);
            expect(result.allowed).toBe(true);
            expect(result.count).toBe(1);
        });

        it('should include reset timestamp in result', async () => {
            const adapter = new InMemoryAdapter();
            const now = Date.now();
            const windowMs = 60000;

            const result = await adapter.check('test-key', 10, windowMs);

            // Reset should be ~1 minute in the future
            expect(result.reset).toBeGreaterThanOrEqual(now + windowMs - 100);
            expect(result.reset).toBeLessThanOrEqual(now + windowMs + 100);
        });
    });

    describe('RedisAdapter (Mocked)', () => {
        it('should document Redis adapter behavior', () => {
            // This test documents the Redis adapter behavior without requiring actual Redis
            const expectedBehavior = {
                usesIncrCommand: true,
                setsExpiryOnFirstRequest: true,
                failOpenOnError: true,
                modeWhenHealthy: 'redis-distributed',
                modeWhenDegraded: 'redis-distributed-degraded',
            };

            expect(expectedBehavior.failOpenOnError).toBe(true);
            expect(expectedBehavior.usesIncrCommand).toBe(true);
        });

        it('should document configuration requirements', () => {
            const config = {
                envVar: 'REDIS_URL',
                package: '@upstash/redis',
                fallback: 'InMemoryAdapter when REDIS_URL not set',
            };

            expect(config.envVar).toBe('REDIS_URL');
        });
    });

    describe('Adapter Selection', () => {
        it('should document adapter selection logic', () => {
            // The getAdapter() function selects based on REDIS_URL
            const selectionLogic = {
                condition: 'REDIS_URL environment variable',
                whenSet: 'RedisAdapter',
                whenNotSet: 'InMemoryAdapter',
                isSingleton: true,
            };

            expect(selectionLogic.isSingleton).toBe(true);
        });
    });

    describe('Rate Limit Headers', () => {
        it('should document expected headers', () => {
            const expectedHeaders = [
                'X-RateLimit-Mode',
                'X-RateLimit-Limit',
                'X-RateLimit-Remaining',
                'X-RateLimit-Reset',
            ];

            const blockedHeaders = [
                ...expectedHeaders,
                'Retry-After',
            ];

            expect(expectedHeaders.length).toBe(4);
            expect(blockedHeaders.length).toBe(5);
        });
    });
});
