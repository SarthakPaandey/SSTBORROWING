import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Resource } from '@/models/Resource';
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
    const resource = await Resource.findByIdAndUpdate(
      params.id,
      body,
      { new: true, runValidators: true }
    );

    if (!resource) {
      return NextResponse.json({ error: 'Resource not found' }, { status: 404 });
    }

    return NextResponse.json({ resource });
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

    const resource = await Resource.findByIdAndDelete(params.id);

    if (!resource) {
      return NextResponse.json({ error: 'Resource not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Resource deleted' });
  } catch (error) {
    return handleApiError(error);
  }
}
