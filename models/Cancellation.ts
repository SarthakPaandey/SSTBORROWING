import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ICancellation extends Document {
  _id: string;
  bookingId: string;
  userId: string;
  resourceId: string;
  resourceName: string;
  bookingStart: Date;
  cancelledAt: Date;
  wasLate: boolean; // Cancelled within 2 hours of start
  penaltyApplied: number;
  createdAt: Date;
}

const CancellationSchema = new Schema<ICancellation>(
  {
    bookingId: { type: String, required: true },
    userId: { type: String, required: true, index: true },
    resourceId: { type: String, required: true },
    resourceName: { type: String, required: true },
    bookingStart: { type: Date, required: true },
    cancelledAt: { type: Date, required: true, default: Date.now },
    wasLate: { type: Boolean, default: false },
    penaltyApplied: { type: Number, default: 0 },
  },
  {
    timestamps: true,
    collection: 'cancellations',
  }
);

CancellationSchema.index({ userId: 1, cancelledAt: -1 });

export const Cancellation: Model<ICancellation> =
  mongoose.models.Cancellation || mongoose.model<ICancellation>('Cancellation', CancellationSchema);
