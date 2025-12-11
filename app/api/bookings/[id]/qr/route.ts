import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Booking } from '@/models/Booking';
import { QRToken } from '@/models/QRToken';
import { requireAuth } from '@/lib/auth/guards';
import { generateQRToken, generateQRCodeImage } from '@/lib/qr';
import { POLICIES } from '@/lib/policies';
import { handleApiError, NotFoundError, AuthorizationError, ValidationError, ConflictError } from '@/lib/errors';
import mongoose from 'mongoose';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  let session: mongoose.ClientSession | null = null;
  try {
    const user = await requireAuth();
    await connectDB();
    session = await mongoose.startSession();
    await session.startTransaction();
    // Keep reads/writes within one transaction so concurrent requests can't mint duplicate tokens

    // FIX: Validate ObjectId to prevent MongoDB CastError
    if (!mongoose.Types.ObjectId.isValid(params.id)) {
      throw new ValidationError('Invalid booking ID format');
    }

    const booking = await Booking.findById(params.id).session(session);

    if (!booking) {
      throw new NotFoundError('Booking');
    }

    // Check ownership - for group bookings, only organizer can generate QR
    if (booking.isGroupBooking) {
      const { GroupBooking } = await import('@/models/GroupBooking');
      const groupBooking = await GroupBooking.findById(booking.groupBookingId).session(session);

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
      throw new ValidationError('Booking is pending admin approval. QR code cannot be generated until approved.');
    }

    if (!['CONFIRMED', 'PENDING'].includes(booking.status)) {
      throw new ValidationError(`Cannot generate QR code. Booking status is ${booking.status}. QR codes can only be generated for confirmed or approved bookings.`);
    }


    // QR generation time window with grace periods
    const now = new Date(); // UTC
    const bookingEnd = new Date(booking.end).getTime();
    const bookingStart = new Date(booking.start).getTime();

    // Detect instant checkout: booking start is within 5 minutes of "now" (or in the past)
    // This happens when user books from Equipment page (start = now) vs Facility page (start = future slot)
    const isInstantCheckout = (booking.kind === 'EQUIPMENT' || booking.kind === 'LIBRARY')
      && (bookingStart - now.getTime() <= 5 * 60 * 1000);

    // For instant checkout: allow QR generation immediately (no early restriction)
    // For advance bookings: use standard policy window (QR_VALIDITY_BEFORE_START minutes before)
    const GRACE_PERIOD_MS = isInstantCheckout
      ? Math.max(0, bookingStart - now.getTime()) + 60 * 1000  // Allow immediately (with 1 min buffer)
      : POLICIES.QR_VALIDITY_BEFORE_START * 60 * 1000;         // Standard policy window

    // Allow QR generation:
    // - Starting GRACE_PERIOD_MS before booking start
    // - Up to QR_VALIDITY_AFTER_START minutes AFTER booking start (grace period for pickup)
    const earliestGenTime = bookingStart - GRACE_PERIOD_MS;
    const latestGenTime = bookingStart + (POLICIES.QR_VALIDITY_AFTER_START * 60 * 1000);

    if (now.getTime() < earliestGenTime) {
      const minutesUntil = Math.ceil((earliestGenTime - now.getTime()) / (60 * 1000));
      throw new ValidationError(`QR code can be generated starting ${POLICIES.QR_VALIDITY_BEFORE_START} minutes before your booking time. Please wait ${minutesUntil} more minutes.`);
    }

    if (now.getTime() > latestGenTime) {
      throw new ValidationError(`QR generation window closed. Must generate within ${POLICIES.QR_VALIDITY_AFTER_START} minutes of booking start time.`);
    }


    // Clean up any expired or used tokens for this booking to prevent confusion
    // This helps avoid "Token already used" errors when users accidentally scan old QRs
    await QRToken.deleteMany({
      bookingId: params.id,
      $or: [
        { used: true },
        { expiresAt: { $lt: new Date() } }
      ]
    }).session(session);

    // Check if already has valid QR for THIS specific booking
    // This prevents confusion when user has multiple bookings
    const existingToken = await QRToken.findOne({
      bookingId: params.id,
      used: false,
      expiresAt: { $gt: new Date() }, // Use UTC for DB comparison
    }).session(session).sort({ createdAt: -1 }); // Get most recent if multiple exist

    if (existingToken) {
      const qrImage = await generateQRCodeImage(existingToken.token);

      await session.commitTransaction();
      session.endSession();

      return NextResponse.json({
        token: existingToken.token,
        qrImage,
        expiresAt: existingToken.expiresAt,
      });
    }


    // Check QR generation limit (2 per UTC day) - avoid IST-shifted dates in DB queries
    const todayUtcStart = new Date();
    todayUtcStart.setUTCHours(0, 0, 0, 0);

    const generatedTodayCount = await QRToken.countDocuments({
      bookingId: params.id,
      createdAt: { $gte: todayUtcStart },
    }).session(session);

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
    await QRToken.create([{
      bookingId: params.id,
      userId: user.id,
      token,
      expiresAt,
      used: false,
    }], { session });

    // Update booking
    booking.qrIssued = true;
    await booking.save({ session });

    // Generate QR code image
    const qrImage = await generateQRCodeImage(token);

    await session.commitTransaction();
    session.endSession();

    return NextResponse.json({
      token,
      qrImage,
      expiresAt,
    });
  } catch (error) {
    if (session?.inTransaction()) {
      await session.abortTransaction();
    }
    session?.endSession();
    if ((error as any)?.name === 'MongoError' && (error as any).code === 112) {
      console.error('QR token transaction error:', error);
    }
    console.error('QR generation error:', error);
    return handleApiError(error);
  }
}
