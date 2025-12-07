import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Booking } from '@/models/Booking';
import { requireAuth } from '@/lib/auth/guards';
import { handleApiError, ValidationError } from '@/lib/errors';
import mongoose from 'mongoose';

/**
 * POST /api/admin/bookings/bulk-cancel
 * Bulk cancel multiple bookings at once without applying penalties
 * 
 * Body: { bookingIds: string[], reason?: string }
 */
export async function POST(req: NextRequest) {
    try {
        const admin = await requireAuth(['ADMIN']);
        await connectDB();

        const { bookingIds, reason } = await req.json();

        if (!bookingIds || !Array.isArray(bookingIds) || bookingIds.length === 0) {
            throw new ValidationError('bookingIds array is required');
        }

        if (bookingIds.length > 50) {
            throw new ValidationError('Cannot cancel more than 50 bookings at once');
        }

        // Validate all IDs
        const invalidIds = bookingIds.filter(id => !mongoose.Types.ObjectId.isValid(id));
        if (invalidIds.length > 0) {
            throw new ValidationError(`Invalid booking IDs: ${invalidIds.join(', ')}`);
        }

        const now = new Date();
        const results: Array<{ id: string; success: boolean; error?: string }> = [];

        // Process each booking
        for (const bookingId of bookingIds) {
            try {
                const booking = await Booking.findById(bookingId);

                if (!booking) {
                    results.push({ id: bookingId, success: false, error: 'Booking not found' });
                    continue;
                }

                // Check if booking can be cancelled
                if (['CANCELLED', 'NO_SHOW', 'COMPLETED'].includes(booking.status)) {
                    results.push({
                        id: bookingId,
                        success: false,
                        error: `Already ${booking.status.toLowerCase()}`
                    });
                    continue;
                }

                // Force cancel without penalty
                booking.status = 'CANCELLED';
                booking.overrideBy = admin.id;
                booking.overrideAt = now;
                booking.overrideReason = reason || 'Bulk cancel by admin';

                await booking.save();
                results.push({ id: bookingId, success: true });
            } catch (error) {
                results.push({
                    id: bookingId,
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        }

        const successCount = results.filter(r => r.success).length;
        const failCount = results.filter(r => !r.success).length;

        return NextResponse.json({
            success: failCount === 0,
            message: `Cancelled ${successCount} booking(s)${failCount > 0 ? `, ${failCount} failed` : ''}`,
            results,
            summary: {
                total: bookingIds.length,
                succeeded: successCount,
                failed: failCount,
            },
        });
    } catch (error) {
        return handleApiError(error);
    }
}
