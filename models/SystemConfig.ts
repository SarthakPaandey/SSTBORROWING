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
        description: 'Facility bookings per day',
        helpText: 'Maximum number of facility bookings (gym, turf, courts) a single student can make in one day. Prevents hoarding of popular venues.',
        category: 'limits' as const,
        min: 1,
        max: 10,
    },
    MAX_ROOM_BOOKINGS_PER_DAY: {
        description: 'Room bookings per day',
        helpText: 'Maximum number of room bookings (study rooms, conference rooms) a single student can make in one day.',
        category: 'limits' as const,
        min: 1,
        max: 10,
    },
    MAX_EQUIPMENT_BOOKINGS_PER_DAY: {
        description: 'Equipment borrows per day',
        helpText: 'Maximum number of equipment items a student can borrow in one day. Includes sports gear and lab equipment.',
        category: 'limits' as const,
        min: 1,
        max: 20,
    },
    MAX_TOTAL_ACTIVE_BOOKINGS: {
        description: 'Total active bookings limit',
        helpText: 'Maximum number of pending or confirmed bookings a student can have at any time across all resource types.',
        category: 'limits' as const,
        min: 1,
        max: 10,
    },
    ADVANCE_BOOKING_DAYS: {
        description: 'Advance booking window',
        helpText: 'How many days into the future students can book. Example: 7 means students can book up to 1 week ahead.',
        category: 'limits' as const,
        min: 1,
        max: 30,
    },

    // Duration Limits
    MIN_BOOKING_DURATION_MINUTES: {
        description: 'Minimum booking duration',
        helpText: 'Shortest allowed booking duration in minutes. Prevents micro-bookings that waste slots. Example: 15 = minimum 15-minute booking.',
        category: 'durations' as const,
        min: 5,
        max: 60,
    },
    MAX_BOOKING_DURATION_MINUTES: {
        description: 'Maximum booking duration',
        helpText: 'Longest allowed booking duration in minutes. Ensures fair access to resources. Example: 120 = maximum 2-hour booking.',
        category: 'durations' as const,
        min: 30,
        max: 480,
    },
    WORKING_HOURS_START: {
        description: 'Opening time',
        helpText: 'When the booking system opens for the day (24-hour format). Example: 8 = 8:00 AM. Students cannot book before this time.',
        category: 'durations' as const,
        min: 0,
        max: 23,
    },
    WORKING_HOURS_END: {
        description: 'Closing time',
        helpText: 'When the booking system closes for the day (24-hour format). Example: 20 = 8:00 PM. Students cannot book after this time.',
        category: 'durations' as const,
        min: 1,
        max: 24,
    },

    // Penalty Settings
    PENALTY_THRESHOLD_LEVEL_0: {
        description: 'First suspension threshold',
        helpText: 'Penalty points needed to trigger first suspension. When a student reaches this many points, they get suspended. Higher = more lenient.',
        category: 'penalties' as const,
        min: 5,
        max: 50,
    },
    SUSPENSION_DURATION_LEVEL_0: {
        description: 'First suspension length',
        helpText: 'How many days a student is suspended after their first penalty threshold breach. Example: 7 = student blocked for 1 week.',
        category: 'penalties' as const,
        min: 1,
        max: 30,
    },
    NO_SHOW_GRACE_MINUTES: {
        description: 'No-show grace period',
        helpText: 'Minutes after booking start time before marking as no-show. Example: 15 = student has 15 mins to check in before getting penalized.',
        category: 'penalties' as const,
        min: 5,
        max: 60,
    },

    // General Settings
    MAX_RESCHEDULE_PER_BOOKING: {
        description: 'Reschedules per booking',
        helpText: 'How many times a single booking can be rescheduled. Set to 0 to disable rescheduling completely.',
        category: 'general' as const,
        min: 0,
        max: 5,
    },
    MAX_RESCHEDULE_PER_MONTH: {
        description: 'Monthly reschedule limit',
        helpText: 'Total reschedules allowed per student per month across all their bookings. Prevents abuse of reschedule feature.',
        category: 'general' as const,
        min: 0,
        max: 20,
    },
} as const;

export type EditablePolicyKey = keyof typeof EDITABLE_POLICIES;
