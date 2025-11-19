import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Booking } from '@/models/Booking';
import { Resource } from '@/models/Resource';
import { User } from '@/models/User';
import { requireAuth } from '@/lib/auth/guards';

export async function GET(req: NextRequest) {
  try {
    await requireAuth(['ADMIN']);
    await connectDB();

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');

    // Fetch bookings that require approval
    const query: any = {
      requiresApproval: true,
      approval: 'PENDING',
    };

    if (status) {
      query.status = status;
    }

    const bookings = await Booking.find(query).sort({ createdAt: -1 });

    // Populate resource names and user details
    const resourceIds = [...new Set(bookings.map(b => b.resourceId))];
    const resources = await Resource.find({ _id: { $in: resourceIds } });
    const resourceMap = new Map(resources.map(r => [r.id, r]));

    const userIds = [...new Set(bookings.map(b => b.userId))];
    const users = await User.find({ _id: { $in: userIds } });
    const userMap = new Map(users.map(u => [u.id, u]));

    const enrichedBookings = bookings.map(b => {
      const resource = resourceMap.get(b.resourceId);
      const user = userMap.get(b.userId);

      return {
        ...b.toObject(),
        resourceName: resource?.name || 'Unknown',
        resourceType: resource?.type || 'Unknown',
        userEmail: user?.email || null,
        userName: user?.name || null,
      };
    });

    return NextResponse.json({ bookings: enrichedBookings });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to fetch pending approvals' },
      { status: 500 }
    );
  }
}
