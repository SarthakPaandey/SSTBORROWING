import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Booking } from '@/models/Booking';
import { EquipmentItem } from '@/models/EquipmentItem';
import { Penalty } from '@/models/Penalty';
import { User } from '@/models/User';
import { requireAuth } from '@/lib/auth/guards';
import { POLICIES, calculateSuspensionDate } from '@/lib/policies';
import { handleApiError, NotFoundError, ValidationError, ConflictError } from '@/lib/errors';
import mongoose from 'mongoose';
import { getNow } from '@/lib/timezone';

export async function POST(req: NextRequest) {
  const session = await mongoose.startSession();

  try {
    const guard = await requireAuth(['GUARD', 'ADMIN']);
    await connectDB();

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

    if (booking.kind !== 'EQUIPMENT') {
      await session.abortTransaction();
      throw new ValidationError('Only equipment bookings can be returned');
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

    // Check if late (using IST timezone for accurate late detection)
    const now = getNow();
    const isLate = now > booking.end;

    let penaltyApplied = false;

    if (isLate) {
      // Apply late penalty
      await Penalty.create([{
        userId: booking.userId,
        bookingId: booking.id,
        points: POLICIES.PENALTY_LATE_RETURN,
        reason: 'Late equipment return',
      }], { session });

      const user = await User.findById(booking.userId).session(session);
      if (user) {
        user.penaltyPoints += POLICIES.PENALTY_LATE_RETURN;

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
        reason: 'Equipment returned damaged',
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
    booking.returnedAt = now;  // Track when returned
    await booking.save({ session });

    // Commit transaction
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
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    console.error('Return error:', error);
    return handleApiError(error);
  } finally {
    session.endSession();
  }
}

