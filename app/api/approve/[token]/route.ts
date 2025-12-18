import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Booking } from '@/models/Booking';
import { ApprovalToken } from '@/models/ApprovalToken';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import { handleApiError, NotFoundError, ValidationError } from '@/lib/errors';
import { withTransaction } from '@/lib/transaction';

export async function GET(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const conn = await connectDB();

    const { token } = params;
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action') || 'approve'; // Default to approve

    // Optional: Check if user is logged in and is admin (extra security layer)
    const authSession = await getServerSession(authOptions);
    const approvedBy = authSession?.user?.id;

    // FIX: Wrap all DB operations in transaction for atomicity
    // This prevents race conditions and ensures token deletion happens with booking update
    await withTransaction(conn, async (session) => {
      // Find token within transaction
      const approvalToken = await ApprovalToken.findOne({ token }).session(session);

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

      // Find booking within transaction
      const booking = await Booking.findById(approvalToken.bookingId).session(session);
      if (!booking) {
        throw new NotFoundError('Booking');
      }

      // Do not allow approval/rejection in the final minute before start
      const now = new Date();
      if (new Date(booking.start).getTime() - now.getTime() < 60_000) {
        throw new ValidationError('Token expired: booking is about to start. Please handle on-site.');
      }

      if (booking.approval !== 'PENDING') {
        throw new ValidationError(`Booking is already ${booking.approval.toLowerCase()}`);
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

      await booking.save({ session });

      // Invalidate ALL tokens for this booking (within same transaction)
      await ApprovalToken.deleteMany({ bookingId: booking._id }).session(session);
    });

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
    // Return HTML error page instead of JSON for better UX when users click email links
    const rawMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
    const isValidationError = error instanceof ValidationError || error instanceof NotFoundError;

    // SECURITY: Escape HTML to prevent XSS attacks from crafted error messages
    const escapeHtml = (str: string): string =>
      str.replace(/[&<>"']/g, (c) =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] || c)
      );
    const errorMessage = escapeHtml(rawMessage);

    return new NextResponse(`
      <html>
        <body style="font-family: sans-serif; text-align: center; padding: 50px;">
          <h1 style="color: #dc3545">
            ${isValidationError ? 'Request Failed' : 'Error'}
          </h1>
          <p>${errorMessage}</p>
          <p style="color: #666; font-size: 14px; margin-top: 20px;">
            If you believe this is a mistake, please contact the administrator.
          </p>
        </body>
      </html>
    `, {
      status: isValidationError ? 400 : 500,
      headers: { 'Content-Type': 'text/html' },
    });
  }
}
