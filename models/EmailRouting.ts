import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * EmailRouting model for storing email routing configuration per resource category.
 * 
 * This allows admins to configure which email addresses receive approval
 * notifications for different resource types (Lab Equipment, Sports Equipment, etc.)
 * 
 * If no routing rule exists for a category, the system falls back to:
 * 1. DEFAULT routing rule (if configured)
 * 2. All admin emails (ultimate fallback)
 */

export type EmailRoutingCategory =
    | 'LAB_EQUIPMENT'
    | 'SPORTS_EQUIPMENT'
    | 'FACILITY'
    | 'ROOM'
    | 'LIBRARY'
    | 'DEFAULT';

export interface IEmailRouting extends Document {
    category: EmailRoutingCategory;
    emails: string[];
    enabled: boolean;
    updatedBy: string;
    createdAt: Date;
    updatedAt: Date;
}

const EmailRoutingSchema = new Schema<IEmailRouting>(
    {
        category: {
            type: String,
            enum: ['LAB_EQUIPMENT', 'SPORTS_EQUIPMENT', 'FACILITY', 'ROOM', 'LIBRARY', 'DEFAULT'],
            required: true,
            unique: true,
            index: true,
        },
        emails: {
            type: [String],
            required: true,
            validate: {
                validator: (v: string[]) => v.length > 0,
                message: 'At least one email address is required',
            },
        },
        enabled: {
            type: Boolean,
            default: true,
        },
        updatedBy: {
            type: String,
            required: true,
            ref: 'User',
        },
    },
    {
        timestamps: true,
        collection: 'email_routing',
    }
);

export const EmailRouting: Model<IEmailRouting> =
    mongoose.models.EmailRouting || mongoose.model<IEmailRouting>('EmailRouting', EmailRoutingSchema);

/**
 * Map resource types to email routing categories
 */
export function getEmailRoutingCategory(resourceType: string): EmailRoutingCategory {
    switch (resourceType) {
        case 'LAB_EQUIPMENT':
            return 'LAB_EQUIPMENT';
        case 'SPORTS_EQUIPMENT':
            return 'SPORTS_EQUIPMENT';
        case 'FACILITY':
            return 'FACILITY';
        case 'ROOM':
            return 'ROOM';
        case 'LIBRARY':
            return 'LIBRARY';
        default:
            return 'DEFAULT';
    }
}

/**
 * Display names for email routing categories
 */
export const EMAIL_ROUTING_CATEGORIES: Record<EmailRoutingCategory, { label: string; description: string }> = {
    LAB_EQUIPMENT: {
        label: 'Lab Equipment',
        description: 'Emails for lab equipment approval requests (microscopes, oscilloscopes, etc.)',
    },
    SPORTS_EQUIPMENT: {
        label: 'Sports Equipment',
        description: 'Emails for sports equipment approval requests (if any require approval)',
    },
    FACILITY: {
        label: 'Facilities',
        description: 'Emails for facility booking approvals (if any require approval)',
    },
    ROOM: {
        label: 'Rooms',
        description: 'Emails for room booking approvals (if any require approval)',
    },
    LIBRARY: {
        label: 'Library',
        description: 'Emails for library book approvals (if any require approval)',
    },
    DEFAULT: {
        label: 'Default Fallback',
        description: 'Fallback emails when no category-specific routing is configured',
    },
};
