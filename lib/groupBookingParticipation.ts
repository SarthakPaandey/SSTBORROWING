import mongoose from 'mongoose';
import { Booking } from '@/models/Booking';
import { GroupBooking } from '@/models/GroupBooking';

type Session = mongoose.ClientSession | null | undefined;

const ACTIVE_GROUP_STATUSES = ['PENDING_CONFIRMATIONS', 'CONFIRMED'] as const;
const ACTIVE_BOOKING_STATUSES = ['PENDING', 'CONFIRMED', 'CHECKED_IN'] as const;

/**
 * Fetch group booking host bookings that a user is participating in
 * (as an invited member, not the organizer).
 *
 * The returned bookings are the primary Booking documents that back
 * each group booking, filtered to facility/room kinds and active statuses.
 */
export async function getGroupParticipantBookings(
  userId: string,
  session?: Session
) {
  const groupQuery = GroupBooking.find({
    'members.userId': userId,
    status: { $in: ACTIVE_GROUP_STATUSES },
  });

  if (session) {
    groupQuery.session(session);
  }

  const groups = await groupQuery;
  if (!groups.length) {
    return [];
  }

  const bookingIds = groups.map((gb) => gb.bookingId);
  const bookingQuery = Booking.find({
    _id: { $in: bookingIds },
    kind: { $in: ['FACILITY', 'ROOM'] },
    status: { $in: ACTIVE_BOOKING_STATUSES },
  });

  if (session) {
    bookingQuery.session(session);
  }

  return await bookingQuery;
}

/**
 * Count active (future-ending) group bookings a user is part of.
 * Used to enforce total active booking limits alongside direct bookings.
 */
export async function countActiveGroupParticipations(
  userId: string,
  session?: Session
): Promise<number> {
  const bookings = await getGroupParticipantBookings(userId, session);
  if (!bookings.length) {
    return 0;
  }

  const now = new Date();
  return bookings.filter((b) => new Date(b.end) > now).length;
}

