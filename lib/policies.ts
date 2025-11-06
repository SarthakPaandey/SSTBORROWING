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

  // Advance booking window
  ADVANCE_BOOKING_DAYS: 7,

  // Slot durations (minutes)
  FACILITY_SLOT_MINUTES: 60,
  ROOM_SLOT_MINUTES: 120,
  EQUIPMENT_BORROW_MINUTES: 60,
  GYM_SLOT_MINUTES: 30,

  // Auto-cancel timings
  NO_SHOW_GRACE_MINUTES: 15,

  // QR validity windows (minutes)
  QR_VALIDITY_BEFORE_START: 10,
  QR_VALIDITY_AFTER_START: 15,
  QR_EQUIPMENT_PICKUP_WINDOW: 10,

  // Penalties
  PENALTY_NO_SHOW: 1,
  PENALTY_LATE_RETURN: 1,
  PENALTY_DAMAGE: 2,
  PENALTY_THRESHOLD_FOR_SUSPENSION: 5,
  SUSPENSION_DAYS: 7,

  // Special rules
  SHARED_TURF_GROUP_ID: 'TURF-1', // Football & Cricket share this
  LAB_EQUIPMENT_REQUIRES_APPROVAL: true,
  LAB_EQUIPMENT_STUDENTS_ONLY: true,
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
