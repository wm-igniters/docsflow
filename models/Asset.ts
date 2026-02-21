import mongoose from "mongoose";

export interface IAsset {
  originalFileName: string;
  usedInPath: string;
  objectId: string;
  url: string;
  hash: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const AssetSchema = new mongoose.Schema<IAsset>(
  {
    originalFileName: { type: String, required: true },
    usedInPath: { type: String, required: true },
    objectId: { type: String, required: true },
    url: { type: String, required: true },
    hash: { type: String, required: true },
  },
  { timestamps: true }
);

// We export the schema so it can be used with a specific connection
export { AssetSchema };
