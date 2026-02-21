import { Octokit } from "octokit";
import { GITHUB_CONFIG } from "./config.mjs";

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const { OWNER, REPO, BRANCH, PATHS } = GITHUB_CONFIG;

// Initialize Octokit
const octokit = new Octokit({
  auth: GITHUB_TOKEN,
});

export async function getFileMetadata(path: string, ref: string = BRANCH) {
  try {
    const { data: commits } = await octokit.rest.repos.listCommits({
      owner: OWNER,
      repo: REPO,
      path: path,
      sha: ref,
      per_page: 1,
    });

    if (commits.length === 0) return null;

    const lastCommit = commits[0];
    return {
      last_commit_id: lastCommit.sha,
      last_update_timestamp: lastCommit.commit.committer?.date || lastCommit.commit.author?.date,
      last_github_user: lastCommit.author?.login || lastCommit.commit.author?.name || "Unknown",
    };
  } catch (error) {
    console.error(`Error fetching metadata for ${path}:`, error);
    return null;
  }
}

export async function fetchTechStackFiles() {
  try {
    const { data: files } = await octokit.rest.repos.getContent({
      owner: OWNER,
      repo: REPO,
      path: PATHS.TECH_STACK,
      ref: BRANCH,
    });

    if (!Array.isArray(files)) {
      throw new Error("Path is not a directory");
    }

    const jsonFiles = files.filter((file) => file.name.endsWith(".json"));

    const fileContents = await Promise.all(
      jsonFiles.map(async (file) => {
        const [contentRes, metadata] = await Promise.all([
          octokit.rest.repos.getContent({
            owner: OWNER,
            repo: REPO,
            path: file.path,
            ref: BRANCH,
          }),
          getFileMetadata(file.path, BRANCH),
        ]);

        const data = contentRes.data;
        // @ts-ignore
        if (data.type !== "file" || !data.content) return null;

        // @ts-ignore
        const buf = Buffer.from(data.content, "base64");
        const jsonContent = JSON.parse(buf.toString("utf-8"));

        return {
          fileName: file.name,
          content: jsonContent,
          version: file.name.replace(".json", ""),
          metadata: metadata,
        };
      })
    );

    return fileContents.filter((f) => f !== null);
  } catch (error) {
    console.error("Error fetching from GitHub:", error);
    throw error;
  }
}

export async function getFileContent(path: string, ref: string = BRANCH) {
  try {
    const { data } = await octokit.rest.repos.getContent({
      owner: OWNER,
      repo: REPO,
      path: path,
      ref: ref,
    });

    // @ts-ignore
    if (data.type !== "file" || !data.content) return null;

    const ext = path.split(".").pop()?.toLowerCase() || "";
    const binaryExtensions = new Set([
      "jpg",
      "jpeg",
      "png",
      "gif",
      "webp",
      "bmp",
      "avif",
      "mp4",
      "webm",
      "mov",
      "m4v",
      "avi",
      "mkv",
      "mp3",
      "wav",
      "ogg",
      "m4a",
      "flac",
      "aac",
    ]);
    const isBinary = binaryExtensions.has(ext);
    // @ts-ignore
    const rawBase64 = String(data.content).replace(/\n/g, "");
    if (isBinary) {
      return rawBase64;
    }
    const buf = Buffer.from(rawBase64, "base64");
    return buf.toString("utf-8");
  } catch (error: any) {
    if (error.status === 404) return null;
    console.error(`Error fetching content for ${path}:`, error);
    throw error;
  }
}
