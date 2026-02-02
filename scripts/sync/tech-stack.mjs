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
  const { OWNER, REPO, BRANCH, DATA_PATH } = GITHUB_CONFIG;
  const { TECH_STACK_COLLECTION } = DB_CONFIG;

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
  }, { timestamps: true });

  const TechStack = connection.model('TechStack', TechStackSchema, TECH_STACK_COLLECTION);

  console.log('--- Tech Stack Integrity Check ---');
  
  // 1. Fetch current directory state from GitHub
  const { data: files } = await octokit.rest.repos.getContent({
    owner: OWNER,
    repo: REPO,
    path: DATA_PATH,
    ref: BRANCH,
  });

  if (!Array.isArray(files)) {
    throw new Error(`Data path ${DATA_PATH} is not a directory`);
  }

  const githubFiles = files.filter(f => f.name.endsWith('.json'));
  const githubFileNames = githubFiles.map(f => f.name);

  // 2. Fetch current DB state
  const dbDocs = await TechStack.find({}, { _id: 1, last_commit_id: 1 }).lean();
  const dbFileNames = dbDocs.map(d => d._id);
  const dbCommitMap = Object.fromEntries(dbDocs.map(d => [d._id, d.last_commit_id]));

  // 3. Find files to delete (in DB but not in GitHub)
  const toDelete = dbFileNames.filter(name => !githubFileNames.includes(name));
  if (toDelete.length > 0) {
    console.log(`Removing ${toDelete.length} obsolete records:`, toDelete);
    await TechStack.deleteMany({ _id: { $in: toDelete } });
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

    if (!dbCommitMap[fileName] || dbCommitMap[fileName] !== latestCommitSha) {
      console.log(`Syncing ${fileName} (Reason: ${!dbCommitMap[fileName] ? 'Missing' : 'Outdated'})`);
      
      const { data: contentRes } = await octokit.rest.repos.getContent({
        owner: OWNER,
        repo: REPO,
        path: file.path,
        ref: latestCommitSha, // Fetch specific commit content to be precise
      });

      // @ts-ignore
      const content = JSON.parse(Buffer.from(contentRes.content, 'base64').toString());
      const commitInfo = commits[0];

      await TechStack.findOneAndUpdate(
        { _id: fileName },
        {
          _id: fileName,
          version: fileName.replace('.json', ''),
          last_commit_id: latestCommitSha,
          last_update_timestamp: commitInfo.commit.committer?.date ? new Date(commitInfo.commit.committer.date) : new Date(),
          last_github_user: commitInfo.author?.login || commitInfo.commit.author?.name || 'unknown',
          last_updated_by: 'github',
          status: 'published',
          data: content,
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
