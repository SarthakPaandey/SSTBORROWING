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

        // Use UTC for database comparisons (DB stores UTC timestamps)
        const now = new Date();
        const results = {
            noShows: 0,
            expiredPending: 0,
            qrTokensDeleted: 0,
            libraryNoPickups: 0,
            overdueCompleted: 0,
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
            // No need to release qtyReserved as we no longer use it for blocking
            // (Time-based overlap checking is used instead)

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

        // 2. Handle Library Book Pickup Window
        // If a library booking isn't picked up within 24 hours, cancel it with penalty
        const pickupWindowMs = POLICIES.LIBRARY_BOOK_PICKUP_WINDOW_HOURS * 60 * 60 * 1000;
        const pickupCutoff = new Date(now.getTime() - pickupWindowMs);

        const libraryNoPickupBookings = await Booking.find({
            kind: 'LIBRARY',
            status: 'CONFIRMED',  // Was confirmed but never checked in
            checkedInAt: null,
            createdAt: { $lt: pickupCutoff }  // Created more than 24 hours ago
        });

        for (const booking of libraryNoPickupBookings) {
            // No need to release qtyReserved as we no longer use it for blocking
            // (Time-based overlap checking is used instead)

            booking.status = 'CANCELLED';
            await booking.save();

            // Apply smaller penalty for not picking up (0.5 points per policy)
            await Penalty.create({
                userId: booking.userId,
                bookingId: booking.id,
                points: POLICIES.PENALTY_BOOK_NO_PICKUP,
                reason: 'Library book not picked up within 24 hours',
            });

            const user = await User.findById(booking.userId);
            if (user) {
                user.penaltyPoints += POLICIES.PENALTY_BOOK_NO_PICKUP;
                if (user.penaltyPoints >= POLICIES.PENALTY_THRESHOLD_FOR_SUSPENSION) {
                    user.suspendedUntil = calculateSuspensionDate();
                }
                await user.save();
            }

            results.libraryNoPickups++;
        }

        // 3. Handle Overdue CHECKED_IN Bookings
        // Equipment/Library that was checked in but never returned should be flagged
        // Note: We don't auto-complete these because they need physical return
        // But we can mark them for admin attention and notify guards
        const overdueCheckedIn = await Booking.find({
            status: 'CHECKED_IN',
            kind: { $in: ['EQUIPMENT', 'LIBRARY'] },
            end: { $lt: now }  // Past their return time
        });

        // For now, just count them - penalties are applied when guard processes the return
        results.overdueCompleted = overdueCheckedIn.length;

        // 4. Handle Expired Pending Bookings
        // If a booking is pending approval for more than 7 days (or start time passed), cancel it
        const expiredPendingBookings = await Booking.find({
            status: 'PENDING',
            $or: [
                { start: { $lt: now } }, // Start time passed
                { createdAt: { $lt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) } } // Created > 7 days ago
            ]
        });

        for (const booking of expiredPendingBookings) {
            // No need to release qtyReserved as we no longer use it for blocking
            // (Time-based overlap checking is used instead)

            booking.status = 'CANCELLED';
            booking.approval = 'REJECTED';
            await booking.save();
            results.expiredPending++;
        }

        // 5. Cleanup Old QR Tokens
        // FIX EC-34: Delete QR tokens older than 1 day (they expire in 10 minutes anyway)
        // Previously was 7 days, causing massive buildup of expired tokens
        const oneDayAgo = getDaysAgo(1);
        const deleteResult = await QRToken.deleteMany({
            createdAt: { $lt: oneDayAgo }
        });
        results.qrTokensDeleted = deleteResult.deletedCount || 0;

        return NextResponse.json({ success: true, results });
    } catch (error) {
        console.error('Cron job error:', error);
        return handleApiError(error);
    }
}
