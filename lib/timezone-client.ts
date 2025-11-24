/**
 * Client-side timezone utilities for consistent IST (Asia/Kolkata) timezone handling
 * These are browser-safe versions of the server-side timezone utilities
 *
 * FIX: Updated to use Intl.DateTimeFormat for accurate timezone conversion
 * Previously used manual offset calculation which failed because:
 * - now.getTime() is already UTC, not local time
 * - .toISOString() always returns UTC, causing date to be off by 5.5 hours
 */

/**
 * Get current time in IST timezone
 * Returns a Date object representing the current IST time
 */
export function getISTNow(): Date {
    const now = new Date();
    // Use toLocaleString to get the date/time in IST, then parse it back
    const istString = now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' });
    return new Date(istString);
}

/**
 * Get today's date in IST timezone (YYYY-MM-DD format)
 * Useful for date input fields
 * FIX: Now uses Intl.DateTimeFormat to correctly format date in IST
 */
export function getISTToday(): string {
    const now = new Date();
    const options: Intl.DateTimeFormatOptions = {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    };
    // Use 'en-CA' locale for YYYY-MM-DD format
    const formatter = new Intl.DateTimeFormat('en-CA', options);
    return formatter.format(now);
}

/**
 * Get start of today in IST (midnight IST)
 * FIX: Properly construct IST midnight using the timezone
 */
export function getISTTodayStart(): Date {
    const today = getISTToday(); // Gets YYYY-MM-DD in IST
    // Create date at midnight IST
    const midnightIST = new Date(`${today}T00:00:00+05:30`);
    return midnightIST;
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
