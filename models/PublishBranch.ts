import mongoose, { Schema, Document, Model } from 'mongoose';
import { DB_CONFIG } from '../lib/config.mjs';

export interface IPublishBranch extends Document {
  entity: string;
  branch: string;
  base: string;
  files: {
    path: string;
    last_published_blob_sha: string;
    last_published_at?: Date;
  }[];
  pr?: {
    url: string;
    number: number;
    state: string;
  } | null;
  status: 'open' | 'merged' | 'closed' | 'stale';
  last_used_at?: Date;
}

export const PublishBranchSchema: Schema = new Schema(
  {
    entity: { type: String, required: true },
    branch: { type: String, required: true },
    base: { type: String, required: true },
    files: {
      type: [
        new Schema(
          {
            path: { type: String, required: true },
            last_published_blob_sha: { type: String, required: true },
            last_published_at: { type: Date },
          },
          { _id: false }
        ),
      ],
      default: [],
    },
    pr: {
      url: String,
      number: Number,
      state: String,
    },
    status: {
      type: String,
      enum: ['open', 'merged', 'closed', 'stale'],
      default: 'open',
    },
    last_used_at: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

PublishBranchSchema.set('id', false);
PublishBranchSchema.set('toJSON', { virtuals: false });
PublishBranchSchema.set('toObject', { virtuals: false });

const PublishBranch: Model<IPublishBranch> =
  mongoose.models.PublishBranch ||
  mongoose.model<IPublishBranch>(
    "PublishBranch",
    PublishBranchSchema,
    DB_CONFIG.COLLECTIONS.PUBLISH_BRANCHES
  );

export default PublishBranch;
