import mongoose, { Schema, Document, Model } from 'mongoose';

export type UserRole = 'STUDENT' | 'ADMIN' | 'GUARD';

export interface IUser extends Document {
  name: string;
  email: string;
  role: UserRole;
  image?: string;
  password?: string; // For guards only (bcrypt hash)
  penaltyPoints: number;
  suspendedUntil?: Date;
  suspensionLevel: number; // 0=fresh, 1=probation, 2=final warning
  blocked: boolean; // Permanent block
  blockedAt?: Date; // When blocked
  blockedBy?: string; // Admin who blocked
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    role: {
      type: String,
      enum: ['STUDENT', 'ADMIN', 'GUARD'],
      required: true,
      default: 'STUDENT'
    },
    image: { type: String },
    password: { type: String }, // Only for guards
    penaltyPoints: { type: Number, default: 0 },
    suspendedUntil: { type: Date },
    suspensionLevel: { type: Number, default: 0 },
    blocked: { type: Boolean, default: false },
    blockedAt: { type: Date },
    blockedBy: { type: String, ref: 'User' },
  },
  {
    timestamps: true,
    collection: 'users'
  }
);

// Note: email index is automatically created by unique: true
UserSchema.index({ role: 1 });

export const User: Model<IUser> = mongoose.models.User || mongoose.model<IUser>('User', UserSchema);
