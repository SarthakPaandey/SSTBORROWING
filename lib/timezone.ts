import { toZonedTime, fromZonedTime } from 'date-fns-tz';

/**
 * Timezone utility for consistent date handling across the application.
 * All times should be calculated in Asia/Kolkata (IST) timezone.
 */

const TIMEZONE = 'Asia/Kolkata';

/**
 * Get the current time in IST timezone
 */
export function getNow(): Date {
    return toZonedTime(new Date(), TIMEZONE);
}

/**
 * Get the start of day (00:00:00.000) in IST timezone
 * @param date Optional date to get start of day for. Defaults to today.
 */
export function getStartOfDay(date?: Date): Date {
    const d = date ? new Date(date) : new Date();
    const zonedDate = toZonedTime(d, TIMEZONE);
    zonedDate.setHours(0, 0, 0, 0);
    return zonedDate;
}

/**
 * Get the end of day (23:59:59.999) in IST timezone
 * @param date Optional date to get end of day for. Defaults to today.
 */
export function getEndOfDay(date?: Date): Date {
    const d = date ? new Date(date) : new Date();
    const zonedDate = toZonedTime(d, TIMEZONE);
    zonedDate.setHours(23, 59, 59, 999);
    return zonedDate;
}

/**
 * Convert a date to IST timezone
 */
export function toIST(date: Date): Date {
    return toZonedTime(date, TIMEZONE);
}

/**
 * Get a date N days ago from now in IST
 */
export function getDaysAgo(days: number): Date {
    const now = getNow();
    now.setDate(now.getDate() - days);
    return now;
}

/**
 * Get start of today in IST
 */
export function getTodayStart(): Date {
    return getStartOfDay();
}

/**
 * Get end of today in IST
 */
export function getTodayEnd(): Date {
    return getEndOfDay();
}
