import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { Penalty, IPenalty } from '@/models/Penalty';
import { User, IUser } from '@/models/User';
import { requireAuth } from '@/lib/auth/guards';
import { handleApiError, ValidationError, NotFoundError } from '@/lib/errors';
import { PenaltyQuery } from '@/types/api';
import { recalculatePenaltyPoints } from '@/lib/groupBookingPenalties';
import { logAuditEvent, getActorFromSession } from '@/lib/audit';
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

    // Try both ObjectId and string lookups for better compatibility
    const objectIdUserIds = userIds
      .filter(id => id && mongoose.Types.ObjectId.isValid(id))
      .map(id => new mongoose.Types.ObjectId(id));

    // First try: lookup by ObjectId _id
    const users = await User.find({ _id: { $in: objectIdUserIds } }).lean();

    // Second try: if some users not found, try looking up by string _id as fallback
    const foundUserIds = new Set(users.map(u => String(u._id)));
    const missingUserIds = userIds.filter(id => !foundUserIds.has(id));

    let additionalUsers: any[] = [];
    if (missingUserIds.length > 0) {
      // Try querying with string IDs directly (in case _id is stored as string)
      additionalUsers = await User.find({ _id: { $in: missingUserIds } }).lean();
    }

    // Combine all found users
    const allUsers = [...users, ...additionalUsers];

    // Create a map with both string and ObjectId keys for flexible lookup
    const userMap = new Map<string, { name: string | null; email: string; blocked: boolean }>();
    allUsers.forEach((u) => {
      const userData = { name: u.name, email: u.email, blocked: u.blocked || false };
      userMap.set(String(u._id), userData);
    });

    const enrichedPenalties = penalties.map((p) => ({
      ...(p as any),
      userName: userMap.get(String(p.userId))?.name || 'Unknown',
      userEmail: userMap.get(String(p.userId))?.email || 'N/A',
      userBlocked: userMap.get(String(p.userId))?.blocked || false,
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

      // FIX: Add audit log for adding a penalty
      await logAuditEvent({
        action: 'ADD_PENALTY',
        actor: getActorFromSession(admin),
        target: {
          type: 'USER',
          id: userId,
          name: user.name || user.email,
        },
        details: {
          points: points || 1,
          reason: reason,
          newTotalPoints: totalPoints,
        },
      });

      return NextResponse.json({
        penalty,
        totalPenaltyPoints: totalPoints
      }, { status: 201 });
    } else if (action === 'waive') {
      // Count penalties being waived
      const penaltiesToWaive = await Penalty.countDocuments({ userId, waivedBy: null });

      // Waive all penalties for user
      await Penalty.updateMany(
        { userId, waivedBy: null },
        // Use UTC for audit timestamps
        { waivedBy: admin.id, waivedAt: new Date() }
      );

      // FIX Issue #8: Recalculate penalty points from actual records
      // This ensures the count is accurate and not hardcoded to 0
      const totalPoints = await recalculatePenaltyPoints(userId);

      // Log audit event
      await logAuditEvent({
        action: 'WAIVE_PENALTY',
        actor: getActorFromSession(admin),
        target: {
          type: 'USER',
          id: userId,
          name: user.name || user.email,
        },
        details: {
          penaltiesWaived: penaltiesToWaive,
          reason: reason,
          newTotalPoints: totalPoints,
        },
      });

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

