import mongoose, { Schema, Document, Model } from 'mongoose';

export type BookingKind = 'FACILITY' | 'ROOM' | 'EQUIPMENT' | 'LIBRARY';
export type BookingStatus = 'PENDING' | 'CONFIRMED' | 'CHECKED_IN' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW' | 'RETURNED';
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
  approvalEmailSent?: boolean; // Track if approval email was sent to admins
  approvalEmailSentAt?: Date; // When approval email was sent
  approvalEmailError?: string; // Error message if email send failed
  rejectionReason?: string; // Optional reason provided when admin rejects booking
  borrowReason?: string; // Optional reason/purpose provided by user when borrowing lab equipment
  rescheduleCount: number; // Number of times this booking has been rescheduled
  extensionCount: number;  // Number of times this equipment booking has been extended
  rescheduleHistory?: {
    oldStart: Date;
    oldEnd: Date;
    newStart: Date;
    newEnd: Date;
    rescheduledAt: Date;
    rescheduledBy: string; // User ID who performed reschedule
    reason?: string;
  }[];
  // Admin override fields for force actions
  overrideBy?: string; // Admin ID who performed override
  overrideAt?: Date; // When override was performed
  overrideReason?: string; // Reason for admin intervention
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
    items: {
      type: [BookingItemSchema],
      // FIX EC-41: Prevent empty items array for equipment/library bookings
      validate: {
        validator: function (this: IBooking, items: any[]) {
          // Only validate if kind is EQUIPMENT or LIBRARY
          if (this.kind === 'EQUIPMENT' || this.kind === 'LIBRARY') {
            return items && items.length > 0;
          }
          return true; // FACILITY and ROOM don't need items
        },
        message: 'Equipment and Library bookings must have at least one item'
      }
    },
    start: { type: Date, required: true },
    end: { type: Date, required: true },
    status: {
      type: String,
      enum: ['PENDING', 'CONFIRMED', 'CHECKED_IN', 'COMPLETED', 'CANCELLED', 'NO_SHOW', 'RETURNED'],
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
    approvalEmailSent: { type: Boolean, default: false }, // Track email delivery
    approvalEmailSentAt: { type: Date }, // Timestamp of successful send
    approvalEmailError: { type: String }, // Error message if send failed
    rejectionReason: { type: String }, // Optional reason provided when admin rejects booking
    borrowReason: { type: String, maxlength: 500 }, // Optional reason/purpose provided by user
    // Reschedule tracking fields
    rescheduleCount: {
      type: Number,
      default: 0,
      required: true,
      min: 0
    },
    // Extension tracking (for equipment/library)
    extensionCount: {
      type: Number,
      default: 0,
      min: 0
    },
    rescheduleHistory: [{
      oldStart: { type: Date, required: true },
      oldEnd: { type: Date, required: true },
      newStart: { type: Date, required: true },
      newEnd: { type: Date, required: true },
      rescheduledAt: { type: Date, required: true },
      rescheduledBy: { type: String, required: true },
      reason: { type: String }
    }],
    // Admin override fields
    overrideBy: { type: String, ref: 'User' },
    overrideAt: { type: Date },
    overrideReason: { type: String }
  },
  {
    timestamps: true,
    collection: 'bookings'
  }
);

BookingSchema.index({ userId: 1, status: 1 });
// NOTE: Removed redundant { resourceId: 1, start: 1, end: 1 } index - covered by unique partial index below
BookingSchema.index({ status: 1, start: 1 });
BookingSchema.index({ approval: 1 });
// FIX EC-67: Index on items.itemId for faster equipment availability queries
BookingSchema.index({ 'items.itemId': 1, status: 1, start: 1, end: 1 });

// Unique index to prevent overlapping bookings (race condition protection)
// Only applies to active bookings (PENDING, CONFIRMED, CHECKED_IN)
// FIX: Only apply to FACILITY and ROOM bookings - equipment/library use inventory-based contention
// NOTE: Group booking overlap is handled by application logic, not this index
// (MongoDB partial indexes don't support $ne operator)
// This ensures database-level enforcement even if application logic has race conditions
BookingSchema.index(
  { resourceId: 1, start: 1, end: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: { $in: ['PENDING', 'CONFIRMED', 'CHECKED_IN'] },
      // Only enforce for time-slot based bookings (not equipment/library which use inventory)
      kind: { $in: ['FACILITY', 'ROOM'] }
    },
    name: 'unique_active_booking_slot'
  }
);

export const Booking: Model<IBooking> = mongoose.models.Booking || mongoose.model<IBooking>('Booking', BookingSchema);
