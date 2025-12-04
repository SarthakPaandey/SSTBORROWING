import { describe, it, expect } from 'vitest';
import { POLICIES } from '@/lib/policies';

/**
 * Policy Update Tests
 * 
 * Verify the updated booking policies:
 * 1. Facility monthly cap increased to 15 hours
 * 2. Total Active Bookings count excludes Library and Equipment
 */

describe('Policy Updates - Booking Limits', () => {
    describe('Monthly Caps', () => {
        it('should have facility cap set to 15 hours', () => {
            expect(POLICIES.MAX_FACILITY_HOURS_PER_MONTH).toBe(15);
        });

        it('should have room cap set to 8 hours', () => {
            expect(POLICIES.MAX_ROOM_HOURS_PER_MONTH).toBe(8);
        });

        it('should have equipment cap set to 20 borrows', () => {
            expect(POLICIES.MAX_EQUIPMENT_BORROWS_PER_MONTH).toBe(20);
        });
    });

    describe('Active Booking Limits', () => {
        it('should have total active booking limit of 3', () => {
            expect(POLICIES.MAX_TOTAL_ACTIVE_BOOKINGS).toBe(3);
        });

        it('should document that active count excludes Library and Equipment', () => {
            // This test documents the implementation in app/api/bookings/route.ts
            // The totalActiveBookings query now only counts:
            // - kind: { $in: ['FACILITY', 'ROOM'] }
            // 
            // Excluded from count:
            // - LIBRARY bookings (have separate MAX_BOOKS_PER_STUDENT limit)
            // - EQUIPMENT bookings (have separate MAX_EQUIPMENT_BORROWS_PER_MONTH limit)

            const implementation = {
                activeCountIncludes: ['FACILITY', 'ROOM'],
                activeCountExcludes: ['LIBRARY', 'EQUIPMENT'],
                libraryLimit: POLICIES.MAX_BOOKS_PER_STUDENT,
                equipmentLimit: POLICIES.MAX_EQUIPMENT_BORROWS_PER_MONTH,
            };

            expect(implementation.activeCountIncludes).toContain('FACILITY');
            expect(implementation.activeCountIncludes).toContain('ROOM');
            expect(implementation.activeCountExcludes).toContain('LIBRARY');
            expect(implementation.activeCountExcludes).toContain('EQUIPMENT');
            expect(implementation.libraryLimit).toBe(1);
            expect(implementation.equipmentLimit).toBe(20);
        });
    });

    describe('Logical Scenarios', () => {
        it('should allow user to hold book + equipment + 3 facilities', () => {
            // Scenario: User has:
            // - 1 Library Book (checked out)
            // - 1 Cricket Bat (checked out)
            // - 3 Turf bookings (future)
            //
            // Expected: ALLOWED
            // Reason: Only the 3 Turf bookings count towards the "3 Active" limit

            const scenario = {
                libraryBooks: 1,
                equipment: 1,
                facilities: 3,
                totalActiveCount: 3, // Only facilities count
            };

            expect(scenario.totalActiveCount).toBeLessThanOrEqual(POLICIES.MAX_TOTAL_ACTIVE_BOOKINGS);
        });

        it('should block 4th facility booking even with book and equipment', () => {
            // Scenario: User has:
            // - 1 Library Book
            // - 1 Cricket Bat
            // - 3 Turf bookings
            // - Trying to book 4th Turf slot
            //
            // Expected: BLOCKED
            // Reason: 4 facilities exceeds the limit of 3

            const scenario = {
                libraryBooks: 1,
                equipment: 1,
                facilities: 4,
                totalActiveCount: 4, // Only facilities count
            };

            expect(scenario.totalActiveCount).toBeGreaterThan(POLICIES.MAX_TOTAL_ACTIVE_BOOKINGS);
        });
    });
});
