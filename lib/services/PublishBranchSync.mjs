export function inferEntityFromBranch(branchName) {
  if (!branchName.startsWith("docsflow")) return null;
  if (branchName.startsWith("docsflow-publish-")) return "tech-stack";
  const prefix = "docsflow-";
  const rest = branchName.startsWith(prefix)
    ? branchName.slice(prefix.length)
    : branchName;
  const idx = rest.indexOf("-publish-");
  if (idx > 0) {
    return rest.slice(0, idx);
  }
  return null;
}

async function getBranchTree(octokit, owner, repo, branch) {
  const { data: branchData } = await octokit.rest.repos.getBranch({
    owner,
    repo,
    branch,
  });
  const { data: commitData } = await octokit.rest.git.getCommit({
    owner,
    repo,
    commit_sha: branchData.commit.sha,
  });
  const { data: treeData } = await octokit.rest.git.getTree({
    owner,
    repo,
    tree_sha: commitData.tree.sha,
    recursive: "true",
  });
  return treeData.tree || [];
}

function buildPublishBranchModel(connection, collectionName) {
  return (
    connection.models.PublishBranch ||
    connection.model(
      "PublishBranch",
      new connection.base.Schema(
        {
          entity: String,
          branch: String,
          base: String,
          files: [
            new connection.base.Schema(
              {
                path: String,
                last_published_blob_sha: String,
                last_published_at: Date,
              },
              { _id: false }
            ),
          ],
          pr: {
            url: String,
            number: Number,
            state: String,
          },
          status: String,
          last_used_at: Date,
        },
        { timestamps: true }
      ),
      collectionName
    )
  );
}

export async function syncPublishBranches(
  connection,
  octokit,
  GITHUB_CONFIG,
  DB_CONFIG
) {
  const { OWNER, REPO, BRANCH, PATHS } = GITHUB_CONFIG;
  const PublishBranch = buildPublishBranchModel(
    connection,
    DB_CONFIG.COLLECTIONS.PUBLISH_BRANCHES
  );

  const entityPathMap = {
    "release-notes": PATHS.RELEASE_NOTES,
    "tech-stack": PATHS.TECH_STACK,
  };

  const branches = await octokit.paginate(octokit.rest.repos.listBranches, {
    owner: OWNER,
    repo: REPO,
    per_page: 100,
  });

  const docsflowBranches = branches.filter((b) =>
    b.name.startsWith("docsflow")
  );
  const branchNames = new Set(docsflowBranches.map((b) => b.name));

  const records = await PublishBranch.find({}).lean();
  const trackedRecords = records.filter(
    (r) => r.branch && r.branch.startsWith("docsflow")
  );
  const recordMap = new Map(trackedRecords.map((r) => [r.branch, r]));
  const now = new Date();

  for (const record of trackedRecords) {
    if (!branchNames.has(record.branch)) {
      await PublishBranch.updateOne(
        { _id: record._id },
        { $set: { status: "stale" } }
      );
      continue;
    }

    const entity = record.entity || inferEntityFromBranch(record.branch) || "unknown";
    const pathPrefix = entityPathMap[entity];
    const tree = await getBranchTree(octokit, OWNER, REPO, record.branch);
    const filteredTree = pathPrefix
      ? tree.filter(
          (item) =>
            item.type === "blob" &&
            item.path &&
            item.path.startsWith(pathPrefix)
        )
      : tree.filter((item) => item.type === "blob" && item.path);

    const files = filteredTree.map((item) => ({
      path: item.path,
      last_published_blob_sha: item.sha,
      last_published_at: now,
    }));

    const { data: openPrs } = await octokit.rest.pulls.list({
      owner: OWNER,
      repo: REPO,
      head: `${OWNER}:${record.branch}`,
      base: BRANCH,
      state: "open",
    });

    const prInfo =
      openPrs.length > 0
        ? {
            url: openPrs[0].html_url,
            number: openPrs[0].number,
            state: openPrs[0].state,
          }
        : null;

    await PublishBranch.updateOne(
      { _id: record._id },
      {
        $set: {
          entity,
          base: BRANCH,
          files,
          pr: prInfo,
          status: "open",
          last_used_at: now,
        },
      }
    );
  }

  for (const branch of docsflowBranches) {
    const existing = recordMap.get(branch.name);
    if (!existing) {
      const entity = inferEntityFromBranch(branch.name) || "unknown";
      await PublishBranch.create({
        entity,
        branch: branch.name,
        base: BRANCH,
        files: [],
        status: "open",
        last_used_at: now,
      });
    }
  }

  for (const branch of docsflowBranches) {
    const record = recordMap.get(branch.name);
    if (record) continue;

    const entity = inferEntityFromBranch(branch.name) || "unknown";
    const pathPrefix = entityPathMap[entity];
    const tree = await getBranchTree(octokit, OWNER, REPO, branch.name);
    const filteredTree = pathPrefix
      ? tree.filter(
          (item) =>
            item.type === "blob" &&
            item.path &&
            item.path.startsWith(pathPrefix)
        )
      : tree.filter((item) => item.type === "blob" && item.path);

    const files = filteredTree.map((item) => ({
      path: item.path,
      last_published_blob_sha: item.sha,
      last_published_at: now,
    }));

    const { data: openPrs } = await octokit.rest.pulls.list({
      owner: OWNER,
      repo: REPO,
      head: `${OWNER}:${branch.name}`,
      base: BRANCH,
      state: "open",
    });

    const prInfo =
      openPrs.length > 0
        ? {
            url: openPrs[0].html_url,
            number: openPrs[0].number,
            state: openPrs[0].state,
          }
        : null;

    await PublishBranch.updateOne(
      { branch: branch.name },
      {
        $set: {
          entity,
          base: BRANCH,
          files,
          pr: prInfo,
          status: "open",
          last_used_at: now,
        },
      },
      { upsert: true }
    );
  }
}
