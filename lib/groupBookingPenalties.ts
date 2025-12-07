import mongoose from 'mongoose';
import { Booking } from '@/models/Booking';
import { GroupBooking } from '@/models/GroupBooking';
import { Penalty } from '@/models/Penalty';
import { User } from '@/models/User';
import { POLICIES, calculateSuspensionDate, isGroupBookingExpired } from './policies';
import { getNow } from './timezone';

/**
 * Recalculate a user's penalty points and apply escalating suspensions
 * FIX: Implements three-strike system with automatic point reset
 *
 * Level 0 (Fresh): 20 points -> 7 day suspension -> Level 1, points reset
 * Level 1 (Probation): 10 points -> 10 day suspension -> Level 2, points reset
 * Level 2 (Final Warning): 10 points -> Permanent block
 *
 * This is the single source of truth for penalty point calculation.
 * Call this after any penalty modification (add, waive, etc.)
 */
export async function recalculatePenaltyPoints(
  userId: string,
  session?: mongoose.ClientSession
): Promise<number> {
  // Use UTC for persisted timestamps and comparisons
  const now = new Date();

  // Calculate total points from non-waived AND non-served penalties
  // Keep aggregation inside the caller's transaction when provided to avoid stale totals
  const aggregateQuery = Penalty.aggregate([
    {
      $match: {
        userId: userId,
        waivedBy: null, // Only count non-waived penalties
        served: false,  // Only count penalties that haven't been served yet
      }
    },
    {
      $group: {
        _id: null,
        totalPoints: { $sum: '$points' }
      }
    }
  ]);

  if (session) {
    aggregateQuery.session(session);
  }

  const result = await aggregateQuery;

  const activePoints = result.length > 0 ? result[0].totalPoints : 0;

  // Get the user
  const user = session
    ? await User.findById(userId).session(session)
    : await User.findById(userId);
  if (!user) {
    return activePoints;
  }

  // Update user's penalty points
  user.penaltyPoints = activePoints;

  // Determine threshold based on current suspension level
  const currentLevel = user.suspensionLevel || 0;
  let threshold: number;
  let suspensionDays: number;

  switch (currentLevel) {
    case 0: // Fresh - First offense
      threshold = POLICIES.PENALTY_THRESHOLD_LEVEL_0; // 20 points
      suspensionDays = POLICIES.SUSPENSION_DURATION_LEVEL_0; // 7 days
      break;
    case 1: // Probation - Second offense
      threshold = POLICIES.PENALTY_THRESHOLD_LEVEL_1; // 10 points
      suspensionDays = POLICIES.SUSPENSION_DURATION_LEVEL_1; // 10 days
      break;
    case 2: // Final warning - Third offense = permanent block
      threshold = POLICIES.PENALTY_THRESHOLD_LEVEL_2; // 10 points
      suspensionDays = 0; // Will be blocked instead
      break;
    default:
      threshold = POLICIES.PENALTY_THRESHOLD_LEVEL_0;
      suspensionDays = POLICIES.SUSPENSION_DURATION_LEVEL_0;
  }

  // Check if user has exceeded the threshold for their current level
  if (activePoints >= threshold) {
    if (currentLevel === 2) {
      // Level 2 -> Permanent block
      user.blocked = true;
      user.blockedAt = now;
      user.suspendedUntil = undefined; // Clear suspension, they're blocked

      // Mark all active penalties as served
      await Penalty.updateMany(
        { userId, served: false, waivedBy: null },
        { served: true, servedAt: now }
      ).session(session ?? null);
    } else {
      // Level 0 or 1 -> Suspend and escalate
      const suspensionDate = new Date(now);
      suspensionDate.setDate(suspensionDate.getDate() + suspensionDays);
      user.suspendedUntil = suspensionDate;

      // Increment suspension level
      user.suspensionLevel = currentLevel + 1;

      // Mark all active penalties as served (this resets the point counter)
      await Penalty.updateMany(
        { userId, served: false, waivedBy: null },
        { served: true, servedAt: now }
      ).session(session ?? null);

      // Reset penalty points to 0 since all penalties are now served
      user.penaltyPoints = 0;
    }
  } else {
    // Below threshold, clear suspension if it has expired
    if (user.suspendedUntil && user.suspendedUntil < now) {
      user.suspendedUntil = undefined;
    }
  }

  await user.save({ session: session ?? null });

  return user.penaltyPoints;
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

  // Apply penalty only to organizer to avoid unfairly penalizing members
  const organizerId = groupBooking.organizerId;

  await Penalty.create({
    userId: organizerId,
    bookingId: booking.id,
    points: POLICIES.PENALTY_NO_SHOW,
    reason: 'Group booking no-show (organizer responsible)',
  });

  await recalculatePenaltyPoints(organizerId);
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

  // Apply penalty only to organizer to avoid unfairly penalizing members
  const organizerId = groupBooking.organizerId;

  await Penalty.create({
    userId: organizerId,
    bookingId: booking.id,
    points: POLICIES.PENALTY_LATE_RETURN,
    reason: 'Group booking late return (organizer responsible)',
  });

  await recalculatePenaltyPoints(organizerId);
}

/**
 * Check and expire group bookings that haven't been confirmed
 * Expires if: expiresAt has passed OR booking start time has passed
 */
export async function expireGroupBookings(): Promise<number> {
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

