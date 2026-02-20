"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { getReleaseNotesTree, getReleaseNoteContent, updateReleaseNote } from './actions';

interface ReleaseNotesContextType {
  tree: any[];
  selectedPath: string | null;
  selectedContent: string;
  history: any[];
  isLoading: boolean;
  isLoadingContent: boolean;
  error: string | null;
  setSelectedPath: (path: string) => void;
  setContent: (content: string) => void;
  save: () => Promise<void>;
  publish: () => Promise<void>;
  refreshTree: () => Promise<void>;
}

const ReleaseNotesContext = createContext<ReleaseNotesContextType | undefined>(undefined);

export function ReleaseNotesProvider({ children }: { children: React.ReactNode }) {
  const [tree, setTree] = useState<any[]>([]);
  const [selectedPath, setSelectedPathState] = useState<string | null>(null);
  const [selectedContent, setSelectedContent] = useState("");
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
        setSelectedContent(doc.docsflow_data || doc.github_data || "");
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

  const save = async () => {
    if (!selectedPath) return;
    try {
      const result = await updateReleaseNote(selectedPath, selectedContent);
      if (result.success) {
        setHistory(result.doc.history || []);
        alert("Draft saved successfully!");
      } else {
        alert("Failed to save: " + result.error);
      }
    } catch (err: any) {
      alert("Error saving: " + err.message);
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

    const connect = () => {
      console.log("SSE: Connecting to Release Notes Live Listener...");
      es = new EventSource('/api/release-notes/watch');

      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'connected') return;

          if (data.path === selectedPath) {
             // In a real app, we'd show a notification or merge changes
             console.log("Remote update detected for current file");
          }
          
          if (data.type === 'insert' || data.type === 'delete') {
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
