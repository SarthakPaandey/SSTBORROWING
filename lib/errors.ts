import { NextResponse } from 'next/server';

/**
 * Base error class for all application errors
 * Extends Error to include HTTP status code and operational flag
 */
export class AppError extends Error {
    public readonly statusCode: number;
    public readonly isOperational: boolean;

    constructor(message: string, statusCode: number = 500, isOperational: boolean = true) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = isOperational;

        // Maintains proper stack trace for where our error was thrown
        Error.captureStackTrace(this, this.constructor);

        // Set the prototype explicitly to maintain instanceof checks
        Object.setPrototypeOf(this, AppError.prototype);
    }
}

/**
 * 400 Bad Request - Invalid input or validation errors
 */
export class ValidationError extends AppError {
    constructor(message: string = 'Validation failed') {
        super(message, 400);
        Object.setPrototypeOf(this, ValidationError.prototype);
    }
}

/**
 * 401 Unauthorized - Authentication required
 */
export class AuthenticationError extends AppError {
    constructor(message: string = 'Authentication required') {
        super(message, 401);
        Object.setPrototypeOf(this, AuthenticationError.prototype);
    }
}

/**
 * 403 Forbidden - User doesn't have permission
 */
export class AuthorizationError extends AppError {
    constructor(message: string = 'Insufficient permissions') {
        super(message, 403);
        Object.setPrototypeOf(this, AuthorizationError.prototype);
    }
}

/**
 * 404 Not Found - Resource doesn't exist
 */
export class NotFoundError extends AppError {
    constructor(resource: string = 'Resource') {
        super(`${resource} not found`, 404);
        Object.setPrototypeOf(this, NotFoundError.prototype);
    }
}

/**
 * 409 Conflict - Business logic conflict (e.g., time slot already booked)
 */
export class ConflictError extends AppError {
    constructor(message: string = 'Resource conflict') {
        super(message, 409);
        Object.setPrototypeOf(this, ConflictError.prototype);
    }
}

/**
 * 500 Internal Server Error - Database or unexpected errors
 * These are non-operational errors that should be logged
 */
export class DatabaseError extends AppError {
    constructor(message: string = 'Database operation failed', originalError?: unknown) {
        super(message, 500, false);

        // Log the original error for debugging
        if (originalError) {
            console.error('Database Error Details:', originalError);
        }

        Object.setPrototypeOf(this, DatabaseError.prototype);
    }
}

/**
 * 502 Bad Gateway - External service errors (e.g., email service)
 */
export class ExternalServiceError extends AppError {
    constructor(service: string, originalError?: unknown) {
        super(`External service error: ${service}`, 502, false);

        if (originalError) {
            console.error(`${service} Error Details:`, originalError);
        }

        Object.setPrototypeOf(this, ExternalServiceError.prototype);
    }
}

/**
 * 409 Conflict - Transaction write conflict (concurrent booking attempts)
 * Used when MongoDB detects overlapping transactions trying to modify the same data
 */
export class TransactionConflictError extends AppError {
    constructor(message: string = 'This resource was just booked by someone else. Please try again.') {
        super(message, 409);
        Object.setPrototypeOf(this, TransactionConflictError.prototype);
    }
}

/**
 * Type guard to check if an error is an operational error
 */
export function isOperationalError(error: unknown): boolean {
    if (error instanceof AppError) {
        return error.isOperational;
    }
    return false;
}

/**
 * Converts any error into a proper NextResponse with appropriate status code
 * This is the main error handler for API routes
 */
export function handleApiError(error: unknown): NextResponse {
    // Handle known AppError instances
    if (error instanceof AppError) {
        const response = {
            error: error.message,
            statusCode: error.statusCode,
        };

        // Log non-operational errors
        if (!error.isOperational) {
            console.error('Non-operational error occurred:', {
                message: error.message,
                stack: error.stack,
                statusCode: error.statusCode,
            });
        }

        return NextResponse.json(response, { status: error.statusCode });
    }

    // Handle Zod validation errors
    if (error && typeof error === 'object' && 'issues' in error) {
        return NextResponse.json(
            {
                error: 'Validation failed',
                details: error,
            },
            { status: 400 }
        );
    }

    // Handle Mongoose validation errors and MongoDB errors
    if (error && typeof error === 'object' && 'name' in error) {
        const err = error as { name: string; message: string; code?: number };

        if (err.name === 'ValidationError' || err.name === 'CastError') {
            return NextResponse.json(
                { error: err.message || 'Invalid data provided' },
                { status: 400 }
            );
        }

        if (err.name === 'MongoServerError') {
            // Handle duplicate key error (from unique index)
            if (err.code === 11000) {
                return NextResponse.json(
                    { error: 'Time slot already booked. Please choose another time.' },
                    { status: 409 }
                );
            }

            console.error('MongoDB Server Error:', err);
            return NextResponse.json(
                { error: 'Database operation failed' },
                { status: 500 }
            );
        }

        // Handle MongoDB transaction errors
        if (err.name === 'MongoError' && err.message?.includes('TransientTransactionError')) {
            return NextResponse.json(
                { error: 'This resource was just booked by someone else. Please try again.' },
                { status: 409 }
            );
        }
    }

    // Handle standard Error instances
    if (error instanceof Error) {
        console.error('Unexpected error:', {
            message: error.message,
            stack: error.stack,
        });

        return NextResponse.json(
            { error: error.message || 'An unexpected error occurred' },
            { status: 500 }
        );
    }

    // Handle unknown error types
    console.error('Unknown error type:', error);
    return NextResponse.json(
        { error: 'An unexpected error occurred' },
        { status: 500 }
    );
}

/**
 * Wraps async API handlers with automatic error handling
 * Usage: export const GET = withErrorHandler(async (req) => { ... });
 */
export function withErrorHandler<T extends unknown[]>(
    handler: (...args: T) => Promise<NextResponse>
) {
    return async (...args: T): Promise<NextResponse> => {
        try {
            return await handler(...args);
        } catch (error) {
            return handleApiError(error);
        }
    };
}
