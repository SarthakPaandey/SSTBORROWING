import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Booking } from '@/models/Booking';
import { Resource } from '@/models/Resource';
import { User } from '@/models/User';
import { requireAuth } from '@/lib/auth/guards';
import { handleApiError } from '@/lib/errors';

export async function GET(req: NextRequest) {
    try {
        await requireAuth(['GUARD', 'ADMIN']);
        await connectDB();

        // Fetch completed bookings (returns)
        const bookings = await Booking.find({
            status: 'COMPLETED',
            kind: { $in: ['EQUIPMENT', 'LIBRARY'] },
        })
            .sort({ returnedAt: -1, updatedAt: -1 })
            .limit(100)
            .lean();

        // Populate resource names
        const resourceIds = [...new Set(bookings.map(b => b.resourceId))];
        const resources = await Resource.find({ _id: { $in: resourceIds } }).lean();
        const resourceMap = new Map(resources.map(r => [(r as any)._id.toString(), r.name]));

        // Populate user details
        const userIds = [...new Set(bookings.map(b => b.userId))];
        const users = await User.find({ _id: { $in: userIds } }).lean();
        const userMap = new Map(users.map(u => [(u as any)._id.toString(), u.name || u.email]));

        const enrichedBookings = bookings.map(b => ({
            ...(b as any),
            resourceName: resourceMap.get(b.resourceId) || 'Unknown',
            userName: userMap.get(b.userId) || 'Unknown',
        }));

        return NextResponse.json({ bookings: enrichedBookings });
    } catch (error) {
        console.error('Guard history error:', error);
        return handleApiError(error);
    }
}
