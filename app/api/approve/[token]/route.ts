import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Booking } from '@/models/Booking';
import { ApprovalToken } from '@/models/ApprovalToken';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';

export async function GET(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    await connectDB();

    const { token } = params;
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action') || 'approve'; // Default to approve

    // Find token
    const approvalToken = await ApprovalToken.findOne({ token });

    if (!approvalToken) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 404 });
    }

    if (approvalToken.expiresAt < new Date()) {
      return NextResponse.json({ error: 'Token expired' }, { status: 400 });
    }

    // Optional: Check if user is logged in and is admin (extra security layer)
    const session = await getServerSession(authOptions);
    const approvedBy = session?.user?.id;

    // Find booking
    const booking = await Booking.findById(approvalToken.bookingId);
    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    if (booking.approval !== 'PENDING') {
      return NextResponse.json(
        { error: `Booking is already ${booking.approval.toLowerCase()}` },
        { status: 400 }
      );
    }

    // Perform action
    if (action === 'reject') {
      booking.approval = 'REJECTED';
      booking.status = 'CANCELLED';
    } else {
      booking.approval = 'APPROVED';
      booking.status = 'CONFIRMED';
      booking.approvedBy = approvedBy; // May be undefined if not logged in
      booking.approvedAt = new Date();
    }

    await booking.save();

    // Invalidate ALL tokens for this booking
    await ApprovalToken.deleteMany({ bookingId: booking._id });

    // Return HTML response
    return new NextResponse(`
      <html>
        <body style="font-family: sans-serif; text-align: center; padding: 50px;">
          <h1 style="color: ${action === 'reject' ? '#dc3545' : '#28a745'}">
            Booking ${action === 'reject' ? 'Rejected' : 'Approved'}
          </h1>
          <p>The booking has been successfully processed.</p>
          <script>setTimeout(() => window.close(), 3000);</script>
        </body>
      </html>
    `, {
      headers: { 'Content-Type': 'text/html' },
    });

  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to process request' },
      { status: 500 }
    );
  }
}
