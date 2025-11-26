/**
 * Cleanup orphaned penalties (penalties for users that no longer exist)
 * Run with: npx tsx scripts/cleanup-orphaned-penalties.ts
 */

import { connectDB } from '@/lib/db';
import { Penalty } from '@/models/Penalty';
import { User } from '@/models/User';
import mongoose from 'mongoose';

async function cleanupOrphanedPenalties() {
  try {
    await connectDB();

    console.log('Checking for orphaned penalties...\n');

    // Get all penalties
    const penalties = await Penalty.find().lean();

    console.log(`Total penalties: ${penalties.length}`);

    if (penalties.length === 0) {
      console.log('No penalties to check');
      process.exit(0);
    }

    // Get all valid user IDs
    const users = await User.find({}, { _id: 1 }).lean();
    const validUserIds = new Set(users.map(u => String(u._id)));

    console.log(`Total users: ${users.length}\n`);

    // Find orphaned penalties
    const orphanedPenalties = penalties.filter(p => !validUserIds.has(String(p.userId)));

    console.log(`Found ${orphanedPenalties.length} orphaned penalties\n`);

    if (orphanedPenalties.length === 0) {
      console.log('✓ No orphaned penalties found. All penalties reference valid users.');
      process.exit(0);
    }

    // Show orphaned penalties
    console.log('Orphaned penalties:');
    console.log('─'.repeat(80));
    orphanedPenalties.forEach(p => {
      console.log(`Penalty ID: ${p._id}`);
      console.log(`  User ID: ${p.userId} (user does not exist)`);
      console.log(`  Points: ${p.points}`);
      console.log(`  Reason: ${p.reason}`);
      console.log(`  Created: ${p.createdAt}`);
      console.log('─'.repeat(80));
    });

    // Ask for confirmation (in script, we'll just delete)
    console.log(`\nDeleting ${orphanedPenalties.length} orphaned penalties...`);

    const orphanedIds = orphanedPenalties.map(p => p._id);
    const result = await Penalty.deleteMany({ _id: { $in: orphanedIds } });

    console.log(`✓ Deleted ${result.deletedCount} orphaned penalties`);
    console.log('\nCleanup complete!');

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

cleanupOrphanedPenalties();
