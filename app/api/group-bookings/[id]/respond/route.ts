import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { GroupBooking } from '@/models/GroupBooking';
import { Booking } from '@/models/Booking';
import { requireAuth } from '@/lib/auth/guards';
import { isGroupBookingExpired } from '@/lib/policies';
import { handleApiError, NotFoundError, AuthorizationError, ValidationError } from '@/lib/errors';
import { getNow } from '@/lib/timezone';
import mongoose from 'mongoose';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth(['STUDENT']);
    await connectDB();

    // FIX: Validate ObjectId to prevent MongoDB CastError
    if (!mongoose.Types.ObjectId.isValid(params.id)) {
      throw new ValidationError('Invalid group booking ID format');
    }

    const { response } = await req.json(); // 'ACCEPT' or 'REJECT'

    if (!response || !['ACCEPT', 'REJECT'].includes(response)) {
      throw new ValidationError('Invalid response');
    }

    // Find group booking
    const groupBooking = await GroupBooking.findById(params.id);
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
    const booking = await Booking.findById(groupBooking.bookingId);
    if (!booking) {
      throw new NotFoundError('Booking');
    }

    // Check if expired (either expiresAt passed OR booking start time passed)
    if (isGroupBookingExpired(groupBooking.expiresAt, booking.start)) {
      groupBooking.status = 'EXPIRED';
      await groupBooking.save();

      // Cancel the booking if still pending
      if (booking.status === 'PENDING') {
        // Release equipment inventory reservation
        if (booking.items && (booking.kind === 'EQUIPMENT' || booking.kind === 'LIBRARY')) {
          const { EquipmentItem } = await import('@/models/EquipmentItem');
          for (const item of booking.items) {
            await EquipmentItem.findByIdAndUpdate(
              item.itemId,
              { $inc: { qtyReserved: -item.qty } }
            );
          }
        }

        booking.status = 'CANCELLED';
        await booking.save();
      }

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
      groupBooking.members[memberIndex].status = 'CONFIRMED';
      groupBooking.members[memberIndex].respondedAt = getNow();

      // FIX EC-15: Use atomic $inc to prevent race condition
      // Previously, we fetched confirmedCount, incremented in JS, and saved back
      // If two users accepted simultaneously, both would read the same count and save the same incremented value
      // Using $inc ensures MongoDB handles the increment atomically
      const updatedGroupBooking = await GroupBooking.findByIdAndUpdate(
        params.id,
        {
          $set: {
            [`members.${memberIndex}.status`]: 'CONFIRMED',
            [`members.${memberIndex}.respondedAt`]: getNow(),
          },
          $inc: { confirmedCount: 1 }
        },
        { new: true }
      );

      if (!updatedGroupBooking) {
        throw new NotFoundError('Group booking');
      }

      // Check if we now have enough confirmations
      if (updatedGroupBooking.confirmedCount >= updatedGroupBooking.requiredMinimum) {
        updatedGroupBooking.status = 'CONFIRMED';

        // Update main booking to CONFIRMED (booking already fetched above)
        booking.status = 'CONFIRMED';
        await booking.save();

        await updatedGroupBooking.save();
      } else {
        await updatedGroupBooking.save();
      }

      return NextResponse.json({
        message: 'Invitation accepted',
        groupBooking: updatedGroupBooking,
        isBookingConfirmed: updatedGroupBooking.status === 'CONFIRMED',
      });

    } else {
      // REJECT
      groupBooking.members[memberIndex].status = 'REJECTED';
      groupBooking.members[memberIndex].respondedAt = getNow();
      await groupBooking.save();

      // Check if we can still reach minimum with remaining pending members
      const pendingCount = groupBooking.members.filter(m => m.status === 'PENDING').length;
      const possibleTotal = groupBooking.confirmedCount + pendingCount;

      if (possibleTotal < groupBooking.requiredMinimum) {
        // Cancel the booking - can't reach minimum even with all pending accepting
        groupBooking.status = 'CANCELLED';
        await groupBooking.save();

        // Release equipment inventory reservation
        if (booking.items && (booking.kind === 'EQUIPMENT' || booking.kind === 'LIBRARY')) {
          const { EquipmentItem } = await import('@/models/EquipmentItem');
          for (const item of booking.items) {
            await EquipmentItem.findByIdAndUpdate(
              item.itemId,
              { $inc: { qtyReserved: -item.qty } }
            );
          }
        }

        // Booking already fetched above
        booking.status = 'CANCELLED';
        await booking.save();

        return NextResponse.json({
          message: 'Invitation rejected. Group booking cancelled (insufficient members).',
          groupBooking,
        });
      }

      return NextResponse.json({
        message: 'Invitation rejected. Organizer can invite a replacement.',
        groupBooking,
      });
    }

  } catch (error) {
    console.error('Respond to invitation error:', error);
    return handleApiError(error);
  }
}
