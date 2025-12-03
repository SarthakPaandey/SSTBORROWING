import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import mongoose from 'mongoose';
import { Booking } from '@/models/Booking';
import { EquipmentItem } from '@/models/EquipmentItem';
import { Resource } from '@/models/Resource';
import { User } from '@/models/User';
import { canBorrowSportCategory, getItemsSportCategories, SPORT_CATEGORIES } from '@/lib/sportCategoryRules';

describe('Sport Category Rules', () => {
    let testUser: any;
    let sportsResource: any;
    let basketballItem: any;
    let badmintonRacketItem: any;
    let shuttlecocksItem: any;
    let cricketBatItem: any;
    let cricketPadsItem: any;
    let generalItem: any;

    beforeEach(async () => {
        // Clear test data
        await User.deleteMany({});
        await Resource.deleteMany({});
        await EquipmentItem.deleteMany({});
        await Booking.deleteMany({});

        // Create test user
        testUser = await User.create({
            name: 'Test User',
            email: 'test@sst.scaler.com',
            role: 'STUDENT',
            penaltyPoints: 0,
        });

        // Create sports equipment resource
        sportsResource = await Resource.create({
            type: 'SPORTS_EQUIPMENT',
            name: 'Sports Equipment',
            location: 'Sports Complex',
            rules: { slotMinutes: 60 },
            status: 'ACTIVE',
        });

        // Create equipment items with sport categories
        basketballItem = await EquipmentItem.create({
            resourceId: sportsResource.id,
            name: 'Basketball',
            qtyTotal: 2,
            qtyAvailable: 2,
            qtyReserved: 0,
            safety: false,
            restricted: false,
            sportCategory: SPORT_CATEGORIES.BASKETBALL,
        });

        badmintonRacketItem = await EquipmentItem.create({
            resourceId: sportsResource.id,
            name: 'Badminton Racket',
            qtyTotal: 6,
            qtyAvailable: 6,
            qtyReserved: 0,
            safety: false,
            restricted: false,
            sportCategory: SPORT_CATEGORIES.BADMINTON,
        });

        shuttlecocksItem = await EquipmentItem.create({
            resourceId: sportsResource.id,
            name: 'Shuttlecocks',
            qtyTotal: 12,
            qtyAvailable: 12,
            qtyReserved: 0,
            safety: false,
            restricted: false,
            sportCategory: SPORT_CATEGORIES.BADMINTON,
        });

        cricketBatItem = await EquipmentItem.create({
            resourceId: sportsResource.id,
            name: 'Cricket Bat',
            qtyTotal: 3,
            qtyAvailable: 3,
            qtyReserved: 0,
            safety: false,
            restricted: false,
            sportCategory: SPORT_CATEGORIES.CRICKET,
        });

        cricketPadsItem = await EquipmentItem.create({
            resourceId: sportsResource.id,
            name: 'Cricket Pads',
            qtyTotal: 2,
            qtyAvailable: 2,
            qtyReserved: 0,
            safety: true,
            restricted: false,
            sportCategory: SPORT_CATEGORIES.CRICKET,
        });

        generalItem = await EquipmentItem.create({
            resourceId: sportsResource.id,
            name: 'Water Bottle',
            qtyTotal: 10,
            qtyAvailable: 10,
            qtyReserved: 0,
            safety: false,
            restricted: false,
            sportCategory: SPORT_CATEGORIES.GENERAL,
        });
    });

    afterEach(async () => {
        await User.deleteMany({});
        await Resource.deleteMany({});
        await EquipmentItem.deleteMany({});
        await Booking.deleteMany({});
    });

    describe('getItemsSportCategories', () => {
        it('should extract sport categories from item IDs', async () => {
            const categories = await getItemsSportCategories([
                basketballItem.id,
                badmintonRacketItem.id,
            ]);

            expect(categories.size).toBe(2);
            expect(categories.has(SPORT_CATEGORIES.BASKETBALL)).toBe(true);
            expect(categories.has(SPORT_CATEGORIES.BADMINTON)).toBe(true);
        });

        it('should handle items from same sport category', async () => {
            const categories = await getItemsSportCategories([
                badmintonRacketItem.id,
                shuttlecocksItem.id,
            ]);

            expect(categories.size).toBe(1);
            expect(categories.has(SPORT_CATEGORIES.BADMINTON)).toBe(true);
        });

        it('should handle GENERAL category items', async () => {
            const categories = await getItemsSportCategories([
                generalItem.id,
            ]);

            expect(categories.size).toBe(1);
            expect(categories.has(SPORT_CATEGORIES.GENERAL)).toBe(true);
        });
    });

    describe('canBorrowSportCategory', () => {
        it('should allow borrowing from one sport when no active bookings', async () => {
            const result = await canBorrowSportCategory({
                userId: testUser.id,
                requestedItemIds: [basketballItem.id],
            });

            expect(result.allowed).toBe(true);
        });

        it('should allow borrowing multiple items from same sport', async () => {
            const result = await canBorrowSportCategory({
                userId: testUser.id,
                requestedItemIds: [badmintonRacketItem.id, shuttlecocksItem.id],
            });

            expect(result.allowed).toBe(true);
        });

        it('should reject borrowing from multiple sports in one booking', async () => {
            const result = await canBorrowSportCategory({
                userId: testUser.id,
                requestedItemIds: [basketballItem.id, badmintonRacketItem.id],
            });

            expect(result.allowed).toBe(false);
            expect(result.reason).toContain('Cannot borrow equipment from multiple sports');
        });

        it('should reject borrowing different sport when active booking exists', async () => {
            // Create active basketball booking
            const startTime = new Date();
            startTime.setHours(startTime.getHours() + 1);
            const endTime = new Date(startTime);
            endTime.setMinutes(endTime.getMinutes() + 75);

            await Booking.create({
                userId: testUser.id,
                resourceId: sportsResource.id,
                kind: 'EQUIPMENT',
                items: [{ itemId: basketballItem.id, name: 'Basketball', qty: 1 }],
                start: startTime,
                end: endTime,
                status: 'CONFIRMED',
                qrIssued: false,
            });

            // Try to borrow badminton
            const result = await canBorrowSportCategory({
                userId: testUser.id,
                requestedItemIds: [badmintonRacketItem.id],
            });

            expect(result.allowed).toBe(false);
            expect(result.reason).toContain('BASKETBALL');
            expect(result.reason).toContain('BADMINTON');
            expect(result.conflictingSport).toBe(SPORT_CATEGORIES.BASKETBALL);
        });

        it('should allow borrowing same sport when active booking exists', async () => {
            // Create active basketball booking
            const startTime = new Date();
            startTime.setHours(startTime.getHours() + 1);
            const endTime = new Date(startTime);
            endTime.setMinutes(endTime.getMinutes() + 75);

            await Booking.create({
                userId: testUser.id,
                resourceId: sportsResource.id,
                kind: 'EQUIPMENT',
                items: [{ itemId: basketballItem.id, name: 'Basketball', qty: 1 }],
                start: startTime,
                end: endTime,
                status: 'CONFIRMED',
                qrIssued: false,
            });

            // Try to borrow another basketball (if available)
            const result = await canBorrowSportCategory({
                userId: testUser.id,
                requestedItemIds: [basketballItem.id],
            });

            expect(result.allowed).toBe(true);
        });

        it('should allow GENERAL category items with any sport', async () => {
            // Create active basketball booking
            const startTime = new Date();
            startTime.setHours(startTime.getHours() + 1);
            const endTime = new Date(startTime);
            endTime.setMinutes(endTime.getMinutes() + 75);

            await Booking.create({
                userId: testUser.id,
                resourceId: sportsResource.id,
                kind: 'EQUIPMENT',
                items: [{ itemId: basketballItem.id, name: 'Basketball', qty: 1 }],
                start: startTime,
                end: endTime,
                status: 'CONFIRMED',
                qrIssued: false,
            });

            // Try to borrow general item
            const result = await canBorrowSportCategory({
                userId: testUser.id,
                requestedItemIds: [generalItem.id],
            });

            expect(result.allowed).toBe(true);
        });

        it('should allow borrowing sport items with GENERAL category', async () => {
            const result = await canBorrowSportCategory({
                userId: testUser.id,
                requestedItemIds: [basketballItem.id, generalItem.id],
            });

            expect(result.allowed).toBe(true);
        });

        it('should only check CONFIRMED, CHECKED_IN, and PENDING bookings', async () => {
            // Create cancelled basketball booking
            const startTime = new Date();
            startTime.setHours(startTime.getHours() + 1);
            const endTime = new Date(startTime);
            endTime.setMinutes(endTime.getMinutes() + 75);

            await Booking.create({
                userId: testUser.id,
                resourceId: sportsResource.id,
                kind: 'EQUIPMENT',
                items: [{ itemId: basketballItem.id, name: 'Basketball', qty: 1 }],
                start: startTime,
                end: endTime,
                status: 'CANCELLED',
                qrIssued: false,
            });

            // Should allow borrowing badminton (basketball booking is cancelled)
            const result = await canBorrowSportCategory({
                userId: testUser.id,
                requestedItemIds: [badmintonRacketItem.id],
            });

            expect(result.allowed).toBe(true);
        });

        it('should check PENDING bookings for conflicts', async () => {
            // Create PENDING basketball booking (lab equipment awaiting approval)
            const startTime = new Date();
            startTime.setHours(startTime.getHours() + 1);
            const endTime = new Date(startTime);
            endTime.setMinutes(endTime.getMinutes() + 75);

            await Booking.create({
                userId: testUser.id,
                resourceId: sportsResource.id,
                kind: 'EQUIPMENT',
                items: [{ itemId: basketballItem.id, name: 'Basketball', qty: 1 }],
                start: startTime,
                end: endTime,
                status: 'PENDING',
                requiresApproval: true,
                approval: 'PENDING',
                qrIssued: false,
            });

            // Should block badminton booking
            const result = await canBorrowSportCategory({
                userId: testUser.id,
                requestedItemIds: [badmintonRacketItem.id],
            });

            expect(result.allowed).toBe(false);
            expect(result.conflictingSport).toBe(SPORT_CATEGORIES.BASKETBALL);
        });

        it('should allow multiple cricket items in one booking', async () => {
            const result = await canBorrowSportCategory({
                userId: testUser.id,
                requestedItemIds: [cricketBatItem.id, cricketPadsItem.id],
            });

            expect(result.allowed).toBe(true);
        });
    });
});
