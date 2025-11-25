import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import { connectDB } from '@/lib/db';
import { Booking } from '@/models/Booking';
import { format } from 'date-fns';
import { getNow, getStartOfDay, getEndOfDay, getDaysAgo } from '@/lib/timezone';

export async function GET() {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user || session.user.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        await connectDB();

        // FIX: Use IST timezone for accurate day boundaries
        // 1. Bookings by Type (Last 30 days)
        const thirtyDaysAgo = getDaysAgo(30);

        const bookingsByType = await Booking.aggregate([
            { $match: { start: { $gte: thirtyDaysAgo } } },
            { $group: { _id: '$kind', count: { $sum: 1 } } }
        ]);

        // 2. Weekly Activity (Last 7 days) - using IST timezone
        const last7Days = Array.from({ length: 7 }, (_, i) => {
            return getDaysAgo(6 - i);
        });

        const weeklyActivity = await Promise.all(
            last7Days.map(async (dayStart) => {
                // FIX: Use getEndOfDay for accurate day boundary
                const dayEnd = getEndOfDay(dayStart);

                const count = await Booking.countDocuments({
                    start: { $gte: dayStart, $lte: dayEnd }
                });

                return {
                    date: format(dayStart, 'EEE'), // Mon, Tue, etc.
                    fullDate: format(dayStart, 'yyyy-MM-dd'),
                    count
                };
            })
        );

        // 3. Status Distribution (Last 30 days)
        const statusDistribution = await Booking.aggregate([
            { $match: { start: { $gte: thirtyDaysAgo } } },
            { $group: { _id: '$status', count: { $sum: 1 } } }
        ]);

        return NextResponse.json({
            bookingsByType: bookingsByType.map(b => ({ name: b._id, value: b.count })),
            weeklyActivity,
            statusDistribution: statusDistribution.map(s => ({ name: s._id, value: s.count }))
        });

    } catch (error) {
        console.error('Stats API Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
