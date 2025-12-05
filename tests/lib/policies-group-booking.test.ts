import { describe, it, expect } from 'vitest';
import {
  POLICIES,
  calculateGroupBookingExpiration,
  canCreateGroupBooking,
  isGroupBookingExpired,
} from '@/lib/policies';

describe('Group Booking Expiration (Dynamic Logic)', () => {
  describe('calculateGroupBookingExpiration', () => {
    it('should always expire at (start - 15 minutes cutoff)', () => {
      const now = new Date();
      const bookingStart = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days from now

      const expiresAt = calculateGroupBookingExpiration(bookingStart, now);

      // NEW LOGIC: Expiry is always (start - 15m cutoff)
      const expectedExpiry = new Date(
        bookingStart.getTime() - POLICIES.GROUP_BOOKING_FINALIZATION_CUTOFF_HOURS * 60 * 60 * 1000
      );
      const diff = Math.abs(expiresAt.getTime() - expectedExpiry.getTime());
      expect(diff).toBeLessThan(1000); // Within 1 second
    });

    it('should give future bookings plenty of time to confirm', () => {
      const now = new Date();
      const bookingStart = new Date(now.getTime() + 3 * 60 * 60 * 1000); // 3 hours from now

      const expiresAt = calculateGroupBookingExpiration(bookingStart, now);

      // For a booking 3 hours away, expiry should be at 3h - 15m = 2h45m from now
      expect(expiresAt.getTime()).toBeGreaterThan(now.getTime());
      expect(expiresAt.getTime()).toBeLessThan(bookingStart.getTime());
    });

    it('should set expiry 15 mins before start for urgent bookings', () => {
      const now = new Date();
      const bookingStart = new Date(now.getTime() + 45 * 60 * 1000); // 45 minutes from now

      const expiresAt = calculateGroupBookingExpiration(bookingStart, now);

      // Expiry should be at 45m - 15m = 30m from now
      const expectedExpiry = new Date(
        bookingStart.getTime() - POLICIES.GROUP_BOOKING_FINALIZATION_CUTOFF_HOURS * 60 * 60 * 1000
      );
      const diff = Math.abs(expiresAt.getTime() - expectedExpiry.getTime());
      expect(diff).toBeLessThan(1000);
    });
  });

  describe('canCreateGroupBooking', () => {
    it('should allow booking with 30+ minutes notice', () => {
      const now = new Date();
      const bookingStart = new Date(now.getTime() + 45 * 60 * 1000); // 45 minutes from now

      const result = canCreateGroupBooking(bookingStart);
      expect(result.allowed).toBe(true);
    });

    it('should allow booking with exactly 30 minutes notice', () => {
      const now = new Date();
      const minRequiredHours =
        POLICIES.GROUP_BOOKING_FINALIZATION_CUTOFF_HOURS + POLICIES.GROUP_BOOKING_MIN_REPLY_TIME_HOURS;
      const bookingStart = new Date(now.getTime() + minRequiredHours * 60 * 60 * 1000); // Exactly 30 mins

      const result = canCreateGroupBooking(bookingStart);
      expect(result.allowed).toBe(true);
    });

    it('should reject booking with less than 30 minutes notice', () => {
      const now = new Date();
      const bookingStart = new Date(now.getTime() + 20 * 60 * 1000); // Only 20 minutes

      const result = canCreateGroupBooking(bookingStart);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('30 minutes');
    });

    it('should reject past bookings', () => {
      const now = new Date();
      const bookingStart = new Date(now.getTime() - 60 * 60 * 1000); // 1 hour ago

      const result = canCreateGroupBooking(bookingStart);
      expect(result.allowed).toBe(false);
    });

    it('should allow booking far in future', () => {
      const now = new Date();
      const bookingStart = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days

      const result = canCreateGroupBooking(bookingStart);
      expect(result.allowed).toBe(true);
    });
  });

  describe('isGroupBookingExpired', () => {
    it('should return false if neither condition is met', () => {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour from now
      const bookingStart = new Date(now.getTime() + 2 * 60 * 60 * 1000); // 2 hours from now

      expect(isGroupBookingExpired(expiresAt, bookingStart)).toBe(false);
    });

    it('should return true if expiresAt has passed', () => {
      const now = new Date();
      const expiresAt = new Date(now.getTime() - 60 * 60 * 1000); // 1 hour ago
      const bookingStart = new Date(now.getTime() + 2 * 60 * 60 * 1000); // 2 hours from now

      expect(isGroupBookingExpired(expiresAt, bookingStart)).toBe(true);
    });

    it('should return true if booking start has passed', () => {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour from now
      const bookingStart = new Date(now.getTime() - 30 * 60 * 1000); // 30 minutes ago

      expect(isGroupBookingExpired(expiresAt, bookingStart)).toBe(true);
    });

    it('should return true if booking start is exactly now', () => {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour from now
      const bookingStart = new Date(now.getTime()); // Exactly now

      expect(isGroupBookingExpired(expiresAt, bookingStart)).toBe(true);
    });
  });
});
