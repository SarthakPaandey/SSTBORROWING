import { Booking } from '@/models/Booking';
import { GroupBooking } from '@/models/GroupBooking';
import { Penalty } from '@/models/Penalty';
import { User } from '@/models/User';
import { POLICIES, calculateSuspensionDate, isGroupBookingExpired } from './policies';

/**
 * Recalculate a user's penalty points from the Penalty collection
 * FIX Issue #8: Ensures penalty points are always in sync with actual penalty records
 *
 * This is the single source of truth for penalty point calculation.
 * Call this after any penalty modification (add, waive, etc.)
 */
export async function recalculatePenaltyPoints(userId: string): Promise<number> {
  // Calculate total points from non-waived penalties
  const result = await Penalty.aggregate([
    {
      $match: {
        userId: userId,
        waivedBy: null, // Only count non-waived penalties
      }
    },
    {
      $group: {
        _id: null,
        totalPoints: { $sum: '$points' }
      }
    }
  ]);

  const totalPoints = result.length > 0 ? result[0].totalPoints : 0;

  // Update the user's penalty points to match
  const user = await User.findById(userId);
  if (user) {
    user.penaltyPoints = totalPoints;

    // Update suspension status based on recalculated points
    if (totalPoints >= POLICIES.PENALTY_THRESHOLD_FOR_SUSPENSION) {
      // Only set suspension if not already suspended
      if (!user.suspendedUntil || user.suspendedUntil < new Date()) {
        user.suspendedUntil = calculateSuspensionDate();
      }
    } else {
      // Clear suspension if points are below threshold
      user.suspendedUntil = undefined;
    }

    await user.save();
  }

  return totalPoints;
}

/**
 * Apply no-show penalty to all confirmed members of a group booking
 */
export async function applyGroupNoShowPenalty(bookingId: string): Promise<void> {
  const booking = await Booking.findById(bookingId);

  if (!booking || !booking.isGroupBooking) {
    return;
  }

  const groupBooking = await GroupBooking.findById(booking.groupBookingId);
  if (!groupBooking) {
    return;
  }

  // Get organizer
  const allMemberIds = [groupBooking.organizerId];

  // Get all confirmed members
  const confirmedMembers = groupBooking.members
    .filter(m => m.status === 'CONFIRMED')
    .map(m => m.userId);

  allMemberIds.push(...confirmedMembers);

  // Apply penalty to all members
  for (const userId of allMemberIds) {
    // Create penalty record
    await Penalty.create({
      userId,
      bookingId: booking.id,
      points: POLICIES.PENALTY_NO_SHOW,
      reason: 'Group booking no-show',
    });

    // Update user penalty points
    const user = await User.findById(userId);
    if (user) {
      user.penaltyPoints += POLICIES.PENALTY_NO_SHOW;
      if (user.penaltyPoints >= POLICIES.PENALTY_THRESHOLD_FOR_SUSPENSION) {
        user.suspendedUntil = calculateSuspensionDate();
      }
      await user.save();
    }
  }
}

/**
 * Apply late return penalty to all confirmed members of a group booking
 */
export async function applyGroupLateReturnPenalty(bookingId: string): Promise<void> {
  const booking = await Booking.findById(bookingId);

  if (!booking || !booking.isGroupBooking) {
    return;
  }

  const groupBooking = await GroupBooking.findById(booking.groupBookingId);
  if (!groupBooking) {
    return;
  }

  // Get organizer
  const allMemberIds = [groupBooking.organizerId];

  // Get all confirmed members
  const confirmedMembers = groupBooking.members
    .filter(m => m.status === 'CONFIRMED')
    .map(m => m.userId);

  allMemberIds.push(...confirmedMembers);

  // Apply penalty to all members
  for (const userId of allMemberIds) {
    await Penalty.create({
      userId,
      bookingId: booking.id,
      points: POLICIES.PENALTY_LATE_RETURN,
      reason: 'Group booking late return',
    });

    const user = await User.findById(userId);
    if (user) {
      user.penaltyPoints += POLICIES.PENALTY_LATE_RETURN;
      if (user.penaltyPoints >= POLICIES.PENALTY_THRESHOLD_FOR_SUSPENSION) {
        user.suspendedUntil = calculateSuspensionDate();
      }
      await user.save();
    }
  }
}

/**
 * Check and expire group bookings that haven't been confirmed
 * Expires if: expiresAt has passed OR booking start time has passed
 */
export async function expireGroupBookings(): Promise<number> {
  const now = new Date();

  // Find all pending group bookings
  const pendingBookings = await GroupBooking.find({
    status: 'PENDING_CONFIRMATIONS',
  });

  let expiredCount = 0;

  for (const gb of pendingBookings) {
    // Get booking to check start time
    const booking = await Booking.findById(gb.bookingId);
    if (!booking) {
      continue; // Skip if booking not found
    }

    // Check if expired (either expiresAt passed OR booking start time passed)
    if (isGroupBookingExpired(gb.expiresAt, booking.start)) {
      // Check if minimum is met
      if (gb.confirmedCount >= gb.requiredMinimum) {
        // Enough confirmations - mark as confirmed
        gb.status = 'CONFIRMED';
        await gb.save();

        booking.status = 'CONFIRMED';
        await booking.save();
      } else {
        // Not enough confirmations - cancel
        gb.status = 'EXPIRED';
        await gb.save();

        booking.status = 'CANCELLED';
        await booking.save();

        expiredCount++;
      }
    }
  }

  return expiredCount;
}
