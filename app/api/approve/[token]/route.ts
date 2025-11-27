import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Booking } from '@/models/Booking';
import { ApprovalToken } from '@/models/ApprovalToken';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import { handleApiError, NotFoundError, ValidationError } from '@/lib/errors';

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
      throw new NotFoundError('Invalid or expired token');
    }

    if (approvalToken.expiresAt < new Date()) {
      throw new ValidationError('Token expired');
    }

    // SECURITY FIX: Verify that the URL action matches the token's stored action
    // This prevents an approve token from being used to reject (and vice versa)
    if (action !== approvalToken.action) {
      throw new ValidationError(`Token action mismatch. This token is for ${approvalToken.action}, not ${action}`);
    }

    // Optional: Check if user is logged in and is admin (extra security layer)
    const session = await getServerSession(authOptions);
    const approvedBy = session?.user?.id;

    // Find booking
    const booking = await Booking.findById(approvalToken.bookingId);
    if (!booking) {
      throw new NotFoundError('Booking');
    }

    if (booking.approval !== 'PENDING') {
      throw new ValidationError(`Booking is already ${booking.approval.toLowerCase()}`);
    }

    // Perform action
    if (action === 'reject') {
      // No need to release qtyReserved as we no longer use it for blocking
      // (Time-based overlap checking is used instead)

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

  } catch (error) {
    return handleApiError(error);
  }
}
