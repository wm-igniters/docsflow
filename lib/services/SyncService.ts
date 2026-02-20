import { Connection, Model, Schema } from "mongoose";
import { Octokit } from "octokit";
import { GITHUB_CONFIG } from "../config.mjs";
import { performTreeSync } from "./SyncUtils.mjs";

/**
 * Common deep comparison helper
 */
export function isEqual(a: any, b: any): boolean {
  if (a === b) return true;
  if (typeof a !== "object" || a === null || typeof b !== "object" || b === null) return false;
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  for (const key of keysA) {
    if (!keysB.includes(key) || !isEqual(a[key], b[key])) return false;
  }
  return true;
}

/**
 * Syncs the directory tree snapshot for a given path
 */
export async function syncDocTree(
  connection: Connection,
  octokit: Octokit,
  path: string
) {
  // @ts-ignore
  return performTreeSync(connection, octokit, path, GITHUB_CONFIG);
}
