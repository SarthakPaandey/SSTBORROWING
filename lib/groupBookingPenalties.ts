import mongoose from 'mongoose';
import { Booking } from '@/models/Booking';
import { GroupBooking } from '@/models/GroupBooking';
import { Penalty } from '@/models/Penalty';
import { User } from '@/models/User';
import { POLICIES, calculateSuspensionDate, isGroupBookingExpired } from './policies';
import { getNow } from './timezone';
import { withTransaction } from './transaction';
import { connectDB } from './db';

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

// NOTE: applyGroupNoShowPenalty and applyGroupLateReturnPenalty were removed.
// Facility/room no-shows and late returns cannot be verified without physical check-in.
// If physical check-in is implemented in the future, these can be re-added.

/**
 * Check and expire group bookings that haven't been confirmed
 * Expires if: expiresAt has passed OR booking start time has passed
 */
export async function expireGroupBookings(): Promise<number> {
  const conn = await connectDB();
  
  // Find all pending group bookings
  const pendingBookings = await GroupBooking.find({
    status: 'PENDING_CONFIRMATIONS',
  });

  let expiredCount = 0;

  for (const gb of pendingBookings) {
    try {
      // FIX: Wrap each expiration in a transaction for atomicity
      await withTransaction(conn, async (session) => {
        // Re-fetch within transaction to prevent race conditions
        const freshGb = await GroupBooking.findById(gb.id).session(session);
        if (!freshGb || freshGb.status !== 'PENDING_CONFIRMATIONS') {
          return;
        }

        // Get booking to check start time
        const booking = await Booking.findById(freshGb.bookingId).session(session);
        if (!booking) {
          console.warn(`[expireGroupBookings] Booking ${freshGb.bookingId} not found for group booking ${freshGb.id}`);
          return;
        }

        // Check if expired (either expiresAt passed OR booking start time passed)
        if (isGroupBookingExpired(freshGb.expiresAt, booking.start)) {
          if (freshGb.confirmedCount >= freshGb.requiredMinimum) {
            // Enough confirmations - mark as confirmed
            freshGb.status = 'CONFIRMED';
            await freshGb.save({ session });

            booking.status = 'CONFIRMED';
            await booking.save({ session });
          } else {
            // Not enough confirmations - cancel
            freshGb.status = 'EXPIRED';
            await freshGb.save({ session });

            booking.status = 'CANCELLED';
            await booking.save({ session });

            expiredCount++;
          }
        }
      });
    } catch (error) {
      console.error(`[expireGroupBookings] Failed to process group booking ${gb.id}:`, error);
    }
  }

  return expiredCount;
}

