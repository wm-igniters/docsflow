"use client";

import React, { useCallback, useMemo } from "react";
import {
  MDXEditor,
  headingsPlugin,
  listsPlugin,
  quotePlugin,
  thematicBreakPlugin,
  markdownShortcutPlugin,
  imagePlugin,
  tablePlugin,
  linkPlugin,
  linkDialogPlugin,
  toolbarPlugin,
  UndoRedo,
  BoldItalicUnderlineToggles,
  StrikeThroughSupSubToggles,
  BlockTypeSelect,
  CodeToggle,
  CreateLink,
  InsertImage,
  InsertTable,
  ListsToggle,
  frontmatterPlugin,
  InsertFrontmatter,
  codeBlockPlugin,
  InsertCodeBlock,
  codeMirrorPlugin,
  InsertThematicBreak,
  diffSourcePlugin,
  DiffSourceToggleWrapper,
  directivesPlugin,
  AdmonitionDirectiveDescriptor,
  InsertAdmonition,
  jsxPlugin,
  CodeMirrorEditor,
  type CodeBlockEditorDescriptor,
} from "@mdxeditor/editor";
import type { MDXEditorMethods } from "@mdxeditor/editor";
import "@mdxeditor/editor/style.css";
import { useTheme } from "next-themes";
import {
  docsComponentDescriptors,
  DocsComponentsToolbar,
} from "@/components/docs/DocsMdxComponents";

const CODE_BLOCK_LANGUAGES = {
  js: "JavaScript",
  ts: "TypeScript",
  css: "CSS",
  html: "HTML",
  json: "JSON",
  bash: "Bash",
  yaml: "YAML",
} as const;

const FALLBACK_CODE_BLOCK_DESCRIPTOR: CodeBlockEditorDescriptor = {
  priority: 0,
  match: (language, meta) => {
    const normalized = (language ?? "").toLowerCase();
    if (meta) return true;
    if (!normalized) return true;
    return !Object.hasOwn(CODE_BLOCK_LANGUAGES, normalized);
  },
  Editor: CodeMirrorEditor,
};

type ViewMode = "rich-text" | "source" | "diff";

interface MdxEditorProps {
  markdown: string;
  diffMarkdown?: string;
  onChange?: (markdown: string) => void;
  documentPath?: string; // used for Asset upload tracing
  defaultViewMode?: ViewMode;
  showRichText?: boolean;
  showSource?: boolean;
  showDiff?: boolean;
}

export const MdxEditor = React.forwardRef<MDXEditorMethods, MdxEditorProps>(
  function MdxEditor(
  {
    markdown,
    diffMarkdown,
    onChange,
    documentPath = "unknown",
    defaultViewMode = "rich-text",
    showRichText = true,
    showSource = true,
    showDiff = true,
  },
  ref
) {
  const { resolvedTheme } = useTheme();
  const themeName = resolvedTheme === "dark" ? "dark" : "light";

  const imageUploadHandler = useCallback(async (image: File) => {
    const formData = new FormData();
    formData.append("file", image);
    formData.append("usedInPath", documentPath);

    const response = await fetch("/api/upload-asset", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || "Failed to upload image");
    }

    const data = await response.json();
    return data.url; // Returns the URL to be inserted into the editor
  }, [documentPath]);

  const plugins = useMemo(
    () => [
      headingsPlugin(),
      listsPlugin(),
      quotePlugin(),
      thematicBreakPlugin(),
      markdownShortcutPlugin(),
      tablePlugin(),
      linkPlugin(),
      linkDialogPlugin(),
      frontmatterPlugin(),
      codeBlockPlugin({
        defaultCodeBlockLanguage: "js",
        codeBlockEditorDescriptors: [FALLBACK_CODE_BLOCK_DESCRIPTOR],
      }),
      directivesPlugin({
        directiveDescriptors: [AdmonitionDirectiveDescriptor],
      }),
      jsxPlugin({
        jsxComponentDescriptors: docsComponentDescriptors,
      }),
      codeMirrorPlugin({
        codeBlockLanguages: CODE_BLOCK_LANGUAGES,
      }),
      diffSourcePlugin({
        diffMarkdown: diffMarkdown ?? markdown,
        viewMode: defaultViewMode,
      }),
      imagePlugin({ imageUploadHandler }),
      toolbarPlugin({
        toolbarContents: () => (
          <DiffSourceToggleWrapper
            options={[
              ...(showRichText ? ["rich-text" as const] : []),
              ...(showSource ? ["source" as const] : []),
              ...(showDiff ? ["diff" as const] : []),
            ]}
          >
            <div className="flex flex-wrap gap-1 p-2 bg-muted/50 border-b border-border items-center">
              <UndoRedo />
              <div className="w-px h-6 bg-border mx-1" />
              <BlockTypeSelect />
              <div className="w-px h-6 bg-border mx-1" />
              <BoldItalicUnderlineToggles />
              <CodeToggle />
              <StrikeThroughSupSubToggles />
              <div className="w-px h-6 bg-border mx-1" />
              <ListsToggle />
              <div className="w-px h-6 bg-border mx-1" />
              <CreateLink />
              <InsertImage />
              <InsertTable />
              <InsertThematicBreak />
              <div className="w-px h-6 bg-border mx-1" />
              <InsertCodeBlock />
              <InsertAdmonition />
              <InsertFrontmatter />
              <div className="w-px h-6 bg-border mx-1" />
              <DocsComponentsToolbar uploadAsset={imageUploadHandler} />
            </div>
          </DiffSourceToggleWrapper>
        ),
      }),
    ],
    [
      defaultViewMode,
      diffMarkdown,
      imageUploadHandler,
      markdown,
      showDiff,
      showRichText,
      showSource,
      docsComponentDescriptors,
    ]
  );

  return (
    <div className="w-full h-full border border-border rounded-md bg-background overflow-hidden text-foreground max-h-screen overflow-y-auto">
      <div className={`${themeName}-theme`} data-theme={themeName}>
        <MDXEditor
          ref={ref}
          markdown={markdown}
          onChange={(nextMarkdown) => onChange?.(nextMarkdown)}
          className="mdx-editor"
          contentEditableClassName="mdx-prose max-w-none p-4 min-h-[500px]"
          toMarkdownOptions={{
            bullet: "-",
            rule: "-",
            ruleRepetition: 3,
          }}
          plugins={plugins}
        />
      </div>
    </div>
  );
});

export default MdxEditor;
