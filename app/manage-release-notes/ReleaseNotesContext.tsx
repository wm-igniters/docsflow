"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { getReleaseNotesTree, getReleaseNoteContent, updateReleaseNote } from './actions';
import { DB_CONFIG, GITHUB_CONFIG } from '@/lib/config.mjs';

interface ReleaseNotesContextType {
  tree: any[];
  selectedPath: string | null;
  selectedContent: string;
  githubContent: string | null;
  docsflowContent: string | null;
  status: 'new' | 'modified' | 'published' | null;
  history: any[];
  isLoading: boolean;
  isLoadingContent: boolean;
  error: string | null;
  setSelectedPath: (path: string) => void;
  setContent: (content: string) => void;
  save: (contentOverride?: string) => Promise<boolean>;
  publish: () => Promise<void>;
  refreshTree: () => Promise<void>;
}

const ReleaseNotesContext = createContext<ReleaseNotesContextType | undefined>(undefined);

export function ReleaseNotesProvider({ children }: { children: React.ReactNode }) {
  const [tree, setTree] = useState<any[]>([]);
  const [selectedPath, setSelectedPathState] = useState<string | null>(null);
  const [selectedContent, setSelectedContent] = useState("");
  const [githubContent, setGithubContent] = useState<string | null>(null);
  const [docsflowContent, setDocsflowContent] = useState<string | null>(null);
  const [status, setStatus] = useState<'new' | 'modified' | 'published' | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    try {
      const doc = await getReleaseNoteContent(path);
      if (doc) {
        const docsflowData = doc.docsflow_data ?? null;
        const githubData = doc.github_data ?? null;
        setDocsflowContent(docsflowData);
        setGithubContent(githubData);
        setStatus(doc.status ?? null);
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
    setSelectedPathState(path);
    fetchContent(path);
  };

  const save = async (contentOverride?: string) => {
    if (!selectedPath) return false;
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
        setSelectedContent(contentToSave);
        alert("Draft saved successfully!");
        return true;
      } else {
        alert("Failed to save: " + result.error);
        return false;
      }
    } catch (err: any) {
      alert("Error saving: " + err.message);
      return false;
    }
  };

  const publish = async () => {
    alert("Publish functionality will be added later.");
  };

  // Initial Fetch
  useEffect(() => {
    fetchTree();
  }, [fetchTree]);

  // Real-time connection (SSE)
  useEffect(() => {
    let es: EventSource | null = null;
    const treeId = GITHUB_CONFIG.PATHS.RELEASE_NOTES;

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
             // In a real app, we'd show a notification or merge changes
             console.log("Remote update detected for current file");
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
  }, [fetchTree, selectedPath]);

  return (
    <ReleaseNotesContext.Provider value={{
      tree,
      selectedPath,
      selectedContent,
      githubContent,
      docsflowContent,
      status,
      history,
      isLoading,
      isLoadingContent,
      error,
      setSelectedPath,
      setContent: setSelectedContent,
      save,
      publish,
      refreshTree: fetchTree
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
