import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Booking } from '@/models/Booking';
import { EquipmentItem } from '@/models/EquipmentItem';
import { Cancellation } from '@/models/Cancellation';
import { User } from '@/models/User';
import { Resource } from '@/models/Resource';
import { requireAuth } from '@/lib/auth/guards';
import { POLICIES } from '@/lib/policies';
import { handleApiError, NotFoundError, AuthorizationError, ValidationError, ConflictError } from '@/lib/errors';
import { getNow, getDaysAgo } from '@/lib/timezone';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth();
    await connectDB();

    const booking = await Booking.findById(params.id);

    if (!booking) {
      throw new NotFoundError('Booking');
    }

    // Check ownership or admin
    if (booking.userId !== user.id && user.role !== 'ADMIN') {
      throw new AuthorizationError();
    }

    // Check if can cancel
    if (!['PENDING', 'CONFIRMED'].includes(booking.status)) {
      throw new ValidationError('Cannot cancel booking in current state');
    }

    // Check if booking has already started - compare times properly accounting for timezone
    // booking.start is stored in UTC, getNow() returns IST time
    // We need to compare them properly by converting both to timestamps
    const bookingStartTime = new Date(booking.start).getTime();
    const currentTime = getNow().getTime();

    if (currentTime > bookingStartTime) {
      throw new ValidationError('Cannot cancel past bookings');
    }

    // Check weekly cancellation limit (using IST timezone)
    const weekAgo = getDaysAgo(7);

    const weeklyCancellations = await Cancellation.countDocuments({
      userId: booking.userId,
      cancelledAt: { $gte: weekAgo },
    });

    if (weeklyCancellations >= POLICIES.MAX_CANCELLATIONS_PER_WEEK) {
      throw new ConflictError(`You have reached the maximum cancellation limit of ${POLICIES.MAX_CANCELLATIONS_PER_WEEK} cancellations per week.`);
    }

    // Check if cancellation is late (within 2 hours of start) - using IST timezone
    const now = getNow();
    const hoursUntilStart =
      (new Date(booking.start).getTime() - now.getTime()) / (1000 * 60 * 60);
    const isLateCancellation = hoursUntilStart < POLICIES.LATE_CANCELLATION_HOURS;

    let penaltyApplied = 0;

    // Apply penalty for late cancellation
    if (isLateCancellation) {
      penaltyApplied = POLICIES.PENALTY_LATE_CANCELLATION_POINTS;

      const userRecord = await User.findById(booking.userId);
      if (userRecord) {
        userRecord.penaltyPoints += penaltyApplied;
        await userRecord.save();
      }
    }

    // Get resource name for logging
    const resource = await Resource.findById(booking.resourceId);

    // Track the cancellation
    await Cancellation.create({
      bookingId: booking.id,
      userId: booking.userId,
      resourceId: booking.resourceId,
      resourceName: resource?.name || 'Unknown',
      bookingStart: booking.start,
      cancelledAt: now,
      wasLate: isLateCancellation,
      penaltyApplied,
    });

    // FIX EC-11: Release equipment inventory reservation
    // The previous comment was INCORRECT - we DID reduce inventory via qtyReserved
    // When booking was created, qtyReserved was incremented to hold the items
    // We must now release that reservation to prevent phantom inventory
    if (booking.items && (booking.kind === 'EQUIPMENT' || booking.kind === 'LIBRARY')) {
      for (const item of booking.items) {
        await EquipmentItem.findByIdAndUpdate(
          item.itemId,
          {
            $inc: { qtyReserved: -item.qty }
          }
        );
      }
    }

    booking.status = 'CANCELLED';
    await booking.save();

    return NextResponse.json({
      booking,
      wasLateCancellation: isLateCancellation,
      penaltyApplied,
      message: isLateCancellation
        ? `Booking cancelled. ${penaltyApplied} penalty points applied for late cancellation.`
        : 'Booking cancelled successfully.',
    });
  } catch (error) {
    return handleApiError(error);
  }
}
