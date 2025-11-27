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

        // Try to insert lock (fails if already exists and not expired)
        try {
            await collection.insertOne({
                _id: lockId,
                lockedAt: now,
                lockedBy: instanceId
            });
            return true; // Lock acquired
        } catch (error: any) {
            // Lock exists, check if expired
            if (error.code === 11000) { // Duplicate key error
                const existingLock = await collection.findOne({ _id: lockId });

                if (existingLock) {
                    const lockAge = now.getTime() - new Date(existingLock.lockedAt).getTime();

                    // If lock is expired, force release and acquire
                    if (lockAge > LOCK_TIMEOUT_MS) {
                        await collection.deleteOne({ _id: lockId });
                        await collection.insertOne({
                            _id: lockId,
                            lockedAt: now,
                            lockedBy: instanceId
                        });
                        console.log('Acquired expired lock');
                        return true;
                    }
                }

                console.log('CRON already running, skipping');
                return false; // Lock held by another instance
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
