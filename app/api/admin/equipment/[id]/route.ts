import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { EquipmentItem } from '@/models/EquipmentItem';
import { requireAuth } from '@/lib/auth/guards';

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAuth(['ADMIN']);
    await connectDB();

    const body = await req.json();
    const item = await EquipmentItem.findByIdAndUpdate(
      params.id,
      body,
      { new: true, runValidators: true }
    );

    if (!item) {
      return NextResponse.json({ error: 'Equipment item not found' }, { status: 404 });
    }

    return NextResponse.json({ item });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to update equipment item' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAuth(['ADMIN']);
    await connectDB();

    const item = await EquipmentItem.findByIdAndDelete(params.id);

    if (!item) {
      return NextResponse.json({ error: 'Equipment item not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Equipment item deleted' });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to delete equipment item' },
      { status: 500 }
    );
  }
}
