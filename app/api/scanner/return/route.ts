import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Booking } from '@/models/Booking';
import { EquipmentItem } from '@/models/EquipmentItem';
import { Penalty } from '@/models/Penalty';
import { User } from '@/models/User';
import { requireAuth } from '@/lib/auth/guards';
import { POLICIES, calculateSuspensionDate } from '@/lib/policies';

export async function POST(req: NextRequest) {
  try {
    const guard = await requireAuth(['GUARD', 'ADMIN']);
    await connectDB();

    const { bookingId, items, condition } = await req.json();

    if (!bookingId) {
      return NextResponse.json({ error: 'Booking ID required' }, { status: 400 });
    }

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    if (booking.kind !== 'EQUIPMENT') {
      return NextResponse.json(
        { error: 'Only equipment bookings can be returned' },
        { status: 400 }
      );
    }

    if (booking.status !== 'CHECKED_IN') {
      return NextResponse.json(
        { error: 'Booking must be checked in to return' },
        { status: 400 }
      );
    }

    // Restore equipment quantities
    if (booking.items) {
      for (const item of booking.items) {
        const equipItem = await EquipmentItem.findById(item.itemId);
        if (equipItem) {
          equipItem.qtyAvailable += item.qty;
          await equipItem.save();
        }
      }
    }

    // Check if late
    const now = new Date();
    const isLate = now > booking.end;

    let penaltyApplied = false;

    if (isLate) {
      // Apply late penalty
      await Penalty.create({
        userId: booking.userId,
        bookingId: booking._id.toString(),
        points: POLICIES.PENALTY_LATE_RETURN,
        reason: 'Late equipment return',
      });

      const user = await User.findById(booking.userId);
      if (user) {
        user.penaltyPoints += POLICIES.PENALTY_LATE_RETURN;

        if (user.penaltyPoints >= POLICIES.PENALTY_THRESHOLD_FOR_SUSPENSION) {
          user.suspendedUntil = calculateSuspensionDate();
        }

        await user.save();
      }

      penaltyApplied = true;
    }

    // Check for damage (if condition provided)
    if (condition === 'damaged') {
      await Penalty.create({
        userId: booking.userId,
        bookingId: booking._id.toString(),
        points: POLICIES.PENALTY_DAMAGE,
        reason: 'Equipment returned damaged',
      });

      const user = await User.findById(booking.userId);
      if (user) {
        user.penaltyPoints += POLICIES.PENALTY_DAMAGE;

        if (user.penaltyPoints >= POLICIES.PENALTY_THRESHOLD_FOR_SUSPENSION) {
          user.suspendedUntil = calculateSuspensionDate();
        }

        await user.save();
      }

      penaltyApplied = true;
    }

    // Complete booking
    booking.status = 'COMPLETED';
    await booking.save();

    return NextResponse.json({
      success: true,
      booking,
      penaltyApplied,
      message: penaltyApplied
        ? 'Equipment returned with penalty applied'
        : 'Equipment returned successfully',
    });
  } catch (error: any) {
    console.error('Return error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process return' },
      { status: 500 }
    );
  }
}
