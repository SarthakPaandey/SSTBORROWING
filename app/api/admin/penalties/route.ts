import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Penalty, IPenalty } from '@/models/Penalty';
import { User, IUser } from '@/models/User';
import { requireAuth } from '@/lib/auth/guards';
import { handleApiError, ValidationError, NotFoundError } from '@/lib/errors';
import { PenaltyQuery } from '@/types/api';
import { recalculatePenaltyPoints } from '@/lib/groupBookingPenalties';
import { getNow } from '@/lib/timezone';
import mongoose from 'mongoose';

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
    // FIX: Convert string userIds to ObjectIds for proper MongoDB lookup
    const userIds = [...new Set(penalties.map(p => p.userId))];
    const objectIdUserIds = userIds
      .filter(id => id && mongoose.Types.ObjectId.isValid(id))
      .map(id => new mongoose.Types.ObjectId(id));

    const users = await User.find({ _id: { $in: objectIdUserIds } }).lean();

    // Create a map with both string and ObjectId keys for flexible lookup
    const userMap = new Map<string, { name: string | null; email: string }>();
    users.forEach((u) => {
      const userData = { name: u.name, email: u.email };
      userMap.set(String(u._id), userData);
    });

    const enrichedPenalties = penalties.map((p) => ({
      ...(p as any),
      userName: userMap.get(String(p.userId))?.name || 'Unknown',
      userEmail: userMap.get(String(p.userId))?.email || 'N/A',
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
