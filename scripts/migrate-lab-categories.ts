/**
 * Migration Script: Add labCategory to existing lab equipment items
 * 
 * This script updates existing lab equipment items with the appropriate labCategory
 * without deleting any data. Run this instead of re-seeding.
 * 
 * Usage: npx ts-node --compiler-options '{"module":"commonjs"}' scripts/migrate-lab-categories.ts
 * Or:    npx tsx scripts/migrate-lab-categories.ts
 */

import mongoose from 'mongoose';
import { config } from 'dotenv';

// Load environment variables
config({ path: '.env' });
config({ path: '.env.local' });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/sst-booking';

// Define the category mappings based on item name patterns
const CATEGORY_MAPPINGS: Array<{ pattern: RegExp; category: 'LAPTOP' | 'SAME_DAY_RETURN' | 'GENERAL' }> = [
    // Laptops - long term borrow (up to 2 months)
    { pattern: /laptop/i, category: 'LAPTOP' },
    { pattern: /macbook/i, category: 'LAPTOP' },
    { pattern: /notebook/i, category: 'LAPTOP' },

    // VR Headsets and Monitors - same day return by 8 PM
    { pattern: /vr.*headset/i, category: 'SAME_DAY_RETURN' },
    { pattern: /headset.*vr/i, category: 'SAME_DAY_RETURN' },
    { pattern: /\bvr\b/i, category: 'SAME_DAY_RETURN' },
    { pattern: /oculus/i, category: 'SAME_DAY_RETURN' },
    { pattern: /quest/i, category: 'SAME_DAY_RETURN' },
    { pattern: /monitor/i, category: 'SAME_DAY_RETURN' },
    { pattern: /display/i, category: 'SAME_DAY_RETURN' },
];

function detectCategory(itemName: string): 'LAPTOP' | 'SAME_DAY_RETURN' | 'GENERAL' {
    for (const mapping of CATEGORY_MAPPINGS) {
        if (mapping.pattern.test(itemName)) {
            return mapping.category;
        }
    }
    return 'GENERAL';
}

async function migrate() {
    try {
        console.log('🔄 Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        // Get the equipment_items collection directly
        const db = mongoose.connection.db;
        if (!db) {
            throw new Error('Database connection not established');
        }

        const collection = db.collection('equipment_items');

        // Find all lab equipment items (items belonging to LAB_EQUIPMENT resources)
        // First, get the LAB_EQUIPMENT resource IDs
        const resourcesCollection = db.collection('resources');
        const labResources = await resourcesCollection.find({ type: 'LAB_EQUIPMENT' }).toArray();
        const labResourceIds = labResources.map(r => r._id.toString());

        console.log(`📦 Found ${labResources.length} LAB_EQUIPMENT resource(s)`);

        if (labResourceIds.length === 0) {
            console.log('⚠️  No LAB_EQUIPMENT resources found. Creating sample lab items...');

            // Create a lab equipment resource if none exists
            const labResource = await resourcesCollection.insertOne({
                type: 'LAB_EQUIPMENT',
                name: 'Innovation Lab Equipment',
                location: 'Innovation Lab - Building C',
                rules: {
                    requiresApproval: true,
                    slotMinutes: 60,
                    studentsOnly: true,
                },
                status: 'ACTIVE',
                createdAt: new Date(),
                updatedAt: new Date(),
            });

            const labResourceId = labResource.insertedId.toString();

            // Insert sample lab items with categories
            const sampleItems = [
                { name: 'Laptop', qtyTotal: 10, qtyAvailable: 10, labCategory: 'LAPTOP' },
                { name: 'VR Headset', qtyTotal: 2, qtyAvailable: 2, labCategory: 'SAME_DAY_RETURN' },
                { name: 'Monitor', qtyTotal: 4, qtyAvailable: 4, labCategory: 'SAME_DAY_RETURN' },
                { name: 'Arduino Kit', qtyTotal: 5, qtyAvailable: 5, labCategory: 'GENERAL' },
                { name: 'Raspberry Pi', qtyTotal: 5, qtyAvailable: 5, labCategory: 'GENERAL' },
            ];

            for (const item of sampleItems) {
                await collection.insertOne({
                    resourceId: labResourceId,
                    name: item.name,
                    qtyTotal: item.qtyTotal,
                    qtyAvailable: item.qtyAvailable,
                    qtyReserved: 0,
                    safety: false,
                    restricted: false,
                    requiresApproval: false,
                    labCategory: item.labCategory,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                });
                console.log(`  ✅ Created: ${item.name} (${item.labCategory})`);
            }

            console.log('\n✅ Sample lab items created!');
        } else {
            // Update existing lab items
            const labItems = await collection.find({
                resourceId: { $in: labResourceIds }
            }).toArray();

            console.log(`📋 Found ${labItems.length} lab equipment item(s) to update`);

            let updatedCount = 0;
            let skippedCount = 0;

            for (const item of labItems) {
                const detectedCategory = detectCategory(item.name);
                const existingCategory = item.labCategory;

                if (existingCategory === detectedCategory) {
                    console.log(`  ⏭️  ${item.name}: Already has correct category (${existingCategory})`);
                    skippedCount++;
                    continue;
                }

                await collection.updateOne(
                    { _id: item._id },
                    {
                        $set: {
                            labCategory: detectedCategory,
                            updatedAt: new Date()
                        }
                    }
                );

                const emoji = detectedCategory === 'LAPTOP' ? '💻' :
                    detectedCategory === 'SAME_DAY_RETURN' ? '🎮' : '🔬';
                console.log(`  ${emoji} ${item.name}: ${existingCategory || 'none'} → ${detectedCategory}`);
                updatedCount++;
            }

            console.log(`\n✅ Migration complete!`);
            console.log(`   Updated: ${updatedCount} item(s)`);
            console.log(`   Skipped: ${skippedCount} item(s) (already correct)`);
        }

        // Also check if Laptop and Monitor items exist, if not add them
        const existingItems = await collection.find({
            resourceId: { $in: labResourceIds }
        }).toArray();

        const hasLaptop = existingItems.some(i => /laptop/i.test(i.name));
        const hasMonitor = existingItems.some(i => /monitor/i.test(i.name));

        if (!hasLaptop || !hasMonitor) {
            console.log('\n📦 Adding missing item types...');
            const labResourceId = labResourceIds[0];

            if (!hasLaptop) {
                await collection.insertOne({
                    resourceId: labResourceId,
                    name: 'Laptop',
                    qtyTotal: 10,
                    qtyAvailable: 10,
                    qtyReserved: 0,
                    safety: false,
                    restricted: false,
                    requiresApproval: false,
                    labCategory: 'LAPTOP',
                    createdAt: new Date(),
                    updatedAt: new Date(),
                });
                console.log('  💻 Added: Laptop (LAPTOP - up to 60 days)');
            }

            if (!hasMonitor) {
                await collection.insertOne({
                    resourceId: labResourceId,
                    name: 'Monitor',
                    qtyTotal: 4,
                    qtyAvailable: 4,
                    qtyReserved: 0,
                    safety: false,
                    restricted: false,
                    requiresApproval: false,
                    labCategory: 'SAME_DAY_RETURN',
                    createdAt: new Date(),
                    updatedAt: new Date(),
                });
                console.log('  🖥️  Added: Monitor (SAME_DAY_RETURN - by 8 PM)');
            }
        }

        console.log('\n🎉 Done! Your lab equipment now has dynamic borrow periods.');
        console.log('\n📋 Category Summary:');
        console.log('   💻 LAPTOP: Up to 60 days (2 months)');
        console.log('   🎮 SAME_DAY_RETURN: Must return by 8 PM today');
        console.log('   🔬 GENERAL: 1-7 days');

    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    } finally {
        await mongoose.connection.close();
        console.log('\n📤 MongoDB connection closed');
    }
}

migrate();
