import { NextRequest, NextResponse } from 'next/server';
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
  calculateTotalHours,
  hasMinimumGap,
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
import { canBorrowSportCategory } from '@/lib/sportCategoryRules';

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

    // Populate resource names
    const resourceIds = [...new Set(bookings.map(b => b.resourceId))];
    const resources = await Resource.find({ _id: { $in: resourceIds } });
    const resourceMap = new Map(resources.map(r => [r.id, r]));

    // Populate user details
    const userIds = [...new Set(bookings.map(b => b.userId))];
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

      // Check if booking is in the past (use UTC for comparison)
      if (startDate < new Date()) {
        throw new ValidationError('Cannot book in the past');
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

      // Check students-only restriction
      if (resource.rules.studentsOnly && user.role !== 'STUDENT') {
        throw new ValidationError('This resource is only available to students');
      }

      // Check total active bookings limit (use UTC for DB comparison)
      // FIX: Equipment/Library bookings are only active if:
      //   - CHECKED_IN (user has the item), OR
      //   - CONFIRMED/PENDING and within pickup window (start time + 15 min grace period > now)
      // Facilities/Rooms are active until their end time (unchanged)
      const GRACE_PERIOD_MS = 15 * 60 * 1000; // 15 minutes
      const graceCutoff = new Date(new Date().getTime() - GRACE_PERIOD_MS);

      const totalActiveBookings = await Booking.countDocuments({
        userId: user.id,
        $or: [
          // Facilities/Rooms: Active until end time
          {
            kind: { $in: ['FACILITY', 'ROOM'] },
            status: { $in: ['CONFIRMED', 'CHECKED_IN', 'PENDING'] },
            end: { $gt: new Date() },
          },
          // Equipment/Library: CHECKED_IN (user has the item)
          {
            kind: { $in: ['EQUIPMENT', 'LIBRARY'] },
            status: 'CHECKED_IN',
          },
          // Equipment/Library: CONFIRMED/PENDING and still within pickup window
          {
            kind: { $in: ['EQUIPMENT', 'LIBRARY'] },
            status: { $in: ['CONFIRMED', 'PENDING'] },
            start: { $gt: graceCutoff }, // Still within pickup window
          },
        ],
      }).session(session);

      if (totalActiveBookings >= POLICIES.MAX_TOTAL_ACTIVE_BOOKINGS) {
        throw new ValidationError(`You can only have ${POLICIES.MAX_TOTAL_ACTIVE_BOOKINGS} active bookings at a time. Please cancel or complete existing bookings first.`);
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

      // Gap check removed to allow back-to-back bookings
      // if (!hasMinimumGap(upcomingBookings, startDate, endDate)) {
      //   throw new ValidationError(`You must have at least ${POLICIES.MIN_GAP_BETWEEN_BOOKINGS_MINUTES} minutes gap between bookings.`);
      // }

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
        if (resource.type === 'SPORTS_EQUIPMENT') {
          const itemIds = items.map(i => i.itemId.toString());
          const sportCategoryCheck = await canBorrowSportCategory({
            userId: user.id,
            requestedItemIds: itemIds,
            session,
          });

          if (!sportCategoryCheck.allowed) {
            throw new ValidationError(sportCategoryCheck.reason || 'Sport category conflict');
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
        endDate
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

    return NextResponse.json({ booking: transactionResult.booking }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

export const POST = withRateLimit(postHandler);
