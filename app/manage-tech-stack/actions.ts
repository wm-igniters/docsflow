"use server";

import connectDB from "@/lib/db";
import { fetchTechStackFiles } from "@/lib/github";
import TechStack, { TechStackSchema, ITechStack } from "@/models/TechStack";
import { revalidatePath } from "next/cache";
import { DB_CONFIG } from "@/lib/config.mjs";

export async function syncTechStack() {
  try {
    const conn = await connectDB(DB_CONFIG.DOCS_DB);
    
    // Bind model to this specific connection
    const TechStackModel = conn.models.TechStack || conn.model<ITechStack>('TechStack', TechStackSchema, DB_CONFIG.TECH_STACK_COLLECTION);

    console.log("Starting GitHub Sync...");
    const files = await fetchTechStackFiles();
    console.log(`Found ${files.length} files from GitHub.`);

    let updatedCount = 0;

    for (const file of files) {
      if (!file) continue;

      console.log(`Syncing ${file.fileName}...`);
      // Upsert: Update if exists, Insert if not
      await TechStackModel.findOneAndUpdate(
        { _id: file.fileName },
        {
          $set: {
            version: file.version,
            last_commit_id: file.metadata?.last_commit_id,
            last_update_timestamp: file.metadata?.last_update_timestamp,
            last_github_user: file.metadata?.last_github_user,
            last_updated_by: 'github',
            status: 'published',
            data: file.content,
          },
          $setOnInsert: {
            _id: file.fileName,
            docs_flow_data: file.content,
          }
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      updatedCount++;
    }

    console.log(`Synced ${updatedCount} documents.`);
    revalidatePath("/manage-tech-stack"); // Refresh the UI
    return { success: true, count: updatedCount };

  } catch (error: any) {
    console.error("Sync failed details:", error);
    return { 
      success: false, 
      error: error.message || "Sync failed due to an unknown error" 
    };
  }
}

export async function updateDocsFlowData(version: string, newData: any) {
  // Issue 8: Validate input
  if (newData === null || newData === undefined) {
    return { success: false, error: "Data cannot be null or undefined" };
  }
  if (typeof newData !== 'object' || Array.isArray(newData)) {
    return { success: false, error: "Data must be an object" };
  }

  try {
    const conn = await connectDB(DB_CONFIG.DOCS_DB);
    const TechStackModel = conn.models.TechStack || conn.model<ITechStack>('TechStack', TechStackSchema, DB_CONFIG.TECH_STACK_COLLECTION);
    
    const result = await TechStackModel.findOneAndUpdate(
      { version },
      { 
        docs_flow_data: newData,
        status: 'modified',
        last_updated_by: 'docsflow'
      },
      { new: true }
    );

    if (!result) {
      return { success: false, error: `Version "${version}" not found` };
    }
    
    // Revalidate the page to clear Next.js cache and show updated data
    revalidatePath('/manage-tech-stack');
    
    return { success: true };
  } catch (error: any) {
    console.error(`Failed to update docs_flow_data for ${version}:`, error);
    return { success: false, error: error.message };
  }
}


export async function getVersions() {
  try {
    const conn = await connectDB(DB_CONFIG.DOCS_DB);
    const TechStackModel = conn.models.TechStack || conn.model<ITechStack>('TechStack', TechStackSchema, DB_CONFIG.TECH_STACK_COLLECTION);
    
    // Fetch only version field
    const docs = await TechStackModel.find({}, { version: 1 }).lean();
    return docs.map(d => d.version);
  } catch (error) {
    console.error("Failed to fetch versions:", error);
    return [];
  }
}

export async function getVersionDetails(version: string) {
  try {
    const conn = await connectDB(DB_CONFIG.DOCS_DB);
    const TechStackModel = conn.models.TechStack || conn.model<ITechStack>('TechStack', TechStackSchema, DB_CONFIG.TECH_STACK_COLLECTION);
    
    // Find doc by version
    const doc = await TechStackModel.findOne({ version }).lean();
    if (!doc) return null;
    
    // Convert Mongo object to plain JS object and handle dates if necessary
    return JSON.parse(JSON.stringify(doc));
  } catch (error) {
    console.error(`Failed to fetch details for version ${version}:`, error);
    return null;
  }
}
