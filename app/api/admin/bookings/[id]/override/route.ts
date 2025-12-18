import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Booking } from '@/models/Booking';
import { requireAuth } from '@/lib/auth/guards';
import { handleApiError, NotFoundError, ValidationError } from '@/lib/errors';
import mongoose from 'mongoose';

/**
 * Admin Override API - Force actions on bookings without penalties
 * 
 * Actions:
 * - force_cancel: Cancel booking without applying penalties to user
 * - force_complete: Mark booking as completed early
 */
export async function POST(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const admin = await requireAuth(['ADMIN']);
        await connectDB();

        // Validate ObjectId
        if (!mongoose.Types.ObjectId.isValid(params.id)) {
            throw new ValidationError('Invalid booking ID format');
        }

        const { action, reason } = await req.json();

        if (!action) {
            throw new ValidationError('Action is required');
        }

        if (!['force_cancel', 'force_complete'].includes(action)) {
            throw new ValidationError('Invalid action. Must be "force_cancel" or "force_complete"');
        }

        const booking = await Booking.findById(params.id);
        if (!booking) {
            throw new NotFoundError('Booking');
        }

        // Check if booking can be modified
        if (['CANCELLED', 'NO_SHOW'].includes(booking.status)) {
            throw new ValidationError(`Cannot override a ${booking.status.toLowerCase()} booking`);
        }

        const now = new Date();

        if (action === 'force_cancel') {
            // Force cancel without penalty
            // NOTE: No inventory restoration needed - the inventory system uses time-based
            // overlap calculations. Cancelled bookings are automatically excluded.
            booking.status = 'CANCELLED';
            booking.overrideBy = admin.id;
            booking.overrideAt = now;
            booking.overrideReason = reason || 'Admin force cancel';

            await booking.save();

            // FIX: If this is a group booking, update the GroupBooking record as well
            if (booking.isGroupBooking && booking.groupBookingId) {
                const { GroupBooking } = await import('@/models/GroupBooking');
                await GroupBooking.findByIdAndUpdate(
                    booking.groupBookingId,
                    { $set: { status: 'CANCELLED' } }
                );
            }

            return NextResponse.json({
                success: true,
                message: 'Booking force cancelled by admin (no penalty applied)',
                booking: {
                    _id: booking._id,
                    status: booking.status,
                    overrideBy: booking.overrideBy,
                    overrideAt: booking.overrideAt,
                    overrideReason: booking.overrideReason,
                },
            });
        }

        if (action === 'force_complete') {
            // Force complete early (useful for equipment returns etc.)
            booking.status = 'COMPLETED';
            booking.overrideBy = admin.id;
            booking.overrideAt = now;
            booking.overrideReason = reason || 'Admin force complete';

            await booking.save();

            return NextResponse.json({
                success: true,
                message: 'Booking force completed by admin',
                booking: {
                    _id: booking._id,
                    status: booking.status,
                    overrideBy: booking.overrideBy,
                    overrideAt: booking.overrideAt,
                    overrideReason: booking.overrideReason,
                },
            });
        }

        throw new ValidationError('Invalid action');
    } catch (error) {
        return handleApiError(error);
    }
}
