"use client";

import { useReleaseNotes } from "./ReleaseNotesContext";
import EditorPage from "@/components/EditorPage";
import { Loader2 } from "lucide-react";

export default function ReleaseNotesManager() {
  const { 
    tree, 
    selectedPath, 
    selectedContent, 
    githubContent,
    docsflowContent,
    status,
    history, 
    isLoading, 
    isLoadingContent,
    setSelectedPath,
    save,
    publish
  } = useReleaseNotes();

  if (isLoading && tree.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-50/30">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
          <p className="text-sm font-black uppercase tracking-widest text-slate-400">Initializing Workspace...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 overflow-hidden flex">
      <EditorPage 
        title="Release Notes Manager"
        tree={tree}
        selectedPath={selectedPath}
        onItemClick={setSelectedPath}
        content={selectedContent}
        githubContent={githubContent}
        docsflowContent={docsflowContent}
        status={status}
        onSave={save}
        onPublish={publish}
        history={history}
        isLoading={isLoadingContent}
      />
    </div>
  );
}
