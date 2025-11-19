import mongoose, { Schema, Document, Model } from 'mongoose';
import crypto from 'crypto';

export interface IApprovalToken extends Document {
  _id: string;
  bookingId: string;
  token: string;
  action: 'approve' | 'reject';
  expiresAt: Date;
  used: boolean;
  usedAt?: Date;
  createdAt: Date;
}

const ApprovalTokenSchema = new Schema<IApprovalToken>(
  {
    bookingId: {
      type: String,
      required: true,
      ref: 'Booking'
    },
    token: { type: String, required: true, unique: true },
    action: {
      type: String,
      enum: ['approve', 'reject'],
      required: true
    },
    expiresAt: { type: Date, required: true },
    used: { type: Boolean, default: false },
    usedAt: { type: Date },
  },
  {
    timestamps: true,
    collection: 'approval_tokens'
  }
);

ApprovalTokenSchema.index({ token: 1 });
ApprovalTokenSchema.index({ bookingId: 1 });
ApprovalTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 604800 }); // Clean up after 7 days

/**
 * Generate a secure random token
 */
export function generateApprovalToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export const ApprovalToken: Model<IApprovalToken> = 
  mongoose.models.ApprovalToken || mongoose.model<IApprovalToken>('ApprovalToken', ApprovalTokenSchema);

