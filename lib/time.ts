/**
 * Timezone utility functions for consistent time handling across the application.
 * All functions use Asia/Kolkata (IST) timezone.
 */

export const TIMEZONE = 'Asia/Kolkata';

/**
 * Converts a date to IST timezone
 */
function toIST(date: Date = new Date()): Date {
    // Get the date string in IST timezone
    const istString = date.toLocaleString('en-US', { timeZone: TIMEZONE });
    return new Date(istString);
}

/**
 * Returns the start of the day (00:00:00.000) in IST
 * @param date Optional date, defaults to now
 */
export function getStartOfDay(date: Date = new Date()): Date {
    const ist = toIST(date);
    ist.setHours(0, 0, 0, 0);
    return ist;
}

/**
 * Returns the end of the day (23:59:59.999) in IST
 * @param date Optional date, defaults to now
 */
export function getEndOfDay(date: Date = new Date()): Date {
    const ist = toIST(date);
    ist.setHours(23, 59, 59, 999);
    return ist;
}

/**
 * Returns the start of the week (Sunday 00:00:00) in IST
 * @param date Optional date, defaults to now
 */
export function getStartOfWeek(date: Date = new Date()): Date {
    const ist = toIST(date);
    const day = ist.getDay(); // 0 is Sunday
    const diff = ist.getDate() - day;
    ist.setDate(diff);
    ist.setHours(0, 0, 0, 0);
    return ist;
}

/**
 * Returns the start of the month (1st 00:00:00) in IST
 * @param date Optional date, defaults to now
 */
export function getStartOfMonth(date: Date = new Date()): Date {
    const ist = toIST(date);
    ist.setDate(1);
    ist.setHours(0, 0, 0, 0);
    return ist;
}

/**
 * Returns the end of the month (last day 23:59:59.999) in IST
 * @param date Optional date, defaults to now
 */
export function getEndOfMonth(date: Date = new Date()): Date {
    const ist = toIST(date);
    ist.setMonth(ist.getMonth() + 1, 0); // Set to last day of current month
    ist.setHours(23, 59, 59, 999);
    return ist;
}

/**
 * Checks if a date is "today" in IST timezone
 */
export function isToday(date: Date): boolean {
    const now = new Date();
    const start = getStartOfDay(now);
    const end = getEndOfDay(now);
    return date >= start && date <= end;
}

/**
 * Gets a date N days ago from now in IST
 */
export function getDaysAgo(days: number): Date {
    const ist = toIST(new Date());
    ist.setDate(ist.getDate() - days);
    ist.setHours(0, 0, 0, 0);
    return ist;
}
