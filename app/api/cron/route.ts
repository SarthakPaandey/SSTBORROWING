import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Booking } from '@/models/Booking';
import { Penalty } from '@/models/Penalty';
import { User } from '@/models/User';
import { QRToken } from '@/models/QRToken';
import { POLICIES, loadDynamicPolicies } from '@/lib/policies';
import { recalculatePenaltyPoints, expireGroupBookings } from '@/lib/groupBookingPenalties';
import { handleApiError, AuthorizationError } from '@/lib/errors';
import { getDaysAgo } from '@/lib/timezone';
import { acquireCronLock, releaseCronLock } from '@/lib/cron-lock';
import mongoose from 'mongoose';

// Dynamic node runtime: reads request headers and performs DB writes
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
    let lockAcquired = false;

    try {
        // Verify cron secret to prevent unauthorized access
        // FIX: Fail-closed if CRON_SECRET is missing to prevent undefined bypass
        const cronSecret = process.env.CRON_SECRET;
        if (!cronSecret) {
            throw new AuthorizationError('CRON_SECRET environment variable not configured');
        }

        const authHeader = req.headers.get('authorization');
        if (authHeader !== `Bearer ${cronSecret}`) {
            throw new AuthorizationError('Invalid cron secret');
        }

        const conn = await connectDB();

        // FIX EC-72: Acquire mutex lock to prevent concurrent execution
        lockAcquired = await acquireCronLock();
        if (!lockAcquired) {
            return NextResponse.json({
                message: 'CRON job already running, skipping this execution'
            }, { status: 200 });
        }

        // Load dynamic policies from admin settings
        const dynamicPolicies = await loadDynamicPolicies([
            'NO_SHOW_GRACE_MINUTES',
            'PENALTY_THRESHOLD_LEVEL_0',
            'SUSPENSION_DURATION_LEVEL_0',
        ]);

        // Use UTC for database comparisons (DB stores UTC timestamps)
        const now = new Date();
        const results = {
            noShows: 0,
            expiredPending: 0,
            qrTokensDeleted: 0,
            libraryNoPickups: 0,
            overdueCompleted: 0,
            expiredGroupBookings: 0,
        };

        // 1. Handle No-Shows (EQUIPMENT and LIBRARY only)
        // FIX: Each booking update + penalty is now wrapped in a transaction for atomicity
        const gracePeriodMs = dynamicPolicies.NO_SHOW_GRACE_MINUTES * 60 * 1000;
        const noShowCutoff = new Date(now.getTime() - gracePeriodMs);

        const noShowBookings = await Booking.find({
            status: 'CONFIRMED',
            kind: { $in: ['EQUIPMENT', 'LIBRARY'] },
            $or: [
                { start: { $lt: noShowCutoff } },
                { end: { $lt: now } }
            ],
            checkedInAt: null,
        });

        for (const booking of noShowBookings) {
            const session = await mongoose.startSession();
            try {
                await session.startTransaction();

                // Mark as NO_SHOW
                booking.status = 'NO_SHOW';
                await booking.save({ session });

                // Apply penalty
                await Penalty.create([{
                    userId: booking.userId,
                    bookingId: booking.id,
                    points: POLICIES.PENALTY_NO_SHOW,
                    reason: 'No-show for booking',
                }], { session });

                // Recalculate within the transaction for atomic penalty+escalation
                await recalculatePenaltyPoints(booking.userId, session);
                await session.commitTransaction();

                results.noShows++;
            } catch (error) {
                if (session.inTransaction()) {
                    await session.abortTransaction();
                }
                console.error(`Failed to process no-show for booking ${booking.id}:`, error);
                // Continue processing other bookings
            } finally {
                session.endSession();
            }
        }

        // 1.5 Auto-Complete Rooms and Facilities
        // FIX: Also update associated GroupBooking records to COMPLETED
        // This prevents users from being "stuck" in old group bookings
        const completableBookings = await Booking.find({
            status: 'CONFIRMED',
            kind: { $in: ['ROOM', 'FACILITY'] },
            end: { $lt: now }
        }).select('_id groupBookingId isGroupBooking');

        // Collect group booking IDs that need to be completed
        const groupIdsToComplete = completableBookings
            .filter(b => b.isGroupBooking && b.groupBookingId)
            .map(b => b.groupBookingId);

        // Update all matching bookings to COMPLETED
        if (completableBookings.length > 0) {
            await Booking.updateMany(
                {
                    _id: { $in: completableBookings.map(b => b._id) }
                },
                {
                    $set: { status: 'COMPLETED' }
                }
            );
        }

        // Update associated GroupBooking records
        if (groupIdsToComplete.length > 0) {
            const { GroupBooking } = await import('@/models/GroupBooking');
            await GroupBooking.updateMany(
                {
                    _id: { $in: groupIdsToComplete },
                    status: 'CONFIRMED'  // Only update confirmed ones
                },
                { $set: { status: 'COMPLETED' } }
            );
        }

        // 2. Handle Library Book Pickup Window (with transactions)
        const pickupWindowMs = POLICIES.LIBRARY_BOOK_PICKUP_WINDOW_HOURS * 60 * 60 * 1000;
        const pickupCutoff = new Date(now.getTime() - pickupWindowMs);

        const libraryNoPickupBookings = await Booking.find({
            kind: 'LIBRARY',
            status: 'CONFIRMED',
            checkedInAt: null,
            createdAt: { $lt: pickupCutoff }
        });

        for (const booking of libraryNoPickupBookings) {
            const session = await mongoose.startSession();
            try {
                await session.startTransaction();

                booking.status = 'CANCELLED';
                await booking.save({ session });

                await Penalty.create([{
                    userId: booking.userId,
                    bookingId: booking.id,
                    points: POLICIES.PENALTY_BOOK_NO_PICKUP,
                    reason: 'Library book not picked up within 24 hours',
                }], { session });

                // Recalculate within the transaction for atomic penalty+escalation
                await recalculatePenaltyPoints(booking.userId, session);
                await session.commitTransaction();

                results.libraryNoPickups++;
            } catch (error) {
                if (session.inTransaction()) {
                    await session.abortTransaction();
                }
                console.error(`Failed to process library no-pickup for booking ${booking.id}:`, error);
            } finally {
                session.endSession();
            }
        }

        // 3. Handle Overdue CHECKED_IN Bookings (just count, penalties on return)
        const overdueCheckedIn = await Booking.countDocuments({
            status: 'CHECKED_IN',
            kind: { $in: ['EQUIPMENT', 'LIBRARY'] },
            end: { $lt: now }
        });
        results.overdueCompleted = overdueCheckedIn;

        // 4. Handle Expired Pending Bookings (no penalties, just cancel)
        // FIX: Also update associated GroupBooking records for expired pending bookings
        const expiredPendingBookings = await Booking.find({
            status: 'PENDING',
            $or: [
                { start: { $lt: now } },
                { createdAt: { $lt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) } }
            ]
        });

        for (const booking of expiredPendingBookings) {
            const session = await mongoose.startSession();
            try {
                await session.startTransaction();

                booking.status = 'CANCELLED';
                booking.approval = 'REJECTED';
                await booking.save({ session });

                if (booking.isGroupBooking && booking.groupBookingId) {
                    const { GroupBooking } = await import('@/models/GroupBooking');
                    await GroupBooking.findByIdAndUpdate(
                        booking.groupBookingId,
                        { $set: { status: 'CANCELLED' } },
                        { session }
                    );
                }

                await session.commitTransaction();
                results.expiredPending++;
            } catch (error) {
                if (session.inTransaction()) {
                    await session.abortTransaction();
                }
                console.error(`Failed to expire pending booking ${booking.id}:`, error);
            } finally {
                session.endSession();
            }
        }

        // 5. Cleanup Old QR Tokens
        const oneDayAgo = getDaysAgo(1);
        const deleteResult = await QRToken.deleteMany({
            createdAt: { $lt: oneDayAgo }
        });
        results.qrTokensDeleted = deleteResult.deletedCount || 0;

        // 6. Expire stale group bookings
        // FIX: This was imported but never called - now properly integrated
        results.expiredGroupBookings = await expireGroupBookings();

        // 7. Cancel orphaned group bookings where organizer is blocked
        // This prevents users from being stuck in groups led by blocked organizers
        const blockedOrganizers = await User.find({ blocked: true }).select('_id');
        if (blockedOrganizers.length > 0) {
            const { GroupBooking } = await import('@/models/GroupBooking');
            const orphanedResult = await GroupBooking.updateMany(
                {
                    organizerId: { $in: blockedOrganizers.map(u => u._id.toString()) },
                    status: 'PENDING_CONFIRMATIONS'
                },
                { $set: { status: 'CANCELLED' } }
            );
            if (orphanedResult.modifiedCount > 0) {
                console.log(`[Cron] Cancelled ${orphanedResult.modifiedCount} orphaned group bookings`);
            }
        }

        return NextResponse.json({ success: true, results });
    } catch (error) {
        console.error('Cron job error:', error);
        return handleApiError(error);
    } finally {
        // FIX: Always release lock in finally block - guaranteed to run
        if (lockAcquired) {
            try {
                await releaseCronLock();
            } catch (releaseError) {
                console.error('Failed to release cron lock:', releaseError);
            }
        }
    }
}

