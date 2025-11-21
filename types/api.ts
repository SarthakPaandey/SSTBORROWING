import { FilterQuery } from 'mongoose';
import { IBooking } from '@/models/Booking';
import { IResource } from '@/models/Resource';
import { IUser } from '@/models/User';
import { IBlock } from '@/models/Block';
import { IPenalty } from '@/models/Penalty';

/**
 * Generic API response wrapper
 */
export interface ApiResponse<T> {
    data?: T;
    error?: string;
    message?: string;
}

/**
 * Error response structure
 */
export interface ErrorResponse {
    error: string;
    statusCode?: number;
    details?: unknown;
}

/**
 * Typed MongoDB query helpers
 */
export type BookingQuery = FilterQuery<IBooking>;
export type ResourceQuery = FilterQuery<IResource>;
export type UserQuery = FilterQuery<IUser>;
export type BlockQuery = FilterQuery<IBlock>;
export type PenaltyQuery = FilterQuery<IPenalty>;

/**
 * Query parameters for booking list API
 */
export interface BookingQueryParams {
    me?: boolean;
    userId?: string;
    status?: string;
    from?: string;
    to?: string;
    resourceId?: string;
    kind?: string;
}

/**
 * Query parameters for resource list API
 */
export interface ResourceQueryParams {
    type?: string;
    status?: string;
}

/**
 * Query parameters for block list API
 */
export interface BlockQueryParams {
    resourceId?: string;
    from?: string;
    to?: string;
}

/**
 * Query parameters for penalty list API
 */
export interface PenaltyQueryParams {
    userId?: string;
    status?: string;
}
