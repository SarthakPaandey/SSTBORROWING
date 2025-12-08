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
    category: 'limits' | 'durations' | 'durations_facility' | 'durations_room' | 'durations_sports' | 'durations_lab' | 'penalties' | 'general';
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
            enum: ['limits', 'durations', 'durations_facility', 'durations_room', 'durations_sports', 'durations_lab', 'penalties', 'general'],
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

    // ========== Per-Type Duration Settings: Facilities ==========
    MIN_DURATION_FACILITY: {
        description: 'Minimum duration',
        helpText: 'Minimum booking duration for facilities in minutes.',
        category: 'durations_facility' as const,
        min: 5,
        max: 120,
    },
    MAX_DURATION_FACILITY: {
        description: 'Maximum duration',
        helpText: 'Maximum booking duration for facilities in minutes.',
        category: 'durations_facility' as const,
        min: 15,
        max: 480,
    },
    HOURS_START_FACILITY: {
        description: 'Opening time',
        helpText: 'When facilities open (24-hour format).',
        category: 'durations_facility' as const,
        min: 0,
        max: 23,
    },
    HOURS_END_FACILITY: {
        description: 'Closing time',
        helpText: 'When facilities close (24-hour format).',
        category: 'durations_facility' as const,
        min: 1,
        max: 24,
    },

    // ========== Per-Type Duration Settings: Rooms ==========
    MIN_DURATION_ROOM: {
        description: 'Minimum duration',
        helpText: 'Minimum booking duration for rooms in minutes.',
        category: 'durations_room' as const,
        min: 5,
        max: 120,
    },
    MAX_DURATION_ROOM: {
        description: 'Maximum duration',
        helpText: 'Maximum booking duration for rooms in minutes.',
        category: 'durations_room' as const,
        min: 15,
        max: 480,
    },
    HOURS_START_ROOM: {
        description: 'Opening time',
        helpText: 'When rooms open (24-hour format).',
        category: 'durations_room' as const,
        min: 0,
        max: 23,
    },
    HOURS_END_ROOM: {
        description: 'Closing time',
        helpText: 'When rooms close (24-hour format).',
        category: 'durations_room' as const,
        min: 1,
        max: 24,
    },

    // ========== Per-Type Duration Settings: Sports Equipment ==========
    MIN_DURATION_SPORTS: {
        description: 'Minimum duration',
        helpText: 'Minimum borrow duration for sports equipment in minutes.',
        category: 'durations_sports' as const,
        min: 5,
        max: 60,
    },
    MAX_DURATION_SPORTS: {
        description: 'Maximum duration',
        helpText: 'Maximum borrow duration for sports equipment in minutes.',
        category: 'durations_sports' as const,
        min: 15,
        max: 180,
    },
    HOURS_START_SPORTS: {
        description: 'Opening time',
        helpText: 'When sports equipment can be borrowed (24-hour format).',
        category: 'durations_sports' as const,
        min: 0,
        max: 23,
    },
    HOURS_END_SPORTS: {
        description: 'Closing time',
        helpText: 'When sports equipment must be returned by (24-hour format).',
        category: 'durations_sports' as const,
        min: 1,
        max: 24,
    },

    // ========== Per-Type Duration Settings: Lab Equipment ==========
    MIN_DURATION_LAB: {
        description: 'Minimum duration',
        helpText: 'Minimum borrow duration for lab equipment in minutes.',
        category: 'durations_lab' as const,
        min: 60,
        max: 1440,
    },
    MAX_DURATION_LAB: {
        description: 'Maximum duration',
        helpText: 'Maximum borrow duration for lab equipment in minutes.',
        category: 'durations_lab' as const,
        min: 60,
        max: 10080,
    },
    HOURS_START_LAB: {
        description: 'Opening time',
        helpText: 'When lab equipment can be borrowed (24-hour format).',
        category: 'durations_lab' as const,
        min: 0,
        max: 23,
    },
    HOURS_END_LAB: {
        description: 'Closing time',
        helpText: 'When lab equipment must be returned by (24-hour format).',
        category: 'durations_lab' as const,
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

