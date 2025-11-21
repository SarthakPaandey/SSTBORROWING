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

    if (new Date() > booking.start) {
      throw new ValidationError('Cannot cancel past bookings');
    }

    // Check weekly cancellation limit
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const weeklyCancellations = await Cancellation.countDocuments({
      userId: booking.userId,
      cancelledAt: { $gte: weekAgo },
    });

    if (weeklyCancellations >= POLICIES.MAX_CANCELLATIONS_PER_WEEK) {
      throw new ConflictError(`You have reached the maximum cancellation limit of ${POLICIES.MAX_CANCELLATIONS_PER_WEEK} cancellations per week.`);
    }

    // Check if cancellation is late (within 2 hours of start)
    const now = new Date();
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

    // Note: We don't need to restore equipment inventory here because
    // we never actually reduced it. Equipment is only reduced when QR is scanned (check-in).
    // The booking just "reserves" the equipment by being counted in availability checks.

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
