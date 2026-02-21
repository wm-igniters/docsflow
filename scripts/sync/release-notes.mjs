import { performTreeSync } from "../../lib/services/SyncUtils.mjs";
import { GITHUB_CONFIG } from "../../lib/config.mjs";

/**
 * CLI wrapper for Release Notes Tree Sync
 */
export async function syncReleaseNotes(connection, octokit) {
  console.log("--- Release Notes Tree Sync ---");
  await performTreeSync(connection, octokit, GITHUB_CONFIG.PATHS.RELEASE_NOTES, GITHUB_CONFIG, DB_CONFIG.COLLECTIONS.RELEASE_NOTES);
}
