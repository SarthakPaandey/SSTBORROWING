import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Booking } from '@/models/Booking';
import { Resource } from '@/models/Resource';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import { handleApiError, ValidationError, NotFoundError, AuthenticationError } from '@/lib/errors';
import { toIST, getStartOfDay } from '@/lib/timezone';
import { POLICIES } from '@/lib/policies';

// Dynamic route: depends on session headers/cookies
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/availability
 * Returns available and busy time slots for a resource on a specific date
 */
export async function GET(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            throw new AuthenticationError();
        }

        const { searchParams } = new URL(req.url);
        const resourceId = searchParams.get('resourceId');
        const date = searchParams.get('date'); // YYYY-MM-DD format

        if (!resourceId || !date) {
            throw new ValidationError('resourceId and date are required');
        }

        await connectDB();

        // Verify resource exists
        const resource = await Resource.findById(resourceId);
        if (!resource || resource.status !== 'ACTIVE') {
            throw new NotFoundError('Resource');
        }

        // Parse date and get day boundaries in IST
        const dayStart = getStartOfDay(new Date(`${date}T00:00:00+05:30`));
        const dayEnd = new Date(dayStart);
        dayEnd.setDate(dayEnd.getDate() + 1);

        // Build resource ids to check (include shared turf siblings)
        const resourceIds = [resourceId];
        if (resource.sharedGroupId) {
            const siblings = await Resource.find({
                sharedGroupId: resource.sharedGroupId,
                status: 'ACTIVE',
            }).select('_id');
            resourceIds.push(...siblings.map((s) => String(s._id)));
        }

        // Get all bookings for this resource (and shared turf siblings) on this date
        const bookings = await Booking.find({
            resourceId: { $in: resourceIds },
            status: { $in: ['CONFIRMED', 'CHECKED_IN', 'PENDING'] },
            start: { $lt: dayEnd },
            end: { $gt: dayStart },
        }).select('start end');

        // Convert bookings to busy slots in HH:MM format
        const busySlots = bookings.map((booking) => {
            const startIST = toIST(new Date(booking.start));
            const endIST = toIST(new Date(booking.end));

            const formatTime = (date: Date) => {
                const hours = date.getHours().toString().padStart(2, '0');
                const minutes = date.getMinutes().toString().padStart(2, '0');
                return `${hours}:${minutes}`;
            };

            return {
                start: formatTime(startIST),
                end: formatTime(endIST),
            };
        });

        // Working hours (from policies)
        const pad = (n: number) => n.toString().padStart(2, '0');
        const workingHours = {
            start: `${pad(POLICIES.WORKING_HOURS_START)}:00`,
            end: `${pad(POLICIES.WORKING_HOURS_END)}:00`,
        };

        return NextResponse.json({
            resourceId,
            date,
            busySlots,
            workingHours,
        });
    } catch (error) {
        console.error('Availability fetch error:', error);
        return handleApiError(error);
    }
}
