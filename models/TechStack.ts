import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ITechStack extends Document<string> {
  _id: string; // JSON file name
  last_commit_id: string;
  last_update_timestamp: Date;
  creation_timestamp: Date;
  data: any;
  docs_flow_data: any;
  last_github_user: string;
  last_updated_by: 'github' | 'docsflow';
  status: 'modified' | 'draft' | 'published';
  version: string;
  createdAt: Date;
  updatedAt: Date;
}

export const TechStackSchema: Schema = new Schema(
  {
    _id: {
      type: String, // e.g., "v11.4.0.json"
      required: true,
    },
    version: {
      type: String,
      required: true,
    },
    last_commit_id: {
      type: String,
    },
    last_update_timestamp: {
      type: Date,
    },
    creation_timestamp: {
      type: Date,
    },
    last_github_user: {
      type: String,
    },
    last_updated_by: {
      type: String,
      enum: ['github', 'docsflow'],
      default: 'github',
    },
    status: {
      type: String,
      enum: ['modified', 'draft', 'published'],
      default: 'published',
    },
    data: {
      type: Schema.Types.Mixed,
    },
    docs_flow_data: {
      type: Schema.Types.Mixed,
    },
  },
  {
    timestamps: true,
    // Setting _id: false at the schema options level and then defining it manually 
    // is the most robust way to override the default ObjectId behavior.
    _id: false, 
  }
);

// Disable the virtual 'id' path to avoid interference
TechStackSchema.set('id', false);
TechStackSchema.set('toJSON', { virtuals: false });
TechStackSchema.set('toObject', { virtuals: false });

const TechStack: Model<ITechStack> =
  mongoose.models.TechStack || mongoose.model<ITechStack>('TechStack', TechStackSchema, 'tech_stack_data');

export default TechStack;
