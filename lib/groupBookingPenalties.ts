import { Booking } from '@/models/Booking';
import { GroupBooking } from '@/models/GroupBooking';
import { Penalty } from '@/models/Penalty';
import { User } from '@/models/User';
import { POLICIES, calculateSuspensionDate } from './policies';

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
 * Check and expire group bookings that haven't been confirmed within 2 hours
 */
export async function expireGroupBookings(): Promise<number> {
  const now = new Date();

  const expiredBookings = await GroupBooking.find({
    status: 'PENDING_CONFIRMATIONS',
    expiresAt: { $lt: now },
  });

  let expiredCount = 0;

  for (const gb of expiredBookings) {
    // Check if minimum is met
    if (gb.confirmedCount >= gb.requiredMinimum) {
      // Enough confirmations - mark as confirmed
      gb.status = 'CONFIRMED';
      await gb.save();

      const booking = await Booking.findById(gb.bookingId);
      if (booking) {
        booking.status = 'CONFIRMED';
        await booking.save();
      }
    } else {
      // Not enough confirmations - cancel
      gb.status = 'EXPIRED';
      await gb.save();

      const booking = await Booking.findById(gb.bookingId);
      if (booking) {
        booking.status = 'CANCELLED';
        await booking.save();
      }

      expiredCount++;
    }
  }

  return expiredCount;
}
