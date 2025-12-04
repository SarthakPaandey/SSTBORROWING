import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Booking } from '@/models/Booking';
import { Resource } from '@/models/Resource';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import { handleApiError, ValidationError, NotFoundError, AuthenticationError } from '@/lib/errors';
import { toIST, getStartOfDay } from '@/lib/timezone';

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

        // Get all bookings for this resource on this date
        const bookings = await Booking.find({
            resourceId,
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

        // Working hours (8:00 AM - 8:00 PM)
        const workingHours = {
            start: '08:00',
            end: '20:00',
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
