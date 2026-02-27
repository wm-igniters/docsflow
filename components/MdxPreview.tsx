"use client";

import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { decodeReactError } from "@/lib/mdx/decodeReactError";

type MdxComponents = Record<string, React.ComponentType<unknown>>;

interface MdxPreviewProps {
  value: string;
  components?: MdxComponents;
  className?: string;
  onClose?: () => void;
}

let runtimePromise: Promise<{
  evaluate: typeof import("@mdx-js/mdx")["evaluate"];
  remarkFrontmatter: typeof import("remark-frontmatter")["default"];
  remarkDirective: typeof import("remark-directive")["default"];
  remarkGfm: typeof import("remark-gfm")["default"];
  remarkComment: typeof import("remark-comment")["default"];
  remarkMath: typeof import("remark-math")["default"];
  prodRuntime: typeof import("react/jsx-runtime");
}> | null = null;

let consolePatched = false;
const renderingFrames = new Set<string>();

const ensureConsolePatched = () => {
  if (consolePatched) return;
  consolePatched = true;
  const originalError = console.error;
  const originalWarn = console.warn;
  
  // Filter out known React style prop errors during preview rendering
  console.error = (...args) => {
    if (renderingFrames.size > 0) {
      const message = String(args[0]);
      // Suppress React style prop and error boundary errors during preview
      if (
        message.includes('The `style` prop expects a mapping') ||
        message.includes('The above error occurred in the') ||
        message.includes('React will try to recreate this component tree')
      ) {
        return;
      }
    }
    originalError(...args);
  };
  
  console.warn = (...args) => {
    if (renderingFrames.size > 0) return;
    originalWarn(...args);
  };
};

class PreviewErrorBoundary extends React.Component<
  { onError: (error: Error) => void; children?: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    const decoded = decodeReactError(error.message);
    this.props.onError(new Error(decoded));
  }

  render() {
    return this.state.hasError ? null : this.props.children;
  }
}

const getRuntime = () => {
  if (!runtimePromise) {
    runtimePromise = Promise.all([
      import("@mdx-js/mdx"),
      import("remark-frontmatter"),
      import("remark-directive"),
      import("remark-gfm"),
      import("remark-comment"),
      import("remark-math"),
      import("react/jsx-runtime"),
    ]).then(
      ([
        mdx,
        remarkFrontmatter,
        remarkDirective,
        remarkGfm,
        remarkComment,
        remarkMath,
        prodRuntime,
      ]) => ({
        evaluate: mdx.evaluate,
        remarkFrontmatter: remarkFrontmatter.default,
        remarkDirective: remarkDirective.default,
        remarkGfm: remarkGfm.default,
        remarkComment: remarkComment.default,
        remarkMath: remarkMath.default,
        prodRuntime,
      })
    );
  }
  return runtimePromise;
};

export const MdxPreview = ({
  value,
  components,
  className,
  onClose,
}: MdxPreviewProps) => {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const rootRef = useRef<import("react-dom/client").Root | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingValue, setPendingValue] = useState(value);
  const [isOpen, setIsOpen] = useState(true);
  const titleId = useId();
  const frameId = useId();

  useEffect(() => {
    setPendingValue(value);
  }, [value]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
        onClose?.();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const iframeSrcDoc = useMemo(
    () => `<!DOCTYPE html>
<html lang="en" data-theme="light">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <base href="/" />
    <link rel="stylesheet" href="/docs-preview.css" />
    <style>
      html, body { height: 100%; margin: 0; }
      body { background: var(--ifm-background-color); color: var(--ifm-font-color-base); }
      #mdx-root { box-sizing: border-box; padding: 16px; min-height: 100%; }
    </style>
  </head>
  <body>
    <div id="mdx-root" class="markdown"></div>
  </body>
</html>`,
    []
  );

  const ensureFrameRoot = useCallback(async () => {
    const iframe = iframeRef.current;
    const doc = iframe?.contentDocument;
    const mountNode = doc?.getElementById("mdx-root");
    if (!mountNode) return null;
    if (!rootRef.current) {
      const { createRoot } = await import("react-dom/client");
      rootRef.current = createRoot(mountNode);
    }
    return rootRef.current;
  }, []);

  const renderPreview = useCallback(async () => {
    try {
      setError(null);
      const root = await ensureFrameRoot();
      if (!root) return;
      const {
        evaluate,
        remarkFrontmatter,
        remarkDirective,
        remarkGfm,
        remarkComment,
        remarkMath,
        prodRuntime,
      } = await getRuntime();
      const { default: Content } = await evaluate(pendingValue, {
        development: false,
        ...prodRuntime,
        baseUrl: import.meta.url,
        remarkPlugins: [
          [remarkFrontmatter, ["yaml", "toml"]],
          remarkDirective,
          remarkGfm,
          remarkComment,
          remarkMath,
        ],
      });

      ensureConsolePatched();
      renderingFrames.add(frameId);
      root.render(
        React.createElement(
          PreviewErrorBoundary,
          { onError: (error) => setError(error.message) },
          React.createElement(Content, { components })
        )
      );
      // Clear after render cycle completes
      setTimeout(() => {
        renderingFrames.delete(frameId);
      }, 200);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(decodeReactError(message));
      const root = await ensureFrameRoot();
      if (root) {
        root.render(
          React.createElement(
            "pre",
            { style: { color: "#b91c1c", fontSize: "12px", whiteSpace: "pre-wrap" } },
            message
          )
        );
      }
    }
  }, [components, ensureFrameRoot, pendingValue, frameId]);

  useEffect(() => {
    if (!isOpen) return;
    void renderPreview();
  }, [isOpen, renderPreview]);

  useEffect(() => {
    if (!error) return;
    const renderError = async () => {
      const root = await ensureFrameRoot();
      if (root) {
        root.render(
          React.createElement(
            "pre",
            { style: { color: "#b91c1c", fontSize: "12px", whiteSpace: "pre-wrap" } },
            error
          )
        );
      }
    };
    void renderError();
  }, [error, ensureFrameRoot]);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const handleLoad = () => {
      void renderPreview();
    };
    iframe.addEventListener("load", handleLoad);
    if (iframe.contentDocument?.readyState === "complete") {
      void renderPreview();
    }
    return () => {
      iframe.removeEventListener("load", handleLoad);
    };
  }, [renderPreview]);

  useEffect(() => {
    const handle = setTimeout(() => {
      void renderPreview();
    }, 400);
    return () => clearTimeout(handle);
  }, [renderPreview]);

  useEffect(() => {
    return () => {
      const root = rootRef.current;
      rootRef.current = null;
      if (root) {
        setTimeout(() => {
          root.unmount();
        }, 0);
      }
    };
  }, []);

  const containerClass = useMemo(
    () => className ?? "h-full w-full overflow-hidden bg-background text-foreground",
    [className]
  );

  return (
    <div className={containerClass}>
      {!isOpen && (
        <button
          type="button"
          className="inline-flex items-center rounded-md border border-input bg-background px-3 py-2 text-xs font-semibold uppercase tracking-wide text-foreground shadow-xs transition hover:bg-accent hover:text-accent-foreground"
          onClick={() => setIsOpen(true)}
        >
          Open preview
        </button>
      )}
      <div
        className={`fixed inset-0 z-50 flex items-center justify-center transition-opacity ${
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        aria-hidden={!isOpen}
      >
        <button
          type="button"
          aria-label="Close preview"
          className="absolute inset-0 bg-black/60"
          onClick={() => {
            setIsOpen(false);
            onClose?.();
          }}
          disabled={!isOpen}
        />
        <div
          role="dialog"
          aria-modal={isOpen}
          aria-labelledby={titleId}
          className="relative z-10 flex h-[min(90vh,900px)] w-[min(92vw,1200px)] flex-col overflow-hidden rounded-xl border border-border bg-background text-foreground shadow-2xl"
        >
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 id={titleId} className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
              Preview
            </h2>
            <button
              type="button"
              className="inline-flex items-center rounded-md border border-input bg-background px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-foreground shadow-xs transition hover:bg-accent hover:text-accent-foreground"
              onClick={() => {
                setIsOpen(false);
                onClose?.();
              }}
            >
              Close
            </button>
          </div>
          <div className="flex-1 bg-background">
            <iframe
              ref={iframeRef}
              title="MDX preview"
              className="h-full w-full border-0"
              sandbox="allow-same-origin allow-scripts"
              srcDoc={iframeSrcDoc}
            />
          </div>
        </div>
      </div>
      {error && (
        <div className="sr-only" aria-live="polite">
          {error}
        </div>
      )}
    </div>
  );
};
