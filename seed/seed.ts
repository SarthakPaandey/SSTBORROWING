import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { User } from '../models/User';
import { Resource } from '../models/Resource';
import { EquipmentItem } from '../models/EquipmentItem';
import { POLICIES } from '../lib/policies';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/sst-booking';

async function seed() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    // Clear existing data
    console.log('Clearing existing data...');
    await User.deleteMany({});
    await Resource.deleteMany({});
    await EquipmentItem.deleteMany({});
    console.log('Existing data cleared');

    // Create Admin User
    console.log('Creating admin user...');
    const admin = await User.create({
      name: 'Admin User',
      email: 'admin@scaler.com',
      role: 'ADMIN',
      penaltyPoints: 0,
    });
    console.log('Admin user created:', admin.email);

    // Create Guard Users
    console.log('Creating guard users...');
    const guardPassword = await bcrypt.hash('123456', 10);

    const guard1 = await User.create({
      name: 'Guard 1',
      email: 'guard-1@local',
      role: 'GUARD',
      password: guardPassword,
      penaltyPoints: 0,
    });

    const guard2 = await User.create({
      name: 'Guard 2',
      email: 'guard-2@local',
      role: 'GUARD',
      password: guardPassword,
      penaltyPoints: 0,
    });
    console.log('Guard users created');

    // Create Facilities
    console.log('Creating facilities...');

    const mainTurf = await Resource.create({
      type: 'FACILITY',
      name: 'Main Turf',
      location: 'Sports Complex',
      capacity: 22,
      rules: { slotMinutes: 60 },
      sharedGroupId: POLICIES.SHARED_TURF_GROUP_ID,
      status: 'ACTIVE',
    });

    const basketballCourt = await Resource.create({
      type: 'FACILITY',
      name: 'Basketball Court',
      location: 'Sports Complex',
      capacity: 10,
      rules: { slotMinutes: 60 },
      status: 'ACTIVE',
    });

    const volleyballCourt = await Resource.create({
      type: 'FACILITY',
      name: 'Volleyball Court',
      location: 'Sports Complex',
      capacity: 12,
      rules: { slotMinutes: 60 },
      status: 'ACTIVE',
    });

    const tableTennis1 = await Resource.create({
      type: 'FACILITY',
      name: 'Table Tennis 1',
      location: 'Recreation Room',
      capacity: 2,
      rules: { slotMinutes: 60 },
      status: 'ACTIVE',
    });

    const tableTennis2 = await Resource.create({
      type: 'FACILITY',
      name: 'Table Tennis 2',
      location: 'Recreation Room',
      capacity: 2,
      rules: { slotMinutes: 60 },
      status: 'ACTIVE',
    });

    console.log('Facilities created');

    // Create Rooms
    console.log('Creating rooms...');

    const meetingRoomA = await Resource.create({
      type: 'ROOM',
      name: 'Meeting Room A',
      location: 'Building B - Floor 2',
      capacity: 10,
      rules: { slotMinutes: 60 },
      status: 'ACTIVE',
    });

    const meetingRoomB = await Resource.create({
      type: 'ROOM',
      name: 'Meeting Room B',
      location: 'Building B - Floor 2',
      capacity: 8,
      rules: { slotMinutes: 60 },
      status: 'ACTIVE',
    });

    const meetingRoomC = await Resource.create({
      type: 'ROOM',
      name: 'Meeting Room C',
      location: 'Building B - Floor 3',
      capacity: 12,
      rules: { slotMinutes: 60 },
      status: 'ACTIVE',
    });

    const meetingRoomD = await Resource.create({
      type: 'ROOM',
      name: 'Meeting Room D',
      location: 'Building B - Floor 3',
      capacity: 6,
      rules: { slotMinutes: 60 },
      status: 'ACTIVE',
    });

    const studyRoom1 = await Resource.create({
      type: 'ROOM',
      name: 'Study Room 1',
      location: 'Library - Floor 1',
      capacity: 4,
      rules: { slotMinutes: 60 },
      status: 'ACTIVE',
    });

    const studyRoom2 = await Resource.create({
      type: 'ROOM',
      name: 'Study Room 2',
      location: 'Library - Floor 1',
      capacity: 4,
      rules: { slotMinutes: 60 },
      status: 'ACTIVE',
    });

    console.log('Rooms created');

    // Create Sports Equipment Resource
    console.log('Creating sports equipment...');
    const sportsEquipmentResource = await Resource.create({
      type: 'SPORTS_EQUIPMENT',
      name: 'Sports Equipment',
      location: 'Sports Complex - Counter',
      rules: { slotMinutes: 60 },
      status: 'ACTIVE',
    });

    const sportsItems = [
      { name: 'Football', qtyTotal: 4, qtyAvailable: 4, safety: false, restricted: false },
      { name: 'Basketball', qtyTotal: 2, qtyAvailable: 2, safety: false, restricted: false },
      { name: 'Badminton Racket', qtyTotal: 6, qtyAvailable: 6, safety: false, restricted: false },
      { name: 'Shuttlecocks', qtyTotal: 12, qtyAvailable: 12, safety: false, restricted: false },
      { name: 'TT Paddle', qtyTotal: 4, qtyAvailable: 4, safety: false, restricted: false },
      { name: 'TT Balls', qtyTotal: 6, qtyAvailable: 6, safety: false, restricted: false },
      { name: 'Cricket Bat', qtyTotal: 3, qtyAvailable: 3, safety: false, restricted: false },
      { name: 'Cricket Pads', qtyTotal: 2, qtyAvailable: 2, safety: true, restricted: false },
      { name: 'Cricket Helmet', qtyTotal: 2, qtyAvailable: 2, safety: true, restricted: false },
      { name: 'Cricket Ball', qtyTotal: 2, qtyAvailable: 2, safety: false, restricted: false },
    ];

    for (const item of sportsItems) {
      await EquipmentItem.create({
        resourceId: sportsEquipmentResource.id,
        ...item,
      });
    }

    console.log('Sports equipment created');

    // Create Lab Equipment Resource
    console.log('Creating lab equipment...');
    const labEquipmentResource = await Resource.create({
      type: 'LAB_EQUIPMENT',
      name: 'Innovation Lab Equipment',
      location: 'Innovation Lab - Building C',
      rules: {
        requiresApproval: true,
        slotMinutes: 60,
        studentsOnly: true,
      },
      status: 'ACTIVE',
    });

    const labItems = [
      { name: 'Arduino Kit', qtyTotal: 5, qtyAvailable: 5, safety: false, restricted: false },
      { name: 'Raspberry Pi', qtyTotal: 5, qtyAvailable: 5, safety: false, restricted: false },
      { name: 'Sensor Kit', qtyTotal: 5, qtyAvailable: 5, safety: false, restricted: false },
      { name: 'Soldering Iron', qtyTotal: 3, qtyAvailable: 3, safety: true, restricted: true },
      { name: 'Multimeter', qtyTotal: 3, qtyAvailable: 3, safety: false, restricted: false },
      { name: 'VR Headset', qtyTotal: 2, qtyAvailable: 2, safety: false, restricted: false },
    ];

    for (const item of labItems) {
      await EquipmentItem.create({
        resourceId: labEquipmentResource.id,
        ...item,
      });
    }

    console.log('Lab equipment created');

    // Create Library Resources with Categories
    console.log('Creating library categories...');

    // Fiction Library
    const fictionLibrary = await Resource.create({
      type: 'LIBRARY',
      name: 'Fiction Library',
      location: 'Library - Floor 2',
      rules: { slotMinutes: 20160, studentsOnly: true }, // 14 days
      status: 'ACTIVE',
    });

    const fictionBooks = [
      { name: '1984 by George Orwell', qtyTotal: 3, qtyAvailable: 3, safety: false, restricted: false },
      { name: 'To Kill a Mockingbird by Harper Lee', qtyTotal: 2, qtyAvailable: 2, safety: false, restricted: false },
      { name: 'The Great Gatsby by F. Scott Fitzgerald', qtyTotal: 2, qtyAvailable: 2, safety: false, restricted: false },
      { name: 'Pride and Prejudice by Jane Austen', qtyTotal: 2, qtyAvailable: 2, safety: false, restricted: false },
      { name: 'The Catcher in the Rye by J.D. Salinger', qtyTotal: 2, qtyAvailable: 2, safety: false, restricted: false },
    ];

    for (const book of fictionBooks) {
      await EquipmentItem.create({
        resourceId: fictionLibrary.id,
        ...book,
      });
    }

    // Non-Fiction Library
    const nonFictionLibrary = await Resource.create({
      type: 'LIBRARY',
      name: 'Non-Fiction Library',
      location: 'Library - Floor 2',
      rules: { slotMinutes: 20160, studentsOnly: true }, // 14 days
      status: 'ACTIVE',
    });

    const nonFictionBooks = [
      { name: 'Sapiens by Yuval Noah Harari', qtyTotal: 3, qtyAvailable: 3, safety: false, restricted: false },
      { name: 'Educated by Tara Westover', qtyTotal: 2, qtyAvailable: 2, safety: false, restricted: false },
      { name: 'Atomic Habits by James Clear', qtyTotal: 3, qtyAvailable: 3, safety: false, restricted: false },
      { name: 'Thinking, Fast and Slow by Daniel Kahneman', qtyTotal: 2, qtyAvailable: 2, safety: false, restricted: false },
      { name: 'The Lean Startup by Eric Ries', qtyTotal: 2, qtyAvailable: 2, safety: false, restricted: false },
    ];

    for (const book of nonFictionBooks) {
      await EquipmentItem.create({
        resourceId: nonFictionLibrary.id,
        ...book,
      });
    }

    // Textbooks Library
    const textbooksLibrary = await Resource.create({
      type: 'LIBRARY',
      name: 'Textbooks Library',
      location: 'Library - Floor 1',
      rules: { slotMinutes: 20160, studentsOnly: true }, // 14 days
      status: 'ACTIVE',
    });

    const textbooks = [
      { name: 'Introduction to Algorithms (CLRS)', qtyTotal: 4, qtyAvailable: 4, safety: false, restricted: false },
      { name: 'Clean Code by Robert C. Martin', qtyTotal: 3, qtyAvailable: 3, safety: false, restricted: false },
      { name: 'Design Patterns: Elements of Reusable Object-Oriented Software', qtyTotal: 2, qtyAvailable: 2, safety: false, restricted: false },
      { name: 'Computer Networks by Andrew S. Tanenbaum', qtyTotal: 3, qtyAvailable: 3, safety: false, restricted: false },
      { name: 'Operating System Concepts by Silberschatz', qtyTotal: 3, qtyAvailable: 3, safety: false, restricted: false },
    ];

    for (const book of textbooks) {
      await EquipmentItem.create({
        resourceId: textbooksLibrary.id,
        ...book,
      });
    }

    console.log('Library categories and books created');

    console.log('\n=== SEED DATA SUMMARY ===');
    console.log('Admin:', admin.email);
    console.log('Guards: guard-1@local, guard-2@local (password: 123456)');
    console.log('Facilities:', 5);
    console.log('Rooms:', 6);
    console.log('Sports Equipment Items:', sportsItems.length);
    console.log('Lab Equipment Items:', labItems.length);
    console.log('Library Categories:', 3);
    console.log('Library Books:', fictionBooks.length + nonFictionBooks.length + textbooks.length);
    console.log('\nDatabase seeded successfully!');
    console.log('\nYou can now:');
    console.log('1. Start the dev server: npm run dev');
    console.log('2. Sign in as admin: admin@scaler.com');
    console.log('3. Sign in as guard: guard-1 / 123456');
    console.log('4. Sign in as student: any @sst.scaler.com email via Google OAuth');

    await mongoose.connection.close();
    console.log('\nMongoDB connection closed');
    process.exit(0);
  } catch (error) {
    console.error('Seed error:', error);
    process.exit(1);
  }
}

seed();
