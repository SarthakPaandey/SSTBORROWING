import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Booking } from '@/models/Booking';
import { EquipmentItem } from '@/models/EquipmentItem';
import { requireAuth } from '@/lib/auth/guards';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth();
    await connectDB();

    const booking = await Booking.findById(params.id);

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    // Check ownership or admin
    if (booking.userId !== user.id && user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Check if can cancel
    if (!['PENDING', 'CONFIRMED'].includes(booking.status)) {
      return NextResponse.json(
        { error: 'Cannot cancel booking in current state' },
        { status: 400 }
      );
    }

    if (new Date() > booking.start) {
      return NextResponse.json(
        { error: 'Cannot cancel past bookings' },
        { status: 400 }
      );
    }

    // Note: We don't need to restore equipment inventory here because
    // we never actually reduced it. Equipment is only reduced when QR is scanned (check-in).
    // The booking just "reserves" the equipment by being counted in availability checks.

    booking.status = 'CANCELLED';
    await booking.save();

    return NextResponse.json({ booking });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to cancel booking' },
      { status: 500 }
    );
  }
}
