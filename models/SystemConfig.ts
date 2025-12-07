import mongoose, { Schema, Document, Model } from 'mongoose';

/**
 * SystemConfig model for storing runtime-editable policy values.
 * 
 * This allows admins to modify booking limits, penalties, and other
 * system settings without requiring code changes or deployments.
 * 
 * If a config key doesn't exist in the database, the system falls back
 * to the hardcoded defaults in lib/policies.ts
 */

export interface ISystemConfig extends Document {
    key: string;
    value: number;
    description?: string;
    category: 'limits' | 'durations' | 'penalties' | 'general';
    updatedBy: string;
    updatedAt: Date;
    createdAt: Date;
}

const SystemConfigSchema = new Schema<ISystemConfig>(
    {
        key: {
            type: String,
            required: true,
            unique: true,
            index: true
        },
        value: {
            type: Number,
            required: true
        },
        description: { type: String },
        category: {
            type: String,
            enum: ['limits', 'durations', 'penalties', 'general'],
            default: 'general',
        },
        updatedBy: {
            type: String,
            required: true,
            ref: 'User'
        },
    },
    {
        timestamps: true,
        collection: 'system_config'
    }
);

export const SystemConfig: Model<ISystemConfig> =
    mongoose.models.SystemConfig || mongoose.model<ISystemConfig>('SystemConfig', SystemConfigSchema);

/**
 * Editable policy keys that admins can modify via the UI.
 * Each key maps to a policy constant in lib/policies.ts
 */
export const EDITABLE_POLICIES = {
    // Booking Limits
    MAX_FACILITY_BOOKINGS_PER_DAY: {
        description: 'Max facility bookings per day',
        category: 'limits' as const,
        min: 1,
        max: 10,
    },
    MAX_ROOM_BOOKINGS_PER_DAY: {
        description: 'Max room bookings per day',
        category: 'limits' as const,
        min: 1,
        max: 10,
    },
    MAX_EQUIPMENT_BOOKINGS_PER_DAY: {
        description: 'Max equipment borrows per day',
        category: 'limits' as const,
        min: 1,
        max: 20,
    },
    MAX_TOTAL_ACTIVE_BOOKINGS: {
        description: 'Max active bookings at once',
        category: 'limits' as const,
        min: 1,
        max: 10,
    },
    ADVANCE_BOOKING_DAYS: {
        description: 'How many days in advance users can book',
        category: 'limits' as const,
        min: 1,
        max: 30,
    },

    // Duration Limits
    MIN_BOOKING_DURATION_MINUTES: {
        description: 'Minimum booking duration (minutes)',
        category: 'durations' as const,
        min: 5,
        max: 60,
    },
    MAX_BOOKING_DURATION_MINUTES: {
        description: 'Maximum booking duration (minutes)',
        category: 'durations' as const,
        min: 30,
        max: 480,
    },
    WORKING_HOURS_START: {
        description: 'Working hours start (hour, 24h format)',
        category: 'durations' as const,
        min: 0,
        max: 23,
    },
    WORKING_HOURS_END: {
        description: 'Working hours end (hour, 24h format)',
        category: 'durations' as const,
        min: 1,
        max: 24,
    },

    // Penalty Settings
    PENALTY_THRESHOLD_LEVEL_0: {
        description: 'First suspension threshold (points)',
        category: 'penalties' as const,
        min: 5,
        max: 50,
    },
    SUSPENSION_DURATION_LEVEL_0: {
        description: 'First suspension duration (days)',
        category: 'penalties' as const,
        min: 1,
        max: 30,
    },
    NO_SHOW_GRACE_MINUTES: {
        description: 'Grace period before no-show (minutes)',
        category: 'penalties' as const,
        min: 5,
        max: 60,
    },

    // General Settings
    MAX_RESCHEDULE_PER_BOOKING: {
        description: 'Max reschedules per booking',
        category: 'general' as const,
        min: 0,
        max: 5,
    },
    MAX_RESCHEDULE_PER_MONTH: {
        description: 'Max reschedules per month',
        category: 'general' as const,
        min: 0,
        max: 20,
    },
} as const;

export type EditablePolicyKey = keyof typeof EDITABLE_POLICIES;
