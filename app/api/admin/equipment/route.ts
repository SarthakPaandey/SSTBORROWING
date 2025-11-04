import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { EquipmentItem } from '@/models/EquipmentItem';
import { requireAuth } from '@/lib/auth/guards';

export async function GET(req: NextRequest) {
  try {
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
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to fetch equipment' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAuth(['ADMIN']);
    await connectDB();

    const body = await req.json();
    const item = await EquipmentItem.create(body);

    return NextResponse.json({ item }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to create equipment item' },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    await requireAuth(['ADMIN']);
    await connectDB();

    const { id, qtyTotal, qtyAvailable } = await req.json();

    const item = await EquipmentItem.findById(id);
    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    if (qtyTotal !== undefined) item.qtyTotal = qtyTotal;
    if (qtyAvailable !== undefined) item.qtyAvailable = qtyAvailable;

    await item.save();

    return NextResponse.json({ item });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to update equipment' },
      { status: 500 }
    );
  }
}
