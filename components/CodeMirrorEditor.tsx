"use client";

import React, {
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import CodeMirror from "@uiw/react-codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { json } from "@codemirror/lang-json";
import { html } from "@codemirror/lang-html";
import { markdown } from "@codemirror/lang-markdown";
import { EditorState } from "@codemirror/state";
import { MergeView } from "@codemirror/merge";
import { EditorView, basicSetup } from "codemirror";
import { githubLight } from "@uiw/codemirror-theme-github";
import { dracula } from "@uiw/codemirror-theme-dracula";
import { useTheme } from "next-themes";

type CodeViewMode = "source" | "diff";

export interface CodeMirrorEditorHandle {
  getValue: () => string;
  setValue: (value: string) => void;
  focus: () => void;
}

interface CodeMirrorEditorProps {
  fileExtension?: string;
  baseValue?: string;
  defaultViewMode?: CodeViewMode;
  showDiff?: boolean;
  showSource?: boolean;
  initialValue?: string;
  onChange?: (value: string) => void;
}

export const CodeMirrorEditor = React.forwardRef<
  CodeMirrorEditorHandle,
  CodeMirrorEditorProps
>(function CodeMirrorEditor(
  {
    fileExtension,
    baseValue = "",
    defaultViewMode = "source",
    showDiff = false,
    showSource = true,
    initialValue = "",
    onChange,
  },
  ref
) {
  const { resolvedTheme } = useTheme();
  const [viewMode, setViewMode] = useState<CodeViewMode>(defaultViewMode);
  const mergeContainerRef = useRef<HTMLDivElement | null>(null);
  const mergeViewRef = useRef<MergeView | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const currentValueRef = useRef(initialValue);

  const extensions = useMemo(() => {
    const exts = [];
    switch (fileExtension?.toLowerCase()) {
      case "js":
      case "jsx":
      case "mjs":
      case "cjs":
      case "ts":
      case "tsx":
        exts.push(javascript({ jsx: true, typescript: true }));
        break;
      case "json":
        exts.push(json());
        break;
      case "html":
        exts.push(html());
        break;
      case "md":
      case "mdx":
        exts.push(markdown());
        break;
      // Add more language cases as needed
    }
    return exts;
  }, [fileExtension]);

  const theme = resolvedTheme === "dark" ? dracula : githubLight;

  const handleSourceChange = useCallback(
    (value: string) => {
      currentValueRef.current = value;
      onChange?.(value);
    },
    [onChange]
  );

  useImperativeHandle(
    ref,
    () => ({
      getValue: () => currentValueRef.current,
      setValue: (value: string) => {
        currentValueRef.current = value;
        if (viewMode === "diff" && mergeViewRef.current) {
          const view = mergeViewRef.current.b;
          if (view.state.doc.toString() !== value) {
            view.dispatch({
              changes: { from: 0, to: view.state.doc.length, insert: value },
            });
          }
          return;
        }
        if (viewRef.current) {
          const view = viewRef.current;
          if (view.state.doc.toString() !== value) {
            view.dispatch({
              changes: { from: 0, to: view.state.doc.length, insert: value },
            });
          }
        }
      },
      focus: () => {
        if (viewMode === "diff" && mergeViewRef.current) {
          mergeViewRef.current.b.focus();
          return;
        }
        viewRef.current?.focus();
      },
    }),
    [viewMode]
  );

  useEffect(() => {
    if (viewMode !== "diff" || !mergeContainerRef.current) return;

    mergeContainerRef.current.innerHTML = "";
    mergeViewRef.current?.destroy();

    mergeViewRef.current = new MergeView({
      a: {
        doc: baseValue ?? "",
        extensions: [
          basicSetup,
          theme,
          ...extensions,
          EditorView.editable.of(false),
          EditorState.readOnly.of(true),
        ],
      },
      b: {
        doc: currentValueRef.current,
        extensions: [
          basicSetup,
          theme,
          ...extensions,
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              const nextValue = update.state.doc.toString();
              currentValueRef.current = nextValue;
              onChange?.(nextValue);
            }
          }),
        ],
      },
      parent: mergeContainerRef.current,
    });

    return () => {
      mergeViewRef.current?.destroy();
      mergeViewRef.current = null;
      if (mergeContainerRef.current) {
        mergeContainerRef.current.innerHTML = "";
      }
    };
  }, [viewMode, theme, extensions, onChange]);

  useEffect(() => {
    if (viewMode !== "diff" || !mergeViewRef.current) return;
    const view = mergeViewRef.current;
    const current = view.a.state.doc.toString();
    if (current !== (baseValue ?? "")) {
      view.a.dispatch({
        changes: { from: 0, to: view.a.state.doc.length, insert: baseValue ?? "" },
      });
    }
  }, [baseValue, viewMode]);

  useEffect(() => {
    if (viewMode !== "diff" || !mergeViewRef.current) return;
    const view = mergeViewRef.current;
    const current = view.b.state.doc.toString();
    if (current !== currentValueRef.current) {
      view.b.dispatch({
        changes: {
          from: 0,
          to: view.b.state.doc.length,
          insert: currentValueRef.current,
        },
      });
    }
  }, [viewMode]);

  return (
    <div className="w-full h-full border border-border rounded-md overflow-hidden font-mono text-sm max-h-screen overflow-y-auto flex flex-col">
      {(showSource || showDiff) && (
        <div className="flex items-center gap-2 border-b border-border bg-muted/50 px-3 py-2 text-[11px] font-semibold">
          {showSource && (
            <button
              type="button"
              onClick={() => setViewMode("source")}
              className={viewMode === "source" ? "text-foreground" : "text-muted-foreground"}
            >
              Source
            </button>
          )}
          {showDiff && (
            <button
              type="button"
              onClick={() => setViewMode("diff")}
              className={viewMode === "diff" ? "text-foreground" : "text-muted-foreground"}
            >
              Diff
            </button>
          )}
        </div>
      )}
      <div className="flex-1 min-h-0">
        {viewMode === "diff" ? (
          <div ref={mergeContainerRef} className="h-full" />
        ) : (
          <CodeMirror
            theme={theme}
            extensions={extensions}
            basicSetup={{
              lineNumbers: true,
              highlightActiveLineGutter: true,
              foldGutter: true,
            }}
            className="h-full"
            value={currentValueRef.current}
            onChange={handleSourceChange}
            onCreateEditor={(view) => {
              viewRef.current = view;
              const currentValue = currentValueRef.current;
              if (view.state.doc.toString() !== currentValue) {
                view.dispatch({
                  changes: {
                    from: 0,
                    to: view.state.doc.length,
                    insert: currentValue,
                  },
                });
              }
            }}
          />
        )}
      </div>
    </div>
  );
});

export default CodeMirrorEditor;
