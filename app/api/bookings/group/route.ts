import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Booking } from '@/models/Booking';
import { Resource } from '@/models/Resource';
import { User } from '@/models/User';
import { GroupBooking } from '@/models/GroupBooking';
import { requireAuth } from '@/lib/auth/guards';
import { POLICIES, canUserBook, isWithinAdvanceWindow } from '@/lib/policies';

export async function POST(req: NextRequest) {
  try {
    const currentUser = await requireAuth(['STUDENT']);
    await connectDB();

    const body = await req.json();
    const { resourceId, start, end, memberEmails } = body;

    if (!resourceId || !start || !end || !memberEmails || !Array.isArray(memberEmails)) {
      return NextResponse.json(
        { error: 'Missing required fields: resourceId, start, end, memberEmails' },
        { status: 400 }
      );
    }

    // Get organizer
    const organizer = await User.findById(currentUser.id);
    if (!organizer || organizer.role !== 'STUDENT') {
      return NextResponse.json({ error: 'Only students can create group bookings' }, { status: 403 });
    }

    // Check if organizer can book
    const canBook = canUserBook(organizer);
    if (!canBook.allowed) {
      return NextResponse.json({ error: canBook.reason }, { status: 403 });
    }

    // Get resource
    const resource = await Resource.findById(resourceId);
    if (!resource || resource.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'Resource not available' }, { status: 404 });
    }

    // Check if resource is a team sport
    if (!POLICIES.GROUP_BOOKING_TEAM_SPORTS.includes(resource.name)) {
      return NextResponse.json(
        { error: `Group bookings are only available for: ${POLICIES.GROUP_BOOKING_TEAM_SPORTS.join(', ')}` },
        { status: 400 }
      );
    }

    // Check advance window
    const startDate = new Date(start);
    if (!isWithinAdvanceWindow(startDate)) {
      return NextResponse.json(
        { error: `Bookings can only be made up to ${POLICIES.ADVANCE_BOOKING_DAYS} days in advance` },
        { status: 400 }
      );
    }

    // Validate minimum members (organizer + friends = 6+)
    const totalMembers = 1 + memberEmails.length;
    if (totalMembers < POLICIES.GROUP_BOOKING_MIN_MEMBERS) {
      return NextResponse.json(
        { error: `Group bookings require at least ${POLICIES.GROUP_BOOKING_MIN_MEMBERS} people. You have ${totalMembers}.` },
        { status: 400 }
      );
    }

    // Remove duplicates and organizer's own email
    const uniqueEmails = [...new Set(memberEmails)]
      .filter((email: string) => email.toLowerCase() !== organizer.email.toLowerCase());

    if (uniqueEmails.length !== memberEmails.length) {
      return NextResponse.json(
        { error: 'Duplicate emails or your own email detected. Please provide unique friend emails.' },
        { status: 400 }
      );
    }

    // Validate all member emails exist and are students
    const members = await User.find({
      email: { $in: uniqueEmails },
      role: 'STUDENT'
    });

    if (members.length !== uniqueEmails.length) {
      const foundEmails = members.map(m => m.email.toLowerCase());
      const notFound = uniqueEmails.filter((e: string) => !foundEmails.includes(e.toLowerCase()));
      return NextResponse.json(
        { error: `These emails are not registered students: ${notFound.join(', ')}` },
        { status: 400 }
      );
    }

    // Check all members can book (penalties, suspension)
    for (const member of members) {
      const memberCanBook = canUserBook(member);
      if (!memberCanBook.allowed) {
        return NextResponse.json(
          { error: `${member.email} cannot join: ${memberCanBook.reason}` },
          { status: 400 }
        );
      }
    }

    // Check for conflicts with existing bookings for all members (including organizer)
    const allMemberIds = [organizer._id.toString(), ...members.map(m => m._id.toString())];

    const conflictingBookings = await Booking.findOne({
      userId: { $in: allMemberIds },
      status: { $in: ['CONFIRMED', 'CHECKED_IN', 'PENDING'] },
      start: { $lt: new Date(end) },
      end: { $gt: new Date(start) },
    });

    if (conflictingBookings) {
      const conflictUser = await User.findById(conflictingBookings.userId);
      return NextResponse.json(
        { error: `${conflictUser?.email || 'A member'} has a conflicting booking at this time` },
        { status: 400 }
      );
    }

    // Check daily limits for all members
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    for (const member of [...members, organizer]) {
      const todayBookings = await Booking.countDocuments({
        userId: member._id.toString(),
        status: { $in: ['CONFIRMED', 'CHECKED_IN', 'PENDING'] },
        start: { $gte: today, $lt: tomorrow },
      });

      if (todayBookings >= POLICIES.MAX_BOOKINGS_PER_DAY) {
        return NextResponse.json(
          { error: `${member.email} has reached their daily booking limit (${POLICIES.MAX_BOOKINGS_PER_DAY}/day)` },
          { status: 400 }
        );
      }
    }

    // Check weekly limits for all members
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    for (const member of [...members, organizer]) {
      const weekBookings = await Booking.countDocuments({
        userId: member._id.toString(),
        status: { $in: ['CONFIRMED', 'CHECKED_IN', 'PENDING', 'COMPLETED'] },
        start: { $gte: weekAgo },
      });

      if (weekBookings >= POLICIES.MAX_BOOKINGS_PER_WEEK) {
        return NextResponse.json(
          { error: `${member.email} has reached their weekly booking limit (${POLICIES.MAX_BOOKINGS_PER_WEEK}/week)` },
          { status: 400 }
        );
      }
    }

    // Create the main booking (PENDING until enough confirmations)
    const booking = await Booking.create({
      userId: organizer._id.toString(),
      resourceId,
      kind: 'FACILITY',
      start: new Date(start),
      end: new Date(end),
      status: 'PENDING',
      requiresApproval: false,
      approval: 'NOT_REQUIRED',
      qrIssued: false,
      isGroupBooking: true,
    });

    // Create group booking with expiry
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + POLICIES.GROUP_BOOKING_INVITATION_EXPIRY_HOURS);

    const groupBooking = await GroupBooking.create({
      bookingId: booking._id.toString(),
      organizerId: organizer._id.toString(),
      organizerEmail: organizer.email,
      members: members.map(m => ({
        userId: m._id.toString(),
        email: m.email,
        name: m.name,
        status: 'PENDING',
        invitedAt: new Date(),
      })),
      requiredMinimum: POLICIES.GROUP_BOOKING_MIN_MEMBERS,
      confirmedCount: 1, // Organizer is auto-confirmed
      status: 'PENDING_CONFIRMATIONS',
      expiresAt,
    });

    // Update booking with group reference
    booking.groupBookingId = groupBooking._id.toString();
    await booking.save();

    return NextResponse.json({
      message: 'Group booking created. Invitations sent to members.',
      booking,
      groupBooking,
      expiresIn: `${POLICIES.GROUP_BOOKING_INVITATION_EXPIRY_HOURS} hours`,
    }, { status: 201 });

  } catch (error: any) {
    console.error('Group booking creation error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create group booking' },
      { status: 500 }
    );
  }
}
