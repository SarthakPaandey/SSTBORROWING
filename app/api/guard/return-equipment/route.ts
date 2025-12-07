import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { requireAuth } from '@/lib/auth/guards';
import { handleApiError, AuthorizationError, ValidationError } from '@/lib/errors';
import mongoose from 'mongoose';
import { processReturn } from '@/lib/returns';

export async function POST(req: NextRequest) {
  let session: mongoose.ClientSession | null = null;

  try {
    // Must connect to DB before starting a session
    await connectDB();
    session = await mongoose.startSession();

    const guard = await requireAuth(['GUARD', 'ADMIN']);

    const { bookingId, condition, notes } = await req.json();

    if (!bookingId) {
      throw new ValidationError('Booking ID required');
    }

    // FIX EC-2: Validate ObjectId to prevent MongoDB CastError
    if (!mongoose.Types.ObjectId.isValid(bookingId)) {
      throw new ValidationError('Invalid booking ID format');
    }

    if (!condition) {
      throw new ValidationError('Condition required');
    }

    // Start transaction for atomicity
    await session.startTransaction();

    // Shared return helper handles inventory restore, penalties, and audit fields
    const { booking, penaltyApplied } = await processReturn({
      bookingId,
      condition,
      notes,
      returnedBy: guard.id,
      session,
    });

    await session.commitTransaction();

    const itemType = booking.kind === 'LIBRARY' ? 'Book' : 'Equipment';
    return NextResponse.json({
      success: true,
      booking,
      penaltyApplied,
      message: penaltyApplied
        ? `${itemType} returned with penalty applied`
        : `${itemType} returned successfully`,
    });
  } catch (error) {
    if (session?.inTransaction()) {
      await session.abortTransaction();
    }
    console.error('Return error:', error);
    return handleApiError(error);
  } finally {
    if (session) {
      session.endSession();
    }
  }
}
