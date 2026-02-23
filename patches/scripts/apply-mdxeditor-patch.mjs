import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const root = process.cwd();
const target = path.join(
  root,
  "node_modules",
  "@mdxeditor",
  "editor",
  "dist",
  "plugins",
  "core",
  "index.js"
);
const lockPath = path.join(root, "package-lock.json");
const expectedVersion = "3.52.4";

/**
 * Why this patch exists:
 * - @mdxeditor/editor exports markdown with a trailing "\n", but core trims it.
 * - We want to preserve a single trailing newline in editor output and diffs.
 *
 * When updating @mdxeditor/editor:
 * - If behavior is still needed, update expectedVersion and the patch file.
 * - If core changed, re-check the trim line and regenerate the patch.
 */

let detectedVersion = "";
try {
  const lock = JSON.parse(readFileSync(lockPath, "utf8"));
  detectedVersion = lock?.packages?.["node_modules/@mdxeditor/editor"]?.version ?? "";
} catch {
  console.warn(
    "[mdxeditor-patch] skipped: failed to parse package-lock.json. " +
      "Patch not applied."
  );
  process.exit(0);
}

if (detectedVersion !== expectedVersion) {
  console.error(
    `[mdxeditor-patch] ERROR: version ${detectedVersion || "unknown"} (expected ${expectedVersion}). ` +
      "Patch not applied. Update patch files only after verifying logic for the new version."
  );
  process.exit(1);
}

const content = readFileSync(target, "utf8");
const expectedTrim = "r.pub(markdown$, theNewMarkdownValue.trim());";
const expectedReplace = 'r.pub(markdown$, theNewMarkdownValue.replace(/\\n*$/, "\\n"));';

if (content.includes(expectedReplace) && !content.includes(expectedTrim)) {
  console.log("[mdxeditor-patch] already applied; no action needed.");
  process.exit(0);
}

if (!content.includes(expectedTrim)) {
  console.error(
    "[mdxeditor-patch] ERROR: expected trim line not found. " +
      "Patch not applied. Please review and update patches/@mdxeditor+editor+3.52.4.patch."
  );
  process.exit(1);
}

const patchCmd = path.join(root, "node_modules", ".bin", "patch-package");
const result = spawnSync(patchCmd, ["--patch-dir", "patches"], {
  stdio: "inherit",
});

if (result.status !== 0) {
  console.error("[mdxeditor-patch] ERROR: patch-package failed.");
  process.exit(result.status ?? 1);
}

console.log("[mdxeditor-patch] applied successfully.");
