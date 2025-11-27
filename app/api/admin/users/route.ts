import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { User } from '@/models/User';
import { Penalty } from '@/models/Penalty';
import { requireAuth } from '@/lib/auth/guards';
import { handleApiError, ValidationError, NotFoundError } from '@/lib/errors';

export async function GET(req: NextRequest) {
    try {
        await requireAuth(['ADMIN']);
        await connectDB();

        const { searchParams } = new URL(req.url);
        const query = searchParams.get('q');

        // FIX EC-26: Prevent ReDoS attacks
        if (!query || query.trim().length < 2) {
            return NextResponse.json({ users: [] });
        }

        // Limit query length to prevent ReDoS
        if (query.length > 100) {
            throw new ValidationError('Search query too long (max 100 characters)');
        }

        // Escape special regex characters to prevent ReDoS
        const escapeRegex = (str: string) => {
            return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        };
        const safeQuery = escapeRegex(query);

        // Search by name or email (case-insensitive)
        const users = await User.find({
            $or: [
                { name: { $regex: safeQuery, $options: 'i' } },
                { email: { $regex: safeQuery, $options: 'i' } },
            ],
        })
            .select('name email role penaltyPoints blocked blockedAt')
            .limit(20)
            .lean();

        // Get penalty counts for each user
        const usersWithPenalties = await Promise.all(
            users.map(async (user) => {
                const activePenalties = await Penalty.countDocuments({
                    userId: user._id,
                    waivedBy: null,
                });

                return {
                    ...user,
                    _id: String(user._id),
                    activePenaltyCount: activePenalties,
                };
            })
        );

        return NextResponse.json({ users: usersWithPenalties });
    } catch (error) {
        return handleApiError(error);
    }
}

export async function POST(req: NextRequest) {
    try {
        const admin = await requireAuth(['ADMIN']);
        await connectDB();

        const { userId, action } = await req.json();

        if (!userId || !action) {
            throw new ValidationError('userId and action are required');
        }

        if (!['block', 'unblock'].includes(action)) {
            throw new ValidationError('action must be "block" or "unblock"');
        }

        const user = await User.findById(userId);
        if (!user) {
            throw new NotFoundError('User');
        }

        // Prevent blocking admins
        if (user.role === 'ADMIN') {
            throw new ValidationError('Cannot block admin users');
        }

        if (action === 'block') {
            user.blocked = true;
            user.blockedAt = new Date();
            user.blockedBy = admin.id;
        } else {
            user.blocked = false;
            user.blockedAt = undefined;
            user.blockedBy = undefined;
        }

        await user.save();

        return NextResponse.json({
            success: true,
            message: action === 'block' ? 'User blocked successfully' : 'User unblocked successfully',
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                blocked: user.blocked,
            },
        });
    } catch (error) {
        return handleApiError(error);
    }
}
