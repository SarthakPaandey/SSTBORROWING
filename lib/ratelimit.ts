import { NextRequest, NextResponse } from 'next/server';

const rateLimitMap = new Map<string, { count: number; lastReset: number }>();

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

        if (!rateLimit(ip, limit, windowMs)) {
            return NextResponse.json(
                { error: 'Too many requests, please try again later.' },
                { status: 429 }
            );
        }

        return handler(req, ...args);
    };
}
