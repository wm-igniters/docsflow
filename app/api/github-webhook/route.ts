import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import connectDB from "@/lib/db";
import { getFileMetadata } from "@/lib/github";
import { Octokit } from "octokit";
import { TechStackSchema as TS_Schema, ITechStack } from "@/models/TechStack";
import { SyncMetaSchema, ISyncMeta } from "@/models/SyncMeta";
import { GITHUB_CONFIG, DB_CONFIG } from "@/lib/config.mjs";
import { syncDocTree, isEqual } from "@/lib/services/SyncService";
import { syncPublishBranches } from "@/lib/services/PublishBranchSync.mjs";

const { GITHUB_TOKEN } = process.env;
const { OWNER, REPO, BRANCH, PATHS } = GITHUB_CONFIG;
const { DB_NAMES, COLLECTIONS } = DB_CONFIG;

const octokit = new Octokit({ auth: GITHUB_TOKEN });

/**
 * Syncs a single tech stack file from GitHub to MongoDB (Original logic preserved)
 */
async function syncTechStackFile(
  TechStackModel: any,
  filePath: string,
  fileName: string,
) {
  try {
    const [contentRes, metadata] = await Promise.all([
      octokit.rest.repos.getContent({
        owner: OWNER,
        repo: REPO,
        path: filePath,
        ref: BRANCH,
      }),
      getFileMetadata(filePath, BRANCH),
    ]);

    const content = JSON.parse(
      Buffer.from((contentRes.data as any).content, "base64").toString(),
    );

    const existingDoc = await TechStackModel.findById(fileName);
    const hasNoDraft =
      !existingDoc || isEqual(existingDoc.data, existingDoc.docs_flow_data);

    const updateFields: any = {
      version: fileName.replace(".json", ""),
      last_commit_id: metadata?.last_commit_id,
      last_update_timestamp: metadata?.last_update_timestamp,
      last_github_user: metadata?.last_github_user,
      last_updated_by: "github",
      status: hasNoDraft ? "published" : "modified",
      data: content,
    };

    if (hasNoDraft) {
      updateFields.docs_flow_data = content;
    }

    await TechStackModel.findOneAndUpdate(
      { _id: fileName },
      {
        $set: updateFields,
        $setOnInsert: {
          _id: fileName,
          ...(hasNoDraft ? {} : { docs_flow_data: content }),
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    // Set creation_timestamp if missing
    const doc = await TechStackModel.findById(fileName);
    if (doc && !doc.creation_timestamp) {
      const { data: firstCommits } = await octokit.rest.repos.listCommits({
        owner: OWNER,
        repo: REPO,
        path: filePath,
        sha: BRANCH,
        per_page: 100,
      });
      const firstCommit = firstCommits[firstCommits.length - 1];
      if (firstCommit?.commit?.committer?.date) {
        doc.creation_timestamp = new Date(firstCommit.commit.committer.date);
        await doc.save();
      }
    }
    console.log(`Successfully synced tech-stack: ${fileName}`);
    return true;
  } catch (err) {
    console.error(`Error syncing tech-stack ${fileName}:`, err);
    return false;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const signature = req.headers.get("x-hub-signature-256");
    const secret = process.env.GITHUB_WEBHOOK_SECRET;

    if (!secret)
      return NextResponse.json({ error: "Secret not set" }, { status: 500 });
    if (!signature)
      return NextResponse.json({ error: "No signature" }, { status: 401 });

    const hmac = crypto.createHmac("sha256", secret);
    const digest = "sha256=" + hmac.update(body).digest("hex");

    if (signature !== digest)
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });

    const payload = JSON.parse(body);
    const event = req.headers.get("x-github-event");

    console.log(`GitHub Webhook: ${event} on ${payload.ref}`);

    if (event === "push") {
      const conn = await connectDB(DB_NAMES.DOCS);

      const changedFiles = new Set<string>();
      const removedFiles = new Set<string>();

      (payload.commits || []).forEach((commit: any) => {
        (commit.added || []).forEach((f: string) => changedFiles.add(f));
        (commit.modified || []).forEach((f: string) => changedFiles.add(f));
        (commit.removed || []).forEach((f: string) => removedFiles.add(f));
      });

      if (payload.ref === `refs/heads/${BRANCH}`) {
        // 1. Check WATCH_PATHS for Doc Tree Sync
        for (const watchPath of Object.values(PATHS)) {
          const hasChange =
            Array.from(changedFiles).some((f) => f.startsWith(watchPath)) ||
            Array.from(removedFiles).some((f) => f.startsWith(watchPath));

          if (hasChange) {
            console.log(`Triggering Doc Tree Sync for ${watchPath}`);
            await syncDocTree(conn, octokit, watchPath);
          }
        }

        // 2. Original Tech Stack Logic (Preserved)
        const tsModified = Array.from(changedFiles).filter(
          (f) => f.startsWith(PATHS.TECH_STACK) && f.endsWith(".json"),
        );
        const tsRemoved = Array.from(removedFiles).filter(
          (f) => f.startsWith(PATHS.TECH_STACK) && f.endsWith(".json"),
        );

        if (tsModified.length > 0 || tsRemoved.length > 0) {
          const TechStackModel =
            (conn.models.TechStack as any) ||
            conn.model<ITechStack>(
              "TechStack",
              TS_Schema,
              COLLECTIONS.TECH_STACK,
            );

          // Removals
          for (const filePath of tsRemoved) {
            const fileName = filePath.split("/").pop();
            const doc = await TechStackModel.findById(fileName);
            if (doc) {
              const hasChanges = !isEqual(doc.data, doc.docs_flow_data);
              if (hasChanges) {
                console.log(
                  `Skipping deletion of tech-stack ${fileName} (Found local changes)`,
                );
                await TechStackModel.updateOne(
                  { _id: fileName },
                  { $set: { status: "draft", last_updated_by: "github" } },
                );
              } else {
                await TechStackModel.deleteOne({ _id: fileName });
                console.log(`Deleted tech-stack ${fileName}`);
              }
            }
          }

          // Modifications
          for (const filePath of tsModified) {
            const fileName = filePath.split("/").pop();
            if (fileName) {
              const existingDoc = await TechStackModel.findById(fileName);
              const metadata = await getFileMetadata(filePath, BRANCH);
              let isNewer = true;
              if (metadata) {
                isNewer =
                  !existingDoc ||
                  existingDoc.last_commit_id !== metadata.last_commit_id ||
                  new Date(metadata.last_update_timestamp!) >
                    new Date(existingDoc.last_update_timestamp);
              }
              if (isNewer) {
                await syncTechStackFile(TechStackModel, filePath, fileName);
              }
            }
          }
        }
      }

      await syncPublishBranches(conn, octokit, GITHUB_CONFIG, DB_CONFIG);
    }

    return NextResponse.json({ message: "Processed" });
  } catch (error: any) {
    console.error("Webhook error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
