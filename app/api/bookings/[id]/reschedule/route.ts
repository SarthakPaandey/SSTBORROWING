import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Booking } from '@/models/Booking';
import { Resource } from '@/models/Resource';
import { User } from '@/models/User';
import { QRToken } from '@/models/QRToken';
import { ApprovalToken, generateApprovalToken } from '@/models/ApprovalToken';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import { rescheduleSchema } from '@/lib/validations';
import { validateReschedule } from '@/lib/reschedule';
import { handleApiError, ValidationError, AuthenticationError, NotFoundError } from '@/lib/errors';
import { withTransaction } from '@/lib/transaction';
import { sendEmail, generateApprovalEmailHTML } from '@/lib/email';
import { formatDateTime } from '@/lib/utils';
import mongoose from 'mongoose';

export async function PATCH(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    const conn = await connectDB();
    if (!conn) {
        return NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
    }

    try {
        const transactionResult = await withTransaction(conn, async (session) => {
            const authSession = await getServerSession(authOptions);
            if (!authSession?.user) {
                throw new AuthenticationError();
            }

            const body = await req.json();

            // Validate input using Zod
            const validationResult = rescheduleSchema.safeParse(body);
            if (!validationResult.success) {
                throw new ValidationError('Validation failed: ' + JSON.stringify(validationResult.error.flatten()));
            }

            const { start, end } = validationResult.data;
            const newStart = new Date(start);
            const newEnd = new Date(end);

            // Get booking
            const booking = await Booking.findById(params.id).session(session);
            if (!booking) {
                throw new NotFoundError('Booking');
            }

            // Authorization: User must own the booking or be an admin
            const isAdmin = authSession.user.role === 'ADMIN';
            const isOwner = booking.userId === authSession.user.id;

            if (!isAdmin && !isOwner) {
                throw new AuthenticationError('You do not have permission to reschedule this booking');
            }

            // Get user and resource
            const user = await User.findById(booking.userId).session(session);
            if (!user) {
                throw new NotFoundError('User');
            }

            const resource = await Resource.findById(booking.resourceId).session(session);
            if (!resource) {
                throw new NotFoundError('Resource');
            }

            // Validate the reschedule
            const validationResult2 = await validateReschedule({
                booking,
                user,
                resource,
                newStart,
                newEnd,
                session,
            });

            if (!validationResult2.allowed) {
                throw new ValidationError(validationResult2.reason || 'Reschedule not allowed');
            }

            // Store old time for history
            const oldStart = booking.start;
            const oldEnd = booking.end;

            // Update booking times
            booking.start = newStart;
            booking.end = newEnd;

            // NEW: Increment reschedule counter
            booking.rescheduleCount += 1;

            // NEW: Add to reschedule history
            if (!booking.rescheduleHistory) {
                booking.rescheduleHistory = [];
            }
            booking.rescheduleHistory.push({
                oldStart,
                oldEnd,
                newStart,
                newEnd,
                rescheduledAt: new Date(),
                rescheduledBy: authSession.user.id,
                reason: body.reason,
            });

            // NEW: Add penalty points (3 points per reschedule)
            // FIX: Only apply penalty when user reschedules their own booking
            // Admin-driven reschedules should not penalize the user
            if (!isAdmin) {
                const { Penalty } = await import('@/models/Penalty');
                const { POLICIES } = await import('@/lib/policies');
                const { recalculatePenaltyPoints } = await import('@/lib/groupBookingPenalties');

                // Create penalty record
                await Penalty.create([{
                    userId: booking.userId,
                    points: POLICIES.RESCHEDULE_PENALTY_POINTS,
                    reason: `Rescheduled booking for ${resource.name}`,
                    bookingId: booking.id,
                }], { session });

                // Recalculate penalties within the same transaction to respect three-strike system
                await recalculatePenaltyPoints(booking.userId, session);
            }

            // Handle approval revalidation if needed
            const wasApproved = booking.approval === 'APPROVED';
            const wasPendingApproval = booking.approval === 'PENDING';
            let needsApprovalEmail = false;
            if (validationResult2.requiresApproval) {
                // Reset to pending if it was confirmed but new time requires approval
                booking.status = 'PENDING';
                booking.approval = 'PENDING';
                booking.approvedBy = undefined;
                booking.approvedAt = undefined;
                booking.approvalEmailSent = false;
                booking.approvalEmailSentAt = undefined;
                booking.approvalEmailError = undefined;
                needsApprovalEmail = true;
            } else {
                // Clear stale approval state when approval is no longer required
                booking.approval = 'NOT_REQUIRED';
                booking.approvedBy = undefined;
                booking.approvedAt = undefined;
                booking.approvalEmailSent = false;
                booking.approvalEmailSentAt = undefined;
                booking.approvalEmailError = undefined;

                // If the booking was pending approval, restore it to confirmed since no approval is needed now
                if (wasPendingApproval) {
                    booking.status = 'CONFIRMED';
                }
            }

            // Invalidate any existing QR codes for this booking
            await QRToken.updateMany(
                { bookingId: booking.id, used: false },
                { used: true, usedAt: new Date() }
            ).session(session);

            // Reset QR issue flag
            booking.qrIssued = false;

            await booking.save({ session });

            return {
                booking,
                resource,
                user,
                needsApprovalEmail,
                newStart,
                newEnd,
            };
        });

        // Send approval email if needed (outside transaction)
        if (transactionResult.needsApprovalEmail) {
            const { booking, resource, user, newStart, newEnd } = transactionResult;

            try {
                // Get all admin users
                const admins = await User.find({ role: 'ADMIN' });
                const adminEmails = admins.map(admin => admin.email).filter(Boolean);

                if (adminEmails.length > 0) {
                    // Generate new approval and rejection tokens
                    const approveToken = generateApprovalToken();
                    const rejectToken = generateApprovalToken();

                    const sevenDaysFromNow = new Date();
                    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
                    const expiresAt = new Date(Math.min(sevenDaysFromNow.getTime(), newStart.getTime()));

                    // Create token documents
                    await ApprovalToken.create({
                        bookingId: booking.id,
                        token: approveToken,
                        action: 'approve',
                        expiresAt,
                    });

                    await ApprovalToken.create({
                        bookingId: booking.id,
                        token: rejectToken,
                        action: 'reject',
                        expiresAt,
                    });

                    // Send email to all admins
                    const emailHTML = generateApprovalEmailHTML(
                        booking.id,
                        resource.name,
                        user.name || user.email.split('@')[0],
                        user.email,
                        formatDateTime(newStart),
                        formatDateTime(newEnd),
                        approveToken,
                        rejectToken
                    );

                    await sendEmail({
                        to: adminEmails,
                        subject: `Rescheduled Booking - Approval Required: ${resource.name}`,
                        html: emailHTML,
                    });

                    // Track successful email delivery
                    booking.approvalEmailSent = true;
                    booking.approvalEmailSentAt = new Date();
                    await booking.save();
                }
            } catch (emailError) {
                // Track email failure
                console.error('Failed to send approval email:', emailError);
                const errorMessage = emailError instanceof Error ? emailError.message : String(emailError);
                transactionResult.booking.approvalEmailSent = false;
                transactionResult.booking.approvalEmailError = errorMessage;
                await transactionResult.booking.save();
            }
        }

        return NextResponse.json({
            message: 'Booking rescheduled successfully',
            booking: transactionResult.booking,
            requiresApproval: transactionResult.needsApprovalEmail,
        });
    } catch (error) {
        return handleApiError(error);
    }
}
