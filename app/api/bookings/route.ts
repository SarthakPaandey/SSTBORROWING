import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Booking } from '@/models/Booking';
import { Resource } from '@/models/Resource';
import { Block } from '@/models/Block';
import { User } from '@/models/User';
import { EquipmentItem } from '@/models/EquipmentItem';
import { requireAuth } from '@/lib/auth/guards';
import {
  POLICIES,
  canUserBook,
  isWithinAdvanceWindow,
  calculateTotalHours,
  hasMinimumGap,
  hasConsecutiveBookings,
} from '@/lib/policies';

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
    const resourceMap = new Map(resources.map(r => [r._id.toString(), r]));

    // Populate user details
    const userIds = [...new Set(bookings.map(b => b.userId))];
    const users = await User.find({ _id: { $in: userIds } });
    const userMap = new Map(users.map(u => [u._id.toString(), u]));

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

export async function POST(req: NextRequest) {
  try {
    const currentUser = await requireAuth(['STUDENT', 'ADMIN']);
    await connectDB();

    const body = await req.json();
    const { resourceId, kind, start, end, items } = body;

    if (!resourceId || !kind || !start || !end) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Get user with penalty info
    const user = await User.findById(currentUser.id);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if user can book
    const canBook = canUserBook(user);
    if (!canBook.allowed) {
      return NextResponse.json({ error: canBook.reason }, { status: 403 });
    }

    // Check advance window
    const startDate = new Date(start);
    if (!isWithinAdvanceWindow(startDate)) {
      return NextResponse.json(
        { error: `Bookings can only be made up to ${POLICIES.ADVANCE_BOOKING_DAYS} days in advance` },
        { status: 400 }
      );
    }

    // Get resource
    const resource = await Resource.findById(resourceId);
    if (!resource || resource.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'Resource not available' }, { status: 404 });
    }

    // Check students-only restriction
    if (resource.rules.studentsOnly && user.role !== 'STUDENT') {
      return NextResponse.json(
        { error: 'This resource is only available to students' },
        { status: 403 }
      );
    }

    // Check daily limit
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayBookings = await Booking.countDocuments({
      userId: user._id.toString(),
      status: { $in: ['CONFIRMED', 'CHECKED_IN', 'PENDING'] },
      start: { $gte: today, $lt: tomorrow },
    });

    if (todayBookings >= POLICIES.MAX_BOOKINGS_PER_DAY) {
      return NextResponse.json(
        { error: `You can only make ${POLICIES.MAX_BOOKINGS_PER_DAY} bookings per day` },
        { status: 400 }
      );
    }

    // Check weekly limit
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const weekBookings = await Booking.countDocuments({
      userId: user._id.toString(),
      status: { $in: ['CONFIRMED', 'CHECKED_IN', 'PENDING', 'COMPLETED'] },
      start: { $gte: weekAgo },
    });

    if (weekBookings >= POLICIES.MAX_BOOKINGS_PER_WEEK) {
      return NextResponse.json(
        { error: `You can only make ${POLICIES.MAX_BOOKINGS_PER_WEEK} bookings per week` },
        { status: 400 }
      );
    }

    // Check total active bookings limit
    const totalActiveBookings = await Booking.countDocuments({
      userId: user._id.toString(),
      status: { $in: ['CONFIRMED', 'CHECKED_IN', 'PENDING'] },
      end: { $gt: new Date() }, // Future bookings only
    });

    if (totalActiveBookings >= POLICIES.MAX_TOTAL_ACTIVE_BOOKINGS) {
      return NextResponse.json(
        {
          error: `You can only have ${POLICIES.MAX_TOTAL_ACTIVE_BOOKINGS} active bookings at a time. Please cancel or complete existing bookings first.`,
        },
        { status: 400 }
      );
    }

    // Check monthly limits based on resource type
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const monthEnd = new Date(monthStart);
    monthEnd.setMonth(monthEnd.getMonth() + 1);

    const monthlyBookings = await Booking.find({
      userId: user._id.toString(),
      status: { $in: ['CONFIRMED', 'CHECKED_IN', 'PENDING', 'COMPLETED'] },
      start: { $gte: monthStart, $lt: monthEnd },
    });

    if (kind === 'FACILITY') {
      const facilityBookings = monthlyBookings.filter((b: any) => b.kind === 'FACILITY');
      const totalHours = calculateTotalHours(facilityBookings);
      const newHours = (new Date(end).getTime() - new Date(start).getTime()) / (1000 * 60 * 60);

      if (totalHours + newHours > POLICIES.MAX_FACILITY_HOURS_PER_MONTH) {
        return NextResponse.json(
          {
            error: `Monthly facility limit exceeded. You have used ${totalHours.toFixed(
              1
            )} hours out of ${
              POLICIES.MAX_FACILITY_HOURS_PER_MONTH
            } hours this month.`,
          },
          { status: 400 }
        );
      }
    }

    if (kind === 'ROOM') {
      const roomBookings = monthlyBookings.filter((b: any) => b.kind === 'ROOM');
      const totalHours = calculateTotalHours(roomBookings);
      const newHours = (new Date(end).getTime() - new Date(start).getTime()) / (1000 * 60 * 60);

      if (totalHours + newHours > POLICIES.MAX_ROOM_HOURS_PER_MONTH) {
        return NextResponse.json(
          {
            error: `Monthly room limit exceeded. You have used ${totalHours.toFixed(
              1
            )} hours out of ${
              POLICIES.MAX_ROOM_HOURS_PER_MONTH
            } hours this month.`,
          },
          { status: 400 }
        );
      }
    }

    if (kind === 'EQUIPMENT') {
      const equipmentBookings = monthlyBookings.filter((b: any) => b.kind === 'EQUIPMENT');

      if (equipmentBookings.length >= POLICIES.MAX_EQUIPMENT_BORROWS_PER_MONTH) {
        return NextResponse.json(
          {
            error: `Monthly equipment limit exceeded. You can only borrow equipment ${POLICIES.MAX_EQUIPMENT_BORROWS_PER_MONTH} times per month.`,
          },
          { status: 400 }
        );
      }
    }

    // Check library book limits
    if (kind === 'LIBRARY') {
      // Check if user already has an active book borrowing
      const activeBookBorrowings = await Booking.countDocuments({
        userId: user._id.toString(),
        kind: 'LIBRARY',
        status: { $in: ['CONFIRMED', 'CHECKED_IN', 'PENDING'] },
        end: { $gt: new Date() },
      });

      if (activeBookBorrowings >= POLICIES.MAX_BOOKS_PER_STUDENT) {
        return NextResponse.json(
          {
            error: `You can only borrow ${POLICIES.MAX_BOOKS_PER_STUDENT} book at a time. Please return your current book first.`,
          },
          { status: 400 }
        );
      }
    }

    // Check minimum gap between bookings
    const upcomingBookings = await Booking.find({
      userId: user._id.toString(),
      status: { $in: ['CONFIRMED', 'CHECKED_IN', 'PENDING'] },
      end: { $gt: new Date() },
    });

    if (!hasMinimumGap(upcomingBookings, start, end)) {
      return NextResponse.json(
        {
          error: `You must have at least ${POLICIES.MIN_GAP_BETWEEN_BOOKINGS_MINUTES} minutes gap between bookings.`,
        },
        { status: 400 }
      );
    }

    // Check consecutive bookings for same resource
    const sameResourceBookings = upcomingBookings.filter(
      (b: any) => b.resourceId === resourceId
    );

    if (hasConsecutiveBookings(sameResourceBookings, start, end, resourceId)) {
      return NextResponse.json(
        {
          error: `You can only book ${POLICIES.MAX_CONSECUTIVE_SLOTS} consecutive slots for the same resource.`,
        },
        { status: 400 }
      );
    }

    // Check for conflicts with blocks
    const conflictingBlocks = await Block.findOne({
      resourceId,
      start: { $lt: new Date(end) },
      end: { $gt: new Date(start) },
    });

    if (conflictingBlocks) {
      return NextResponse.json(
        { error: `Resource is blocked: ${conflictingBlocks.reason}` },
        { status: 400 }
      );
    }

    // Check for conflicts with existing bookings
    const conflictingBookings = await Booking.findOne({
      resourceId,
      status: { $in: ['CONFIRMED', 'CHECKED_IN', 'PENDING'] },
      start: { $lt: new Date(end) },
      end: { $gt: new Date(start) },
    });

    if (conflictingBookings) {
      return NextResponse.json(
        { error: 'Time slot already booked' },
        { status: 400 }
      );
    }

    // Check shared turf conflicts
    if (resource.sharedGroupId) {
      const sharedResources = await Resource.find({
        sharedGroupId: resource.sharedGroupId,
        _id: { $ne: resourceId },
      });

      const sharedResourceIds = sharedResources.map(r => r._id.toString());

      const sharedConflict = await Booking.findOne({
        resourceId: { $in: sharedResourceIds },
        status: { $in: ['CONFIRMED', 'CHECKED_IN', 'PENDING'] },
        start: { $lt: new Date(end) },
        end: { $gt: new Date(start) },
      });

      if (sharedConflict) {
        const conflictResource = sharedResources.find(
          r => r._id.toString() === sharedConflict.resourceId
        );
        return NextResponse.json(
          {
            error: `Cannot book: ${conflictResource?.name} is booked during this time (shared turf rule)`,
          },
          { status: 400 }
        );
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
        start: { $lt: new Date(end) },
        end: { $gt: new Date(start) },
      });

      for (const item of items) {
        const equipItem = await EquipmentItem.findById(item.itemId);
        if (!equipItem) {
          return NextResponse.json(
            { error: `${kind === 'LIBRARY' ? 'Book' : 'Equipment item'} ${item.itemId} not found` },
            { status: 404 }
          );
        }

        // Calculate already booked quantity for this item in overlapping bookings
        let bookedQty = 0;
        for (const booking of overlappingBookings) {
          if (booking.items) {
            const bookedItem = booking.items.find((i: any) => i.itemId === item.itemId);
            if (bookedItem) {
              bookedQty += bookedItem.qty;
            }
          }
        }

        // Check if enough quantity available (total - already booked)
        const availableQty = equipItem.qtyAvailable - bookedQty;
        if (availableQty < item.qty) {
          return NextResponse.json(
            { error: `Not enough ${equipItem.name} available. Available: ${availableQty}, Requested: ${item.qty}` },
            { status: 400 }
          );
        }

        enrichedItems.push({
          itemId: item.itemId,
          name: equipItem.name,
          qty: item.qty,
        });
      }
    }

    // Determine if approval required (library books never require approval)
    const requiresApproval = kind === 'LIBRARY' ? false : (resource.rules.requiresApproval || false);

    // Create booking
    const booking = await Booking.create({
      userId: user._id.toString(),
      resourceId,
      kind,
      items: enrichedItems,
      start: new Date(start),
      end: new Date(end),
      status: requiresApproval ? 'PENDING' : 'CONFIRMED',
      requiresApproval,
      approval: requiresApproval ? 'PENDING' : 'NOT_REQUIRED',
      qrIssued: false,
    });

    return NextResponse.json({ booking }, { status: 201 });
  } catch (error: any) {
    console.error('Booking error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create booking' },
      { status: 500 }
    );
  }
}
