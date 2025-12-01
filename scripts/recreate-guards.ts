/**
 * Script to recreate guard users without affecting other data
 * Run with: npx tsx scripts/recreate-guards.ts
 */

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { User } from '../models/User';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/sst-booking';

async function recreateGuards() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB');

        // Delete ONLY guard users
        console.log('Deleting existing guard users...');
        const deleteResult = await User.deleteMany({ role: 'GUARD' });
        console.log(`Deleted ${deleteResult.deletedCount} guard users`);

        // Create new guard users
        console.log('Creating new guard users...');
        const guardPassword = await bcrypt.hash('123456', 10);

        const guard1 = await User.create({
            name: 'Guard 1',
            email: 'guard-1@local',
            role: 'GUARD',
            password: guardPassword,
            penaltyPoints: 0,
        });

        const guard2 = await User.create({
            name: 'Guard 2',
            email: 'guard-2@local',
            role: 'GUARD',
            password: guardPassword,
            penaltyPoints: 0,
        });

        console.log('\n✅ Guard users recreated:');
        console.log(`- ${guard1.name} (${guard1.email}) - ID: ${guard1._id}`);
        console.log(`- ${guard2.name} (${guard2.email}) - ID: ${guard2._id}`);
        console.log('\nPassword for both: 123456');

        await mongoose.connection.close();
        console.log('\nMongoDB connection closed');
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

recreateGuards();
