import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { GroupBooking } from '@/models/GroupBooking';
import { Booking } from '@/models/Booking';
import { User } from '@/models/User';
import { requireAuth } from '@/lib/auth/guards';
import { canUserBook, POLICIES } from '@/lib/policies';
import { handleApiError, NotFoundError, AuthorizationError, ValidationError, ConflictError } from '@/lib/errors';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const currentUser = await requireAuth(['STUDENT']);
    await connectDB();

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

    // Check if expired
    if (new Date() > groupBooking.expiresAt) {
      groupBooking.status = 'EXPIRED';
      await groupBooking.save();

      const booking = await Booking.findById(groupBooking.bookingId);
      if (booking && booking.status === 'PENDING') {
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

    // Get the booking to check conflicts
    const booking = await Booking.findById(groupBooking.bookingId);
    if (!booking) {
      throw new NotFoundError('Booking');
    }

    // Check for conflicts
    const conflictingBooking = await Booking.findOne({
      userId: newMember.id,
      status: { $in: ['CONFIRMED', 'CHECKED_IN', 'PENDING'] },
      start: { $lt: booking.end },
      end: { $gt: booking.start },
    });

    if (conflictingBooking) {
      throw new ConflictError(`${email} has a conflicting booking at this time`);
    }

    // Check daily limit
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayBookings = await Booking.countDocuments({
      userId: newMember.id,
      status: { $in: ['CONFIRMED', 'CHECKED_IN', 'PENDING'] },
      start: { $gte: today, $lt: tomorrow },
    });

    if (todayBookings >= POLICIES.MAX_BOOKINGS_PER_DAY) {
      throw new ConflictError(`${email} has reached their daily booking limit`);
    }

    // Check weekly limit
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const weekBookings = await Booking.countDocuments({
      userId: newMember.id,
      status: { $in: ['CONFIRMED', 'CHECKED_IN', 'PENDING', 'COMPLETED'] },
      start: { $gte: weekAgo },
    });

    if (weekBookings >= POLICIES.MAX_BOOKINGS_PER_WEEK) {
      throw new ConflictError(`${email} has reached their weekly booking limit`);
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
