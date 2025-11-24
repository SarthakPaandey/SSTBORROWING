import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Penalty, IPenalty } from '@/models/Penalty';
import { User, IUser } from '@/models/User';
import { requireAuth } from '@/lib/auth/guards';
import { handleApiError, ValidationError, NotFoundError } from '@/lib/errors';
import { PenaltyQuery } from '@/types/api';
import { recalculatePenaltyPoints } from '@/lib/groupBookingPenalties';
import { getNow } from '@/lib/timezone';

export async function GET(req: NextRequest) {
  try {
    await requireAuth(['ADMIN']);
    await connectDB();

    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    const query: PenaltyQuery = {};
    if (userId) {
      query.userId = userId;
    }

    const penalties = await Penalty.find(query)
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    // Populate user details
    const userIds = [...new Set(penalties.map(p => p.userId))];
    const users = await User.find({ _id: { $in: userIds } }).lean();
    const userMap = new Map(users.map((u) => [String(u._id), { name: u.name, email: u.email }]));

    const enrichedPenalties = penalties.map((p) => ({
      ...(p as any),
      userName: userMap.get(p.userId)?.name || 'Unknown',
      userEmail: userMap.get(p.userId)?.email || 'N/A',
    }));

    return NextResponse.json({ penalties: enrichedPenalties });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAuth(['ADMIN']);
    await connectDB();

    const { userId, points, reason, action } = await req.json();

    if (!userId || !reason) {
      throw new ValidationError('Missing required fields');
    }

    const user = await User.findById(userId);
    if (!user) {
      throw new NotFoundError('User');
    }

    if (action === 'add') {
      const penalty = await Penalty.create({
        userId,
        points: points || 1,
        reason,
      });

      // FIX Issue #8: Recalculate from source of truth instead of manual increment
      const totalPoints = await recalculatePenaltyPoints(userId);

      return NextResponse.json({
        penalty,
        totalPenaltyPoints: totalPoints
      }, { status: 201 });
    } else if (action === 'waive') {
      // Waive all penalties for user
      await Penalty.updateMany(
        { userId, waivedBy: null },
        { waivedBy: admin.id, waivedAt: getNow() }
      );

      // FIX Issue #8: Recalculate penalty points from actual records
      // This ensures the count is accurate and not hardcoded to 0
      const totalPoints = await recalculatePenaltyPoints(userId);

      return NextResponse.json({
        success: true,
        totalPenaltyPoints: totalPoints  // Should be 0 after waiving all
      });
    }

    throw new ValidationError('Invalid action');
  } catch (error) {
    return handleApiError(error);
  }
}
