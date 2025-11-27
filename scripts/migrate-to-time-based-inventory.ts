import { readFileSync } from 'fs';
import { join } from 'path';
import { connectDB } from '../lib/db';
import { EquipmentItem } from '../models/EquipmentItem';

// Load environment variables from .env.local
try {
    const envFile = readFileSync(join(process.cwd(), '.env.local'), 'utf8');
    envFile.split('\n').forEach(line => {
        const match = line.match(/^([^=:#]+)=(.*)$/);
        if (match) {
            const key = match[1].trim();
            const value = match[2].trim();
            if (!process.env[key]) {
                process.env[key] = value;
            }
        }
    });
    console.log('✓ Loaded environment variables from .env.local\n');
} catch (error) {
    console.log('⚠ No .env.local file found, trying .env...\n');
    try {
        const envFile = readFileSync(join(process.cwd(), '.env'), 'utf8');
        envFile.split('\n').forEach(line => {
            const match = line.match(/^([^=:#]+)=(.*)$/);
            if (match) {
                const key = match[1].trim();
                const value = match[2].trim();
                if (!process.env[key]) {
                    process.env[key] = value;
                }
            }
        });
        console.log('✓ Loaded environment variables from .env\n');
    } catch (err) {
        console.log('⚠ No .env file found either. Using existing environment variables.\n');
    }
}

// NOW import after env is loaded
import { Booking } from '../models/Booking';

// Migration script to reset qtyReserved to 0 for all equipment
// This is needed after switching to time-based overlap checking

async function migrateInventory() {
    await connectDB();

    console.log('🔧 Starting inventory migration...\n');
    console.log('This will reset qtyReserved to 0 for all equipment items.');
    console.log('The system now uses time-based overlap checking instead.\n');

    // Get all equipment items
    const allEquipment = await EquipmentItem.find({});
    console.log(`Found ${allEquipment.length} equipment items\n`);

    let updatedCount = 0;

    for (const equipment of allEquipment) {
        if (equipment.qtyReserved !== 0) {
            console.log(`📦 ${equipment.name}: qtyReserved = ${equipment.qtyReserved} → 0`);
            equipment.qtyReserved = 0;
            await equipment.save();
            updatedCount++;
        } else {
            console.log(`✓ ${equipment.name}: already at 0`);
        }
    }

    console.log(`\n✨ Migration complete!`);
    console.log(`   Updated ${updatedCount} items`);
    console.log(`   ${allEquipment.length - updatedCount} items were already at 0\n`);

    process.exit(0);
}

migrateInventory().catch((error) => {
    console.error('❌ Migration error:', error);
    process.exit(1);
});
