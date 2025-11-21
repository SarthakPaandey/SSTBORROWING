import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Booking } from '@/models/Booking';
import { EquipmentItem } from '@/models/EquipmentItem';
import { Penalty } from '@/models/Penalty';
import { User } from '@/models/User';
import { requireAuth } from '@/lib/auth/guards';
import { POLICIES, calculateSuspensionDate } from '@/lib/policies';
import { handleApiError, AuthorizationError, ValidationError, NotFoundError } from '@/lib/errors';

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();

    // Only guards can access this
    if (user.role !== 'GUARD') {
      throw new AuthorizationError();
    }

    await connectDB();

    const { bookingId, condition, notes } = await req.json();

    if (!bookingId || !condition) {
      throw new ValidationError('Booking ID and condition are required');
    }

    // Find the booking
    const booking = await Booking.findById(bookingId);

    if (!booking) {
      throw new NotFoundError('Booking');
    }

    if (booking.kind !== 'EQUIPMENT' && booking.kind !== 'LIBRARY') {
      throw new ValidationError('This is not an equipment or library booking');
    }

    if (booking.status !== 'CHECKED_IN') {
      throw new ValidationError('Equipment has not been checked in yet');
    }

    // Update booking status
    booking.status = 'COMPLETED';
    booking.returnedAt = new Date();
    booking.returnCondition = condition;
    booking.returnNotes = notes || '';
    booking.returnedBy = user.id;

    // Return equipment items to inventory (only for equipment bookings)
    if (booking.kind === 'EQUIPMENT' && booking.items && booking.items.length > 0) {
      for (const item of booking.items) {
        const equipItem = await EquipmentItem.findById(item.itemId);
        if (equipItem) {
          equipItem.qtyAvailable += item.qty;
          await equipItem.save();
        }
      }
    }

    // Check for late return
    const now = new Date();
    const isLate = now > booking.end;
    let penaltiesApplied: string[] = [];

    if (isLate) {
      // Library books have higher penalty (2 points) vs equipment (1 point)
      const penaltyPoints = booking.kind === 'LIBRARY'
        ? POLICIES.PENALTY_BOOK_LATE_RETURN
        : POLICIES.PENALTY_LATE_RETURN;

      const penaltyReason = booking.kind === 'LIBRARY'
        ? 'Late book return (payment required)'
        : 'Late equipment return';

      await Penalty.create({
        userId: booking.userId,
        bookingId: booking.id,
        points: penaltyPoints,
        reason: penaltyReason,
      });
      penaltiesApplied.push(`Late return penalty (${penaltyPoints} points)`);

      const userDoc = await User.findById(booking.userId);
      if (userDoc) {
        userDoc.penaltyPoints += penaltyPoints;
        if (userDoc.penaltyPoints >= POLICIES.PENALTY_THRESHOLD_FOR_SUSPENSION) {
          userDoc.suspendedUntil = calculateSuspensionDate();
        }
        await userDoc.save();
      }
    }

    // Apply penalty for damaged equipment
    if (condition === 'damaged') {
      await Penalty.create({
        userId: booking.userId,
        bookingId: booking.id,
        points: POLICIES.PENALTY_DAMAGE,
        reason: `Equipment returned damaged: ${notes || 'No details provided'}`,
      });
      penaltiesApplied.push('Damage penalty');

      const userDoc = await User.findById(booking.userId);
      if (userDoc) {
        userDoc.penaltyPoints += POLICIES.PENALTY_DAMAGE;
        if (userDoc.penaltyPoints >= POLICIES.PENALTY_THRESHOLD_FOR_SUSPENSION) {
          userDoc.suspendedUntil = calculateSuspensionDate();
        }
        await userDoc.save();
      }
    }

    await booking.save();

    const itemType = booking.kind === 'LIBRARY' ? 'Book' : 'Equipment';
    return NextResponse.json({
      message: penaltiesApplied.length > 0
        ? `${itemType} returned. Penalties applied: ${penaltiesApplied.join(', ')}`
        : `${itemType} returned successfully`,
      booking,
      penaltiesApplied,
    });
  } catch (error) {
    console.error('Return equipment error:', error);
    return handleApiError(error);
  }
}
