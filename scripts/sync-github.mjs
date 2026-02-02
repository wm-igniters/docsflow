import mongoose from 'mongoose';
import { Octokit } from 'octokit';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GITHUB_CONFIG, DB_CONFIG } from '../lib/config.mjs';

// Sync Modules
import { syncTechStack } from './sync/tech-stack.mjs';

const { OWNER, REPO, BRANCH } = GITHUB_CONFIG;
const { DOCS_DB } = DB_CONFIG;

export default async function runIntegritySync() {
  const { MONGODB_URI, GITHUB_TOKEN } = process.env;

  if (!MONGODB_URI || !GITHUB_TOKEN) {
    console.error('❌ sync-github skipped: missing env vars');
    return;
  }

  console.log('🚀 Starting Global GitHub Data Sync...');

  const octokit = new Octokit({ auth: GITHUB_TOKEN });

  let connection;
  try {
    connection = await mongoose
      .createConnection(MONGODB_URI, { dbName: DOCS_DB })
      .asPromise();

    // 1. Sync Tech Stack
    await syncTechStack(connection, octokit);

    // 2. Sync Metadata
    const SyncMetaSchema = new mongoose.Schema(
      {
        key: { type: String, unique: true },
        last_sync_commit_id: String,
        last_sync_timestamp: { type: Date, default: Date.now },
      },
      { timestamps: true }
    );

    const SyncMeta =
      connection.models.SyncMeta ||
      connection.model('SyncMeta', SyncMetaSchema, 'meta_data');

    const { data: branchData } = await octokit.rest.repos.getBranch({
      owner: OWNER,
      repo: REPO,
      branch: BRANCH,
    });

    await SyncMeta.findOneAndUpdate(
      { key: 'tech-stack-sync' },
      {
        last_sync_commit_id: branchData.commit.sha,
        last_sync_timestamp: new Date(),
      },
      { upsert: true }
    );

    console.log('✅ Global Sync Complete.');
  } catch (error) {
    console.error('❌ Global Sync Failed:', error);
    if (process.argv[1] === fileURLToPath(import.meta.url)) {
      process.exit(1);
    }
  } finally {
    if (connection) await connection.close();
  }
}

// Self-execution if run directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  dotenv.config({ path: '.env.local' });
  runIntegritySync();
}
