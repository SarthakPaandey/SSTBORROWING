import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import { connectDB } from '@/lib/db';
import { Booking } from '@/models/Booking';
import { startOfDay, subDays, format } from 'date-fns';

export async function GET() {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user || session.user.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        await connectDB();

        // 1. Bookings by Type (All time or last 30 days? Let's do last 30 days for relevance)
        const thirtyDaysAgo = subDays(new Date(), 30);

        const bookingsByType = await Booking.aggregate([
            { $match: { start: { $gte: thirtyDaysAgo } } },
            { $group: { _id: '$kind', count: { $sum: 1 } } }
        ]);

        // 2. Weekly Activity (Last 7 days)
        const last7Days = Array.from({ length: 7 }, (_, i) => {
            const d = subDays(new Date(), 6 - i);
            return startOfDay(d);
        });

        const weeklyActivity = await Promise.all(
            last7Days.map(async (date) => {
                const nextDay = new Date(date);
                nextDay.setDate(date.getDate() + 1);

                const count = await Booking.countDocuments({
                    start: { $gte: date, $lt: nextDay }
                });

                return {
                    date: format(date, 'EEE'), // Mon, Tue, etc.
                    fullDate: format(date, 'yyyy-MM-dd'),
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
