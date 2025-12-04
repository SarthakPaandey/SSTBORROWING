import mongoose from 'mongoose';
import { connectDB } from '../lib/db';

async function testConnection() {
    try {
        console.log('Attempting to connect to database...');
        await connectDB();
        console.log('Successfully connected to database!');
        await mongoose.connection.close();
        console.log('Connection closed.');
    } catch (error) {
        console.error('Failed to connect to database:', error);
        process.exit(1);
    }
}

testConnection();
