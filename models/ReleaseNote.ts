import mongoose, { Schema, Document, Model } from 'mongoose';
import { DB_CONFIG } from '../lib/config.mjs';

export interface IReleaseNote extends Document<string> {
  _id: string; // The path of the file in GitHub, e.g., "docs/release-notes/release-version-1/version-1-0-x/1.0.0.mdx"
  path: string;
  commit_details?: {
    last_commit_id: string;
    timestamp: Date;
    username: string;
  };
  last_update_timestamp: Date; // timestamp of last updated on mongodb
  creation_timestamp: Date; // timestamp of first commit / first updated on mongodb whichever is older
  last_updated_source: 'github' | 'docsflow';
  last_updated_by: string; // github username or docflow user id
  status: 'new' | 'modified' | 'published';
  github_data: any; // content from github
  docsflow_data: any; // content in docsflow
  history: any[];
}

export const ReleaseNoteSchema: Schema = new Schema(
  {
    _id: {
      type: String,
      required: true,
    },
    path: {
      type: String,
      required: true,
    },
    commit_details: {
      last_commit_id: String,
      timestamp: Date,
      username: String,
    },
    last_update_timestamp: {
      type: Date,
      default: Date.now,
    },
    creation_timestamp: {
      type: Date,
      default: Date.now,
    },
    last_updated_source: {
      type: String,
      enum: ['github', 'docsflow'],
      default: 'github',
    },
    last_updated_by: {
      type: String,
    },
    status: {
      type: String,
      enum: ['new', 'modified', 'published'],
      default: 'published',
    },
    github_data: {
      type: Schema.Types.Mixed,
      default: null,
    },
    docsflow_data: {
      type: Schema.Types.Mixed,
      default: null,
    },
    history: {
      type: [Schema.Types.Mixed],
      default: [],
    },
  },
  {
    _id: false,
    // Note: timestamps (createdAt, updatedAt) are explicitly excluded as redundant per user request
    timestamps: false,
  }
);

ReleaseNoteSchema.set('id', false);
ReleaseNoteSchema.set('toJSON', { virtuals: false });
ReleaseNoteSchema.set('toObject', { virtuals: false });

const ReleaseNote: Model<IReleaseNote> =
  mongoose.models.ReleaseNote ||
  mongoose.model<IReleaseNote>(
    "ReleaseNote",
    ReleaseNoteSchema,
    DB_CONFIG.COLLECTIONS.RELEASE_NOTES,
  );

export default ReleaseNote;
