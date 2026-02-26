import { linter, lintGutter, Diagnostic } from "@codemirror/lint";
import { EditorView } from "@codemirror/view";
import { StateField, StateEffect } from "@codemirror/state";

/**
 * Error extension for CodeMirror that displays validation errors.
 * 
 * This extension uses CodeMirror's built-in lint system for visual display
 * (red dots in gutter, squiggly underlines, hover tooltips), but the actual
 * parsing and error detection is done by our custom validation logic
 * (e.g., lib/mdx/validateMdx.ts for MDX files).
 * 
 * Usage:
 * 1. Include errorExtension() in your CodeMirror extensions
 * 2. When your parser detects an error, dispatch setError() with line/column/message
 * 3. CodeMirror will display the error visually
 */

export interface ErrorInfo {
  line: number;
  column?: number;
  message: string;
}

// State effect to set error externally
const setErrorEffect = StateEffect.define<ErrorInfo | null>();

// State field to store the current error
const errorField = StateField.define<ErrorInfo | null>({
  create: () => null,
  update(value, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setErrorEffect)) {
        return effect.value;
      }
    }
    return value;
  },
});

// Linter that reads from the error state field
// Note: This doesn't do any parsing - it just displays errors
// that were detected by external validation logic
const errorLinter = linter((view) => {
  const error = view.state.field(errorField, false);
  console.log('[errorLinter] Running linter, error:', error);
  
  if (!error || typeof error.line !== "number") {
    return [];
  }

  const lineNumber = error.line;
  if (lineNumber < 1 || lineNumber > view.state.doc.lines) {
    console.log('[errorLinter] Line number out of range:', lineNumber, 'total lines:', view.state.doc.lines);
    return [];
  }

  const line = view.state.doc.line(lineNumber);
  const column = error.column ?? 1;
  const from = line.from + Math.max(0, column - 1);
  const to = Math.min(line.to, Math.max(from + 1, line.to));

  const diagnostic: Diagnostic = {
    from,
    to,
    severity: "error",
    message: error.message,
  };

  console.log('[errorLinter] Returning diagnostic:', diagnostic);
  return [diagnostic];
}, {
  // Force linter to update when error state changes
  needsRefresh: (update) => {
    const needsRefresh = update.transactions.some(tr => 
      tr.effects.some(e => e.is(setErrorEffect))
    );
    if (needsRefresh) {
      console.log('[errorLinter] Needs refresh due to setError effect');
    }
    return needsRefresh;
  }
});



// Custom theme for error styling
const errorTheme = EditorView.baseTheme({
  ".cm-diagnostic-error": {
    borderBottom: "2px wavy #f87171",
  },
  ".cm-lintRange-error": {
    backgroundImage: "none",
    textDecoration: "underline wavy #f87171",
    textDecorationSkipInk: "none",
  },
  // Line background tint (gutter to edge)
  ".cm-line.cm-diagnostic-error": {
    backgroundColor: "rgba(239, 68, 68, 0.08)",
  },
  // Tooltip container styling (both gutter and hover)
  ".cm-tooltip.cm-tooltip-lint, .cm-tooltip.cm-tooltip-hover": {
    maxWidth: "380px !important",
    borderRadius: "8px !important",
    boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1) !important",
    padding: "0 !important",
    overflowWrap: "break-word",
    whiteSpace: "pre-wrap",
  },
  ".cm-tooltip-lint, .cm-tooltip-hover": {
    maxWidth: "380px !important",
    borderRadius: "8px !important",
  },
  // Diagnostic message with accent bar
  ".cm-tooltip-lint .cm-diagnostic, .cm-tooltip-hover .cm-diagnostic": {
    maxWidth: "380px",
    overflowWrap: "break-word",
    whiteSpace: "pre-wrap",
    borderLeft: "4px solid #EF4444",
    padding: "10px 14px",
    margin: "0",
    fontSize: "13px",
  },
  ".cm-diagnostic-error .cm-diagnosticText": {
    maxWidth: "380px",
    overflowWrap: "break-word",
    whiteSpace: "pre-wrap",
  },
  // Light mode styles
  "&light .cm-tooltip.cm-tooltip-lint, &light .cm-tooltip.cm-tooltip-hover": {
    backgroundColor: "#FFFFFF !important",
    border: "1px solid #FEE2E2 !important",
  },
  "&light .cm-tooltip-lint .cm-diagnostic, &light .cm-tooltip-hover .cm-diagnostic": {
    color: "#374151 !important",
  },
  "&light .cm-diagnostic-error": {
    borderBottomColor: "#dc2626",
  },
  "&light .cm-lintRange-error": {
    textDecorationColor: "#dc2626",
  },
  "&light .cm-line.cm-diagnostic-error": {
    backgroundColor: "rgba(239, 68, 68, 0.08)",
  },
  // Dark mode styles
  "&dark .cm-tooltip.cm-tooltip-lint, &dark .cm-tooltip.cm-tooltip-hover": {
    backgroundColor: "#111827 !important",
    border: "1px solid #7F1D1D !important",
  },
  "&dark .cm-tooltip-lint .cm-diagnostic, &dark .cm-tooltip-hover .cm-diagnostic": {
    color: "#D1D5DB !important",
    borderLeftColor: "#DC2626",
  },
  "&dark .cm-diagnostic-error": {
    borderBottomColor: "#f87171",
  },
  "&dark .cm-lintRange-error": {
    textDecorationColor: "#f87171",
  },
  "&dark .cm-line.cm-diagnostic-error": {
    backgroundColor: "rgba(239, 68, 68, 0.12)",
  },
});

export function errorExtension() {
  return [errorField, errorLinter, lintGutter(), errorTheme];
}

export function setError(error: ErrorInfo | null) {
  return setErrorEffect.of(error);
}
