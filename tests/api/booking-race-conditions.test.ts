import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { connectDB } from '@/lib/db';
import { Booking } from '@/models/Booking';
import { Resource } from '@/models/Resource';
import { User } from '@/models/User';
import { EquipmentItem } from '@/models/EquipmentItem';
import mongoose from 'mongoose';

describe('Race Condition Protection Tests', () => {
    beforeAll(async () => {
        await connectDB();
        // Ensure indexes are created in test database
        await Booking.syncIndexes();
    }, 30000);

    afterAll(async () => {
        // Clean up test data
        await connectDB(); // Ensure connection before cleanup
        await Booking.deleteMany({ userId: { $regex: /test-race-/ } });
        await User.deleteMany({ email: { $regex: /test-race-/ } });
        await Resource.deleteMany({ name: { $regex: /Test Race/ } });
        await EquipmentItem.deleteMany({ name: { $regex: /Test Race Equipment/ } });
        await mongoose.connection.close();
    }, 30000);

    describe('Unique Index Protection', () => {
        it('should prevent duplicate bookings on same time slot using database index', async () => {
            // Create test user and resource
            const user = await User.create({
                name: 'Test User',
                email: 'test-race-user-1@example.com',
                password: 'hashedpassword',
                role: 'STUDENT',
                verified: true,
            });

            const resource = await Resource.create({
                name: 'Test Race Facility',
                description: 'For race condition testing',
                type: 'FACILITY',
                capacity: 10,
                status: 'ACTIVE',
                rules: {
                    requiresApproval: false,
                    studentsOnly: false,
                    maxBookingDurationHours: 2,
                },
            });

            const startTime = new Date(Date.now() + 3600000); // 1 hour from now
            const endTime = new Date(Date.now() + 7200000); // 2 hours from now

            // Create first booking
            const booking1 = await Booking.create({
                userId: user.id,
                resourceId: resource.id,
                kind: 'FACILITY',
                start: startTime,
                end: endTime,
                status: 'CONFIRMED',
                requiresApproval: false,
                approval: 'NOT_REQUIRED',
                qrIssued: false,
            });

            expect(booking1).toBeDefined();

            // Attempt to create overlapping booking - should fail due to unique index
            await expect(async () => {
                await Booking.create({
                    userId: user.id,
                    resourceId: resource.id,
                    kind: 'FACILITY',
                    start: startTime,
                    end: endTime,
                    status: 'CONFIRMED',
                    requiresApproval: false,
                    approval: 'NOT_REQUIRED',
                    qrIssued: false,
                });
            }).rejects.toThrow();
        });
    });

    describe('Atomic Equipment Reservation', () => {
        it('should atomically reserve equipment quantities', async () => {
            // Create test equipment
            const resource = await Resource.create({
                name: 'Test Race Equipment Pool',
                description: 'For testing atomic operations',
                type: 'LAB_EQUIPMENT',
                capacity: 10,
                status: 'ACTIVE',
                rules: {
                    requiresApproval: false,
                    studentsOnly: false,
                    maxBookingDurationHours: 24,
                },
            });

            const equipItem = await EquipmentItem.create({
                resourceId: resource.id,
                name: 'Test Race Equipment Item',
                qtyTotal: 10,
                qtyAvailable: 10,
                qtyReserved: 0,
                safety: false,
                restricted: false,
            });

            // Simulate atomic reservation
            const requestedQty = 5;
            const updatedItem = await EquipmentItem.findOneAndUpdate(
                {
                    _id: equipItem.id,
                    $expr: {
                        $gte: [
                            { $subtract: ['$qtyAvailable', '$qtyReserved'] },
                            requestedQty
                        ]
                    }
                },
                {
                    $inc: { qtyReserved: requestedQty }
                },
                { new: true }
            );

            expect(updatedItem).toBeDefined();
            expect(updatedItem?.qtyReserved).toBe(requestedQty);

            // Try to reserve more than available
            const tooMuchQty = 10; // Only 5 left (10 - 5 reserved)
            const failedUpdate = await EquipmentItem.findOneAndUpdate(
                {
                    _id: equipItem.id,
                    $expr: {
                        $gte: [
                            { $subtract: ['$qtyAvailable', '$qtyReserved'] },
                            tooMuchQty
                        ]
                    }
                },
                {
                    $inc: { qtyReserved: tooMuchQty }
                },
                { new: true }
            );

            expect(failedUpdate).toBeNull(); // Should fail
        });

        it('should properly calculate available quantity', async () => {
            const resource = await Resource.create({
                name: 'Test Race Equipment Pool 2',
                description: 'For availability calculation',
                type: 'LAB_EQUIPMENT',
                capacity: 10,
                status: 'ACTIVE',
                rules: {
                    requiresApproval: false,
                    studentsOnly: false,
                    maxBookingDurationHours: 24,
                },
            });

            const equipItem = await EquipmentItem.create({
                resourceId: resource.id,
                name: 'Test Race Equipment Item 2',
                qtyTotal: 20,
                qtyAvailable: 20,
                qtyReserved: 8,
                safety: false,
                restricted: false,
            });

            // Available should be qtyAvailable - qtyReserved
            const available = equipItem.qtyAvailable - equipItem.qtyReserved;
            expect(available).toBe(12);
        });
    });

    describe('Transaction Conflict Handling', () => {
        it('should handle MongoDB duplicate key  errors gracefully', async () => {
            const user = await User.create({
                name: 'Test User 2',
                email: 'test-race-user-2@example.com',
                password: 'hashedpassword',
                role: 'STUDENT',
                verified: true,
            });

            const resource = await Resource.create({
                name: 'Test Race Facility 2',
                description: 'For duplicate key testing',
                type: 'FACILITY',
                capacity: 10,
                status: 'ACTIVE',
                rules: {
                    requiresApproval: false,
                    studentsOnly: false,
                    maxBookingDurationHours: 2,
                },
            });

            const startTime = new Date(Date.now() + 3600000);
            const endTime = new Date(Date.now() + 7200000);

            // Create first booking
            await Booking.create({
                userId: user.id,
                resourceId: resource.id,
                kind: 'FACILITY',
                start: startTime,
                end: endTime,
                status: 'CONFIRMED',
                requiresApproval: false,
                approval: 'NOT_REQUIRED',
                qrIssued: false,
            });

            // Second attempt should throw MongoServerError with code 11000
            let error: any;
            try {
                await Booking.create({
                    userId: user.id,
                    resourceId: resource.id,
                    kind: 'FACILITY',
                    start: startTime,
                    end: endTime,
                    status: 'CONFIRMED',
                    requiresApproval: false,
                    approval: 'NOT_REQUIRED',
                    qrIssued: false,
                });
            } catch (e) {
                error = e;
            }

            expect(error).toBeDefined();
            expect(error.code).toBe(11000); // Duplicate key error
        });
    });
});
