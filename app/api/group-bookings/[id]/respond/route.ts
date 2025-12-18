import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { GroupBooking } from '@/models/GroupBooking';
import { Booking } from '@/models/Booking';
import { requireAuth } from '@/lib/auth/guards';
import { isGroupBookingExpired, POLICIES } from '@/lib/policies';
import { countActiveGroupParticipations } from '@/lib/groupBookingParticipation';
import { handleApiError, NotFoundError, AuthorizationError, ValidationError } from '@/lib/errors';
import mongoose from 'mongoose';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  let session: mongoose.ClientSession | null = null;
  try {
    const user = await requireAuth(['STUDENT']);
    const conn = await connectDB();

    // FIX: Validate ObjectId to prevent MongoDB CastError
    if (!mongoose.Types.ObjectId.isValid(params.id)) {
      throw new ValidationError('Invalid group booking ID format');
    }

    const { response } = await req.json(); // 'ACCEPT' or 'REJECT'

    if (!response || !['ACCEPT', 'REJECT'].includes(response)) {
      throw new ValidationError('Invalid response');
    }

    session = await mongoose.startSession();
    await session.startTransaction();

    // Find group booking
    const groupBooking = await GroupBooking.findById(params.id).session(session);
    if (!groupBooking) {
      throw new NotFoundError('Group booking');
    }

    // Check if user is a member
    const memberIndex = groupBooking.members.findIndex(m => m.userId === user.id);
    if (memberIndex === -1) {
      throw new AuthorizationError('You are not invited to this group booking');
    }

    // Check if already responded
    const member = groupBooking.members[memberIndex];
    if (member.status !== 'PENDING') {
      throw new ValidationError(`You have already ${member.status.toLowerCase()} this invitation`);
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

      // Cancel the booking if still pending
      if (booking.status === 'PENDING') {
        booking.status = 'CANCELLED';
        await booking.save({ session });
      }

      await session.commitTransaction();
      session.endSession();

      return NextResponse.json(
        { error: 'This invitation has expired' },
        { status: 400 }
      );
    }

    // Check if booking is still pending
    if (groupBooking.status !== 'PENDING_CONFIRMATIONS') {
      throw new ValidationError('This booking is no longer accepting responses');
    }

    // Update member status
    if (response === 'ACCEPT') {
      // FIX: Check if accepting would exceed active booking limit
      // This prevents users from bypassing MAX_TOTAL_ACTIVE_BOOKINGS via group invitations
      const activePersonal = await Booking.countDocuments({
        userId: user.id,
        kind: { $in: ['FACILITY', 'ROOM'] },
        status: { $in: ['CONFIRMED', 'CHECKED_IN', 'PENDING'] },
        end: { $gt: new Date() },
      }).session(session);

      const activeGroup = await countActiveGroupParticipations(
        user.id,
        session,
        {
          excludeGroupBookingId: params.id, // don't count the invitation being responded to
          requireConfirmedMembership: true, // only count groups the user already confirmed
        }
      );
      const activeTotal = activePersonal + activeGroup;

      if (activeTotal >= POLICIES.MAX_TOTAL_ACTIVE_BOOKINGS) {
        throw new ValidationError(
          `You already have ${activeTotal} active facility/room bookings. ` +
          `Maximum allowed is ${POLICIES.MAX_TOTAL_ACTIVE_BOOKINGS}. ` +
          `Please cancel an existing booking before accepting this invitation.`
        );
      }

      // FIX EC-1: Atomic update guarded on pending status to block post-rejection confirmations
      const updatedGroupBooking = await GroupBooking.findOneAndUpdate(
        {
          _id: params.id,
          status: 'PENDING_CONFIRMATIONS',
          'members.userId': user.id,
          'members.status': 'PENDING',
        },
        {
          $set: {
            'members.$.status': 'CONFIRMED',
            'members.$.respondedAt': new Date(),
          },
          $inc: { confirmedCount: 1 }
        },
        { new: true, session }
      );

      if (!updatedGroupBooking) {
        throw new ValidationError('You have already responded to this invitation');
      }

      // Check if we now have enough confirmations and atomically update status if needed
      if (updatedGroupBooking.confirmedCount >= updatedGroupBooking.requiredMinimum &&
        updatedGroupBooking.status === 'PENDING_CONFIRMATIONS') {

        // Atomic status update with condition to prevent race
        const confirmedBooking = await GroupBooking.findOneAndUpdate(
          {
            _id: params.id,
            status: 'PENDING_CONFIRMATIONS', // Only update if still pending
            confirmedCount: { $gte: updatedGroupBooking.requiredMinimum }
          },
          {
            $set: { status: 'CONFIRMED' }
          },
          { new: true, session }
        );

        // Only update main booking if we successfully confirmed the group
        if (confirmedBooking) {
          booking.status = 'CONFIRMED';
          await booking.save({ session });

          await session.commitTransaction();
          session.endSession();

          return NextResponse.json({
            message: 'Invitation accepted. Group booking confirmed!',
            groupBooking: confirmedBooking,
            isBookingConfirmed: true,
          });
        }
      }

      // If we didn't confirm, just return success
      await session.commitTransaction();
      session.endSession();

      return NextResponse.json({
        message: 'Invitation accepted',
        groupBooking: updatedGroupBooking,
        isBookingConfirmed: updatedGroupBooking.status === 'CONFIRMED',
      });

    } else {
      // REJECT
      // FIX: Use atomic findOneAndUpdate to prevent race conditions during rejection
      const updatedGroupBooking = await GroupBooking.findOneAndUpdate(
        {
          _id: params.id,
          status: 'PENDING_CONFIRMATIONS',
          'members.userId': user.id,
          'members.status': 'PENDING',
        },
        {
          $set: {
            'members.$.status': 'REJECTED',
            'members.$.respondedAt': new Date(),
          }
        },
        { new: true, session }
      );

      if (!updatedGroupBooking) {
        throw new ValidationError('You have already responded to this invitation or it is no longer active');
      }

      // Check if we can still reach minimum with remaining pending members
      const pendingCount = updatedGroupBooking.members.filter(m => m.status === 'PENDING').length;
      const possibleTotal = updatedGroupBooking.confirmedCount + pendingCount;

      if (possibleTotal < updatedGroupBooking.requiredMinimum) {
        // Cancel the booking - can't reach minimum even with all pending accepting
        // Atomic status update to CANCELLED
        await GroupBooking.updateOne(
          { _id: params.id, status: 'PENDING_CONFIRMATIONS' },
          { $set: { status: 'CANCELLED' } },
          { session }
        );

        // Booking already fetched above
        booking.status = 'CANCELLED';
        await booking.save({ session });

        await session.commitTransaction();
        session.endSession();

        return NextResponse.json({
          message: 'Invitation rejected. Group booking cancelled (insufficient members).',
          groupBooking: { ...updatedGroupBooking.toObject(), status: 'CANCELLED' },
        });
      }

      await session.commitTransaction();
      session.endSession();

      return NextResponse.json({
        message: 'Invitation rejected. Organizer can invite a replacement.',
        groupBooking: updatedGroupBooking,
      });
    }

  } catch (error) {
    console.error('Respond to invitation error:', error);
    if (session?.inTransaction()) {
      await session.abortTransaction();
    }
    session?.endSession();
    return handleApiError(error);
  }
}
