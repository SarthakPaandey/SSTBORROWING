/**
 * Rate Limit Adapter Interface
 * 
 * Provides a common interface for rate limiting storage backends.
 * Supports both in-memory (local dev) and Redis (distributed production) modes.
 */

export interface RateLimitResult {
    allowed: boolean;
    count: number;
    reset: number; // Unix timestamp when the window resets
    remaining: number; // Requests remaining in window
}

export interface RateLimitAdapter {
    /**
     * Check and increment the rate limit counter for a key.
     * @param key Unique identifier (typically IP address)
     * @param limit Maximum requests allowed in window
     * @param windowMs Window duration in milliseconds
     * @returns Rate limit result with allowed status and metadata
     */
    check(key: string, limit: number, windowMs: number): Promise<RateLimitResult>;

    /**
     * Get the mode identifier for this adapter.
     * Used for the X-RateLimit-Mode response header.
     */
    getMode(): string;
}
