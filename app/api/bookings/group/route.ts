import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Booking } from '@/models/Booking';
import { Resource } from '@/models/Resource';
import { User } from '@/models/User';
import { GroupBooking } from '@/models/GroupBooking';
import { POLICIES, canUserBook, isWithinAdvanceWindow } from '@/lib/policies';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import { groupBookingSchema } from '@/lib/validations';
import { withRateLimit } from '@/lib/ratelimit';
import { handleApiError, ValidationError, AuthenticationError, AuthorizationError, NotFoundError, ConflictError } from '@/lib/errors';

async function postHandler(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      throw new AuthenticationError();
    }

    const body = await req.json();

    // Validate input using Zod
    const validationResult = groupBookingSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation Error', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    const { resourceId, start, end, memberEmails } = validationResult.data;

    await connectDB();

    // Get organizer
    const organizer = await User.findById(session.user.id);
    if (!organizer || organizer.role !== 'STUDENT') {
      throw new AuthorizationError('Only students can create group bookings');
    }

    // Check if organizer can book
    const canBook = canUserBook(organizer);
    if (!canBook.allowed) {
      throw new ValidationError(canBook.reason || 'Booking not allowed');
    }

    // Get resource
    const resource = await Resource.findById(resourceId);
    if (!resource || resource.status !== 'ACTIVE') {
      throw new NotFoundError('Resource');
    }

    // Check if resource is a team sport
    const teamSports = POLICIES.GROUP_BOOKING_TEAM_SPORTS as readonly string[];
    if (!teamSports.includes(resource.name)) {
      throw new ValidationError(`Group bookings are only available for: ${POLICIES.GROUP_BOOKING_TEAM_SPORTS.join(', ')}`);
    }

    // Check advance window
    const startDate = new Date(start);
    if (!isWithinAdvanceWindow(startDate)) {
      throw new ValidationError(`Bookings can only be made up to ${POLICIES.ADVANCE_BOOKING_DAYS} days in advance`);
    }

    // Validate minimum members (organizer + friends = 6+)
    const totalMembers = 1 + memberEmails.length;
    if (totalMembers < POLICIES.GROUP_BOOKING_MIN_MEMBERS) {
      throw new ValidationError(`Group bookings require at least ${POLICIES.GROUP_BOOKING_MIN_MEMBERS} people. You have ${totalMembers}.`);
    }

    // Remove duplicates and organizer's own email
    const uniqueEmails: string[] = [...new Set<string>(memberEmails as string[])]
      .filter((email: string) => email.toLowerCase() !== organizer.email.toLowerCase());

    if (uniqueEmails.length !== memberEmails.length) {
      throw new ValidationError('Duplicate emails or your own email detected. Please provide unique friend emails.');
    }

    // Validate all member emails exist and are students
    const members = await User.find({
      email: { $in: uniqueEmails },
      role: 'STUDENT'
    });

    if (members.length !== uniqueEmails.length) {
      const foundEmails = members.map(m => m.email.toLowerCase());
      const notFound = uniqueEmails.filter((e: string) => !foundEmails.includes(e.toLowerCase()));
      throw new NotFoundError(`These emails are not registered students: ${notFound.join(', ')}`);
    }

    // Check all members can book (penalties, suspension)
    for (const member of members) {
      const memberCanBook = canUserBook(member);
      if (!memberCanBook.allowed) {
        throw new ValidationError(`${member.email} cannot join: ${memberCanBook.reason}`);
      }
    }

    // Check for conflicts with existing bookings for all members (including organizer)
    const allMemberIds = [organizer.id, ...members.map(m => m.id)];

    const conflictingBookings = await Booking.findOne({
      userId: { $in: allMemberIds },
      status: { $in: ['CONFIRMED', 'CHECKED_IN', 'PENDING'] },
      start: { $lt: new Date(end) },
      end: { $gt: new Date(start) },
    });

    if (conflictingBookings) {
      const conflictUser = await User.findById(conflictingBookings.userId);
      throw new ConflictError(`${conflictUser?.email || 'A member'} has a conflicting booking at this time`);
    }

    // Check daily limits for all members
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    for (const member of [...members, organizer]) {
      const todayBookings = await Booking.countDocuments({
        userId: member.id,
        status: { $in: ['CONFIRMED', 'CHECKED_IN', 'PENDING'] },
        start: { $gte: today, $lt: tomorrow },
      });

      if (todayBookings >= POLICIES.MAX_BOOKINGS_PER_DAY) {
        throw new ValidationError(`${member.email} has reached their daily booking limit (${POLICIES.MAX_BOOKINGS_PER_DAY}/day)`);
      }
    }

    // Check weekly limits for all members
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    for (const member of [...members, organizer]) {
      const weekBookings = await Booking.countDocuments({
        userId: member.id,
        status: { $in: ['CONFIRMED', 'CHECKED_IN', 'PENDING', 'COMPLETED'] },
        start: { $gte: weekAgo },
      });

      if (weekBookings >= POLICIES.MAX_BOOKINGS_PER_WEEK) {
        throw new ValidationError(`${member.email} has reached their weekly booking limit (${POLICIES.MAX_BOOKINGS_PER_WEEK}/week)`);
      }
    }

    // Create the main booking (PENDING until enough confirmations)
    const booking = await Booking.create({
      userId: organizer.id,
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
      bookingId: booking.id,
      organizerId: organizer.id,
      organizerEmail: organizer.email,
      members: members.map(m => ({
        userId: m.id,
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
    booking.groupBookingId = groupBooking.id;
    await booking.save();

    return NextResponse.json({
      message: 'Group booking created. Invitations sent to members.',
      booking,
      groupBooking,
      expiresIn: `${POLICIES.GROUP_BOOKING_INVITATION_EXPIRY_HOURS} hours`,
    }, { status: 201 });

  } catch (error) {
    console.error('Group booking creation error:', error);
    return handleApiError(error);
  }
}

export const POST = withRateLimit(postHandler);
