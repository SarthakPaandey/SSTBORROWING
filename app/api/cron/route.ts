import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Booking } from '@/models/Booking';
import { EquipmentItem } from '@/models/EquipmentItem';
import { Penalty } from '@/models/Penalty';
import { User } from '@/models/User';
import { QRToken } from '@/models/QRToken';
import { POLICIES, calculateSuspensionDate } from '@/lib/policies';
import { handleApiError, AuthorizationError } from '@/lib/errors';
import { getNow, getDaysAgo } from '@/lib/timezone';

export async function GET(req: NextRequest) {
    try {
        // Verify cron secret to prevent unauthorized access
        const authHeader = req.headers.get('authorization');
        if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            throw new AuthorizationError('Invalid cron secret');
        }

        await connectDB();

        // Use IST timezone for accurate time-based checks
        const now = getNow();
        const results = {
            noShows: 0,
            expiredPending: 0,
            qrTokensDeleted: 0,
        };

        // 1. Handle No-Shows (EQUIPMENT and LIBRARY only)
        // FIX: Check if grace period has passed OR booking has ended
        // This ensures long bookings are marked no-show early (after 15 mins)
        // and short bookings are marked immediately after they end
        // FIX: Only apply to EQUIPMENT and LIBRARY which require physical check-in
        // Rooms and Facilities do not have a check-in mechanism, so they shouldn't be penalized
        const gracePeriodMs = POLICIES.NO_SHOW_GRACE_MINUTES * 60 * 1000;
        const noShowCutoff = new Date(now.getTime() - gracePeriodMs);

        const noShowBookings = await Booking.find({
            status: 'CONFIRMED',
            kind: { $in: ['EQUIPMENT', 'LIBRARY'] }, // Only these types require check-in
            $or: [
                { start: { $lt: noShowCutoff } }, // Grace period passed
                { end: { $lt: now } }             // Booking ended (for short bookings)
            ],
            checkedInAt: null,  // Never checked in
        });

        for (const booking of noShowBookings) {
            // Release equipment inventory reservation for no-shows
            if (booking.items) {
                for (const item of booking.items) {
                    await EquipmentItem.findByIdAndUpdate(
                        item.itemId,
                        { $inc: { qtyReserved: -item.qty } }
                    );
                }
            }

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

        // 1.5 Auto-Complete Rooms and Facilities
        // Since Rooms and Facilities don't have check-in, we auto-complete them when they end
        const completedBookings = await Booking.updateMany(
            {
                status: 'CONFIRMED',
                kind: { $in: ['ROOM', 'FACILITY'] },
                end: { $lt: now } // Booking has ended
            },
            {
                $set: { status: 'COMPLETED' }
            }
        );

        // We don't track the count of auto-completed bookings in the results object currently,
        // but we could add it if needed. For now, this is a silent cleanup.

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
            // FIX: Release equipment inventory reservation for expired pending bookings
            if (booking.items && (booking.kind === 'EQUIPMENT' || booking.kind === 'LIBRARY')) {
                for (const item of booking.items) {
                    await EquipmentItem.findByIdAndUpdate(
                        item.itemId,
                        { $inc: { qtyReserved: -item.qty } }
                    );
                }
            }

            booking.status = 'CANCELLED';
            booking.approval = 'REJECTED';
            await booking.save();
            results.expiredPending++;
        }

        // 3. Cleanup Old QR Tokens
        // FIX: Delete QR tokens older than 7 days to prevent database bloat
        // Similar to rate limiter cleanup, this prevents infinite growth of the QRToken collection
        const sevenDaysAgo = getDaysAgo(7);
        const deleteResult = await QRToken.deleteMany({
            createdAt: { $lt: sevenDaysAgo }
        });
        results.qrTokensDeleted = deleteResult.deletedCount || 0;

        return NextResponse.json({ success: true, results });
    } catch (error) {
        console.error('Cron job error:', error);
        return handleApiError(error);
    }
}
