import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { GroupBooking } from '@/models/GroupBooking';
import { Booking } from '@/models/Booking';
import { Resource } from '@/models/Resource';
import { User } from '@/models/User';
import { requireAuth } from '@/lib/auth/guards';
import { handleApiError } from '@/lib/errors';

export async function GET(req: NextRequest) {
  try {
    await requireAuth(['ADMIN']);
    await connectDB();

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');

    const query: any = {};
    if (status) {
      query.status = status;
    }

    const groupBookings = await GroupBooking.find(query)
      .sort({ createdAt: -1 })
      .limit(100);

    // Enrich with booking, resource, and user details
    const enriched = await Promise.all(
      groupBookings.map(async (gb) => {
        const booking = await Booking.findById(gb.bookingId);
        const resource = booking ? await Resource.findById(booking.resourceId) : null;
        const organizer = await User.findById(gb.organizerId);

        // Get member details
        const memberDetails = await Promise.all(
          gb.members.map(async (member) => {
            const user = await User.findById(member.userId);
            return {
              userId: member.userId,
              email: member.email,
              name: member.name,
              status: member.status,
              invitedAt: member.invitedAt,
              respondedAt: member.respondedAt,
              userName: user?.name || 'Unknown',
            };
          })
        );

        return {
          _id: gb._id,
          groupBookingId: gb._id,
          bookingId: gb.bookingId,
          organizerId: gb.organizerId,
          organizerEmail: gb.organizerEmail,
          organizerName: organizer?.name || 'Unknown',
          resourceName: resource?.name || 'Unknown',
          resourceLocation: resource?.location || '',
          bookingStart: booking?.start,
          bookingEnd: booking?.end,
          bookingStatus: booking?.status,
          members: memberDetails,
          requiredMinimum: gb.requiredMinimum,
          confirmedCount: gb.confirmedCount,
          status: gb.status,
          expiresAt: gb.expiresAt,
          createdAt: gb.createdAt,
          updatedAt: gb.updatedAt,
        };
      })
    );

    return NextResponse.json({ groupBookings: enriched });

  } catch (error) {
    console.error('Fetch group bookings error:', error);
    return handleApiError(error);
  }
}
