import mongoose, { Schema, Document, Model } from 'mongoose';

// Lab equipment categories for different borrow duration rules
export type LabEquipmentCategory = 'LAPTOP' | 'SAME_DAY_RETURN' | 'GENERAL';

export interface IEquipmentItem extends Document {
  resourceId: string;
  name: string;
  description?: string;
  qtyTotal: number;
  qtyAvailable: number;
  // Deprecated: kept for legacy scripts/tests; runtime uses time-based overlap checks
  qtyReserved: number;
  imageUrl?: string;
  safety: boolean;
  restricted: boolean;
  requiresApproval: boolean; // Whether this item requires admin approval to book
  sportCategory?: string; // Sport category for SPORTS_EQUIPMENT (e.g., 'BADMINTON', 'BASKETBALL', 'CRICKET', 'GENERAL')
  labCategory?: LabEquipmentCategory; // Lab equipment category for LAB_EQUIPMENT (determines borrow duration limits)
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
    // Deprecated legacy field (no longer used for blocking). Kept for backward compatibility.
    qtyReserved: { type: Number, default: 0, min: 0 },
    safety: { type: Boolean, default: false },
    restricted: { type: Boolean, default: false },
    requiresApproval: { type: Boolean, default: false }, // Requires admin approval
    sportCategory: { type: String }, // Optional: Only for SPORTS_EQUIPMENT items
    labCategory: { type: String, enum: ['LAPTOP', 'SAME_DAY_RETURN', 'GENERAL'] }, // Optional: Only for LAB_EQUIPMENT items
  },
  {
    timestamps: true,
    collection: 'equipment_items'
  }
);

EquipmentItemSchema.index({ resourceId: 1 });

export const EquipmentItem: Model<IEquipmentItem> = mongoose.models.EquipmentItem || mongoose.model<IEquipmentItem>('EquipmentItem', EquipmentItemSchema);
