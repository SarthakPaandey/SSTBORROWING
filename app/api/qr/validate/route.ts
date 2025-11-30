import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { QRToken } from '@/models/QRToken';
import { Booking } from '@/models/Booking';
import { EquipmentItem } from '@/models/EquipmentItem';
import { User } from '@/models/User';
import { Resource } from '@/models/Resource';
import { requireAuth } from '@/lib/auth/guards';
import { verifyQRToken } from '@/lib/qr';
import { handleApiError, ValidationError, NotFoundError, ConflictError } from '@/lib/errors';
import mongoose from 'mongoose';
import { getNow } from '@/lib/timezone';

export async function POST(req: NextRequest) {
  const session = await mongoose.startSession();

  try {
    await requireAuth(['GUARD', 'ADMIN']);
    const conn = await connectDB();

    const { token } = await req.json();

    if (!token) {
      throw new ValidationError('Token required');
    }

    // Verify token signature and expiry
    const verification = verifyQRToken(token);
    if (!verification.valid || !verification.payload) {
      throw new ValidationError(verification.error || 'Invalid token');
    }

    // Start transaction for atomicity
    await session.startTransaction();

    // Check DB for token
    const dbToken = await QRToken.findOne({ token }).session(session);
    if (!dbToken) {
      await session.abortTransaction();
      throw new NotFoundError('Token');
    }

    if (dbToken.used) {
      await session.abortTransaction();
      throw new ConflictError('Token already used');
    }

    if (new Date().getTime() > new Date(dbToken.expiresAt).getTime()) {
      await session.abortTransaction();
      throw new ValidationError('Token expired');
    }

    // Get booking
    const booking = await Booking.findById(dbToken.bookingId).session(session);
    if (!booking) {
      await session.abortTransaction();
      throw new NotFoundError('Booking');
    }

    // Only equipment and library bookings can be validated via QR
    if (booking.kind !== 'EQUIPMENT' && booking.kind !== 'LIBRARY') {
      await session.abortTransaction();
      throw new ValidationError('QR validation is only allowed for equipment/book pickup');
    }

    // Check if already checked in (prevent double check-in)
    if (booking.status === 'CHECKED_IN') {
      await session.abortTransaction();
      throw new ConflictError('Equipment already checked in');
    }

    // Check if booking is in valid state
    if (!['CONFIRMED', 'PENDING'].includes(booking.status)) {
      await session.abortTransaction();
      throw new ValidationError('Booking is not in a valid state for check-in');
    }

    // EC-12: Check if the booking owner (student) is currently suspended
    // FIX: userId is email address, not ObjectId
    const bookingOwner = await User.findOne({ email: booking.userId }).session(session);
    if (!bookingOwner) {
      await session.abortTransaction();
      throw new NotFoundError('Booking owner');
    }

    if (bookingOwner.suspendedUntil && bookingOwner.suspendedUntil > getNow()) {
      await session.abortTransaction();
      throw new ValidationError('User is currently suspended and cannot pick up equipment');
    }

    // EC-13: Check if the resource is still active
    const resource = await Resource.findById(booking.resourceId).session(session);
    if (!resource) {
      await session.abortTransaction();
      throw new NotFoundError('Resource');
    }

    if (resource.status !== 'ACTIVE') {
      await session.abortTransaction();
      throw new ValidationError('Resource is currently inactive and cannot be checked in');
    }

    // Mark token as used
    dbToken.used = true;
    dbToken.usedAt = new Date(); // Use UTC for DB consistency
    await dbToken.save({ session });

    // Issue equipment - decrement physical availability only
    // qtyReserved is no longer used for blocking (time-based overlap checking instead)
    if (booking.items) {
      for (const item of booking.items) {
        // Use atomic update to prevent race conditions
        const result = await EquipmentItem.findOneAndUpdate(
          {
            _id: item.itemId,
            qtyAvailable: { $gte: item.qty }, // Ensure sufficient stock
          },
          {
            $inc: {
              qtyAvailable: -item.qty,  // Physical removal from shelf
            },
          },
          {
            session,
            new: true,
          }
        );

        if (!result) {
          await session.abortTransaction();
          const equipItem = await EquipmentItem.findById(item.itemId);
          throw new ConflictError(
            `Insufficient inventory for ${equipItem?.name || 'item'}. Available: ${equipItem?.qtyAvailable || 0}, Required: ${item.qty}`
          );
        }
      }
    }

    booking.status = 'CHECKED_IN';
    booking.checkedInAt = new Date(); // Use UTC for DB consistency
    await booking.save({ session });

    // Commit transaction
    await session.commitTransaction();

    return NextResponse.json({
      success: true,
      booking: {
        id: booking._id,
        userId: booking.userId,
        kind: booking.kind,
        status: booking.status,
        items: booking.items,
      },
    });
  } catch (error) {
    // Abort transaction on error
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    console.error('QR validation error:', error);
    return handleApiError(error);
  } finally {
    // End session
    session.endSession();
  }
}
