import mongoose, { Schema, Document, Model } from 'mongoose';

export type ResourceType = 'FACILITY' | 'ROOM' | 'LAB_EQUIPMENT' | 'SPORTS_EQUIPMENT' | 'LIBRARY';
export type ResourceStatus = 'ACTIVE' | 'INACTIVE';

export interface IResourceRules {
  requiresApproval?: boolean;
  slotMinutes?: number;
  studentsOnly?: boolean;
}

// Operating hours for each day of the week (0 = Sunday, 6 = Saturday)
export interface IDaySchedule {
  open: boolean; // Is the resource available on this day?
  startHour: number; // Opening hour (0-23)
  endHour: number; // Closing hour (1-24)
}

export interface IOperatingHours {
  useCustom: boolean; // If false, use system-wide hours from policies
  schedule: IDaySchedule[]; // Array of 7 days (Sunday to Saturday)
}

export interface IResource extends Document {
  name: string;
  type: 'FACILITY' | 'ROOM' | 'LAB_EQUIPMENT' | 'SPORTS_EQUIPMENT' | 'LIBRARY';
  location?: string;
  capacity?: number;
  description?: string;
  imageUrl?: string;
  rules: IResourceRules;
  sharedGroupId?: string;
  status: ResourceStatus;
  operatingHours?: IOperatingHours; // Custom operating hours per resource
  createdAt: Date;
  updatedAt: Date;
}

const DayScheduleSchema = new Schema({
  open: { type: Boolean, default: true },
  startHour: { type: Number, default: 8, min: 0, max: 23 },
  endHour: { type: Number, default: 20, min: 1, max: 24 },
}, { _id: false });

const OperatingHoursSchema = new Schema({
  useCustom: { type: Boolean, default: false },
  schedule: {
    type: [DayScheduleSchema],
    default: () => [
      { open: false, startHour: 8, endHour: 20 }, // Sunday - closed
      { open: true, startHour: 8, endHour: 20 },  // Monday
      { open: true, startHour: 8, endHour: 20 },  // Tuesday
      { open: true, startHour: 8, endHour: 20 },  // Wednesday
      { open: true, startHour: 8, endHour: 20 },  // Thursday
      { open: true, startHour: 8, endHour: 20 },  // Friday
      { open: true, startHour: 8, endHour: 18 },  // Saturday - shorter hours
    ],
  },
}, { _id: false });

const ResourceSchema = new Schema<IResource>(
  {
    type: {
      type: String,
      enum: ['FACILITY', 'ROOM', 'LAB_EQUIPMENT', 'SPORTS_EQUIPMENT', 'LIBRARY'],
      required: true,
    },
    name: { type: String, required: true },
    location: { type: String },
    capacity: { type: Number },
    rules: {
      requiresApproval: { type: Boolean, default: false },
      slotMinutes: { type: Number },
      studentsOnly: { type: Boolean, default: false },
    },
    sharedGroupId: { type: String }, // e.g., "TURF-1" for football/cricket
    status: {
      type: String,
      enum: ['ACTIVE', 'INACTIVE'],
      default: 'ACTIVE',
    },
    operatingHours: { type: OperatingHoursSchema },
  },
  {
    timestamps: true,
    collection: 'resources'
  }
);

ResourceSchema.index({ type: 1, status: 1 });
ResourceSchema.index({ sharedGroupId: 1 });

export const Resource: Model<IResource> = mongoose.models.Resource || mongoose.model<IResource>('Resource', ResourceSchema);

