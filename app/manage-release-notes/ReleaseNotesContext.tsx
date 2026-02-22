"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getReleaseNotesTree, getReleaseNoteContent, updateReleaseNote } from './actions';
import { performMerge } from '@/lib/utils/diff3';
import { DB_CONFIG, GITHUB_CONFIG } from '@/lib/config.mjs';
import { toast } from "sonner";

interface ReleaseNotesContextType {
  tree: any[];
  selectedPath: string | null;
  selectedContent: string;
  githubContent: string | null;
  docsflowContent: string | null;
  status: 'new' | 'modified' | 'published' | null;
  lastUpdatedBy: string | null;
  lastUpdatedAt: Date | string | null;
  history: any[];
  isLoading: boolean;
  isLoadingContent: boolean;
  isPublishing: boolean;
  error: string | null;
  incomingUpdate: string | null;
  setSelectedPath: (path: string) => void;
  setContent: (content: string) => void;
  save: (contentOverride?: string) => Promise<boolean>;
  publish: () => Promise<void>;
  refreshTree: () => Promise<void>;
  resolveIncomingUpdate: (newDocsflowData: string, newSelectedContent: string) => void;
}

const ReleaseNotesContext = createContext<ReleaseNotesContextType | undefined>(undefined);

export function ReleaseNotesProvider({ children }: { children: React.ReactNode }) {
  const [tree, setTree] = useState<any[]>([]);
  const [selectedPath, setSelectedPathState] = useState<string | null>(null);
  const [selectedContent, setSelectedContent] = useState("");
  const [githubContent, setGithubContent] = useState<string | null>(null);
  const [docsflowContent, setDocsflowContent] = useState<string | null>(null);
  const [status, setStatus] = useState<'new' | 'modified' | 'published' | null>(null);
  const [lastUpdatedBy, setLastUpdatedBy] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | string | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [incomingUpdate, setIncomingUpdate] = useState<string | null>(null);
  const [incomingUpdateMeta, setIncomingUpdateMeta] = useState<{
    last_updated_by?: string | null;
    last_update_timestamp?: Date | string | null;
  } | null>(null);

  const fetchTree = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getReleaseNotesTree();
      if (data && data.tree) {
        setTree(data.tree);
      }
    } catch (err) {
      setError("Failed to load release notes tree");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchContent = useCallback(async (path: string) => {
    setIsLoadingContent(true);
    setIncomingUpdate(null);
    try {
      const doc = await getReleaseNoteContent(path);
      if (doc) {
        const docsflowData = doc.docsflow_data ?? null;
        const githubData = doc.github_data ?? null;
        setDocsflowContent(docsflowData);
        setGithubContent(githubData);
        setStatus(doc.status ?? null);
        setLastUpdatedBy(doc.last_updated_by ?? null);
        setLastUpdatedAt(doc.last_update_timestamp ?? null);
        setSelectedContent(
          docsflowData !== null && docsflowData !== undefined
            ? docsflowData
            : (githubData ?? "")
        );
        setHistory(doc.history || []);
      }
    } catch (err) {
      console.error(`Failed to load content for ${path}`, err);
    } finally {
      setIsLoadingContent(false);
    }
  }, []);

  const setSelectedPath = (path: string) => {
    if (path !== selectedPath) {
      setSelectedPathState(path);
      fetchContent(path);
    }
  };

  const save = async (contentOverride?: string) => {
    if (!selectedPath) return false;
    if (incomingUpdate !== null) {
      toast.error("Please merge upstream changes before saving.");
      return false;
    }
    const contentToSave = contentOverride ?? selectedContent;
    try {
      const result = await updateReleaseNote(selectedPath, contentToSave);
      if (result.success) {
        setHistory(result.doc.history || []);
        if (result.doc?.docsflow_data !== undefined) {
          setDocsflowContent(result.doc.docsflow_data ?? null);
        } else {
          setDocsflowContent(contentToSave);
        }
        setStatus(result.doc?.status ?? 'modified');
        setLastUpdatedBy(result.doc?.last_updated_by ?? null);
        setLastUpdatedAt(result.doc?.last_update_timestamp ?? null);
        setSelectedContent(contentToSave);
        toast.success("Draft saved successfully!");
        return true;
      } else {
        toast.error("Failed to save: " + result.error);
        return false;
      }
    } catch (err: any) {
      toast.error("Error saving: " + err.message);
      return false;
    }
  };

  const publish = async () => {
    if (!selectedPath) return;
    if (incomingUpdate !== null) {
      toast.error("Please merge upstream changes before publishing.");
      return;
    }
    if (isPublishing) return;
    setIsPublishing(true);
    try {
      const response = await fetch("/api/github/publish/release-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ docId: selectedPath }),
      });
      const result = await response.json();

      if (response.ok) {
        toast.success("Successfully created PR!");
        if (result.pr_url) {
          window.open(result.pr_url, "_blank");
        }
        await fetchContent(selectedPath);
      } else {
        toast.error(`Failed to publish: ${result.error || "Unknown error"}`);
      }
    } catch (err: any) {
      toast.error("An error occurred while publishing to GitHub.");
      console.error("Publish error:", err);
    } finally {
      setIsPublishing(false);
    }
  };

  const resolveIncomingUpdate = (newDocsflowData: string, newSelectedContent: string) => {
    setDocsflowContent(newDocsflowData);
    setLastUpdatedBy(incomingUpdateMeta?.last_updated_by ?? lastUpdatedBy ?? null);
    setLastUpdatedAt(incomingUpdateMeta?.last_update_timestamp ?? lastUpdatedAt ?? null);
    setSelectedContent(newSelectedContent);
    setIncomingUpdate(null);
    setIncomingUpdateMeta(null);
  };

  // Initial Fetch
  useEffect(() => {
    fetchTree();
  }, [fetchTree]);

  // Real-time connection (SSE)
  useEffect(() => {
    let es: EventSource | null = null;
    const treeId = GITHUB_CONFIG.PATHS.RELEASE_NOTES;
    const isDirty =
      selectedContent !== "" &&
      docsflowContent !== null &&
      selectedContent !== docsflowContent;

    const connect = () => {
      console.log("SSE: Connecting to Release Notes Live Listener...");
      const params = new URLSearchParams({
        docCollection: DB_CONFIG.COLLECTIONS.RELEASE_NOTES,
        treeId,
      });
      if (selectedPath) {
        params.set('docId', selectedPath);
      }
      es = new EventSource(`/api/docs/watch?${params.toString()}`);

      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'connected') return;

          if (data.stream === 'doc' && data.path === selectedPath) {
             console.log("Remote update detected for current file");
             if (!selectedPath) return;
             
             // Fetch the latest document from the DB safely without clobbering state immediately
             getReleaseNoteContent(selectedPath).then((doc) => {
               if (!doc) return;
               
               const remoteDocsflowData = doc.docsflow_data ?? "";
               const baseDocsflowData = docsflowContent ?? "";
               const myCurrentData = selectedContent;
               
               // If nothing actually changed (maybe I triggered the update), ignore
               if (remoteDocsflowData === baseDocsflowData) return;
               
               console.log("Remote update detected, setting incomingUpdate");
               setIncomingUpdate(remoteDocsflowData);
               setIncomingUpdateMeta({
                 last_updated_by: doc.last_updated_by ?? null,
                 last_update_timestamp: doc.last_update_timestamp ?? null,
               });
             }).catch(err => {
               console.error("Failed to fetch doc update for live sync", err);
             });
          }
          
          if (
            data.stream === 'tree' ||
            data.type === 'insert' ||
            data.type === 'delete'
          ) {
             fetchTree();
          }
        } catch (e) {
          console.error("SSE: Failed to parse message", e);
        }
      };
    };

    connect();

    return () => {
      if (es) es.close();
    };
  }, [fetchTree, fetchContent, selectedPath, selectedContent, docsflowContent]);

  return (
    <ReleaseNotesContext.Provider value={{
      tree,
      selectedPath,
      selectedContent,
      githubContent,
      docsflowContent,
      status,
      lastUpdatedBy,
      lastUpdatedAt,
      history,
      isLoading,
      isLoadingContent,
      isPublishing,
      error,
      incomingUpdate,
      setSelectedPath,
      setContent: setSelectedContent,
      save,
      publish,
      refreshTree: fetchTree,
      resolveIncomingUpdate
    }}>
      {children}
    </ReleaseNotesContext.Provider>
  );
}

export function useReleaseNotes() {
  const context = useContext(ReleaseNotesContext);
  if (context === undefined) {
    throw new Error('useReleaseNotes must be used within a ReleaseNotesProvider');
  }
  return context;
}
