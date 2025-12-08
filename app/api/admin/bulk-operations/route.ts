import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import { connectDB } from '@/lib/db';
import { Booking } from '@/models/Booking';
import { Resource } from '@/models/Resource';
import { User } from '@/models/User';
import { getActorFromSession, logBulkAuditEvent } from '@/lib/audit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/bulk-operations
 * 
 * Body: { operation: string, ...params }
 * 
 * Operations:
 * - bulk-approve: { bookingIds: string[] }
 * - bulk-reject: { bookingIds: string[], reason?: string }
 * - cancel-by-date: { date: string, resourceType?: string, resourceId?: string }
 * - notify-users: { userIds: string[], message: string, subject: string }
 */
export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user || session.user.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        await connectDB();

        const body = await request.json();
        const { operation } = body;

        switch (operation) {
            case 'bulk-approve':
                return handleBulkApprove(body, session.user);

            case 'bulk-reject':
                return handleBulkReject(body, session.user);

            case 'cancel-by-date':
                return handleCancelByDate(body, session.user);

            default:
                return NextResponse.json({ error: 'Invalid operation' }, { status: 400 });
        }

    } catch (error) {
        console.error('Bulk Operations Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

/**
 * Bulk approve pending bookings
 */
async function handleBulkApprove(
    body: { bookingIds: string[] },
    user: { id?: string; email?: string | null; name?: string | null }
) {
    const { bookingIds } = body;

    if (!bookingIds || !Array.isArray(bookingIds) || bookingIds.length === 0) {
        return NextResponse.json({ error: 'No booking IDs provided' }, { status: 400 });
    }

    // Maximum 50 at a time to prevent abuse
    if (bookingIds.length > 50) {
        return NextResponse.json({ error: 'Maximum 50 bookings can be processed at once' }, { status: 400 });
    }

    // Find bookings that are pending approval and haven't started yet
    const now = new Date();
    const bookings = await Booking.find({
        _id: { $in: bookingIds },
        approval: 'PENDING',
        start: { $gt: now },
    });

    if (bookings.length === 0) {
        return NextResponse.json({
            error: 'No valid pending bookings found',
            details: 'Bookings may have already started or been processed'
        }, { status: 400 });
    }

    // Update all matching bookings
    const result = await Booking.updateMany(
        {
            _id: { $in: bookings.map(b => b._id) },
            approval: 'PENDING',
        },
        {
            $set: {
                approval: 'APPROVED',
                status: 'CONFIRMED',
                approvedBy: user.id,
                approvedAt: new Date(),
            },
        }
    );

    // Get resource names for audit log
    const resourceIds = [...new Set(bookings.map(b => b.resourceId))];
    const resources = await Resource.find({ _id: { $in: resourceIds } });
    const resourceMap = new Map(resources.map(r => [r._id.toString(), r.name]));

    // Log audit events
    await logBulkAuditEvent(
        'BULK_APPROVE',
        getActorFromSession(user),
        bookings.map(b => ({
            type: 'BOOKING' as const,
            id: b._id.toString(),
            name: resourceMap.get(b.resourceId) || 'Unknown Resource',
        })),
        { totalApproved: result.modifiedCount }
    );

    return NextResponse.json({
        success: true,
        message: `Successfully approved ${result.modifiedCount} booking(s)`,
        processed: result.modifiedCount,
        requested: bookingIds.length,
    });
}

/**
 * Bulk reject pending bookings
 */
async function handleBulkReject(
    body: { bookingIds: string[]; reason?: string },
    user: { id?: string; email?: string | null; name?: string | null }
) {
    const { bookingIds, reason } = body;

    if (!bookingIds || !Array.isArray(bookingIds) || bookingIds.length === 0) {
        return NextResponse.json({ error: 'No booking IDs provided' }, { status: 400 });
    }

    if (bookingIds.length > 50) {
        return NextResponse.json({ error: 'Maximum 50 bookings can be processed at once' }, { status: 400 });
    }

    const bookings = await Booking.find({
        _id: { $in: bookingIds },
        approval: 'PENDING',
    });

    if (bookings.length === 0) {
        return NextResponse.json({ error: 'No valid pending bookings found' }, { status: 400 });
    }

    const result = await Booking.updateMany(
        {
            _id: { $in: bookings.map(b => b._id) },
            approval: 'PENDING',
        },
        {
            $set: {
                approval: 'REJECTED',
                status: 'CANCELLED',
            },
        }
    );

    // Get resource names for audit log
    const resourceIds = [...new Set(bookings.map(b => b.resourceId))];
    const resources = await Resource.find({ _id: { $in: resourceIds } });
    const resourceMap = new Map(resources.map(r => [r._id.toString(), r.name]));

    await logBulkAuditEvent(
        'BULK_REJECT',
        getActorFromSession(user),
        bookings.map(b => ({
            type: 'BOOKING' as const,
            id: b._id.toString(),
            name: resourceMap.get(b.resourceId) || 'Unknown Resource',
        })),
        { totalRejected: result.modifiedCount, reason: reason || 'No reason provided' }
    );

    return NextResponse.json({
        success: true,
        message: `Successfully rejected ${result.modifiedCount} booking(s)`,
        processed: result.modifiedCount,
        requested: bookingIds.length,
    });
}

/**
 * Cancel all bookings for a specific date
 */
async function handleCancelByDate(
    body: { date: string; resourceType?: string; resourceId?: string; reason?: string },
    user: { id?: string; email?: string | null; name?: string | null }
) {
    const { date, resourceType, resourceId, reason } = body;

    if (!date) {
        return NextResponse.json({ error: 'Date is required' }, { status: 400 });
    }

    // Parse date and create day boundaries
    const targetDate = new Date(date);
    const dayStart = new Date(targetDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(targetDate);
    dayEnd.setHours(23, 59, 59, 999);

    // Prevent cancelling past bookings
    if (dayEnd < new Date()) {
        return NextResponse.json({ error: 'Cannot cancel bookings in the past' }, { status: 400 });
    }

    // Build query
    const query: Record<string, unknown> = {
        status: { $in: ['CONFIRMED', 'PENDING'] },
        start: { $gte: dayStart, $lte: dayEnd },
    };

    if (resourceId) {
        query.resourceId = resourceId;
    } else if (resourceType) {
        // Get all resources of this type
        const resources = await Resource.find({ type: resourceType });
        query.resourceId = { $in: resources.map(r => r._id) };
    }

    // Find bookings first for audit log
    const bookings = await Booking.find(query);

    if (bookings.length === 0) {
        return NextResponse.json({
            success: true,
            message: 'No bookings found for the specified criteria',
            processed: 0,
        });
    }

    // Cancel bookings
    const result = await Booking.updateMany(
        { _id: { $in: bookings.map(b => b._id) } },
        { $set: { status: 'CANCELLED' } }
    );

    // Get resource names for audit log
    const resourceIds = [...new Set(bookings.map(b => b.resourceId))];
    const resources = await Resource.find({ _id: { $in: resourceIds } });
    const resourceMap = new Map(resources.map(r => [r._id.toString(), r.name]));

    await logBulkAuditEvent(
        'BULK_CANCEL',
        getActorFromSession(user),
        bookings.map(b => ({
            type: 'BOOKING' as const,
            id: b._id.toString(),
            name: resourceMap.get(b.resourceId) || 'Unknown Resource',
        })),
        {
            date: date,
            resourceType: resourceType || 'all',
            reason: reason || 'Admin cancelled',
            totalCancelled: result.modifiedCount,
        }
    );

    // Get affected users for notification (optional TODO: send emails)
    const userIds = [...new Set(bookings.map(b => b.userId))];
    const users = await User.find({ _id: { $in: userIds } });

    return NextResponse.json({
        success: true,
        message: `Successfully cancelled ${result.modifiedCount} booking(s)`,
        processed: result.modifiedCount,
        affectedUsers: users.length,
        date: date,
    });
}

/**
 * GET /api/admin/bulk-operations
 * 
 * Get data needed for bulk operations UI
 * - Count of pending approvals
 * - Resources list for filtering
 */
export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user || session.user.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        await connectDB();

        const [pendingCount, pendingBookings, resources] = await Promise.all([
            Booking.countDocuments({ approval: 'PENDING' }),
            Booking.find({ approval: 'PENDING' })
                .sort({ createdAt: -1 })
                .limit(100)
                .lean(),
            Resource.find({}).select('_id name type').lean(),
        ]);

        // Enrich bookings with resource info
        const resourceMap = new Map(resources.map(r => [r._id.toString(), r]));
        const enrichedBookings = pendingBookings.map(b => ({
            ...b,
            resourceName: resourceMap.get(b.resourceId)?.name || 'Unknown',
            resourceType: resourceMap.get(b.resourceId)?.type || 'Unknown',
        }));

        // Get unique resource types
        const resourceTypes = [...new Set(resources.map(r => r.type))];

        return NextResponse.json({
            pendingCount,
            pendingBookings: enrichedBookings,
            resources,
            resourceTypes,
        });

    } catch (error) {
        console.error('Bulk Operations GET Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
