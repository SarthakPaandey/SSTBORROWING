// Load environment variables FIRST before any imports
import { readFileSync } from 'fs';
import { join } from 'path';

// Must load env before importing anything that uses process.env
try {
    const envFile = readFileSync(join(process.cwd(), '.env.local'), 'utf8');
    envFile.split('\n').forEach(line => {
        const match = line.match(/^([^=:#]+)=(.*)$/);
        if (match) {
            const key = match[1].trim();
            const value = match[2].trim();
            if (!process.env[key]) { // Don't override existing env vars
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
import { connectDB } from '../lib/db';
import { Booking } from '../models/Booking';
import { EquipmentItem } from '../models/EquipmentItem';

// Script to recalculate qtyReserved for all equipment based on active bookings
// This fixes phantom reservations from cancelled/expired bookings

async function fixInventoryReservations() {
    await connectDB();

    console.log('🔧 Starting inventory reservation fix...\n');

    // Get all equipment items
    const allEquipment = await EquipmentItem.find({});
    console.log(`Found ${allEquipment.length} equipment items\n`);

    for (const equipment of allEquipment) {
        console.log(`\n📦 Processing: ${equipment.name}`);
        console.log(`   Current: qtyAvailable=${equipment.qtyAvailable}, qtyReserved=${equipment.qtyReserved}, qtyTotal=${equipment.qtyTotal}`);

        // Find all ACTIVE bookings for this equipment (PENDING or CONFIRMED)
        const activeBookings = await Booking.find({
            items: {
                $elemMatch: { itemId: equipment._id }
            },
            status: { $in: ['PENDING', 'CONFIRMED'] }
        });

        // Calculate correct reserved quantity
        let correctReserved = 0;
        for (const booking of activeBookings) {
            const item = booking.items?.find(i => i.itemId.toString() === String(equipment._id));
            if (item) {
                correctReserved += item.qty;
                console.log(`   ✓ Active booking ${booking._id}: ${item.qty} reserved (status: ${booking.status})`);
            }
        }

        console.log(`   Calculated reserved: ${correctReserved}`);

        // Update if different
        if (equipment.qtyReserved !== correctReserved) {
            console.log(`   ❌ MISMATCH! Database shows ${equipment.qtyReserved}, should be ${correctReserved}`);
            equipment.qtyReserved = correctReserved;
            await equipment.save();
            console.log(`   ✅ Fixed! Updated qtyReserved to ${correctReserved}`);
        } else {
            console.log(`   ✅ OK - Reservation count is correct`);
        }
    }

    console.log('\n\n✨ Inventory reservation fix complete!\n');
    process.exit(0);
}

fixInventoryReservations().catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
});
