"use server";

import connectDB from "@/lib/db";
import { DB_CONFIG, GITHUB_CONFIG } from "@/lib/config.mjs";
import { DocTreeSchema, IDocTree } from "@/models/DocTree";
import { syncDocTree as syncTreeService } from "@/lib/services/SyncService";
import { Octokit } from "octokit";
import { getFileContent, getFileMetadata } from "@/lib/github";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { MongoService } from "@/lib/services/MongoService";

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const octokit = new Octokit({ auth: GITHUB_TOKEN });

/**
 * Fetch a directory tree, syncing from GitHub if not found in DB
 */
export async function fetchDocTree(path: string) {
  try {
    const DocTreeModel = await MongoService.getModel<IDocTree>('DocTree', DocTreeSchema, DB_CONFIG.COLLECTIONS.DOC_TREES);
    let treeDoc = await MongoService.findById(DocTreeModel, path);
    
    if (!treeDoc) {
      const conn = await connectDB(DB_CONFIG.DB_NAMES.DOCS);
      await syncTreeService(conn, octokit, path, DB_CONFIG.COLLECTIONS.RELEASE_NOTES);
      treeDoc = await MongoService.findById(DocTreeModel, path);
    }
    
    return treeDoc ? JSON.parse(JSON.stringify(treeDoc)) : null;
  } catch (error) {
    console.error(`Failed to fetch doc tree for ${path}:`, error);
    throw error;
  }
}

/**
 * Sync a directory tree from GitHub
 */
export async function syncDocTree(path: string) {
  try {
    const conn = await connectDB(DB_CONFIG.DB_NAMES.DOCS);
    await syncTreeService(conn, octokit, path, DB_CONFIG.COLLECTIONS.RELEASE_NOTES);
    revalidatePath(`/manage-${path.split('/').filter(Boolean).pop()}`);
    return { success: true };
  } catch (error: any) {
    console.error(`Failed to sync doc tree for ${path}:`, error);
    return { success: false, error: error.message };
  }
}

/**
 * Fetch content with logic: DB -> GitHub -> DB
 */
export async function fetchDocContent(path: string, modelName: string, collectionName: string, schema: any) {
  try {
    const Model = await MongoService.getModel(modelName, schema, collectionName);
    let doc = await MongoService.findById(Model, path);
    
    if (!doc) {
      console.log(`Doc content for ${path} not found in DB, fetching from GitHub...`);
      const content = await getFileContent(path);
      const metadata = await getFileMetadata(path);
      
      if (content) {
        doc = await MongoService.upsert(Model, path, {
          _id: path,
          path: path,
          github_data: content,
          docsflow_data: null,
          status: 'published',
          last_updated_source: 'github',
          last_updated_by: metadata?.last_github_user || 'github',
          commit_details: metadata ? {
            last_commit_id: metadata.last_commit_id,
            timestamp: new Date(metadata.last_update_timestamp!),
            username: metadata.last_github_user
          } : undefined
        });
      }
    }
    
    return doc ? JSON.parse(JSON.stringify(doc)) : null;
  } catch (error) {
    console.error(`Failed to fetch doc content for ${path}:`, error);
    throw error;
  }
}

/**
 * Generic content update
 */
export async function saveDocContent(path: string, data: any, modelName: string, collectionName: string, schema: any, computeDiff: (old: any, next: any) => any) {
  try {
    const Model = await MongoService.getModel(modelName, schema, collectionName);
    const existing: any = await MongoService.findById(Model, path);
    
    const session = await auth();
    const changes = computeDiff(existing?.docsflow_data, data);
    
    const historyEntry = {
      timestamp: new Date(),
      updated_by: 'docsflow',
      user: {
        name: session?.user?.name || 'Unknown User',
        email: session?.user?.email || undefined,
        image: session?.user?.image || undefined,
      },
      changes
    };

    const result = await MongoService.upsert(Model, path, { 
      $set: {
        docsflow_data: data,
        status: 'modified',
        last_updated_by: session?.user?.name || 'Unknown User',
        last_updated_source: 'docsflow',
        last_update_timestamp: new Date()
      },
      $push: { history: historyEntry }
    } as any);

    return { success: true, doc: JSON.parse(JSON.stringify(result)) };
  } catch (error: any) {
    console.error(`Failed to save doc content for ${path}:`, error);
    return { success: false, error: error.message };
  }
}
