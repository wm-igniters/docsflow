"use server";

import { fetchDocTree, syncDocTree, fetchDocContent, saveDocContent } from "@/lib/actions/docs";
import { DocSchema } from "@/models/Doc";
import { GITHUB_CONFIG, DB_CONFIG } from "@/lib/config.mjs";

const RELEASE_NOTES_PATH = GITHUB_CONFIG.PATHS.RELEASE_NOTES;

export async function getReleaseNotesTree() {
  return fetchDocTree(RELEASE_NOTES_PATH);
}

export async function syncReleaseNotes() {
  return syncDocTree(RELEASE_NOTES_PATH);
}

export async function getReleaseNoteContent(path: string) {
  return fetchDocContent(
    path, 
    'Doc', 
    DB_CONFIG.COLLECTIONS.RELEASE_NOTES, 
    DocSchema
  );
}

export async function updateReleaseNote(path: string, content: string) {
  return saveDocContent(
    path, 
    content, 
    'Doc', 
    DB_CONFIG.COLLECTIONS.RELEASE_NOTES, 
    DocSchema,
    computeSimpleDiff
  );
}

/**
 * Simple diff for markdown/text content
 */
function computeSimpleDiff(oldContent: any, newContent: any) {
  if (oldContent === newContent) return null;
  return {
    content: {
      from: typeof oldContent === 'string' ? oldContent.slice(0, 100) + '...' : 'none',
      to: typeof newContent === 'string' ? newContent.slice(0, 100) + '...' : 'none'
    }
  };
}
