import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Booking } from '@/models/Booking';
import { Resource } from '@/models/Resource';
import { requireAuth } from '@/lib/auth/guards';
import { handleApiError, ValidationError, NotFoundError } from '@/lib/errors';
import { logAuditEvent, getActorFromSession } from '@/lib/audit';
import mongoose from 'mongoose';

// Dynamic route since we read auth via cookies/headers
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

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

    const { action, reason } = await req.json(); // 'approve' or 'reject', optional reason for rejection

    if (!['approve', 'reject'].includes(action)) {
      throw new ValidationError('Invalid action');
    }

    const booking = await Booking.findById(params.id);
    if (!booking) {
      throw new NotFoundError('Booking');
    }

    // Get resource for type check and audit log
    const resource = await Resource.findById(booking.resourceId);

    // Prevent approving bookings in the past (but allow rejecting to clean up)
    if (action === 'approve') {
      const now = new Date();
      const isEquipment = resource?.type === 'LAB_EQUIPMENT' || resource?.type === 'SPORTS_EQUIPMENT';
      
      if (isEquipment) {
        // For equipment: check END time only, since start is when borrow period begins
        // User picks up item when approved, not at scheduled start time
        if (new Date(booking.end) < now) {
          throw new ValidationError('Cannot approve bookings that have already ended');
        }
      } else {
        // For facilities/rooms: check START time since these are scheduled slots
        if (new Date(booking.start) < now) {
          throw new ValidationError('Cannot approve bookings that have already started or ended');
        }
      }
    }

    if (booking.approval !== 'PENDING') {
      throw new ValidationError('Booking does not require approval');
    }
    const previousStatus = booking.approval;

    if (action === 'approve') {
      booking.approval = 'APPROVED';
      booking.status = 'CONFIRMED';
      booking.approvedBy = admin.id;
      // Use UTC timestamp for DB consistency
      booking.approvedAt = new Date();
    }
    if (action === 'reject') {
      booking.approval = 'REJECTED';
      booking.status = 'CANCELLED';
      // Store optional rejection reason
      if (reason && reason.trim()) {
        booking.rejectionReason = reason.trim();
      }
    }

    await booking.save();

    // Log audit event
    await logAuditEvent({
      action: action === 'approve' ? 'APPROVE_BOOKING' : 'REJECT_BOOKING',
      actor: getActorFromSession(admin),
      target: {
        type: 'BOOKING',
        id: params.id,
        name: resource?.name || 'Unknown Resource',
      },
      details: {
        previousStatus,
        newStatus: booking.approval,
        bookingStart: booking.start,
        bookingEnd: booking.end,
        userId: booking.userId,
        ...(reason && { rejectionReason: reason }),
      },
    });

    return NextResponse.json({ booking });
  } catch (error) {
    return handleApiError(error);
  }
}


