import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Booking } from '@/models/Booking';
import { QRToken } from '@/models/QRToken';
import { requireAuth } from '@/lib/auth/guards';
import { generateQRToken, generateQRCodeImage } from '@/lib/qr';
import { POLICIES } from '@/lib/policies';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireAuth();
    await connectDB();

    const booking = await Booking.findById(params.id);

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    // Check ownership - for group bookings, only organizer can generate QR
    if (booking.isGroupBooking) {
      const { GroupBooking } = await import('@/models/GroupBooking');
      const groupBooking = await GroupBooking.findById(booking.groupBookingId);

      if (!groupBooking || groupBooking.organizerId !== user.id) {
        return NextResponse.json(
          { error: 'Only the organizer can generate QR code for group bookings' },
          { status: 403 }
        );
      }

      // Check if group booking is confirmed
      if (groupBooking.status !== 'CONFIRMED') {
        return NextResponse.json(
          { error: `Group booking is ${groupBooking.status}. Cannot generate QR until confirmed.` },
          { status: 400 }
        );
      }
    } else {
      // Regular booking - check ownership
      if (booking.userId !== user.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    // Restrict QR to equipment and library bookings only
    if (booking.kind !== 'EQUIPMENT' && booking.kind !== 'LIBRARY') {
      return NextResponse.json(
        { error: 'QR codes are only available for equipment/book pickup' },
        { status: 400 }
      );
    }

    // Check if booking is confirmed or approved
    if (booking.status === 'PENDING' && booking.approval !== 'APPROVED') {
      return NextResponse.json(
        { error: 'Booking requires approval before QR can be issued' },
        { status: 400 }
      );
    }

    if (!['CONFIRMED', 'PENDING'].includes(booking.status)) {
      return NextResponse.json(
        { error: 'Booking must be confirmed to generate QR' },
        { status: 400 }
      );
    }

    // Check if booking time has passed
    const now = new Date();
    if (now > booking.end) {
      return NextResponse.json(
        { error: 'Cannot generate QR for past bookings' },
        { status: 400 }
      );
    }

    // Check if too early (before pickup window) - only in production
    if (process.env.NODE_ENV === 'production') {
      const pickupWindow = new Date(booking.start);
      pickupWindow.setMinutes(pickupWindow.getMinutes() - POLICIES.QR_VALIDITY_BEFORE_START);
      if (now < pickupWindow) {
        return NextResponse.json(
          { error: `QR code can only be generated ${POLICIES.QR_VALIDITY_BEFORE_START} minutes before booking start time` },
          { status: 400 }
        );
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
      return NextResponse.json(
        { error: 'QR code generation limit reached. Maximum 2 QR codes per day per booking.' },
        { status: 400 }
      );
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
  } catch (error: any) {
    console.error('QR generation error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate QR code' },
      { status: 500 }
    );
  }
}
