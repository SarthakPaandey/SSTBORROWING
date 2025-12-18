import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/db';
import { AuditLog, AuditAction, AUDIT_ACTION_LABELS } from '@/models/AuditLog';
import { requireAuth } from '@/lib/auth/guards';
import { handleApiError } from '@/lib/errors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Escape special regex characters to prevent ReDoS attacks
 * when using user input in MongoDB $regex queries.
 */
function escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * GET /api/admin/audit-logs
 * 
 * Query params:
 * - action: Filter by action type
 * - actorId: Filter by actor user ID
 * - targetType: Filter by target type
 * - startDate: Filter from date (ISO string)
 * - endDate: Filter to date (ISO string)
 * - search: Search in actor email/name or target name
 * - page: Page number (default 1)
 * - limit: Items per page (default 50)
 */
export async function GET(request: NextRequest) {
    try {
        await requireAuth(['ADMIN']);
        await connectDB();

        const { searchParams } = new URL(request.url);
        const action = searchParams.get('action');
        const actorId = searchParams.get('actorId');
        const targetType = searchParams.get('targetType');
        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');
        const search = searchParams.get('search');
        const page = parseInt(searchParams.get('page') || '1', 10);
        const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);

        // Build query
        const query: Record<string, unknown> = {};

        if (action) {
            query.action = action;
        }

        if (actorId) {
            query['actor.userId'] = actorId;
        }

        if (targetType) {
            query['target.type'] = targetType;
        }

        if (startDate || endDate) {
            query.createdAt = {};
            if (startDate) {
                (query.createdAt as Record<string, Date>).$gte = new Date(startDate);
            }
            if (endDate) {
                (query.createdAt as Record<string, Date>).$lte = new Date(endDate);
            }
        }

        // FIX: Escape regex special characters to prevent ReDoS attacks
        if (search) {
            const escapedSearch = escapeRegex(search);
            query.$or = [
                { 'actor.email': { $regex: escapedSearch, $options: 'i' } },
                { 'actor.name': { $regex: escapedSearch, $options: 'i' } },
                { 'target.name': { $regex: escapedSearch, $options: 'i' } },
            ];
        }

        // Execute query with pagination
        const [logs, total] = await Promise.all([
            AuditLog.find(query)
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .lean(),
            AuditLog.countDocuments(query),
        ]);

        // Get unique actors for filter dropdown
        const uniqueActors = await AuditLog.aggregate([
            { $group: { _id: '$actor.userId', email: { $first: '$actor.email' }, name: { $first: '$actor.name' } } },
            { $sort: { name: 1 } },
        ]);

        return NextResponse.json({
            logs: logs.map(log => ({
                ...log,
                actionLabel: AUDIT_ACTION_LABELS[log.action as AuditAction] || {
                    label: log.action,
                    emoji: '📝',
                    color: 'default'
                },
            })),
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
            filters: {
                actions: Object.entries(AUDIT_ACTION_LABELS).map(([key, value]) => ({
                    value: key,
                    label: value.label,
                    emoji: value.emoji,
                })),
                actors: uniqueActors.map(a => ({
                    value: a._id,
                    label: a.name,
                    email: a.email,
                })),
                targetTypes: ['BOOKING', 'RESOURCE', 'USER', 'BLOCK', 'PENALTY', 'SETTINGS', 'EMAIL_ROUTING'],
            },
        });

    } catch (error) {
        return handleApiError(error);
    }
}
