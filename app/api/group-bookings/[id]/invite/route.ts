import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { GroupBooking } from '@/models/GroupBooking';
import { Booking } from '@/models/Booking';
import { User } from '@/models/User';
import { requireAuth } from '@/lib/auth/guards';
import { canUserBook, POLICIES, isGroupBookingExpired } from '@/lib/policies';
import { handleApiError, NotFoundError, AuthorizationError, ValidationError, ConflictError } from '@/lib/errors';
import { getTodayStart } from '@/lib/timezone';
import mongoose from 'mongoose';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const currentUser = await requireAuth(['STUDENT']);
    await connectDB();

    // FIX: Validate ObjectId to prevent MongoDB CastError
    if (!mongoose.Types.ObjectId.isValid(params.id)) {
      throw new ValidationError('Invalid group booking ID format');
    }

    const { email } = await req.json();

    if (!email) {
      throw new ValidationError('Email is required');
    }

    // Find group booking
    const groupBooking = await GroupBooking.findById(params.id);
    if (!groupBooking) {
      throw new NotFoundError('Group booking');
    }

    // Check if current user is the organizer
    if (groupBooking.organizerId !== currentUser.id) {
      throw new AuthorizationError('Only the organizer can invite replacements');
    }

    // Check if booking is still pending confirmations
    if (groupBooking.status !== 'PENDING_CONFIRMATIONS') {
      throw new ValidationError(`Cannot invite to a ${groupBooking.status.toLowerCase()} booking`);
    }

    // Get booking to check start time
    const booking = await Booking.findById(groupBooking.bookingId);
    if (!booking) {
      throw new NotFoundError('Booking');
    }

    // Check if expired (either expiresAt passed OR booking start time passed)
    if (isGroupBookingExpired(groupBooking.expiresAt, booking.start)) {
      groupBooking.status = 'EXPIRED';
      await groupBooking.save();

      if (booking.status === 'PENDING') {
        // No need to release qtyReserved as we no longer use it for blocking
        // (Time-based overlap checking is used instead)

        booking.status = 'CANCELLED';
        await booking.save();
      }

      throw new ValidationError('This group booking has expired');
    }

    // Check if email is already in the group
    const alreadyMember = groupBooking.members.some(
      m => m.email.toLowerCase() === email.toLowerCase()
    );
    if (alreadyMember) {
      throw new ConflictError('This person is already invited to this booking');
    }

    // Check if it's the organizer's email
    if (groupBooking.organizerEmail.toLowerCase() === email.toLowerCase()) {
      throw new ValidationError('Cannot invite yourself');
    }

    // Find the new member
    const newMember = await User.findOne({
      email: email.toLowerCase(),
      role: 'STUDENT'
    });

    if (!newMember) {
      throw new NotFoundError(`${email} is not a registered student`);
    }

    // Check if new member can book
    const memberCanBook = canUserBook(newMember);
    if (!memberCanBook.allowed) {
      throw new ValidationError(`${email} cannot join: ${memberCanBook.reason}`);
    }

    // Booking already fetched above, check for conflicts
    const conflictingBooking = await Booking.findOne({
      userId: newMember.id,
      status: { $in: ['CONFIRMED', 'CHECKED_IN', 'PENDING'] },
      start: { $lt: booking.end },
      end: { $gt: booking.start },
    });

    if (conflictingBooking) {
      throw new ConflictError(`${email} has a conflicting booking at this time`);
    }

    // Check daily limit (using IST timezone)
    const today = getTodayStart();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayBookings = await Booking.countDocuments({
      userId: newMember.id,
      status: { $in: ['CONFIRMED', 'CHECKED_IN', 'PENDING'] },
      start: { $gte: today, $lt: tomorrow },
    });

    // Only check daily limit if it's enabled (value > 0)
    if (POLICIES.MAX_BOOKINGS_PER_DAY > 0 && todayBookings >= POLICIES.MAX_BOOKINGS_PER_DAY) {
      throw new ConflictError(`${email} has reached their daily booking limit`);
    }

    // Add new member to group
    groupBooking.members.push({
      userId: newMember.id,
      email: newMember.email,
      name: newMember.name,
      status: 'PENDING',
      invitedAt: new Date(),
    });

    await groupBooking.save();

    return NextResponse.json({
      message: `Invitation sent to ${email}`,
      groupBooking,
    });

  } catch (error) {
    console.error('Invite replacement error:', error);
    return handleApiError(error);
  }
}
