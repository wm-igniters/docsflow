# MDXEditor Patch Notes

## Full context (why we override)
`@mdxeditor/editor` exports markdown with a trailing `\n`, but the core plugin
immediately trims it. This removes the final newline from editor output and
diffs even though the serializer tried to keep it.

Specifically:
- `exportMarkdownFromLexical` appends `\n` at the end of the string.
- The core plugin then calls `theNewMarkdownValue.trim()` before publishing.

Net effect (example):
- Output becomes `Line N text⟨EOF⟩` instead of `Line N text\n⟨EOF⟩`.
- Source ↔ rich‑text mode toggles also drop the trailing newline.

We want **exactly one trailing newline** because a text file is conventionally
defined as lines ending with `\n` (POSIX behavior). This keeps editor diffs
consistent with saved files and avoids “no newline at end of file” noise in git.

## Why the library does this (and why we still override)
Their behavior serves two goals:
- **Serializer convention:** emit a trailing `\n` (common in Markdown tools).
- **Editor stability:** trim to avoid whitespace‑only changes triggering
  onChange, autosave, or dirty state.

We accept the tradeoff and prefer correct file normalization. Removing the trim
preserves the trailing newline without affecting other formatting rules.

## What we change
Patch one line in:
`node_modules/@mdxeditor/editor/dist/plugins/core/index.js`

Change:
```
r.pub(markdown$, theNewMarkdownValue.trim());
```
to:
```
r.pub(markdown$, theNewMarkdownValue.replace(/\n*$/, "\n"));
```

## Why this works
`exportMarkdownFromLexical` already appends a trailing `\n`. Replacing `trim()`
with `replace(/\n*$/, "\n")` preserves **exactly one** trailing newline across:
- rich‑text edits
- source view
- diff view

The Markdown parser still normalizes multiple blank lines, so you won’t end up
with `\n\n` growing over time.

## How it is applied
Postinstall runs:
```
node patches/scripts/apply-mdxeditor-patch.mjs
```

The script:
- Reads `package-lock.json`
- Applies the patch only if `@mdxeditor/editor` is version `3.52.4`
- Logs why it applied or skipped

## When updating @mdxeditor/editor
If the version changes:
1. Check the `@mdxeditor/editor` changelog/release notes for any markdown export
   or formatting changes that could affect trailing newlines.
2. Verify the current core export logic in
   `node_modules/@mdxeditor/editor/dist/plugins/core/index.js` still trims the
   exported markdown and that we still want to override it.
3. If the trim logic is still present and the override is still desired:
   - First update or rewrite the patch to match the **new** library version logic and
     confirm it applies cleanly and produces the desired trailing newline.
   - Only after the patch is verified, update `expectedVersion` in
     `patches/scripts/apply-mdxeditor-patch.mjs` to the new version.
4. If the trim logic is gone or no longer needed, remove this patch + script +
   postinstall entry.
