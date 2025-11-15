import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { expireGroupBookings } from '@/lib/groupBookingPenalties';

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

  } catch (error: any) {
    console.error('Expire group bookings error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to expire group bookings' },
      { status: 500 }
    );
  }
}
