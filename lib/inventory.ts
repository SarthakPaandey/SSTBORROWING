import { Booking } from '@/models/Booking';
import mongoose from 'mongoose';

/**
 * Calculate available quantity for an equipment item during a specific time window.
 * This checks for overlapping bookings and returns how many items are available.
 * 
 * @param itemId - The equipment item ID
 * @param start - Start time of the requested booking
 * @param end - End time of the requested booking
 * @param totalQuantity - Total quantity of the item (from qtyTotal)
 * @param excludeBookingId - Optional booking ID to exclude (for edit scenarios)
 * @param session - MongoDB session for transaction support (FIX EC-31)
 * @returns Number of items available during the time window
 */
export async function getAvailableQuantity(
    itemId: string,
    start: Date,
    end: Date,
    totalQuantity: number,
    excludeBookingId?: string,
    session?: mongoose.ClientSession
): Promise<number> {
    // Find all bookings that overlap with the requested time window
    // A booking overlaps if: booking.start < end AND booking.end > start
    const query: any = {
        items: {
            $elemMatch: { itemId }
        },
        status: { $in: ['PENDING', 'CONFIRMED', 'CHECKED_IN'] }, // Active bookings
        start: { $lt: end },
        end: { $gt: start }
    };

    // Exclude specific booking if provided (for edit scenarios)
    if (excludeBookingId) {
        query._id = { $ne: excludeBookingId };
    }

    // FIX EC-31: Add session support for transaction isolation
    const overlappingBookings = session
        ? await Booking.find(query).session(session)
        : await Booking.find(query);

    // Sum up the quantities reserved in overlapping bookings
    let reservedQuantity = 0;
    for (const booking of overlappingBookings) {
        const item = booking.items?.find((i: any) => i.itemId.toString() === itemId.toString());
        if (item) {
            reservedQuantity += item.qty;
        }
    }

    // Available = Total - Reserved in overlapping bookings
    return Math.max(0, totalQuantity - reservedQuantity);
}

/**
 * Check if a booking request can be fulfilled based on time-based availability.
 * 
 * @param items - Array of items with {itemId, qty, totalQty}
 * @param start - Start time of the booking
 * @param end - End time of the booking
 * @param excludeBookingId - Optional booking ID to exclude
 * @param session - MongoDB session for transaction support (FIX EC-31)
 * @returns Object with {success: boolean, message?: string, unavailableItems?: Array}
 */
export async function checkBookingAvailability(
    items: Array<{ itemId: string; qty: number; totalQty: number; name?: string }>,
    start: Date,
    end: Date,
    excludeBookingId?: string,
    session?: mongoose.ClientSession
): Promise<{
    success: boolean;
    message?: string;
    unavailableItems?: Array<{ itemId: string; name: string; requested: number; available: number }>;
}> {
    const unavailableItems: Array<{ itemId: string; name: string; requested: number; available: number }> = [];

    for (const item of items) {
        // FIX EC-31: Pass session to ensure transaction isolation
        const available = await getAvailableQuantity(
            item.itemId,
            start,
            end,
            item.totalQty,
            excludeBookingId,
            session
        );

        if (available < item.qty) {
            unavailableItems.push({
                itemId: item.itemId,
                name: item.name || 'Unknown Item',
                requested: item.qty,
                available
            });
        }
    }

    if (unavailableItems.length > 0) {
        const itemNames = unavailableItems.map(i =>
            `${i.name} (requested: ${i.requested}, available: ${i.available})`
        ).join(', ');

        return {
            success: false,
            message: `Not enough items available for the selected time slot: ${itemNames}`,
            unavailableItems
        };
    }

    return { success: true };
}
