import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { EquipmentItem } from '@/models/EquipmentItem';
import { Booking } from '@/models/Booking';
import { User } from '@/models/User';
import { Resource } from '@/models/Resource';
import { requireAuth } from '@/lib/auth/guards';
import { handleApiError, ValidationError, NotFoundError, ConflictError } from '@/lib/errors';
import { parseStudentEmail } from '@/lib/utils';
import mongoose from 'mongoose';
import { getNow } from '@/lib/timezone';

/**
 * Process library book return by ISBN scan
 * Finds the active booking for the book and processes return
 */
export async function POST(req: NextRequest) {
  let session: mongoose.ClientSession | null = null;

  try {
    await connectDB();
    session = await mongoose.startSession();
    await requireAuth(['GUARD', 'ADMIN']);

    const { isbn } = await req.json();

    if (!isbn) {
      throw new ValidationError('ISBN is required');
    }

    // Normalize ISBN
    const normalizedIsbn = isbn.replace(/[-\s]/g, '');

    await session.startTransaction();

    // Find book by ISBN
    const book = await EquipmentItem.findOne({ isbn: normalizedIsbn }).session(session);
    if (!book) {
      await session.abortTransaction();
      throw new NotFoundError('Book with this ISBN not found in library');
    }

    // Find active booking for this book
    const now = getNow();
    const activeBooking = await Booking.findOne({
      'items.itemId': book._id,
      status: { $in: ['CHECKED_IN', 'CONFIRMED'] },
      start: { $lte: now },
      end: { $gte: now },
    })
      .populate('userId', 'name email')
      .session(session);

    if (!activeBooking) {
      await session.abortTransaction();
      throw new NotFoundError('No active booking found for this book');
    }

    // Check if already returned
    if (activeBooking.status === 'RETURNED' || activeBooking.status === 'COMPLETED') {
      await session.abortTransaction();
      throw new ConflictError('This book has already been returned');
    }

    // Verify booking is for library
    if (activeBooking.kind !== 'LIBRARY') {
      await session.abortTransaction();
      throw new ValidationError('This booking is not a library booking');
    }

    // Increment available quantity
    const itemInBooking = activeBooking.items.find(
      (item: any) => String(item.itemId) === String(book._id)
    );

    if (!itemInBooking) {
      await session.abortTransaction();
      throw new NotFoundError('Book item not found in booking');
    }

    // Update book availability
    await EquipmentItem.findByIdAndUpdate(
      book._id,
      {
        $inc: { qtyAvailable: itemInBooking.qty },
      },
      { session }
    );

    // Update booking status
    activeBooking.status = 'RETURNED';
    activeBooking.returnedAt = now;
    await activeBooking.save({ session });

    // Get resource name
    const resource = await Resource.findById(activeBooking.resourceId).session(session);
    const resourceName = resource?.name || 'Unknown Resource';

    // Get student info
    const student = await User.findById(activeBooking.userId).session(session);
    if (!student) {
      await session.abortTransaction();
      throw new NotFoundError('Student not found');
    }

    const studentInfo = parseStudentEmail(student.email);

    await session.commitTransaction();

    return NextResponse.json({
      success: true,
      booking: {
        id: activeBooking._id,
        kind: activeBooking.kind,
        status: activeBooking.status,
        resourceName,
        returnedAt: activeBooking.returnedAt,
      },
      book: {
        name: book.name,
        author: book.author,
        isbn: book.isbn,
      },
      student: {
        id: student._id,
        name: student.name,
        email: student.email,
        rollNumber: studentInfo?.rollNumber || null,
      },
    });
  } catch (error) {
    if (session?.inTransaction()) {
      await session.abortTransaction();
    }
    return handleApiError(error);
  } finally {
    if (session) {
      session.endSession();
    }
  }
}

