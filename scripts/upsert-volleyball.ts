#!/usr/bin/env tsx
/**
 * Upsert 3 volleyballs (all available) into the SPORTS_EQUIPMENT resource.
 * Usage:
 *   MONGODB_URI="your-connection-string" pnpm tsx scripts/upsert-volleyball.ts
 */

import mongoose from 'mongoose';
import { connectDB } from '@/lib/db';
import { Resource } from '@/models/Resource';
import { EquipmentItem } from '@/models/EquipmentItem';

async function main() {
  await connectDB();

  const sportsRes = await Resource.findOne({ type: 'SPORTS_EQUIPMENT' });
  if (!sportsRes) {
    throw new Error('No SPORTS_EQUIPMENT resource found');
  }

  const item = await EquipmentItem.findOneAndUpdate(
    { name: 'Volleyball', resourceId: sportsRes._id },
    {
      $set: {
        resourceId: sportsRes._id,
        sportCategory: 'VOLLEYBALL',
        qtyTotal: 3,
        qtyAvailable: 3,
        safety: false,
        restricted: false,
      },
    },
    { upsert: true, new: true }
  );

  console.log('Upserted Volleyball item:', item?.toObject());
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.connection.close();
  });














