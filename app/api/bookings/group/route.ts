import { NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Booking } from '@/models/Booking';
import { Resource } from '@/models/Resource';
import { User } from '@/models/User';
import { GroupBooking } from '@/models/GroupBooking';
import { POLICIES, canUserBook, isWithinAdvanceWindow, calculateGroupBookingExpiration, canCreateGroupBooking } from '@/lib/policies';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import { groupBookingSchema } from '@/lib/validations';
import { withRateLimit } from '@/lib/ratelimit';
import { withTransaction } from '@/lib/transaction';
import { handleApiError, ValidationError, AuthenticationError, AuthorizationError, NotFoundError, ConflictError } from '@/lib/errors';
import { getNow, getTodayStart } from '@/lib/timezone';

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

    const conn = await connectDB();
    if (!conn) {
      return NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
    }

    return await withTransaction(conn, async (txSession) => {

      // Get organizer within transaction
      const organizer = await User.findById(session.user.id).session(txSession);
      if (!organizer || organizer.role !== 'STUDENT') {
        throw new AuthorizationError('Only students can create group bookings');
      }

      // Check if organizer can book
      const canBook = canUserBook(organizer);
      if (!canBook.allowed) {
        throw new ValidationError(canBook.reason || 'Booking not allowed');
      }

      // Get resource within transaction
      const resource = await Resource.findById(resourceId).session(txSession);
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

      // Check if group booking can be created (enough time before start)
      const canCreate = canCreateGroupBooking(startDate);
      if (!canCreate.allowed) {
        throw new ValidationError(canCreate.reason || 'Cannot create group booking');
      }

      // FIX EC-42: Add maximum limit on member emails
      if (memberEmails.length > 10) {
        throw new ValidationError('Maximum 10 members allowed (you + 9 friends)');
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
      }).session(txSession);

      // FIX EC-25: Prevent email enumeration - don't reveal which emails are invalid
      if (members.length !== uniqueEmails.length) {
        throw new ValidationError(`Some invited users are not eligible to join group bookings. Please verify all emails are registered students.`);
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
        end: { $gt: new Date(start) },  // These are already Date objects from client
      }).session(txSession);

      if (conflictingBookings) {
        const conflictUser = await User.findById(conflictingBookings.userId).session(txSession);
        throw new ConflictError(`${conflictUser?.email || 'A member'} has a conflicting booking at this time`);
      }

      // Check daily limits within transaction (using IST timezone)
      const today = getTodayStart();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      for (const member of [...members, organizer]) {
        const todayBookings = await Booking.countDocuments({
          userId: member.id,
          status: { $in: ['CONFIRMED', 'CHECKED_IN', 'PENDING'] },
          start: { $gte: today, $lt: tomorrow },
        }).session(txSession);

        if (todayBookings >= POLICIES.MAX_BOOKINGS_PER_DAY) {
          throw new ValidationError(`${member.email} has reached their daily booking limit (${POLICIES.MAX_BOOKINGS_PER_DAY}/day)`);
        }
      }

      // Check weekly limits within transaction (using IST timezone)
      const weekAgo = getNow();
      weekAgo.setDate(weekAgo.getDate() - 7);

      for (const member of [...members, organizer]) {
        const weekBookings = await Booking.countDocuments({
          userId: member.id,
          status: { $in: ['CONFIRMED', 'CHECKED_IN', 'PENDING', 'COMPLETED'] },
          start: { $gte: weekAgo },
        }).session(txSession);

        if (weekBookings >= POLICIES.MAX_BOOKINGS_PER_WEEK) {
          throw new ValidationError(`${member.email} has reached their weekly booking limit (${POLICIES.MAX_BOOKINGS_PER_WEEK}/week)`);
        }
      }

      // Create bookings within transaction
      const booking = await Booking.create([{
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
      }], { session: txSession });

      // Create group booking with dynamic expiry
      // Expiration is the earlier of: creation + 2h OR start - 1h
      const createdAt = new Date();
      const expiresAt = calculateGroupBookingExpiration(startDate, createdAt);

      const groupBooking = await GroupBooking.create([{
        bookingId: booking[0].id,
        organizerId: organizer.id,
        organizerEmail: organizer.email,
        members: members.map(m => ({
          userId: m.id,
          email: m.email,
          name: m.name,
          status: 'PENDING',
          invitedAt: createdAt,
        })),
        requiredMinimum: POLICIES.GROUP_BOOKING_MIN_MEMBERS,
        confirmedCount: 1, // Organizer is auto-confirmed
        status: 'PENDING_CONFIRMATIONS',
        expiresAt,
      }], { session: txSession });

      // Update booking with group reference
      booking[0].groupBookingId = groupBooking[0].id;
      await booking[0].save({ session: txSession });

      // Calculate time until expiration for response message
      const now = new Date();
      const expiresInMs = expiresAt.getTime() - now.getTime();
      const expiresInHours = Math.round((expiresInMs / (1000 * 60 * 60)) * 10) / 10; // Round to 1 decimal

      return NextResponse.json({
        message: 'Group booking created. Invitations sent to members.',
        booking: booking[0],
        groupBooking: groupBooking[0],
        expiresAt,
        expiresIn: expiresInHours >= 1
          ? `${expiresInHours} hours`
          : `${Math.round(expiresInMs / (1000 * 60))} minutes`,
      }, { status: 201 });
    }); // End of withTransaction

  } catch (error) {
    console.error('Group booking creation error:', error);
    return handleApiError(error);
  }
}

export const POST = withRateLimit(postHandler);
