import { connectDB } from './db';
import mongoose from 'mongoose';

/**
 * Simple distributed mutex using MongoDB
 * FIX EC-72: Prevents CRON job from running concurrently
 */

interface CronLock {
    _id: string;
    lockedAt: Date;
    lockedBy: string;
}

const LOCK_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Acquire a lock for the CRON job
 * @returns true if lock acquired, false if already locked
 */
export async function acquireCronLock(): Promise<boolean> {
    try {
        await connectDB();

        const db = mongoose.connection.db;
        if (!db) return false;

        const collection = db.collection<CronLock>('cron_locks');
        const lockId = 'cron_job';
        const now = new Date();
        const instanceId = `${process.pid}-${Date.now()}`;

        // FIX: Use atomic findOneAndUpdate with upsert and expiration check
        // This is a robust way to handle distributed locking in MongoDB
        const result = await collection.findOneAndUpdate(
            {
                _id: lockId,
                $or: [
                    { lockedAt: { $lt: new Date(now.getTime() - LOCK_TIMEOUT_MS) } }, // Expired
                    { lockedBy: instanceId } // Already held by us (re-entrant)
                ]
            },
            {
                $set: {
                    lockedAt: now,
                    lockedBy: instanceId
                }
            },
            {
                upsert: false, // Don't upsert here, handle initial creation separately
                returnDocument: 'after'
            }
        );

        // MongoDB driver 5+ returns the document directly, not { value: doc }
        if (result) {
            return true;
        }

        // If no document was updated, try to insert for the first time
        try {
            await collection.insertOne({
                _id: lockId,
                lockedAt: now,
                lockedBy: instanceId
            });
            return true;
        } catch (error: any) {
            if (error.code === 11000) {
                // Someone else created it between our findOneAndUpdate and insertOne
                console.log('CRON already running, skipping');
                return false;
            }
            throw error;
        }
    } catch (error) {
        console.error('Error acquiring CRON lock:', error);
        return false;
    }
}

/**
 * Release the CRON job lock
 */
export async function releaseCronLock(): Promise<void> {
    try {
        const db = mongoose.connection.db;
        if (!db) return;

        const collection = db.collection('cron_locks');
        await collection.deleteOne({ _id: 'cron_job' } as any);
    } catch (error) {
        console.error('Error releasing CRON lock:', error);
    }
}
