import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Booking } from '@/models/Booking';
import { QRToken } from '@/models/QRToken';
import { requireAuth } from '@/lib/auth/guards';
import { generateQRToken, generateQRCodeImage } from '@/lib/qr';
import { POLICIES } from '@/lib/policies';
import { handleApiError, NotFoundError, AuthorizationError, ValidationError, ConflictError } from '@/lib/errors';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth();
    await connectDB();

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

    // Check if booking time has passed
    const now = new Date();
    if (now > booking.end) {
      throw new ValidationError('Cannot generate QR for past bookings');
    }

    // Check if too early (before pickup window) - only in production
    if (process.env.NODE_ENV === 'production') {
      const pickupWindow = new Date(booking.start);
      pickupWindow.setMinutes(pickupWindow.getMinutes() - POLICIES.QR_VALIDITY_BEFORE_START);
      if (now < pickupWindow) {
        throw new ValidationError(`QR code can only be generated ${POLICIES.QR_VALIDITY_BEFORE_START} minutes before booking start time`);
      }
    }

    // Check if already has valid QR for THIS specific booking
    // This prevents confusion when user has multiple bookings
    const existingToken = await QRToken.findOne({
      bookingId: params.id,
      used: false,
      expiresAt: { $gt: new Date() },
    }).sort({ createdAt: -1 }); // Get most recent if multiple exist

    if (existingToken) {
      const qrImage = await generateQRCodeImage(existingToken.token);
      return NextResponse.json({
        token: existingToken.token,
        qrImage,
        expiresAt: existingToken.expiresAt,
      });
    }

    // Check QR generation limit (2 per day)
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const generatedTodayCount = await QRToken.countDocuments({
      bookingId: params.id,
      createdAt: { $gte: todayStart },
    });

    if (generatedTodayCount >= 2) {
      throw new ConflictError('QR code generation limit reached. Maximum 2 QR codes per day per booking.');
    }

    // Generate new QR token (equipment only)
    const expiryMinutes = POLICIES.QR_EQUIPMENT_PICKUP_WINDOW;

    const token = generateQRToken(
      params.id,
      user.id,
      Math.max(expiryMinutes, 10)
    );

    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + Math.max(expiryMinutes, 10));

    // Save token to DB
    await QRToken.create({
      bookingId: params.id,
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
