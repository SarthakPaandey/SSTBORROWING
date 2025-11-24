import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Booking } from '@/models/Booking';
import { EquipmentItem } from '@/models/EquipmentItem';
import { Penalty } from '@/models/Penalty';
import { User } from '@/models/User';
import { requireAuth } from '@/lib/auth/guards';
import { POLICIES, calculateSuspensionDate } from '@/lib/policies';
import { handleApiError, AuthorizationError, ValidationError, NotFoundError, ConflictError } from '@/lib/errors';
import mongoose from 'mongoose';
import { getNow } from '@/lib/timezone';

export async function POST(req: NextRequest) {
  const session = await mongoose.startSession();

  try {
    const guard = await requireAuth(['GUARD', 'ADMIN']);
    await connectDB();

    const { bookingId, condition, notes } = await req.json();

    if (!bookingId) {
      throw new ValidationError('Booking ID required');
    }

    if (!condition) {
      throw new ValidationError('Condition required');
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

    // FIX: Explicit check to prevent double returns (prevents race condition)
    if (booking.returnedAt) {
      await session.abortTransaction();
      throw new ConflictError('Equipment already returned');
    }

    // FIX: Restore equipment quantities atomically (only if checked in)
    // Using $inc for atomic operations to prevent race conditions
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

    // Check if late (using IST timezone)
    const now = getNow();
    const isLate = now > booking.end;

    let penaltyApplied = false;

    if (isLate) {
      // Library books have higher penalty (2 points) vs equipment (1 point)
      const penaltyPoints = booking.kind === 'LIBRARY'
        ? POLICIES.PENALTY_BOOK_LATE_RETURN
        : POLICIES.PENALTY_LATE_RETURN;

      const penaltyReason = booking.kind === 'LIBRARY'
        ? 'Late book return (payment required)'
        : 'Late equipment return';

      // Apply late penalty
      await Penalty.create([{
        userId: booking.userId,
        bookingId: booking.id,
        points: penaltyPoints,
        reason: penaltyReason,
      }], { session });

      const user = await User.findById(booking.userId).session(session);
      if (user) {
        user.penaltyPoints += penaltyPoints;

        if (user.penaltyPoints >= POLICIES.PENALTY_THRESHOLD_FOR_SUSPENSION) {
          user.suspendedUntil = calculateSuspensionDate();
        }

        await user.save({ session });
      }

      penaltyApplied = true;
    }

    // Check for damage (if condition provided)
    if (condition === 'damaged') {
      await Penalty.create([{
        userId: booking.userId,
        bookingId: booking.id,
        points: POLICIES.PENALTY_DAMAGE,
        reason: `Equipment returned damaged: ${notes || 'No details provided'}`,
      }], { session });

      const user = await User.findById(booking.userId).session(session);
      if (user) {
        user.penaltyPoints += POLICIES.PENALTY_DAMAGE;

        if (user.penaltyPoints >= POLICIES.PENALTY_THRESHOLD_FOR_SUSPENSION) {
          user.suspendedUntil = calculateSuspensionDate();
        }

        await user.save({ session });
      }

      penaltyApplied = true;
    }

    // Complete booking and mark as returned
    booking.status = 'COMPLETED';
    booking.returnedAt = now;
    booking.returnCondition = condition;
    booking.returnNotes = notes || '';
    booking.returnedBy = guard.id;
    await booking.save({ session });

    // Commit transaction
    await session.commitTransaction();

    const itemType = booking.kind === 'LIBRARY' ? 'Book' : 'Equipment';
    return NextResponse.json({
      success: true,
      booking,
      penaltyApplied,
      message: penaltyApplied
        ? `${itemType} returned with penalty applied`
        : `${itemType} returned successfully`,
    });
  } catch (error) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    console.error('Return error:', error);
    return handleApiError(error);
  } finally {
    session.endSession();
  }
}
