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
import { toIST } from '@/lib/timezone';
import { canUserCreateBookingWithCaps } from '@/lib/bookingRules';
import { countActiveGroupParticipations } from '@/lib/groupBookingParticipation';
import { sendEmail } from '@/lib/email';
import { formatDateTime } from '@/lib/utils';

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
      // FIX: session.user.id is the ObjectId, not email
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
      const endDate = new Date(end);
      
      if (!isWithinAdvanceWindow(startDate)) {
        throw new ValidationError(`Bookings can only be made up to ${POLICIES.ADVANCE_BOOKING_DAYS} days in advance`);
      }

      // Validate working hours (8 AM - 8 PM IST)
      const startIST = toIST(startDate);
      const endIST = toIST(endDate);
      const startHour = startIST.getHours();
      const endHour = endIST.getHours();
      const endMinutes = endIST.getMinutes();
      
      // Working hours: 8:00 AM (08:00) to 8:00 PM (20:00)
      if (startHour < POLICIES.WORKING_HOURS_START) {
        throw new ValidationError(`Bookings cannot start before ${POLICIES.WORKING_HOURS_START}:00 AM`);
      }

      // End time can be exactly 8:00 PM (20:00) but not after
      if (endHour > POLICIES.WORKING_HOURS_END || (endHour === POLICIES.WORKING_HOURS_END && endMinutes > 0)) {
        throw new ValidationError(`Bookings cannot end after ${POLICIES.WORKING_HOURS_END % 12 || 12}:00 PM`);
      }

      // Validate booking duration
      const durationMinutes = (endDate.getTime() - startDate.getTime()) / (1000 * 60);
      
      if (durationMinutes < POLICIES.MIN_BOOKING_DURATION_MINUTES) {
        throw new ValidationError(
          `Booking duration must be at least ${POLICIES.MIN_BOOKING_DURATION_MINUTES} minutes.`
        );
      }

      if (durationMinutes > POLICIES.MAX_BOOKING_DURATION_MINUTES) {
        throw new ValidationError(
          `Booking duration cannot exceed ${POLICIES.MAX_BOOKING_DURATION_MINUTES} minutes (${POLICIES.MAX_BOOKING_DURATION_MINUTES / 60} hours).`
        );
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
        // FIX: conflictingBookings.userId is the ObjectId, not email
        const conflictUser = await User.findById(conflictingBookings.userId).session(txSession);
        throw new ConflictError(`${conflictUser?.email || 'A member'} has a conflicting booking at this time`);
      }

      // Per-user, per-category caps for all members (group booking is always FACILITY)
      const startDateForCaps = new Date(start);
      const endDateForCaps = new Date(end);

      for (const member of [...members, organizer]) {
        const capsCheck = await canUserCreateBookingWithCaps({
          userId: member.id,
          kind: 'FACILITY',
          start: startDateForCaps,
          end: endDateForCaps,
          session: txSession,
        });

        if (!capsCheck.allowed) {
          throw new ValidationError(`${member.email}: ${capsCheck.reason || 'Booking limits exceeded'}`);
        }
      }

      // Check active booking count for all members (direct + group participation)
      // This prevents users from bypassing the "3 active facilities/rooms" limit via group bookings
      for (const member of [...members, organizer]) {
        const activePersonal = await Booking.countDocuments({
          userId: member.id,
          kind: { $in: ['FACILITY', 'ROOM'] },
          status: { $in: ['CONFIRMED', 'CHECKED_IN', 'PENDING'] },
          end: { $gt: new Date() },
        }).session(txSession);

        const activeGroup = await countActiveGroupParticipations(member.id, txSession);
        const activeTotal = activePersonal + activeGroup;

        if (activeTotal >= POLICIES.MAX_TOTAL_ACTIVE_BOOKINGS) {
          throw new ValidationError(
            `${member.email} already has ${activeTotal} active facility/room bookings. ` +
            `Maximum allowed is ${POLICIES.MAX_TOTAL_ACTIVE_BOOKINGS}. Please cancel an existing booking first.`
          );
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

      return {
        booking: booking[0],
        groupBooking: groupBooking[0],
        resource,
        organizer,
        expiresAt,
        expiresIn: expiresInHours >= 1
          ? `${expiresInHours} hours`
          : `${Math.round(expiresInMs / (1000 * 60))} minutes`,
      };
    }); // End of withTransaction

    await sendGroupInvitationEmails(
      transactionResult.groupBooking,
      transactionResult.booking,
      transactionResult.resource,
      transactionResult.organizer
    );

    // Re-fetch to include email tracking updates
    const refreshedGroupBooking = await GroupBooking.findById(transactionResult.groupBooking.id);

    return NextResponse.json({
      message: 'Group booking created. Invitations sent to members.',
      booking: transactionResult.booking,
      groupBooking: refreshedGroupBooking || transactionResult.groupBooking,
      expiresAt: transactionResult.expiresAt,
      expiresIn: transactionResult.expiresIn,
    }, { status: 201 });
  } catch (error) {
    console.error('Group booking creation error:', error);
    return handleApiError(error);
  }
}

export const POST = withRateLimit(postHandler);

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000';
const SMTP_CONFIGURED = Boolean(process.env.SMTP_USER && process.env.SMTP_PASSWORD);

async function markInvitationStatus(groupBookingId: string, email: string, status: {
  emailSent?: boolean;
  emailSentAt?: Date;
  emailError?: string;
}) {
  await GroupBooking.updateOne(
    { _id: groupBookingId, 'members.email': email },
    {
      $set: {
        'members.$.emailSent': status.emailSent ?? false,
        'members.$.emailSentAt': status.emailSentAt,
        'members.$.emailError': status.emailError,
      }
    }
  );
}

async function sendGroupInvitationEmails(
  groupBooking: any,
  booking: any,
  resource: any,
  organizer: any
) {
  const invitationUrl = `${BASE_URL}/user/group-invitations`;
  const startTime = formatDateTime(new Date(booking.start));
  const endTime = formatDateTime(new Date(booking.end));
  const organizerDisplay = organizer?.name || organizer?.email || 'Organizer';

  for (const member of groupBooking.members) {
    if (!member.email) continue;

    // Track failure when SMTP is not configured to surface in UI
    if (!SMTP_CONFIGURED) {
      await markInvitationStatus(groupBooking.id, member.email, {
        emailSent: false,
        emailError: 'SMTP not configured',
      });
      continue;
    }

    const html = `
      <p>Hi ${member.name || member.email},</p>
      <p>${organizerDisplay} invited you to a group booking for <strong>${resource.name}</strong>.</p>
      <ul>
        <li>Start: ${startTime}</li>
        <li>End: ${endTime}</li>
        <li>Location: ${resource.location || 'On campus'}</li>
      </ul>
      <p>Please respond in your dashboard: <a href="${invitationUrl}">${invitationUrl}</a></p>
    `;

    try {
      await sendEmail({
        to: member.email,
        subject: `Invitation: ${resource.name} group booking`,
        html,
      });

      await markInvitationStatus(groupBooking.id, member.email, {
        emailSent: true,
        emailSentAt: new Date(),
        emailError: undefined,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to send invitation email';
      await markInvitationStatus(groupBooking.id, member.email, {
        emailSent: false,
        emailError: errorMessage,
      });
    }
  }
}
