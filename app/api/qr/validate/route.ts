import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { QRToken } from '@/models/QRToken';
import { Booking } from '@/models/Booking';
import { EquipmentItem } from '@/models/EquipmentItem';
import { requireAuth } from '@/lib/auth/guards';
import { verifyQRToken } from '@/lib/qr';

export async function POST(req: NextRequest) {
  try {
    await requireAuth(['GUARD', 'ADMIN']);
    await connectDB();

    const { token } = await req.json();

    if (!token) {
      return NextResponse.json({ error: 'Token required' }, { status: 400 });
    }

    // Verify token signature and expiry
    const verification = verifyQRToken(token);
    if (!verification.valid || !verification.payload) {
      return NextResponse.json(
        { error: verification.error || 'Invalid token' },
        { status: 400 }
      );
    }

    // Check DB for token
    const dbToken = await QRToken.findOne({ token });
    if (!dbToken) {
      return NextResponse.json({ error: 'Token not found' }, { status: 404 });
    }

    if (dbToken.used) {
      return NextResponse.json(
        { error: 'Token already used' },
        { status: 400 }
      );
    }

    if (new Date() > dbToken.expiresAt) {
      return NextResponse.json({ error: 'Token expired' }, { status: 400 });
    }

    // Get booking
    const booking = await Booking.findById(dbToken.bookingId);
    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    // Only equipment bookings can be validated via QR
    if (booking.kind !== 'EQUIPMENT') {
      return NextResponse.json(
        { error: 'QR validation is only allowed for equipment pickup' },
        { status: 400 }
      );
    }

    // Mark token as used
    dbToken.used = true;
    dbToken.usedAt = new Date();
    await dbToken.save();

    // Issue equipment - decrement availability and mark checked in
    if (booking.items) {
      for (const item of booking.items) {
        const equipItem = await EquipmentItem.findById(item.itemId);
        if (equipItem) {
          equipItem.qtyAvailable -= item.qty;
          await equipItem.save();
        }
      }
    }
    booking.status = 'CHECKED_IN';

    await booking.save();

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
  } catch (error: any) {
    console.error('QR validation error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to validate QR code' },
      { status: 500 }
    );
  }
}
