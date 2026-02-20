import mongoose from 'mongoose';
import { Octokit } from 'octokit';
import { GITHUB_CONFIG, DB_CONFIG } from '../../lib/config.mjs';

/**
 * Ensures MongoDB tech_stack_data is perfectly in sync with GitHub.
 * 1. Checks for missing files in DB.
 * 2. Checks for files in DB that no longer exist in GitHub.
 * 3. Checks for version/content mismatches.
 */
export async function syncTechStack(connection, octokit) {
  const { OWNER, REPO, BRANCH, PATHS } = GITHUB_CONFIG;
  const { COLLECTIONS } = DB_CONFIG;

  function isEqual(a, b) {
    if (a === b) return true;
    if (typeof a !== 'object' || a === null || typeof b !== 'object' || b === null) return false;
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;
    for (const key of keysA) {
      if (!keysB.includes(key) || !isEqual(a[key], b[key])) return false;
    }
    return true;
  }

  const TechStackSchema = new mongoose.Schema({
    _id: String,
    version: String,
    last_commit_id: String,
    last_update_timestamp: Date,
    creation_timestamp: Date,
    last_github_user: String,
    last_updated_by: { type: String, enum: ['github', 'docsflow'], default: 'github' },
    status: { type: String, enum: ['modified', 'draft', 'published'], default: 'published' },
    data: mongoose.Schema.Types.Mixed,
    docs_flow_data: mongoose.Schema.Types.Mixed,
  }, { timestamps: true });

  const TechStack = connection.model('TechStack', TechStackSchema, COLLECTIONS.TECH_STACK);

  console.log('--- Tech Stack Integrity Check ---');
  
  // 1. Fetch current directory state from GitHub
  const { data: files } = await octokit.rest.repos.getContent({
    owner: OWNER,
    repo: REPO,
    path: PATHS.TECH_STACK,
    ref: BRANCH,
  });

  if (!Array.isArray(files)) {
    throw new Error(`Data path ${PATHS.TECH_STACK} is not a directory`);
  }

  const githubFiles = files.filter(f => f.name.endsWith('.json'));
  const githubFileNames = githubFiles.map(f => f.name);

  // 2. Fetch current DB state
  const dbDocs = await TechStack.find({}, { _id: 1, last_commit_id: 1, last_update_timestamp: 1, data: 1, docs_flow_data: 1 }).lean();
  const dbFileNames = dbDocs.map(d => d._id);
  const dbDocMap = Object.fromEntries(dbDocs.map(d => [d._id, d]));

  // 3. Find files to delete (in DB but not in GitHub)
  const toDelete = dbFileNames.filter(name => !githubFileNames.includes(name));
  for (const fileName of toDelete) {
    const doc = dbDocMap[fileName];
    const hasChanges = !isEqual(doc.data, doc.docs_flow_data);
    
    if (hasChanges) {
      console.log(`Skipping deletion of obsolete ${fileName} (Found local un-published changes)`);
      // Update status to 'draft' to signify it's disconnected from GitHub
      await TechStack.updateOne({ _id: fileName }, { $set: { status: 'draft', last_updated_by: 'github' } });
    } else {
      console.log(`Removing obsolete record: ${fileName}`);
      await TechStack.deleteOne({ _id: fileName });
    }
  }

  // 4. Find files to sync (missing or mismatched commit)
  for (const file of githubFiles) {
    const fileName = file.name;
    
    // Skip fetching metadata for every file if we don't have to? 
    // Actually, to verify integrity accurately, we need the latest commit SHA for EACH file.
    const { data: commits } = await octokit.rest.repos.listCommits({
      owner: OWNER,
      repo: REPO,
      path: file.path,
      sha: BRANCH,
      per_page: 1,
    });

    const latestCommitSha = commits[0].sha;
    const latestTimestamp = new Date(commits[0].commit.committer.date);
    const dbDoc = dbDocMap[fileName];

    const isMissing = !dbDoc;
    const isOutdatedInfo = dbDoc && dbDoc.last_commit_id !== latestCommitSha;
    const isNewerTimestamp = dbDoc && dbDoc.last_update_timestamp && latestTimestamp > new Date(dbDoc.last_update_timestamp);

    if (isMissing || isOutdatedInfo || isNewerTimestamp) {
      console.log(`Syncing ${fileName} (Reason: ${isMissing ? 'Missing' : isOutdatedInfo ? 'Commit Mismatch' : 'Newer Timestamp'})`);
      
      const { data: contentRes } = await octokit.rest.repos.getContent({
        owner: OWNER,
        repo: REPO,
        path: file.path,
        ref: latestCommitSha, // Fetch specific commit content to be precise
      });

      // @ts-ignore
      const content = JSON.parse(Buffer.from(contentRes.content, 'base64').toString());
      const commitInfo = commits[0];

      const hasNoDraft = !dbDoc || isEqual(dbDoc.data, dbDoc.docs_flow_data);

      const updateFields = {
        version: fileName.replace('.json', ''),
        last_commit_id: latestCommitSha,
        last_update_timestamp: commitInfo.commit.committer?.date ? new Date(commitInfo.commit.committer.date) : new Date(),
        last_github_user: commitInfo.author?.login || commitInfo.commit.author?.name || 'unknown',
        last_updated_by: 'github',
        status: hasNoDraft ? 'published' : 'modified',
        data: content,
      };

      if (hasNoDraft) {
        updateFields.docs_flow_data = content;
      }

      await TechStack.findOneAndUpdate(
        { _id: fileName },
        {
          $set: updateFields,
          $setOnInsert: {
            _id: fileName,
            ...(hasNoDraft ? {} : { docs_flow_data: content }) // Fallback for safety, though hasNoDraft will be true for inserts
          }
        },
        { upsert: true }
      );

      // Verify creation_timestamp
      const doc = await TechStack.findById(fileName);
      if (doc && !doc.creation_timestamp) {
          const { data: firstCommits } = await octokit.rest.repos.listCommits({ owner: OWNER, repo: REPO, path: file.path, sha: BRANCH });
          const firstCommit = firstCommits[firstCommits.length - 1];
          if (firstCommit?.commit?.committer?.date) {
            doc.creation_timestamp = new Date(firstCommit.commit.committer.date);
            await doc.save();
          }
      }
    }
  }

  console.log('Tech Stack Integrity: OK');
}
