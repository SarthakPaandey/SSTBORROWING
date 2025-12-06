import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IEquipmentItem extends Document {
  resourceId: string;
  name: string;
  description?: string;
  qtyTotal: number;
  qtyAvailable: number;
  qtyReserved: number; // Tracks quantity currently reserved by active bookings
  imageUrl?: string;
  safety: boolean;
  restricted: boolean;
  requiresApproval: boolean; // Whether this item requires admin approval to book
  sportCategory?: string; // Sport category for SPORTS_EQUIPMENT (e.g., 'BADMINTON', 'BASKETBALL', 'CRICKET', 'GENERAL')
  createdAt: Date;
  updatedAt: Date;
}

const EquipmentItemSchema = new Schema<IEquipmentItem>(
  {
    resourceId: {
      type: String,
      required: true,
      ref: 'Resource'
    },
    name: { type: String, required: true },
    qtyTotal: { type: Number, required: true, min: 0 },
    qtyAvailable: { type: Number, required: true, min: 0 },
    qtyReserved: { type: Number, default: 0, min: 0 }, // Currently reserved by active bookings
    safety: { type: Boolean, default: false },
    restricted: { type: Boolean, default: false },
    requiresApproval: { type: Boolean, default: false }, // Requires admin approval
    sportCategory: { type: String }, // Optional: Only for SPORTS_EQUIPMENT items
  },
  {
    timestamps: true,
    collection: 'equipment_items'
  }
);

EquipmentItemSchema.index({ resourceId: 1 });

export const EquipmentItem: Model<IEquipmentItem> = mongoose.models.EquipmentItem || mongoose.model<IEquipmentItem>('EquipmentItem', EquipmentItemSchema);
