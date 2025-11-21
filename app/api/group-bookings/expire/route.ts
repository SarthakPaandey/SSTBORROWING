import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { expireGroupBookings } from '@/lib/groupBookingPenalties';
import { handleApiError } from '@/lib/errors';

/**
 * This endpoint checks for expired group bookings and either confirms or cancels them
 * Can be called by a cron job or manually
 */
export async function POST(req: NextRequest) {
  try {
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
