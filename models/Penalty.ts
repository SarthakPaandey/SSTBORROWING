import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IPenalty extends Document {
  _id: string;
  userId: string;
  bookingId?: string;
  points: number;
  reason: string;
  waivedBy?: string; // Admin who waived
  waivedAt?: Date;
  createdAt: Date;
}

const PenaltySchema = new Schema<IPenalty>(
  {
    userId: {
      type: String,
      required: true,
      ref: 'User'
    },
    bookingId: {
      type: String,
      ref: 'Booking'
    },
    points: { type: Number, required: true },
    reason: { type: String, required: true },
    waivedBy: { type: String, ref: 'User' },
    waivedAt: { type: Date },
  },
  {
    timestamps: true,
    collection: 'penalties'
  }
);

PenaltySchema.index({ userId: 1, createdAt: -1 });
PenaltySchema.index({ bookingId: 1 });

export const Penalty: Model<IPenalty> = mongoose.models.Penalty || mongoose.model<IPenalty>('Penalty', PenaltySchema);
