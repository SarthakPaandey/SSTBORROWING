import { connectDB } from '@/lib/db';
import { AuditLog, AuditAction } from '@/models/AuditLog';

export interface AuditEventParams {
    action: AuditAction;
    actor: {
        userId: string;
        email: string;
        name: string;
    };
    target?: {
        type: 'BOOKING' | 'RESOURCE' | 'USER' | 'BLOCK' | 'PENALTY' | 'SETTINGS' | 'EMAIL_ROUTING';
        id: string;
        name?: string;
    };
    details?: Record<string, unknown>;
    metadata?: {
        ipAddress?: string;
        userAgent?: string;
    };
}

/**
 * Log an audit event for admin actions.
 * This should be called after any admin action that modifies data.
 * 
 * @example
 * await logAuditEvent({
 *   action: 'APPROVE_BOOKING',
 *   actor: { userId: session.user.id, email: session.user.email, name: session.user.name },
 *   target: { type: 'BOOKING', id: booking._id, name: booking.resource.name },
 *   details: { previousStatus: 'PENDING', newStatus: 'CONFIRMED' }
 * });
 */
export async function logAuditEvent(params: AuditEventParams): Promise<void> {
    try {
        await connectDB();

        await AuditLog.create({
            action: params.action,
            actor: params.actor,
            target: params.target,
            details: params.details || {},
            metadata: params.metadata,
        });
    } catch (error) {
        // Log error but don't throw - audit logging should never break the main flow
        console.error('[AuditLog] Failed to log event:', error);
    }
}

/**
 * Create actor object from session user
 */
export function getActorFromSession(user: { id?: string; email?: string | null; name?: string | null }): AuditEventParams['actor'] {
    return {
        userId: user.id || 'unknown',
        email: user.email || 'unknown',
        name: user.name || 'Unknown User',
    };
}

/**
 * Batch log multiple audit events (e.g., for bulk operations)
 */
type TargetType = 'BOOKING' | 'RESOURCE' | 'USER' | 'BLOCK' | 'PENALTY' | 'SETTINGS' | 'EMAIL_ROUTING';

export async function logBulkAuditEvent(
    action: AuditAction,
    actor: AuditEventParams['actor'],
    targets: Array<{ type: TargetType; id: string; name?: string }>,
    commonDetails?: Record<string, unknown>
): Promise<void> {
    try {
        await connectDB();

        const events = targets.map(target => ({
            action,
            actor,
            target,
            details: {
                ...commonDetails,
                bulkOperation: true,
                totalInBatch: targets.length,
            },
        }));

        await AuditLog.insertMany(events);
    } catch (error) {
        console.error('[AuditLog] Failed to log bulk events:', error);
    }
}
