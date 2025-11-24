/**
 * Client-side timezone utilities for consistent IST (Asia/Kolkata) timezone handling
 * These are browser-safe versions of the server-side timezone utilities
 */

/**
 * Get current time in IST timezone
 * Returns a Date object adjusted to IST
 */
export function getISTNow(): Date {
    // Get current time in IST timezone
    const now = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000; // IST is UTC+5:30
    const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
    const istTime = new Date(utcTime + istOffset);
    return istTime;
}

/**
 * Get today's date in IST timezone (YYYY-MM-DD format)
 * Useful for date input fields
 */
export function getISTToday(): string {
    const istNow = getISTNow();
    return istNow.toISOString().split('T')[0];
}

/**
 * Get start of today in IST (midnight IST)
 */
export function getISTTodayStart(): Date {
    const today = getISTToday();
    return new Date(`${today}T00:00:00+05:30`);
}

/**
 * Check if a date string is today in IST
 */
export function isISTToday(dateString: string): boolean {
    return dateString === getISTToday();
}

/**
 * Format Date object to IST time string (HH:MM)
 */
export function formatISTTime(date: Date): string {
    const istDate = new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const hours = istDate.getHours().toString().padStart(2, '0');
    const minutes = istDate.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
}

/**
 * Get current IST time as HH:MM string
 */
export function getISTCurrentTime(): string {
    return formatISTTime(getISTNow());
}
