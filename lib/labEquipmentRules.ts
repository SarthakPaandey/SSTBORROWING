/**
 * Lab Equipment Category Rules
 * 
 * Defines borrow duration limits per lab equipment category:
 * - LAPTOP: Up to 2 months (60 days)
 * - SAME_DAY_RETURN: Same day return by 8 PM (VR Headsets, Monitors, etc.)
 * - GENERAL: Default 1-7 days
 */

import { LabEquipmentCategory } from '@/models/EquipmentItem';

export const LAB_CATEGORIES = {
    LAPTOP: 'LAPTOP' as const,
    SAME_DAY_RETURN: 'SAME_DAY_RETURN' as const,
    GENERAL: 'GENERAL' as const,
};

export interface LabCategoryDurationLimits {
    minDurationMinutes: number;
    maxDurationMinutes: number;
    label: string;
    description: string;
    returnTime?: string; // For same-day items: when they must be returned (e.g., "20:00")
}

/**
 * Duration limits per lab equipment category (in minutes)
 */
export const LAB_CATEGORY_LIMITS: Record<LabEquipmentCategory, LabCategoryDurationLimits> = {
    LAPTOP: {
        minDurationMinutes: 1440, // 1 day minimum
        maxDurationMinutes: 86400, // 60 days = 2 months max
        label: 'Laptop',
        description: 'Long-term borrow (1 day to 2 months)',
    },
    SAME_DAY_RETURN: {
        minDurationMinutes: 60, // 1 hour minimum
        maxDurationMinutes: 720, // Up to 12 hours (will be capped at 8 PM)
        label: 'Same-Day Return',
        description: 'Must return by 8:00 PM today',
        returnTime: '20:00', // 8 PM IST
    },
    GENERAL: {
        minDurationMinutes: 1440, // 1 day minimum
        maxDurationMinutes: 10080, // 7 days max
        label: 'Standard Lab Equipment',
        description: 'Borrow period 1-7 days',
    },
};

/**
 * Get the lab category from an item name (auto-detection for backward compatibility with existing data)
 */
export function detectLabCategoryFromName(itemName: string): LabEquipmentCategory {
    const lowerName = itemName.toLowerCase();

    // Laptops - long term borrow (up to 2 months)
    if (lowerName.includes('laptop') || lowerName.includes('macbook') || lowerName.includes('notebook')) {
        return LAB_CATEGORIES.LAPTOP;
    }

    // VR Headsets and Monitors - same day return by 8 PM
    if (
        lowerName.includes('vr headset') ||
        lowerName.includes('vr ') ||
        lowerName.includes('monitor') ||
        lowerName.includes('oculus') ||
        lowerName.includes('quest') ||
        lowerName.includes('display')
    ) {
        return LAB_CATEGORIES.SAME_DAY_RETURN;
    }

    // Everything else is GENERAL (1-7 days)
    return LAB_CATEGORIES.GENERAL;
}

/**
 * Get duration limits for a lab equipment item
 * 
 * @param labCategory - The lab category from the item (if set)
 * @param itemName - The item name (used for auto-detection if category not set)
 * @returns Duration limits for the category
 */
export function getLabItemDurationLimits(
    labCategory?: LabEquipmentCategory,
    itemName?: string
): LabCategoryDurationLimits {
    const category = labCategory || (itemName ? detectLabCategoryFromName(itemName) : LAB_CATEGORIES.GENERAL);
    return LAB_CATEGORY_LIMITS[category] || LAB_CATEGORY_LIMITS.GENERAL;
}

/**
 * Validate lab equipment borrow duration
 * 
 * @param durationMinutes - Duration in minutes
 * @param labCategory - Lab category of the item
 * @param itemName - Item name (fallback for category detection)
 * @returns Validation result
 */
export function validateLabBorrowDuration(
    durationMinutes: number,
    labCategory?: LabEquipmentCategory,
    itemName?: string
): { valid: boolean; reason?: string } {
    const limits = getLabItemDurationLimits(labCategory, itemName);

    if (durationMinutes < limits.minDurationMinutes) {
        const minHours = limits.minDurationMinutes / 60;
        const minDays = limits.minDurationMinutes / 1440;
        const timeLabel = minDays >= 1 ? `${minDays} day(s)` : `${minHours} hour(s)`;
        return {
            valid: false,
            reason: `${limits.label} borrow duration must be at least ${timeLabel}.`,
        };
    }

    if (durationMinutes > limits.maxDurationMinutes) {
        const maxDays = limits.maxDurationMinutes / 1440;
        return {
            valid: false,
            reason: `${limits.label} borrow duration cannot exceed ${maxDays} day(s). ${limits.description}`,
        };
    }

    return { valid: true };
}

/**
 * Calculate the end time for a same-day return item
 * 
 * @param startDate - The start date/time
 * @returns End date set to 8 PM IST on the same day
 */
export function calculateSameDayEndTime(startDate: Date): Date {
    // Create a new date for 8 PM IST on the same day
    const dateStr = startDate.toISOString().split('T')[0]; // YYYY-MM-DD
    return new Date(`${dateStr}T20:00:00+05:30`); // 8 PM IST
}

/**
 * Get user-friendly duration info for a lab item
 */
export function getLabItemDurationInfo(
    labCategory?: LabEquipmentCategory,
    itemName?: string
): { minDays: number; maxDays: number; isSameDay: boolean; description: string } {
    const limits = getLabItemDurationLimits(labCategory, itemName);
    const category = labCategory || (itemName ? detectLabCategoryFromName(itemName) : LAB_CATEGORIES.GENERAL);

    const minDays = Math.ceil(limits.minDurationMinutes / 1440);
    const maxDays = Math.floor(limits.maxDurationMinutes / 1440);

    return {
        minDays: category === LAB_CATEGORIES.SAME_DAY_RETURN ? 0 : minDays,
        maxDays: category === LAB_CATEGORIES.SAME_DAY_RETURN ? 0 : maxDays,
        isSameDay: category === LAB_CATEGORIES.SAME_DAY_RETURN,
        description: limits.description,
    };
}
