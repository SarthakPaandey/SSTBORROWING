import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Block } from '@/models/Block';
import { Booking } from '@/models/Booking';
import { requireAuth } from '@/lib/auth/guards';
import { handleApiError, ValidationError } from '@/lib/errors';
import { BlockQuery } from '@/types/api';

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

    const block = await Block.create({
      resourceId,
      start: new Date(start),
      end: new Date(end),
      reason,
      type,
      createdBy: admin.id,
    });

    // Cancel overlapping active bookings for the blocked resource
    await Booking.updateMany(
      {
        resourceId,
        status: { $in: ['CONFIRMED', 'PENDING'] },
        start: { $lt: new Date(end) },
        end: { $gt: new Date(start) },
      },
      { $set: { status: 'CANCELLED' } }
    );

    return NextResponse.json({ block }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
