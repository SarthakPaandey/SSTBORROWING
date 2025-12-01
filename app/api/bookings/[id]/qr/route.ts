import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Booking } from '@/models/Booking';
import { QRToken } from '@/models/QRToken';
import { requireAuth } from '@/lib/auth/guards';
import { generateQRToken, generateQRCodeImage } from '@/lib/qr';
import { POLICIES } from '@/lib/policies';
import { handleApiError, NotFoundError, AuthorizationError, ValidationError, ConflictError } from '@/lib/errors';
import { getNow, getTodayStart } from '@/lib/timezone';
import mongoose from 'mongoose';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth();
    await connectDB();

    // FIX: Validate ObjectId to prevent MongoDB CastError
    if (!mongoose.Types.ObjectId.isValid(params.id)) {
      throw new ValidationError('Invalid booking ID format');
    }

    const booking = await Booking.findById(params.id);

    if (!booking) {
      throw new NotFoundError('Booking');
    }

    // Check ownership - for group bookings, only organizer can generate QR
    if (booking.isGroupBooking) {
      const { GroupBooking } = await import('@/models/GroupBooking');
      const groupBooking = await GroupBooking.findById(booking.groupBookingId);

      if (!groupBooking || groupBooking.organizerId !== user.id) {
        throw new AuthorizationError('Only the organizer can generate QR code for group bookings');
      }

      // Check if group booking is confirmed
      if (groupBooking.status !== 'CONFIRMED') {
        throw new ValidationError(`Group booking is ${groupBooking.status}. Cannot generate QR until confirmed.`);
      }
    } else {
      // Regular booking - check ownership
      if (booking.userId !== user.id) {
        throw new AuthorizationError();
      }
    }

    // Restrict QR to equipment and library bookings only
    if (booking.kind !== 'EQUIPMENT' && booking.kind !== 'LIBRARY') {
      throw new ValidationError('QR codes are only available for equipment/book pickup');
    }

    // Check if booking is confirmed or approved
    if (booking.status === 'PENDING' && booking.approval !== 'APPROVED') {
      throw new ValidationError('Booking requires approval before QR can be issued');
    }

    if (!['CONFIRMED', 'PENDING'].includes(booking.status)) {
      throw new ValidationError('Booking must be confirmed to generate QR');
    }


    // QR generation time window with grace periods
    const now = new Date(); // UTC
    const bookingEnd = new Date(booking.end).getTime();
    const bookingStart = new Date(booking.start).getTime();

    // Use policy for QR validity window (set to 1440 min / 24 hours for testing)
    const GRACE_PERIOD_MS = POLICIES.QR_VALIDITY_BEFORE_START * 60 * 1000;

    // Allow QR generation:
    // - Starting GRACE_PERIOD_MS before booking start (24 hours in testing mode)
    // - Up to 15 minutes AFTER booking start (grace period for pickup)
    const earliestGenTime = bookingStart - GRACE_PERIOD_MS;
    const latestGenTime = bookingStart + (15 * 60 * 1000); // 15 min after START

    if (now.getTime() < earliestGenTime) {
      throw new ValidationError(`QR code can be generated starting ${POLICIES.QR_VALIDITY_BEFORE_START} minutes before your booking time`);
    }

    if (now.getTime() > latestGenTime) {
      throw new ValidationError('QR generation window closed. Must generate within 15 minutes of booking start time.');
    }

    // Check if already has valid QR for THIS specific booking
    // This prevents confusion when user has multiple bookings
    const existingToken = await QRToken.findOne({
      bookingId: params.id,
      used: false,
      expiresAt: { $gt: new Date() }, // Use UTC for DB comparison
    }).sort({ createdAt: -1 }); // Get most recent if multiple exist

    if (existingToken) {
      const qrImage = await generateQRCodeImage(existingToken.token);
      return NextResponse.json({
        token: existingToken.token,
        qrImage,
        expiresAt: existingToken.expiresAt,
      });
    }

    // Check QR generation limit (2 per day) - using IST timezone for accurate day boundaries
    const todayStart = getTodayStart();

    const generatedTodayCount = await QRToken.countDocuments({
      bookingId: params.id,
      createdAt: { $gte: todayStart },
    });

    if (generatedTodayCount >= 2) {
      throw new ConflictError('QR code generation limit reached. Maximum 2 QR codes per day per booking.');
    }

    // Generate new QR token (equipment/library)
    const expiryMinutes = POLICIES.QR_EQUIPMENT_PICKUP_WINDOW; // 10 minutes

    const token = generateQRToken(
      params.id,
      user.id,
      expiryMinutes
    );

    // QR expires exactly 10 minutes after generation
    // This provides sufficient time for guard pickup while maintaining security
    const expiresAt = new Date(now.getTime() + expiryMinutes * 60000);

    // Save token to DB - FIX: Include userId (required after EC-69)
    await QRToken.create({
      bookingId: params.id,
      userId: user.id,
      token,
      expiresAt,
      used: false,
    });

    // Update booking
    booking.qrIssued = true;
    await booking.save();

    // Generate QR code image
    const qrImage = await generateQRCodeImage(token);

    return NextResponse.json({
      token,
      qrImage,
      expiresAt,
    });
  } catch (error) {
    console.error('QR generation error:', error);
    return handleApiError(error);
  }
}
