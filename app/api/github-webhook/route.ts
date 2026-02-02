import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import connectDB from "@/lib/db";
import { getFileMetadata } from "@/lib/github";
import { Octokit } from "octokit";
import { TechStackSchema as TS_Schema, ITechStack } from "@/models/TechStack";
import { SyncMetaSchema, ISyncMeta } from "@/models/SyncMeta";
import { GITHUB_CONFIG, DB_CONFIG } from "@/lib/config.mjs";

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const { OWNER, REPO, BRANCH, DATA_PATH } = GITHUB_CONFIG;
const { DOCS_DB, TECH_STACK_COLLECTION } = DB_CONFIG;

const octokit = new Octokit({ auth: GITHUB_TOKEN });

/**
 * Syncs a single tech stack file from GitHub to MongoDB
 */
async function syncFile(TechStackModel: any, filePath: string, fileName: string) {
  try {
    const [contentRes, metadata] = await Promise.all([
      octokit.rest.repos.getContent({
        owner: OWNER,
        repo: REPO,
        path: filePath,
        ref: BRANCH,
      }),
      getFileMetadata(filePath, BRANCH)
    ]);

    // @ts-ignore
    const content = JSON.parse(Buffer.from(contentRes.data.content, "base64").toString());

    await TechStackModel.findOneAndUpdate(
      { _id: fileName },
      {
        _id: fileName,
        version: fileName.replace(".json", ""),
        last_commit_id: metadata?.last_commit_id,
        last_update_timestamp: metadata?.last_update_timestamp,
        last_github_user: metadata?.last_github_user,
        last_updated_by: "github",
        status: "published",
        data: content,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // Set creation_timestamp if missing
    const doc = await TechStackModel.findById(fileName);
    if (doc && !doc.creation_timestamp) {
      const { data: firstCommits } = await octokit.rest.repos.listCommits({
        owner: OWNER,
        repo: REPO,
        path: filePath,
        sha: BRANCH,
        per_page: 100 // Try to get the very first one
      });
      const firstCommit = firstCommits[firstCommits.length - 1];
      if (firstCommit) {
        doc.creation_timestamp = new Date(firstCommit.commit.committer.date);
        await doc.save();
      }
    }
    console.log(`Successfully synced ${fileName}`);
    return true;
  } catch (err) {
    console.error(`Error syncing ${fileName}:`, err);
    return false;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const signature = req.headers.get("x-hub-signature-256");
    const secret = process.env.GITHUB_WEBHOOK_SECRET;

    if (!secret) return NextResponse.json({ error: "Secret not set" }, { status: 500 });
    if (!signature) return NextResponse.json({ error: "No signature" }, { status: 401 });

    const hmac = crypto.createHmac("sha256", secret);
    const digest = "sha256=" + hmac.update(body).digest("hex");

    if (signature !== digest) return NextResponse.json({ error: "Invalid signature" }, { status: 401 });

    const payload = JSON.parse(body);
    const event = req.headers.get("x-github-event");

    console.log(`GitHub Webhook: ${event} on ${payload.ref}`);

    if (event === "push" && payload.ref === `refs/heads/${BRANCH}`) {
      const conn = await connectDB(DOCS_DB);
      
      // Clear models if they exist on the connection to avoid schema mismatch
      if (conn.models.TechStack) delete conn.models.TechStack;
      if (conn.models.SyncMeta) delete conn.models.SyncMeta;

      const TechStackModel = conn.model<ITechStack>("TechStack", TS_Schema, TECH_STACK_COLLECTION);
      const SyncMetaModel = conn.model<ISyncMeta>("SyncMeta", SyncMetaSchema, 'meta_data');

      const meta = await SyncMetaModel.findOne({ key: 'tech-stack-sync' });
      const currentCommit = payload.after;
      
      const allAdded = new Set<string>();
      const allModified = new Set<string>();
      const allRemoved = new Set<string>();

      let syncSuccess = true;

      if (meta && meta.last_sync_commit_id) {
        console.log(`Comparing changes from ${meta.last_sync_commit_id} to ${currentCommit}`);
        try {
          const { data: comparison } = await octokit.rest.repos.compareCommits({
            owner: OWNER,
            repo: REPO,
            base: meta.last_sync_commit_id,
            head: currentCommit,
          });

          comparison.files?.forEach(file => {
            if (file.filename.startsWith(DATA_PATH) && file.filename.endsWith(".json")) {
              if (file.status === "added") allAdded.add(file.filename);
              else if (file.status === "modified") allModified.add(file.filename);
              else if (file.status === "removed") allRemoved.add(file.filename);
              else if (file.status === "renamed") {
                if (file.previous_filename?.startsWith(DATA_PATH)) allRemoved.add(file.previous_filename);
                allAdded.add(file.filename);
              }
            }
          });
        } catch (compareErr) {
          console.error("Comparison failed:", compareErr);
          syncSuccess = false;
        }
      } else {
        console.log("No previous sync metadata found. Primary processing payload.");
        payload.commits.forEach((commit: any) => {
          commit.added.forEach((f: string) => f.startsWith(DATA_PATH) && f.endsWith(".json") && allAdded.add(f));
          commit.modified.forEach((f: string) => f.startsWith(DATA_PATH) && f.endsWith(".json") && allModified.add(f));
          commit.removed.forEach((f: string) => f.startsWith(DATA_PATH) && f.endsWith(".json") && allRemoved.add(f));
        });
      }

      // Handle removals
      for (const filePath of allRemoved) {
        const fileName = filePath.split("/").pop();
        await TechStackModel.deleteOne({ _id: fileName });
        console.log(`Deleted ${fileName}`);
      }

      // Handle additions and modifications
      const toUpdate = new Set([...allAdded, ...allModified]);
      for (const filePath of toUpdate) {
        const fileName = filePath.split("/").pop();
        if (fileName) {
          const ok = await syncFile(TechStackModel, filePath, fileName);
          if (!ok) syncSuccess = false;
        }
      }

      // Only update metadata if ALL files synced successfully
      if (syncSuccess) {
        await SyncMetaModel.findOneAndUpdate(
          { key: 'tech-stack-sync' },
          { 
            key: 'tech-stack-sync',
            last_sync_commit_id: currentCommit,
            last_sync_timestamp: new Date()
          },
          { upsert: true, new: true }
        );
        console.log(`Sync complete. Bookmark updated to ${currentCommit}`);
      } else {
        console.warn("Sync encountered errors. Bookmark NOT updated. It will retry on next push.");
      }
    }

    return NextResponse.json({ message: "Processed" });
  } catch (error: any) {
    console.error("Webhook error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
