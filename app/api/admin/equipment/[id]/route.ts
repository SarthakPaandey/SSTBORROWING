import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { EquipmentItem } from '@/models/EquipmentItem';
import { requireAuth } from '@/lib/auth/guards';
import { handleApiError, NotFoundError, ConflictError, ValidationError } from '@/lib/errors';
import mongoose from 'mongoose';

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAuth(['ADMIN']);
    await connectDB();

    // FIX: Validate ObjectId to prevent MongoDB CastError
    if (!mongoose.Types.ObjectId.isValid(params.id)) {
      throw new ValidationError('Invalid equipment ID format');
    }

    const body = await req.json();

    // FIX: Prevent dangerous field updates that could corrupt inventory
    // Admin should not be able to directly set qtyReserved as it's managed by the system
    if ('qtyReserved' in body) {
      throw new ValidationError('Cannot directly modify reserved quantity. This is managed by the booking system.');
    }

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

    // FIX: Validate ObjectId to prevent MongoDB CastError
    if (!mongoose.Types.ObjectId.isValid(params.id)) {
      throw new ValidationError('Invalid equipment ID format');
    }

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
