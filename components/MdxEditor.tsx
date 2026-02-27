"use client";

import React, {
  useCallback,
  useMemo,
  useImperativeHandle,
  useRef,
  useEffect,
  useState,
} from "react";
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
  jsxPlugin,
  CodeMirrorEditor,
  NestedLexicalEditor,
  type CodeBlockEditorDescriptor,
  type DirectiveDescriptor,
  type DirectiveEditorProps,
  insertDirective$,
  ButtonOrDropdownButton,
  iconComponentFor$,
  useTranslation,
  useNestedEditorContext,
  lexicalTheme,
  usePublisher,
  useMdastNodeUpdater,
  viewMode$,
} from "@mdxeditor/editor";
import type { Paragraph } from "mdast";
import type { ContainerDirective } from "mdast-util-directive";
import type { MDXEditorMethods } from "@mdxeditor/editor";
import "@mdxeditor/editor/style.css";
import { useTheme } from "next-themes";
import { useCellValue } from "@mdxeditor/gurx";
import {
  docsComponentDescriptors,
  DocsComponentsToolbar,
} from "@/components/docs/DocsMdxComponents";
import { cn } from "@/lib/utils";
import { validateMdxSource } from "@/lib/mdx/validateMdx";
import { MdxPreview } from "@/components/MdxPreview";
import { TabsWrapper, TabItem } from "@/components/docs/LayoutComponents/Tabs";
import VideoCard from "@/components/docs/VideoCard/VideoCard";
import AcademyCard from "@/components/docs/AcademyCard/AcademyCard";
import { errorExtension, setError } from "@/lib/codemirror/errorExtension";
import { EditorView } from "@codemirror/view";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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

type AdmonitionTypeConfig = {
  name: string;
  label?: string;
  className?: string;
};

type AdmonitionsConfig = {
  types?: AdmonitionTypeConfig[];
  titleAttribute?: string;
};

interface MdxEditorProps {
  markdown: string;
  diffMarkdown?: string;
  onChange?: (markdown: string) => void;
  onValidationChange?: (error: string | null) => void;
  documentPath?: string; // used for Asset upload tracing
  defaultViewMode?: ViewMode;
  showRichText?: boolean;
  showSource?: boolean;
  showDiff?: boolean;
  admonitions?: AdmonitionsConfig;
}

const DOCUSAURUS_ADMONITION_TYPES = [
  "note",
  "tip",
  "info",
  "warning",
  "danger",
] as const;

const DOCUSAURUS_ALERT_CLASS: Record<
  (typeof DOCUSAURUS_ADMONITION_TYPES)[number],
  string
> = {
  note: "alert--secondary",
  tip: "alert--success",
  info: "alert--info",
  warning: "alert--warning",
  danger: "alert--danger",
};

const formatAdmonitionLabel = (value: string) => {
  return value
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

const isDirectiveLabelParagraph = (node: any) =>
  node?.type === "paragraph" && node?.data?.directiveLabel === true;

const getDirectiveLabelText = (node: any) => {
  if (!node?.children) return "";
  return node.children
    .filter((child: any) => child?.type === "text" && typeof child.value === "string")
    .map((child: any) => child.value)
    .join("");
};

const createDirectiveLabelParagraph = (title: string): Paragraph => ({
  type: "paragraph",
  data: { directiveLabel: true },
  children: [{ type: "text", value: title }],
});

const createAdmonitionDirectiveDescriptor = ({
  typeNames,
  titleAttribute,
  labelMap,
}: {
  typeNames: Set<string>;
  titleAttribute: string;
  labelMap: Record<string, string>;
}): DirectiveDescriptor<ContainerDirective> => {
  const AdmonitionEditor = ({
    mdastNode,
  }: DirectiveEditorProps<ContainerDirective>) => {
    const { config } = useNestedEditorContext();
    const updateMdastNode = useMdastNodeUpdater<ContainerDirective>();
    const className =
      config.theme.admonition?.[mdastNode.name] ??
      cn(
        "admonition",
        "alert",
        `admonition-${mdastNode.name ?? "note"}`
      );
    const labelNode =
      mdastNode.children?.find(isDirectiveLabelParagraph) ?? null;
    const titleFromLabel = labelNode ? getDirectiveLabelText(labelNode) : "";
    const titleFromAttribute =
      mdastNode.attributes &&
      typeof mdastNode.attributes[titleAttribute] === "string"
        ? String(mdastNode.attributes[titleAttribute])
        : "";
    const titleValue = titleFromLabel || titleFromAttribute;
    const [title, setTitle] = useState(titleValue);
    const contentChildren = (mdastNode.children ?? []).filter(
      (child) => !isDirectiveLabelParagraph(child)
    ) as ContainerDirective["children"];
    const label =
      labelMap[mdastNode.name ?? "note"] ??
      formatAdmonitionLabel(mdastNode.name ?? "note");

    useEffect(() => {
      setTitle(titleValue);
    }, [titleValue]);

    const updateTitle = (nextValue: string) => {
      setTitle(nextValue);
      const nextAttributes = { ...(mdastNode.attributes ?? {}) };
      delete nextAttributes[titleAttribute];
      const nextLabel = nextValue.trim();
      const nextChildren = nextLabel
        ? [createDirectiveLabelParagraph(nextLabel), ...contentChildren]
        : contentChildren;
      updateMdastNode({
        attributes: Object.keys(nextAttributes).length
          ? nextAttributes
          : undefined,
        children: nextChildren,
      });
    };

    return (
      <div className={className}>
        <div className="admonitionHeading" contentEditable={false}>
          <span className="admonitionIcon">
            <AdmonitionIcon type={mdastNode.name ?? "note"} />
          </span>
          <input
            className="admonitionTitleInput"
            value={title}
            onChange={(event) => updateTitle(event.target.value)}
            placeholder={label}
            aria-label={`${label} title`}
          />
        </div>
        <div className="admonitionContent">
          <NestedLexicalEditor<ContainerDirective>
            block
            getContent={() => contentChildren}
            getUpdatedMdastNode={(mdastNode2, children) => {
              const nextAttributes = { ...(mdastNode2.attributes ?? {}) };
              delete nextAttributes[titleAttribute];
              const nextLabel = title.trim();
              const nextChildren = nextLabel
                ? [createDirectiveLabelParagraph(nextLabel), ...children]
                : children;
              return {
                ...mdastNode2,
                attributes: Object.keys(nextAttributes).length
                  ? nextAttributes
                  : undefined,
                children: nextChildren as ContainerDirective["children"],
              };
            }}
          />
        </div>
      </div>
    );
  };

  return {
    name: "admonition",
    attributes: [],
    hasChildren: true,
    type: "containerDirective",
    testNode(node) {
      return !!node.name && typeNames.has(node.name);
    },
    Editor: AdmonitionEditor,
  };
};

const AdmonitionIcon = ({ type }: { type: string }) => {
  switch (type) {
    case "tip":
      return (
        <svg viewBox="0 0 12 16" aria-hidden="true">
          <path
            fillRule="evenodd"
            d="M6.5 0C3.48 0 1 2.19 1 5c0 .92.55 2.25 1 3 1.34 2.25 1.78 2.78 2 4v1h5v-1c.22-1.22.66-1.75 2-4 .45-.75 1-2.08 1-3 0-2.81-2.48-5-5.5-5zm3.64 7.48c-.25.44-.47.8-.67 1.11-.86 1.41-1.25 2.06-1.45 3.23-.02.05-.02.11-.02.17H5c0-.06 0-.13-.02-.17-.2-1.17-.59-1.83-1.45-3.23-.2-.31-.42-.67-.67-1.11C2.44 6.78 2 5.65 2 5c0-2.2 2.02-4 4.5-4 1.22 0 2.36.42 3.22 1.19C10.55 2.94 11 3.94 11 5c0 .66-.44 1.78-.86 2.48zM4 14h5c-.23 1.14-1.3 2-2.5 2s-2.27-.86-2.5-2z"
          />
        </svg>
      );
    case "info":
      return (
        <svg viewBox="0 0 14 16" aria-hidden="true">
          <path
            fillRule="evenodd"
            d="M7 2.3c3.14 0 5.7 2.56 5.7 5.7s-2.56 5.7-5.7 5.7A5.71 5.71 0 0 1 1.3 8c0-3.14 2.56-5.7 5.7-5.7zM7 1C3.14 1 0 4.14 0 8s3.14 7 7 7 7-3.14 7-7-3.14-7-7-7zm1 3H6v5h2V4zm0 6H6v2h2v-2z"
          />
        </svg>
      );
    case "warning":
      return (
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <path
            fillRule="evenodd"
            d="M8.893 1.5c-.183-.31-.52-.5-.887-.5s-.703.19-.886.5L.138 13.499a.98.98 0 0 0 0 1.001c.193.31.53.501.886.501h13.964c.367 0 .704-.19.877-.5a1.03 1.03 0 0 0 .01-1.002L8.893 1.5zm.133 11.497H6.987v-2.003h2.039v2.003zm0-3.004H6.987V5.987h2.039v4.006z"
          />
        </svg>
      );
    case "danger":
      return (
        <svg viewBox="0 0 12 16" aria-hidden="true">
          <path
            fillRule="evenodd"
            d="M5.05.31c.81 2.17.41 3.38-.52 4.31C3.55 5.67 1.98 6.45.9 7.98c-1.45 2.05-1.7 6.53 3.53 7.7-2.2-1.16-2.67-4.52-.3-6.61-.61 2.03.53 3.33 1.94 2.86 1.39-.47 2.3.53 2.27 1.67-.02.78-.31 1.44-1.13 1.81 3.42-.59 4.78-3.42 4.78-5.56 0-2.84-2.53-3.22-1.25-5.61-1.52.13-2.03 1.13-1.89 2.75.09 1.08-1.02 1.8-1.86 1.33-.67-.41-.66-1.19-.06-1.78C8.18 5.31 8.68 2.45 5.05.32L5.03.3l.02.01z"
          />
        </svg>
      );
    case "note":
    default:
      return (
        <svg viewBox="0 0 14 16" aria-hidden="true">
          <path
            fillRule="evenodd"
            d="M6.3 5.69a.942.942 0 0 1-.28-.7c0-.28.09-.52.28-.7.19-.18.42-.28.7-.28.28 0 .52.09.7.28.18.19.28.42.28.7 0 .28-.09.52-.28.7a1 1 0 0 1-.7.3c-.28 0-.52-.11-.7-.3zM8 7.99c-.02-.25-.11-.48-.31-.69-.2-.19-.42-.3-.69-.31H6c-.27.02-.48.13-.69.31-.2.2-.3.44-.31.69h1v3c.02.27.11.5.31.69.2.2.42.31.69.31h1c.27 0 .48-.11.69-.31.2-.19.3-.42.31-.69H8V7.98v.01zM7 2.3c-3.14 0-5.7 2.54-5.7 5.68 0 3.14 2.56 5.7 5.7 5.7s5.7-2.55 5.7-5.7c0-3.15-2.56-5.69-5.7-5.69v.01zM7 .98c3.86 0 7 3.14 7 7s-3.14 7-7 7-7-3.12-7-7 3.14-7 7-7z"
          />
        </svg>
      );
  }
};

const InsertCustomAdmonition = ({
  items,
}: {
  items: { value: string; label: string }[];
}) => {
  const insertDirective = usePublisher(insertDirective$);
  const iconComponentFor = useCellValue(iconComponentFor$);
  const t = useTranslation();

  if (items.length === 0) return null;

  return (
    <ButtonOrDropdownButton
      title={t("toolbar.admonition", "Insert Admonition")}
      onChoose={(admonitionName) => {
        insertDirective({
          type: "containerDirective",
          name: admonitionName,
        });
      }}
      items={items}
    >
      {iconComponentFor("admonition")}
    </ButtonOrDropdownButton>
  );
};

const ViewModeTracker = ({
  onViewModeChange,
}: {
  onViewModeChange: (mode: ViewMode) => void;
}) => {
  const viewMode = useCellValue(viewMode$);

  useEffect(() => {
    onViewModeChange(viewMode);
  }, [onViewModeChange, viewMode]);

  return null;
};

// Helper to create a CodeMirror extension that captures the view reference
const createViewRefExtension = (
  viewRefCallback: (view: EditorView) => void,
  errorRef: React.MutableRefObject<{ line: number; column?: number; message: string } | null>
) => {
  let lastViewInstance: EditorView | null = null;
  
  return EditorView.updateListener.of((update) => {
    if (update.view) {
      const isNewView = lastViewInstance !== update.view;
      
      if (isNewView) {
        lastViewInstance = update.view;
        viewRefCallback(update.view);
        
        // Apply stored error to new view instance
        if (errorRef.current) {
          console.log('[MdxEditor] Re-applying stored error to new view instance:', errorRef.current);
          // Use setTimeout to avoid triggering during the same update cycle
          setTimeout(() => {
            if (update.view) {
              update.view.dispatch({
                effects: setError(errorRef.current),
              });
            }
          }, 0);
        }
      }
    }
  });
};

export const MdxEditor = React.forwardRef<MDXEditorMethods, MdxEditorProps>(
  function MdxEditor(
  {
    markdown,
    diffMarkdown,
    onChange,
    onValidationChange,
    documentPath = "unknown",
    defaultViewMode = "rich-text",
    showRichText = true,
    showSource = true,
    showDiff = true,
    admonitions,
  },
  ref
) {
  const editorRef = useRef<MDXEditorMethods | null>(null);
  useImperativeHandle(ref, () => editorRef.current as MDXEditorMethods);
  const { resolvedTheme } = useTheme();
  const themeName = resolvedTheme === "dark" ? "dark" : "light";
  const [validationError, setValidationError] = useState<string | null>(null);
  const [validationDetails, setValidationDetails] = useState<{
    message: string;
    line?: number;
    column?: number;
    lineText?: string;
  } | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>(defaultViewMode);
  const [isPreview, setIsPreview] = useState(false);
  const validationDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastValidatedMarkdownRef = useRef<string | null>(null);
  const validationRunRef = useRef(0);
  const hasValidatedInitialRef = useRef(false);
  const codeMirrorViewRef = useRef<any>(null);
  const currentErrorRef = useRef<{ line: number; column?: number; message: string } | null>(null);
  const previewComponents = useMemo(
    () => ({
      TabsWrapper: TabsWrapper as React.ComponentType<any>,
      TabItem: TabItem as React.ComponentType<any>,
      VideoCard: VideoCard as React.ComponentType<any>,
      AcademyCard: AcademyCard as React.ComponentType<any>,
    }),
    []
  );

  const validateSourceMarkdown = useCallback(
    async (nextMarkdown: string) => {
      const runId = ++validationRunRef.current;
      try {
        const result = await validateMdxSource(nextMarkdown, {
          render: true,
          components: previewComponents,
        });

        if (validationRunRef.current !== runId) return;
        if (result.ok) {
          if (validationError) {
            setValidationError(null);
            setValidationDetails(null);
            onValidationChange?.(null);
            currentErrorRef.current = null;
            // Clear error in CodeMirror
            if (codeMirrorViewRef.current) {
              codeMirrorViewRef.current.dispatch({
                effects: setError(null),
              });
            }
          }
          return;
        }
        const location =
          typeof result.line === "number"
            ? `Line ${result.line}${
                typeof result.column === "number" ? `, Column ${result.column}` : ""
              }`
            : "";
        const fullMessage = location ? `${location}: ${result.message}` : result.message;
        setValidationError(fullMessage);
        setValidationDetails({
          message: result.message,
          line: result.line,
          column: result.column,
          lineText: result.lineText,
        });
        onValidationChange?.(fullMessage);
        // Store error for re-application after mode switch
        if (typeof result.line === "number") {
          currentErrorRef.current = {
            line: result.line,
            column: result.column,
            message: result.message,
          };
        } else {
          currentErrorRef.current = null;
        }
        // Set error in CodeMirror
        if (codeMirrorViewRef.current && typeof result.line === "number") {
          console.log('[MdxEditor] Setting error:', { line: result.line, column: result.column, message: result.message });
          codeMirrorViewRef.current.dispatch({
            effects: setError({
              line: result.line,
              column: result.column,
              message: result.message,
            }),
          });
        } else {
          console.log('[MdxEditor] Cannot set error - view not available or no line info', {
            hasView: !!codeMirrorViewRef.current,
            line: result.line
          });
        }
      } catch (err) {
        if (validationRunRef.current !== runId) return;
        const message = err instanceof Error ? err.message : String(err);
        setValidationError(message);
        setValidationDetails({ message });
        onValidationChange?.(message);
        currentErrorRef.current = null;
        // Clear error in CodeMirror (no line info)
        if (codeMirrorViewRef.current) {
          codeMirrorViewRef.current.dispatch({
            effects: setError(null),
          });
        }
      }
    },
    [onValidationChange, previewComponents, validationError]
  );

  const scheduleSourceValidation = useCallback(
    (nextMarkdown: string) => {
      if (lastValidatedMarkdownRef.current === nextMarkdown) return;
      if (validationDebounceRef.current) {
        clearTimeout(validationDebounceRef.current);
      }
      validationDebounceRef.current = setTimeout(() => {
        lastValidatedMarkdownRef.current = nextMarkdown;
        void validateSourceMarkdown(nextMarkdown);
      }, 500);
    },
    [validateSourceMarkdown]
  );

  useEffect(() => {
    if (viewMode === "rich-text" && validationDebounceRef.current) {
      clearTimeout(validationDebounceRef.current);
      validationDebounceRef.current = null;
    }
  }, [viewMode]);


  useEffect(() => {
    return () => {
      if (validationDebounceRef.current) {
        clearTimeout(validationDebounceRef.current);
        validationDebounceRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    setValidationError(null);
    setValidationDetails(null);
    onValidationChange?.(null);
  }, [markdown, onValidationChange]);

  useEffect(() => {
    if (hasValidatedInitialRef.current) return;
    hasValidatedInitialRef.current = true;
    void validateSourceMarkdown(markdown);
  }, [markdown, validateSourceMarkdown]);

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

  const resolvedAdmonitions = useMemo(() => {
    const titleAttribute = admonitions?.titleAttribute ?? "title";
    const normalizedTypes = DOCUSAURUS_ADMONITION_TYPES.map((typeName) => {
      const override = admonitions?.types?.find(
        (type) => type.name === typeName
      );
      return {
        name: typeName,
        label: override?.label ?? typeName,
        className: override?.className,
      };
    });
    const classMap = normalizedTypes.reduce<Record<string, string>>(
      (acc, type) => {
        const alertClass = DOCUSAURUS_ALERT_CLASS[type.name];
        acc[type.name] = cn(
          "admonition",
          "alert",
          "theme-admonition",
          `admonition-${type.name}`,
          `theme-admonition-${type.name}`,
          alertClass,
          type.className
        );
        return acc;
      },
      {}
    );
    const labelMap = normalizedTypes.reduce<Record<string, string>>(
      (acc, type) => {
        acc[type.name] = type.label ?? formatAdmonitionLabel(type.name);
        return acc;
      },
      {}
    );

    return {
      types: normalizedTypes,
      typeNames: new Set(normalizedTypes.map((type) => type.name)),
      items: normalizedTypes.map((type) => ({
        value: type.name,
        label: type.label ?? formatAdmonitionLabel(type.name),
      })),
      classMap,
      titleAttribute,
      labelMap,
    };
  }, [admonitions]);

  const customLexicalTheme = useMemo(() => {
    if (resolvedAdmonitions.types.length === 0) return lexicalTheme;
    return {
      ...lexicalTheme,
      admonition: {
        ...lexicalTheme.admonition,
        ...resolvedAdmonitions.classMap,
      },
    };
  }, [resolvedAdmonitions.classMap, resolvedAdmonitions.types.length]);

  const admonitionDescriptor = useMemo(() => {
    if (resolvedAdmonitions.types.length === 0) return null;
    return createAdmonitionDirectiveDescriptor({
      typeNames: resolvedAdmonitions.typeNames,
      titleAttribute: resolvedAdmonitions.titleAttribute,
      labelMap: resolvedAdmonitions.labelMap,
    });
  }, [
    resolvedAdmonitions.labelMap,
    resolvedAdmonitions.titleAttribute,
    resolvedAdmonitions.typeNames,
    resolvedAdmonitions.types.length,
  ]);

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
      ...(admonitionDescriptor
        ? [
            directivesPlugin({
              directiveDescriptors: [admonitionDescriptor],
            }),
          ]
        : []),
      jsxPlugin({
        jsxComponentDescriptors: docsComponentDescriptors,
      }),
      codeMirrorPlugin({
        codeBlockLanguages: CODE_BLOCK_LANGUAGES,
      }),
      diffSourcePlugin({
        diffMarkdown: diffMarkdown ?? markdown,
        viewMode: defaultViewMode,
        codeMirrorExtensions: [
          errorExtension(),
          createViewRefExtension((view) => {
            codeMirrorViewRef.current = view;
          }, currentErrorRef),
        ],
      }),
      imagePlugin({ imageUploadHandler }),
      toolbarPlugin({
        toolbarContents: () => (
          <>
            <ViewModeTracker onViewModeChange={setViewMode} />
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
                <span
                  onMouseDown={(event) => {
                    event.preventDefault();
                    editorRef.current?.focus();
                  }}
                >
                  <InsertThematicBreak />
                </span>
                <div className="w-px h-6 bg-border mx-1" />
                <InsertCodeBlock />
                <InsertCustomAdmonition items={resolvedAdmonitions.items} />
                <InsertFrontmatter />
                <div className="w-px h-6 bg-border mx-1" />
                <DocsComponentsToolbar uploadAsset={imageUploadHandler} />
              </div>
            </DiffSourceToggleWrapper>
          </>
        ),
      }),
    ],
    [
      defaultViewMode,
      diffMarkdown,
      imageUploadHandler,
      admonitionDescriptor,
      resolvedAdmonitions.items,
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
        <div className="flex items-center justify-end gap-2 border-b border-border bg-muted/30 px-3 py-2 text-[11px] font-semibold">
          <button
            type="button"
            onClick={() => setIsPreview(false)}
            className={!isPreview ? "text-foreground" : "text-muted-foreground"}
          >
            Editor
          </button>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="inline-block">
                <button
                  type="button"
                  onClick={() => setIsPreview(true)}
                  disabled={!!validationError}
                  className={`${
                    isPreview ? "text-foreground" : "text-muted-foreground"
                  } ${
                    validationError ? "opacity-50 cursor-not-allowed" : ""
                  }`}
                >
                  Preview
                </button>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              {validationError ? "Fix validation errors before previewing" : "Preview"}
            </TooltipContent>
          </Tooltip>
        </div>
        <style jsx global>{`
          .mdx-editor [class*="markdownParseError"] {
            display: none;
          }
        `}</style>
        {validationDetails && (
          <div className="border-b border-destructive/30 bg-destructive/10 px-4 py-2 text-[11px] text-destructive">
            <span className="font-semibold">MDX error</span>
            {" — "}
            {validationDetails.line
              ? `Line ${validationDetails.line}${
                  typeof validationDetails.column === "number"
                    ? `, Column ${validationDetails.column}`
                    : ""
                }`
              : "Location unavailable"}
            {validationDetails.message ? `: ${validationDetails.message}` : ""}
            {validationDetails.lineText && (
              <div className="mt-2 font-mono text-xs text-destructive/90">
                <div className="whitespace-pre-wrap break-words">
                  {validationDetails.lineText}
                </div>
                {typeof validationDetails.column === "number" && (
                  <div className="whitespace-pre-wrap break-words">
                    {" ".repeat(Math.max(0, validationDetails.column - 1))}^
                  </div>
                )}
              </div>
            )}
            <div className="mt-2 text-xs text-destructive/80">
              Please fix this issue in source/diff mode to continue.
            </div>
          </div>
        )}
        <div className={isPreview ? "hidden" : ""}>
          <MDXEditor
            ref={editorRef}
            markdown={markdown}
            onChange={(nextMarkdown) => {
              onChange?.(nextMarkdown);
              if (viewMode !== "rich-text") {
                scheduleSourceValidation(nextMarkdown);
              }
              if (validationError) {
                setValidationError(null);
                setValidationDetails(null);
                onValidationChange?.(null);
                currentErrorRef.current = null;
                // Clear error in CodeMirror
                if (codeMirrorViewRef.current) {
                  codeMirrorViewRef.current.dispatch({
                    effects: setError(null),
                  });
                }
              }
            }}
            onError={(payload) => {
              const { error, source } = payload;
              const payloadLine = (payload as { line?: number }).line;
              const line =
                typeof payloadLine === "number"
                  ? payloadLine
                  : undefined;
              const payloadColumn = (payload as { column?: number }).column;
              const column =
                typeof payloadColumn === "number"
                  ? payloadColumn
                  : undefined;
              const location =
                typeof line === "number"
                  ? `Line ${line}${
                      typeof column === "number" ? `, Column ${column}` : ""
                    }`
                  : "";
              const message = location ? `${location}: ${error}` : error;
              const sourceText = typeof source === "string" ? source : markdown;
              const lineText =
                typeof line === "number"
                  ? sourceText.split(/\r?\n/)[line - 1]
                  : undefined;
              setValidationError(message);
              setValidationDetails({ message: error, line, column, lineText });
              onValidationChange?.(message);
              // Store error for re-application after mode switch
              if (typeof line === "number") {
                currentErrorRef.current = {
                  line,
                  column,
                  message: error,
                };
              } else {
                currentErrorRef.current = null;
              }
              // Set error in CodeMirror
              if (codeMirrorViewRef.current && typeof line === "number") {
                codeMirrorViewRef.current.dispatch({
                  effects: setError({
                    line,
                    column,
                    message: error,
                  }),
                });
              }
            }}
            className="mdx-editor"
            contentEditableClassName="mdx-prose max-w-none p-4 min-h-[500px]"
            toMarkdownOptions={{
              bullet: "-",
              rule: "-",
              ruleRepetition: 3,
            }}
            lexicalTheme={customLexicalTheme}
            plugins={plugins}
          />
        </div>
        {isPreview && (
          <MdxPreview
            value={markdown}
            components={previewComponents}
            className="h-full w-full overflow-auto bg-background text-foreground mdx-prose p-4"
            onClose={() => setIsPreview(false)}
          />
        )}
      </div>
    </div>
  );
});

export default MdxEditor;
