import mongoose, { Schema, Document, Model } from 'mongoose';

export type UserRole = 'STUDENT' | 'ADMIN' | 'GUARD';

export interface IUser extends Document {
  _id: string;
  name: string;
  email: string;
  role: UserRole;
  image?: string;
  password?: string; // For guards only (bcrypt hash)
  penaltyPoints: number;
  suspendedUntil?: Date;
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
  },
  {
    timestamps: true,
    collection: 'users'
  }
);

UserSchema.index({ email: 1 });
UserSchema.index({ role: 1 });

export const User: Model<IUser> = mongoose.models.User || mongoose.model<IUser>('User', UserSchema);
