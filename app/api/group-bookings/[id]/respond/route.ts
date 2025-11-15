import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { GroupBooking } from '@/models/GroupBooking';
import { Booking } from '@/models/Booking';
import { requireAuth } from '@/lib/auth/guards';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth(['STUDENT']);
    await connectDB();

    const { response } = await req.json(); // 'ACCEPT' or 'REJECT'

    if (!['ACCEPT', 'REJECT'].includes(response)) {
      return NextResponse.json(
        { error: 'Response must be ACCEPT or REJECT' },
        { status: 400 }
      );
    }

    // Find group booking
    const groupBooking = await GroupBooking.findById(params.id);
    if (!groupBooking) {
      return NextResponse.json({ error: 'Group booking not found' }, { status: 404 });
    }

    // Check if user is a member
    const memberIndex = groupBooking.members.findIndex(m => m.userId === user.id);
    if (memberIndex === -1) {
      return NextResponse.json(
        { error: 'You are not a member of this group booking' },
        { status: 403 }
      );
    }

    // Check if already responded
    const member = groupBooking.members[memberIndex];
    if (member.status !== 'PENDING') {
      return NextResponse.json(
        { error: `You have already ${member.status.toLowerCase()} this invitation` },
        { status: 400 }
      );
    }

    // Check if expired
    if (new Date() > groupBooking.expiresAt) {
      groupBooking.status = 'EXPIRED';
      await groupBooking.save();

      // Cancel the booking
      const booking = await Booking.findById(groupBooking.bookingId);
      if (booking && booking.status === 'PENDING') {
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
      return NextResponse.json(
        { error: `This group booking is already ${groupBooking.status.toLowerCase()}` },
        { status: 400 }
      );
    }

    // Update member status
    if (response === 'ACCEPT') {
      groupBooking.members[memberIndex].status = 'CONFIRMED';
      groupBooking.members[memberIndex].respondedAt = new Date();
      groupBooking.confirmedCount += 1;

      // Check if we now have enough confirmations
      if (groupBooking.confirmedCount >= groupBooking.requiredMinimum) {
        groupBooking.status = 'CONFIRMED';

        // Update main booking to CONFIRMED
        const booking = await Booking.findById(groupBooking.bookingId);
        if (booking) {
          booking.status = 'CONFIRMED';
          await booking.save();
        }
      }

      await groupBooking.save();

      return NextResponse.json({
        message: 'Invitation accepted',
        groupBooking,
        isBookingConfirmed: groupBooking.status === 'CONFIRMED',
      });

    } else {
      // REJECT
      groupBooking.members[memberIndex].status = 'REJECTED';
      groupBooking.members[memberIndex].respondedAt = new Date();
      await groupBooking.save();

      // Check if we can still reach minimum with remaining pending members
      const pendingCount = groupBooking.members.filter(m => m.status === 'PENDING').length;
      const possibleTotal = groupBooking.confirmedCount + pendingCount;

      if (possibleTotal < groupBooking.requiredMinimum) {
        // Cancel the booking - can't reach minimum even with all pending accepting
        groupBooking.status = 'CANCELLED';
        await groupBooking.save();

        const booking = await Booking.findById(groupBooking.bookingId);
        if (booking) {
          booking.status = 'CANCELLED';
          await booking.save();
        }

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

  } catch (error: any) {
    console.error('Respond to invitation error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to respond to invitation' },
      { status: 500 }
    );
  }
}
