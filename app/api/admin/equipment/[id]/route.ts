import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { EquipmentItem } from '@/models/EquipmentItem';
import { requireAuth } from '@/lib/auth/guards';
import { handleApiError, NotFoundError, ConflictError } from '@/lib/errors';

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAuth(['ADMIN']);
    await connectDB();

    const body = await req.json();
    const item = await EquipmentItem.findByIdAndUpdate(
      params.id,
      body,
      { new: true, runValidators: true }
    );

    if (!item) {
      throw new NotFoundError('Equipment item');
    }

    return NextResponse.json({ item });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAuth(['ADMIN']);
    await connectDB();

    // FIX: Prevent equipment deletion if active bookings exist
    // This prevents app crashes when users try to view bookings with deleted equipment
    const { Booking } = await import('@/models/Booking');
    const activeBooking = await Booking.findOne({
      'items.itemId': params.id,
      status: { $in: ['PENDING', 'CONFIRMED', 'CHECKED_IN'] }
    });

    if (activeBooking) {
      throw new ConflictError('Cannot delete equipment with active bookings. Please wait for all bookings to complete or cancel them first.');
    }

    const item = await EquipmentItem.findByIdAndDelete(params.id);

    if (!item) {
      throw new NotFoundError('Equipment item');
    }

    return NextResponse.json({ success: true, message: 'Equipment item deleted' });
  } catch (error) {
    return handleApiError(error);
  }
}
