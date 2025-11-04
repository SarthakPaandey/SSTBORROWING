import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Block } from '@/models/Block';
import { requireAuth } from '@/lib/auth/guards';

export async function GET(req: NextRequest) {
  try {
    await requireAuth(['ADMIN']);
    await connectDB();

    const { searchParams } = new URL(req.url);
    const resourceId = searchParams.get('resourceId');

    const query: any = {};
    if (resourceId) {
      query.resourceId = resourceId;
    }

    const blocks = await Block.find(query).sort({ start: 1 });

    return NextResponse.json({ blocks });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to fetch blocks' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAuth(['ADMIN']);
    await connectDB();

    const body = await req.json();
    const { resourceId, start, end, reason, type } = body;

    if (!resourceId || !start || !end || !reason || !type) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const block = await Block.create({
      resourceId,
      start: new Date(start),
      end: new Date(end),
      reason,
      type,
      createdBy: admin.id,
    });

    return NextResponse.json({ block }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to create block' },
      { status: 500 }
    );
  }
}
