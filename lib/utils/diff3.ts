import { diff3Merge, diffPatch } from 'node-diff3';

export interface DiffMergeResult {
  isClean: boolean;
  mergedText: string;
}

export interface DiffPatchResult {
  type: 'diffPatch';
  lineSeparator: '\n';
  patch: ReturnType<typeof diffPatch<string>>;
}

/**
 * Performs a 3-way merge using node-diff3.
 *
 * @param yours The local unsaved state of the document
 * @param base  The base state of the document before local edits
 * @param theirs The new remote state of the document to merge in
 * @returns An object indicating if the merge was clean, and the merged string.
 *          If dirty, the merged string aggressively picks `theirs` for conflicting chunks.
 */
export function performMerge(
  yours: string,
  base: string,
  theirs: string
): DiffMergeResult {
  const diffResult = diff3Merge(
    yours.split('\n'), 
    base.split('\n'), 
    theirs.split('\n')
  );
  
  let isClean = true;
  let mergedTextParts: string[] = [];

  diffResult.forEach((chunk) => {
    // A clean merge block where all sides agree or changes didn't overlap
    if (chunk.ok) {
      mergedTextParts.push(chunk.ok.join('\n'));
    } 
    // A conflicting block
    else if (chunk.conflict) {
      isClean = false;
      // Aggressively pick 'theirs' as the baseline for the conflict
      // so the user can see what the server updated in the diff view.
      if (chunk.conflict.b && chunk.conflict.b.length > 0) {
        mergedTextParts.push(chunk.conflict.b.join('\n'));
      }
    }
  });

  return {
    isClean,
    mergedText: mergedTextParts.join('\n')
  };
}

export function createLinePatch(oldText: string, newText: string): DiffPatchResult | null {
  if (oldText === newText) return null;
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');
  const patch = diffPatch(oldLines, newLines);
  if (!patch.length) return null;
  return {
    type: 'diffPatch',
    lineSeparator: '\n',
    patch
  };
}
