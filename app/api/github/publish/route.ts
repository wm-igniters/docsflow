import { NextResponse } from 'next/server';
import { Octokit } from 'octokit';
import { GITHUB_CONFIG, DB_CONFIG } from '../../../../lib/config.mjs';
import { auth } from '../../../../auth';
import connectDB from '../../../../lib/db';
import TechStack, { TechStackSchema, ITechStack } from '../../../../models/TechStack';

/**
 * API to publish tech stack updates to GitHub.
 * Follows the workflow:
 * 1. Check if 'tech-stack-update-{version}' branch exists.
 * 2. If not, create it from 'release-12'.
 * 3. Update/Create the versioned JSON file in data/tech-stack-data/.
 */
export async function POST(req: Request) {
  try {
    const session = await auth();
    const userEmail = session?.user?.email || 'unknown-user';

    const { OWNER, REPO, BRANCH, PATHS } = GITHUB_CONFIG;
    const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

    if (!GITHUB_TOKEN) {
      throw new Error('GITHUB_TOKEN not configured in environment');
    }

    const octokit = new Octokit({ auth: GITHUB_TOKEN });
    const conn = await connectDB(DB_CONFIG.DB_NAMES.DOCS);
    const TechStackModel = conn.models.TechStack || conn.model<ITechStack>('TechStack', TechStackSchema, DB_CONFIG.COLLECTIONS.TECH_STACK);

    const { docId } = await req.json().catch(() => ({ docId: null }));

    // 1. Get modified documents (filter by docId if provided)
    const query: any = { status: { $ne: 'published' } };
    if (docId) {
      query._id = docId;
    }
    const modifiedDocs = await TechStackModel.find(query);

    if (modifiedDocs.length === 0) {
      return NextResponse.json({ message: 'No pending changes to publish' }, { status: 200 });
    }

    console.log(`🚀 Found ${modifiedDocs.length} modified documents to publish.`);

    // 2. Get latest commit from main
    const { data: mainBranch } = await octokit.rest.repos.getBranch({
      owner: OWNER,
      repo: REPO,
      branch: BRANCH,
    });
    const baseSha = mainBranch.commit.sha;

    // 3. Create a new branch
    const newBranchName = `docsflow-publish-${Date.now()}`;
    await octokit.rest.git.createRef({
      owner: OWNER,
      repo: REPO,
      ref: `refs/heads/${newBranchName}`,
      sha: baseSha,
    });

    console.log(`✅ Created branch: ${newBranchName}`);

    // 4. Categorize files into non-conflicting and conflicting
    // A conflict is defined as: The SHA on GitHub is different from our last_commit_id
    const nonConflicting: ITechStack[] = [];
    const conflicting: ITechStack[] = [];

    for (const doc of modifiedDocs) {
      const filePath = `${PATHS.TECH_STACK}/${doc._id}`;
      try {
        const { data: remoteFile } = await octokit.rest.repos.getContent({
          owner: OWNER,
          repo: REPO,
          path: filePath,
          ref: BRANCH,
        });

        if (!Array.isArray(remoteFile)) {
          if (remoteFile.sha === doc.last_commit_id) {
            nonConflicting.push(doc);
          } else {
            conflicting.push(doc);
          }
        } else {
          // Should not be a directory
          nonConflicting.push(doc);
        }
      } catch (e: any) {
        if (e.status === 404) {
          // New file, not a conflict
          nonConflicting.push(doc);
        } else {
          throw e;
        }
      }
    }

    let currentRefSha = baseSha;

    // Helper to create a commit with multiple files
    const createBulkCommit = async (docs: ITechStack[], message: string, parentSha: string) => {
      // Create blobs
      const treeItems = await Promise.all(docs.map(async (doc) => {
        const content = JSON.stringify(doc.docs_flow_data, null, 2);
        return {
          path: `${PATHS.TECH_STACK}/${doc._id}`,
          mode: '100644' as const,
          type: 'blob' as const,
          content: content,
        };
      }));

      // Create tree
      const { data: tree } = await octokit.rest.git.createTree({
        owner: OWNER,
        repo: REPO,
        base_tree: parentSha,
        tree: treeItems,
      });

      // Create commit
      const { data: commit } = await octokit.rest.git.createCommit({
        owner: OWNER,
        repo: REPO,
        message,
        tree: tree.sha,
        parents: [parentSha],
        author: {
          name: 'DocsFlow Bot',
          email: 'docsflow@wavemaker.com',
        },
      });

      // Update ref
      await octokit.rest.git.updateRef({
        owner: OWNER,
        repo: REPO,
        ref: `heads/${newBranchName}`,
        sha: commit.sha,
      });

      return commit.sha;
    };

    // Commit 1: Non-conflicting files
    if (nonConflicting.length > 0) {
      console.log(`Pushing ${nonConflicting.length} non-conflicting files...`);
      currentRefSha = await createBulkCommit(
        nonConflicting,
        `docs(tech-stack): update tech stack definitions (non-conflicting)\n\nPublished via DocsFlow by ${userEmail}`,
        currentRefSha
      );
    }

    // Commit 2: Conflicting files (DocsFlow overrides main)
    if (conflicting.length > 0) {
      console.log(`Pushing ${conflicting.length} conflicting files (overriding remote changes)...`);
      currentRefSha = await createBulkCommit(
        conflicting,
        `docs(tech-stack): resolve conflicts and update definitions\n\nPriority given to DocsFlow content over GitHub changes.\nPublished via DocsFlow by ${userEmail}`,
        currentRefSha
      );
    }

    // 5. Create Pull Request
    const techStackVersions = modifiedDocs.map(d => d.version).join(', ');
    const prTitle = docId && modifiedDocs.length === 1 
      ? `docs(tech-stack): update tech stack for ${modifiedDocs[0].version}` 
      : `docs(tech-stack): update multiple tech stack versions [${new Date().toLocaleDateString()}]`;

    const { data: pr } = await octokit.rest.pulls.create({
      owner: OWNER,
      repo: REPO,
      head: newBranchName,
      base: BRANCH,
      title: prTitle,
      body: `This Pull Request was automatically generated by DocsFlow.\n\n### Updated Versions:\n${modifiedDocs.map(d => `- ${d.version}`).join('\n')}\n\n**Note:** Conflicts were resolved by giving priority to DocsFlow content.`,
    });

    console.log(`✅ PR Created: ${pr.html_url}`);

    // 6. Update local DB
    for (const doc of modifiedDocs) {
      await TechStackModel.findOneAndUpdate(
        { _id: doc._id },
        {
          $set: {
            data: doc.docs_flow_data,
            last_commit_id: currentRefSha, // Using the final commit SHA
            last_update_timestamp: new Date(),
            last_updated_by: 'docsflow',
            status: 'published'
          }
        }
      );
    }

    return NextResponse.json({
      success: true,
      branch: newBranchName,
      pr_url: pr.html_url,
      message: `Successfully created PR with ${modifiedDocs.length} versions.`
    });

  } catch (error: any) {
    console.error('❌ GitHub Publish API Error:', error);
    return NextResponse.json({
      error: error.message || 'Failed to publish to GitHub',
      details: error.response?.data
    }, { status: 500 });
  }
}
