import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Booking } from '@/models/Booking';
import { EquipmentItem } from '@/models/EquipmentItem';
import { Penalty } from '@/models/Penalty';
import { User } from '@/models/User';
import { POLICIES, calculateSuspensionDate } from '@/lib/policies';
import { handleApiError, AuthorizationError } from '@/lib/errors';
import { getNow } from '@/lib/timezone';

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
        };

        // 1. Handle No-Shows
        // FIX EC-4: Changed logic to use booking END time instead of START + grace
        // This catches short bookings that finish before the grace period would trigger
        // Original logic: start < (now - gracePeriod)
        // New logic: end < now AND status = CONFIRMED AND not checked in
        const noShowBookings = await Booking.find({
            status: 'CONFIRMED',
            end: { $lt: now },  // Booking has ended
            checkedInAt: null,  // Never checked in
        });

        for (const booking of noShowBookings) {
            // FIX EC-10: Release equipment inventory reservation for no-shows
            // These bookings reserved inventory that was never picked up
            if (booking.items && (booking.kind === 'EQUIPMENT' || booking.kind === 'LIBRARY')) {
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

        return NextResponse.json({ success: true, results });
    } catch (error) {
        console.error('Cron job error:', error);
        return handleApiError(error);
    }
}
