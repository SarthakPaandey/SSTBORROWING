import mongoose, { Schema, Document, Model } from 'mongoose';

export type ResourceType = 'FACILITY' | 'ROOM' | 'LAB_EQUIPMENT' | 'SPORTS_EQUIPMENT' | 'LIBRARY';
export type ResourceStatus = 'ACTIVE' | 'INACTIVE';

export interface IResourceRules {
  requiresApproval?: boolean;
  slotMinutes?: number;
  studentsOnly?: boolean;
}

export interface IResource extends Document {
  _id: string;
  type: ResourceType;
  name: string;
  location?: string;
  capacity?: number;
  rules: IResourceRules;
  sharedGroupId?: string; // For shared turf
  status: ResourceStatus;
  createdAt: Date;
  updatedAt: Date;
}

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
  },
  {
    timestamps: true,
    collection: 'resources'
  }
);

ResourceSchema.index({ type: 1, status: 1 });
ResourceSchema.index({ sharedGroupId: 1 });

export const Resource: Model<IResource> = mongoose.models.Resource || mongoose.model<IResource>('Resource', ResourceSchema);
