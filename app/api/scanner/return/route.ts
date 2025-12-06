import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Booking } from '@/models/Booking';
import { EquipmentItem } from '@/models/EquipmentItem';
import { Penalty } from '@/models/Penalty';
import { requireAuth } from '@/lib/auth/guards';
import { POLICIES } from '@/lib/policies';
import { recalculatePenaltyPoints } from '@/lib/groupBookingPenalties';
import { handleApiError, NotFoundError, ValidationError, ConflictError } from '@/lib/errors';
import mongoose from 'mongoose';

export async function POST(req: NextRequest) {
  let session: mongoose.ClientSession | null = null;

  try {
    // Must connect to DB before starting a session
    await connectDB();
    session = await mongoose.startSession();

    const guard = await requireAuth(['GUARD', 'ADMIN']);

    const { bookingId, items, condition } = await req.json();

    if (!bookingId) {
      throw new ValidationError('Booking ID required');
    }

    // Start transaction for atomicity
    await session.startTransaction();

    const booking = await Booking.findById(bookingId).session(session);
    if (!booking) {
      await session.abortTransaction();
      throw new NotFoundError('Booking');
    }

    if (booking.kind !== 'EQUIPMENT' && booking.kind !== 'LIBRARY') {
      await session.abortTransaction();
      throw new ValidationError('Only equipment and library bookings can be returned');
    }

    if (booking.status !== 'CHECKED_IN') {
      await session.abortTransaction();
      throw new ValidationError('Booking must be checked in to return');
    }

    // FIX EC-2: Explicit check to prevent double returns
    // This prevents race condition where double-tap could increment inventory twice
    if (booking.returnedAt) {
      await session.abortTransaction();
      throw new ConflictError('Equipment already returned');
    }

    // Restore equipment quantities (only if checked in)
    if (booking.items) {
      for (const item of booking.items) {
        await EquipmentItem.findByIdAndUpdate(
          item.itemId,
          {
            $inc: { qtyAvailable: item.qty }
          },
          { session }
        );
      }
    }

    // Check if late - use UTC for DB comparison
    // FIX: Apply same grace period logic as guard/return-equipment for consistency
    const now = new Date(); // UTC

    // Dynamic Return Deadline Logic (aligned with guard/return-equipment):
    // If user picked up late, they get equal extra time to return.
    let adjustedEndTime = new Date(booking.end).getTime();

    if (booking.checkedInAt) {
      const pickupTime = new Date(booking.checkedInAt).getTime();
      const startTime = new Date(booking.start).getTime();
      const pickupDelay = pickupTime - startTime;

      // Only extend if picked up late (positive delay)
      if (pickupDelay > 0) {
        adjustedEndTime += pickupDelay;
      }
    }

    // Add 15-minute grace period for returns
    const RETURN_GRACE_PERIOD_MS = 15 * 60 * 1000;
    adjustedEndTime += RETURN_GRACE_PERIOD_MS;

    const isLate = now.getTime() > adjustedEndTime;

    let penaltyApplied = false;

    if (isLate) {
      // Apply late penalty
      await Penalty.create([{
        userId: booking.userId,
        bookingId: booking.id,
        points: POLICIES.PENALTY_LATE_RETURN,
        reason: 'Late equipment return',
      }], { session });

      penaltyApplied = true;
    }

    // Check for damage (if condition provided)
    if (condition === 'damaged') {
      await Penalty.create([{
        userId: booking.userId,
        bookingId: booking.id,
        points: POLICIES.PENALTY_DAMAGE,
        reason: 'Equipment returned damaged',
      }], { session });

      penaltyApplied = true;
    }

    // Complete booking and mark as returned
    booking.status = 'COMPLETED';
    booking.returnedAt = now;  // Use UTC for consistency
    await booking.save({ session });

    // Commit transaction
    if (penaltyApplied) {
      // Enforce three-strike escalation logic inside the transaction to prevent races
      await recalculatePenaltyPoints(booking.userId, session);
    }

    await session.commitTransaction();

    return NextResponse.json({
      success: true,
      booking,
      penaltyApplied,
      message: penaltyApplied
        ? 'Equipment returned with penalty applied'
        : 'Equipment returned successfully',
    });
  } catch (error) {
    if (session?.inTransaction()) {
      await session.abortTransaction();
    }
    console.error('Return error:', error);
    return handleApiError(error);
  } finally {
    if (session) {
      session.endSession();
    }
  }
}

