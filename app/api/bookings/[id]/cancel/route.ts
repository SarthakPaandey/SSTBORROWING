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

      // Check if cancellation is late (within 2 hours of start) - using UTC
      const now = new Date();
      const hoursUntilStart =
        (new Date(booking.start).getTime() - now.getTime()) / (1000 * 60 * 60);
      const isLateCancellation = hoursUntilStart < POLICIES.LATE_CANCELLATION_HOURS;

      // Apply penalty for all cancellations (0.25 points)
      const penaltyApplied = POLICIES.PENALTY_CANCELLATION;

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

      // Create penalty record for audit trail
      await Penalty.create([{
        userId: booking.userId,
        bookingId: booking.id,
        points: penaltyApplied,
        reason: isLateCancellation
          ? `Late cancellation (${hoursUntilStart.toFixed(1)}h before start)`
          : 'Booking cancellation',
      }], { session });

      // Update user penalty points
      // FIX: booking.userId is the ObjectId, not email
      const userRecord = await User.findById(booking.userId).session(session);
      if (userRecord) {
        userRecord.penaltyPoints += penaltyApplied;
        await userRecord.save({ session });
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
        penaltyApplied,
      }], { session });

      // Update booking status
      booking.status = 'CANCELLED';
      await booking.save({ session });

      return {
        booking,
        wasLateCancellation: isLateCancellation,
        penaltyApplied,
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
