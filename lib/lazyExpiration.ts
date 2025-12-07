/**
 * Lazy Expiration System
 * 
 * Triggers background cleanup tasks on-demand instead of relying on CRON jobs.
 * This is essential for Vercel Hobby plan which doesn't support CRON.
 * 
 * Tasks handled:
 * - Group booking expiration (confirm or cancel based on member count)
 * - Facility/Room auto-completion (mark as COMPLETED after end time)
 * 
 * Rate-limited to run at most once per minute to avoid performance impact.
 */

import { connectDB } from './db';
import { Booking } from '@/models/Booking';
// FIX: Import shared expireGroupBookings instead of duplicating logic
import { expireGroupBookings } from './groupBookingPenalties';

// Rate limiting: only run expiration tasks once per minute
let lastRunTimestamp = 0;
const MIN_INTERVAL_MS = 60 * 1000; // 1 minute
// Note: in serverless, this resets per instance, but still throttles bursts per worker

/**
 * Trigger lazy expiration tasks in the background.
 * This is non-blocking and fire-and-forget.
 * Call this from high-traffic API endpoints.
 */
export function triggerLazyExpiration(): void {
    const now = Date.now();

    // Skip if we ran recently
    if (now - lastRunTimestamp < MIN_INTERVAL_MS) {
        return;
    }

    lastRunTimestamp = now;

    // Run in background - don't await, don't block the request
    runExpirationTasks().catch((error) => {
        console.error('[LazyExpiration] Background task failed:', error);
    });
}

/**
 * Run all expiration tasks.
 * This is called in the background and should handle its own errors.
 */
async function runExpirationTasks(): Promise<void> {
    try {
        await connectDB();

        // Run tasks in parallel for efficiency
        await Promise.all([
            expireGroupBookings(),
            autoCompleteFacilitiesAndRooms(),
        ]);

    } catch (error) {
        console.error('[LazyExpiration] Error running tasks:', error);
        // Don't rethrow - this is background work
    }
}

// NOTE: expireGroupBookings is now imported from groupBookingPenalties.ts
// to avoid code duplication and ensure consistent behavior

/**
 * Auto-complete facility and room bookings that have ended.
 * These don't need check-in/check-out like equipment.
 */
async function autoCompleteFacilitiesAndRooms(): Promise<number> {
    const now = new Date();

    const result = await Booking.updateMany(
        {
            status: 'CONFIRMED',
            kind: { $in: ['ROOM', 'FACILITY'] },
            end: { $lt: now }
        },
        {
            $set: { status: 'COMPLETED' }
        }
    );

    const completedCount = result.modifiedCount || 0;

    if (completedCount > 0) {
        console.log(`[LazyExpiration] Auto-completed ${completedCount} facility/room bookings`);
    }

    return completedCount;
}
