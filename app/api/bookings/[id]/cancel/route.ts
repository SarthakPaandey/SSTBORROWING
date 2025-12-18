import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Booking } from '@/models/Booking';
import { EquipmentItem } from '@/models/EquipmentItem';
import { Cancellation } from '@/models/Cancellation';
import { User } from '@/models/User';
import { Penalty } from '@/models/Penalty';
import { Resource } from '@/models/Resource';
import { requireAuth } from '@/lib/auth/guards';
import { POLICIES } from '@/lib/policies';
import { recalculatePenaltyPoints } from '@/lib/groupBookingPenalties';
import { handleApiError, NotFoundError, AuthorizationError, ValidationError, ConflictError } from '@/lib/errors';
import { withTransaction } from '@/lib/transaction';
import mongoose from 'mongoose';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth();
    const conn = await connectDB();

    // FIX: Validate ObjectId to prevent MongoDB CastError
    if (!mongoose.Types.ObjectId.isValid(params.id)) {
      throw new ValidationError('Invalid booking ID format');
    }

    // FIX EC-10: Wrap all DB operations in transaction for atomicity
    const result = await withTransaction(conn, async (session) => {
      const booking = await Booking.findById(params.id).session(session);

      if (!booking) {
        throw new NotFoundError('Booking');
      }

      // Check ownership or admin
      if (booking.userId !== user.id && user.role !== 'ADMIN') {
        throw new AuthorizationError();
      }

      // Check if can cancel
      // CHECKED_IN bookings can only be "canceled" (early checkout) for rooms/facilities
      // Equipment and Library must be returned via the return flow
      if (booking.status === 'CHECKED_IN') {
        if (booking.kind === 'EQUIPMENT' || booking.kind === 'LIBRARY') {
          throw new ValidationError(
            `Cannot cancel checked-in ${booking.kind.toLowerCase()} bookings. Please return the items instead.`
          );
        }
      } else if (!['PENDING', 'CONFIRMED'].includes(booking.status)) {
        throw new ValidationError('Cannot cancel booking in current state');
      }

      // FIX EC-6: Use UTC for comparison (both dates are UTC)
      const bookingStartTime = new Date(booking.start).getTime();
      const currentTime = new Date().getTime();

      // For equipment/library bookings that haven't been picked up,
      // allow cancellation within the grace period (30 min after start)
      const graceEndTime = bookingStartTime + (POLICIES.NO_SHOW_GRACE_MINUTES * 60 * 1000);

      if (booking.kind === 'EQUIPMENT' || booking.kind === 'LIBRARY') {
        // Equipment can be cancelled up until the grace period ends (if not picked up)
        if (currentTime > graceEndTime) {
          throw new ValidationError('Cannot cancel booking after grace period has ended');
        }
      } else {
        // Facilities and rooms cannot be cancelled after start time
        if (currentTime > bookingStartTime) {
          throw new ValidationError('Cannot cancel past bookings');
        }
      }

      // Check if cancellation is late (within 24 hours of start) - using UTC
      const now = new Date();
      const hoursUntilStart =
        (new Date(booking.start).getTime() - now.getTime()) / (1000 * 60 * 60);
      const isLateCancellation = hoursUntilStart < POLICIES.LATE_CANCELLATION_HOURS;

      // Apply penalty for user-initiated cancellations only
      // FIX: Admins canceling on behalf of operations should not penalize users
      const isAdminCanceling = user.role === 'ADMIN' && booking.userId !== user.id;
      const penaltyPoints = isAdminCanceling
        ? 0
        : (isLateCancellation ? POLICIES.PENALTY_LATE_CANCELLATION : POLICIES.PENALTY_CANCELLATION);

      // NOTE: No inventory restoration needed here.
      // The inventory system uses time-based overlap calculations in lib/inventory.ts,
      // NOT qtyAvailable. When a booking is cancelled, it's excluded from overlap checks
      // automatically by status filtering (only PENDING/CONFIRMED/CHECKED_IN count).

      // Create penalty record for audit trail (only for user-initiated cancellations)
      if (penaltyPoints > 0) {
        await Penalty.create([{
          userId: booking.userId,
          bookingId: booking.id,
          points: penaltyPoints,
          reason: isLateCancellation
            ? `Late cancellation (${hoursUntilStart.toFixed(1)}h before start)`
            : 'Booking cancellation',
        }], { session });

        // Recalculate within transaction to enforce three-strike logic
        await recalculatePenaltyPoints(booking.userId, session);
      }

      // Get resource name for logging
      const resource = await Resource.findById(booking.resourceId).session(session);

      // Track the cancellation
      await Cancellation.create([{
        bookingId: booking.id,
        userId: booking.userId,
        resourceId: booking.resourceId,
        resourceName: resource?.name || 'Unknown',
        bookingStart: booking.start,
        cancelledAt: now,
        wasLate: isLateCancellation,
        penaltyApplied: penaltyPoints,
      }], { session });

      // Update booking status
      booking.status = 'CANCELLED';
      await booking.save({ session });

      // FIX: If this is a group booking, update the GroupBooking record as well
      if (booking.isGroupBooking && booking.groupBookingId) {
        const { GroupBooking } = await import('@/models/GroupBooking');
        await GroupBooking.findByIdAndUpdate(
          booking.groupBookingId,
          { $set: { status: 'CANCELLED' } },
          { session }
        );
      }

      return {
        booking,
        wasLateCancellation: isLateCancellation,
        penaltyApplied: penaltyPoints,
      };
    });

    return NextResponse.json({
      ...result,
      message: `Booking cancelled. ${result.penaltyApplied} penalty points applied.`,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
