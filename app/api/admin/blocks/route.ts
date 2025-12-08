import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Block } from '@/models/Block';
import { Booking } from '@/models/Booking';
import { Resource } from '@/models/Resource';
import { requireAuth } from '@/lib/auth/guards';
import { handleApiError, ValidationError } from '@/lib/errors';
import { BlockQuery } from '@/types/api';
import { logAuditEvent, getActorFromSession } from '@/lib/audit';

export async function GET(req: NextRequest) {
  try {
    await requireAuth(['ADMIN']);
    await connectDB();

    const { searchParams } = new URL(req.url);
    const resourceId = searchParams.get('resourceId');

    const query: BlockQuery = {};
    if (resourceId) {
      query.resourceId = resourceId;
    }

    const blocks = await Block.find(query).sort({ start: 1 });

    return NextResponse.json({ blocks });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAuth(['ADMIN']);
    await connectDB();

    const body = await req.json();
    const { resourceId, start, end, reason, type } = body;

    if (!resourceId || !start || !end || !reason || !type) {
      throw new ValidationError('Missing required fields');
    }

    // Get resource name for audit log
    const resource = await Resource.findById(resourceId);

    const block = await Block.create({
      resourceId,
      start: new Date(start),
      end: new Date(end),
      reason,
      type,
      createdBy: admin.id,
    });

    // Cancel overlapping active bookings for the blocked resource
    const cancelResult = await Booking.updateMany(
      {
        resourceId,
        status: { $in: ['CONFIRMED', 'PENDING', 'CHECKED_IN'] }, // also cancel pickups already in progress
        start: { $lt: new Date(end) },
        end: { $gt: new Date(start) },
      },
      { $set: { status: 'CANCELLED' } }
    );

    // Log audit event
    await logAuditEvent({
      action: 'CREATE_BLOCK',
      actor: getActorFromSession(admin),
      target: {
        type: 'BLOCK',
        id: block._id.toString(),
        name: resource?.name || 'Unknown Resource',
      },
      details: {
        resourceId,
        reason,
        blockType: type,
        start: block.start,
        end: block.end,
        cancelledBookings: cancelResult.modifiedCount,
      },
    });

    return NextResponse.json({ block }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

