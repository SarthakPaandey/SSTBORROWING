import { describe, it, expect, beforeEach } from 'vitest';
import { POLICIES, canUserBook, calculateSuspensionDate, isWithinAdvanceWindow } from '@/lib/policies';

describe('Policies', () => {
  describe('canUserBook', () => {
    it('should allow booking for user with no penalties', () => {
      const user = { penaltyPoints: 0 };
      const result = canUserBook(user);
      expect(result.allowed).toBe(true);
    });

    it('should block user with penalty points at threshold', () => {
      const user = { penaltyPoints: POLICIES.PENALTY_THRESHOLD_FOR_SUSPENSION };
      const result = canUserBook(user);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('penalty points');
    });

    it('should block user with penalty points above threshold', () => {
      const user = { penaltyPoints: POLICIES.PENALTY_THRESHOLD_FOR_SUSPENSION + 1 };
      const result = canUserBook(user);
      expect(result.allowed).toBe(false);
    });

    it('should block suspended user', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);
      const user = { penaltyPoints: 0, suspendedUntil: futureDate };
      const result = canUserBook(user);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('suspended');
    });

    it('should allow user whose suspension expired', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);
      const user = { penaltyPoints: 0, suspendedUntil: pastDate };
      const result = canUserBook(user);
      expect(result.allowed).toBe(true);
    });
  });

  describe('calculateSuspensionDate', () => {
    it('should return date SUSPENSION_DAYS in the future', () => {
      const suspensionDate = calculateSuspensionDate();
      const expectedDate = new Date();
      expectedDate.setDate(expectedDate.getDate() + POLICIES.SUSPENSION_DAYS);
      
      // Allow 1 second difference for execution time
      const diff = Math.abs(suspensionDate.getTime() - expectedDate.getTime());
      expect(diff).toBeLessThan(1000);
    });
  });

  describe('isWithinAdvanceWindow', () => {
    it('should allow booking within advance window', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 5);
      expect(isWithinAdvanceWindow(futureDate)).toBe(true);
    });

    it('should reject booking beyond advance window', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + POLICIES.ADVANCE_BOOKING_DAYS + 1);
      expect(isWithinAdvanceWindow(futureDate)).toBe(false);
    });

    it('should reject past bookings', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);
      expect(isWithinAdvanceWindow(pastDate)).toBe(false);
    });
  });
});

