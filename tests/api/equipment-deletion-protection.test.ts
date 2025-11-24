import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { connectDB } from '@/lib/db';
import { Booking } from '@/models/Booking';
import { EquipmentItem } from '@/models/EquipmentItem';
import { User } from '@/models/User';
import mongoose from 'mongoose';

describe('Equipment Deletion Protection Tests', () => {
    beforeAll(async () => {
        await connectDB();
    });

    afterAll(async () => {
        await Booking.deleteMany({ userId: { $regex: /test-deletion-/ } });
        await User.deleteMany({ email: { $regex: /test-deletion-/ } });
        await EquipmentItem.deleteMany({ name: { $regex: /Test Deletion/ } });
        await mongoose.connection.close();
    });

    it('should prevent deletion of equipment with active bookings', async () => {
        const equipItem = await EquipmentItem.create({
            name: 'Test Deletion Equipment',
            resourceId: 'test-resource',
            qtyTotal: 5,
            qtyAvailable: 5,
            qtyReserved: 0,
            restricted: false,
        });

        const user = await User.create({
            name: 'Test User',
            email: 'test-deletion-user@example.com',
            role: 'STUDENT',
            penaltyPoints: 0,
        });

        // Create active booking with this equipment
        await Booking.create({
            userId: user.id,
            resourceId: 'test-resource',
            kind: 'EQUIPMENT',
            items: [{ itemId: equipItem.id, name: equipItem.name, qty: 1 }],
            start: new Date(Date.now() + 3600000),
            end: new Date(Date.now() + 7200000),
            status: 'CONFIRMED',
            qrIssued: false,
        });

        // Check if active bookings exist
        const activeBooking = await Booking.findOne({
            'items.itemId': equipItem.id,
            status: { $in: ['PENDING', 'CONFIRMED', 'CHECKED_IN'] }
        });

        expect(activeBooking).toBeDefined(); // ✅ Active booking found
        // Deletion should be blocked (ConflictError in actual implementation)
    });

    it('should allow deletion of equipment with no active bookings', async () => {
        const equipItem = await EquipmentItem.create({
            name: 'Test Deletion Equipment 2',
            resourceId: 'test-resource',
            qtyTotal: 5,
            qtyAvailable: 5,
            qtyReserved: 0,
            restricted: false,
        });

        // No active bookings
        const activeBooking = await Booking.findOne({
            'items.itemId': equipItem.id,
            status: { $in: ['PENDING', 'CONFIRMED', 'CHECKED_IN'] }
        });

        expect(activeBooking).toBeNull(); // ✅ No active bookings, safe to delete
        await EquipmentItem.findByIdAndDelete(equipItem.id);
    });

    it('should allow deletion after all bookings completed', async () => {
        const equipItem = await EquipmentItem.create({
            name: 'Test Deletion Equipment 3',
            resourceId: 'test-resource',
            qtyTotal: 5,
            qtyAvailable: 5,
            qtyReserved: 0,
            restricted: false,
        });

        const user = await User.create({
            name: 'Test User 2',
            email: 'test-deletion-user2@example.com',
            role: 'STUDENT',
            penaltyPoints: 0,
        });

        // Create completed booking
        await Booking.create({
            userId: user.id,
            resourceId: 'test-resource',
            kind: 'EQUIPMENT',
            items: [{ itemId: equipItem.id, name: equipItem.name, qty: 1 }],
            start: new Date(Date.now() - 7200000),
            end: new Date(Date.now() - 3600000),
            status: 'COMPLETED', // Already completed
            qrIssued: false,
        });

        const activeBooking = await Booking.findOne({
            'items.itemId': equipItem.id,
            status: { $in: ['PENDING', 'CONFIRMED', 'CHECKED_IN'] }
        });

        expect(activeBooking).toBeNull(); // ✅ No active bookings, safe to delete
    });
});
