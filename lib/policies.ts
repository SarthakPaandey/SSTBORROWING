// System-wide booking policies and rules

export const POLICIES = {
  // Booking limits
  MAX_ACTIVE_FACILITIES: 2,
  MAX_ACTIVE_ROOMS: 1,
  MAX_ACTIVE_EQUIPMENT_ITEMS: 5,
  MAX_SPORTS_EQUIPMENT_ITEMS_PER_BOOKING: 3,
  MAX_LAB_EQUIPMENT_ITEMS_PER_BOOKING: 1,

  // Daily and weekly limits
  MAX_BOOKINGS_PER_DAY: 2,
  MAX_BOOKINGS_PER_WEEK: 6,
  MAX_TOTAL_ACTIVE_BOOKINGS: 3, // Max 3 active bookings across all types

  // Monthly limits (hours)
  MAX_FACILITY_HOURS_PER_MONTH: 10, // 10 hours of facility time per month
  MAX_ROOM_HOURS_PER_MONTH: 8,      // 8 hours of room time per month
  MAX_EQUIPMENT_BORROWS_PER_MONTH: 20, // 20 equipment borrows per month

  // Consecutive booking prevention
  MIN_GAP_BETWEEN_BOOKINGS_MINUTES: 30, // 30-minute gap required between bookings
  MAX_CONSECUTIVE_SLOTS: 2, // Can't book more than 2 consecutive slots for same resource type

  // Cancellation limits
  MAX_CANCELLATIONS_PER_WEEK: 2,
  PENALTY_LATE_CANCELLATION: 0.5, // Half point if cancelled <2 hours before start
  LATE_CANCELLATION_HOURS: 2, // Considered "late" if within 2 hours of start

  // Advance booking window
  ADVANCE_BOOKING_DAYS: 7,

  // Slot durations (minutes)
  FACILITY_SLOT_MINUTES: 60,
  ROOM_SLOT_MINUTES: 60,
  SPORTS_EQUIPMENT_BORROW_MINUTES: 75, // 75 minutes for sports equipment
  LAB_EQUIPMENT_BORROW_MINUTES: 1440, // 24 hours (1 day) for lab equipment
  LIBRARY_BOOK_BORROW_MINUTES: 20160, // 14 days for library books

  // Auto-cancel timings
  NO_SHOW_GRACE_MINUTES: 15,

  // QR validity windows (minutes)
  QR_VALIDITY_BEFORE_START: 15, // Can generate QR 15 min before booking start
  QR_VALIDITY_AFTER_START: 15,
  QR_EQUIPMENT_PICKUP_WINDOW: 10, // QR expires 10 min after generation

  // Penalties
  PENALTY_NO_SHOW: 1,
  PENALTY_LATE_RETURN: 1,
  PENALTY_DAMAGE: 2,
  PENALTY_LATE_CANCELLATION_POINTS: 0.5,
  PENALTY_BOOK_LATE_RETURN: 2, // 2 points for late book return (+ payment)
  PENALTY_BOOK_NO_PICKUP: 0.5, // 0.5 points if student doesn't pick up book within 24h
  PENALTY_THRESHOLD_FOR_SUSPENSION: 5,
  SUSPENSION_DAYS: 7,

  // Special rules
  SHARED_TURF_GROUP_ID: 'TURF-1', // Football & Cricket share this
  LAB_EQUIPMENT_REQUIRES_APPROVAL: true,
  LAB_EQUIPMENT_STUDENTS_ONLY: true,

  // Library rules
  MAX_BOOKS_PER_STUDENT: 1, // Only 1 book at a time
  LIBRARY_BOOK_PICKUP_WINDOW_HOURS: 24, // Must pick up within 24 hours
  LIBRARY_STUDENTS_ONLY: true,

  // Group booking rules
  GROUP_BOOKING_MIN_MEMBERS: 6, // Minimum 6 people for team sports
  GROUP_BOOKING_INVITATION_EXPIRY_HOURS: 2, // Friends must confirm within 2 hours
  GROUP_BOOKING_FINALIZATION_CUTOFF_HOURS: 1, // Group must be finalized at least 1 hour before booking start
  GROUP_BOOKING_TEAM_SPORTS: ['Main Turf', 'Basketball Court', 'Volleyball Court'], // Sports that require groups
} as const;

export function canUserBook(user: {
  penaltyPoints: number;
  suspendedUntil?: Date;
}): { allowed: boolean; reason?: string } {
  if (user.suspendedUntil && new Date() < new Date(user.suspendedUntil)) {
    return {
      allowed: false,
      reason: `You are suspended until ${new Date(user.suspendedUntil).toLocaleDateString()}`,
    };
  }

  if (user.penaltyPoints >= POLICIES.PENALTY_THRESHOLD_FOR_SUSPENSION) {
    return {
      allowed: false,
      reason: `You have ${user.penaltyPoints} penalty points. Maximum allowed is ${POLICIES.PENALTY_THRESHOLD_FOR_SUSPENSION - 1}.`,
    };
  }

  return { allowed: true };
}

export function calculateSuspensionDate(): Date {
  const date = new Date();
  date.setDate(date.getDate() + POLICIES.SUSPENSION_DAYS);
  return date;
}

export function isWithinAdvanceWindow(startDate: Date): boolean {
  const now = new Date();
  const maxDate = new Date();
  maxDate.setDate(maxDate.getDate() + POLICIES.ADVANCE_BOOKING_DAYS);

  return startDate >= now && startDate <= maxDate;
}

/**
 * Calculate total hours from bookings
 */
export function calculateTotalHours(bookings: Array<{ start: Date; end: Date }>): number {
  return bookings.reduce((total, booking) => {
    const hours = (new Date(booking.end).getTime() - new Date(booking.start).getTime()) / (1000 * 60 * 60);
    return total + hours;
  }, 0);
}

/**
 * Check if there's a gap between bookings
 */
export function hasMinimumGap(
  existingBookings: Array<{ start: Date; end: Date }>,
  newStart: Date,
  newEnd: Date
): boolean {
  const minGapMs = POLICIES.MIN_GAP_BETWEEN_BOOKINGS_MINUTES * 60 * 1000;

  for (const booking of existingBookings) {
    const bookingStart = new Date(booking.start).getTime();
    const bookingEnd = new Date(booking.end).getTime();
    const newStartTime = new Date(newStart).getTime();
    const newEndTime = new Date(newEnd).getTime();

    // Check if new booking is too close to existing booking
    const gapBefore = newStartTime - bookingEnd;
    const gapAfter = bookingStart - newEndTime;

    // If there's an overlap or gap is too small
    if (newStartTime < bookingEnd && newEndTime > bookingStart) {
      return false; // Overlap
    }

    if (gapBefore > 0 && gapBefore < minGapMs) {
      return false; // Gap before is too small
    }

    if (gapAfter > 0 && gapAfter < minGapMs) {
      return false; // Gap after is too small
    }
  }

  return true;
}

/**
 * Check for consecutive bookings
 */
export function hasConsecutiveBookings(
  existingBookings: Array<{ start: Date; end: Date; resourceId: string }>,
  newStart: Date,
  newEnd: Date,
  resourceId: string
): boolean {
  // Get bookings for same resource type
  const sameResourceBookings = existingBookings.filter(b => b.resourceId === resourceId);

  let consecutiveCount = 1; // The new booking itself

  const newStartTime = new Date(newStart).getTime();
  const newEndTime = new Date(newEnd).getTime();

  // Check bookings immediately before
  for (const booking of sameResourceBookings) {
    const bookingEnd = new Date(booking.end).getTime();
    if (Math.abs(bookingEnd - newStartTime) < 60000) { // Within 1 minute (consecutive)
      consecutiveCount++;
    }
  }

  // Check bookings immediately after
  for (const booking of sameResourceBookings) {
    const bookingStart = new Date(booking.start).getTime();
    if (Math.abs(newEndTime - bookingStart) < 60000) { // Within 1 minute (consecutive)
      consecutiveCount++;
    }
  }

  return consecutiveCount > POLICIES.MAX_CONSECUTIVE_SLOTS;
}

/**
 * Calculate dynamic expiration time for group bookings
 * Expiration is the earlier of:
 * 1. Creation time + invitation window (2 hours)
 * 2. Booking start time - cutoff period (1 hour before start)
 * 
 * This ensures:
 * - Bookings far in future: Get full 2 hours to confirm
 * - Bookings starting soon: Must be finalized before start time
 */
export function calculateGroupBookingExpiration(
  bookingStart: Date,
  createdAt: Date = new Date()
): Date {
  const startDate = new Date(bookingStart);
  const createdDate = new Date(createdAt);
  const now = new Date();

  // Calculate expiration based on invitation window (from creation)
  const invitationWindowEnd = new Date(
    createdDate.getTime() + POLICIES.GROUP_BOOKING_INVITATION_EXPIRY_HOURS * 60 * 60 * 1000
  );

  // Calculate expiration based on cutoff before booking start
  const cutoffBeforeStart = new Date(
    startDate.getTime() - POLICIES.GROUP_BOOKING_FINALIZATION_CUTOFF_HOURS * 60 * 60 * 1000
  );

  // Return the earlier of the two
  return new Date(Math.min(invitationWindowEnd.getTime(), cutoffBeforeStart.getTime()));
}

/**
 * Check if a group booking can be created for the given start time
 * Requires at least (cutoff + invitation window) time before booking start
 */
export function canCreateGroupBooking(bookingStart: Date): { allowed: boolean; reason?: string } {
  const startDate = new Date(bookingStart);
  const now = new Date();

  // Minimum time required = cutoff + invitation window
  const minRequiredHours = 
    POLICIES.GROUP_BOOKING_FINALIZATION_CUTOFF_HOURS + 
    POLICIES.GROUP_BOOKING_INVITATION_EXPIRY_HOURS;

  const minRequiredMs = minRequiredHours * 60 * 60 * 1000;
  const timeUntilStart = startDate.getTime() - now.getTime();

  if (timeUntilStart < minRequiredMs) {
    return {
      allowed: false,
      reason: `Group bookings must be created at least ${minRequiredHours} hours before the booking start time (${POLICIES.GROUP_BOOKING_FINALIZATION_CUTOFF_HOURS}h cutoff + ${POLICIES.GROUP_BOOKING_INVITATION_EXPIRY_HOURS}h invitation window)`,
    };
  }

  return { allowed: true };
}

/**
 * Check if a group booking has expired
 * Expired if: expiresAt has passed OR booking start time has passed
 */
export function isGroupBookingExpired(expiresAt: Date, bookingStart: Date): boolean {
  const now = new Date();
  const expiresDate = new Date(expiresAt);
  const startDate = new Date(bookingStart);

  return now > expiresDate || now >= startDate;
}
