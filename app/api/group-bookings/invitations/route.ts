import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { GroupBooking } from '@/models/GroupBooking';
import { Booking } from '@/models/Booking';
import { Resource } from '@/models/Resource';
import { requireAuth } from '@/lib/auth/guards';
import { handleApiError } from '@/lib/errors';

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(['STUDENT']);
    await connectDB();

    // Find all group bookings where user is a member
    const groupBookings = await GroupBooking.find({
      'members.userId': user.id,
      status: { $in: ['PENDING_CONFIRMATIONS', 'CONFIRMED'] },
    }).sort({ createdAt: -1 });

    // Enrich with booking and resource details
    const enriched = await Promise.all(
      groupBookings.map(async (gb) => {
        const booking = await Booking.findById(gb.bookingId);
        const resource = booking ? await Resource.findById(booking.resourceId) : null;

        // Find this user's status in the group
        const myStatus = gb.members.find(m => m.userId === user.id)?.status || 'PENDING';

        return {
          _id: gb._id,
          groupBookingId: gb._id,
          bookingId: gb.bookingId,
          organizerEmail: gb.organizerEmail,
          resourceName: resource?.name || 'Unknown',
          location: resource?.location || '',
          start: booking?.start,
          end: booking?.end,
          myStatus,
          confirmedCount: gb.confirmedCount,
          requiredMinimum: gb.requiredMinimum,
          totalMembers: gb.members.length + 1, // +1 for organizer
          status: gb.status,
          expiresAt: gb.expiresAt,
          createdAt: gb.createdAt,
        };
      })
    );

    // Filter to only show relevant invitations
    const pending = enriched.filter(e => e.myStatus === 'PENDING' && e.status === 'PENDING_CONFIRMATIONS');
    const confirmed = enriched.filter(e => e.myStatus === 'CONFIRMED');

    return NextResponse.json({
      pending,
      confirmed,
      total: enriched.length,
    });

  } catch (error) {
    console.error('Fetch invitations error:', error);
    return handleApiError(error);
  }
}
