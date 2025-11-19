import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Booking } from '@/models/Booking';
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

    const query: any = {};

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
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to fetch bookings' },
      { status: 500 }
    );
  }
}

import { withRateLimit } from '@/lib/ratelimit';

async function postHandler(req: Request) {
  const conn = await connectDB();
  if (!conn) {
    return NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
  }
  // ... rest of the function

  const session = await conn.startSession();
  session.startTransaction();

  try {
    const authSession = await getServerSession(authOptions);
    if (!authSession?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();

    // Validate input using Zod
    const validationResult = bookingSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Validation Error', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    const { resourceId, start, end, items } = validationResult.data;
    const userId = authSession.user.id;

    const startDate = new Date(start);
    const endDate = new Date(end);

    if (startDate < new Date()) {
      throw new Error('Cannot book in the past');
    }

    // Get user with penalty info
    const user = await User.findById(userId).session(session);
    if (!user) {
      throw new Error('User not found');
    }

    // Check if user can book
    const canBook = canUserBook(user);
    if (!canBook.allowed) {
      throw new Error(canBook.reason || 'Booking not allowed');
    }

    // Check advance window
    if (!isWithinAdvanceWindow(startDate)) {
      throw new Error(`Bookings can only be made up to ${POLICIES.ADVANCE_BOOKING_DAYS} days in advance`);
    }

    // Get resource
    const resource = await Resource.findById(resourceId).session(session);
    if (!resource || resource.status !== 'ACTIVE') {
      throw new Error('Resource not available');
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
      throw new Error('This resource is only available to students');
    }

    // Check daily limit
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayBookings = await Booking.countDocuments({
      userId: user.id,
      status: { $in: ['CONFIRMED', 'CHECKED_IN', 'PENDING'] },
      start: { $gte: today, $lt: tomorrow },
    }).session(session);

    if (todayBookings >= POLICIES.MAX_BOOKINGS_PER_DAY) {
      throw new Error(`You can only make ${POLICIES.MAX_BOOKINGS_PER_DAY} bookings per day`);
    }

    // Check weekly limit
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const weekBookings = await Booking.countDocuments({
      userId: user.id,
      status: { $in: ['CONFIRMED', 'CHECKED_IN', 'PENDING', 'COMPLETED'] },
      start: { $gte: weekAgo },
    }).session(session);

    if (weekBookings >= POLICIES.MAX_BOOKINGS_PER_WEEK) {
      throw new Error(`You can only make ${POLICIES.MAX_BOOKINGS_PER_WEEK} bookings per week`);
    }

    // Check total active bookings limit
    const totalActiveBookings = await Booking.countDocuments({
      userId: user.id,
      status: { $in: ['CONFIRMED', 'CHECKED_IN', 'PENDING'] },
      end: { $gt: new Date() }, // Future bookings only
    }).session(session);

    if (totalActiveBookings >= POLICIES.MAX_TOTAL_ACTIVE_BOOKINGS) {
      throw new Error(`You can only have ${POLICIES.MAX_TOTAL_ACTIVE_BOOKINGS} active bookings at a time. Please cancel or complete existing bookings first.`);
    }

    // Check monthly limits based on resource type
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const monthEnd = new Date(monthStart);
    monthEnd.setMonth(monthEnd.getMonth() + 1);

    const monthlyBookings = await Booking.find({
      userId: user.id,
      status: { $in: ['CONFIRMED', 'CHECKED_IN', 'PENDING', 'COMPLETED'] },
      start: { $gte: monthStart, $lt: monthEnd },
    }).session(session);

    if (kind === 'FACILITY') {
      const facilityBookings = monthlyBookings.filter((b: any) => b.kind === 'FACILITY');
      const totalHours = calculateTotalHours(facilityBookings);
      const newHours = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60);

      if (totalHours + newHours > POLICIES.MAX_FACILITY_HOURS_PER_MONTH) {
        throw new Error(`Monthly facility limit exceeded. You have used ${totalHours.toFixed(1)} hours out of ${POLICIES.MAX_FACILITY_HOURS_PER_MONTH} hours this month.`);
      }
    }

    if (kind === 'ROOM') {
      const roomBookings = monthlyBookings.filter((b: any) => b.kind === 'ROOM');
      const totalHours = calculateTotalHours(roomBookings);
      const newHours = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60);

      if (totalHours + newHours > POLICIES.MAX_ROOM_HOURS_PER_MONTH) {
        throw new Error(`Monthly room limit exceeded. You have used ${totalHours.toFixed(1)} hours out of ${POLICIES.MAX_ROOM_HOURS_PER_MONTH} hours this month.`);
      }
    }

    if (kind === 'EQUIPMENT') {
      const equipmentBookings = monthlyBookings.filter((b: any) => b.kind === 'EQUIPMENT');

      if (equipmentBookings.length >= POLICIES.MAX_EQUIPMENT_BORROWS_PER_MONTH) {
        throw new Error(`Monthly equipment limit exceeded. You can only borrow equipment ${POLICIES.MAX_EQUIPMENT_BORROWS_PER_MONTH} times per month.`);
      }
    }

    // Check library book limits
    if (kind === 'LIBRARY') {
      // Check if user already has an active book borrowing
      const activeBookBorrowings = await Booking.countDocuments({
        userId: user.id,
        kind: 'LIBRARY',
        status: { $in: ['CONFIRMED', 'CHECKED_IN', 'PENDING'] },
        end: { $gt: new Date() },
      }).session(session);

      if (activeBookBorrowings >= POLICIES.MAX_BOOKS_PER_STUDENT) {
        throw new Error(`You can only borrow ${POLICIES.MAX_BOOKS_PER_STUDENT} book at a time. Please return your current book first.`);
      }
    }

    // Check minimum gap between bookings
    const upcomingBookings = await Booking.find({
      userId: user.id,
      status: { $in: ['CONFIRMED', 'CHECKED_IN', 'PENDING'] },
      end: { $gt: new Date() },
    }).session(session);

    if (!hasMinimumGap(upcomingBookings, startDate, endDate)) {
      throw new Error(`You must have at least ${POLICIES.MIN_GAP_BETWEEN_BOOKINGS_MINUTES} minutes gap between bookings.`);
    }

    // Check consecutive bookings for same resource
    const sameResourceBookings = upcomingBookings.filter(
      (b: any) => b.resourceId === resourceId
    );

    if (hasConsecutiveBookings(sameResourceBookings, startDate, endDate, resourceId)) {
      throw new Error(`You can only book ${POLICIES.MAX_CONSECUTIVE_SLOTS} consecutive slots for the same resource.`);
    }

    // Check for conflicts with blocks
    const conflictingBlocks = await Block.findOne({
      resourceId,
      start: { $lt: endDate },
      end: { $gt: startDate },
    }).session(session);

    if (conflictingBlocks) {
      throw new Error(`Resource is blocked: ${conflictingBlocks.reason}`);
    }

    // Check for conflicts with existing bookings
    const conflictingBookings = await Booking.findOne({
      resourceId,
      status: { $in: ['CONFIRMED', 'CHECKED_IN', 'PENDING'] },
      start: { $lt: endDate },
      end: { $gt: startDate },
    }).session(session);

    if (conflictingBookings) {
      throw new Error('Time slot already booked');
    }

    // Check shared turf conflicts
    if (resource.sharedGroupId) {
      const sharedResources = await Resource.find({
        sharedGroupId: resource.sharedGroupId,
        _id: { $ne: resourceId },
      }).session(session);

      const sharedResourceIds = sharedResources.map(r => r.id);

      const sharedConflict = await Booking.findOne({
        resourceId: { $in: sharedResourceIds },
        status: { $in: ['CONFIRMED', 'CHECKED_IN', 'PENDING'] },
        start: { $lt: endDate },
        end: { $gt: startDate },
      }).session(session);

      if (sharedConflict) {
        const conflictResource = sharedResources.find(
          r => r.id === sharedConflict.resourceId
        );
        throw new Error(`Cannot book: ${conflictResource?.name} is booked during this time (shared turf rule)`);
      }
    }

    // Handle equipment and library bookings
    let enrichedItems;
    if ((kind === 'EQUIPMENT' || kind === 'LIBRARY') && items) {
      enrichedItems = [];

      // Find all overlapping bookings to check reserved quantities
      const overlappingBookings = await Booking.find({
        resourceId,
        kind: { $in: ['EQUIPMENT', 'LIBRARY'] },
        status: { $in: ['CONFIRMED', 'CHECKED_IN', 'PENDING'] },
        start: { $lt: endDate },
        end: { $gt: startDate },
      }).session(session);

      for (const item of items) {
        const equipItem = await EquipmentItem.findById(item.id).session(session);
        if (!equipItem) {
          throw new Error(`${kind === 'LIBRARY' ? 'Book' : 'Equipment item'} ${item.id} not found`);
        }

        // Calculate already booked quantity for this item in overlapping bookings
        let bookedQty = 0;
        for (const booking of overlappingBookings) {
          if (booking.items) {
            const bookedItem = booking.items.find((i: any) => i.itemId === item.id);
            if (bookedItem) {
              bookedQty += bookedItem.qty;
            }
          }
        }

        // Check if enough quantity available (total - already booked)
        const availableQty = equipItem.qtyAvailable - bookedQty;
        if (availableQty < item.qty) {
          throw new Error(`Not enough ${equipItem.name} available. Available: ${availableQty}, Requested: ${item.qty}`);
        }

        enrichedItems.push({
          itemId: item.id,
          name: equipItem.name,
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

    await session.commitTransaction();

    // If approval is required, send emails to admins with approve/reject links
    // Done after transaction commit to avoid side effects if transaction fails
    if (requiresApproval) {
      try {
        // Get all admin users
        const admins = await User.find({ role: 'ADMIN' });
        const adminEmails = admins.map(admin => admin.email).filter(Boolean);

        if (adminEmails.length > 0) {
          // Generate approval and rejection tokens
          const approveToken = generateApprovalToken();
          const rejectToken = generateApprovalToken();

          // Set expiration to 7 days from now
          const expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + 7);

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
        }
      } catch (emailError) {
        // Log error but don't fail the booking creation
        console.error('Failed to send approval email:', emailError);
      }
    }

    return NextResponse.json({ booking }, { status: 201 });
  } catch (error: any) {
    await session.abortTransaction();
    console.error('Booking error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create booking' },
      { status: error.message === 'User not found' ? 404 : 400 }
    );
  } finally {
    session.endSession();
  }
}
