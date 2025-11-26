/**
 * Diagnostic script to check penalty data and user lookups
 * Run with: npx tsx scripts/check-penalties.ts
 */

import { connectDB } from '@/lib/db';
import { Penalty } from '@/models/Penalty';
import { User } from '@/models/User';
import mongoose from 'mongoose';

async function checkPenalties() {
  try {
    await connectDB();

    console.log('Checking penalties...\n');

    // Get all penalties
    const penalties = await Penalty.find().sort({ createdAt: -1 }).limit(20).lean();

    console.log(`Found ${penalties.length} penalties\n`);

    if (penalties.length === 0) {
      console.log('No penalties found in database');
      process.exit(0);
    }

    // Get unique user IDs
    const userIds = [...new Set(penalties.map(p => p.userId))];
    console.log(`Unique user IDs: ${userIds.length}\n`);

    // Check each userId
    for (const userId of userIds) {
      console.log(`Checking userId: ${userId}`);
      console.log(`  - Is valid ObjectId format: ${mongoose.Types.ObjectId.isValid(userId)}`);

      // Try to find user by ObjectId
      let user = null;
      if (mongoose.Types.ObjectId.isValid(userId)) {
        user = await User.findById(new mongoose.Types.ObjectId(userId));
      }

      // Try string lookup as fallback
      if (!user) {
        user = await User.findOne({ _id: userId as any });
      }

      if (user) {
        console.log(`  ✓ Found user: ${user.name} (${user.email})`);
      } else {
        console.log(`  ✗ User NOT found - This penalty will show as "Unknown"`);
      }
      console.log('');
    }

    // Show sample penalties
    console.log('\nSample penalties:');
    console.log('─'.repeat(80));
    for (const penalty of penalties.slice(0, 5)) {
      console.log(`Penalty ID: ${penalty._id}`);
      console.log(`  User ID: ${penalty.userId}`);
      console.log(`  Points: ${penalty.points}`);
      console.log(`  Reason: ${penalty.reason}`);
      console.log(`  Created: ${penalty.createdAt}`);
      console.log(`  Waived: ${penalty.waivedBy ? 'Yes' : 'No'}`);
      console.log('─'.repeat(80));
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkPenalties();
