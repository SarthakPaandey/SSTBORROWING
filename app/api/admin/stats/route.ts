import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import { connectDB } from '@/lib/db';
import { Booking } from '@/models/Booking';
import { Penalty } from '@/models/Penalty';
import { format } from 'date-fns';
import { getNow, getStartOfDayUTC, getEndOfDayUTC, getDaysAgo } from '@/lib/timezone';
import { requireAuth } from '@/lib/auth/guards';
import { handleApiError } from '@/lib/errors';

// Dynamic route: uses auth session (headers/cookies) and DB
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
    try {
        await requireAuth(['ADMIN']);
        await connectDB();

        // FIX: Use UTC day boundaries for DB queries to avoid 5.5h offset error
        // 1. Bookings by Type (Last 30 days)
        const thirtyDaysAgo = getDaysAgo(30);

        const bookingsByType = await Booking.aggregate([
            { $match: { start: { $gte: thirtyDaysAgo } } },
            { $group: { _id: '$kind', count: { $sum: 1 } } }
        ]);

        // 2. Weekly Activity (Last 7 days) - using IST timezone boundaries in UTC
        const last7Days = Array.from({ length: 7 }, (_, i) => {
            const day = getDaysAgo(6 - i);
            return {
                start: getStartOfDayUTC(day),
                end: getEndOfDayUTC(day)
            };
        });

        const weeklyActivity = await Promise.all(
            last7Days.map(async (day) => {
                const count = await Booking.countDocuments({
                    start: { $gte: day.start, $lte: day.end }
                });

                return {
                    date: format(day.start, 'EEE'), // Mon, Tue, etc.
                    fullDate: format(day.start, 'yyyy-MM-dd'),
                    count
                };
            })
        );

        // 3. Status Distribution (Last 30 days)
        const statusDistribution = await Booking.aggregate([
            { $match: { start: { $gte: thirtyDaysAgo } } },
            { $group: { _id: '$status', count: { $sum: 1 } } }
        ]);

        // 4. Penalty Stats
        const todayStart = getStartOfDayUTC();
        const todayEnd = getEndOfDayUTC();
        const sevenDaysAgo = getDaysAgo(7);

        const [todayPenalties, last7DaysPenalties, totalPenalties] = await Promise.all([
            Penalty.countDocuments({ createdAt: { $gte: todayStart, $lte: todayEnd } }),
            Penalty.countDocuments({ createdAt: { $gte: sevenDaysAgo } }),
            Penalty.countDocuments({})
        ]);

        return NextResponse.json({
            bookingsByType: bookingsByType.map(b => ({ name: b._id, value: b.count })),
            weeklyActivity,
            statusDistribution: statusDistribution.map(s => ({ name: s._id, value: s.count })),
            penaltyStats: {
                today: todayPenalties,
                last7Days: last7DaysPenalties,
                total: totalPenalties
            }
        });

    } catch (error) {
        return handleApiError(error);
    }
}
