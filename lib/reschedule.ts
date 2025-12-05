import { IBooking } from '@/models/Booking';
import { IUser } from '@/models/User';
import { IResource } from '@/models/Resource';
import { Booking } from '@/models/Booking';
import { Block } from '@/models/Block';
import { POLICIES, isWithinAdvanceWindow, hasMinimumGap, hasConsecutiveBookings, calculateTotalHours } from './policies';
import { checkBookingAvailability } from './inventory';
import { ValidationError, ConflictError } from './errors';
import { getNow, getStartOfDay, getTodayStart } from './timezone';
import mongoose from 'mongoose';

export interface RescheduleParams {
    booking: IBooking;
    user: IUser;
    resource: IResource;
    newStart: Date;
    newEnd: Date;
    session: mongoose.ClientSession;
}

export interface RescheduleValidationResult {
    allowed: boolean;
    reason?: string;
    requiresApproval?: boolean;
}

/**
 * Validate if a booking can be rescheduled to a new time slot.
 * This function performs all necessary checks including:
 * - Status verification
 * - Time validations
 * - Policy enforcement
 * - Conflict detection
 * - Inventory availability (for equipment/library)
 */
export async function validateReschedule(params: RescheduleParams): Promise<RescheduleValidationResult> {
    const { booking, user, resource, newStart, newEnd, session } = params;

    // Get current time once at the start
    const now = getNow();

    // 1. Status Check: Only CONFIRMED or PENDING bookings can be rescheduled
    if (!['CONFIRMED', 'PENDING'].includes(booking.status)) {
        return {
            allowed: false,
            reason: `Cannot reschedule ${booking.status.toLowerCase()} bookings. Only confirmed or pending bookings can be rescheduled.`,
        };
    }

    // NEW: 1a. Per-booking reschedule limit
    if (booking.rescheduleCount >= POLICIES.MAX_RESCHEDULE_PER_BOOKING) {
        return {
            allowed: false,
            reason: `This booking has already been rescheduled ${booking.rescheduleCount} time(s). Maximum ${POLICIES.MAX_RESCHEDULE_PER_BOOKING} reschedule allowed per booking.`,
        };
    }

    // NEW: 1b. Monthly reschedule limit
    const reschedMonthStart = getStartOfDay(new Date(now.getFullYear(), now.getMonth(), 1));
    const reschedMonthEnd = new Date(reschedMonthStart);
    reschedMonthEnd.setMonth(reschedMonthEnd.getMonth() + 1);

    const monthlyRescheduleCount = await Booking.countDocuments({
        userId: user.id,
        rescheduleCount: { $gt: 0 }, // Has been rescheduled at least once
        'rescheduleHistory.rescheduledAt': { $gte: reschedMonthStart, $lt: reschedMonthEnd }, // Rescheduled this month
    }).session(session);

    if (monthlyRescheduleCount >= POLICIES.MAX_RESCHEDULE_PER_MONTH) {
        return {
            allowed: false,
            reason: `You can only reschedule ${POLICIES.MAX_RESCHEDULE_PER_MONTH} bookings per month. You have already rescheduled ${monthlyRescheduleCount} booking(s) this month.`,
        };
    }

    // NEW: 1c. Time window restriction (cannot reschedule within 2 hours of start)
    const bookingStart = new Date(booking.start);
    const hoursUntilStart = (bookingStart.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (hoursUntilStart < POLICIES.RESCHEDULE_BLOCK_WINDOW_HOURS) {
        return {
            allowed: false,
            reason: `Cannot reschedule within ${POLICIES.RESCHEDULE_BLOCK_WINDOW_HOURS} hours of booking start time. Please cancel and create a new booking instead.`,
        };
    }

    // 2. Prevent rescheduling to the past
    if (newStart < now) {
        return {
            allowed: false,
            reason: 'Cannot reschedule to a past time',
        };
    }

    // 3. Check advance booking window
    if (!isWithinAdvanceWindow(newStart)) {
        return {
            allowed: false,
            reason: `Bookings can only be made up to ${POLICIES.ADVANCE_BOOKING_DAYS} days in advance`,
        };
    }

    // 4. Validate duration based on resource type
    const duration = (newEnd.getTime() - newStart.getTime()) / (1000 * 60); // minutes

    if (booking.kind === 'FACILITY' || booking.kind === 'ROOM') {
        // Dynamic slot system: 15-120 minutes
        if (duration < POLICIES.MIN_BOOKING_DURATION_MINUTES) {
            return {
                allowed: false,
                reason: `Booking duration must be at least ${POLICIES.MIN_BOOKING_DURATION_MINUTES} minutes`,
            };
        }
        if (duration > POLICIES.MAX_BOOKING_DURATION_MINUTES) {
            return {
                allowed: false,
                reason: `Booking duration cannot exceed ${POLICIES.MAX_BOOKING_DURATION_MINUTES} minutes (${POLICIES.MAX_BOOKING_DURATION_MINUTES / 60} hours)`,
            };
        }
    } else if (booking.kind === 'EQUIPMENT') {
        // Determine if sports or lab equipment based on resource type
        const isSportsEquipment = resource.type === 'SPORTS_EQUIPMENT';
        const expectedDuration = isSportsEquipment
            ? POLICIES.SPORTS_EQUIPMENT_BORROW_MINUTES
            : POLICIES.LAB_EQUIPMENT_BORROW_MINUTES;

        if (duration !== expectedDuration) {
            return {
                allowed: false,
                reason: `Equipment borrow duration must be exactly ${expectedDuration} minutes`,
            };
        }
    } else if (booking.kind === 'LIBRARY') {
        if (duration !== POLICIES.LIBRARY_BOOK_BORROW_MINUTES) {
            return {
                allowed: false,
                reason: `Library book borrow duration must be exactly ${POLICIES.LIBRARY_BOOK_BORROW_MINUTES} minutes (14 days)`,
            };
        }
    }

    // 5. Check for conflicts with blocks
    const conflictingBlocks = await Block.findOne({
        resourceId: booking.resourceId,
        start: { $lt: newEnd },
        end: { $gt: newStart },
    }).session(session);

    if (conflictingBlocks) {
        return {
            allowed: false,
            reason: `Resource is blocked: ${conflictingBlocks.reason}`,
        };
    }

    // 6. Check for conflicts with existing bookings (for facilities/rooms only)
    if (booking.kind === 'FACILITY' || booking.kind === 'ROOM') {
        const conflictingBooking = await Booking.findOne({
            resourceId: booking.resourceId,
            _id: { $ne: booking._id }, // Exclude current booking
            status: { $in: ['CONFIRMED', 'PENDING'] },
            start: { $lt: newEnd },
            end: { $gt: newStart },
        }).session(session);

        if (conflictingBooking) {
            return {
                allowed: false,
                reason: 'Time slot already booked',
            };
        }

        // Check shared turf conflicts
        if (resource.sharedGroupId) {
            const { Resource } = await import('@/models/Resource');
            const sharedResources = await Resource.find({
                sharedGroupId: resource.sharedGroupId,
                _id: { $ne: booking.resourceId },
            }).session(session);

            const sharedResourceIds = sharedResources.map(r => r.id);

            const sharedConflict = await Booking.findOne({
                resourceId: { $in: sharedResourceIds },
                _id: { $ne: booking._id },
                status: { $in: ['CONFIRMED', 'PENDING'] },
                start: { $lt: newEnd },
                end: { $gt: newStart },
            }).session(session);

            if (sharedConflict) {
                const conflictResource = sharedResources.find(r => r.id === sharedConflict.resourceId);
                return {
                    allowed: false,
                    reason: `Cannot reschedule: ${conflictResource?.name} is booked during this time (shared turf rule)`,
                };
            }
        }
    }

    // 7. Check inventory availability for equipment/library bookings
    if ((booking.kind === 'EQUIPMENT' || booking.kind === 'LIBRARY') && booking.items) {
        const { EquipmentItem } = await import('@/models/EquipmentItem');

        // Prepare items with total quantities
        const itemsToCheck = await Promise.all(
            booking.items.map(async (item) => {
                const equipmentItem = await EquipmentItem.findById(item.itemId).session(session);
                if (!equipmentItem) {
                    throw new Error(`Item ${item.name} not found`);
                }
                return {
                    itemId: item.itemId,
                    qty: item.qty,
                    totalQty: equipmentItem.qtyTotal,
                    name: item.name,
                };
            })
        );

        const availabilityCheck = await checkBookingAvailability(
            itemsToCheck,
            newStart,
            newEnd,
            booking.id, // Exclude current booking from overlap check
            session
        );

        if (!availabilityCheck.success) {
            return {
                allowed: false,
                reason: availabilityCheck.message || 'Items not available for selected time',
            };
        }
    }

    // 8. Check user policy limits (excluding current booking)
    // Daily limit
    const today = getTodayStart();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayBookingsCount = await Booking.countDocuments({
        userId: user.id,
        _id: { $ne: booking._id }, // Exclude current booking
        status: { $in: ['CONFIRMED', 'CHECKED_IN', 'PENDING'] },
        start: { $gte: today, $lt: tomorrow },
    }).session(session);

    // FIX: Only check daily limit if it's enabled (value > 0)
    // When MAX_BOOKINGS_PER_DAY is 0, the limit is disabled
    if (POLICIES.MAX_BOOKINGS_PER_DAY > 0 && todayBookingsCount >= POLICIES.MAX_BOOKINGS_PER_DAY) {
        return {
            allowed: false,
            reason: `You can only make ${POLICIES.MAX_BOOKINGS_PER_DAY} bookings per day`,
        };
    }

    // Weekly limit
    const weekAgo = getNow();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const weekBookingsCount = await Booking.countDocuments({
        userId: user.id,
        _id: { $ne: booking._id },
        status: { $in: ['CONFIRMED', 'CHECKED_IN', 'PENDING', 'COMPLETED'] },
        start: { $gte: weekAgo },
    }).session(session);

    if (weekBookingsCount >= POLICIES.MAX_BOOKINGS_PER_WEEK) {
        return {
            allowed: false,
            reason: `You can only make ${POLICIES.MAX_BOOKINGS_PER_WEEK} bookings per week`,
        };
    }

    // Monthly limits
    const monthStart = getStartOfDay(new Date(now.getFullYear(), now.getMonth(), 1));
    const monthEnd = new Date(monthStart);
    monthEnd.setMonth(monthEnd.getMonth() + 1);

    const monthlyBookings = await Booking.find({
        userId: user.id,
        _id: { $ne: booking._id },
        status: { $in: ['CONFIRMED', 'CHECKED_IN', 'PENDING', 'COMPLETED'] },
        start: { $gte: monthStart, $lt: monthEnd },
    }).session(session);

    if (booking.kind === 'FACILITY') {
        const facilityBookings = monthlyBookings.filter((b: IBooking) => b.kind === 'FACILITY');
        const totalHours = calculateTotalHours(facilityBookings);
        const newHours = (newEnd.getTime() - newStart.getTime()) / (1000 * 60 * 60);

        if (totalHours + newHours > POLICIES.MAX_FACILITY_HOURS_PER_MONTH) {
            return {
                allowed: false,
                reason: `Monthly facility limit exceeded. You have used ${totalHours.toFixed(1)} hours out of ${POLICIES.MAX_FACILITY_HOURS_PER_MONTH} hours this month.`,
            };
        }
    } else if (booking.kind === 'ROOM') {
        const roomBookings = monthlyBookings.filter((b: IBooking) => b.kind === 'ROOM');
        const totalHours = calculateTotalHours(roomBookings);
        const newHours = (newEnd.getTime() - newStart.getTime()) / (1000 * 60 * 60);

        if (totalHours + newHours > POLICIES.MAX_ROOM_HOURS_PER_MONTH) {
            return {
                allowed: false,
                reason: `Monthly room limit exceeded. You have used ${totalHours.toFixed(1)} hours out of ${POLICIES.MAX_ROOM_HOURS_PER_MONTH} hours this month.`,
            };
        }
    } else if (booking.kind === 'EQUIPMENT') {
        const equipmentBookings = monthlyBookings.filter((b: IBooking) => b.kind === 'EQUIPMENT');
        if (equipmentBookings.length >= POLICIES.MAX_EQUIPMENT_BORROWS_PER_MONTH) {
            return {
                allowed: false,
                reason: `Monthly equipment limit exceeded. You can only borrow equipment ${POLICIES.MAX_EQUIPMENT_BORROWS_PER_MONTH} times per month.`,
            };
        }
    }

    // Check consecutive bookings (exclude current booking from the list)
    const upcomingBookings = await Booking.find({
        userId: user.id,
        _id: { $ne: booking._id },
        kind: { $ne: 'LIBRARY' },
        status: { $in: ['CONFIRMED', 'CHECKED_IN', 'PENDING'] },
        end: { $gt: new Date() },
    }).session(session);

    const sameResourceBookings = upcomingBookings.filter(
        (b: IBooking) => b.resourceId === booking.resourceId
    );

    if (hasConsecutiveBookings(sameResourceBookings, newStart, newEnd, booking.resourceId)) {
        return {
            allowed: false,
            reason: `You can only book ${POLICIES.MAX_CONSECUTIVE_SLOTS} consecutive slots for the same resource.`,
        };
    }

    // 9. Determine if approval is required for the new time
    const requiresApproval = booking.kind === 'LIBRARY' ? false : (resource.rules.requiresApproval || false);

    return {
        allowed: true,
        requiresApproval,
    };
}
