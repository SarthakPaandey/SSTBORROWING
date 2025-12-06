import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { expireGroupBookings } from '@/lib/groupBookingPenalties';
import { handleApiError, AuthorizationError } from '@/lib/errors';

/**
 * This endpoint checks for expired group bookings and either confirms or cancels them
 * Should be called by a cron job
 * 
 * SECURITY FIX: This endpoint was previously unprotected, allowing anyone to trigger
 * group booking expiration. Now requires CRON_SECRET for authorization.
 */
export async function POST(req: NextRequest) {
  try {
    // FIX: Verify cron secret to prevent unauthorized access
    // This was a security vulnerability - anyone could call this endpoint
    // FIX: Fail-closed if CRON_SECRET is missing to prevent undefined bypass
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      throw new AuthorizationError('CRON_SECRET environment variable not configured');
    }

    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${cronSecret}`) {
      throw new AuthorizationError('Invalid cron secret');
    }

    await connectDB();

    const expiredCount = await expireGroupBookings();

    return NextResponse.json({
      message: `Processed expired group bookings`,
      expiredCount,
    });

  } catch (error) {
    console.error('Expire group bookings error:', error);
    return handleApiError(error);
  }
}
