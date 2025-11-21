import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Block } from '@/models/Block';
import { requireAuth } from '@/lib/auth/guards';
import { handleApiError, NotFoundError } from '@/lib/errors';

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAuth(['ADMIN']);
    await connectDB();

    const block = await Block.findById(params.id);

    if (!block) {
      throw new NotFoundError('Block');
    }

    await Block.findByIdAndDelete(params.id);

    return NextResponse.json({
      message: 'Block deleted successfully',
    });
  } catch (error) {
    console.error('Delete block error:', error);
    return handleApiError(error);
  }
}
