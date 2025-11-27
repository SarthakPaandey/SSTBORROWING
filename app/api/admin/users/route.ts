import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { User } from '@/models/User';
import { requireAuth } from '@/lib/auth/guards';
import { handleApiError, ValidationError, NotFoundError } from '@/lib/errors';

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
