import { describe, it, expect } from 'vitest';
import {
  POLICIES,
  calculateGroupBookingExpiration,
  canCreateGroupBooking,
  isGroupBookingExpired,
} from '@/lib/policies';

describe('Group Booking Expiration (Dynamic Logic)', () => {
  describe('calculateGroupBookingExpiration', () => {
    it('should always expire at (start - 5 minutes cutoff)', async () => {
      const now = new Date();
      const bookingStart = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days from now

      const expiresAt = await calculateGroupBookingExpiration(bookingStart, now);

      // NEW LOGIC: Expiry is always (start - 5m cutoff) using dynamic policy
      // Default GROUP_BOOKING_CUTOFF_MINUTES = 5
      const expectedExpiry = new Date(
        bookingStart.getTime() - POLICIES.GROUP_BOOKING_CUTOFF_MINUTES * 60 * 1000
      );
      const diff = Math.abs(expiresAt.getTime() - expectedExpiry.getTime());
      expect(diff).toBeLessThan(1000); // Within 1 second
    });

    it('should give future bookings plenty of time to confirm', async () => {
      const now = new Date();
      const bookingStart = new Date(now.getTime() + 3 * 60 * 60 * 1000); // 3 hours from now

      const expiresAt = await calculateGroupBookingExpiration(bookingStart, now);

      // For a booking 3 hours away, expiry should be before start
      expect(expiresAt.getTime()).toBeGreaterThan(now.getTime());
      expect(expiresAt.getTime()).toBeLessThan(bookingStart.getTime());
    });

    it('should set expiry 5 mins before start for urgent bookings', async () => {
      const now = new Date();
      const bookingStart = new Date(now.getTime() + 45 * 60 * 1000); // 45 minutes from now

      const expiresAt = await calculateGroupBookingExpiration(bookingStart, now);

      // Expiry should be at 45m - 5m = 40m from now (using GROUP_BOOKING_CUTOFF_MINUTES)
      const expectedExpiry = new Date(
        bookingStart.getTime() - POLICIES.GROUP_BOOKING_CUTOFF_MINUTES * 60 * 1000
      );
      const diff = Math.abs(expiresAt.getTime() - expectedExpiry.getTime());
      expect(diff).toBeLessThan(1000);
    });
  });

  describe('canCreateGroupBooking', () => {
    it('should allow booking with 15+ minutes notice', async () => {
      const now = new Date();
      const bookingStart = new Date(now.getTime() + 45 * 60 * 1000); // 45 minutes from now

      const result = await canCreateGroupBooking(bookingStart);
      expect(result.allowed).toBe(true);
    });

    it('should allow booking with exactly minimum required time', async () => {
      const now = new Date();
      // Default: 5 min cutoff + 10 min reply time = 15 minutes minimum
      const minRequiredMinutes =
        POLICIES.GROUP_BOOKING_CUTOFF_MINUTES + POLICIES.GROUP_BOOKING_REPLY_TIME_MINUTES;
      const bookingStart = new Date(now.getTime() + minRequiredMinutes * 60 * 1000);

      const result = await canCreateGroupBooking(bookingStart);
      expect(result.allowed).toBe(true);
    });

    it('should reject booking with less than 15 minutes notice', async () => {
      const now = new Date();
      const bookingStart = new Date(now.getTime() + 5 * 60 * 1000); // Only 5 minutes

      const result = await canCreateGroupBooking(bookingStart);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('minutes');
    });

    it('should reject past bookings', async () => {
      const now = new Date();
      const bookingStart = new Date(now.getTime() - 60 * 60 * 1000); // 1 hour ago

      const result = await canCreateGroupBooking(bookingStart);
      expect(result.allowed).toBe(false);
    });

    it('should allow booking far in future', async () => {
      const now = new Date();
      const bookingStart = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days

      const result = await canCreateGroupBooking(bookingStart);
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
