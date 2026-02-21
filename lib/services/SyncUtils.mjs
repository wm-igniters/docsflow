/**
 * Shared Tree Sync logic (minimal dependencies)
 * This file is .mjs to allow direct execution by node scripts without ts-node issues.
 */
export async function performTreeSync(connection, octokit, path, GITHUB_CONFIG, docCollectionName = null) {
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

    // Handle generic document integrity if a collection is provided
    if (docCollectionName) {
      const DocModel = connection.models.Doc || connection.model('Doc', new connection.base.Schema({
        _id: String,
        status: String,
        github_data: connection.base.Schema.Types.Mixed,
        docsflow_data: connection.base.Schema.Types.Mixed
      }, { _id: false, timestamps: false }), docCollectionName);

      // Find all docs under this path
      const existingDocs = await DocModel.find({ _id: { $regex: `^${path}` } }).lean();
      
      for (const doc of existingDocs) {
        const _id = doc._id;
        const existsInGithub = filteredTree.some(item => item.path === _id);
        
        if (!existsInGithub) {
          // It's in DB but not in GitHub (deleted/moved/renamed upstream)
          const hasUnpublishedChanges = doc.status === 'modified' || doc.status === 'new';
          
          if (hasUnpublishedChanges) {
            console.log(`Retaining unpublished deleted file as ghost: ${_id}`);
            
            // Mark as a brand new local file
            await DocModel.updateOne({ _id }, { $set: { status: 'new' } });
            
            // Inject a mock entry into the tree so it appears in the UI sidebar
            filteredTree.push({
              path: _id,
              mode: '100644',
              type: 'blob',
              sha: `ghost-${Date.now()}`,
              url: ''
            });
          } else {
            console.log(`Removing obsolete published document: ${_id}`);
            await DocModel.deleteOne({ _id });
          }
        }
      }
    }

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
