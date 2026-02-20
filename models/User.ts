import mongoose, { Schema, Document, Model } from 'mongoose';
import { DB_CONFIG } from '../lib/config.mjs';

export interface IUser extends Document<string> {
  _id: string; // This will be the email
  name: string;
  email: string;
  image?: string;
  role: 'admin' | 'lead' | 'member';
  createdAt: Date;
  updatedAt: Date;
}

export const UserSchema: Schema = new Schema(
  {
    _id: {
      type: String,
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    image: {
      type: String,
    },
    role: {
      type: String,
      enum: ['admin', 'member'],
      default: 'member',
    },
  },
  {
    timestamps: true,
  }
);

// Prevent overwriting the model if it's already compiled
const User: Model<IUser> =
  mongoose.models.User ||
  mongoose.model<IUser>("User", UserSchema, DB_CONFIG.COLLECTIONS.USERS);

export default User;
