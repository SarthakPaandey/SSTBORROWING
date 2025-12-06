import { NextRequest, NextResponse } from 'next/server';

const rateLimitMap = new Map<string, { count: number; lastReset: number }>();

// FIX EC-17: Prevent memory leak by cleaning up old entries
// Run cleanup every hour to remove stale entries
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
const MAX_MAP_SIZE = 10000; // Prevent unbounded growth

setInterval(() => {
    const now = Date.now();
    const entriesToDelete: string[] = [];

    // Remove entries older than 2x the window (generous buffer)
    for (const [ip, record] of rateLimitMap.entries()) {
        if (now - record.lastReset > 120000) { // 2 minutes (2x default 60s window)
            entriesToDelete.push(ip);
        }
    }

    entriesToDelete.forEach(ip => rateLimitMap.delete(ip));

    // If still too large, remove oldest entries
    if (rateLimitMap.size > MAX_MAP_SIZE) {
        const entries = Array.from(rateLimitMap.entries())
            .sort((a, b) => a[1].lastReset - b[1].lastReset)
            .slice(0, rateLimitMap.size - MAX_MAP_SIZE);
        entries.forEach(([ip]) => rateLimitMap.delete(ip));
    }
}, CLEANUP_INTERVAL_MS);

// NOTE: For production with multiple instances, this in-memory limiter must be
// replaced with a distributed store (Redis / Vercel KV). We surface a header so
// downstream systems can detect the mode and add an optional hard block via env.
const REQUIRE_DISTRIBUTED_RATELIMIT = process.env.REQUIRE_DISTRIBUTED_RATELIMIT === 'true';

export function rateLimit(ip: string, limit: number = 10, windowMs: number = 60000) {
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

export function withRateLimit(handler: (req: NextRequest, ...args: unknown[]) => Promise<NextResponse>, limit: number = 20, windowMs: number = 60000) {
    return async (req: NextRequest, ...args: unknown[]) => {
        const ip = req.headers.get('x-forwarded-for') || 'unknown';

        if (REQUIRE_DISTRIBUTED_RATELIMIT) {
            return NextResponse.json(
                { error: 'Rate limiting requires distributed backend in this deployment.' },
                { status: 503 }
            );
        }

        if (!rateLimit(ip, limit, windowMs)) {
            return NextResponse.json(
                { error: 'Too many requests, please try again later.' },
                { status: 429 }
            );
        }

        const res = await handler(req, ...args);
        res.headers.set('x-ratelimit-mode', 'in-memory-single-node');
        return res;
    };
}
