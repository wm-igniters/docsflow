"use client";

import React, { useCallback, useMemo, useState } from "react";
import { CodeMirrorEditor } from "@/components/CodeMirrorEditor";

interface SvgEditorProps {
  initialValue?: string;
  baseValue?: string;
  onChange?: (value: string) => void;
}

export default function SvgEditor({
  initialValue = "",
  baseValue = "",
  onChange,
}: SvgEditorProps) {
  const looksBase64 = (value: string) => {
    if (!value) return false;
    if (value.startsWith("data:")) return false;
    if (value.length % 4 !== 0) return false;
    if (/\s/.test(value)) return false;
    return /^[A-Za-z0-9+/=]+$/.test(value);
  };

  const decodeSvg = (value: string) => {
    if (!value) return "";
    if (value.startsWith("data:")) {
      const base64Marker = ";base64,";
      const base64Index = value.indexOf(base64Marker);
      if (base64Index !== -1) {
        const encoded = value.slice(base64Index + base64Marker.length);
        try {
          return atob(encoded);
        } catch {
          return value;
        }
      }
      const commaIndex = value.indexOf(",");
      if (commaIndex !== -1) {
        return decodeURIComponent(value.slice(commaIndex + 1));
      }
      return value;
    }
    if (looksBase64(value)) {
      try {
        return atob(value);
      } catch {
        return value;
      }
    }
    return value;
  };

  const initialSvg = useMemo(() => decodeSvg(initialValue), [initialValue]);
  const [value, setValue] = useState(initialSvg);

  const handleChange = useCallback(
    (nextValue: string) => {
      setValue(nextValue);
      onChange?.(nextValue);
    },
    [onChange]
  );

  return (
    <div className="h-full w-full flex flex-col">
      <div className="px-4 py-3 text-[11px] font-semibold text-muted-foreground border-b bg-muted/40">
        SVG editing uses code view with a live preview.
      </div>
      <div className="flex-1 min-h-0 grid grid-cols-2 gap-0">
        <div className="min-w-0 border-r">
          <CodeMirrorEditor
            initialValue={value}
            baseValue={baseValue}
            onChange={handleChange}
            fileExtension="svg"
            showDiff
            showSource
          />
        </div>
        <div className="min-w-0 bg-background flex items-center justify-center p-4">
          <div
            className="w-full h-full flex items-center justify-center"
            aria-label="SVG preview"
            dangerouslySetInnerHTML={{ __html: value }}
          />
        </div>
      </div>
    </div>
  );
}
