import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Resource } from '@/models/Resource';
import { Booking, IBooking } from '@/models/Booking';
import { Block } from '@/models/Block';
import { requireAuth } from '@/lib/auth/guards';
import { handleApiError, ValidationError, NotFoundError } from '@/lib/errors';
import { getStartOfDay, getEndOfDay } from '@/lib/timezone';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAuth();
    await connectDB();

    const { searchParams } = new URL(req.url);
    const dateStr = searchParams.get('date');

    if (!dateStr) {
      throw new ValidationError('Date parameter required');
    }

    // FIX: Use IST timezone utilities for accurate day boundaries
    const date = new Date(dateStr);
    const startOfDay = getStartOfDay(date);
    const endOfDay = getEndOfDay(date);

    const resource = await Resource.findById(params.id);
    if (!resource) {
      throw new NotFoundError('Resource');
    }

    // Get existing bookings
    const bookings = await Booking.find({
      resourceId: params.id,
      status: { $in: ['CONFIRMED', 'CHECKED_IN', 'PENDING'] },
      start: { $gte: startOfDay, $lte: endOfDay },
    });

    // Get blocks
    const blocks = await Block.find({
      resourceId: params.id,
      start: { $lte: endOfDay },
      end: { $gte: startOfDay },
    });

    // If shared turf, get bookings from other resources in the group
    let sharedBookings: IBooking[] = [];
    if (resource.sharedGroupId) {
      const sharedResources = await Resource.find({
        sharedGroupId: resource.sharedGroupId,
        _id: { $ne: params.id },
      });

      const sharedResourceIds = sharedResources.map(r => r.id);

      sharedBookings = await Booking.find({
        resourceId: { $in: sharedResourceIds },
        status: { $in: ['CONFIRMED', 'CHECKED_IN', 'PENDING'] },
        start: { $gte: startOfDay, $lte: endOfDay },
      });
    }

    return NextResponse.json({
      resource,
      bookings,
      blocks,
      sharedBookings,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
