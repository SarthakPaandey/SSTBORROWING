import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Booking } from '@/models/Booking';
import { requireAuth } from '@/lib/auth/guards';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const admin = await requireAuth(['ADMIN']);
    await connectDB();

    const { action } = await req.json(); // 'approve' or 'reject'

    if (!['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    const booking = await Booking.findById(params.id);
    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    if (booking.approval !== 'PENDING') {
      return NextResponse.json(
        { error: 'Booking does not require approval' },
        { status: 400 }
      );
    }

    if (action === 'approve') {
      booking.approval = 'APPROVED';
      booking.status = 'CONFIRMED';
      booking.approvedBy = admin.id;
      booking.approvedAt = new Date();
    } else {
      booking.approval = 'REJECTED';
      booking.status = 'CANCELLED';
    }

    await booking.save();

    return NextResponse.json({ booking });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to process approval' },
      { status: 500 }
    );
  }
}
