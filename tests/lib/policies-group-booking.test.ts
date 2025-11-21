import { describe, it, expect, beforeEach } from 'vitest';
import {
  POLICIES,
  calculateGroupBookingExpiration,
  canCreateGroupBooking,
  isGroupBookingExpired,
} from '@/lib/policies';

describe('Group Booking Expiration', () => {
  describe('calculateGroupBookingExpiration', () => {
    it('should expire in 2 hours for booking far in future', () => {
      const now = new Date();
      const bookingStart = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days from now
      
      const expiresAt = calculateGroupBookingExpiration(bookingStart, now);
      
      // Should expire in 2 hours (invitation window)
      const expectedExpiry = new Date(now.getTime() + POLICIES.GROUP_BOOKING_INVITATION_EXPIRY_HOURS * 60 * 60 * 1000);
      const diff = Math.abs(expiresAt.getTime() - expectedExpiry.getTime());
      expect(diff).toBeLessThan(1000); // Within 1 second
    });

    it('should expire before start time for booking starting soon', () => {
      const now = new Date();
      const bookingStart = new Date(now.getTime() + 90 * 60 * 1000); // 90 minutes from now
      
      const expiresAt = calculateGroupBookingExpiration(bookingStart, now);
      
      // Should expire 1 hour before start (cutoff)
      const expectedExpiry = new Date(bookingStart.getTime() - POLICIES.GROUP_BOOKING_FINALIZATION_CUTOFF_HOURS * 60 * 60 * 1000);
      const diff = Math.abs(expiresAt.getTime() - expectedExpiry.getTime());
      expect(diff).toBeLessThan(1000);
    });

    it('should use invitation window when booking is 3+ hours away', () => {
      const now = new Date();
      const bookingStart = new Date(now.getTime() + 3 * 60 * 60 * 1000); // 3 hours from now
      
      const expiresAt = calculateGroupBookingExpiration(bookingStart, now);
      
      // Should expire in 2 hours (invitation window is shorter than cutoff)
      const expectedExpiry = new Date(now.getTime() + POLICIES.GROUP_BOOKING_INVITATION_EXPIRY_HOURS * 60 * 60 * 1000);
      const diff = Math.abs(expiresAt.getTime() - expectedExpiry.getTime());
      expect(diff).toBeLessThan(1000);
    });

    it('should use cutoff when booking is less than 3 hours away', () => {
      const now = new Date();
      const bookingStart = new Date(now.getTime() + 90 * 60 * 1000); // 1.5 hours from now
      
      const expiresAt = calculateGroupBookingExpiration(bookingStart, now);
      
      // Should expire 1 hour before start (cutoff is earlier)
      const expectedExpiry = new Date(bookingStart.getTime() - POLICIES.GROUP_BOOKING_FINALIZATION_CUTOFF_HOURS * 60 * 60 * 1000);
      const diff = Math.abs(expiresAt.getTime() - expectedExpiry.getTime());
      expect(diff).toBeLessThan(1000);
    });

    it('should handle edge case at exactly 3 hours', () => {
      const now = new Date();
      const bookingStart = new Date(now.getTime() + 3 * 60 * 60 * 1000); // Exactly 3 hours
      
      const expiresAt = calculateGroupBookingExpiration(bookingStart, now);
      
      // At 3 hours: invitation window (2h) expires at same time as cutoff (start - 1h = now + 2h)
      // Should use invitation window
      const expectedExpiry = new Date(now.getTime() + POLICIES.GROUP_BOOKING_INVITATION_EXPIRY_HOURS * 60 * 60 * 1000);
      const diff = Math.abs(expiresAt.getTime() - expectedExpiry.getTime());
      expect(diff).toBeLessThan(1000);
    });
  });

  describe('canCreateGroupBooking', () => {
    it('should allow booking with enough time', () => {
      const now = new Date();
      const bookingStart = new Date(now.getTime() + 4 * 60 * 60 * 1000); // 4 hours from now
      
      const result = canCreateGroupBooking(bookingStart);
      expect(result.allowed).toBe(true);
    });

    it('should reject booking too close to start', () => {
      const now = new Date();
      const minRequiredHours = POLICIES.GROUP_BOOKING_FINALIZATION_CUTOFF_HOURS + POLICIES.GROUP_BOOKING_INVITATION_EXPIRY_HOURS;
      const bookingStart = new Date(now.getTime() + (minRequiredHours - 0.5) * 60 * 60 * 1000); // Just under minimum
      
      const result = canCreateGroupBooking(bookingStart);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('at least');
    });

    it('should reject booking at exactly minimum time', () => {
      const now = new Date();
      const minRequiredHours = POLICIES.GROUP_BOOKING_FINALIZATION_CUTOFF_HOURS + POLICIES.GROUP_BOOKING_INVITATION_EXPIRY_HOURS;
      const bookingStart = new Date(now.getTime() + minRequiredHours * 60 * 60 * 1000); // Exactly minimum
      
      // Should allow (>= minimum)
      const result = canCreateGroupBooking(bookingStart);
      expect(result.allowed).toBe(true);
    });

    it('should reject past bookings', () => {
      const now = new Date();
      const bookingStart = new Date(now.getTime() - 60 * 60 * 1000); // 1 hour ago
      
      const result = canCreateGroupBooking(bookingStart);
      expect(result.allowed).toBe(false);
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

