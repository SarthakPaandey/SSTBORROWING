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
} from '@/lib/policies';
import { sendEmail, generateApprovalEmailHTML } from '@/lib/email';
import { formatDateTime } from '@/lib/utils';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';
import { bookingSchema } from '@/lib/validations';
import { handleApiError, ValidationError, AuthenticationError, NotFoundError, ConflictError } from '@/lib/errors';
import { BookingQuery } from '@/types/api';
import { BookingItem } from '@/types/booking';
import { getNow, getTodayStart, getStartOfDay, toIST } from '@/lib/timezone';
import { canUserCreateBookingWithCaps } from '@/lib/bookingRules';
import { canBorrowSportCategory, getItemsSportCategories, SPORT_CATEGORIES, SportCategory } from '@/lib/sportCategoryRules';
import { validateSportKitQuantities, getFacilityWarningMessage, getSuggestedFacilities } from '@/lib/sportEquipmentKits';

export async function GET(req: NextRequest) {
  try {
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

      const startDate = new Date(start);
      const endDate = new Date(end);

      // Grace period for network latency (2 minutes)
      const GRACE_PERIOD_MS = 2 * 60 * 1000;
      const nowWithGrace = new Date(Date.now() - GRACE_PERIOD_MS);

      // Check if booking is in the past (with 2-minute grace period)
      if (startDate < nowWithGrace) {
        throw new ValidationError('Cannot book in the past');
      }

      // Validate working hours (8 AM - 8 PM IST)
      // Convert to IST for validation
      const startIST = toIST(startDate);
      const endIST = toIST(endDate);
      const startHour = startIST.getHours();
      const endHour = endIST.getHours();
      const endMinutes = endIST.getMinutes();

      // Working hours: 8:00 AM (08:00) to 8:00 PM (20:00)
      const WORKING_HOURS_START = 8;  // 8:00 AM
      const WORKING_HOURS_END = 20;   // 8:00 PM

      if (startHour < WORKING_HOURS_START) {
        throw new ValidationError(`Bookings cannot start before ${WORKING_HOURS_START}:00 AM`);
      }

      // End time can be exactly 8:00 PM (20:00) but not after
      if (endHour > WORKING_HOURS_END || (endHour === WORKING_HOURS_END && endMinutes > 0)) {
        throw new ValidationError(`Bookings cannot end after ${WORKING_HOURS_END % 12 || 12}:00 PM`);
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

      // Check advance window
      if (!isWithinAdvanceWindow(startDate)) {
        throw new ValidationError(`Bookings can only be made up to ${POLICIES.ADVANCE_BOOKING_DAYS} days in advance`);
      }

      // Get resource
      const resource = await Resource.findById(resourceId).session(session);
      if (!resource || resource.status !== 'ACTIVE') {
        throw new NotFoundError('Resource');
      }

      // Map ResourceType to BookingKind
      let kind: 'FACILITY' | 'ROOM' | 'EQUIPMENT' | 'LIBRARY';
      if (resource.type === 'LAB_EQUIPMENT' || resource.type === 'SPORTS_EQUIPMENT') {
        kind = 'EQUIPMENT';
      } else {
        kind = resource.type as 'FACILITY' | 'ROOM' | 'LIBRARY';
      }

      // Validate booking duration based on booking type
      const durationMinutes = (endDate.getTime() - startDate.getTime()) / (1000 * 60);

      if (kind === 'FACILITY' || kind === 'ROOM') {
        // Dynamic slot system: 15-120 minutes
        if (durationMinutes < POLICIES.MIN_BOOKING_DURATION_MINUTES) {
          throw new ValidationError(
            `Booking duration must be at least ${POLICIES.MIN_BOOKING_DURATION_MINUTES} minutes. ` +
            `Current duration: ${Math.round(durationMinutes)} minutes.`
          );
        }

        if (durationMinutes > POLICIES.MAX_BOOKING_DURATION_MINUTES) {
          throw new ValidationError(
            `Booking duration cannot exceed ${POLICIES.MAX_BOOKING_DURATION_MINUTES} minutes (${POLICIES.MAX_BOOKING_DURATION_MINUTES / 60} hours). ` +
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
          // Lab equipment: Fixed 24-hour duration
          const expectedDuration = POLICIES.LAB_EQUIPMENT_BORROW_MINUTES; // 1440 min (24h)
          
          if (durationMinutes !== expectedDuration) {
            throw new ValidationError(
              `Lab equipment borrow duration must be exactly ${expectedDuration} minutes (24 hours). ` +
              `Current duration: ${Math.round(durationMinutes)} minutes.`
            );
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

      // Check total active bookings limit (use UTC for DB comparison)
      // Updated: Only count FACILITY and ROOM bookings as "active slots"
      // Equipment and Library have their own separate quantity limits and should not
      // block users from booking facilities/rooms while holding items

      const totalActiveBookings = await Booking.countDocuments({
        userId: user.id,
        kind: { $in: ['FACILITY', 'ROOM'] },
        status: { $in: ['CONFIRMED', 'CHECKED_IN', 'PENDING'] },
        end: { $gt: new Date() },
      }).session(session);

      if (totalActiveBookings >= POLICIES.MAX_TOTAL_ACTIVE_BOOKINGS) {
        throw new ValidationError(`You can only have ${POLICIES.MAX_TOTAL_ACTIVE_BOOKINGS} active facility/room bookings at a time. Please cancel or complete existing bookings first.`);
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
        // Check if user already has an active book borrowing (use UTC for DB comparison)
        // FIX: Only count as active if CHECKED_IN or within pickup window
        const GRACE_PERIOD_MS = 15 * 60 * 1000; // 15 minutes
        const graceCutoff = new Date(new Date().getTime() - GRACE_PERIOD_MS);

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

        const sportsConflict = await Booking.findOne({
          userId: user.id,
          resourceId: { $in: sportsEquipmentIds },
          kind: 'EQUIPMENT',
          status: { $in: ['CONFIRMED', 'CHECKED_IN', 'PENDING'] },
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
      if ((kind === 'EQUIPMENT' || kind === 'LIBRARY') && items) {
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

      // Determine if approval required (library books never require approval)
      const requiresApproval = kind === 'LIBRARY' ? false : (resource.rules.requiresApproval || false);

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
        // Get all admin users
        const admins = await User.find({ role: 'ADMIN' });
        const adminEmails = admins.map(admin => admin.email).filter(Boolean);

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
