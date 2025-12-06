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
  let session: mongoose.ClientSession | null = null;

  try {
    // Must connect to DB before starting a session
    await connectDB();
    session = await mongoose.startSession();

    const guard = await requireAuth(['GUARD', 'ADMIN']);

    const { bookingId, condition, notes } = await req.json();

    if (!bookingId) {
      throw new ValidationError('Booking ID required');
    }

    // FIX EC-2: Validate ObjectId to prevent MongoDB CastError
    if (!mongoose.Types.ObjectId.isValid(bookingId)) {
      throw new ValidationError('Invalid booking ID format');
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

    // FIX: Restore equipment quantities to shelf
    // qtyAvailable is decremented at QR check-in (app/api/qr/validate/route.ts)
    // and must be restored when equipment is returned
    if (booking.items) {
      for (const item of booking.items) {
        await EquipmentItem.findByIdAndUpdate(
          item.itemId,
          { $inc: { qtyAvailable: item.qty } },
          { session }
        );
      }
    }

    // FIX EC-6: Check if late using UTC for consistency
    const now = new Date();

    // Dynamic Return Deadline Logic:
    // If user picked up late, they get equal extra time to return.
    // Adjusted End Time = Original End Time + (Pickup Time - Start Time) + 15 min grace
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

    // Add 15-minute grace period for returns (consistent with QR generation grace period)
    const RETURN_GRACE_PERIOD_MS = 15 * 60 * 1000;
    adjustedEndTime += RETURN_GRACE_PERIOD_MS;

    const isLate = now.getTime() > adjustedEndTime;
    const isDamaged = condition === 'damaged';

    let penaltyApplied = false;
    let totalPenaltyPoints = 0;
    const penaltyReasons: string[] = [];

    // Calculate total penalties (late + damage if applicable)
    if (isLate) {
      // Library books have higher penalty (2 points) vs equipment (1 point)
      const latePoints = booking.kind === 'LIBRARY'
        ? POLICIES.PENALTY_BOOK_LATE_RETURN
        : POLICIES.PENALTY_LATE_RETURN;

      totalPenaltyPoints += latePoints;
      penaltyReasons.push(booking.kind === 'LIBRARY' ? 'Late book return' : 'Late equipment return');
    }

    if (isDamaged) {
      totalPenaltyPoints += POLICIES.PENALTY_DAMAGE;
      penaltyReasons.push(`Returned damaged: ${notes || 'No details provided'}`);
    }

    // FIX: Apply all penalties in a single user update to prevent race conditions
    // and ensure accurate penalty point calculation
    if (totalPenaltyPoints > 0) {
      // Create penalty records for each type
      if (isLate) {
        const latePoints = booking.kind === 'LIBRARY'
          ? POLICIES.PENALTY_BOOK_LATE_RETURN
          : POLICIES.PENALTY_LATE_RETURN;

        await Penalty.create([{
          userId: booking.userId,
          bookingId: booking.id,
          points: latePoints,
          reason: booking.kind === 'LIBRARY' ? 'Late book return (payment required)' : 'Late equipment return',
        }], { session });
      }

      if (isDamaged) {
        await Penalty.create([{
          userId: booking.userId,
          bookingId: booking.id,
          points: POLICIES.PENALTY_DAMAGE,
          reason: `Equipment returned damaged: ${notes || 'No details provided'}`,
        }], { session });
      }

      // FIX: Single atomic update for user penalty points
      // Previously, if both late AND damaged, we fetched user twice and saved twice
      // which could cause race conditions and incorrect suspension checks
      // FIX: booking.userId is the ObjectId, not email
      const user = await User.findById(booking.userId).session(session);
      if (user) {
        user.penaltyPoints += totalPenaltyPoints;

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
