import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { EquipmentItem } from '@/models/EquipmentItem';
import { requireAuth } from '@/lib/auth/guards';
import { handleApiError, NotFoundError } from '@/lib/errors';

export async function GET(req: NextRequest) {
  try {
    // Allow all authenticated users to view equipment
    await requireAuth();
    await connectDB();

    const { searchParams } = new URL(req.url);
    const resourceId = searchParams.get('resourceId');

    const query: any = {};
    if (resourceId) {
      query.resourceId = resourceId;
    }

    const items = await EquipmentItem.find(query).sort({ name: 1 });

    return NextResponse.json({ items });
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
