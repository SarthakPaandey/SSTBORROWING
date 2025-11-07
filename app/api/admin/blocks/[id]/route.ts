import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Block } from '@/models/Block';
import { requireAuth } from '@/lib/auth/guards';

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAuth(['ADMIN']);
    await connectDB();

    const block = await Block.findById(params.id);

    if (!block) {
      return NextResponse.json({ error: 'Block not found' }, { status: 404 });
    }

    await Block.findByIdAndDelete(params.id);

    return NextResponse.json({
      message: 'Block deleted successfully',
    });
  } catch (error: any) {
    console.error('Delete block error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete block' },
      { status: 500 }
    );
  }
}
