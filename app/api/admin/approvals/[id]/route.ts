import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Booking } from '@/models/Booking';
import { requireAuth } from '@/lib/auth/guards';
import { handleApiError, ValidationError, NotFoundError } from '@/lib/errors';
import { getNow } from '@/lib/timezone';
import mongoose from 'mongoose';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const admin = await requireAuth(['ADMIN']);
    await connectDB();

    // FIX: Validate ObjectId to prevent MongoDB CastError
    if (!mongoose.Types.ObjectId.isValid(params.id)) {
      throw new ValidationError('Invalid booking ID format');
    }

    const { action } = await req.json(); // 'approve' or 'reject'

    if (!['approve', 'reject'].includes(action)) {
      throw new ValidationError('Invalid action');
    }

    const booking = await Booking.findById(params.id);
    if (!booking) {
      throw new NotFoundError('Booking');
    }

    if (booking.approval !== 'PENDING') {
      throw new ValidationError('Booking does not require approval');
    }

    if (action === 'approve') {
      booking.approval = 'APPROVED';
      booking.status = 'CONFIRMED';
      booking.approvedBy = admin.id;
      booking.approvedAt = getNow();
    }
    if (action === 'reject') {
      // No need to release qtyReserved as we no longer use it for blocking
      // (Time-based overlap checking is used instead)

      booking.approval = 'REJECTED';
      booking.status = 'CANCELLED';
    }

    await booking.save();

    return NextResponse.json({ booking });
  } catch (error) {
    return handleApiError(error);
  }
}
