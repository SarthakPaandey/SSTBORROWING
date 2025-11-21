import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { EquipmentItem } from '@/models/EquipmentItem';
import { requireAuth } from '@/lib/auth/guards';
import { handleApiError, NotFoundError } from '@/lib/errors';

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
      throw new NotFoundError('Equipment item');
    }

    return NextResponse.json({ item });
  } catch (error) {
    return handleApiError(error);
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
      throw new NotFoundError('Equipment item');
    }

    return NextResponse.json({ success: true, message: 'Equipment item deleted' });
  } catch (error) {
    return handleApiError(error);
  }
}
