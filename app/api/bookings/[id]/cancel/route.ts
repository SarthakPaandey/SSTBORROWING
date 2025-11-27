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
import { getNow, getDaysAgo } from '@/lib/timezone';
import mongoose from 'mongoose';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth();
    await connectDB();

    // FIX: Validate ObjectId to prevent MongoDB CastError
    if (!mongoose.Types.ObjectId.isValid(params.id)) {
      throw new ValidationError('Invalid booking ID format');
    }

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

    // NOTE: Weekly cancellation limit removed - users can cancel unlimited times
    // However, penalties apply for all cancellations to discourage abuse

    // Check if cancellation is late (within 2 hours of start) - using IST timezone
    const now = getNow();
    const hoursUntilStart =
      (new Date(booking.start).getTime() - now.getTime()) / (1000 * 60 * 60);
    const isLateCancellation = hoursUntilStart < POLICIES.LATE_CANCELLATION_HOURS;

    // Apply penalty for all cancellations (0.25 points)
    const penaltyApplied = POLICIES.PENALTY_CANCELLATION;

    // Create penalty record for audit trail
    await Penalty.create({
      userId: booking.userId,
      bookingId: booking.id,
      points: penaltyApplied,
      reason: isLateCancellation
        ? `Late cancellation (${hoursUntilStart.toFixed(1)}h before start)`
        : 'Booking cancellation',
    });

    // Update user penalty points
    const userRecord = await User.findById(booking.userId);
    if (userRecord) {
      userRecord.penaltyPoints += penaltyApplied;
      await userRecord.save();
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
      message: `Booking cancelled. ${penaltyApplied} penalty points applied.`,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
