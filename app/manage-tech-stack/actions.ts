"use server";

import connectDB from "@/lib/db";
import { fetchTechStackFiles } from "@/lib/github";
import TechStack, { TechStackSchema, ITechStack, IHistoryEntry } from "@/models/TechStack";
import { revalidatePath } from "next/cache";
import { DB_CONFIG } from "@/lib/config.mjs";
import { auth } from "@/auth";

export async function syncTechStack() {
  try {
    const conn = await connectDB(DB_CONFIG.DB_NAMES.DOCS);
    
    // Bind model to this specific connection
    const TechStackModel = conn.models.TechStack || conn.model<ITechStack>('TechStack', TechStackSchema, DB_CONFIG.COLLECTIONS.TECH_STACK);

    console.log("Starting GitHub Sync...");
    const files = await fetchTechStackFiles();
    console.log(`Found ${files.length} files from GitHub.`);

    let updatedCount = 0;

    for (const file of files) {
      if (!file) continue;

      console.log(`Syncing ${file.fileName}...`);
      const existing = await TechStackModel.findById(file.fileName);
      const isNewCommit = !existing || existing.last_commit_id !== file.metadata?.last_commit_id;
      const changes = computeDiff(existing?.data, file.content);

      const updateData: any = {
        version: file.version,
        last_commit_id: file.metadata?.last_commit_id,
        last_update_timestamp: file.metadata?.last_update_timestamp,
        last_github_user: file.metadata?.last_github_user,
        last_updated_by: 'github',
        status: 'published',
        data: file.content,
      };

      const updateQuery: any = { $set: updateData };

      if (isNewCommit && changes) {
        updateQuery.$push = {
          history: {
            timestamp: new Date(),
            updated_by: 'github',
            github_info: {
              user: file.metadata?.last_github_user,
              commit_id: file.metadata?.last_commit_id,
            },
            changes
          }
        };
      }

      await TechStackModel.findOneAndUpdate(
        { _id: file.fileName },
        {
          ...updateQuery,
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

function computeDiff(oldData: any, newData: any): any {
  if (!oldData) return { _new_document: true };
  if (!newData) return { _deleted_document: true };

  const changes: any = {};
  
  if (Array.isArray(oldData) && Array.isArray(newData)) {
     const oldMap = new Map(oldData.map(item => [typeof item === 'string' ? item : item.name, item]));
     const newMap = new Map(newData.map(item => [typeof item === 'string' ? item : item.name, item]));

     const allKeys = new Set([...oldMap.keys(), ...newMap.keys()]);

     for (const key of allKeys) {
        const oldItem = oldMap.get(key);
        const newItem = newMap.get(key);

        if (!oldItem && newItem) {
           changes[`${key}`] = { _status: 'added', to: newItem };
        } else if (oldItem && !newItem) {
           changes[`${key}`] = { _status: 'deleted', from: oldItem };
        } else if (JSON.stringify(oldItem) !== JSON.stringify(newItem)) {
           if (typeof oldItem === 'object' && typeof newItem === 'object') {
              const itemDiff = computeDiff(oldItem, newItem);
              if (itemDiff) changes[`${key}`] = { _status: 'modified', ...itemDiff };
           } else {
              changes[`${key}`] = { _status: 'modified', from: oldItem, to: newItem };
           }
        }
     }
     return Object.keys(changes).length > 0 ? changes : null;
  }

  const allKeys = new Set([...Object.keys(oldData), ...Object.keys(newData)]);
  
  for (const key of allKeys) {
    const oldVal = oldData[key];
    const newVal = newData[key];

    if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      if (typeof oldVal === 'object' && oldVal !== null && typeof newVal === 'object' && newVal !== null) {
          const nestedDiff = computeDiff(oldVal, newVal);
          if (nestedDiff) {
            changes[key] = nestedDiff;
          }
      } else {
        changes[key] = {
          from: oldVal,
          to: newVal
        };
      }
    }
  }
  
  return Object.keys(changes).length > 0 ? changes : null;
}

export async function updateDocsFlowData(version: string, newData: any, lastKnownUpdatedAt?: string) {
  // Issue 8: Validate input
  if (newData === null || newData === undefined) {
    return { success: false, error: "Data cannot be null or undefined" };
  }
  if (typeof newData !== 'object' || Array.isArray(newData)) {
    return { success: false, error: "Data must be an object" };
  }

  try {
    const conn = await connectDB(DB_CONFIG.DB_NAMES.DOCS);
    const TechStackModel = conn.models.TechStack || conn.model<ITechStack>('TechStack', TechStackSchema, DB_CONFIG.COLLECTIONS.TECH_STACK);
    
    // Fetch existing document to check for conflicts and compute diff
    const existing = await TechStackModel.findOne({ version });
    
    // Optimistic Locking: Check if the document has been updated by someone else
    if (lastKnownUpdatedAt && existing) {
      if (existing.updatedAt.toISOString() !== lastKnownUpdatedAt) {
        return { 
          success: false, 
          error: "CONFLICT_ERROR", 
          message: "This document has been updated by another user. Please refresh your data." 
        };
      }
    }

    const session = await auth();
    const changes = computeDiff(existing?.docs_flow_data, newData);

    const historyEntry: IHistoryEntry = {
      timestamp: new Date(),
      updated_by: 'docsflow',
      user: {
        name: session?.user?.name || 'Unknown User',
        email: session?.user?.email || undefined,
        image: session?.user?.image || undefined,
      },
      changes
    };

    const result = await TechStackModel.findOneAndUpdate(
      { version },
      { 
        $set: {
          docs_flow_data: newData,
          status: 'modified',
          last_updated_by: 'docsflow'
        },
        $push: { history: historyEntry }
      },
      { new: true }
    );

    if (!result) {
      return { success: false, error: `Version "${version}" not found` };
    }
    
    // Revalidate the page to clear Next.js cache and show updated data
    revalidatePath('/manage-tech-stack');
    
    return { success: true, updatedAt: result.updatedAt.toISOString() };
  } catch (error: any) {
    console.error(`Failed to update docs_flow_data for ${version}:`, error);
    return { success: false, error: error.message };
  }
}


export async function getVersions() {
  try {
    const conn = await connectDB(DB_CONFIG.DB_NAMES.DOCS);
    const TechStackModel = conn.models.TechStack || conn.model<ITechStack>('TechStack', TechStackSchema, DB_CONFIG.COLLECTIONS.TECH_STACK);
    
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
    const conn = await connectDB(DB_CONFIG.DB_NAMES.DOCS);
    const TechStackModel = conn.models.TechStack || conn.model<ITechStack>('TechStack', TechStackSchema, DB_CONFIG.COLLECTIONS.TECH_STACK);
    
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
