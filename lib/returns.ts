import { Booking } from '@/models/Booking';
import { EquipmentItem } from '@/models/EquipmentItem';
import { Penalty } from '@/models/Penalty';
import { POLICIES } from '@/lib/policies';
import { recalculatePenaltyPoints } from '@/lib/groupBookingPenalties';
import mongoose from 'mongoose';
import { ConflictError, NotFoundError, ValidationError } from '@/lib/errors';

interface ProcessReturnOptions {
  bookingId: string;
  condition: string;
  notes?: string;
  returnedBy?: string; // guard id
  session: mongoose.ClientSession;
}

/**
 * Shared return processing for equipment and library bookings.
 * Validates booking state, restores inventory, applies penalties, and completes booking.
 */
export async function processReturn({
  bookingId,
  condition,
  notes,
  returnedBy,
  session,
}: ProcessReturnOptions) {
  const booking = await Booking.findById(bookingId).session(session);
  if (!booking) {
    throw new NotFoundError('Booking');
  }

  if (booking.kind !== 'EQUIPMENT' && booking.kind !== 'LIBRARY') {
    throw new ValidationError('Only equipment and library bookings can be returned');
  }

  if (booking.status !== 'CHECKED_IN') {
    throw new ValidationError('Booking must be checked in to return');
  }

  if (booking.returnedAt) {
    throw new ConflictError('Equipment already returned');
  }

  // FIX: Restore qtyAvailable on return
  // The QR validation (qr/validate/route.ts) decrements qtyAvailable on check-in,
  // so we must increment it back when the item is returned.
  // Time-based overlap checks (lib/inventory.ts) are still used for booking validation,
  // but qtyAvailable tracks physical inventory on the shelf.
  if (booking.items && booking.items.length > 0) {
    for (const item of booking.items) {
      await EquipmentItem.findByIdAndUpdate(
        item.itemId,
        { $inc: { qtyAvailable: item.qty } },
        { session }
      );
    }
  }

  // Dynamic Return Deadline Logic with 15-min grace
  const now = new Date();
  // Preserve the intended borrow window even if pickup happened late
  let adjustedEndTime = new Date(booking.end).getTime();
  if (booking.checkedInAt) {
    const pickupTime = new Date(booking.checkedInAt).getTime();
    const startTime = new Date(booking.start).getTime();
    const pickupDelay = pickupTime - startTime;
    if (pickupDelay > 0) {
      adjustedEndTime += pickupDelay;
    }
  }
  adjustedEndTime += POLICIES.NO_SHOW_GRACE_MINUTES * 60 * 1000; // universal grace buffer after pickup window

  const isLate = now.getTime() > adjustedEndTime;
  const isDamaged = condition === 'damaged';

  let penaltyApplied = false;

  if (isLate) {
    const latePoints = booking.kind === 'LIBRARY'
      ? POLICIES.PENALTY_BOOK_LATE_RETURN
      : POLICIES.PENALTY_LATE_RETURN;

    await Penalty.create([{
      userId: booking.userId,
      bookingId: booking.id,
      points: latePoints,
      reason: booking.kind === 'LIBRARY' ? 'Late book return' : 'Late equipment return',
    }], { session });

    penaltyApplied = true;
  }

  if (isDamaged) {
    await Penalty.create([{
      userId: booking.userId,
      bookingId: booking.id,
      points: POLICIES.PENALTY_DAMAGE,
      reason: `Equipment returned damaged${notes ? `: ${notes}` : ''}`,
    }], { session });

    penaltyApplied = true;
  }

  if (penaltyApplied) {
    await recalculatePenaltyPoints(booking.userId, session);
  }

  booking.status = 'COMPLETED';
  booking.returnedAt = now;
  booking.returnCondition = condition;
  booking.returnNotes = notes || '';
  booking.returnedBy = returnedBy;
  await booking.save({ session });

  return { booking, penaltyApplied };
}

