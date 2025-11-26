import { connectDB } from '@/lib/db';
import { Penalty } from '@/models/Penalty';
import mongoose from 'mongoose';

async function clearPenalties() {
    try {
        console.log('Connecting to database...');
        await connectDB();
        console.log('Connected.');

        console.log('Clearing penalties...');
        const result = await Penalty.deleteMany({});
        console.log(`Deleted ${result.deletedCount} penalties.`);

        console.log('Done.');
        process.exit(0);
    } catch (error) {
        console.error('Error clearing penalties:', error);
        process.exit(1);
    }
}

clearPenalties();