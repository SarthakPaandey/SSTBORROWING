#!/usr/bin/env ts-node
/**
 * Migration script to add sport categories to existing equipment items
 * Run this once to update existing data in the database
 */

import mongoose from 'mongoose';
import { EquipmentItem } from '../models/EquipmentItem.js';
import { SPORT_CATEGORIES } from '../lib/sportCategoryRules.js';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/sst-booking';

// Mapping of equipment names to sport categories
const EQUIPMENT_CATEGORY_MAPPING: Record<string, string> = {
    'Football': SPORT_CATEGORIES.FOOTBALL,
    'Basketball': SPORT_CATEGORIES.BASKETBALL,
    'Badminton Racket': SPORT_CATEGORIES.BADMINTON,
    'Shuttlecocks': SPORT_CATEGORIES.BADMINTON,
    'TT Paddle': SPORT_CATEGORIES.TABLE_TENNIS,
    'TT Balls': SPORT_CATEGORIES.TABLE_TENNIS,
    'Cricket Bat': SPORT_CATEGORIES.CRICKET,
    'Cricket Pads': SPORT_CATEGORIES.CRICKET,
    'Cricket Helmet': SPORT_CATEGORIES.CRICKET,
    'Cricket Ball': SPORT_CATEGORIES.CRICKET,
};

async function migrate() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB');

        console.log('\nAdding sport categories to equipment items...');

        let updated = 0;
        let skipped = 0;

        for (const [itemName, category] of Object.entries(EQUIPMENT_CATEGORY_MAPPING)) {
            const result = await EquipmentItem.updateMany(
                {
                    name: itemName,
                    sportCategory: { $exists: false } // Only update if sportCategory doesn't exist
                },
                {
                    $set: { sportCategory: category }
                }
            );

            if (result.modifiedCount > 0) {
                console.log(`✅ Updated ${result.modifiedCount} item(s): ${itemName} → ${category}`);
                updated += result.modifiedCount;
            } else {
                console.log(`⏭️  Skipped ${itemName} (already has category or not found)`);
                skipped++;
            }
        }

        console.log('\n=== Migration Summary ===');
        console.log(`Total items updated: ${updated}`);
        console.log(`Total items skipped: ${skipped}`);

        // Verify the results
        console.log('\n=== Verification ===');
        const categorizedItems = await EquipmentItem.find({
            sportCategory: { $exists: true }
        });

        console.log(`Items with sport categories: ${categorizedItems.length}`);

        const categoryBreakdown = categorizedItems.reduce((acc, item) => {
            const cat = item.sportCategory || 'unknown';
            acc[cat] = (acc[cat] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        console.log('Category breakdown:');
        for (const [category, count] of Object.entries(categoryBreakdown)) {
            console.log(`  ${category}: ${count}`);
        }

        await mongoose.connection.close();
        console.log('\n✅ Migration completed successfully');
        process.exit(0);
    } catch (error) {
        console.error('❌ Migration error:', error);
        process.exit(1);
    }
}

migrate();
