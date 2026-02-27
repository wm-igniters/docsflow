"use client";

import React from "react";
import { decodeReactError } from "@/lib/mdx/decodeReactError";

type ValidationResult =
  | { ok: true }
  | {
      ok: false;
      message: string;
      line?: number;
      column?: number;
      lineText?: string;
    };

type MdxComponents = Record<string, React.ComponentType<unknown>>;
type MdxComponent = React.ComponentType<{ components?: MdxComponents }>;

type ValidateOptions = {
  render?: boolean;
  components?: MdxComponents;
};

let runtimePromise: Promise<{
  evaluate: typeof import("@mdx-js/mdx")["evaluate"];
  remarkFrontmatter: typeof import("remark-frontmatter")["default"];
  remarkDirective: typeof import("remark-directive")["default"];
  remarkGfm: typeof import("remark-gfm")["default"];
  remarkComment: typeof import("remark-comment")["default"];
  remarkMath: typeof import("remark-math")["default"];
  prodRuntime: typeof import("react/jsx-runtime");
}> | null = null;

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

const extractLineColumn = (err: unknown) => {
  if (!err || typeof err !== "object") return { line: undefined, column: undefined };
  const asAny = err as {
    line?: number;
    column?: number;
    position?: { start?: { line?: number; column?: number } };
  };
  const line =
    typeof asAny.line === "number" ? asAny.line : asAny.position?.start?.line;
  const column =
    typeof asAny.column === "number"
      ? asAny.column
      : asAny.position?.start?.column;
  return { line, column };
};

class ValidationErrorBoundary extends React.Component<
  { onError: (error: Error) => void; children?: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    this.props.onError(error);
  }

  render() {
    return this.state.hasError ? null : this.props.children;
  }
}

const renderForValidation = async (
  Component: MdxComponent,
  components?: MdxComponents
): Promise<string | null> => {
  const [{ createRoot }, { flushSync }] = await Promise.all([
    import("react-dom/client"),
    import("react-dom"),
  ]);
  const container = document.createElement("div");
  container.style.cssText = "position:fixed;left:-10000px;top:-10000px;width:1px;height:1px;overflow:hidden;";
  document.body.appendChild(container);

  const originalConsoleError = console.error;
  const errors: string[] = [];
  console.error = (...args) => {
    errors.push(
      args
        .map((arg) => {
          if (typeof arg === "string") return arg;
          if (arg instanceof Error) return arg.message;
          return String(arg);
        })
        .join(" ")
    );
  };

  const root = createRoot(container);
  let renderError: unknown = null;
  try {
    flushSync(() => {
      root.render(
        React.createElement(
          ValidationErrorBoundary,
          {
            onError: (error) => {
              renderError = error;
            },
          },
          React.createElement(Component, { components })
        )
      );
    });
  } finally {
    console.error = originalConsoleError;
    root.unmount();
    container.remove();
  }

  if (renderError instanceof Error) {
    return decodeReactError(renderError.message);
  }
  if (typeof renderError === "string") {
    return decodeReactError(renderError);
  }
  if (errors.length > 0) {
    return decodeReactError(errors[0]);
  }
  return null;
};

export const validateMdxSource = async (
  source: string,
  options: ValidateOptions = {}
): Promise<ValidationResult> => {
  try {
    const {
      evaluate,
      remarkFrontmatter,
      remarkDirective,
      remarkGfm,
      remarkComment,
      remarkMath,
      prodRuntime,
    } = await getRuntime();
    const shouldRender = Boolean(options.render);

    if (shouldRender) {
      const { default: Content } = await evaluate(source, {
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

      const renderError = await renderForValidation(Content, options.components);
      if (renderError) {
        return { ok: false, message: renderError };
      }
    }

    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const decoded = decodeReactError(message);
    const { line, column } = extractLineColumn(err);
    const lineText =
      typeof line === "number" ? source.split(/\r?\n/)[line - 1] : undefined;
    return { ok: false, message: decoded, line, column, lineText };
  }
};

export type { ValidationResult, ValidateOptions };
