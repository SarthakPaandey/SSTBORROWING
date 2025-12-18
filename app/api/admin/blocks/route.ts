import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Block } from '@/models/Block';
import { Booking } from '@/models/Booking';
import { Resource } from '@/models/Resource';
import { requireAuth } from '@/lib/auth/guards';
import { handleApiError, ValidationError } from '@/lib/errors';
import { BlockQuery } from '@/types/api';
import { logAuditEvent, getActorFromSession } from '@/lib/audit';
import crypto from 'crypto';

// Helper: Get all dates matching specific days of week within a range
function getRecurringDates(
  startDate: Date,
  endDate: Date,
  daysOfWeek: number[] // 0=Sunday, 6=Saturday
): Date[] {
  const dates: Date[] = [];
  const current = new Date(startDate);
  current.setHours(0, 0, 0, 0);

  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);

  while (current <= end) {
    const dayOfWeek = current.getDay();
    if (daysOfWeek.includes(dayOfWeek)) {
      dates.push(new Date(current));
    }
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

// Helper: Create pattern description
function getPatternDescription(daysOfWeek: number[]): string {
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  if (daysOfWeek.length === 7) return 'Every day';
  if (daysOfWeek.length === 2 && daysOfWeek.includes(0) && daysOfWeek.includes(6)) return 'Every weekend';
  if (daysOfWeek.length === 5 && !daysOfWeek.includes(0) && !daysOfWeek.includes(6)) return 'Every weekday';
  return `Every ${daysOfWeek.map(d => dayNames[d]).join(', ')}`;
}

export async function GET(req: NextRequest) {
  try {
    await requireAuth(['ADMIN']);
    await connectDB();

    const { searchParams } = new URL(req.url);
    const resourceId = searchParams.get('resourceId');

    const query: BlockQuery = {};
    if (resourceId) {
      query.resourceId = resourceId;
    }

    const blocks = await Block.find(query).sort({ start: 1 });

    return NextResponse.json({ blocks });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAuth(['ADMIN']);
    await connectDB();

    const body = await req.json();
    const {
      resourceId,
      start,
      end,
      reason,
      type,
      // Recurring block params
      isRecurring,
      recurrenceDays,
      recurrenceEndDate,
      startTime,
      endTime,
    } = body;

    if (!resourceId || !reason || !type) {
      throw new ValidationError('Missing required fields');
    }

    // Get resource name for audit log
    const resource = await Resource.findById(resourceId);

    // Handle recurring blocks
    if (isRecurring && recurrenceDays?.length > 0 && recurrenceEndDate) {
      const recurringGroupId = crypto.randomUUID();
      const patternDescription = getPatternDescription(recurrenceDays);

      const blockStartDate = new Date(start);
      const blockEndDate = new Date(recurrenceEndDate);

      // Get all dates matching the recurrence pattern
      const dates = getRecurringDates(blockStartDate, blockEndDate, recurrenceDays);

      if (dates.length === 0) {
        throw new ValidationError('No dates match the specified pattern');
      }

      if (dates.length > 365) {
        throw new ValidationError('Cannot create more than 365 blocks at once. Please reduce the date range.');
      }

      // Create blocks for each date
      const blocksToCreate = dates.map(date => {
        // Apply the time from the original start/end to each date
        const blockStart = new Date(date);
        const blockEnd = new Date(date);

        // Parse times (format: "HH:MM")
        if (startTime && endTime) {
          const [startHour, startMin] = startTime.split(':').map(Number);
          const [endHour, endMin] = endTime.split(':').map(Number);
          blockStart.setHours(startHour, startMin, 0, 0);
          blockEnd.setHours(endHour, endMin, 0, 0);
        } else {
          // Fallback to original start/end times
          const origStart = new Date(start);
          const origEnd = new Date(end);
          blockStart.setHours(origStart.getHours(), origStart.getMinutes(), 0, 0);
          blockEnd.setHours(origEnd.getHours(), origEnd.getMinutes(), 0, 0);
        }

        return {
          resourceId,
          start: blockStart,
          end: blockEnd,
          reason,
          type,
          createdBy: admin.id,
          recurringGroupId,
          recurringPattern: patternDescription,
        };
      });

      const createdBlocks = await Block.insertMany(blocksToCreate);

      // Cancel overlapping bookings for all created blocks
      let totalCancelledBookings = 0;
      for (const block of createdBlocks) {
        // Find bookings to cancel first to handle group booking consistency
        const bookingsToCancel = await Booking.find({
          resourceId,
          status: { $in: ['CONFIRMED', 'PENDING', 'CHECKED_IN'] },
          start: { $lt: block.end },
          end: { $gt: block.start },
        });

        if (bookingsToCancel.length > 0) {
          const bookingIdsToCancel = bookingsToCancel.map(b => b._id);
          
          await Booking.updateMany(
            { _id: { $in: bookingIdsToCancel } },
            { $set: { status: 'CANCELLED' } }
          );

          // FIX: Handle group booking consistency
          const groupBookingIds = bookingsToCancel
            .filter(b => b.isGroupBooking && b.groupBookingId)
            .map(b => b.groupBookingId);

          if (groupBookingIds.length > 0) {
            const { GroupBooking } = await import('@/models/GroupBooking');
            await GroupBooking.updateMany(
              { _id: { $in: groupBookingIds } },
              { $set: { status: 'CANCELLED' } }
            );
          }

          totalCancelledBookings += bookingsToCancel.length;
        }
      }

      // Log audit event for recurring block creation
      await logAuditEvent({
        action: 'CREATE_RECURRING_BLOCK',
        actor: getActorFromSession(admin),
        target: {
          type: 'BLOCK',
          id: recurringGroupId,
          name: resource?.name || 'Unknown Resource',
        },
        details: {
          resourceId,
          reason,
          blockType: type,
          pattern: patternDescription,
          blocksCreated: createdBlocks.length,
          cancelledBookings: totalCancelledBookings,
          startDate: blockStartDate,
          endDate: blockEndDate,
        },
      });

      return NextResponse.json({
        blocks: createdBlocks,
        count: createdBlocks.length,
        recurringGroupId,
        pattern: patternDescription,
      }, { status: 201 });
    }

    // Handle single block (original logic)
    if (!start || !end) {
      throw new ValidationError('Missing start or end date');
    }

    const block = await Block.create({
      resourceId,
      start: new Date(start),
      end: new Date(end),
      reason,
      type,
      createdBy: admin.id,
    });

    // Cancel overlapping active bookings for the blocked resource
    // Find bookings to cancel first to handle group booking consistency
    const bookingsToCancel = await Booking.find({
      resourceId,
      status: { $in: ['CONFIRMED', 'PENDING', 'CHECKED_IN'] },
      start: { $lt: new Date(end) },
      end: { $gt: new Date(start) },
    });

    let cancelledCount = 0;
    if (bookingsToCancel.length > 0) {
      const bookingIdsToCancel = bookingsToCancel.map(b => b._id);
      
      await Booking.updateMany(
        { _id: { $in: bookingIdsToCancel } },
        { $set: { status: 'CANCELLED' } }
      );

      // FIX: Handle group booking consistency
      const groupBookingIds = bookingsToCancel
        .filter(b => b.isGroupBooking && b.groupBookingId)
        .map(b => b.groupBookingId);

      if (groupBookingIds.length > 0) {
        const { GroupBooking } = await import('@/models/GroupBooking');
        await GroupBooking.updateMany(
          { _id: { $in: groupBookingIds } },
          { $set: { status: 'CANCELLED' } }
        );
      }
      cancelledCount = bookingsToCancel.length;
    }

    // Log audit event
    await logAuditEvent({
      action: 'CREATE_BLOCK',
      actor: getActorFromSession(admin),
      target: {
        type: 'BLOCK',
        id: block._id.toString(),
        name: resource?.name || 'Unknown Resource',
      },
      details: {
        resourceId,
        reason,
        blockType: type,
        start: block.start,
        end: block.end,
        cancelledBookings: cancelledCount,
      },
    });

    return NextResponse.json({ block }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
