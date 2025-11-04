import mongoose, { Schema, Document, Model } from 'mongoose';

export type BookingKind = 'FACILITY' | 'ROOM' | 'EQUIPMENT';
export type BookingStatus = 'PENDING' | 'CONFIRMED' | 'CHECKED_IN' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';
export type ApprovalStatus = 'NOT_REQUIRED' | 'PENDING' | 'APPROVED' | 'REJECTED';

export interface IBookingItem {
  itemId: string;
  name: string;
  qty: number;
}

export interface IBooking extends Document {
  _id: string;
  userId: string;
  resourceId: string;
  kind: BookingKind;
  items?: IBookingItem[]; // For equipment bookings
  start: Date;
  end: Date;
  status: BookingStatus;
  requiresApproval: boolean;
  approval: ApprovalStatus;
  qrIssued: boolean;
  approvedBy?: string; // Admin user ID
  approvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const BookingItemSchema = new Schema({
  itemId: { type: String, required: true },
  name: { type: String, required: true },
  qty: { type: Number, required: true, min: 1 },
}, { _id: false });

const BookingSchema = new Schema<IBooking>(
  {
    userId: {
      type: String,
      required: true,
      ref: 'User'
    },
    resourceId: {
      type: String,
      required: true,
      ref: 'Resource'
    },
    kind: {
      type: String,
      enum: ['FACILITY', 'ROOM', 'EQUIPMENT'],
      required: true,
    },
    items: [BookingItemSchema],
    start: { type: Date, required: true },
    end: { type: Date, required: true },
    status: {
      type: String,
      enum: ['PENDING', 'CONFIRMED', 'CHECKED_IN', 'COMPLETED', 'CANCELLED', 'NO_SHOW'],
      default: 'PENDING',
    },
    requiresApproval: { type: Boolean, default: false },
    approval: {
      type: String,
      enum: ['NOT_REQUIRED', 'PENDING', 'APPROVED', 'REJECTED'],
      default: 'NOT_REQUIRED',
    },
    qrIssued: { type: Boolean, default: false },
    approvedBy: { type: String, ref: 'User' },
    approvedAt: { type: Date },
  },
  {
    timestamps: true,
    collection: 'bookings'
  }
);

BookingSchema.index({ userId: 1, status: 1 });
BookingSchema.index({ resourceId: 1, start: 1, end: 1 });
BookingSchema.index({ status: 1, start: 1 });
BookingSchema.index({ approval: 1 });

export const Booking: Model<IBooking> = mongoose.models.Booking || mongoose.model<IBooking>('Booking', BookingSchema);
