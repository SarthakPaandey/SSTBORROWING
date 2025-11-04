import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Penalty } from '@/models/Penalty';
import { User } from '@/models/User';
import { requireAuth } from '@/lib/auth/guards';

export async function GET(req: NextRequest) {
  try {
    await requireAuth(['ADMIN']);
    await connectDB();

    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    const query: any = {};
    if (userId) {
      query.userId = userId;
    }

    const penalties = await Penalty.find(query)
      .sort({ createdAt: -1 })
      .limit(100);

    return NextResponse.json({ penalties });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to fetch penalties' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAuth(['ADMIN']);
    await connectDB();

    const { userId, points, reason, action } = await req.json();

    if (!userId || !reason) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const user = await User.findById(userId);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (action === 'add') {
      const penalty = await Penalty.create({
        userId,
        points: points || 1,
        reason,
      });

      user.penaltyPoints += points || 1;
      await user.save();

      return NextResponse.json({ penalty }, { status: 201 });
    } else if (action === 'waive') {
      // Waive all penalties for user
      await Penalty.updateMany(
        { userId, waivedBy: null },
        { waivedBy: admin.id, waivedAt: new Date() }
      );

      user.penaltyPoints = 0;
      user.suspendedUntil = undefined;
      await user.save();

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to manage penalty' },
      { status: 500 }
    );
  }
}
