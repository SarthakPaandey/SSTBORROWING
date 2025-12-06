import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { connectDB } from '@/lib/db';
import { Booking } from '@/models/Booking';
import { Resource } from '@/models/Resource';
import { User } from '@/models/User';
import { requireAuth } from '@/lib/auth/guards';
import { handleApiError, AuthorizationError } from '@/lib/errors';

// Dynamic route: relies on auth headers/cookies for guard role checks
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth();

    // Only guards can access this
    if (user.role !== 'GUARD') {
      throw new AuthorizationError();
    }

    await connectDB();

    // Find all equipment bookings that are checked in but not yet completed
    const bookings = await Booking.find({
      kind: 'EQUIPMENT',
      status: 'CHECKED_IN',
    })
      .sort({ checkedInAt: -1 })
      .lean();

    // Enrich with resource and user names (skip invalid ObjectIds to avoid CastErrors)
    const resourceIds = [...new Set(bookings.map((b) => b.resourceId).filter(Boolean))];
    const validResourceIds = resourceIds.filter((id) => mongoose.Types.ObjectId.isValid(id));
    const resources = validResourceIds.length
      ? await Resource.find({ _id: { $in: validResourceIds } }).lean()
      : [];

    const userIds = [...new Set(bookings.map((b) => b.userId).filter(Boolean))];
    const validUserIds = userIds.filter((id) => mongoose.Types.ObjectId.isValid(id));
    const users = validUserIds.length
      ? await User.find({ _id: { $in: validUserIds } }).lean()
      : [];

    const resourceMap = new Map(resources.map((r) => [r._id.toString(), r]));
    const userMap = new Map(users.map((u) => [u._id.toString(), u]));

    const enrichedBookings = bookings.map((b) => ({
      ...b,
      resourceName: resourceMap.get(b.resourceId)?.name || 'Unknown',
      userName: userMap.get(b.userId)?.name || 'Unknown',
    }));

    return NextResponse.json({ bookings: enrichedBookings });
  } catch (error) {
    console.error('Issued equipment error:', error);
    return handleApiError(error);
  }
}
