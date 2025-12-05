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

// Helper to create a time range starting X hours from now
function getTimeRange(hoursFromNow: number, durationMinutes: number = 75) {
    const start = new Date();
    start.setHours(start.getHours() + hoursFromNow);
    const end = new Date(start);
    end.setMinutes(end.getMinutes() + durationMinutes);
    return { start, end };
}

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

        // Setup Booking mocks with TIME-BASED filtering
        (Booking.create as any).mockImplementation((booking: any) => {
            const newBooking = { ...booking, _id: 'booking-' + Math.random() };
            mockBookings.push(newBooking);
            return Promise.resolve(newBooking);
        });
        (Booking.find as any).mockImplementation((query: any) => {
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

            // NEW: Time overlap filtering (existingStart < newEnd AND existingEnd > newStart)
            if (query.start && query.start.$lt && query.end && query.end.$gt) {
                const newEnd = query.start.$lt; // Query says: start < newEnd
                const newStart = query.end.$gt;  // Query says: end > newStart
                results = results.filter(b => {
                    const bookingStart = new Date(b.start).getTime();
                    const bookingEnd = new Date(b.end).getTime();
                    return bookingStart < newEnd.getTime() && bookingEnd > newStart.getTime();
                });
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
            const { start, end } = getTimeRange(1);
            const result = await canBorrowSportCategory({
                userId: mockUser.id,
                requestedItemIds: [mockBasketball.id],
                start,
                end,
            });

            expect(result.allowed).toBe(true);
        });

        it('should allow borrowing multiple items from same sport', async () => {
            const { start, end } = getTimeRange(1);
            const result = await canBorrowSportCategory({
                userId: mockUser.id,
                requestedItemIds: [mockBadminton.id, mockShuttlecocks.id],
                start,
                end,
            });

            expect(result.allowed).toBe(true);
        });

        it('should reject borrowing from multiple sports in one booking', async () => {
            const { start, end } = getTimeRange(1);
            const result = await canBorrowSportCategory({
                userId: mockUser.id,
                requestedItemIds: [mockBasketball.id, mockBadminton.id],
                start,
                end,
            });

            expect(result.allowed).toBe(false);
            expect(result.reason).toContain('Cannot borrow equipment from multiple sports');
        });

        it('should reject borrowing different sport when OVERLAPPING booking exists', async () => {
            // Create active basketball booking from 1h-2h15m
            const { start: bookingStart, end: bookingEnd } = getTimeRange(1);
            await Booking.create({
                userId: mockUser.id,
                resourceId: mockSportsResource.id,
                kind: 'EQUIPMENT',
                items: [{ itemId: mockBasketball.id, name: 'Basketball', qty: 1 }],
                start: bookingStart,
                end: bookingEnd,
                status: 'CONFIRMED',
                qrIssued: false,
            });

            // Try to borrow badminton during OVERLAPPING time (1h30m-2h45m)
            const overlappingStart = new Date();
            overlappingStart.setHours(overlappingStart.getHours() + 1);
            overlappingStart.setMinutes(overlappingStart.getMinutes() + 30);
            const overlappingEnd = new Date(overlappingStart);
            overlappingEnd.setMinutes(overlappingEnd.getMinutes() + 75);

            const result = await canBorrowSportCategory({
                userId: mockUser.id,
                requestedItemIds: [mockBadminton.id],
                start: overlappingStart,
                end: overlappingEnd,
            });

            expect(result.allowed).toBe(false);
            expect(result.reason).toContain('overlapping');
            expect(result.conflictingSport).toBe(SPORT_CATEGORIES.BASKETBALL);
        });

        it('should ALLOW borrowing different sport at NON-OVERLAPPING time', async () => {
            // Create active basketball booking from 1h-2h15m
            const { start: bookingStart, end: bookingEnd } = getTimeRange(1);
            await Booking.create({
                userId: mockUser.id,
                resourceId: mockSportsResource.id,
                kind: 'EQUIPMENT',
                items: [{ itemId: mockBasketball.id, name: 'Basketball', qty: 1 }],
                start: bookingStart,
                end: bookingEnd,
                status: 'CONFIRMED',
                qrIssued: false,
            });

            // Try to borrow badminton at a LATER time (3h-4h15m) - no overlap
            const { start: laterStart, end: laterEnd } = getTimeRange(3);
            const result = await canBorrowSportCategory({
                userId: mockUser.id,
                requestedItemIds: [mockBadminton.id],
                start: laterStart,
                end: laterEnd,
            });

            expect(result.allowed).toBe(true);
        });

        it('should allow borrowing same sport when overlapping booking exists', async () => {
            // Create active basketball booking
            const { start: bookingStart, end: bookingEnd } = getTimeRange(1);
            await Booking.create({
                userId: mockUser.id,
                resourceId: mockSportsResource.id,
                kind: 'EQUIPMENT',
                items: [{ itemId: mockBasketball.id, name: 'Basketball', qty: 1 }],
                start: bookingStart,
                end: bookingEnd,
                status: 'CONFIRMED',
                qrIssued: false,
            });

            // Try to borrow another basketball at overlapping time
            const result = await canBorrowSportCategory({
                userId: mockUser.id,
                requestedItemIds: [mockBasketball.id],
                start: bookingStart,
                end: bookingEnd,
            });

            expect(result.allowed).toBe(true);
        });

        it('should allow GENERAL category items with any sport', async () => {
            // Create active basketball booking
            const { start: bookingStart, end: bookingEnd } = getTimeRange(1);
            await Booking.create({
                userId: mockUser.id,
                resourceId: mockSportsResource.id,
                kind: 'EQUIPMENT',
                items: [{ itemId: mockBasketball.id, name: 'Basketball', qty: 1 }],
                start: bookingStart,
                end: bookingEnd,
                status: 'CONFIRMED',
                qrIssued: false,
            });

            // Try to borrow general item at same time
            const result = await canBorrowSportCategory({
                userId: mockUser.id,
                requestedItemIds: [mockGeneral.id],
                start: bookingStart,
                end: bookingEnd,
            });

            expect(result.allowed).toBe(true);
        });

        it('should allow borrowing sport items with GENERAL category', async () => {
            const { start, end } = getTimeRange(1);
            const result = await canBorrowSportCategory({
                userId: mockUser.id,
                requestedItemIds: [mockBasketball.id, mockGeneral.id],
                start,
                end,
            });

            expect(result.allowed).toBe(true);
        });

        it('should only check CONFIRMED, CHECKED_IN, and PENDING bookings', async () => {
            // Create cancelled basketball booking
            const { start: bookingStart, end: bookingEnd } = getTimeRange(1);
            await Booking.create({
                userId: mockUser.id,
                resourceId: mockSportsResource.id,
                kind: 'EQUIPMENT',
                items: [{ itemId: mockBasketball.id, name: 'Basketball', qty: 1 }],
                start: bookingStart,
                end: bookingEnd,
                status: 'CANCELLED',
                qrIssued: false,
            });

            // Should allow borrowing badminton (basketball booking is cancelled)
            const result = await canBorrowSportCategory({
                userId: mockUser.id,
                requestedItemIds: [mockBadminton.id],
                start: bookingStart,
                end: bookingEnd,
            });

            expect(result.allowed).toBe(true);
        });

        it('should check PENDING bookings for conflicts', async () => {
            // Create PENDING basketball booking
            const { start: bookingStart, end: bookingEnd } = getTimeRange(1);
            await Booking.create({
                userId: mockUser.id,
                resourceId: mockSportsResource.id,
                kind: 'EQUIPMENT',
                items: [{ itemId: mockBasketball.id, name: 'Basketball', qty: 1 }],
                start: bookingStart,
                end: bookingEnd,
                status: 'PENDING',
                requiresApproval: true,
                approval: 'PENDING',
                qrIssued: false,
            });

            // Should block badminton booking at overlapping time
            const result = await canBorrowSportCategory({
                userId: mockUser.id,
                requestedItemIds: [mockBadminton.id],
                start: bookingStart,
                end: bookingEnd,
            });

            expect(result.allowed).toBe(false);
            expect(result.conflictingSport).toBe(SPORT_CATEGORIES.BASKETBALL);
        });

        it('should allow multiple cricket items in one booking', async () => {
            const { start, end } = getTimeRange(1);
            const result = await canBorrowSportCategory({
                userId: mockUser.id,
                requestedItemIds: [mockCricketBat.id, mockCricketPads.id],
                start,
                end,
            });

            expect(result.allowed).toBe(true);
        });
    });
});
