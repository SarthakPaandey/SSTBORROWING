/**
 * Test script for escalating penalty system
 * 
 * This script simulates the three-strike penalty system:
 * - Level 0: Add 20 points -> 7 day suspension, move to Level 1
 * - Level 1: Add 10 points -> 10 day suspension, move to Level 2
 * - Level 2: Add 10 points -> Permanent block
 */

import { connectDB } from '../lib/db';
import { User } from '../models/User';
import { Penalty } from '../models/Penalty';
import { recalculatePenaltyPoints } from '../lib/groupBookingPenalties';
import { POLICIES } from '../lib/policies';
import { getNow } from '../lib/timezone';

async function testEscalatingPenalties() {
    await connectDB();

    console.log('='.repeat(60));
    console.log('Testing Escalating Penalty System');
    console.log('='.repeat(60));

    // Create a test user
    const testEmail = `test-penalty-${Date.now()}@test.com`;
    const testUser = await User.create({
        name: 'Test User',
        email: testEmail,
        role: 'STUDENT',
        penaltyPoints: 0,
        suspensionLevel: 0,
    });

    console.log(`\n✓ Created test user: ${testUser.email}`);
    console.log(`  Initial Level: ${testUser.suspensionLevel}`);
    console.log(`  Initial Points: ${testUser.penaltyPoints}`);

    // ============ LEVEL 0 TEST ============
    console.log('\n' + '='.repeat(60));
    console.log('LEVEL 0 TEST: Adding 20 points (5 no-shows of 4 points each)');
    console.log('='.repeat(60));

    for (let i = 1; i <= 5; i++) {
        await Penalty.create({
            userId: testUser.id,
            points: POLICIES.PENALTY_NO_SHOW,
            reason: `Test no-show #${i}`,
        });
        console.log(`  Added penalty #${i}: ${POLICIES.PENALTY_NO_SHOW} points`);
    }

    await recalculatePenaltyPoints(testUser.id);
    const updatedUser1 = await User.findById(testUser.id);
    if (!updatedUser1) throw new Error('User not found');

    console.log(`\n✓ After Level 0 penalties:`);
    console.log(`  Current Level: ${updatedUser1.suspensionLevel}`);
    console.log(`  Active Points: ${updatedUser1.penaltyPoints}`);
    console.log(`  Suspended Until: ${updatedUser1.suspendedUntil || 'Not suspended'}`);
    console.log(`  Blocked: ${updatedUser1.blocked}`);

    if (updatedUser1.suspensionLevel !== 1) {
        console.error(`  ✗ FAILED: Expected suspensionLevel=1, got ${updatedUser1.suspensionLevel}`);
        return;
    }
    if (updatedUser1.penaltyPoints !== 0) {
        console.error(`  ✗ FAILED: Expected penaltyPoints=0, got ${updatedUser1.penaltyPoints}`);
        return;
    }
    if (!updatedUser1.suspendedUntil) {
        console.error(`  ✗ FAILED: Expected suspension, but user not suspended`);
        return;
    }

    const expectedSuspensionDate = new Date(getNow());
    expectedSuspensionDate.setDate(expectedSuspensionDate.getDate() + 7);
    console.log(`  Expected suspension ~${expectedSuspensionDate.toISOString().split('T')[0]}`);

    // Check served penalties
    const servedCount = await Penalty.countDocuments({ userId: testUser.id, served: true });
    console.log(`  Penalties marked as served: ${servedCount}/5`);

    if (servedCount !== 5) {
        console.error(`  ✗ FAILED: Expected 5 served penalties, got ${servedCount}`);
        return;
    }

    console.log('  ✓ Level 0 -> Level 1 escalation successful!');

    // ============ LEVEL 1 TEST ============
    console.log('\n' + '='.repeat(60));
    console.log('LEVEL 1 TEST: Adding 10 points (2 late returns + 1 damage)');
    console.log('='.repeat(60));

    await Penalty.create({
        userId: testUser.id,
        points: POLICIES.PENALTY_LATE_RETURN,
        reason: 'Test late return #1',
    });
    await Penalty.create({
        userId: testUser.id,
        points: POLICIES.PENALTY_LATE_RETURN,
        reason: 'Test late return #2',
    });
    await Penalty.create({
        userId: testUser.id,
        points: POLICIES.PENALTY_DAMAGE,
        reason: 'Test equipment damage',
    });
    console.log(`  Added 3 penalties: Total 10 points`);

    await recalculatePenaltyPoints(testUser.id);
    const updatedUser2 = await User.findById(testUser.id);
    if (!updatedUser2) throw new Error('User not found');

    console.log(`\n✓ After Level 1 penalties:`);
    console.log(`  Current Level: ${updatedUser2.suspensionLevel}`);
    console.log(`  Active Points: ${updatedUser2.penaltyPoints}`);
    console.log(`  Suspended Until: ${updatedUser2.suspendedUntil || 'Not suspended'}`);
    console.log(`  Blocked: ${updatedUser2.blocked}`);

    if (updatedUser2.suspensionLevel !== 2) {
        console.error(`  ✗ FAILED: Expected suspensionLevel=2, got ${updatedUser2.suspensionLevel}`);
        return;
    }
    if (updatedUser2.penaltyPoints !== 0) {
        console.error(`  ✗ FAILED: Expected penaltyPoints=0, got ${updatedUser2.penaltyPoints}`);
        return;
    }

    const totalServed = await Penalty.countDocuments({ userId: testUser.id, served: true });
    console.log(`  Penalties marked as served: ${totalServed}/8`);

    if (totalServed !== 8) {
        console.error(`  ✗ FAILED: Expected 8 served penalties, got ${totalServed}`);
        return;
    }

    console.log('  ✓ Level 1 -> Level 2 escalation successful!');

    // ============ LEVEL 2 TEST ============
    console.log('\n' + '='.repeat(60));
    console.log('LEVEL 2 TEST: Adding 10 points -> Should BLOCK permanently');
    console.log('='.repeat(60));

    await Penalty.create({
        userId: testUser.id,
        points: POLICIES.PENALTY_NO_SHOW,
        reason: 'Test no-show (final)',
    });
    await Penalty.create({
        userId: testUser.id,
        points: POLICIES.PENALTY_DAMAGE,
        reason: 'Test damage (final)',
    });
    await Penalty.create({
        userId: testUser.id,
        points: POLICIES.PENALTY_LATE_RETURN,
        reason: 'Test late return (final)',
    });
    console.log(`  Added 3 penalties: Total 10 points (4+8+4=16, triggers at 10)`);

    await recalculatePenaltyPoints(testUser.id);
    const updatedUser3 = await User.findById(testUser.id);
    if (!updatedUser3) throw new Error('User not found');

    console.log(`\n✓ After Level 2 penalties:`);
    console.log(`  Current Level: ${updatedUser3.suspensionLevel}`);
    console.log(`  Active Points: ${updatedUser3.penaltyPoints}`);
    console.log(`  Suspended Until: ${updatedUser3.suspendedUntil || 'Not suspended'}`);
    console.log(`  Blocked: ${updatedUser3.blocked}`);
    console.log(`  Blocked At: ${updatedUser3.blockedAt || 'N/A'}`);

    if (!updatedUser3.blocked) {
        console.error(`  ✗ FAILED: Expected user to be blocked`);
        return;
    }
    if (updatedUser3.suspensionLevel !== 2) {
        console.error(`  ✗ FAILED: Expected suspensionLevel to stay at 2, got ${updatedUser3.suspensionLevel}`);
        return;
    }

    console.log('  ✓ Level 2 -> Permanent Block successful!');

    // ============ CLEANUP ============
    console.log('\n' + '='.repeat(60));
    console.log('CLEANUP');
    console.log('='.repeat(60));

    await Penalty.deleteMany({ userId: testUser.id });
    await User.findByIdAndDelete(testUser.id);

    console.log('  ✓ Test user and penalties cleaned up');

    // ============ SUCCESS ============
    console.log('\n' + '='.repeat(60));
    console.log('✓ ALL TESTS PASSED! Escalating penalty system working correctly.');
    console.log('='.repeat(60));

    process.exit(0);
}

testEscalatingPenalties().catch((error) => {
    console.error('\n✗ TEST FAILED:', error);
    process.exit(1);
});
