import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Resource } from '@/models/Resource';
import { Booking } from '@/models/Booking';
import { Block } from '@/models/Block';
import { requireAuth } from '@/lib/auth/guards';

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
      return NextResponse.json({ error: 'Date parameter required' }, { status: 400 });
    }

    const date = new Date(dateStr);
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const resource = await Resource.findById(params.id);
    if (!resource) {
      return NextResponse.json({ error: 'Resource not found' }, { status: 404 });
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
    let sharedBookings: any[] = [];
    if (resource.sharedGroupId) {
      const sharedResources = await Resource.find({
        sharedGroupId: resource.sharedGroupId,
        _id: { $ne: params.id },
      });

      const sharedResourceIds = sharedResources.map(r => r._id.toString());

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
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to fetch availability' },
      { status: 500 }
    );
  }
}
