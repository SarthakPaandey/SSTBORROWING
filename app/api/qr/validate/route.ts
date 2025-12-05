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
import { parseStudentEmail } from '@/lib/utils';
import mongoose from 'mongoose';

export async function POST(req: NextRequest) {
  let session: mongoose.ClientSession | null = null;

  try {
    // Must connect to DB before starting a session
    await connectDB();
    session = await mongoose.startSession();

    await requireAuth(['GUARD', 'ADMIN']);

    const { token } = await req.json();

    if (!token) {
      throw new ValidationError('Token required');
    }

    // Verify token signature and expiry
    const verification = verifyQRToken(token);
    if (!verification.valid || !verification.payload) {
      console.warn(`QR token verification failed: ${verification.error}`);
      throw new ValidationError(verification.error || 'Invalid token');
    }

    console.log(`QR validation started for booking: ${verification.payload.bid}, user: ${verification.payload.uid}`);

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
      const usedAtStr = dbToken.usedAt ? new Date(dbToken.usedAt).toISOString() : 'unknown time';
      console.warn(`QR scan attempted with already-used token. BookingId: ${dbToken.bookingId}, UsedAt: ${usedAtStr}`);
      throw new ConflictError(`This QR code was already scanned at ${usedAtStr}. Please generate a new QR code from your bookings page.`);
    }

    if (new Date().getTime() > new Date(dbToken.expiresAt).getTime()) {
      await session.abortTransaction();
      console.warn(`QR scan attempted with expired token. BookingId: ${dbToken.bookingId}, ExpiredAt: ${new Date(dbToken.expiresAt).toISOString()}`);
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
      console.warn(`QR validation failed: invalid booking status. BookingId: ${booking._id}, Status: ${booking.status}`);
      throw new ValidationError('Booking is not in a valid state for check-in');
    }

    // EC-12: Check if the booking owner (student) is currently suspended
    // FIX: booking.userId is the ObjectId, not email
    const bookingOwner = await User.findById(booking.userId).session(session);
    if (!bookingOwner) {
      await session.abortTransaction();
      throw new NotFoundError('Booking owner');
    }

    // Compare against UTC timestamp stored in DB
    if (bookingOwner.suspendedUntil && bookingOwner.suspendedUntil > new Date()) {
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

    console.log(`QR validation successful. BookingId: ${booking._id}, UserId: ${booking.userId}, Status: ${booking.status}`);

    // Get resource name for display
    const resourceName = resource?.name || 'Unknown Resource';

    // Extract roll number from email (format: name.rollnumber@domain.com)
    const studentInfo = parseStudentEmail(bookingOwner.email);

    return NextResponse.json({
      success: true,
      booking: {
        id: booking._id,
        kind: booking.kind,
        status: booking.status,
        items: booking.items,
        resourceName,
        returnBy: booking.end, // When equipment should be returned
      },
      student: {
        id: bookingOwner._id,
        name: bookingOwner.name,
        email: bookingOwner.email,
        rollNumber: studentInfo?.rollNumber || null, // Extracted from email
      },
    });
  } catch (error) {
    // Abort transaction on error
    if (session?.inTransaction()) {
      await session.abortTransaction();
    }
    console.error('QR validation error:', error);
    return handleApiError(error);
  } finally {
    // End session if it was created
    if (session) {
      session.endSession();
    }
  }
}
