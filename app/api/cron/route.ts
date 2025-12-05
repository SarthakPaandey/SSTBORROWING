import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Booking } from '@/models/Booking';
import { EquipmentItem } from '@/models/EquipmentItem';
import { Penalty } from '@/models/Penalty';
import { User } from '@/models/User';
import { QRToken } from '@/models/QRToken';
import { POLICIES, calculateSuspensionDate } from '@/lib/policies';
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
        const authHeader = req.headers.get('authorization');
        if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
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
        // FIX: Each booking update + penalty is now wrapped in a transaction for atomicity
        const gracePeriodMs = POLICIES.NO_SHOW_GRACE_MINUTES * 60 * 1000;
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

                // Update user points atomically
                const user = await User.findById(booking.userId).session(session);
                if (user) {
                    user.penaltyPoints += POLICIES.PENALTY_NO_SHOW;
                    if (user.penaltyPoints >= POLICIES.PENALTY_THRESHOLD_FOR_SUSPENSION) {
                        user.suspendedUntil = calculateSuspensionDate();
                    }
                    await user.save({ session });
                }

                await session.commitTransaction();
                results.noShows++;
            } catch (error) {
                await session.abortTransaction();
                console.error(`Failed to process no-show for booking ${booking.id}:`, error);
                // Continue processing other bookings
            } finally {
                session.endSession();
            }
        }

        // 1.5 Auto-Complete Rooms and Facilities
        await Booking.updateMany(
            {
                status: 'CONFIRMED',
                kind: { $in: ['ROOM', 'FACILITY'] },
                end: { $lt: now }
            },
            {
                $set: { status: 'COMPLETED' }
            }
        );

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

                const user = await User.findById(booking.userId).session(session);
                if (user) {
                    user.penaltyPoints += POLICIES.PENALTY_BOOK_NO_PICKUP;
                    if (user.penaltyPoints >= POLICIES.PENALTY_THRESHOLD_FOR_SUSPENSION) {
                        user.suspendedUntil = calculateSuspensionDate();
                    }
                    await user.save({ session });
                }

                await session.commitTransaction();
                results.libraryNoPickups++;
            } catch (error) {
                await session.abortTransaction();
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
        const expiredPendingResult = await Booking.updateMany(
            {
                status: 'PENDING',
                $or: [
                    { start: { $lt: now } },
                    { createdAt: { $lt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) } }
                ]
            },
            {
                $set: { status: 'CANCELLED', approval: 'REJECTED' }
            }
        );
        results.expiredPending = expiredPendingResult.modifiedCount || 0;

        // 5. Cleanup Old QR Tokens
        const oneDayAgo = getDaysAgo(1);
        const deleteResult = await QRToken.deleteMany({
            createdAt: { $lt: oneDayAgo }
        });
        results.qrTokensDeleted = deleteResult.deletedCount || 0;

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

