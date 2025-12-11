import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { GroupBooking } from '@/models/GroupBooking';
import { Booking } from '@/models/Booking';
import { Resource } from '@/models/Resource';
import { User } from '@/models/User';
import { requireAuth } from '@/lib/auth/guards';
import { canUserBook, isGroupBookingExpired, getPolicyValue } from '@/lib/policies';
import { handleApiError, NotFoundError, AuthorizationError, ValidationError, ConflictError } from '@/lib/errors';
import { getTodayStart } from '@/lib/timezone';
import { sendEmail } from '@/lib/email';
import { formatDateTime } from '@/lib/utils';
import mongoose from 'mongoose';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  let session: mongoose.ClientSession | null = null;
  try {
    const currentUser = await requireAuth(['STUDENT']);
    await connectDB();
    session = await mongoose.startSession();
    await session.startTransaction();

    // FIX: Validate ObjectId to prevent MongoDB CastError
    if (!mongoose.Types.ObjectId.isValid(params.id)) {
      throw new ValidationError('Invalid group booking ID format');
    }

    const { email } = await req.json();

    if (!email) {
      throw new ValidationError('Email is required');
    }

    // Find group booking
    const groupBooking = await GroupBooking.findById(params.id).session(session);
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
    const booking = await Booking.findById(groupBooking.bookingId).session(session);
    if (!booking) {
      throw new NotFoundError('Booking');
    }

    // Check if expired (either expiresAt passed OR booking start time passed)
    if (isGroupBookingExpired(groupBooking.expiresAt, booking.start)) {
      groupBooking.status = 'EXPIRED';
      await groupBooking.save({ session });

      if (booking.status === 'PENDING') {
        booking.status = 'CANCELLED';
        await booking.save({ session });
      }

      await session.commitTransaction();
      session.endSession();

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
    }).session(session);

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
    }).session(session);

    if (conflictingBooking) {
      throw new ConflictError(`${email} has a conflicting booking at this time`);
    }

    // Check daily limit for facilities (using IST timezone)
    const today = getTodayStart();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayBookings = await Booking.countDocuments({
      userId: newMember.id,
      kind: 'FACILITY', // Group bookings are FACILITY type
      status: { $in: ['CONFIRMED', 'CHECKED_IN', 'PENDING'] },
      start: { $gte: today, $lt: tomorrow },
    }).session(session);

    // Check per-type daily limit for facilities (DYNAMIC - uses admin-configured value)
    const maxFacilityPerDay = await getPolicyValue('MAX_FACILITY_BOOKINGS_PER_DAY');
    if (todayBookings >= maxFacilityPerDay) {
      throw new ConflictError(`${email} has reached their daily facility booking limit`);
    }

    // Add new member to group
    groupBooking.members.push({
      userId: newMember.id,
      email: newMember.email,
      name: newMember.name,
      status: 'PENDING',
      invitedAt: new Date(),
    });

    await groupBooking.save({ session });

    await session.commitTransaction();
    session.endSession();

    await sendSingleInvitationEmail({
      groupBookingId: groupBooking.id,
      member: groupBooking.members[groupBooking.members.length - 1],
      booking,
      resource: await Resource.findById(booking.resourceId),
    });

    return NextResponse.json({
      message: `Invitation sent to ${email}`,
      groupBooking,
    });

  } catch (error) {
    console.error('Invite replacement error:', error);
    if (session?.inTransaction()) {
      await session.abortTransaction();
    }
    session?.endSession();
    return handleApiError(error);
  }
}

const INVITE_BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000';
const INVITE_SMTP_CONFIGURED = Boolean(process.env.SMTP_USER && process.env.SMTP_PASSWORD);

async function sendSingleInvitationEmail(options: {
  groupBookingId: string;
  member: { email: string; name?: string };
  booking: any;
  resource: any;
}) {
  const { groupBookingId, member, booking, resource } = options;
  if (!member?.email) return;

  const statusUpdate = async (emailSent: boolean, emailError?: string) => {
    await GroupBooking.updateOne(
      { _id: groupBookingId, 'members.email': member.email },
      {
        $set: {
          'members.$.emailSent': emailSent,
          'members.$.emailSentAt': emailSent ? new Date() : undefined,
          'members.$.emailError': emailError,
        }
      }
    );
  };

  if (!INVITE_SMTP_CONFIGURED) {
    await statusUpdate(false, 'SMTP not configured');
    return;
  }

  const invitationUrl = `${INVITE_BASE_URL}/user/group-invitations`;
  const startTime = formatDateTime(new Date(booking.start));
  const endTime = formatDateTime(new Date(booking.end));

  try {
    await sendEmail({
      to: member.email,
      subject: `Updated invitation: ${resource?.name || 'Group booking'}`,
      html: `
        <p>Hi ${member.name || member.email},</p>
        <p>You have been invited to a group booking for <strong>${resource?.name || 'a facility'}</strong>.</p>
        <ul>
          <li>Start: ${startTime}</li>
          <li>End: ${endTime}</li>
          <li>Location: ${resource?.location || 'On campus'}</li>
        </ul>
        <p>Please respond in your dashboard: <a href="${invitationUrl}">${invitationUrl}</a></p>
      `,
    });

    await statusUpdate(true);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Failed to send invitation email';
    await statusUpdate(false, errorMessage);
  }
}
