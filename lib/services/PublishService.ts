import { Octokit } from "octokit";
import { Schema, Model } from "mongoose";
import crypto from "crypto";
import { GITHUB_CONFIG, DB_CONFIG } from "@/lib/config.mjs";
import { MongoService } from "@/lib/services/MongoService";
import { IPublishBranch, PublishBranchSchema } from "@/models/PublishBranch";

export type PublishUser = {
  name?: string | null;
  email?: string | null;
};

export type PublishAdapter<TDoc> = {
  entity: string;
  modelName: string;
  collectionName: string;
  schema: Schema;
  buildQuery: (docId?: string | null) => Record<string, any>;
  getDocPath: (doc: TDoc) => string;
  getDocContent: (doc: TDoc) => any;
  buildCommitMessage: (docs: TDoc[], user: PublishUser) => string;
  buildPrTitle: (docs: TDoc[]) => string;
  buildPrBody: (docs: TDoc[]) => string;
  updateAfterPublish: (
    model: Model<TDoc>,
    docs: TDoc[],
    info: { commitSha: string; publishedAt: Date; user: PublishUser }
  ) => Promise<void>;
};

type PublishResult = {
  success: boolean;
  branch?: string;
  pr_url?: string;
  message?: string;
};

function toContentString(value: any): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "string") return value;
  return JSON.stringify(value, null, 2);
}

function computeBlobSha(content: string): string {
  const header = `blob ${Buffer.byteLength(content)}\0`;
  const store = Buffer.concat([Buffer.from(header), Buffer.from(content)]);
  return crypto.createHash("sha1").update(store).digest("hex");
}

async function branchExists(octokit: Octokit, owner: string, repo: string, branch: string) {
  try {
    await octokit.rest.repos.getBranch({ owner, repo, branch });
    return true;
  } catch (e: any) {
    if (e.status === 404) return false;
    throw e;
  }
}

async function getBranchFileSha(
  octokit: Octokit,
  owner: string,
  repo: string,
  branch: string,
  path: string
): Promise<string | null> {
  try {
    const { data } = await octokit.rest.repos.getContent({
      owner,
      repo,
      path,
      ref: branch,
    });
    if (Array.isArray(data)) return null;
    return data.sha || null;
  } catch (e: any) {
    if (e.status === 404) return null;
    throw e;
  }
}

function mergeFileRecords(
  existing: IPublishBranch["files"],
  updates: IPublishBranch["files"]
) {
  const map = new Map(existing.map((f) => [f.path, { ...f }]));
  for (const next of updates) {
    map.set(next.path, { ...next });
  }
  return Array.from(map.values());
}

async function canReuseBranch<TDoc>(
  octokit: Octokit,
  owner: string,
  repo: string,
  branch: string,
  record: IPublishBranch,
  docs: TDoc[],
  getDocPath: (doc: TDoc) => string,
  getDocContent: (doc: TDoc) => any
) {
  for (const doc of docs) {
    const path = getDocPath(doc);
    const content = toContentString(getDocContent(doc));
    const contentSha = computeBlobSha(content);
    const recorded = record.files.find((f) => f.path === path);
    const branchSha = await getBranchFileSha(octokit, owner, repo, branch, path);

    if (recorded) {
      if (!branchSha || branchSha !== recorded.last_published_blob_sha) {
        return false;
      }
    } else {
      if (branchSha && branchSha !== contentSha) {
        return false;
      }
    }
  }
  return true;
}

export async function publishWithAdapter<TDoc>(
  adapter: PublishAdapter<TDoc>,
  options: { docId?: string | null; user?: PublishUser } = {}
): Promise<PublishResult> {
  const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
  if (!GITHUB_TOKEN) {
    throw new Error("GITHUB_TOKEN not configured in environment");
  }

  const { OWNER, REPO, BRANCH } = GITHUB_CONFIG;
  const octokit = new Octokit({ auth: GITHUB_TOKEN });
  const user = options.user || {};

  const Model = await MongoService.getModel<TDoc>(
    adapter.modelName,
    adapter.schema,
    adapter.collectionName
  );
  const BranchModel = await MongoService.getModel<IPublishBranch>(
    "PublishBranch",
    PublishBranchSchema,
    DB_CONFIG.COLLECTIONS.PUBLISH_BRANCHES
  );

  const query = adapter.buildQuery(options.docId);
  const docs = await Model.find(query).lean();

  if (!docs || docs.length === 0) {
    return { success: true, message: "No pending changes to publish" };
  }

  const branchRecords = await BranchModel.find({
    entity: adapter.entity,
    status: "open",
    base: BRANCH,
  })
    .sort({ updatedAt: -1 })
    .lean();

  let branchRecord: IPublishBranch | null = null;
  for (const record of branchRecords) {
    const exists = await branchExists(octokit, OWNER, REPO, record.branch);
    if (!exists) {
      await BranchModel.updateOne(
        { _id: record._id },
        { $set: { status: "stale" } }
      );
      continue;
    }
    const reusable = await canReuseBranch(
      octokit,
      OWNER,
      REPO,
      record.branch,
      record,
      docs,
      adapter.getDocPath,
      adapter.getDocContent
    );
    if (reusable) {
      branchRecord = record;
      break;
    }
  }

  const { data: baseBranch } = await octokit.rest.repos.getBranch({
    owner: OWNER,
    repo: REPO,
    branch: BRANCH,
  });
  const baseSha = baseBranch.commit.sha;

  let branchName = branchRecord?.branch;
  let currentRefSha = baseSha;

  if (branchName) {
    const { data: branchData } = await octokit.rest.repos.getBranch({
      owner: OWNER,
      repo: REPO,
      branch: branchName,
    });
    currentRefSha = branchData.commit.sha;
  } else {
    branchName = `docsflow-${adapter.entity}-publish-${Date.now()}`;
    await octokit.rest.git.createRef({
      owner: OWNER,
      repo: REPO,
      ref: `refs/heads/${branchName}`,
      sha: baseSha,
    });
  }

  const fileUpdates: IPublishBranch["files"] = [];
  const treeItems = [];

  for (const doc of docs) {
    const path = adapter.getDocPath(doc);
    const content = toContentString(adapter.getDocContent(doc));
    const { data: blob } = await octokit.rest.git.createBlob({
      owner: OWNER,
      repo: REPO,
      content,
      encoding: "utf-8",
    });
    fileUpdates.push({
      path,
      last_published_blob_sha: blob.sha,
      last_published_at: new Date(),
    });
    treeItems.push({
      path,
      mode: "100644" as const,
      type: "blob" as const,
      sha: blob.sha,
    });
  }

  const { data: tree } = await octokit.rest.git.createTree({
    owner: OWNER,
    repo: REPO,
    base_tree: currentRefSha,
    tree: treeItems,
  });

  const commitMessage = adapter.buildCommitMessage(docs, user);
  const { data: commit } = await octokit.rest.git.createCommit({
    owner: OWNER,
    repo: REPO,
    message: commitMessage,
    tree: tree.sha,
    parents: [currentRefSha],
    author: {
      name: user.name || "DocsFlow Bot",
      email: user.email || "docsflow@wavemaker.com",
    },
  });

  await octokit.rest.git.updateRef({
    owner: OWNER,
    repo: REPO,
    ref: `heads/${branchName}`,
    sha: commit.sha,
  });

  const { data: openPrs } = await octokit.rest.pulls.list({
    owner: OWNER,
    repo: REPO,
    head: `${OWNER}:${branchName}`,
    base: BRANCH,
    state: "open",
  });

  let prInfo: IPublishBranch["pr"] | null = null;
  if (openPrs.length > 0) {
    prInfo = {
      url: openPrs[0].html_url,
      number: openPrs[0].number,
      state: openPrs[0].state,
    };
  } else {
    const { data: pr } = await octokit.rest.pulls.create({
      owner: OWNER,
      repo: REPO,
      head: branchName,
      base: BRANCH,
      title: adapter.buildPrTitle(docs),
      body: adapter.buildPrBody(docs),
    });
    prInfo = {
      url: pr.html_url,
      number: pr.number,
      state: pr.state,
    };
  }

  const now = new Date();
  if (branchRecord) {
    const updatedFiles = mergeFileRecords(branchRecord.files || [], fileUpdates);
    await BranchModel.updateOne(
      { _id: branchRecord._id },
      {
        $set: {
          files: updatedFiles,
          pr: prInfo,
          status: "open",
          last_used_at: now,
        },
      }
    );
  } else {
    await BranchModel.create({
      entity: adapter.entity,
      branch: branchName,
      base: BRANCH,
      files: fileUpdates,
      pr: prInfo,
      status: "open",
      last_used_at: now,
    });
  }

  await adapter.updateAfterPublish(Model, docs, {
    commitSha: commit.sha,
    publishedAt: now,
    user,
  });

  return {
    success: true,
    branch: branchName,
    pr_url: prInfo?.url || undefined,
    message: `Published ${docs.length} file(s) to ${branchName}`,
  };
}
