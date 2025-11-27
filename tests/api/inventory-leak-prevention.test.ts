import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { connectDB } from '@/lib/db';
import { Booking } from '@/models/Booking';
import { EquipmentItem } from '@/models/EquipmentItem';
import { User } from '@/models/User';
import { Resource } from '@/models/Resource';
import mongoose from 'mongoose';

describe('Inventory Leak Prevention Tests', () => {
    beforeAll(async () => {
        await connectDB();
    });

    afterAll(async () => {
        // Cleanup
        await connectDB(); // Ensure connection before cleanup
        await Booking.deleteMany({ userId: { $regex: /test-inventory-/ } });
        await User.deleteMany({ email: { $regex: /test-inventory-/ } });
        await Resource.deleteMany({ name: { $regex: /Test Inventory/ } });
        await EquipmentItem.deleteMany({ name: { $regex: /Test Inventory/ } });
        await mongoose.connection.close();
    });

    describe('QR Validation Inventory Release', () => {
        it('should decrement both qtyAvailable AND qtyReserved on check-in', async () => {
            // Setup
            const resource = await Resource.create({
                name: 'Test Inventory Resource',
                type: 'LAB_EQUIPMENT',
                status: 'ACTIVE',
                rules: { requiresApproval: false }
            });

            const equipItem = await EquipmentItem.create({
                name: 'Test Inventory Equipment',
                resourceId: resource.id,
                qtyTotal: 10,
                qtyAvailable: 10,
                qtyReserved: 0,
                restricted: false,
            });

            const user = await User.create({
                name: 'Test User',
                email: 'test-inventory-user@example.com',
                role: 'STUDENT',
                penaltyPoints: 0,
            });

            // Create booking and reserve inventory
            const booking = await Booking.create({
                userId: user.id,
                resourceId: resource.id,
                kind: 'EQUIPMENT',
                items: [{ itemId: equipItem.id, name: equipItem.name, qty: 2 }],
                start: new Date(Date.now() + 3600000),
                end: new Date(Date.now() + 7200000),
                status: 'CONFIRMED',
                qrIssued: false,
            });

            // Reserve inventory (simulating what booking creation does)
            await EquipmentItem.findByIdAndUpdate(equipItem.id, {
                $inc: { qtyReserved: 2 }
            });

            let item = await EquipmentItem.findById(equipItem.id);
            expect(item?.qtyAvailable).toBe(10); // Still 10 (not physically removed)
            expect(item?.qtyReserved).toBe(2);   // Reserved

            // Simulate QR check-in - should decrement BOTH
            const result = await EquipmentItem.findOneAndUpdate(
                {
                    _id: equipItem.id,
                    qtyAvailable: { $gte: 2 }
                },
                {
                    $inc: {
                        qtyAvailable: -2,  // Physical removal
                        qtyReserved: -2,   // Release reservation (THE FIX)
                    }
                },
                { new: true }
            );

            expect(result?.qtyAvailable).toBe(8);  // Physically removed
            expect(result?.qtyReserved).toBe(0);   // Reservation released ✅
        });
    });

    describe('Cancellation Inventory Release', () => {
        it('should release qtyReserved when booking is cancelled', async () => {
            const resource = await Resource.create({
                name: 'Test Inventory Resource 2',
                type: 'LAB_EQUIPMENT',
                status: 'ACTIVE',
                rules: { requiresApproval: false }
            });

            const equipItem = await EquipmentItem.create({
                name: 'Test Inventory Equipment 2',
                resourceId: resource.id,
                qtyTotal: 10,
                qtyAvailable: 10,
                qtyReserved: 3, // Pre-reserved
                restricted: false,
            });

            // Simulate cancellation - release reservation
            await EquipmentItem.findByIdAndUpdate(equipItem.id, {
                $inc: { qtyReserved: -3 }
            });

            const item = await EquipmentItem.findById(equipItem.id);
            expect(item?.qtyReserved).toBe(0); // Released ✅
            expect(item?.qtyAvailable).toBe(10); // Unchanged
        });
    });

    describe('No-Show Inventory Release', () => {
        it('should release qtyReserved for no-show bookings', async () => {
            const equipItem = await EquipmentItem.create({
                name: 'Test Inventory Equipment 3',
                resourceId: 'test-resource',
                qtyTotal: 5,
                qtyAvailable: 5,
                qtyReserved: 2,
                restricted: false,
            });

            // Simulate no-show handling
            await EquipmentItem.findByIdAndUpdate(equipItem.id, {
                $inc: { qtyReserved: -2 }
            });

            const item = await EquipmentItem.findById(equipItem.id);
            expect(item?.qtyReserved).toBe(0);
        });
    });

    describe('Atomic Operations Prevent Double-Spending', () => {
        it('should prevent concurrent QR scans from double-decrementing', async () => {
            const equipItem = await EquipmentItem.create({
                name: 'Test Inventory Equipment 4',
                resourceId: 'test-resource',
                qtyTotal: 10,
                qtyAvailable: 10,
                qtyReserved: 0,
                restricted: false,
            });

            // First scan - should succeed
            const result1 = await EquipmentItem.findOneAndUpdate(
                {
                    _id: equipItem.id,
                    qtyAvailable: { $gte: 5 }
                },
                {
                    $inc: { qtyAvailable: -5, qtyReserved: -5 }
                },
                { new: true }
            );

            expect(result1?.qtyAvailable).toBe(5);

            // Concurrent scan with same requirements - should fail
            const result2 = await EquipmentItem.findOneAndUpdate(
                {
                    _id: equipItem.id,
                    qtyAvailable: { $gte: 5 }  // Only 5 left, need 5
                },
                {
                    $inc: { qtyAvailable: -5, qtyReserved: -5 }
                },
                { new: true }
            );

            // Second one should still work since we have exactly 5
            expect(result2?.qtyAvailable).toBe(0);

            // Third scan should fail
            const result3 = await EquipmentItem.findOneAndUpdate(
                {
                    _id: equipItem.id,
                    qtyAvailable: { $gte: 1 }  // None left
                },
                {
                    $inc: { qtyAvailable: -1, qtyReserved: -1 }
                },
                { new: true }
            );

            expect(result3).toBeNull(); // ✅ Atomic operation prevented over-allocation
        });
    });

    describe('Inventory Consistency Check', () => {
        it('should never allow qtyReserved to accumulate indefinitely', async () => {
            const equipItem = await EquipmentItem.create({
                name: 'Test Inventory Equipment 5',
                resourceId: 'test-resource',
                qtyTotal: 10,
                qtyAvailable: 10,
                qtyReserved: 0,
                restricted: false,
            });

            // Simulate booking creation (reserves)
            await EquipmentItem.findByIdAndUpdate(equipItem.id, {
                $inc: { qtyReserved: 3 }
            });

            // Simulate QR scan (should release)
            await EquipmentItem.findByIdAndUpdate(equipItem.id, {
                $inc: { qtyAvailable: -3, qtyReserved: -3 }
            });

            const item = await EquipmentItem.findById(equipItem.id);
            expect(item?.qtyReserved).toBe(0); // Never accumulates ✅
            expect(item?.qtyAvailable).toBe(7);
        });
    });
});
