/**
 * Check users in database
 * Run with: npx tsx scripts/check-users.ts
 */

import { connectDB } from '@/lib/db';
import { User } from '@/models/User';

async function checkUsers() {
  try {
    await connectDB();

    const users = await User.find().limit(10).lean();

    console.log(`Found ${users.length} users in database:\n`);

    if (users.length === 0) {
      console.log('⚠️  No users found in database');
      console.log('This is why penalties show "Unknown (N/A)"');
      process.exit(0);
    }

    users.forEach(user => {
      console.log(`User ID: ${user._id}`);
      console.log(`  Name: ${user.name}`);
      console.log(`  Email: ${user.email}`);
      console.log(`  Role: ${user.role}`);
      console.log(`  Penalty Points: ${user.penaltyPoints}`);
      console.log('');
    });

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkUsers();
