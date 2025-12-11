import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { connectDB } from '@/lib/db';
import { Booking, IBooking } from '@/models/Booking';
import { Resource } from '@/models/Resource';
import { Block } from '@/models/Block';
import { User } from '@/models/User';
import { EquipmentItem } from '@/models/EquipmentItem';
import { ApprovalToken, generateApprovalToken } from '@/models/ApprovalToken';
import { requireAuth } from '@/lib/auth/guards';
import {
  POLICIES,
  canUserBook,
  isWithinAdvanceWindow,
  hasConsecutiveBookings,
  loadDynamicPolicies,
} from '@/lib/policies';
import { sendEmail, generateApprovalEmailHTML, getApprovalEmailRecipients } from '@/lib/email';
import { formatDateTime } from '@/lib/utils';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import { bookingSchema } from '@/lib/validations';
import { handleApiError, ValidationError, AuthenticationError, NotFoundError, ConflictError } from '@/lib/errors';
import { BookingQuery } from '@/types/api';
import { BookingItem } from '@/types/booking';
import { getNow, getTodayStart, getStartOfDay, toIST } from '@/lib/timezone';
import { canUserCreateBookingWithCaps } from '@/lib/bookingRules';
import { canBorrowSportCategory, getFacilitySportCategory, getItemsSportCategories, SPORT_CATEGORIES, SportCategory } from '@/lib/sportCategoryRules';
import { validateSportKitQuantities, getFacilityWarningMessage, getSuggestedFacilities } from '@/lib/sportEquipmentKits';
import { countActiveGroupParticipations } from '@/lib/groupBookingParticipation';
import { triggerLazyExpiration } from '@/lib/lazyExpiration';

export async function GET(req: NextRequest) {
  try {
    // Trigger background expiration tasks (non-blocking, rate-limited)
    triggerLazyExpiration();

    const user = await requireAuth();
    await connectDB();

    const { searchParams } = new URL(req.url);
    const me = searchParams.get('me') === 'true';
    const userId = searchParams.get('userId');
    const status = searchParams.get('status');
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    const query: BookingQuery = {};

    if (me) {
      query.userId = user.id;
    } else if (userId) {
      query.userId = userId;
    }

    if (status) {
      query.status = status;
    }

    if (from || to) {
      query.start = {};
      if (from) query.start.$gte = new Date(from);
      if (to) query.start.$lte = new Date(to);
    }

    // Keep response payload small for dashboards by limiting recent results
    const bookings = await Booking.find(query)
      .sort({ start: -1 })
      .limit(100);

    // Populate resource names - filter out invalid ObjectIds to prevent CastError
    const resourceIds = [...new Set(bookings.map(b => b.resourceId))]
      .filter(id => mongoose.Types.ObjectId.isValid(id));
    const resources = await Resource.find({ _id: { $in: resourceIds } });
    const resourceMap = new Map(resources.map(r => [r.id, r]));

    // Populate user details - filter out invalid ObjectIds to prevent CastError
    const userIds = [...new Set(bookings.map(b => b.userId))]
      .filter(id => mongoose.Types.ObjectId.isValid(id));
    const users = await User.find({ _id: { $in: userIds } });
    const userMap = new Map(users.map(u => [u.id, u]));

    const enrichedBookings = bookings.map(b => {
      const userData = userMap.get(b.userId);
      return {
        ...b.toObject(),
        resourceName: resourceMap.get(b.resourceId)?.name || 'Unknown',
        userEmail: userData?.email || null,
        userName: userData?.name || null,
      };
    });

    return NextResponse.json({ bookings: enrichedBookings });
  } catch (error) {
    return handleApiError(error);
  }
}

import { withRateLimit } from '@/lib/ratelimit';
import { withTransaction } from '@/lib/transaction';

async function postHandler(req: Request) {
  const conn = await connectDB();
  if (!conn) {
    return NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
  }

  try {
    const transactionResult = await withTransaction(conn, async (session) => {
      const authSession = await getServerSession(authOptions);
      if (!authSession?.user) {
        throw new AuthenticationError();
      }

      const body = await req.json();

      // Validate input using Zod
      const validationResult = bookingSchema.safeParse(body);
      if (!validationResult.success) {
        throw new ValidationError('Validation failed: ' + JSON.stringify(validationResult.error.flatten()));
      }

      const { resourceId, start, end, items } = validationResult.data;
      const userId = authSession.user.id;

      // FIX: Validate resourceId format to prevent MongoDB CastError
      if (!mongoose.Types.ObjectId.isValid(resourceId)) {
        throw new ValidationError('Invalid resource ID format');
      }

      // Load dynamic policies from admin settings (with DB override support)
      const dynamicPolicies = await loadDynamicPolicies([
        'WORKING_HOURS_START',
        'WORKING_HOURS_END',
        'MIN_BOOKING_DURATION_MINUTES',
        'MAX_BOOKING_DURATION_MINUTES',
        'MAX_ACTIVE_FACILITIES',
        'MAX_ACTIVE_ROOMS',
        'MAX_TOTAL_ACTIVE_BOOKINGS',
        'ADVANCE_BOOKING_DAYS',
        'NO_SHOW_GRACE_MINUTES',
        'MAX_RESCHEDULE_PER_BOOKING',
        'MAX_RESCHEDULE_PER_MONTH',
      ]);

      const startDate = new Date(start);
      const endDate = new Date(end);

      // Grace period for network latency (2 minutes)
      const GRACE_PERIOD_MS = 2 * 60 * 1000;
      const nowWithGrace = new Date(Date.now() - GRACE_PERIOD_MS);

      // Check if booking is in the past (with 2-minute grace period)
      if (startDate < nowWithGrace) {
        throw new ValidationError('Cannot book in the past');
      }

      // Validate working hours (dynamic from admin settings)
      // Convert to IST for validation
      const startIST = toIST(startDate);
      const endIST = toIST(endDate);
      const startHour = startIST.getHours();
      const endHour = endIST.getHours();
      const endMinutes = endIST.getMinutes();

      // Working hours: configurable via admin settings
      if (startHour < dynamicPolicies.WORKING_HOURS_START) {
        throw new ValidationError(`Bookings cannot start before ${dynamicPolicies.WORKING_HOURS_START}:00 AM`);
      }

      // End time can be exactly closing time but not after
      if (
        endHour > dynamicPolicies.WORKING_HOURS_END ||
        (endHour === dynamicPolicies.WORKING_HOURS_END && endMinutes > 0)
      ) {
        throw new ValidationError(`Bookings cannot end after ${dynamicPolicies.WORKING_HOURS_END % 12 || 12}:00 PM`);
      }

      // Get user with penalty info
      // FIX: userId from session is the ObjectId, not email
      const user = await User.findById(userId).session(session);
      if (!user) {
        throw new NotFoundError('User');
      }

      // Check if user can book
      const canBook = canUserBook(user);
      if (!canBook.allowed) {
        throw new ValidationError(canBook.reason || 'Booking not allowed');
      }

      // Get resource
      const resource = await Resource.findById(resourceId).session(session);
      if (!resource || resource.status !== 'ACTIVE') {
        throw new NotFoundError('Resource');
      }

      // Check resource-specific operating hours (if set)
      if (resource.operatingHours?.useCustom) {
        const dayOfWeek = startIST.getDay(); // 0 = Sunday, 6 = Saturday
        const daySchedule = resource.operatingHours.schedule[dayOfWeek];

        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

        // Check if resource is closed on this day
        if (!daySchedule.open) {
          throw new ValidationError(`${resource.name} is closed on ${dayNames[dayOfWeek]}s`);
        }

        // Check if booking is within resource's operating hours
        if (startHour < daySchedule.startHour) {
          throw new ValidationError(
            `${resource.name} opens at ${daySchedule.startHour}:00 on ${dayNames[dayOfWeek]}s. ` +
            `Your booking starts at ${startHour}:00.`
          );
        }

        // End hour check (endHour in schedule means closing time, e.g. 20 = 8 PM)
        if (endHour > daySchedule.endHour || (endHour === daySchedule.endHour && endMinutes > 0)) {
          throw new ValidationError(
            `${resource.name} closes at ${daySchedule.endHour}:00 on ${dayNames[dayOfWeek]}s. ` +
            `Your booking ends at ${endHour}:${String(endMinutes).padStart(2, '0')}.`
          );
        }
      }

      // Map ResourceType to BookingKind
      let kind: 'FACILITY' | 'ROOM' | 'EQUIPMENT' | 'LIBRARY';
      if (resource.type === 'LAB_EQUIPMENT' || resource.type === 'SPORTS_EQUIPMENT') {
        kind = 'EQUIPMENT';
      } else {
        kind = resource.type as 'FACILITY' | 'ROOM' | 'LIBRARY';
      }

      // Check advance window (skip for equipment borrows which are immediate)
      if (kind !== 'EQUIPMENT') {
        if (!isWithinAdvanceWindow(startDate)) {
          throw new ValidationError(`Bookings can only be made up to ${dynamicPolicies.ADVANCE_BOOKING_DAYS} days in advance`);
        }
      }

      // Validate booking duration based on booking type
      const durationMinutes = (endDate.getTime() - startDate.getTime()) / (1000 * 60);

      if (kind === 'FACILITY' || kind === 'ROOM') {
        // Dynamic slot system: configurable via admin settings
        if (durationMinutes < dynamicPolicies.MIN_BOOKING_DURATION_MINUTES) {
          throw new ValidationError(
            `Booking duration must be at least ${dynamicPolicies.MIN_BOOKING_DURATION_MINUTES} minutes. ` +
            `Current duration: ${Math.round(durationMinutes)} minutes.`
          );
        }

        if (durationMinutes > dynamicPolicies.MAX_BOOKING_DURATION_MINUTES) {
          throw new ValidationError(
            `Booking duration cannot exceed ${dynamicPolicies.MAX_BOOKING_DURATION_MINUTES} minutes (${dynamicPolicies.MAX_BOOKING_DURATION_MINUTES / 60} hours). ` +
            `Current duration: ${Math.round(durationMinutes)} minutes.`
          );
        }
      } else if (kind === 'EQUIPMENT') {
        // Duration validation for equipment
        const isSportsEquipment = resource.type === 'SPORTS_EQUIPMENT';

        if (isSportsEquipment) {
          // Sports equipment: 15-75 minutes (dynamic based on closing time)
          // Allows shorter durations when booking close to 8 PM closing
          const maxDuration = POLICIES.SPORTS_EQUIPMENT_BORROW_MINUTES; // 75 min
          const minDuration = POLICIES.MIN_BOOKING_DURATION_MINUTES; // 15 min

          if (durationMinutes < minDuration) {
            throw new ValidationError(
              `Sports equipment borrow duration must be at least ${minDuration} minutes. ` +
              `Current duration: ${Math.round(durationMinutes)} minutes.`
            );
          }

          if (durationMinutes > maxDuration) {
            throw new ValidationError(
              `Sports equipment borrow duration cannot exceed ${maxDuration} minutes. ` +
              `Current duration: ${Math.round(durationMinutes)} minutes.`
            );
          }
        } else {
          // Lab equipment: Duration validated per-item based on labCategory after items are loaded
          // Categories: LAPTOP (up to 60 days), SAME_DAY_RETURN (return by 8 PM), GENERAL (1-7 days)
          // Basic range check: at least 1 minute, at most 60 days (will be refined per-item)
          if (durationMinutes < 1) {
            throw new ValidationError('Lab equipment borrow duration must be at least 1 minute.');
          }
          if (durationMinutes > 86400) { // 60 days max for any lab item
            throw new ValidationError('Lab equipment borrow duration cannot exceed 60 days.');
          }
        }
      } else if (kind === 'LIBRARY') {
        // Fixed duration: 14 days (20160 minutes)
        if (durationMinutes !== POLICIES.LIBRARY_BOOK_BORROW_MINUTES) {
          throw new ValidationError(
            `Library book borrow duration must be exactly ${POLICIES.LIBRARY_BOOK_BORROW_MINUTES} minutes (14 days). ` +
            `Current duration: ${Math.round(durationMinutes)} minutes.`
          );
        }
      }

      // Check students-only restriction
      if (resource.rules.studentsOnly && user.role !== 'STUDENT') {
        throw new ValidationError('This resource is only available to students');
      }

      // Check per-type active booking limits (facilities, rooms separately)
      // Then check total active bookings limit
      // Equipment and Library have their own separate quantity limits

      if (kind === 'FACILITY') {
        const activeFacilities = await Booking.countDocuments({
          userId: user.id,
          kind: 'FACILITY',
          status: { $in: ['CONFIRMED', 'CHECKED_IN', 'PENDING'] },
          end: { $gt: new Date() },
        }).session(session);

        if (activeFacilities >= dynamicPolicies.MAX_ACTIVE_FACILITIES) {
          throw new ValidationError(`You can only have ${dynamicPolicies.MAX_ACTIVE_FACILITIES} active facility bookings at a time. Please wait for one to complete or cancel it.`);
        }

        const facilitySport = getFacilitySportCategory(resource.name);

        // Exclusive rule: When booking Table Tennis facility, user must not have any overlapping equipment bookings.
        if (facilitySport === SPORT_CATEGORIES.TABLE_TENNIS) {
          const overlappingEquipment = await Booking.countDocuments({
            userId: user.id,
            kind: 'EQUIPMENT',
            status: { $in: ['CONFIRMED', 'CHECKED_IN', 'PENDING'] },
            start: { $lt: endDate },
            end: { $gt: startDate },
          }).session(session);

          if (overlappingEquipment > 0) {
            throw new ValidationError('Table Tennis bookings must be exclusive. You already have an equipment booking in this time slot. Please cancel it or choose a different time.');
          }
        }
      }

      if (kind === 'ROOM') {
        const activeRooms = await Booking.countDocuments({
          userId: user.id,
          kind: 'ROOM',
          status: { $in: ['CONFIRMED', 'CHECKED_IN', 'PENDING'] },
          end: { $gt: new Date() },
        }).session(session);

        if (activeRooms >= dynamicPolicies.MAX_ACTIVE_ROOMS) {
          throw new ValidationError(`You can only have ${dynamicPolicies.MAX_ACTIVE_ROOMS} active room booking at a time. Please wait for it to complete or cancel it.`);
        }
      }

      // Check total active bookings limit (facilities + rooms combined)
      const personalActiveBookings = await Booking.countDocuments({
        userId: user.id,
        kind: { $in: ['FACILITY', 'ROOM'] },
        status: { $in: ['CONFIRMED', 'CHECKED_IN', 'PENDING'] },
        end: { $gt: new Date() },
      }).session(session);

      const groupActiveBookings = await countActiveGroupParticipations(user.id, session);
      const totalActiveBookings = personalActiveBookings + groupActiveBookings;

      if (totalActiveBookings >= dynamicPolicies.MAX_TOTAL_ACTIVE_BOOKINGS) {
        throw new ValidationError(`You can only have ${dynamicPolicies.MAX_TOTAL_ACTIVE_BOOKINGS} active facility/room bookings at a time. Please cancel or complete existing bookings first.`);
      }

      // Per-user, per-category daily & monthly caps
      const capsCheck = await canUserCreateBookingWithCaps({
        userId: user.id,
        kind,
        start: startDate,
        end: endDate,
        session,
      });

      if (!capsCheck.allowed) {
        throw new ValidationError(capsCheck.reason || 'Booking limits exceeded');
      }

      // Check library book limits
      if (kind === 'LIBRARY') {
        // FIX: Only count as active if CHECKED_IN or within pickup window
        const gracePeriodMs = dynamicPolicies.NO_SHOW_GRACE_MINUTES * 60 * 1000;
        const graceCutoff = new Date(new Date().getTime() - gracePeriodMs);

        const activeBookBorrowings = await Booking.countDocuments({
          userId: user.id,
          kind: 'LIBRARY',
          $or: [
            // User has picked up the book
            { status: 'CHECKED_IN' },
            // Booking is still within pickup window
            {
              status: { $in: ['CONFIRMED', 'PENDING'] },
              start: { $gt: graceCutoff },
            },
          ],
        }).session(session);

        if (activeBookBorrowings >= POLICIES.MAX_BOOKS_PER_STUDENT) {
          throw new ValidationError(`You can only borrow ${POLICIES.MAX_BOOKS_PER_STUDENT} book at a time. Please return your current book first.`);
        }
      }

      // Check for overlapping equipment bookings (Lab OR Sports)
      // A student playing sports can't simultaneously use lab equipment
      if (kind === 'EQUIPMENT') {
        // FIX: For equipment, only block if:
        // 1. CHECKED_IN (user actually has the equipment), OR
        // 2. CONFIRMED/PENDING but still within the pickup grace period
        // Bookings that are CONFIRMED/PENDING but past grace period should NOT block
        // (they are effectively expired and will be cleaned up by cron)
        const gracePeriodMs = dynamicPolicies.NO_SHOW_GRACE_MINUTES * 60 * 1000;
        const nowTime = new Date();

        const overlappingEquipmentBooking = await Booking.findOne({
          userId: user.id,
          kind: 'EQUIPMENT',
          $or: [
            // CHECKED_IN bookings always block (user has the equipment)
            { status: 'CHECKED_IN' },
            // CONFIRMED/PENDING only block if still within grace period
            {
              status: { $in: ['CONFIRMED', 'PENDING'] },
              // Grace period hasn't expired: start + grace > now
              $expr: {
                $gt: [
                  { $add: ['$start', gracePeriodMs] },
                  nowTime
                ]
              }
            }
          ],
          // Check for time overlap
          start: { $lt: endDate },
          end: { $gt: startDate },
        }).session(session);

        if (overlappingEquipmentBooking) {
          // Get resource name for better error message
          const overlappingResource = await Resource.findById(overlappingEquipmentBooking.resourceId).session(session);
          const overlappingType = overlappingResource?.type === 'LAB_EQUIPMENT' ? 'lab equipment' : 'sports equipment';
          throw new ValidationError(
            `You already have ${overlappingType} borrowed during this time. ` +
            `Please return your current equipment before borrowing more.`
          );
        }
      }

      // Check for overlapping ROOM + FACILITY bookings
      // A student can't be in a meeting room AND on the turf at the same time
      if (kind === 'ROOM' || kind === 'FACILITY') {
        const overlappingLocationBooking = await Booking.findOne({
          userId: user.id,
          kind: { $in: ['ROOM', 'FACILITY'] },
          status: { $in: ['CONFIRMED', 'CHECKED_IN', 'PENDING'] },
          // Check for time overlap
          start: { $lt: endDate },
          end: { $gt: startDate },
        }).session(session);

        if (overlappingLocationBooking) {
          // Get resource name for better error message
          const overlappingResource = await Resource.findById(overlappingLocationBooking.resourceId).session(session);
          const overlappingType = overlappingLocationBooking.kind === 'ROOM' ? 'a meeting room' : 'a facility';
          throw new ValidationError(
            `You already have ${overlappingType} (${overlappingResource?.name || 'Unknown'}) booked during this time. ` +
            `You can only be in one place at a time.`
          );
        }
      }

      // Check minimum gap between bookings (use UTC for DB comparison)
      // FIX: Exclude LIBRARY bookings from gap validation since they're long-term borrows
      // (14 days) and don't conflict with time-slot bookings (rooms, facilities, equipment)
      const upcomingBookings = await Booking.find({
        userId: user.id,
        kind: { $ne: 'LIBRARY' }, // Exclude library bookings from time-slot conflict checks
        status: { $in: ['CONFIRMED', 'CHECKED_IN', 'PENDING'] },
        end: { $gt: new Date() },
      }).session(session);

      // Check consecutive bookings for same resource
      const sameResourceBookings = upcomingBookings.filter(
        (b: IBooking) => b.resourceId === resourceId
      );

      if (hasConsecutiveBookings(sameResourceBookings, startDate, endDate, resourceId)) {
        throw new ValidationError(`You can only book ${POLICIES.MAX_CONSECUTIVE_SLOTS} consecutive slots for the same resource.`);
      }

      // Check for conflicts with blocks
      const conflictingBlocks = await Block.findOne({
        resourceId,
        start: { $lt: endDate },
        end: { $gt: startDate },
      }).session(session);

      if (conflictingBlocks) {
        throw new ConflictError(`Resource is blocked: ${conflictingBlocks.reason}`);
      }

      // ========== LOGICAL CONFLICT CHECKS ==========
      // Rule 1: Physical Presence - Cannot be in two locations at once
      if (kind === 'FACILITY' || kind === 'ROOM') {
        const locationConflict = await Booking.findOne({
          userId: user.id,
          kind: { $in: ['FACILITY', 'ROOM'] },
          status: { $in: ['CONFIRMED', 'CHECKED_IN', 'PENDING'] },
          start: { $lt: endDate },
          end: { $gt: startDate },
        }).session(session);

        if (locationConflict) {
          const conflictResourceData = await Resource.findById(locationConflict.resourceId).session(session);
          throw new ConflictError(`You already have a booking for ${conflictResourceData?.name || 'another location'} at this time. You cannot be in two places at once.`);
        }
      }

      // Rule 2: Activity Context - Sports equipment incompatible with meeting rooms
      if (kind === 'ROOM') {
        // Check if user has active sports equipment booking
        const sportsEquipmentResources = await Resource.find({
          type: 'SPORTS_EQUIPMENT',
          status: 'ACTIVE'
        }).session(session);
        const sportsEquipmentIds = sportsEquipmentResources.map(r => r.id);

        // FIX: Exclude expired equipment bookings (past grace period)
        const gracePeriodMs = dynamicPolicies.NO_SHOW_GRACE_MINUTES * 60 * 1000;
        const nowTime = new Date();

        const sportsConflict = await Booking.findOne({
          userId: user.id,
          resourceId: { $in: sportsEquipmentIds },
          kind: 'EQUIPMENT',
          $or: [
            { status: 'CHECKED_IN' },
            {
              status: { $in: ['CONFIRMED', 'PENDING'] },
              $expr: {
                $gt: [
                  { $add: ['$start', gracePeriodMs] },
                  nowTime
                ]
              }
            }
          ],
          start: { $lt: endDate },
          end: { $gt: startDate },
        }).session(session);

        if (sportsConflict) {
          const conflictResourceData = await Resource.findById(sportsConflict.resourceId).session(session);
          throw new ConflictError(`You have sports equipment (${conflictResourceData?.name || 'unknown item'}) booked at this time. Cannot book a meeting room while holding sports equipment.`);
        }
      }

      if (kind === 'EQUIPMENT' && resource.type === 'SPORTS_EQUIPMENT') {
        // Check if user has active room booking
        const roomConflict = await Booking.findOne({
          userId: user.id,
          kind: 'ROOM',
          status: { $in: ['CONFIRMED', 'CHECKED_IN', 'PENDING'] },
          start: { $lt: endDate },
          end: { $gt: startDate },
        }).session(session);

        if (roomConflict) {
          const conflictResourceData = await Resource.findById(roomConflict.resourceId).session(session);
          throw new ConflictError(`You have a meeting room (${conflictResourceData?.name || 'unknown room'}) booked at this time. Cannot borrow sports equipment while in a meeting room.`);
        }
      }
      // ========== END LOGICAL CONFLICT CHECKS ==========

      // Check for conflicts with existing bookings
      // FIX: Time-slot conflicts only apply to FACILITY and ROOM bookings
      // Equipment and Library bookings are constrained by inventory, not time slots
      // Multiple students can borrow different items from the same equipment resource at the same time
      if (kind === 'FACILITY' || kind === 'ROOM') {
        const conflictingBookings = await Booking.findOne({
          resourceId,
          status: { $in: ['CONFIRMED', 'PENDING'] },  // Exclude CHECKED_IN - not applicable for rooms/facilities
          start: { $lt: endDate },
          end: { $gt: startDate },
        }).session(session);

        if (conflictingBookings) {
          throw new ConflictError('Time slot already booked');
        }

        // Check shared turf conflicts (only for facilities like Football/Cricket turf)
        if (resource.sharedGroupId) {
          const sharedResources = await Resource.find({
            sharedGroupId: resource.sharedGroupId,
            _id: { $ne: resourceId },
          }).session(session);

          const sharedResourceIds = sharedResources.map(r => r.id);

          const sharedConflict = await Booking.findOne({
            resourceId: { $in: sharedResourceIds },
            status: { $in: ['CONFIRMED', 'PENDING'] },
            start: { $lt: endDate },
            end: { $gt: startDate },
          }).session(session);

          if (sharedConflict) {
            const conflictResource = sharedResources.find(
              r => r.id === sharedConflict.resourceId
            );
            throw new ConflictError(`Cannot book: ${conflictResource?.name} is booked during this time (shared turf rule)`);
          }
        }
      }

      // Handle equipment and library bookings with atomic reservation
      let enrichedItems: BookingItem[] | undefined;
      let facilityWarning: string | null = null;  // Declared at higher scope for return
      if (kind === 'EQUIPMENT' || kind === 'LIBRARY') {
        if (!items || items.length === 0) {
          throw new ValidationError('Items are required for equipment and library bookings.');
        }

        // FIX EC-19: Prevent duplicate items in booking
        // Check that all itemIds are unique
        const itemIds = items.map(i => i.itemId);
        const uniqueItemIds = new Set(itemIds);
        if (uniqueItemIds.size !== itemIds.length) {
          throw new ValidationError('Duplicate items detected. Each item can only be requested once per booking.');
        }

        enrichedItems = [];

        // Check availability using time-based overlap instead of qtyReserved
        const { checkBookingAvailability } = await import('@/lib/inventory');

        // Prepare items with total quantities for checking
        const itemsToCheck = await Promise.all(
          items.map(async (item) => {
            const currentItem = await EquipmentItem.findById(item.itemId).session(session);
            if (!currentItem) {
              throw new NotFoundError(kind === 'LIBRARY' ? 'Book' : 'Equipment item');
            }
            return {
              itemId: item.itemId.toString(),
              qty: item.qty,
              totalQty: currentItem.qtyTotal,
              name: currentItem.name
            };
          })
        );

        // FIX EC-31: Check if booking can be fulfilled with session for transaction isolation
        const availabilityCheck = await checkBookingAvailability(
          itemsToCheck,
          startDate,
          endDate,
          undefined, // excludeBookingId
          session // Pass session for transaction isolation
        );

        if (!availabilityCheck.success) {
          throw new ConflictError(availabilityCheck.message || 'Items not available for selected time');
        }

        // FIX: Check sport category exclusivity for SPORTS_EQUIPMENT
        // Users can only borrow from ONE sport at a time (e.g., Basketball OR Badminton, not both)
        // This only applies to SPORTS_EQUIPMENT, not LAB_EQUIPMENT
        // FIX: Now checks for OVERLAPPING bookings only, not all active bookings
        let sportCategory: SportCategory | null = null;

        if (resource.type === 'SPORTS_EQUIPMENT') {
          const itemIds = items.map(i => i.itemId.toString());

          // Get sport categories for the items
          const categories = await getItemsSportCategories(itemIds);
          categories.delete(SPORT_CATEGORIES.GENERAL);
          if (categories.size > 0) {
            sportCategory = Array.from(categories)[0] as SportCategory;
          }

          // Enforce single sport per booking
          if (categories.size > 1) {
            const sports = Array.from(categories).join(', ');
            throw new ValidationError(`You can only borrow one sport at a time. Found: ${sports}.`);
          }

          // Total cap: apply only when no specific sport category was detected (e.g., GENERAL-only)
          const totalRequestedQty = items.reduce((sum, i) => sum + i.qty, 0);
          const hasSingleSport = categories.size === 1;
          if (!hasSingleSport && totalRequestedQty > POLICIES.MAX_SPORTS_EQUIPMENT_ITEMS_PER_BOOKING) {
            throw new ValidationError(`You can only borrow up to ${POLICIES.MAX_SPORTS_EQUIPMENT_ITEMS_PER_BOOKING} sports equipment items per booking.`);
          }

          const sportCategoryCheck = await canBorrowSportCategory({
            userId: user.id,
            requestedItemIds: itemIds,
            start: startDate,
            end: endDate,
            session,
          });

          if (!sportCategoryCheck.allowed) {
            throw new ValidationError(sportCategoryCheck.reason || 'Sport category conflict');
          }

          // FIX: Enforce cumulative item limit across overlapping bookings
          // If user already has items borrowed in overlapping time, ensure total stays within limit
          const existingItems = sportCategoryCheck.totalOverlappingItems;
          const newItems = items.reduce((sum, i) => sum + i.qty, 0);
          const totalItems = existingItems + newItems;
          const maxItems = POLICIES.MAX_SPORTS_EQUIPMENT_ITEMS_PER_BOOKING;

          if (totalItems > maxItems) {
            throw new ValidationError(
              `You already have ${existingItems} item${existingItems !== 1 ? 's' : ''} borrowed during this time. ` +
              `Adding ${newItems} more would exceed the limit of ${maxItems} items. ` +
              `Please return your current items first or choose a different time.`
            );
          }

          // FIX: Validate sport kit quantities (e.g., Cricket: max 2 bats, 2 helmets, 1 ball)
          if (sportCategory) {
            // First, build enriched items to get names
            const itemsWithNames: Array<{ itemId: string; name: string; qty: number; sportCategory?: SportCategory }> = [];
            for (const item of items) {
              const currentItem = await EquipmentItem.findById(item.itemId).session(session);
              if (currentItem) {
                itemsWithNames.push({
                  itemId: item.itemId,
                  name: currentItem.name,
                  qty: item.qty,
                  sportCategory: currentItem.sportCategory as SportCategory,
                });
              }
            }

            const kitValidation = await validateSportKitQuantities(itemsWithNames, sportCategory);
            if (!kitValidation.valid) {
              throw new ValidationError(kitValidation.errors.join(' '));
            }

            // Enforce facility/equipment pairing: if user has an overlapping facility booking with a mapped sport,
            // the equipment must match that sport (e.g., Table Tennis facility -> only TT equipment).
            const overlappingFacility = await Booking.findOne({
              userId: user.id,
              kind: 'FACILITY',
              status: { $in: ['CONFIRMED', 'CHECKED_IN', 'PENDING'] },
              start: { $lt: endDate },
              end: { $gt: startDate },
            }).session(session).populate('resourceId');

            const overlappingFacilityResource = overlappingFacility?.resourceId as any;
            const overlappingFacilityName = overlappingFacilityResource?.name as string | undefined;
            const overlappingFacilitySport = getFacilitySportCategory(overlappingFacilityName);
            const isSharedTurfFacility =
              overlappingFacilityResource?.sharedGroupId === POLICIES.SHARED_TURF_GROUP_ID ||
              (overlappingFacilityName || '').toLowerCase().includes('turf');
            const sharedTurfCompatible =
              isSharedTurfFacility &&
              (sportCategory === SPORT_CATEGORIES.FOOTBALL || sportCategory === SPORT_CATEGORIES.CRICKET);

            if (overlappingFacilitySport && overlappingFacilitySport !== sportCategory && !sharedTurfCompatible) {
              throw new ValidationError(`Your overlapping facility booking (${overlappingFacilityName}) is for ${overlappingFacilitySport.replace('_', ' ').toLowerCase()}. You can only borrow equipment for that sport during the same time.`);
            }

            // FIX: Check if user has a matching facility booking (soft warning)
            const suggestedFacilities = getSuggestedFacilities(sportCategory);
            if (suggestedFacilities.length > 0) {
              // Check if user has a facility booking that matches
              const matchingFacility = await Booking.findOne({
                userId: user.id,
                kind: 'FACILITY',
                status: { $in: ['CONFIRMED', 'PENDING'] },
                start: { $lt: endDate },
                end: { $gt: startDate },
              }).session(session).populate('resourceId');

              const facilityName = (matchingFacility?.resourceId as any)?.name;
              const hasFacilityMatch = suggestedFacilities.some(f =>
                facilityName?.toLowerCase().includes(f.toLowerCase())
              );

              if (!hasFacilityMatch) {
                // Add soft warning (but don't block)
                facilityWarning = getFacilityWarningMessage(sportCategory);
              }
            }
          }
        }

        // Validate lab equipment duration per-item based on labCategory
        if (resource.type === 'LAB_EQUIPMENT') {
          const { validateLabBorrowDuration, detectLabCategoryFromName, LAB_CATEGORIES } = await import('@/lib/labEquipmentRules');
          const { toIST } = await import('@/lib/timezone');

          // Check all items and ensure they can all be borrowed for the requested duration
          for (const item of items) {
            const currentItem = await EquipmentItem.findById(item.itemId).session(session);
            if (!currentItem) {
              throw new NotFoundError('Lab equipment item');
            }

            // Use labCategory from item, or detect from name for backward compatibility
            const labCategory = currentItem.labCategory || detectLabCategoryFromName(currentItem.name);

            // Special handling for SAME_DAY_RETURN items (VR Headsets, Monitors)
            if (labCategory === LAB_CATEGORIES.SAME_DAY_RETURN) {
              // Convert start/end to IST for comparison
              const startIST = toIST(startDate);
              const endIST = toIST(endDate);

              // Must be returned by 8 PM on the same day
              const startDay = startIST.toISOString().split('T')[0];
              const endDay = endIST.toISOString().split('T')[0];

              if (startDay !== endDay) {
                throw new ValidationError(
                  `${currentItem.name} must be returned on the same day. ` +
                  `VR Headsets and Monitors cannot be borrowed overnight.`
                );
              }

              const endHourIST = endIST.getHours();
              const endMinuteIST = endIST.getMinutes();
              if (endHourIST > 20 || (endHourIST === 20 && endMinuteIST > 0)) {
                throw new ValidationError(
                  `${currentItem.name} must be returned by 8:00 PM today. ` +
                  `VR Headsets and Monitors have same-day return policy.`
                );
              }
            } else {
              // Standard duration validation for LAPTOP and GENERAL categories
              const validation = validateLabBorrowDuration(durationMinutes, labCategory, currentItem.name);
              if (!validation.valid) {
                throw new ValidationError(validation.reason!);
              }
            }
          }
        }

        // Build enriched items (no qtyReserved update needed)
        for (const item of items) {
          const currentItem = await EquipmentItem.findById(item.itemId).session(session);
          if (!currentItem) {
            throw new NotFoundError(kind === 'LIBRARY' ? 'Book' : 'Equipment item');
          }

          enrichedItems.push({
            itemId: item.itemId,
            name: currentItem.name,
            qty: item.qty,
          });
        }
      }

      // Determine if approval required:
      // - Library books never require approval
      // - Check resource-level rules.requiresApproval
      // - Check if any individual equipment item requires approval
      let requiresApproval = false;
      if (kind !== 'LIBRARY') {
        // Resource-level check
        requiresApproval = resource.rules.requiresApproval || false;

        // Individual equipment item check (for EQUIPMENT bookings)
        if (kind === 'EQUIPMENT' && !requiresApproval && items && items.length > 0) {
          const itemIds = items.map((i: { itemId: string }) => i.itemId);
          const equipmentItems = await EquipmentItem.find({
            _id: { $in: itemIds },
            requiresApproval: true
          }).session(session);

          if (equipmentItems.length > 0) {
            requiresApproval = true;
          }
        }
      }

      // Create booking
      const [booking] = await Booking.create([{
        userId: user.id,
        resourceId,
        kind,
        items: enrichedItems,
        start: startDate,
        end: endDate,
        status: requiresApproval ? 'PENDING' : 'CONFIRMED',
        requiresApproval,
        approval: requiresApproval ? 'PENDING' : 'NOT_REQUIRED',
        qrIssued: false,
      }], { session });

      // Return booking data for email sending after transaction completes
      return {
        booking,
        requiresApproval,
        resource,
        user,
        startDate,
        endDate,
        facilityWarning,
      };
    }); // End of withTransaction - it will auto-commit

    // Email sending happens here, AFTER transaction is committed
    // This prevents transaction rollback if email fails
    if (transactionResult.requiresApproval) {
      const { booking, resource, user, startDate, endDate } = transactionResult;

      try {
        // Get email recipients based on resource type routing configuration
        const adminEmails = await getApprovalEmailRecipients(resource.type);

        if (adminEmails.length > 0) {
          // Generate approval and rejection tokens
          const approveToken = generateApprovalToken();
          const rejectToken = generateApprovalToken();

          // FIX: Set expiration to minimum of 7 days or booking start time
          // This prevents approval tokens from being valid after the booking has started
          // which would allow approving past bookings
          const sevenDaysFromNow = new Date();
          sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
          const expiresAt = new Date(Math.min(sevenDaysFromNow.getTime(), startDate.getTime()));

          // Create token documents
          await ApprovalToken.create({
            bookingId: booking.id,
            token: approveToken,
            action: 'approve',
            expiresAt,
          });

          await ApprovalToken.create({
            bookingId: booking.id,
            token: rejectToken,
            action: 'reject',
            expiresAt,
          });

          // Send email to all admins
          const emailHTML = generateApprovalEmailHTML(
            booking.id,
            resource.name,
            user.name || user.email.split('@')[0],
            user.email,
            formatDateTime(startDate),
            formatDateTime(endDate),
            approveToken,
            rejectToken
          );

          await sendEmail({
            to: adminEmails,
            subject: `Booking Approval Required: ${resource.name}`,
            html: emailHTML,
          });

          // FIX: Track successful email delivery
          booking.approvalEmailSent = true;
          booking.approvalEmailSentAt = new Date();
          await booking.save();
        }
      } catch (emailError) {
        // FIX: Track email failure for debugging and potential retry
        console.error('Failed to send approval email:', emailError);
        const errorMessage = emailError instanceof Error ? emailError.message : String(emailError);
        transactionResult.booking.approvalEmailSent = false;
        transactionResult.booking.approvalEmailError = errorMessage;
        await transactionResult.booking.save();

        // Note: Booking is still created successfully, but admins need to be notified via dashboard
      }
    }

    // Include optional facility warning in response
    const response: { booking: any; warning?: string } = {
      booking: transactionResult.booking
    };

    if (transactionResult.facilityWarning) {
      response.warning = transactionResult.facilityWarning;
    }

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

export const POST = withRateLimit(postHandler);
