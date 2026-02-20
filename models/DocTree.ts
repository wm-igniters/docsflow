import mongoose, { Schema, Document, Model } from 'mongoose';
import { DB_CONFIG } from '../lib/config.mjs';

export interface IDocTree extends Document<string> {
  _id: string; // The directory path, e.g., "docs/release-notes/"
  commit_details: {
    last_commit_id: string;
    last_commit_timestamp: Date;
    last_commit_user: string;
  };
  last_update_timestamp: Date; // Timestamp of when this was updated in MongoDB
  tree: Array<{
    path: string;
    mode: string;
    type: 'blob' | 'tree';
    sha: string;
    size?: number;
    url: string;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

export const DocTreeSchema: Schema = new Schema(
  {
    _id: {
      type: String,
      required: true,
    },
    commit_details: {
      last_commit_id: { type: String, required: true },
      last_commit_timestamp: { type: Date, required: true },
      last_commit_user: { type: String, required: true },
    },
    last_update_timestamp: {
      type: Date,
      default: Date.now,
    },
    tree: {
      type: [Schema.Types.Mixed],
      default: [],
    },
  },
  {
    timestamps: true,
    _id: false,
  }
);

DocTreeSchema.set('id', false);
DocTreeSchema.set('toJSON', { virtuals: false });
DocTreeSchema.set('toObject', { virtuals: false });

const DocTree: Model<IDocTree> =
  mongoose.models.DocTree ||
  mongoose.model<IDocTree>(
    "DocTree",
    DocTreeSchema,
    DB_CONFIG.COLLECTIONS.DOC_TREES,
  );

export default DocTree;
