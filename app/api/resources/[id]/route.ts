import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Resource } from '@/models/Resource';
import { Booking } from '@/models/Booking';
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

    // FIX: Validate ObjectId to prevent MongoDB errors
    if (!mongoose.Types.ObjectId.isValid(params.id)) {
      throw new ValidationError('Invalid resource ID format');
    }

    const body = await req.json();
    const resource = await Resource.findByIdAndUpdate(
      params.id,
      body,
      { new: true, runValidators: true }
    );

    if (!resource) {
      throw new NotFoundError('Resource');
    }

    return NextResponse.json({ resource });
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

    // FIX: Validate ObjectId to prevent MongoDB errors
    if (!mongoose.Types.ObjectId.isValid(params.id)) {
      throw new ValidationError('Invalid resource ID format');
    }

    // FIX: Prevent resource deletion if active bookings exist
    // This prevents app crashes when users try to view bookings with deleted resources
    const activeBooking = await Booking.findOne({
      resourceId: params.id,
      status: { $in: ['PENDING', 'CONFIRMED', 'CHECKED_IN'] }
    });

    if (activeBooking) {
      throw new ConflictError('Cannot delete resource with active bookings. Please wait for all bookings to complete or cancel them first.');
    }

    const resource = await Resource.findByIdAndDelete(params.id);

    if (!resource) {
      throw new NotFoundError('Resource');
    }

    return NextResponse.json({ success: true, message: 'Resource deleted' });
  } catch (error) {
    return handleApiError(error);
  }
}
