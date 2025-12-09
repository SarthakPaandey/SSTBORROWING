import mongoose from 'mongoose';

import { connectDB } from '../lib/db.js';
import { Resource } from '../models/Resource.js';
import { EquipmentItem } from '../models/EquipmentItem.js';

// Desired meeting room numbers and shared properties
const MEETING_ROOM_NUMBERS = [6, 7, 9, 10, 12, 13, 14];
const MEETING_ROOM_LOCATION = 'Macro Campus - First Floor';
const MEETING_ROOM_CAPACITY = 8;
const MEETING_ROOM_RULES = { slotMinutes: 60 };

async function main() {
  await connectDB();

  // Ensure only one Table Tennis facility exists
  await Resource.deleteMany({
    type: 'FACILITY',
    $and: [
      { name: { $regex: /^Table Tennis\s*\d*$/i } },
      { name: { $ne: 'Table Tennis' } },
    ],
  });

  await Resource.findOneAndUpdate(
    { type: 'FACILITY', name: 'Table Tennis' },
    {
      $set: {
        location: 'Recreation Room',
        capacity: 2,
        rules: { slotMinutes: 60 },
        status: 'ACTIVE',
      },
    },
    { upsert: true, new: true }
  );

  // Remove legacy meeting rooms not in the desired set (e.g., Meeting Room A/B/C/D)
  const allowedMeetingRoomNames = MEETING_ROOM_NUMBERS.map((n) => `Meeting Room ${n}`);
  await Resource.deleteMany({
    type: 'ROOM',
    name: { $regex: /^Meeting Room /i, $nin: allowedMeetingRoomNames },
  });

  // Remove all study rooms (no longer available on campus)
  await Resource.deleteMany({
    type: 'ROOM',
    name: { $regex: /^Study Room /i },
  });

  // Normalize sports equipment inventory to the new allowed items and limits
  const allowedItems = [
    { name: 'Football', qtyTotal: 4, sportCategory: 'FOOTBALL' },
    { name: 'Basketball', qtyTotal: 2, sportCategory: 'BASKETBALL' },
    { name: 'Badminton Racket', qtyTotal: 8, sportCategory: 'BADMINTON' },
    { name: 'Cricket Bat', qtyTotal: 4, sportCategory: 'CRICKET' },
    { name: 'Cricket Ball', qtyTotal: 4, sportCategory: 'CRICKET' },
    { name: 'Cricket Stumps', qtyTotal: 4, sportCategory: 'CRICKET' },
    { name: 'Volleyball', qtyTotal: 2, sportCategory: 'VOLLEYBALL' },
    { name: 'TT Bat', qtyTotal: 8, sportCategory: 'TABLE_TENNIS' },
    { name: 'TT Ball', qtyTotal: 4, sportCategory: 'TABLE_TENNIS' },
  ];

  const allowedNames = allowedItems.map((i) => i.name);

  // Remove any other sports equipment items
  await EquipmentItem.deleteMany({
    sportCategory: { $in: ['FOOTBALL', 'BASKETBALL', 'BADMINTON', 'CRICKET', 'VOLLEYBALL', 'TABLE_TENNIS'] },
    name: { $nin: allowedNames },
  });

  for (const item of allowedItems) {
    await EquipmentItem.findOneAndUpdate(
      { name: item.name, sportCategory: item.sportCategory },
      {
        $set: {
          qtyTotal: item.qtyTotal,
          qtyAvailable: item.qtyTotal,
          safety: false,
          restricted: false,
        },
      },
      { upsert: true, new: true }
    );
  }

  // Upsert desired meeting rooms
  for (const roomNumber of MEETING_ROOM_NUMBERS) {
    const name = `Meeting Room ${roomNumber}`;
    await Resource.findOneAndUpdate(
      { type: 'ROOM', name },
      {
        $set: {
          location: MEETING_ROOM_LOCATION,
          capacity: MEETING_ROOM_CAPACITY,
          rules: MEETING_ROOM_RULES,
          status: 'ACTIVE',
        },
      },
      { upsert: true, new: true }
    );
  }

  console.log('Meeting rooms and table tennis facility have been normalized.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.connection.close();
  });

