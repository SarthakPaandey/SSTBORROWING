import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { GroupBooking } from '@/models/GroupBooking';
import { Booking } from '@/models/Booking';
import { Resource } from '@/models/Resource';
import { User } from '@/models/User';
import { requireAuth } from '@/lib/auth/guards';
import { handleApiError } from '@/lib/errors';

// Force dynamic execution since we read auth headers/cookies
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

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
      .limit(100)
      .lean();

    // FIX: Batch fetch to eliminate N+1 queries
    // Collect all IDs needed for lookups
    const bookingIds = groupBookings.map(gb => gb.bookingId).filter(Boolean);
    const organizerIds = [...new Set(groupBookings.map(gb => gb.organizerId).filter(Boolean))];
    const memberUserIds = [...new Set(
      groupBookings.flatMap(gb => gb.members?.map(m => m.userId) || []).filter(Boolean)
    )];

    // Batch fetch all related documents in parallel
    const [bookings, organizers, memberUsers] = await Promise.all([
      Booking.find({ _id: { $in: bookingIds } }).lean(),
      User.find({ _id: { $in: organizerIds } }).lean(),
      User.find({ _id: { $in: memberUserIds } }).lean(),
    ]);

    // Get resource IDs from bookings and fetch them
    const resourceIds = [...new Set(bookings.map(b => b.resourceId).filter(Boolean))];
    const resources = await Resource.find({ _id: { $in: resourceIds } }).lean();

    // Create lookup Maps for O(1) access
    const bookingMap = new Map(bookings.map(b => [b._id.toString(), b]));
    const organizerMap = new Map(organizers.map(o => [o._id.toString(), o]));
    const memberUserMap = new Map(memberUsers.map(u => [u._id.toString(), u]));
    const resourceMap = new Map(resources.map(r => [r._id.toString(), r]));

    // Enrich with booking, resource, and user details (no DB calls in loop)
    const enriched = groupBookings.map((gb) => {
      const booking = bookingMap.get(gb.bookingId?.toString());
      const resource = booking ? resourceMap.get(booking.resourceId?.toString()) : null;
      const organizer = organizerMap.get(gb.organizerId?.toString());

      // Get member details from pre-fetched users
      const memberDetails = (gb.members || []).map((member) => {
        const user = memberUserMap.get(member.userId?.toString());
        return {
          userId: member.userId,
          email: member.email,
          name: member.name,
          status: member.status,
          invitedAt: member.invitedAt,
          respondedAt: member.respondedAt,
          userName: user?.name || 'Unknown',
        };
      });

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
    });

    return NextResponse.json({ groupBookings: enriched });

  } catch (error) {
    console.error('Fetch group bookings error:', error);
    return handleApiError(error);
  }
}
