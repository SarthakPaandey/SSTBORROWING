import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Booking } from '@/models/Booking';
import { Resource } from '@/models/Resource';
import { Block } from '@/models/Block';
import { User } from '@/models/User';
import { EquipmentItem } from '@/models/EquipmentItem';
import { requireAuth } from '@/lib/auth/guards';
import { POLICIES, canUserBook, isWithinAdvanceWindow } from '@/lib/policies';

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

    const enrichedBookings = bookings.map(b => ({
      ...b.toObject(),
      resourceName: resourceMap.get(b.resourceId)?.name || 'Unknown',
    }));

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

    // Handle equipment bookings
    let enrichedItems;
    if (kind === 'EQUIPMENT' && items) {
      enrichedItems = [];
      for (const item of items) {
        const equipItem = await EquipmentItem.findById(item.itemId);
        if (!equipItem) {
          return NextResponse.json(
            { error: `Equipment item ${item.itemId} not found` },
            { status: 404 }
          );
        }

        if (equipItem.qtyAvailable < item.qty) {
          return NextResponse.json(
            { error: `Insufficient quantity for ${equipItem.name}` },
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

    // Determine if approval required
    const requiresApproval = resource.rules.requiresApproval || false;

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
