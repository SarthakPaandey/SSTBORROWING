import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Resource } from '@/models/Resource';
import { requireAuth } from '@/lib/auth/guards';
import { handleApiError } from '@/lib/errors';
import { ResourceQuery } from '@/types/api';

export async function GET(req: NextRequest) {
  try {
    await requireAuth();
    await connectDB();

    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type');

    const query: ResourceQuery = { status: 'ACTIVE' };
    if (type) {
      query.type = type;
    }

    const resources = await Resource.find(query).sort({ name: 1 });

    return NextResponse.json({ resources });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAuth(['ADMIN']);
    await connectDB();

    const body = await req.json();
    const resource = await Resource.create(body);

    return NextResponse.json({ resource }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
