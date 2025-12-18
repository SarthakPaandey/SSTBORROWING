import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Booking } from '@/models/Booking';
import { Penalty } from '@/models/Penalty';
import { Resource } from '@/models/Resource';
import { getDaysAgo } from '@/lib/timezone';
import { requireAuth } from '@/lib/auth/guards';
import { handleApiError } from '@/lib/errors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/analytics
 * 
 * Query params:
 * - days: Number of days to analyze (default 30)
 */
export async function GET(request: NextRequest) {
    try {
        await requireAuth(['ADMIN']);
        await connectDB();

        const { searchParams } = new URL(request.url);
        const days = Math.min(parseInt(searchParams.get('days') || '30', 10), 90);

        const startDate = getDaysAgo(days);

        // 1. Usage Heatmap - Hour by Day of Week
        const heatmapData = await Booking.aggregate([
            {
                $match: {
                    start: { $gte: startDate },
                    status: { $in: ['CONFIRMED', 'CHECKED_IN', 'COMPLETED'] },
                },
            },
            {
                $project: {
                    hour: { $hour: '$start' },
                    dayOfWeek: { $dayOfWeek: '$start' }, // 1 = Sunday, 7 = Saturday
                },
            },
            {
                $group: {
                    _id: { hour: '$hour', dayOfWeek: '$dayOfWeek' },
                    count: { $sum: 1 },
                },
            },
            {
                $sort: { '_id.dayOfWeek': 1, '_id.hour': 1 },
            },
        ]);

        // Transform heatmap data into matrix format
        const heatmap: { day: string; hour: number; count: number }[] = [];
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

        for (let day = 1; day <= 7; day++) {
            for (let hour = 0; hour < 24; hour++) {
                const found = heatmapData.find(
                    d => d._id.dayOfWeek === day && d._id.hour === hour
                );
                heatmap.push({
                    day: dayNames[day - 1],
                    hour,
                    count: found?.count || 0,
                });
            }
        }

        // 2. Resource Utilization (bookings per resource)
        const resources = await Resource.find({}).lean();
        const utilizationData = await Booking.aggregate([
            {
                $match: {
                    start: { $gte: startDate },
                    status: { $in: ['CONFIRMED', 'CHECKED_IN', 'COMPLETED'] },
                },
            },
            {
                $group: {
                    _id: '$resourceId',
                    totalBookings: { $sum: 1 },
                    totalHours: {
                        $sum: {
                            $divide: [
                                { $subtract: ['$end', '$start'] },
                                1000 * 60 * 60 // Convert ms to hours
                            ]
                        }
                    },
                },
            },
            {
                $sort: { totalBookings: -1 },
            },
            {
                $limit: 15,
            },
        ]);

        const resourceMap = new Map(resources.map(r => [r._id.toString(), r]));
        const utilization = utilizationData.map(u => ({
            resourceId: u._id,
            resourceName: resourceMap.get(u._id)?.name || 'Unknown',
            resourceType: resourceMap.get(u._id)?.type || 'Unknown',
            totalBookings: u.totalBookings,
            totalHours: Math.round(u.totalHours * 10) / 10,
        }));

        // 3. Penalty Trends by Resource Type
        const penaltyData = await Penalty.aggregate([
            {
                $match: {
                    createdAt: { $gte: startDate },
                    waivedBy: null, // Only count active penalties
                },
            },
            {
                $lookup: {
                    from: 'bookings',
                    localField: 'bookingId',
                    foreignField: '_id',
                    as: 'booking',
                },
            },
            {
                $unwind: { path: '$booking', preserveNullAndEmptyArrays: true },
            },
            {
                $group: {
                    _id: '$booking.kind',
                    count: { $sum: 1 },
                    totalPoints: { $sum: '$points' },
                },
            },
            {
                $sort: { count: -1 },
            },
        ]);

        const penaltyTrends = penaltyData.map(p => ({
            type: p._id || 'Unknown',
            count: p.count,
            totalPoints: p.totalPoints,
        }));

        // 4. Booking Status Distribution
        const statusData = await Booking.aggregate([
            {
                $match: {
                    start: { $gte: startDate },
                },
            },
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 },
                },
            },
        ]);

        const statusDistribution = statusData.map(s => ({
            status: s._id,
            count: s.count,
        }));

        // 5. Daily Activity Trend
        const dailyData = await Booking.aggregate([
            {
                $match: {
                    start: { $gte: getDaysAgo(14) }, // Last 14 days
                },
            },
            {
                $group: {
                    _id: {
                        $dateToString: { format: '%Y-%m-%d', date: '$start' }
                    },
                    bookings: { $sum: 1 },
                    confirmed: {
                        $sum: { $cond: [{ $eq: ['$status', 'CONFIRMED'] }, 1, 0] }
                    },
                    cancelled: {
                        $sum: { $cond: [{ $eq: ['$status', 'CANCELLED'] }, 1, 0] }
                    },
                },
            },
            {
                $sort: { _id: 1 },
            },
        ]);

        // 6. Peak Hours Summary
        const peakHours = await Booking.aggregate([
            {
                $match: {
                    start: { $gte: startDate },
                    status: { $in: ['CONFIRMED', 'CHECKED_IN', 'COMPLETED'] },
                },
            },
            {
                $group: {
                    _id: { $hour: '$start' },
                    count: { $sum: 1 },
                },
            },
            {
                $sort: { count: -1 },
            },
            {
                $limit: 5,
            },
        ]);

        // 7. Summary Stats
        const [totalBookings, completedBookings, totalPenalties] = await Promise.all([
            Booking.countDocuments({ start: { $gte: startDate } }),
            Booking.countDocuments({
                start: { $gte: startDate },
                status: { $in: ['COMPLETED', 'CHECKED_IN'] }
            }),
            Penalty.countDocuments({ createdAt: { $gte: startDate }, waivedBy: null }),
        ]);

        return NextResponse.json({
            period: { days, startDate: startDate.toISOString() },
            heatmap,
            utilization,
            penaltyTrends,
            statusDistribution,
            dailyActivity: dailyData,
            peakHours: peakHours.map(p => ({ hour: p._id, count: p.count })),
            summary: {
                totalBookings,
                completedBookings,
                completionRate: totalBookings > 0
                    ? Math.round((completedBookings / totalBookings) * 100)
                    : 0,
                totalPenalties,
                avgBookingsPerDay: Math.round(totalBookings / days * 10) / 10,
            },
        });

    } catch (error) {
        return handleApiError(error);
    }
}
