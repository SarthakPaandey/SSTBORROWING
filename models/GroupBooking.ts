import mongoose, { Schema, Document, Model } from 'mongoose';

export type GroupMemberStatus = 'PENDING' | 'CONFIRMED' | 'REJECTED';
export type GroupBookingStatus = 'PENDING_CONFIRMATIONS' | 'CONFIRMED' | 'CANCELLED' | 'EXPIRED';

export interface IGroupMember {
  userId: string;
  email: string;
  name: string;
  status: GroupMemberStatus;
  invitedAt: Date;
  respondedAt?: Date;
}

export interface IGroupBooking extends Document {
  bookingId: string; // Reference to main Booking
  organizerId: string; // User who created the group booking
  organizerEmail: string;
  members: IGroupMember[]; // All members except organizer
  requiredMinimum: number; // Usually 6 for team sports
  confirmedCount: number; // Number of confirmed members (including organizer)
  status: GroupBookingStatus;
  expiresAt: Date; // 2 hours from creation
  createdAt: Date;
  updatedAt: Date;
}

const GroupMemberSchema = new Schema({
  userId: { type: String, required: true, ref: 'User' },
  email: { type: String, required: true },
  name: { type: String, required: true },
  status: {
    type: String,
    enum: ['PENDING', 'CONFIRMED', 'REJECTED'],
    default: 'PENDING',
  },
  invitedAt: { type: Date, required: true, default: Date.now },
  respondedAt: { type: Date },
}, { _id: false });

const GroupBookingSchema = new Schema<IGroupBooking>(
  {
    bookingId: {
      type: String,
      required: true,
      ref: 'Booking',
      unique: true,
    },
    organizerId: {
      type: String,
      required: true,
      ref: 'User',
    },
    organizerEmail: {
      type: String,
      required: true,
    },
    members: [GroupMemberSchema],
    requiredMinimum: {
      type: Number,
      required: true,
      default: 6,
    },
    confirmedCount: {
      type: Number,
      required: true,
      default: 1, // Organizer is auto-confirmed
    },
    status: {
      type: String,
      enum: ['PENDING_CONFIRMATIONS', 'CONFIRMED', 'CANCELLED', 'EXPIRED'],
      default: 'PENDING_CONFIRMATIONS',
    },
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: true,
    collection: 'groupBookings'
  }
);

GroupBookingSchema.index({ bookingId: 1 });
GroupBookingSchema.index({ organizerId: 1 });
GroupBookingSchema.index({ 'members.userId': 1 });
GroupBookingSchema.index({ status: 1, expiresAt: 1 });

export const GroupBooking: Model<IGroupBooking> = mongoose.models.GroupBooking || mongoose.model<IGroupBooking>('GroupBooking', GroupBookingSchema);
