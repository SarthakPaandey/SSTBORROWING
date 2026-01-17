import { NextResponse } from 'next/server';

// Health check endpoint for Kubernetes probes
// This endpoint is used by:
// - Liveness probe: Restart container if unhealthy
// - Readiness probe: Remove from service if not ready

export async function GET() {
    try {
        return NextResponse.json(
            {
                status: 'healthy',
                timestamp: new Date().toISOString(),
                version: process.env.npm_package_version || '1.0.0',
            },
            { status: 200 }
        );
    } catch (error) {
        return NextResponse.json(
            {
                status: 'unhealthy',
                error: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 503 }
        );
    }
}
