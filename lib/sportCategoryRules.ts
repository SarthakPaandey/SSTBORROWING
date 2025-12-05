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
    VOLLEYBALL: 'VOLLEYBALL',
    TENNIS: 'TENNIS',
    GENERAL: 'GENERAL',
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
 * - Users can only borrow from ONE sport category at a time (for OVERLAPPING time periods)
 * - GENERAL category items can be borrowed with any sport
 * - Multiple items from the SAME sport are allowed
 * - Different sports at DIFFERENT times are allowed (no overlap)
 */
export async function canBorrowSportCategory(options: {
    userId: string;
    requestedItemIds: string[];
    start: Date;  // Start time of the new booking
    end: Date;    // End time of the new booking
    session?: mongoose.ClientSession;
}): Promise<{
    allowed: boolean;
    reason?: string;
    conflictingSport?: string;
    activeBookingIds?: string[];
}> {
    const { userId, requestedItemIds, start, end, session } = options;

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

    // Find OVERLAPPING equipment bookings for this user
    // A booking overlaps if: existingStart < newEnd AND existingEnd > newStart
    const query = {
        userId,
        kind: 'EQUIPMENT',
        status: { $in: ['CONFIRMED', 'CHECKED_IN', 'PENDING'] as IBooking['status'][] },
        // Time overlap check
        start: { $lt: end },
        end: { $gt: start },
    };

    const overlappingBookings = session
        ? await Booking.find(query).session(session)
        : await Booking.find(query);

    // Check each overlapping booking for conflicting sport categories
    for (const booking of overlappingBookings) {
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
                    reason: `You have an overlapping ${bookingSport} equipment booking during this time. You can only borrow from one sport at a time. Please choose a different time or cancel the existing booking.`,
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
        VOLLEYBALL: 'Volleyball',
        TENNIS: 'Tennis',
        GENERAL: 'General',
    };

    return displayNames[category] || category;
}
