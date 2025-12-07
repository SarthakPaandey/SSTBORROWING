/**
 * In-Memory Rate Limit Adapter
 * 
 * Default adapter for local development and single-instance deployments.
 * Uses a Map to store rate limit counters per IP.
 */

import type { RateLimitAdapter, RateLimitResult } from './types';

const rateLimitMap = new Map<string, { count: number; lastReset: number }>();

// Memory leak prevention: cleanup old entries every hour
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;
const MAX_MAP_SIZE = 10000;

setInterval(() => {
    const now = Date.now();
    const entriesToDelete: string[] = [];

    // Remove entries older than 2x the typical window
    for (const [ip, record] of rateLimitMap.entries()) {
        if (now - record.lastReset > 120000) {
            entriesToDelete.push(ip);
        }
    }

    entriesToDelete.forEach(ip => rateLimitMap.delete(ip));

    // Enforce max size by removing oldest
    if (rateLimitMap.size > MAX_MAP_SIZE) {
        const entries = Array.from(rateLimitMap.entries())
            .sort((a, b) => a[1].lastReset - b[1].lastReset)
            .slice(0, rateLimitMap.size - MAX_MAP_SIZE);
        entries.forEach(([ip]) => rateLimitMap.delete(ip));
    }
}, CLEANUP_INTERVAL_MS);

export class InMemoryAdapter implements RateLimitAdapter {
    async check(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
        const now = Date.now();
        const record = rateLimitMap.get(key) || { count: 0, lastReset: now };

        // Reset window if expired
        if (now - record.lastReset > windowMs) {
            record.count = 0;
            record.lastReset = now;
        }

        record.count += 1;
        rateLimitMap.set(key, record);

        const reset = record.lastReset + windowMs;
        const remaining = Math.max(0, limit - record.count);

        return {
            allowed: record.count <= limit,
            count: record.count,
            reset,
            remaining,
        };
    }

    getMode(): string {
        return 'in-memory-single-node';
    }
}

// Singleton for internal use by legacy rateLimit function
let _sharedInstance: InMemoryAdapter | null = null;

export function getSharedInMemoryAdapter(): InMemoryAdapter {
    if (!_sharedInstance) {
        _sharedInstance = new InMemoryAdapter();
    }
    return _sharedInstance;
}

/**
 * Legacy synchronous rate limit function for backward compatibility.
 * Prefer using the adapter interface for new code.
 */
export function rateLimit(ip: string, limit: number = 10, windowMs: number = 60000): boolean {
    const now = Date.now();
    const record = rateLimitMap.get(ip) || { count: 0, lastReset: now };

    if (now - record.lastReset > windowMs) {
        record.count = 0;
        record.lastReset = now;
    }

    record.count += 1;
    rateLimitMap.set(ip, record);

    return record.count <= limit;
}
