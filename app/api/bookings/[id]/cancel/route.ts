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
      if (!['PENDING', 'CONFIRMED', 'CHECKED_IN'].includes(booking.status)) {
        throw new ValidationError('Cannot cancel booking in current state');
      }

      // FIX EC-6: Use UTC for comparison (both dates are UTC)
      const bookingStartTime = new Date(booking.start).getTime();
      const currentTime = new Date().getTime();

      if (currentTime > bookingStartTime) {
        throw new ValidationError('Cannot cancel past bookings');
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

      // FIX EC-5: If booking was CHECKED_IN, restore inventory
      if (booking.status === 'CHECKED_IN' && booking.items && booking.items.length > 0) {
        for (const item of booking.items) {
          const equipmentItem = await EquipmentItem.findById(item.itemId).session(session);
          if (equipmentItem) {
            equipmentItem.qtyAvailable += item.qty;
            await equipmentItem.save({ session });
          }
        }
      }

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
