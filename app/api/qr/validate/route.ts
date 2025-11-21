import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { QRToken } from '@/models/QRToken';
import { Booking } from '@/models/Booking';
import { EquipmentItem } from '@/models/EquipmentItem';
import { requireAuth } from '@/lib/auth/guards';
import { verifyQRToken } from '@/lib/qr';
import { handleApiError, ValidationError, NotFoundError, ConflictError } from '@/lib/errors';

export async function POST(req: NextRequest) {
  try {
    await requireAuth(['GUARD', 'ADMIN']);
    await connectDB();

    const { token } = await req.json();

    if (!token) {
      throw new ValidationError('Token required');
    }

    // Verify token signature and expiry
    const verification = verifyQRToken(token);
    if (!verification.valid || !verification.payload) {
      throw new ValidationError(verification.error || 'Invalid token');
    }

    // Check DB for token
    const dbToken = await QRToken.findOne({ token });
    if (!dbToken) {
      throw new NotFoundError('Token');
    }

    if (dbToken.used) {
      throw new ConflictError('Token already used');
    }

    if (new Date() > dbToken.expiresAt) {
      throw new ValidationError('Token expired');
    }

    // Get booking
    const booking = await Booking.findById(dbToken.bookingId);
    if (!booking) {
      throw new NotFoundError('Booking');
    }

    // Only equipment and library bookings can be validated via QR
    if (booking.kind !== 'EQUIPMENT' && booking.kind !== 'LIBRARY') {
      throw new ValidationError('QR validation is only allowed for equipment/book pickup');
    }

    // Check if already checked in (prevent double check-in)
    if (booking.status === 'CHECKED_IN') {
      throw new ConflictError('Equipment already checked in');
    }

    // Check if booking is in valid state
    if (!['CONFIRMED', 'PENDING'].includes(booking.status)) {
      throw new ValidationError('Booking is not in a valid state for check-in');
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
          // Safety check: prevent negative inventory
          if (equipItem.qtyAvailable < item.qty) {
            throw new ConflictError(`Insufficient inventory for ${equipItem.name}. Available: ${equipItem.qtyAvailable}, Required: ${item.qty}`);
          }
          equipItem.qtyAvailable -= item.qty;
          await equipItem.save();
        }
      }
    }
    booking.status = 'CHECKED_IN';
    booking.checkedInAt = new Date();

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
  } catch (error) {
    console.error('QR validation error:', error);
    return handleApiError(error);
  }
}
