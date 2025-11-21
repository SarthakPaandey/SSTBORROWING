import mongoose, { Schema, Document, Model } from 'mongoose';

export type BookingKind = 'FACILITY' | 'ROOM' | 'EQUIPMENT' | 'LIBRARY';
export type BookingStatus = 'PENDING' | 'CONFIRMED' | 'CHECKED_IN' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';
export type ApprovalStatus = 'NOT_REQUIRED' | 'PENDING' | 'APPROVED' | 'REJECTED';

export interface IBookingItem {
  itemId: string;
  name: string;
  qty: number;
}

export interface IBooking extends Document {
  userId: string;
  resourceId: string;
  kind: 'FACILITY' | 'ROOM' | 'EQUIPMENT' | 'LIBRARY';
  items?: {
    itemId: string;
    name: string;
    qty: number;
  }[];
  start: Date;
  end: Date;
  status: BookingStatus;
  requiresApproval: boolean;
  approval: ApprovalStatus;
  approvedBy?: string;
  approvedAt?: Date;
  qrCode?: string;
  qrIssued?: boolean;
  isGroupBooking?: boolean;
  groupBookingId?: string;
  checkedInAt?: Date;
  returnedAt?: Date;
  returnCondition?: string;
  returnNotes?: string;
  returnedBy?: string; // Guard ID
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
      enum: ['FACILITY', 'ROOM', 'EQUIPMENT', 'LIBRARY'],
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
    isGroupBooking: { type: Boolean, default: false },
    groupBookingId: { type: String, ref: 'GroupBooking' },
    approvedBy: { type: String, ref: 'User' },
    approvedAt: { type: Date },
    checkedInAt: { type: Date },
    returnedAt: { type: Date },
    returnCondition: {
      type: String,
      enum: ['excellent', 'good', 'fair', 'damaged'],
    },
    returnNotes: { type: String },
    returnedBy: { type: String, ref: 'User' },
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

// Unique index to prevent overlapping bookings (race condition protection)
// Only applies to active bookings (PENDING, CONFIRMED, CHECKED_IN)
// This ensures database-level enforcement even if application logic has race conditions
BookingSchema.index(
  { resourceId: 1, start: 1, end: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: { $in: ['PENDING', 'CONFIRMED', 'CHECKED_IN'] },
      // Group bookings can overlap with individual bookings on same resource
      isGroupBooking: { $ne: true }
    },
    name: 'unique_active_booking_slot'
  }
);

export const Booking: Model<IBooking> = mongoose.models.Booking || mongoose.model<IBooking>('Booking', BookingSchema);
