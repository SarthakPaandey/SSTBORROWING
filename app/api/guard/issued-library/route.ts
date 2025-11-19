import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Booking } from '@/models/Booking';
import { Resource } from '@/models/Resource';
import { User } from '@/models/User';
import { requireAuth } from '@/lib/auth/guards';

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth();

    // Only guards can access this
    if (user.role !== 'GUARD') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    await connectDB();

    // Find all library bookings that are checked in but not yet completed
    const bookings = await Booking.find({
      kind: 'LIBRARY',
      status: 'CHECKED_IN',
    })
      .sort({ checkedInAt: -1 })
      .lean();

    // Enrich with resource and user names
    const resourceIds = bookings.map((b) => b.resourceId);
    const userIds = bookings.map((b) => b.userId);

    const resources = await Resource.find({ _id: { $in: resourceIds } }).lean();
    const users = await User.find({ _id: { $in: userIds } }).lean();

    const resourceMap = new Map(resources.map((r) => [r._id.toString(), r]));
    const userMap = new Map(users.map((u) => [u._id.toString(), u]));

    const enrichedBookings = bookings.map((b) => ({
      ...b,
      resourceName: resourceMap.get(b.resourceId)?.name || 'Unknown',
      userName: userMap.get(b.userId)?.name || 'Unknown',
    }));

    return NextResponse.json({ bookings: enrichedBookings });
  } catch (error: any) {
    console.error('Issued library error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch issued library books' },
      { status: 500 }
    );
  }
}

