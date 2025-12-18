import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { connectDB } from '@/lib/db';
import { Booking } from '@/models/Booking';
import { Resource } from '@/models/Resource';
import { requireAuth } from '@/lib/auth/guards';
import { POLICIES } from '@/lib/policies';
import { handleApiError, NotFoundError, AuthorizationError, ValidationError, ConflictError } from '@/lib/errors';
import { withTransaction } from '@/lib/transaction';
import { toIST } from '@/lib/timezone';
import { checkBookingAvailability } from '@/lib/inventory';

/**
 * POST /api/bookings/[id]/extend
 * Extend a checked-in equipment booking by a specified duration (max 60 mins)
 * 
 * Request body: { minutes: number }
 */
export async function POST(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    const conn = await connectDB();
    if (!conn) {
        return NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
    }

    try {
        const result = await withTransaction(conn, async (session) => {
            const user = await requireAuth();

            // Validate ObjectId
            if (!mongoose.Types.ObjectId.isValid(params.id)) {
                throw new ValidationError('Invalid booking ID format');
            }

            const body = await req.json();
            const { minutes } = body;

            // Validate extension duration
            if (!minutes || typeof minutes !== 'number' || minutes <= 0) {
                throw new ValidationError('Extension duration (minutes) is required and must be positive');
            }

            if (minutes > POLICIES.MAX_EQUIPMENT_EXTENSION_MINUTES) {
                throw new ValidationError(`Extension cannot exceed ${POLICIES.MAX_EQUIPMENT_EXTENSION_MINUTES} minutes`);
            }

            // FIX: Use atomic query with all conditions to prevent race conditions
            // First, find the booking to validate and get current state
            const booking = await Booking.findOne({
                _id: params.id,
                userId: user.id,  // Ownership check in query
                kind: 'EQUIPMENT',  // Type check in query
                status: 'CHECKED_IN',  // Status check in query
                $or: [
                    { extensionCount: { $exists: false } },
                    { extensionCount: { $lt: POLICIES.MAX_EXTENSIONS_PER_BOOKING } }
                ]
            }).session(session);

            if (!booking) {
                // Determine which condition failed for better error message
                const anyBooking = await Booking.findById(params.id).session(session);
                if (!anyBooking) {
                    throw new NotFoundError('Booking');
                }
                if (anyBooking.userId !== user.id) {
                    throw new AuthorizationError('You can only extend your own bookings');
                }
                if (anyBooking.kind !== 'EQUIPMENT') {
                    throw new ValidationError('Only equipment bookings can be extended');
                }
                if (anyBooking.status !== 'CHECKED_IN') {
                    throw new ValidationError('Only checked-in bookings can be extended. Please pick up the equipment first.');
                }
                // If we get here, it must be extension limit
                throw new ConflictError(`You can only extend a booking ${POLICIES.MAX_EXTENSIONS_PER_BOOKING} time(s). This booking has already been extended.`);
            }

            const currentExtensions = booking.extensionCount || 0;

            // Calculate new end time
            const currentEnd = new Date(booking.end);
            const newEnd = new Date(currentEnd.getTime() + minutes * 60 * 1000);

            // Check working hours (can't extend past 8 PM)
            const newEndIST = toIST(newEnd);
            const endHour = newEndIST.getHours();
            const endMinutes = newEndIST.getMinutes();

            if (endHour > POLICIES.WORKING_HOURS_END ||
                (endHour === POLICIES.WORKING_HOURS_END && endMinutes > 0)) {
                throw new ValidationError(
                    `Extension would exceed working hours. Bookings must end by ${POLICIES.WORKING_HOURS_END}:00 (8 PM). ` +
                    `Current end: ${currentEnd.toLocaleTimeString()}, Requested new end: ${newEnd.toLocaleTimeString()}`
                );
            }

            // Get resource to check type
            const resource = await Resource.findById(booking.resourceId).session(session);
            if (!resource) {
                throw new NotFoundError('Resource');
            }

            // Check max total duration (original borrow time + extension)
            const originalStart = new Date(booking.start);
            const totalDurationMinutes = (newEnd.getTime() - originalStart.getTime()) / (1000 * 60);

            if (resource.type === 'SPORTS_EQUIPMENT') {
                // Sports equipment: original max is 75 mins, with 60 min extension = 135 mins max
                const maxTotalDuration = POLICIES.SPORTS_EQUIPMENT_BORROW_MINUTES + POLICIES.MAX_EQUIPMENT_EXTENSION_MINUTES;
                if (totalDurationMinutes > maxTotalDuration) {
                    throw new ValidationError(
                        `Total borrow duration cannot exceed ${maxTotalDuration} minutes. ` +
                        `Current total would be ${Math.round(totalDurationMinutes)} minutes.`
                    );
                }
            }
            // Lab equipment is 24 hours, extension doesn't really make sense there but we allow it just in case

            // Check inventory availability for extended time
            if (booking.items && booking.items.length > 0) {
                // FIX: Fetch actual qtyTotal from EquipmentItem, not the borrowed qty
                const { EquipmentItem } = await import('@/models/EquipmentItem');
                const itemsToCheck = await Promise.all(
                    booking.items.map(async (item) => {
                        const equipmentItem = await EquipmentItem.findById(item.itemId).session(session);
                        return {
                            itemId: item.itemId,
                            qty: item.qty,
                            totalQty: equipmentItem?.qtyTotal || item.qty,
                            name: item.name
                        };
                    })
                );

                const availabilityCheck = await checkBookingAvailability(
                    itemsToCheck,
                    currentEnd, // Check from current end to new end
                    newEnd,
                    booking.id, // Exclude this booking from conflict check
                    session
                );

                if (!availabilityCheck.success) {
                    throw new ConflictError(
                        `Cannot extend: ${availabilityCheck.message || 'Equipment is reserved by another booking during the extension period.'}`
                    );
                }
            }

            // FIX: Apply extension atomically with $inc to prevent race conditions
            // Double-click will fail: first request increments, second sees extensionCount >= limit
            const updatedBooking = await Booking.findOneAndUpdate(
                {
                    _id: params.id,
                    userId: user.id,
                    status: 'CHECKED_IN',
                    kind: 'EQUIPMENT',
                    // Re-check extension limit atomically - prevents race condition
                    $or: [
                        { extensionCount: { $exists: false } },
                        { extensionCount: { $lt: POLICIES.MAX_EXTENSIONS_PER_BOOKING } }
                    ]
                },
                {
                    $set: { end: newEnd },
                    $inc: { extensionCount: 1 }
                },
                { new: true, session }
            );

            if (!updatedBooking) {
                // Race condition occurred - another request already extended
                throw new ConflictError('Extension limit reached. If you clicked multiple times, only one extension was applied.');
            }

            return {
                booking: updatedBooking,
                extendedBy: minutes,
                newEnd,
                extensionsRemaining: POLICIES.MAX_EXTENSIONS_PER_BOOKING - (updatedBooking.extensionCount || 1),
            };
        });

        return NextResponse.json({
            message: `Booking extended by ${result.extendedBy} minutes`,
            booking: result.booking,
            newEnd: result.newEnd,
            extensionsRemaining: result.extensionsRemaining,
        });
    } catch (error) {
        return handleApiError(error);
    }
}
