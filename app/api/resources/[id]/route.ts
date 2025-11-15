import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Resource } from '@/models/Resource';
import { requireAuth } from '@/lib/auth/guards';

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAuth(['ADMIN']);
    await connectDB();

    const body = await req.json();
    const resource = await Resource.findByIdAndUpdate(
      params.id,
      body,
      { new: true, runValidators: true }
    );

    if (!resource) {
      return NextResponse.json({ error: 'Resource not found' }, { status: 404 });
    }

    return NextResponse.json({ resource });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to update resource' },
      { status: error.message === 'Forbidden' ? 403 : 500 }
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

    const resource = await Resource.findByIdAndDelete(params.id);

    if (!resource) {
      return NextResponse.json({ error: 'Resource not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Resource deleted' });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to delete resource' },
      { status: error.message === 'Forbidden' ? 403 : 500 }
    );
  }
}
