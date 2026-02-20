/**
 * Shared Tree Sync logic (minimal dependencies)
 * This file is .mjs to allow direct execution by node scripts without ts-node issues.
 */
export async function performTreeSync(connection, octokit, path, GITHUB_CONFIG) {
  const { OWNER, REPO, BRANCH } = GITHUB_CONFIG;
  
  // Dynamic model retrieval/definition to avoid static import of .ts files in .mjs context
  const DocTree = connection.models.DocTree || connection.model('DocTree', new connection.base.Schema({
    _id: String,
    commit_details: {
      last_commit_id: String,
      last_commit_timestamp: Date,
      last_commit_user: String,
    },
    last_update_timestamp: Date,
    tree: [Object]
  }, { timestamps: true, _id: false }), 'doc_trees');

  console.log(`--- Syncing Doc Tree for: ${path} ---`);

  try {
    const { data: commits } = await octokit.rest.repos.listCommits({
      owner: OWNER,
      repo: REPO,
      path: path,
      sha: BRANCH,
      per_page: 1,
    });

    if (!commits || commits.length === 0) {
      console.warn(`No commits found for path: ${path}`);
      return;
    }

    const latestCommit = commits[0];
    const latestCommitSha = latestCommit.sha;
    
    // Get the tree SHA from the latest commit
    const { data: branchCommitData } = await octokit.rest.git.getCommit({
      owner: OWNER,
      repo: REPO,
      commit_sha: latestCommitSha
    });

    // Fetch the recursive tree from the root and filter by path
    const { data: treeData } = await octokit.rest.git.getTree({
      owner: OWNER,
      repo: REPO,
      tree_sha: branchCommitData.tree.sha,
      recursive: "true"
    });

    const filteredTree = treeData.tree.filter(item => item.path?.startsWith(path));

    await DocTree.findOneAndUpdate(
      { _id: path },
      {
        $set: {
          commit_details: {
            last_commit_id: latestCommitSha,
            last_commit_timestamp: new Date(latestCommit.commit.committer.date),
            last_commit_user: latestCommit.author?.login || latestCommit.commit.author?.name || "unknown",
          },
          last_update_timestamp: new Date(),
          tree: filteredTree,
        }
      },
      { upsert: true }
    );

    console.log(`Doc Tree Sync OK: ${path}`);
  } catch (error) {
    console.error(`Error in performTreeSync for ${path}:`, error.message);
    throw error;
  }
}
