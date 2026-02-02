"use client";

import { useTechStack } from "./TechStackContext";
import { 
  ChevronRight, 
  Layers, 
  Loader2, 
  Search,
  ExternalLink,
  Calendar,
  User as UserIcon,
  Tag
} from "lucide-react";
import Image from "next/image";
import { useState } from "react";
export default function TechStackManager() {
  const { 
    versions, 
    selectedVersion, 
    selectedData, 
    isLoading, 
    isLoadingDetails, 
    setSelectedVersion,
    hasSelectedDocUpdate,
    clearUpdateNotification,
    loadLatestSelectedData
  } = useTechStack();

  const [search, setSearch] = useState("");

  const filteredVersions = versions.filter(v => 
    v.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-80 border-r border-slate-200 bg-white flex flex-col">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-tight flex items-center gap-2">
              <Layers size={18} className="text-blue-600" />
              Versions
            </h2>
            <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">
              {filteredVersions.length} {search ? 'Found' : 'Available'}
            </span>
          </div>
          <div className="relative group">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
            <input 
              type="text" 
              placeholder="Search versions..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm h-10"
            />
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-slate-400">
               <Loader2 className="animate-spin" size={24} />
               <span className="text-xs font-medium">Loading versions...</span>
            </div>
          ) : filteredVersions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center text-slate-400">
              <span className="text-xs font-medium">No versions found matching &quot;{search}&quot;</span>
            </div>
          ) : (
            filteredVersions.map((version) => (
              <button 
                key={version}
                onClick={() => setSelectedVersion(version)}
                className={`w-full flex items-center justify-between px-4 py-3 text-sm font-semibold rounded-xl transition-all duration-200 group ${
                  selectedVersion === version 
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-200' 
                    : 'text-slate-600 hover:bg-slate-50 hover:text-blue-600'
                }`}
              >
                <div className="flex items-center gap-3">
                    <div className={`p-1.5 rounded-lg ${selectedVersion === version ? 'bg-blue-500' : 'bg-slate-100 group-hover:bg-blue-50'}`}>
                        <Tag size={14} className={selectedVersion === version ? 'text-white' : 'text-slate-500 group-hover:text-blue-600'} />
                    </div>
                    <span>{version}</span>
                </div>
                {selectedVersion === version ? (
                    <div className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                ) : (
                    <ChevronRight size={14} className="text-slate-300 group-hover:text-blue-500 transition-transform group-hover:translate-x-0.5" />
                )}
              </button>
            ))
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto bg-slate-50/30 relative">
        {/* Real-time Update Banner */}
        {hasSelectedDocUpdate && (
          <div className="sticky top-0 z-20 bg-blue-600 text-white px-6 py-3 flex items-center justify-between shadow-lg animate-in fade-in slide-in-from-top duration-500">
            <div className="flex items-center gap-3">
              <div className="h-2 w-2 rounded-full bg-white animate-pulse" />
              <p className="text-sm font-bold tracking-tight">
                Update available! A new version of {selectedVersion} has been synced from GitHub.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={clearUpdateNotification}
                className="px-3 py-1 text-xs font-bold text-blue-200 hover:text-white transition-colors"
              >
                DISMISS
              </button>
              <button 
                onClick={loadLatestSelectedData}
                className="px-4 py-1.5 bg-white text-blue-600 text-xs font-black rounded-lg shadow-sm hover:bg-blue-50 transition-all active:scale-95"
              >
                LOAD LATEST DATA
              </button>
            </div>
          </div>
        )}

        {!selectedVersion ? (
            <div className="h-full w-full flex flex-col items-center justify-center text-slate-400 p-8">
                <div className="w-16 h-16 bg-white rounded-3xl shadow-sm border border-slate-100 flex items-center justify-center mb-6">
                    <Layers size={32} className="text-slate-200" />
                </div>
                <h3 className="text-slate-900 font-bold text-xl mb-2">No Version Selected</h3>
                <p className="text-slate-500 max-w-sm text-center">Select a version from the sidebar to view historical tech stack data and environment configurations.</p>
            </div>
        ) : isLoadingDetails ? (
           <div className="h-full w-full flex flex-col items-center justify-center gap-4 p-8">
               <div className="relative">
                   <div className="h-16 w-16 rounded-full border-4 border-slate-100 border-t-blue-600 animate-spin" />
                   <Layers className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-blue-600" size={24} />
               </div>
               <div className="text-center">
                   <h3 className="font-bold text-slate-900">Fetching Details</h3>
                   <p className="text-sm text-slate-500">Retrieving data for version {selectedVersion}...</p>
               </div>
           </div>
        ) : (
          <div className="p-8 max-w-5xl mx-auto space-y-8">
            {/* Header / Info Panel */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-8 text-white relative">
                    <div className="absolute top-0 right-0 p-8 opacity-10">
                        <Layers size={120} />
                    </div>
                    <div className="relative z-10">
                        <div className="flex items-center gap-2 text-blue-100 mb-2 font-bold uppercase tracking-widest text-[10px]">
                            <span className="px-2 py-0.5 bg-white/20 rounded-md">Tech Stack Release</span>
                        </div>
                        <h1 className="text-3xl font-black mb-6 tracking-tight">Version <span className="underline decoration-blue-300/30">{selectedVersion}</span></h1>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                            <div className="flex items-start gap-3 bg-white/10 p-3 rounded-xl backdrop-blur-sm border border-white/10">
                                <Calendar size={18} className="mt-0.5 text-blue-200" />
                                <div>
                                    <p className="text-[10px] text-blue-200 font-bold uppercase">Updated At</p>
                                    <p className="text-sm font-bold">
                                        {selectedData?.last_update_timestamp ? new Date(selectedData.last_update_timestamp).toLocaleDateString('en-US', { dateStyle: 'long' }) : 'N/A'}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3 bg-white/10 p-3 rounded-xl backdrop-blur-sm border border-white/10">
                                <UserIcon size={18} className="mt-0.5 text-blue-200" />
                                <div>
                                    <p className="text-[10px] text-blue-200 font-bold uppercase">Author / Source</p>
                                    <p className="text-sm font-bold">{selectedData?.last_github_user || 'GitHub System'}</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3 bg-white/10 p-3 rounded-xl backdrop-blur-sm border border-white/10">
                                <div className="mt-0.5 h-4 w-4 rounded-full bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.5)]" />
                                <div>
                                    <p className="text-[10px] text-blue-200 font-bold uppercase">Status</p>
                                    <p className="text-sm font-bold capitalize">{selectedData?.status || 'Published'}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Data Contents */}
            <div className="space-y-6">
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                    Configuration Data
                    <div className="h-px flex-1 bg-slate-200 ml-2" />
                </h2>
                
                {selectedData?.data ? (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {Object.entries(selectedData.data).map(([key, value]: [string, any]) => (
                            <div key={key} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-all duration-300">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="font-black text-slate-900 capitalize tracking-tight flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-blue-500" />
                                        {key.replace(/_/g, ' ')}
                                    </h3>
                                    {/* Optional link badge if applicable */}
                                </div>
                                {Array.isArray(value) ? (
                                    <div className="space-y-3">
                                        {value.map((item, idx) => (
                                            <div key={idx} className="flex items-center justify-between group py-2 border-b border-slate-50 last:border-0">
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-bold text-slate-700">{item.name || item}</span>
                                                    {item.description && <span className="text-xs text-slate-500">{item.description}</span>}
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    {item.version && (
                                                        <span className="text-xs font-mono px-2 py-0.5 bg-slate-100 text-slate-600 rounded border border-slate-200">
                                                            v{item.version}
                                                        </span>
                                                    )}
                                                    {item.url && (
                                                        <a href={item.url} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg bg-slate-50 text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-all opacity-0 group-hover:opacity-100">
                                                            <ExternalLink size={14} />
                                                        </a>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : typeof value === 'object' ? (
                                    <div className="bg-slate-50 rounded-xl p-4 font-mono text-xs overflow-x-auto border border-slate-100">
                                        <pre className="text-slate-700">{JSON.stringify(value, null, 2)}</pre>
                                    </div>
                                ) : (
                                    <div className="bg-slate-50 rounded-xl p-4 text-sm font-medium text-slate-700 border border-slate-100">
                                        {String(value)}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="bg-white rounded-2xl border border-slate-200 border-dashed p-12 text-center">
                        <p className="text-slate-400 font-medium">No data payload found for this version.</p>
                    </div>
                )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
