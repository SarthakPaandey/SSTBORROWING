import { IBooking } from '@/models/Booking';

/**
 * Booking item for equipment and library bookings
 */
export interface BookingItem {
    itemId: string;
    name: string;
    qty: number;
    damaged?: boolean;
    damageNotes?: string;
}

/**
 * Booking enriched with resource and user information
 * Used in API responses and components
 */
export interface EnrichedBooking extends Omit<IBooking, 'items'> {
    resourceName: string;
    userEmail?: string | null;
    userName?: string | null;
    items?: BookingItem[];
}

/**
 * Booking with user details populated
 */
export interface BookingWithUser extends Omit<IBooking, 'items'> {
    userEmail: string;
    userName: string;
    userRole: string;
    items?: BookingItem[];
}

/**
 * Return modal state for guard pages
 */
export interface GroupInvitation {
    _id: string;
    resourceName: string;
    location: string;
    organizerEmail: string;
    start: string | Date;
    expiresAt: string | Date;
    confirmedCount: number;
    requiredMinimum: number;
    totalMembers: number;
    groupBookingId: string;
}

export interface ReturnModalState {
    open: boolean;
    booking?: EnrichedBooking;
}

/**
 * QR validation result
 */
export interface QRValidationResult {
    success: boolean;
    booking: EnrichedBooking;
    action: 'check-in' | 'check-out';
    message: string;
}
