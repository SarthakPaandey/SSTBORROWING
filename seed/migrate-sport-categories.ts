import 'dotenv/config';
import mongoose from 'mongoose';
import { EquipmentItem } from '../models/EquipmentItem';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/sst-booking';

/**
 * Migration script to add sportCategory to existing sports equipment items
 * Run with: npx tsx seed/migrate-sport-categories.ts
 */

// Map item names to their sport categories
const SPORT_CATEGORY_MAP: Record<string, string> = {
    // Football
    'football': 'FOOTBALL',

    // Basketball
    'basketball': 'BASKETBALL',

    // Badminton
    'badminton racket': 'BADMINTON',
    'shuttlecocks': 'BADMINTON',
    'shuttlecock': 'BADMINTON',

    // Table Tennis
    'tt paddle': 'TABLE_TENNIS',
    'tt balls': 'TABLE_TENNIS',
    'tt ball': 'TABLE_TENNIS',
    'table tennis paddle': 'TABLE_TENNIS',
    'table tennis ball': 'TABLE_TENNIS',

    // Cricket
    'cricket bat': 'CRICKET',
    'cricket ball': 'CRICKET',
    'cricket pads': 'CRICKET',
    'cricket helmet': 'CRICKET',
    'cricket gloves': 'CRICKET',
    'cricket stumps': 'CRICKET',
};

function getSportCategory(itemName: string): string {
    const nameLower = itemName.toLowerCase();

    // Check direct match first
    if (SPORT_CATEGORY_MAP[nameLower]) {
        return SPORT_CATEGORY_MAP[nameLower];
    }

    // Check partial match
    for (const [key, category] of Object.entries(SPORT_CATEGORY_MAP)) {
        if (nameLower.includes(key) || key.includes(nameLower)) {
            return category;
        }
    }

    // Default to GENERAL
    return 'GENERAL';
}

async function migrate() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB');

        // Find all sports equipment items (items that belong to SPORTS_EQUIPMENT resource)
        const items = await EquipmentItem.find({});

        console.log(`Found ${items.length} equipment items`);

        let updated = 0;
        for (const item of items) {
            const oldCategory = item.sportCategory;
            const newCategory = getSportCategory(item.name);

            // Only update if different or missing
            if (!oldCategory || oldCategory !== newCategory) {
                item.sportCategory = newCategory;
                await item.save();
                updated++;
                console.log(`  Updated: ${item.name} -> ${newCategory}`);
            }
        }

        console.log(`\n=== MIGRATION COMPLETE ===`);
        console.log(`Total items: ${items.length}`);
        console.log(`Updated: ${updated}`);
        console.log(`Skipped: ${items.length - updated}`);

        await mongoose.connection.close();
        console.log('\nMongoDB connection closed');
        process.exit(0);
    } catch (error) {
        console.error('Migration error:', error);
        process.exit(1);
    }
}

migrate();
