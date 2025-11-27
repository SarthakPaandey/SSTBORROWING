import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { EquipmentItem } from '@/models/EquipmentItem';
import { requireAuth } from '@/lib/auth/guards';
import { handleApiError, NotFoundError } from '@/lib/errors';
import { getAvailableQuantity } from '@/lib/inventory';
import { getNow } from '@/lib/timezone';

export async function GET(req: NextRequest) {
  try {
    // Allow all authenticated users to view equipment
    await requireAuth();
    await connectDB();

    const { searchParams } = new URL(req.url);
    const resourceId = searchParams.get('resourceId');
    const startParam = searchParams.get('start');
    const endParam = searchParams.get('end');

    const query: any = {};
    if (resourceId) {
      query.resourceId = resourceId;
    }

    const items = await EquipmentItem.find(query).sort({ name: 1 });

    // Calculate availability based on time window if provided, otherwise use "now"
    let start: Date, end: Date;
    if (startParam && endParam) {
      start = new Date(startParam);
      end = new Date(endParam);
    } else {
      // Default to current hour if no time specified
      const now = getNow();
      start = now;
      end = new Date(now.getTime() + 60 * 60 * 1000); // +1 hour
    }

    // Calculate dynamic availability for each item
    const itemsWithAvailability = await Promise.all(
      items.map(async (item) => {
        const availableNow = await getAvailableQuantity(
          item._id.toString(),
          start,
          end,
          item.qtyTotal
        );

        return {
          ...item.toObject(),
          availableNow,
          // Keep qtyReserved for backward compatibility but don't use it for display
          qtyReserved: item.qtyReserved || 0
        };
      })
    );

    return NextResponse.json({ items: itemsWithAvailability });
  } catch (error) {
    console.error('Equipment fetch error:', error);
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAuth(['ADMIN']);
    await connectDB();

    const body = await req.json();
    const item = await EquipmentItem.create(body);

    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    await requireAuth(['ADMIN']);
    await connectDB();

    // FIX: Accept both 'id' and 'itemId' for backwards compatibility
    const body = await req.json();
    const itemId = body.id || body.itemId;
    const { name, qtyTotal, qtyAvailable, safety, restricted } = body;

    if (!itemId) {
      throw new NotFoundError('Item ID is required');
    }

    const item = await EquipmentItem.findById(itemId);
    if (!item) {
      throw new NotFoundError('Item');
    }

    // Update all provided fields
    if (name !== undefined) item.name = name;
    if (qtyTotal !== undefined) item.qtyTotal = qtyTotal;
    if (qtyAvailable !== undefined) item.qtyAvailable = qtyAvailable;
    if (safety !== undefined) item.safety = safety;
    if (restricted !== undefined) item.restricted = restricted;

    await item.save();

    return NextResponse.json({ item });
  } catch (error) {
    return handleApiError(error);
  }
}
