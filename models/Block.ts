import mongoose, { Schema, Document, Model } from 'mongoose';

export type BlockType = 'EVENT' | 'MAINTENANCE';

export interface IBlock extends Document {
  resourceId: string;
  start: Date;
  end: Date;
  reason: string;
  type: BlockType;
  createdBy: string; // Admin user ID
  createdAt: Date;
  recurringGroupId?: string; // UUID to group recurring blocks
  recurringPattern?: string; // Human-readable pattern description
}

const BlockSchema = new Schema<IBlock>(
  {
    resourceId: {
      type: String,
      required: true,
      ref: 'Resource'
    },
    start: { type: Date, required: true },
    end: { type: Date, required: true },
    reason: { type: String, required: true },
    type: {
      type: String,
      enum: ['EVENT', 'MAINTENANCE'],
      required: true,
    },
    createdBy: {
      type: String,
      required: true,
      ref: 'User'
    },
    recurringGroupId: {
      type: String,
      required: false,
    },
    recurringPattern: {
      type: String,
      required: false,
    },
  },
  {
    timestamps: true,
    collection: 'blocks'
  }
);

BlockSchema.index({ resourceId: 1, start: 1, end: 1 });
BlockSchema.index({ recurringGroupId: 1 }); // Index for efficient series queries

export const Block: Model<IBlock> = mongoose.models.Block || mongoose.model<IBlock>('Block', BlockSchema);
