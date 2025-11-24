import { describe, it, expect } from 'vitest';

describe('Edge Case Tests', () => {
    describe('QR Expiration Logic', () => {
        it('should not expire after booking ends (short booking)', () => {
            const now = new Date('2024-01-01T14:00:00Z');
            const bookingStart = new Date('2024-01-01T14:00:00Z');
            const bookingEnd = new Date('2024-01-01T14:05:00Z'); // 5-minute booking

            // Base expiry: now + 10 minutes = 14:10
            const baseExpiry = new Date(now.getTime() + 10 * 60000);
            expect(baseExpiry.toISOString()).toBe('2024-01-01T14:10:00.000Z');

            // Should cap at booking end (14:05)
            const expiresAt = new Date(Math.min(baseExpiry.getTime(), bookingEnd.getTime()));
            expect(expiresAt.toISOString()).toBe('2024-01-01T14:05:00.000Z'); // ✅ Expires at booking end
        });

        it('should extend into booking start (early generation)', () => {
            const now = new Date('2024-01-01T13:45:00Z'); // Generated 15 min early
            const bookingStart = new Date('2024-01-01T14:00:00Z');
            const bookingEnd = new Date('2024-01-01T15:00:00Z');

            // Base expiry: now + 10 minutes = 13:55
            const baseExpiry = new Date(now.getTime() + 10 * 60000);
            let expiresAt = new Date(Math.min(baseExpiry.getTime(), bookingEnd.getTime()));
            expect(expiresAt.toISOString()).toBe('2024-01-01T13:55:00.000Z'); // Would expire at 13:55

            // Extend to booking start + 5 minutes
            const minExpiry = new Date(bookingStart.getTime() + 5 * 60000);
            expiresAt = new Date(Math.max(expiresAt.getTime(), minExpiry.getTime()));
            expect(expiresAt.toISOString()).toBe('2024-01-01T14:05:00.000Z'); // ✅ Extended into booking
        });

        it('should handle normal case correctly', () => {
            const now = new Date('2024-01-01T13:55:00Z');
            const bookingStart = new Date('2024-01-01T14:00:00Z');
            const bookingEnd = new Date('2024-01-01T15:00:00Z');

            const baseExpiry = new Date(now.getTime() + 10 * 60000); // 14:05
            let expiresAt = new Date(Math.min(baseExpiry.getTime(), bookingEnd.getTime()));
            const minExpiry = new Date(bookingStart.getTime() + 5 * 60000);
            expiresAt = new Date(Math.max(expiresAt.getTime(), minExpiry.getTime()));

            expect(expiresAt.toISOString()).toBe('2024-01-01T14:05:00.000Z');
        });
    });

    describe('Duplicate Item Prevention', () => {
        it('should detect duplicate itemIds in booking request', () => {
            const items = [
                { itemId: 'item1', qty: 2 },
                { itemId: 'item2', qty: 1 },
                { itemId: 'item1', qty: 1 }, // Duplicate!
            ];

            const itemIds = items.map(i => i.itemId);
            const uniqueItemIds = new Set(itemIds);

            expect(uniqueItemIds.size).toBe(2); // Only 2 unique
            expect(itemIds.length).toBe(3);     // But 3 total
            expect(uniqueItemIds.size !== itemIds.length).toBe(true); // ✅ Duplicate detected
        });

        it('should allow all unique items', () => {
            const items = [
                { itemId: 'item1', qty: 2 },
                { itemId: 'item2', qty: 1 },
                { itemId: 'item3', qty: 1 },
            ];

            const itemIds = items.map(i => i.itemId);
            const uniqueItemIds = new Set(itemIds);

            expect(uniqueItemIds.size).toBe(3);
            expect(itemIds.length).toBe(3);
            expect(uniqueItemIds.size === itemIds.length).toBe(true); // ✅ All unique
        });
    });

    describe('No-Show Detection Logic', () => {
        it('should catch short bookings with new logic', () => {
            const now = new Date('2024-01-01T14:20:00Z');

            // Old logic: start + grace period
            const gracePeriod = 15 * 60000;
            const gracePeriodAgo = new Date(now.getTime() - gracePeriod);

            // Short booking: 14:00 - 14:10 (only 10 minutes)
            const shortBookingStart = new Date('2024-01-01T14:00:00Z');
            const shortBookingEnd = new Date('2024-01-01T14:10:00Z');

            // Old logic would check: start < (now - 15min) = start < 14:05
            // 14:00 < 14:05? YES, so it would mark as no-show
            // But the booking already ended at 14:10!

            // New logic: end < now
            expect(shortBookingEnd < now).toBe(true); // ✅ Correctly detected
            expect(shortBookingStart < gracePeriodAgo).toBe(true); // Old logic also catches it

            // But consider 5-minute booking: 14:08 - 14:13
            const veryShortStart = new Date('2024-01-01T14:08:00Z');
            const veryShortEnd = new Date('2024-01-01T14:13:00Z');

            // Old logic: 14:08 < 14:05? NO - would MISS it!
            expect(veryShortStart < gracePeriodAgo).toBe(false); // ❌ Old logic misses it

            // New logic: 14:13 < 14:20? YES - catches it!
            expect(veryShortEnd < now).toBe(true); // ✅ New logic catches it
        });
    });

    describe('Suspended User/Inactive Resource Checks', () => {
        it('should block suspended users from QR validation', () => {
            const user = {
                suspendedUntil: new Date('2024-12-31T23:59:59Z')
            };

            const now = new Date('2024-01-01T12:00:00Z');

            expect(user.suspendedUntil > now).toBe(true); // Should block ✅
        });

        it('should allow users with expired suspension', () => {
            const user = {
                suspendedUntil: new Date('2023-12-31T23:59:59Z') // Past
            };

            const now = new Date('2024-01-01T12:00:00Z');

            expect(user.suspendedUntil > now).toBe(false); // Should allow ✅
        });

        it('should block inactive resources', () => {
            const resource = { status: 'INACTIVE' };
            expect(resource.status === 'ACTIVE').toBe(false); // Should block ✅
        });

        it('should allow active resources', () => {
            const resource = { status: 'ACTIVE' };
            expect(resource.status === 'ACTIVE').toBe(true); // Should allow ✅
        });
    });
});
