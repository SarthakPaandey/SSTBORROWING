import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IQRToken extends Document {
  bookingId: string;
  token: string;
  userId: string;
  expiresAt: Date;
  used: boolean;
  usedAt?: Date;
  createdAt: Date;
}

const QRTokenSchema = new Schema<IQRToken>(
  {
    bookingId: {
      type: String,
      required: true,
      ref: 'Booking'
    },
    token: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    used: { type: Boolean, default: false },
    usedAt: { type: Date },
  },
  {
    timestamps: true,
    collection: 'qr_tokens'
  }
);

QRTokenSchema.index({ token: 1 });
QRTokenSchema.index({ bookingId: 1 });
QRTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 86400 }); // Clean up after 24h

export const QRToken: Model<IQRToken> = mongoose.models.QRToken || mongoose.model<IQRToken>('QRToken', QRTokenSchema);
