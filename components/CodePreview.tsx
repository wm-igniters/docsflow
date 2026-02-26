"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as ReactDOM from "react-dom/client";

declare global {
  interface Window {
    React?: typeof React;
    ReactDOM?: typeof ReactDOM;
    __renderPreview?: () => void;
  }
}

type PreviewLanguage = "html" | "jsx" | "tsx";

interface CodePreviewProps {
  value: string;
  language: PreviewLanguage;
  className?: string;
}

const wrapHtmlDoc = (body: string) => `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <base target="_blank" />
    <style>
      html, body { margin: 0; padding: 0; font-family: system-ui, -apple-system, sans-serif; }
    </style>
  </head>
  <body>${body}</body>
</html>`;

const wrapJsxDoc = (compiled: string) => {
  const escaped = JSON.stringify(compiled);
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      html, body { margin: 0; padding: 0; font-family: system-ui, -apple-system, sans-serif; }
      #root { padding: 12px; }
      pre { white-space: pre-wrap; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
    </style>
  </head>
  <body>
    <div id="root"></div>
    <script>
      window.__renderPreview = () => {
        try {
          if (!window.React || !window.ReactDOM) {
            setTimeout(window.__renderPreview, 10);
            return;
          }
          const code = JSON.parse(${escaped});
          const module = { exports: {} };
          const exports = module.exports;
          const fn = new Function("React", "module", "exports", code);
          fn(window.React, module, exports);
          const App = module.exports.default || module.exports;
          const root = document.getElementById("root");
          if (!root) return;
          const element =
            window.React.isValidElement(App)
              ? App
              : typeof App === "function"
                ? window.React.createElement(App)
                : window.React.createElement("pre", null, "No default export found.");
          window.ReactDOM.createRoot(root).render(element);
        } catch (err) {
          const message = err && err.message ? err.message : String(err);
          document.body.innerHTML = "<pre>" + message + "</pre>";
        }
      };
      if (document.readyState === "complete") {
        window.__renderPreview();
      } else {
        window.addEventListener("DOMContentLoaded", () => window.__renderPreview());
      }
    </script>
  </body>
</html>`;
};

const renderErrorDoc = (message: string) =>
  wrapHtmlDoc(`<pre style="padding:12px; color:#b91c1c;">${message}</pre>`);

export const CodePreview = ({ value, language, className }: CodePreviewProps) => {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingValue, setPendingValue] = useState(value);
  const cacheRef = useRef(
    new Map<string, { srcdoc: string; compiled?: string }>()
  );

  const getCacheKey = useCallback(
    (source: string) => `${language}:${source}`,
    [language]
  );

  const readCache = useCallback(
    (key: string) => {
      const entry = cacheRef.current.get(key);
      if (!entry) return null;
      cacheRef.current.delete(key);
      cacheRef.current.set(key, entry);
      return entry;
    },
    []
  );

  const writeCache = useCallback((key: string, entry: { srcdoc: string; compiled?: string }) => {
    cacheRef.current.set(key, entry);
    if (cacheRef.current.size > 10) {
      const firstKey = cacheRef.current.keys().next().value;
      if (firstKey) cacheRef.current.delete(firstKey);
    }
  }, []);

  useEffect(() => {
    setPendingValue(value);
  }, [value]);

  const compileJsx = useCallback(async (source: string) => {
    const ts = await import("typescript");
    const result = ts.transpileModule(source, {
      compilerOptions: {
        jsx: ts.JsxEmit.React,
        jsxFactory: "React.createElement",
        jsxFragmentFactory: "React.Fragment",
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2017,
      },
    });
    return result.outputText;
  }, []);

  const updatePreview = useCallback(async () => {
    if (!iframeRef.current) return;
    try {
      setError(null);
      const cacheKey = getCacheKey(pendingValue);
      const cached = readCache(cacheKey);
      if (cached) {
        iframeRef.current.srcdoc = cached.srcdoc;
        const frameWindow = iframeRef.current.contentWindow;
        if (frameWindow) {
          frameWindow.React = React;
          frameWindow.ReactDOM = ReactDOM;
          frameWindow.__renderPreview?.();
        }
        return;
      }
      if (language === "html") {
        const srcdoc = wrapHtmlDoc(pendingValue);
        iframeRef.current.srcdoc = srcdoc;
        writeCache(cacheKey, { srcdoc });
        return;
      }
      const compiled = await compileJsx(pendingValue);
      const srcdoc = wrapJsxDoc(compiled);
      iframeRef.current.srcdoc = srcdoc;
      writeCache(cacheKey, { srcdoc, compiled });
      const frameWindow = iframeRef.current.contentWindow;
      if (frameWindow) {
        frameWindow.React = React;
        frameWindow.ReactDOM = ReactDOM;
        frameWindow.__renderPreview?.();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      iframeRef.current.srcdoc = renderErrorDoc(message);
    }
  }, [compileJsx, getCacheKey, language, pendingValue, readCache, writeCache]);

  useEffect(() => {
    const handle = setTimeout(() => {
      void updatePreview();
    }, 400);
    return () => clearTimeout(handle);
  }, [updatePreview]);

  return (
    <div className={className ?? "h-full"}>
      <iframe
        ref={iframeRef}
        title="Preview"
        className="h-full w-full border-0"
        sandbox="allow-scripts allow-same-origin"
      />
      {error && (
        <div className="sr-only" aria-live="polite">
          {error}
        </div>
      )}
    </div>
  );
};

export type { PreviewLanguage };
