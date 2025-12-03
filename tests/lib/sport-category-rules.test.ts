import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Booking } from '@/models/Booking';
import { EquipmentItem } from '@/models/EquipmentItem';
import { Resource } from '@/models/Resource';
import { User } from '@/models/User';
import { canBorrowSportCategory, getItemsSportCategories, SPORT_CATEGORIES } from '@/lib/sportCategoryRules';

// Mock data
const mockUser = { id: 'user-1', name: 'Test User', role: 'STUDENT' };
const mockSportsResource = { id: 'resource-1', type: 'SPORTS_EQUIPMENT' };

const mockBasketball = { id: 'item-1', name: 'Basketball', sportCategory: 'BASKETBALL' };
const mockBadminton = { id: 'item-2', name: 'Badminton', sportCategory: 'BADMINTON' };
const mockShuttlecocks = { id: 'item-3', name: 'Shuttlecocks', sportCategory: 'BADMINTON' };
const mockCricketBat = { id: 'item-4', name: 'Cricket Bat', sportCategory: 'CRICKET' };
const mockCricketPads = { id: 'item-5', name: 'Cricket Pads', sportCategory: 'CRICKET' };
const mockGeneral = { id: 'item-6', name: 'Water Bottle', sportCategory: 'GENERAL' };

const allItems = [
    mockBasketball,
    mockBadminton,
    mockShuttlecocks,
    mockCricketBat,
    mockCricketPads,
    mockGeneral
];

// Mock models
vi.mock('@/models/Booking', () => ({
    Booking: {
        find: vi.fn(),
        deleteMany: vi.fn(),
        create: vi.fn(),
    }
}));

vi.mock('@/models/EquipmentItem', () => ({
    EquipmentItem: {
        find: vi.fn(),
        deleteMany: vi.fn(),
        create: vi.fn(),
    }
}));

vi.mock('@/models/User', () => ({
    User: {
        create: vi.fn(),
        deleteMany: vi.fn(),
    }
}));

vi.mock('@/models/Resource', () => ({
    Resource: {
        create: vi.fn(),
        deleteMany: vi.fn(),
    }
}));

describe('Sport Category Rules', () => {
    let mockBookings: any[] = [];

    beforeEach(() => {
        mockBookings = [];
        vi.clearAllMocks();

        // Setup User mock
        (User.create as any).mockResolvedValue(mockUser);

        // Setup Resource mock
        (Resource.create as any).mockResolvedValue(mockSportsResource);

        // Setup EquipmentItem mocks
        (EquipmentItem.create as any).mockImplementation((data: any) => Promise.resolve({ ...data, id: 'mock-id' }));
        (EquipmentItem.find as any).mockImplementation((query: any) => {
            if (query._id && query._id.$in) {
                return Promise.resolve(allItems.filter(i => query._id.$in.includes(i.id)));
            }
            return Promise.resolve([]);
        });

        // Setup Booking mocks
        (Booking.create as any).mockImplementation((booking: any) => {
            const newBooking = { ...booking, _id: 'booking-' + Math.random() };
            mockBookings.push(newBooking);
            return Promise.resolve(newBooking);
        });
        (Booking.find as any).mockImplementation((query: any) => {
            // Filter mockBookings based on query
            // This is a simplified filter for the test cases
            let results = mockBookings;

            if (query.userId) {
                results = results.filter(b => b.userId === query.userId);
            }

            if (query.kind) {
                results = results.filter(b => b.kind === query.kind);
            }

            if (query.status && query.status.$in) {
                results = results.filter(b => query.status.$in.includes(b.status));
            }

            return Promise.resolve(results);
        });
    });

    describe('getItemsSportCategories', () => {
        it('should extract sport categories from item IDs', async () => {
            const categories = await getItemsSportCategories([
                mockBasketball.id,
                mockBadminton.id,
            ]);

            expect(categories.size).toBe(2);
            expect(categories.has(SPORT_CATEGORIES.BASKETBALL)).toBe(true);
            expect(categories.has(SPORT_CATEGORIES.BADMINTON)).toBe(true);
        });

        it('should handle items from same sport category', async () => {
            const categories = await getItemsSportCategories([
                mockBadminton.id,
                mockShuttlecocks.id,
            ]);

            expect(categories.size).toBe(1);
            expect(categories.has(SPORT_CATEGORIES.BADMINTON)).toBe(true);
        });

        it('should handle GENERAL category items', async () => {
            const categories = await getItemsSportCategories([
                mockGeneral.id,
            ]);

            expect(categories.size).toBe(1);
            expect(categories.has(SPORT_CATEGORIES.GENERAL)).toBe(true);
        });
    });

    describe('canBorrowSportCategory', () => {
        it('should allow borrowing from one sport when no active bookings', async () => {
            const result = await canBorrowSportCategory({
                userId: mockUser.id,
                requestedItemIds: [mockBasketball.id],
            });

            expect(result.allowed).toBe(true);
        });

        it('should allow borrowing multiple items from same sport', async () => {
            const result = await canBorrowSportCategory({
                userId: mockUser.id,
                requestedItemIds: [mockBadminton.id, mockShuttlecocks.id],
            });

            expect(result.allowed).toBe(true);
        });

        it('should reject borrowing from multiple sports in one booking', async () => {
            const result = await canBorrowSportCategory({
                userId: mockUser.id,
                requestedItemIds: [mockBasketball.id, mockBadminton.id],
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
                userId: mockUser.id,
                resourceId: mockSportsResource.id,
                kind: 'EQUIPMENT',
                items: [{ itemId: mockBasketball.id, name: 'Basketball', qty: 1 }],
                start: startTime,
                end: endTime,
                status: 'CONFIRMED',
                qrIssued: false,
            });

            // Try to borrow badminton
            const result = await canBorrowSportCategory({
                userId: mockUser.id,
                requestedItemIds: [mockBadminton.id],
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
                userId: mockUser.id,
                resourceId: mockSportsResource.id,
                kind: 'EQUIPMENT',
                items: [{ itemId: mockBasketball.id, name: 'Basketball', qty: 1 }],
                start: startTime,
                end: endTime,
                status: 'CONFIRMED',
                qrIssued: false,
            });

            // Try to borrow another basketball (if available)
            const result = await canBorrowSportCategory({
                userId: mockUser.id,
                requestedItemIds: [mockBasketball.id],
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
                userId: mockUser.id,
                resourceId: mockSportsResource.id,
                kind: 'EQUIPMENT',
                items: [{ itemId: mockBasketball.id, name: 'Basketball', qty: 1 }],
                start: startTime,
                end: endTime,
                status: 'CONFIRMED',
                qrIssued: false,
            });

            // Try to borrow general item
            const result = await canBorrowSportCategory({
                userId: mockUser.id,
                requestedItemIds: [mockGeneral.id],
            });

            expect(result.allowed).toBe(true);
        });

        it('should allow borrowing sport items with GENERAL category', async () => {
            const result = await canBorrowSportCategory({
                userId: mockUser.id,
                requestedItemIds: [mockBasketball.id, mockGeneral.id],
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
                userId: mockUser.id,
                resourceId: mockSportsResource.id,
                kind: 'EQUIPMENT',
                items: [{ itemId: mockBasketball.id, name: 'Basketball', qty: 1 }],
                start: startTime,
                end: endTime,
                status: 'CANCELLED',
                qrIssued: false,
            });

            // Should allow borrowing badminton (basketball booking is cancelled)
            const result = await canBorrowSportCategory({
                userId: mockUser.id,
                requestedItemIds: [mockBadminton.id],
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
                userId: mockUser.id,
                resourceId: mockSportsResource.id,
                kind: 'EQUIPMENT',
                items: [{ itemId: mockBasketball.id, name: 'Basketball', qty: 1 }],
                start: startTime,
                end: endTime,
                status: 'PENDING',
                requiresApproval: true,
                approval: 'PENDING',
                qrIssued: false,
            });

            // Should block badminton booking
            const result = await canBorrowSportCategory({
                userId: mockUser.id,
                requestedItemIds: [mockBadminton.id],
            });

            expect(result.allowed).toBe(false);
            expect(result.conflictingSport).toBe(SPORT_CATEGORIES.BASKETBALL);
        });

        it('should allow multiple cricket items in one booking', async () => {
            const result = await canBorrowSportCategory({
                userId: mockUser.id,
                requestedItemIds: [mockCricketBat.id, mockCricketPads.id],
            });

            expect(result.allowed).toBe(true);
        });
    });
});
