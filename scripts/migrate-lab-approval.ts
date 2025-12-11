/**
 * Migration Script: Update requiresApproval for lab equipment items
 * 
 * Sets requiresApproval:
 * - true: Laptops, VR Headsets (high-value items)
 * - false: Monitors, Arduino Kits, Raspberry Pi, etc.
 * 
 * Also updates the LAB_EQUIPMENT resource to NOT require approval at the
 * resource level, so item-level settings take precedence.
 * 
 * Usage: npx tsx scripts/migrate-lab-approval.ts
 */

import mongoose from 'mongoose';
import { config } from 'dotenv';

// Load environment variables
config({ path: '.env' });
config({ path: '.env.local' });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/sst-booking';

// Items that require admin approval (high-value or restricted items)
const REQUIRES_APPROVAL_PATTERNS = [
    /laptop/i,
    /macbook/i,
    /notebook/i,
    /vr.*headset/i,
    /headset.*vr/i,
    /\bvr\b/i,
    /oculus/i,
    /quest/i,
];

// Items that do NOT require approval (monitors, general equipment)
const NO_APPROVAL_PATTERNS = [
    /monitor/i,
    /display/i,
    /arduino/i,
    /raspberry/i,
    /sensor/i,
    /breadboard/i,
    /multimeter/i,
];

function shouldRequireApproval(itemName: string): boolean {
    // Check if it matches approval-required patterns
    for (const pattern of REQUIRES_APPROVAL_PATTERNS) {
        if (pattern.test(itemName)) {
            return true;
        }
    }

    // Check if it matches no-approval patterns
    for (const pattern of NO_APPROVAL_PATTERNS) {
        if (pattern.test(itemName)) {
            return false;
        }
    }

    // Default: general lab equipment does NOT require approval
    return false;
}

async function migrate() {
    try {
        console.log('🔄 Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        const db = mongoose.connection.db;
        if (!db) {
            throw new Error('Database connection not established');
        }

        const itemsCollection = db.collection('equipment_items');
        const resourcesCollection = db.collection('resources');

        // Step 1: Update LAB_EQUIPMENT resource to NOT require approval at resource level
        // This allows item-level settings to take precedence
        console.log('\n📦 Updating LAB_EQUIPMENT resource settings...');

        const resourceUpdateResult = await resourcesCollection.updateMany(
            { type: 'LAB_EQUIPMENT' },
            {
                $set: {
                    'rules.requiresApproval': false,
                    updatedAt: new Date()
                }
            }
        );

        console.log(`   Updated ${resourceUpdateResult.modifiedCount} LAB_EQUIPMENT resource(s) - approval now handled per-item`);

        // Step 2: Get all lab equipment items
        const labResources = await resourcesCollection.find({ type: 'LAB_EQUIPMENT' }).toArray();
        const labResourceIds = labResources.map(r => r._id.toString());

        if (labResourceIds.length === 0) {
            console.log('⚠️  No LAB_EQUIPMENT resources found.');
            return;
        }

        const labItems = await itemsCollection.find({
            resourceId: { $in: labResourceIds }
        }).toArray();

        console.log(`\n📋 Updating ${labItems.length} lab equipment item(s)...`);

        let approvalRequired = 0;
        let noApprovalRequired = 0;

        for (const item of labItems) {
            const needsApproval = shouldRequireApproval(item.name);
            const currentSetting = item.requiresApproval || false;

            if (currentSetting !== needsApproval) {
                await itemsCollection.updateOne(
                    { _id: item._id },
                    {
                        $set: {
                            requiresApproval: needsApproval,
                            updatedAt: new Date()
                        }
                    }
                );

                const emoji = needsApproval ? '🔒' : '✅';
                const status = needsApproval ? 'REQUIRES APPROVAL' : 'NO APPROVAL NEEDED';
                console.log(`   ${emoji} ${item.name}: ${status}`);
            } else {
                console.log(`   ⏭️  ${item.name}: Already correct (${needsApproval ? 'requires approval' : 'no approval'})`);
            }

            if (needsApproval) {
                approvalRequired++;
            } else {
                noApprovalRequired++;
            }
        }

        console.log('\n✅ Migration complete!');
        console.log(`   🔒 Require approval: ${approvalRequired} item(s) (Laptops, VR Headsets)`);
        console.log(`   ✅ No approval needed: ${noApprovalRequired} item(s) (Monitors, General equipment)`);

        console.log('\n📋 Updated Rules:');
        console.log('   💻 Laptops → Admin approval required');
        console.log('   🎮 VR Headsets → Admin approval required');
        console.log('   🖥️  Monitors → NO approval needed (instant booking)');
        console.log('   🔬 General items → NO approval needed (instant booking)');

    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    } finally {
        await mongoose.connection.close();
        console.log('\n📤 MongoDB connection closed');
    }
}

migrate();
