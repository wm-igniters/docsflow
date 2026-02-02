"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { getVersions, getVersionDetails } from './actions';
import { sortVersions } from '@/lib/utils/version';

interface TechStackContextType {
  versions: string[];
  selectedVersion: string | null;
  selectedData: any | null;
  isLoading: boolean;
  isLoadingDetails: boolean;
  error: string | null;
  setSelectedVersion: (version: string) => void;
  refreshVersions: () => Promise<void>;
  hasSelectedDocUpdate: boolean;
  clearUpdateNotification: () => void;
  loadLatestSelectedData: () => Promise<void>;
}

const TechStackContext = createContext<TechStackContextType | undefined>(undefined);

// Using a module-level variable to track if an SSE connection is already active
// This helps prevent duplicate listeners if the component remounts but remains in memory.
let globalEventSource: EventSource | null = null;

export function TechStackProvider({ children }: { children: React.ReactNode }) {
  const [versions, setVersions] = useState<string[]>([]);
  const [selectedVersion, setSelectedVersionState] = useState<string | null>(null);
  const [selectedData, setSelectedData] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Real-time states
  const [hasSelectedDocUpdate, setHasSelectedDocUpdate] = useState(false);
  const selectedVersionRef = useRef<string | null>(null);

  const fetchVersions = useCallback(async (isInitial = false) => {
    if (isInitial) setIsLoading(true);
    try {
      const rawVersions = await getVersions();
      const sorted = sortVersions(rawVersions, true);
      setVersions(sorted);
      
      if (sorted.length > 0 && !selectedVersionRef.current) {
        setSelectedVersion(sorted[0]);
      }
    } catch (err) {
      setError("Failed to load versions");
      console.error(err);
    } finally {
      if (isInitial) setIsLoading(false);
    }
  }, []);

  const fetchDetails = useCallback(async (version: string) => {
    setIsLoadingDetails(true);
    try {
      const details = await getVersionDetails(version);
      setSelectedData(details);
      setHasSelectedDocUpdate(false); // Reset update status when loading new/latest data
    } catch (err) {
      console.error(`Failed to load details for ${version}`, err);
    } finally {
      setIsLoadingDetails(false);
    }
  }, []);

  const setSelectedVersion = (version: string) => {
    setSelectedVersionState(version);
    selectedVersionRef.current = version;
    fetchDetails(version);
  };

  const loadLatestSelectedData = async () => {
    if (selectedVersion) {
      await fetchDetails(selectedVersion);
    }
  };

  const clearUpdateNotification = () => {
    setHasSelectedDocUpdate(false);
  };

  // Initial Fetch
  useEffect(() => {
    fetchVersions(true);
  }, [fetchVersions]);

  // Real-time connection (SSE)
  useEffect(() => {
    if (globalEventSource) return;

    console.log("Starting MongoDB Live Listener...");
    const es = new EventSource('/api/tech-stack/watch');
    globalEventSource = es;

    es.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log("Real-time Update:", data);

      if (data.type === 'connected') return;

      // Type of change: insert, update, replace, delete
      if (data.type === 'insert' || data.type === 'delete') {
         // Re-fetch versions list for schema-level changes
         fetchVersions(false);
      }

      if (data.type === 'update' || data.type === 'replace') {
        // If the updated document is the one we are currently viewing
        if (data.version === selectedVersionRef.current) {
          setHasSelectedDocUpdate(true);
        }
        
        // Also check if it's a new version that might need to be in the list
        fetchVersions(false);
      }
    };

    es.onerror = (err) => {
      console.error("SSE Connection failed:", err);
      es.close();
      globalEventSource = null;
    };

    return () => {
      // We don't close it on unmount if we want it to persist across navigation
      // but standard React behavior would be to close it here if the Provider unmounts.
      // If used in Layout, this mount/unmount happens only on login/logout or page change.
    };
  }, [fetchVersions]);

  return (
    <TechStackContext.Provider value={{
      versions,
      selectedVersion,
      selectedData,
      isLoading,
      isLoadingDetails,
      error,
      setSelectedVersion,
      refreshVersions: () => fetchVersions(false),
      hasSelectedDocUpdate,
      clearUpdateNotification,
      loadLatestSelectedData
    }}>
      {children}
    </TechStackContext.Provider>
  );
}

export function useTechStack() {
  const context = useContext(TechStackContext);
  if (context === undefined) {
    throw new Error('useTechStack must be used within a TechStackProvider');
  }
  return context;
}
