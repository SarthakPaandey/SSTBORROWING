import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Booking } from '@/models/Booking';
import { Penalty } from '@/models/Penalty';
import { User } from '@/models/User';
import { POLICIES, calculateSuspensionDate } from '@/lib/policies';
import { handleApiError, AuthorizationError } from '@/lib/errors';

export async function GET(req: NextRequest) {
    // Verify cron secret to prevent unauthorized access
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        throw new AuthorizationError();
    }

    try {
        await connectDB();

        const now = new Date();
        const results = {
            noShows: 0,
            expiredPending: 0,
        };

        // 1. Handle No-Shows
        // Find confirmed bookings that started more than GRACE_MINUTES ago and haven't checked in
        const gracePeriodAgo = new Date(now.getTime() - POLICIES.NO_SHOW_GRACE_MINUTES * 60000);

        const noShowBookings = await Booking.find({
            status: 'CONFIRMED',
            start: { $lt: gracePeriodAgo },
            checkedInAt: null,
            // Ensure we don't process already completed/cancelled ones (redundant with status check but safe)
        });

        for (const booking of noShowBookings) {
            // Mark as NO_SHOW
            booking.status = 'NO_SHOW';
            await booking.save();

            // Apply penalty
            await Penalty.create({
                userId: booking.userId,
                bookingId: booking.id,
                points: POLICIES.PENALTY_NO_SHOW,
                reason: 'No-show for booking',
            });

            // Update user points
            const user = await User.findById(booking.userId);
            if (user) {
                user.penaltyPoints += POLICIES.PENALTY_NO_SHOW;
                if (user.penaltyPoints >= POLICIES.PENALTY_THRESHOLD_FOR_SUSPENSION) {
                    user.suspendedUntil = calculateSuspensionDate();
                }
                await user.save();
            }

            results.noShows++;
        }

        // 2. Handle Expired Pending Bookings
        // If a booking is pending approval for more than 7 days (or start time passed), cancel it
        const expiredPendingBookings = await Booking.find({
            status: 'PENDING',
            $or: [
                { start: { $lt: now } }, // Start time passed
                { createdAt: { $lt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) } } // Created > 7 days ago
            ]
        });

        for (const booking of expiredPendingBookings) {
            booking.status = 'CANCELLED';
            booking.approval = 'REJECTED'; // Or just leave as PENDING? Better to reject.
            await booking.save();
            results.expiredPending++;
        }

        return NextResponse.json({ success: true, results });
    } catch (error) {
        console.error('Cron job error:', error);
        return handleApiError(error);
    }
}
