import mongoose from 'mongoose';
import { Booking, IBooking } from '@/models/Booking';
import { EquipmentItem } from '@/models/EquipmentItem';
import { getNow } from './timezone';

export const SPORT_CATEGORIES = {
    BADMINTON: 'BADMINTON',
    BASKETBALL: 'BASKETBALL',
    CRICKET: 'CRICKET',
    FOOTBALL: 'FOOTBALL',
    TABLE_TENNIS: 'TABLE_TENNIS',
    GENERAL: 'GENERAL', // Can be borrowed with any sport
} as const;

export type SportCategory = typeof SPORT_CATEGORIES[keyof typeof SPORT_CATEGORIES];

/**
 * Get the sport categories for equipment items in a booking
 */
export async function getItemsSportCategories(
    itemIds: string[]
): Promise<Set<SportCategory>> {
    const items = await EquipmentItem.find({
        _id: { $in: itemIds },
    });

    const categories = new Set<SportCategory>();

    for (const item of items) {
        if (item.sportCategory) {
            categories.add(item.sportCategory as SportCategory);
        }
    }

    return categories;
}

/**
 * Check if user can borrow equipment from a new sport category
 * based on their active bookings.
 * 
 * Rules:
 * - Users can only borrow from ONE sport category at a time
 * - GENERAL category items can be borrowed with any sport
 * - Multiple items from the SAME sport are allowed
 */
export async function canBorrowSportCategory(options: {
    userId: string;
    requestedItemIds: string[];
    session?: mongoose.ClientSession;
}): Promise<{
    allowed: boolean;
    reason?: string;
    conflictingSport?: string;
    activeBookingIds?: string[];
}> {
    const { userId, requestedItemIds, session } = options;

    // Get sport categories for the requested items
    const requestedCategories = await getItemsSportCategories(requestedItemIds);

    // Remove GENERAL category as it doesn't conflict
    requestedCategories.delete(SPORT_CATEGORIES.GENERAL);

    // If no sport-specific categories, allow (all items are GENERAL or no sportCategory set)
    if (requestedCategories.size === 0) {
        return { allowed: true };
    }

    // Check if user is trying to borrow from multiple sports in one booking
    if (requestedCategories.size > 1) {
        const sports = Array.from(requestedCategories).join(', ');
        return {
            allowed: false,
            reason: `Cannot borrow equipment from multiple sports in one booking (${sports}). Please create separate bookings.`,
        };
    }

    // Get the single sport category being requested
    const [requestedSport] = Array.from(requestedCategories);

    // Find active equipment bookings for this user
    const query = {
        userId,
        kind: 'EQUIPMENT',
        status: { $in: ['CONFIRMED', 'CHECKED_IN', 'PENDING'] as IBooking['status'][] },
    };

    const activeBookings = session
        ? await Booking.find(query).session(session)
        : await Booking.find(query);

    // Check each active booking for conflicting sport categories
    for (const booking of activeBookings) {
        if (!booking.items || booking.items.length === 0) continue;

        // Extract item IDs from booking
        const bookingItemIds = booking.items.map((item: any) => item.itemId.toString());
        const bookingCategories = await getItemsSportCategories(bookingItemIds);

        // Remove GENERAL category
        bookingCategories.delete(SPORT_CATEGORIES.GENERAL);

        // Check for conflicts
        for (const bookingSport of bookingCategories) {
            if (bookingSport !== requestedSport) {
                // Found a conflict!
                return {
                    allowed: false,
                    reason: `You have an active ${bookingSport} equipment booking. Please return it or cancel the booking before borrowing ${requestedSport} equipment.`,
                    conflictingSport: bookingSport,
                    activeBookingIds: [(booking as any)._id.toString()],
                };
            }
        }
    }

    // No conflicts found
    return { allowed: true };
}

/**
 * Get a user-friendly display name for a sport category
 */
export function getSportCategoryDisplayName(category: SportCategory): string {
    const displayNames: Record<SportCategory, string> = {
        BADMINTON: 'Badminton',
        BASKETBALL: 'Basketball',
        CRICKET: 'Cricket',
        FOOTBALL: 'Football',
        TABLE_TENNIS: 'Table Tennis',
        GENERAL: 'General',
    };

    return displayNames[category] || category;
}
