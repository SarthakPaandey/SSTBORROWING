import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * AuditLog model for tracking all admin actions for accountability.
 * 
 * Records who did what, when, and to which resource.
 */

export type AuditAction =
    | 'APPROVE_BOOKING'
    | 'REJECT_BOOKING'
    | 'CANCEL_BOOKING'
    | 'CREATE_BLOCK'
    | 'UPDATE_BLOCK'
    | 'REMOVE_BLOCK'
    | 'WAIVE_PENALTY'
    | 'CREATE_RESOURCE'
    | 'UPDATE_RESOURCE'
    | 'DELETE_RESOURCE'
    | 'UPDATE_SETTINGS'
    | 'UPDATE_EMAIL_ROUTING'
    | 'BULK_APPROVE'
    | 'BULK_REJECT'
    | 'BULK_CANCEL'
    | 'BULK_NOTIFY'
    | 'USER_BLOCKED'
    | 'USER_UNBLOCKED'
    | 'CREATE_RECURRING_BLOCK'
    | 'DELETE_RECURRING_BLOCK';

export interface IAuditLog extends Document {
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
    details: Record<string, unknown>;
    metadata?: {
        ipAddress?: string;
        userAgent?: string;
    };
    createdAt: Date;
}

const AuditLogSchema = new Schema<IAuditLog>(
    {
        action: {
            type: String,
            required: true,
            enum: [
                'APPROVE_BOOKING',
                'REJECT_BOOKING',
                'CANCEL_BOOKING',
                'CREATE_BLOCK',
                'UPDATE_BLOCK',
                'REMOVE_BLOCK',
                'WAIVE_PENALTY',
                'CREATE_RESOURCE',
                'UPDATE_RESOURCE',
                'DELETE_RESOURCE',
                'UPDATE_SETTINGS',
                'UPDATE_EMAIL_ROUTING',
                'BULK_APPROVE',
                'BULK_REJECT',
                'BULK_CANCEL',
                'BULK_NOTIFY',
                'USER_BLOCKED',
                'USER_UNBLOCKED',
                'CREATE_RECURRING_BLOCK',
                'DELETE_RECURRING_BLOCK',
            ],
            index: true,
        },
        actor: {
            userId: { type: String, required: true, index: true },
            email: { type: String, required: true },
            name: { type: String, required: true },
        },
        target: {
            type: {
                type: String,
                enum: ['BOOKING', 'RESOURCE', 'USER', 'BLOCK', 'PENALTY', 'SETTINGS', 'EMAIL_ROUTING'],
            },
            id: { type: String },
            name: { type: String },
        },
        details: {
            type: Schema.Types.Mixed,
            default: {},
        },
        metadata: {
            ipAddress: { type: String },
            userAgent: { type: String },
        },
    },
    {
        timestamps: { createdAt: true, updatedAt: false },
        collection: 'audit_logs',
    }
);

// Create compound indexes for efficient querying
AuditLogSchema.index({ createdAt: -1 });
AuditLogSchema.index({ action: 1, createdAt: -1 });
AuditLogSchema.index({ 'actor.userId': 1, createdAt: -1 });

export const AuditLog: Model<IAuditLog> =
    mongoose.models.AuditLog || mongoose.model<IAuditLog>('AuditLog', AuditLogSchema);

/**
 * Human-readable labels for audit actions
 */
export const AUDIT_ACTION_LABELS: Record<AuditAction, { label: string; emoji: string; color: string }> = {
    APPROVE_BOOKING: { label: 'Approved Booking', emoji: '✅', color: 'success' },
    REJECT_BOOKING: { label: 'Rejected Booking', emoji: '❌', color: 'danger' },
    CANCEL_BOOKING: { label: 'Cancelled Booking', emoji: '🚫', color: 'warning' },
    CREATE_BLOCK: { label: 'Created Block', emoji: '🔒', color: 'info' },
    UPDATE_BLOCK: { label: 'Updated Block', emoji: '✏️', color: 'info' },
    REMOVE_BLOCK: { label: 'Removed Block', emoji: '🔓', color: 'success' },
    WAIVE_PENALTY: { label: 'Waived Penalty', emoji: '🎁', color: 'success' },
    CREATE_RESOURCE: { label: 'Created Resource', emoji: '➕', color: 'success' },
    UPDATE_RESOURCE: { label: 'Updated Resource', emoji: '✏️', color: 'info' },
    DELETE_RESOURCE: { label: 'Deleted Resource', emoji: '🗑️', color: 'danger' },
    UPDATE_SETTINGS: { label: 'Updated Settings', emoji: '⚙️', color: 'info' },
    UPDATE_EMAIL_ROUTING: { label: 'Updated Email Routing', emoji: '📧', color: 'info' },
    BULK_APPROVE: { label: 'Bulk Approved', emoji: '✅✅', color: 'success' },
    BULK_REJECT: { label: 'Bulk Rejected', emoji: '❌❌', color: 'danger' },
    BULK_CANCEL: { label: 'Bulk Cancelled', emoji: '🚫🚫', color: 'warning' },
    BULK_NOTIFY: { label: 'Bulk Notified', emoji: '📢', color: 'info' },
    USER_BLOCKED: { label: 'User Blocked', emoji: '🚷', color: 'danger' },
    USER_UNBLOCKED: { label: 'User Unblocked', emoji: '✋', color: 'success' },
    CREATE_RECURRING_BLOCK: { label: 'Created Recurring Block', emoji: '🔒🔄', color: 'info' },
    DELETE_RECURRING_BLOCK: { label: 'Deleted Recurring Block', emoji: '🔓🔄', color: 'warning' },
};
