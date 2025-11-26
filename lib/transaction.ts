import mongoose, { ClientSession } from 'mongoose';
import { TransactionConflictError } from './errors';

interface TransactionOptions {
    maxRetries?: number;
    retryDelayMs?: number;
}

/**
 * Executes a function within a MongoDB transaction with automatic retry logic
 * Handles TransientTransactionError by retrying up to maxRetries times
 * 
 * @param mongooseInstance - Mongoose instance (from connectDB())
 * @param operation - Async function to execute within transaction
 * @param options - Configuration for retries
 * @returns Result of the operation
 */
export async function withTransaction<T>(
    mongooseInstance: typeof mongoose,
    operation: (session: ClientSession) => Promise<T>,
    options: TransactionOptions = {}
): Promise<T> {
    const { maxRetries = 3, retryDelayMs = 100 } = options;
    let lastError: unknown;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        const session = await mongooseInstance.connection.startSession();
        let transactionStarted = false;

        try {
            session.startTransaction();
            transactionStarted = true;

            const result = await operation(session);

            await session.commitTransaction();
            return result;
        } catch (error: unknown) {
            // Only abort if transaction was actually started
            if (transactionStarted && session.inTransaction()) {
                await session.abortTransaction();
            }
            lastError = error;

            // Check if this is a transient transaction error that we can retry
            const isTransientError =
                error &&
                typeof error === 'object' &&
                'message' in error &&
                typeof error.message === 'string' &&
                (error.message.includes('TransientTransactionError') ||
                    error.message.includes('WriteConflict'));

            // Also check for MongoDB duplicate key error (code 11000)
            const isDuplicateKeyError =
                error &&
                typeof error === 'object' &&
                'code' in error &&
                error.code === 11000;

            if (!isTransientError && !isDuplicateKeyError) {
                // Not a retryable error, throw immediately
                throw error;
            }

            if (attempt === maxRetries) {
                // Max retries exceeded
                if (isDuplicateKeyError) {
                    throw new TransactionConflictError('Time slot already booked. Please choose another time.');
                }
                throw new TransactionConflictError('Unable to complete booking due to high demand. Please try again.');
            }

            // Wait before retrying (exponential backoff)
            const delay = retryDelayMs * Math.pow(2, attempt - 1);
            await new Promise(resolve => setTimeout(resolve, delay));
        } finally {
            await session.endSession();
        }
    }

    // This should never be reached, but TypeScript needs it
    throw lastError;
}

/**
 * Type for equipment reservation result
 */
export interface ReservationResult {
    success: boolean;
    item?: {
        id: string;
        name: string;
        availableQty: number;
    };
}
