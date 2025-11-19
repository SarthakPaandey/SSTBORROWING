import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IEquipmentItem extends Document {
  resourceId: string;
  name: string;
  description?: string;
  qtyTotal: number;
  qtyAvailable: number;
  imageUrl?: string;
  safety: boolean;
  restricted: boolean;
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
    safety: { type: Boolean, default: false },
    restricted: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    collection: 'equipment_items'
  }
);

EquipmentItemSchema.index({ resourceId: 1 });

export const EquipmentItem: Model<IEquipmentItem> = mongoose.models.EquipmentItem || mongoose.model<IEquipmentItem>('EquipmentItem', EquipmentItemSchema);
