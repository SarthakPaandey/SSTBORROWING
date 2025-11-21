import { describe, it, expect, beforeEach } from 'vitest';
import { rateLimit } from '@/lib/ratelimit';

describe('Rate Limiting', () => {
  beforeEach(() => {
    // Clear any existing rate limit state
    // Note: In real implementation, we'd need to expose the map or reset it
  });

  it('should allow requests within limit', () => {
    const ip = '192.168.1.1';
    const limit = 10;
    const windowMs = 60000;

    // Make requests up to limit
    for (let i = 0; i < limit; i++) {
      const allowed = rateLimit(ip, limit, windowMs);
      expect(allowed).toBe(true);
    }
  });

  it('should block requests exceeding limit', () => {
    const ip = '192.168.1.2';
    const limit = 5;
    const windowMs = 60000;

    // Make requests up to limit
    for (let i = 0; i < limit; i++) {
      rateLimit(ip, limit, windowMs);
    }

    // Next request should be blocked
    const allowed = rateLimit(ip, limit, windowMs);
    expect(allowed).toBe(false);
  });

  it('should reset limit after window expires', () => {
    const ip = '192.168.1.3';
    const limit = 3;
    const windowMs = 100; // Very short window for testing

    // Exceed limit
    for (let i = 0; i <= limit; i++) {
      rateLimit(ip, limit, windowMs);
    }

    // Wait for window to expire
    return new Promise((resolve) => {
      setTimeout(() => {
        const allowed = rateLimit(ip, limit, windowMs);
        expect(allowed).toBe(true);
        resolve(undefined);
      }, windowMs + 10);
    });
  });

  it('should track different IPs separately', () => {
    const ip1 = '192.168.1.10';
    const ip2 = '192.168.1.11';
    const limit = 2;
    const windowMs = 60000;

    // Exceed limit for IP1
    rateLimit(ip1, limit, windowMs);
    rateLimit(ip1, limit, windowMs);
    const ip1Blocked = rateLimit(ip1, limit, windowMs);
    expect(ip1Blocked).toBe(false);

    // IP2 should still be allowed
    const ip2Allowed = rateLimit(ip2, limit, windowMs);
    expect(ip2Allowed).toBe(true);
  });
});

