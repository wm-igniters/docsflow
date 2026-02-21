import mongoose, { Schema, Document, Model } from 'mongoose';
import { DB_CONFIG } from '../lib/config.mjs';

export interface IDoc extends Document<string> {
  _id: string; // The path of the file in GitHub
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

export const DocSchema: Schema = new Schema(
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
    timestamps: false,
  }
);

DocSchema.set('id', false);
DocSchema.set('toJSON', { virtuals: false });
DocSchema.set('toObject', { virtuals: false });

const Doc: Model<IDoc> =
  mongoose.models.Doc ||
  mongoose.model<IDoc>(
    "Doc",
    DocSchema,
    DB_CONFIG.COLLECTIONS.RELEASE_NOTES, // Defaulting to release notes for now, but usually overridden in getModel or specified at call time
  );

export default Doc;
