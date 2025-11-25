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
    } else {
      // FIX EC-11: Release equipment inventory reservation when rejecting
      // The booking created a reservation via qtyReserved that must be released
      if (booking.items && (booking.kind === 'EQUIPMENT' || booking.kind === 'LIBRARY')) {
        const { EquipmentItem } = await import('@/models/EquipmentItem');
        for (const item of booking.items) {
          await EquipmentItem.findByIdAndUpdate(
            item.itemId,
            {
              $inc: { qtyReserved: -item.qty }
            }
          );
        }
      }

      booking.approval = 'REJECTED';
      booking.status = 'CANCELLED';
    }

    await booking.save();

    return NextResponse.json({ booking });
  } catch (error) {
    return handleApiError(error);
  }
}
