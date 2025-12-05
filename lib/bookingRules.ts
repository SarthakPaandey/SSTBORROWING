import mongoose from 'mongoose';
import { Booking, BookingKind, IBooking } from '@/models/Booking';
import { POLICIES } from '@/lib/policies';
import { getStartOfDay, getNow, toIST } from '@/lib/timezone';

export type BookingCategory = BookingKind;

export const CATEGORY_DAILY_LIMITS: Record<BookingCategory, number> = {
  FACILITY: POLICIES.MAX_BOOKINGS_PER_DAY,
  ROOM: POLICIES.MAX_BOOKINGS_PER_DAY,
  EQUIPMENT: POLICIES.MAX_BOOKINGS_PER_DAY,
  LIBRARY: POLICIES.MAX_BOOKINGS_PER_DAY,
};

/**
 * Check per-user, per-category daily and monthly limits for a new booking.
 * This is intentionally conservative and only counts non-cancelled bookings.
 */
export async function canUserCreateBookingWithCaps(options: {
  userId: string;
  kind: BookingCategory;
  start: Date;
  end: Date;
  session?: mongoose.ClientSession;
}): Promise<{ allowed: boolean; reason?: string }> {
  const { userId, kind, start, end, session } = options;

  // DAILY LIMITS (per category & user, based on the day of the booking start in IST)
  const startIST = toIST(start);
  const dayStart = getStartOfDay(startIST);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  const dailyLimit = CATEGORY_DAILY_LIMITS[kind];

  if (dailyLimit && dailyLimit > 0) {
    const dailyCountQuery = {
      userId,
      kind,
      status: { $in: ['CONFIRMED', 'CHECKED_IN', 'PENDING'] as IBooking['status'][] },
      start: { $gte: dayStart, $lt: dayEnd },
    };

    const dailyCount = session
      ? await Booking.countDocuments(dailyCountQuery).session(session)
      : await Booking.countDocuments(dailyCountQuery);

    if (dailyCount >= dailyLimit) {
      return {
        allowed: false,
        reason: `You have reached the daily limit of ${dailyLimit} ${kind.toLowerCase()} bookings for this day.`,
      };
    }
  }

  // MONTHLY LIMITS (reuse existing global policy by kind)
  const now = getNow();
  const monthStart = getStartOfDay(new Date(now.getFullYear(), now.getMonth(), 1));
  const monthEnd = new Date(monthStart);
  monthEnd.setMonth(monthEnd.getMonth() + 1);

  const monthlyQuery = {
    userId,
    kind,
    status: { $in: ['CONFIRMED', 'CHECKED_IN', 'PENDING', 'COMPLETED'] as IBooking['status'][] },
    start: { $gte: monthStart, $lt: monthEnd },
  };

  const monthlyBookings = session
    ? await Booking.find(monthlyQuery).session(session)
    : await Booking.find(monthlyQuery);

  if (kind === 'FACILITY') {
    const totalHours = monthlyBookings.reduce((total, b) => {
      const hours = (new Date(b.end).getTime() - new Date(b.start).getTime()) / (1000 * 60 * 60);
      return total + hours;
    }, 0);

    const newHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    if (totalHours + newHours > POLICIES.MAX_FACILITY_HOURS_PER_MONTH) {
      return {
        allowed: false,
        reason: `Monthly facility limit exceeded. You have used ${totalHours.toFixed(
          1,
        )} hours out of ${POLICIES.MAX_FACILITY_HOURS_PER_MONTH} hours this month.`,
      };
    }
  }

  if (kind === 'ROOM') {
    const totalHours = monthlyBookings.reduce((total, b) => {
      const hours = (new Date(b.end).getTime() - new Date(b.start).getTime()) / (1000 * 60 * 60);
      return total + hours;
    }, 0);

    const newHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    if (totalHours + newHours > POLICIES.MAX_ROOM_HOURS_PER_MONTH) {
      return {
        allowed: false,
        reason: `Monthly room limit exceeded. You have used ${totalHours.toFixed(
          1,
        )} hours out of ${POLICIES.MAX_ROOM_HOURS_PER_MONTH} hours this month.`,
      };
    }
  }

  if (kind === 'EQUIPMENT') {
    if (monthlyBookings.length >= POLICIES.MAX_EQUIPMENT_BORROWS_PER_MONTH) {
      return {
        allowed: false,
        reason: `Monthly equipment limit exceeded. You can only borrow equipment ${POLICIES.MAX_EQUIPMENT_BORROWS_PER_MONTH} times per month.`,
      };
    }
  }

  // For library we currently only enforce active borrow limit elsewhere.

  return { allowed: true };
}











