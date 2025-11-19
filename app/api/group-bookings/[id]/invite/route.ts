import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { GroupBooking } from '@/models/GroupBooking';
import { Booking } from '@/models/Booking';
import { User } from '@/models/User';
import { requireAuth } from '@/lib/auth/guards';
import { canUserBook, POLICIES } from '@/lib/policies';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const currentUser = await requireAuth(['STUDENT']);
    await connectDB();

    const { email } = await req.json();

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Find group booking
    const groupBooking = await GroupBooking.findById(params.id);
    if (!groupBooking) {
      return NextResponse.json({ error: 'Group booking not found' }, { status: 404 });
    }

    // Check if current user is the organizer
    if (groupBooking.organizerId !== currentUser.id) {
      return NextResponse.json(
        { error: 'Only the organizer can invite replacements' },
        { status: 403 }
      );
    }

    // Check if booking is still pending confirmations
    if (groupBooking.status !== 'PENDING_CONFIRMATIONS') {
      return NextResponse.json(
        { error: `Cannot invite to a ${groupBooking.status.toLowerCase()} booking` },
        { status: 400 }
      );
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

      return NextResponse.json(
        { error: 'This group booking has expired' },
        { status: 400 }
      );
    }

    // Check if email is already in the group
    const alreadyMember = groupBooking.members.some(
      m => m.email.toLowerCase() === email.toLowerCase()
    );
    if (alreadyMember) {
      return NextResponse.json(
        { error: 'This person is already invited to this booking' },
        { status: 400 }
      );
    }

    // Check if it's the organizer's email
    if (groupBooking.organizerEmail.toLowerCase() === email.toLowerCase()) {
      return NextResponse.json(
        { error: 'Cannot invite yourself' },
        { status: 400 }
      );
    }

    // Find the new member
    const newMember = await User.findOne({
      email: email.toLowerCase(),
      role: 'STUDENT'
    });

    if (!newMember) {
      return NextResponse.json(
        { error: `${email} is not a registered student` },
        { status: 400 }
      );
    }

    // Check if new member can book
    const memberCanBook = canUserBook(newMember);
    if (!memberCanBook.allowed) {
      return NextResponse.json(
        { error: `${email} cannot join: ${memberCanBook.reason}` },
        { status: 400 }
      );
    }

    // Get the booking to check conflicts
    const booking = await Booking.findById(groupBooking.bookingId);
    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    // Check for conflicts
    const conflictingBooking = await Booking.findOne({
      userId: newMember.id,
      status: { $in: ['CONFIRMED', 'CHECKED_IN', 'PENDING'] },
      start: { $lt: booking.end },
      end: { $gt: booking.start },
    });

    if (conflictingBooking) {
      return NextResponse.json(
        { error: `${email} has a conflicting booking at this time` },
        { status: 400 }
      );
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
      return NextResponse.json(
        { error: `${email} has reached their daily booking limit` },
        { status: 400 }
      );
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
      return NextResponse.json(
        { error: `${email} has reached their weekly booking limit` },
        { status: 400 }
      );
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

  } catch (error: any) {
    console.error('Invite replacement error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to invite replacement' },
      { status: 500 }
    );
  }
}
