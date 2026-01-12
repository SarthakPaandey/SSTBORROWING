#!/usr/bin/env tsx
/**
 * Upsert the full sports equipment set with availability reset.
 *
 * Usage:
 *   MONGODB_URI="your-connection-string" pnpm tsx scripts/upsert-sports-items.ts
 */

import mongoose from 'mongoose';
import { connectDB } from '@/lib/db';
import { Resource } from '@/models/Resource';
import { EquipmentItem } from '@/models/EquipmentItem';

const items = [
  { name: 'Football', qtyTotal: 4, sportCategory: 'FOOTBALL' },
  { name: 'Basketball', qtyTotal: 2, sportCategory: 'BASKETBALL' },
  { name: 'Badminton Racket', qtyTotal: 8, sportCategory: 'BADMINTON' },
  { name: 'Cricket Bat', qtyTotal: 4, sportCategory: 'CRICKET' },
  { name: 'Cricket Ball', qtyTotal: 4, sportCategory: 'CRICKET' },
  { name: 'Cricket Stumps', qtyTotal: 4, sportCategory: 'CRICKET' },
  { name: 'Volleyball', qtyTotal: 3, sportCategory: 'VOLLEYBALL' },
  { name: 'TT Bat', qtyTotal: 8, sportCategory: 'TABLE_TENNIS' },
  { name: 'TT Ball', qtyTotal: 4, sportCategory: 'TABLE_TENNIS' },
];

async function main() {
  await connectDB();

  const sportsRes = await Resource.findOne({ type: 'SPORTS_EQUIPMENT' });
  if (!sportsRes) {
    throw new Error('No SPORTS_EQUIPMENT resource found');
  }

  for (const item of items) {
    await EquipmentItem.findOneAndUpdate(
      { name: item.name, resourceId: sportsRes._id },
      {
        $set: {
          resourceId: sportsRes._id,
          sportCategory: item.sportCategory,
          qtyTotal: item.qtyTotal,
          qtyAvailable: item.qtyTotal,
          safety: false,
          restricted: false,
        },
      },
      { upsert: true, new: true }
    );
  }

  console.log('Sports items upserted');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.connection.close();
  });














