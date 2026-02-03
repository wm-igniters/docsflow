"use client";

import { useTechStack } from "./TechStackContext";
import { updateDocsFlowData } from "./actions";
import { 
  ChevronRight, 
  Layers, 
  Loader2, 
  Search,
  ExternalLink,
  Calendar,
  User as UserIcon,
  Plus,
  Trash2,
  Save,
  Send,
  X,
  Check,
  ChevronDown,
  LayoutGrid,
  Type,
  Link as LinkIcon,
  PlusCircle,
  GripVertical,
  Tag,
  AlertTriangle,
  CheckCircle2,
  Download,
  Info,
  User
} from "lucide-react";
import Image from "next/image";
import { useState, useEffect } from "react";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragOverlay } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const CONFIG = {
  enableAddSubSection: false, 
  enableAddCategory: false,
  enableDeleteCategory: false,
  enableDeleteSubSection: false,
  enableDeleteSubCategory: true
};
// --- Editor Sub-components ---

// --- Editor Sub-components ---

// --- Editor Sub-components ---

function EditorNode({ 
  node, 
  onUpdate, 
  path, 
  originalGithubNode, 
  originalDocsFlowNode 
}: { 
  node: any, 
  onUpdate: (val: any) => void, 
  path: string[], 
  originalGithubNode?: any, 
  originalDocsFlowNode?: any 
}) {
  if (Array.isArray(node)) {
    return (
      <ArrayEditor 
        items={node} 
        onUpdate={onUpdate} 
        path={path} 
        originalGithubItems={originalGithubNode} 
        originalDocsFlowItems={originalDocsFlowNode} 
      />
    );
  } else if (typeof node === 'object' && node !== null) {
    return (
      <SubSectionEditor 
        data={node} 
        onUpdate={onUpdate} 
        path={path} 
        originalGithubData={originalGithubNode} 
        originalDocsFlowData={originalDocsFlowNode} 
      />
    );
  } else {
    // Fallback for primitives
    return (
      <div className="p-4 bg-red-50 text-red-500 rounded-lg text-xs">
        Unsupported data type
      </div>
    );
  }
}

function CollapsibleBlock({ 
  title, 
  children, 
  onDelete,
  defaultOpen = true,
  isLeaf = false
}: { 
  title: string, 
  children: React.ReactNode, 
  onDelete?: () => void,
  defaultOpen?: boolean,
  isLeaf?: boolean
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className={`group/block border border-slate-200 bg-white rounded-xl overflow-hidden transition-all duration-300 ${isOpen ? 'shadow-sm ring-1 ring-slate-200' : 'hover:border-blue-300'}`}>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between p-4 cursor-pointer bg-slate-50/50 hover:bg-slate-50 transition-colors select-none"
      >
        <div className="flex items-center gap-3">
          <div className={`p-1 rounded-md transition-transform duration-300 ${isOpen ? 'rotate-90 text-blue-600 bg-blue-50' : 'text-slate-400'}`}>
            <ChevronRight size={14} />
          </div>
          <span className={`text-sm font-bold uppercase tracking-tight ${isOpen ? 'text-blue-700' : 'text-slate-600'}`}>
            {title.replace(/_/g, ' ')}
          </span>
          {isLeaf && (
             <span className="px-2 py-0.5 rounded text-[10px] bg-slate-100 text-slate-400 font-bold uppercase tracking-wider">
               Sub-Categories
             </span>
          )}
        </div>
        <div className="flex items-center gap-2 opactiy-100 sm:opacity-0 sm:group-hover/block:opacity-100 transition-opacity">
           {onDelete && (
             <button 
               onClick={(e) => {
                 e.stopPropagation();
                 if(confirm('Also delete this section?')) onDelete();
               }}
               onPointerDown={(e) => e.stopPropagation()}
               className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
             >
               <Trash2 size={14} />
             </button>
           )}
        </div>
      </div>
      
      {/* Content */}
      <div className={`grid transition-all duration-300 ease-in-out ${isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
        <div className="overflow-hidden">
           <div className="p-4 pt-0 border-t border-slate-100">
              {children}
           </div>
        </div>
      </div>
    </div>
  );
}

// Sortable Item Component
function SortableItem({ id, children }: { id: string, children: React.ReactNode }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1000 : 'auto', 
    position: isDragging ? 'relative' : 'relative' as 'relative', 
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {children}
    </div>
  );
}

// Deep comparison helper
function isEqual(a: any, b: any): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || a === null || typeof b !== 'object' || b === null) return false;
  
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  
  if (keysA.length !== keysB.length) return false;
  
  for (const key of keysA) {
    if (!keysB.includes(key)) return false;
    // @ts-ignore
    if (!isEqual(a[key], b[key])) return false;
  }
  
  return true;
}

function ArrayEditor({ 
  items, 
  onUpdate, 
  path, 
  originalGithubItems = [], 
  originalDocsFlowItems = [] 
}: { 
  items: any[], 
  onUpdate: (items: any[]) => void, 
  path: string[], 
  originalGithubItems?: any[], 
  originalDocsFlowItems?: any[] 
}) {
  const containerId = path.join('::');

  const handleItemChange = (idx: number, field: string, value: string) => {
    const newItems = [...items];
    const currentItem = newItems[idx];
    
    if (typeof currentItem === 'string') {
      if (field === 'name') {
        newItems[idx] = value;
      } else {
        // Convert all items to objects for consistency if we're adding details
        const itemsAsObjects = items.map(it => 
          typeof it === 'string' ? { name: it } : { ...it }
        );
        itemsAsObjects[idx] = { ...itemsAsObjects[idx], [field]: value };
        onUpdate(itemsAsObjects);
        return;
      }
    } else {
      if (field === 'url') {
        newItems[idx] = { ...currentItem, url: value, link: value };
      } else {
        newItems[idx] = { ...currentItem, [field]: value };
      }
    }
    onUpdate(newItems);
  };

  const removeItem = (idx: number) => {
    onUpdate(items.filter((_, i) => i !== idx));
  };

  const addItem = () => {
    onUpdate([...items, { name: "", version: "", url: "", description: "" }]);
  };
  
  const findMatch = (item: any, list: any[]) => {
    if (!list || !Array.isArray(list)) return null;
    const itemName = typeof item === 'string' ? item : (item.name || '');
    if (!itemName) return null;
    return list.find(orig => {
        const origName = typeof orig === 'string' ? orig : (orig.name || '');
        return origName === itemName;
    });
  };

  const revertItem = (idx: number) => {
    const currentItem = items[idx];
    const baseItems = originalDocsFlowItems?.length ? originalDocsFlowItems : originalGithubItems;
    const match = findMatch(currentItem, baseItems);
    
    if (match) {
      const newItems = [...items];
      newItems[idx] = JSON.parse(JSON.stringify(match));
      onUpdate(newItems);
    }
  };

  // Calculate deleted items:
  // 1. Saved Deletion: In GitHub but NOT in DocsFlow
  const savedDeletions = originalGithubItems.filter(github => !findMatch(github, originalDocsFlowItems)).map(item => ({
    ...item,
    isSavedDeletion: true,
  }));

  // 2. Unsaved Deletion: In DocsFlow but NOT in current local items
  const unsavedDeletions = (originalDocsFlowItems || []).filter(docsFlow => !findMatch(docsFlow, items)).map(item => ({
    ...item,
    isUnsavedDeletion: true,
  }));

  const deletedItems = [...savedDeletions, ...unsavedDeletions];

  const restoreItem = (item: any) => {
    // To restore, we just add it back to local items
    onUpdate([...items, JSON.parse(JSON.stringify(item))]);
  };

  return (
    <div className="space-y-4">
    <SortableContext 
      id={containerId} 
      items={items.map((_, idx) => `${containerId}::${idx}`)}
      strategy={verticalListSortingStrategy}
    >
        <div className="space-y-4">
        {items.map((item, idx) => {
            const isString = typeof item === 'string';
            const name = isString ? item : (item.name || '');
            const version = isString ? '' : (item.version || '');
            const url = isString ? '' : (item.link || item.url || '');
            const description = isString ? '' : (item.description || '');
            const itemId = `${containerId}::${idx}`;
            
            // Diff Logic
            const originalGithubItem = findMatch(item, originalGithubItems);
            const originalDocsFlowItem = findMatch(item, originalDocsFlowItems);
            
            // Saved Changes = diff(data, docs_flow_data)
            const isSavedAdded = originalDocsFlowItem && !originalGithubItem;
            const isSavedModified = originalGithubItem && originalDocsFlowItem && !isEqual(originalGithubItem, originalDocsFlowItem);
            
            // Unsaved Changes = diff(docs_flow_data, current state data)
            const isUnsavedAdded = !originalDocsFlowItem;
            const isUnsavedModified = originalDocsFlowItem && !isEqual(originalDocsFlowItem, item);
            
            const isUnsaved = isUnsavedAdded || isUnsavedModified;
            const isSaved = isSavedAdded || isSavedModified;

            const getOriginalGithubVal = (field: string) => {
               const source = originalGithubItem;
               if (!source) return undefined;
               if (typeof source === 'string') return field === 'name' ? source : undefined;
               if (field === 'url') return source.link || source.url;
               return source[field];
            };

            const getSavedDocsFlowVal = (field: string) => {
               const source = originalDocsFlowItem;
               if (!source) return undefined;
               if (typeof source === 'string') return field === 'name' ? source : undefined;
               if (field === 'url') return source.link || source.url;
               return source[field];
            };
            
            // Find Original Indexes for position tracking
            const getOriginalIndex = (list: any[]) => {
                if (!list) return -1;
                return list.findIndex(orig => {
                    const origName = typeof orig === 'string' ? orig : (orig.name || '');
                    return origName === name;
                });
            };
            const origGithubIdx = getOriginalIndex(originalGithubItems);
            const isPositionChanged = !isUnsavedAdded && origGithubIdx !== -1 && origGithubIdx !== idx;
            
            // Determine Background and Colors
            let bgColorClass = 'bg-white';
            let borderColorClass = 'border-slate-200 group-hover:border-blue-300';
            let statusLabel = '';
            let statusBadgeClass = '';
            let statusChar = '';

            if (isUnsavedModified) {
              bgColorClass = 'bg-amber-50/50';
              borderColorClass = 'border-amber-200';
              statusLabel = 'Unsaved - M';
              statusBadgeClass = 'bg-amber-500';
              statusChar = 'M';
            } else if (isSavedModified) {
              bgColorClass = 'bg-orange-50/50';
              borderColorClass = 'border-orange-200';
              statusLabel = 'Saved - M';
              statusBadgeClass = 'bg-orange-500';
              statusChar = 'M';
            } else if (isUnsavedAdded) {
              bgColorClass = 'bg-emerald-50/50'; // light green
              borderColorClass = 'border-emerald-200';
              statusLabel = 'Unsaved - A';
              statusBadgeClass = 'bg-emerald-400';
              statusChar = 'A';
            } else if (isSavedAdded) {
              bgColorClass = 'bg-emerald-100/50'; // green
              borderColorClass = 'border-emerald-300';
              statusLabel = 'Saved - A';
              statusBadgeClass = 'bg-emerald-600';
              statusChar = 'A';
            }
            
            return (
            <SortableItem key={itemId} id={itemId}>
                <div className={`flex gap-2 items-start group relative animate-in fade-in slide-in-from-left-2 duration-200 ${bgColorClass} rounded-xl transition-colors`}>
                    
                    {/* Status Badge */}
                    {statusLabel && (
                        <div className="absolute -top-2 -right-2 z-10 flex items-center gap-1">
                            <span className={cn("w-auto h-6 px-2 rounded-lg text-white flex items-center justify-center text-[10px] font-black shadow-lg", statusBadgeClass)} title={statusLabel}>
                                {statusLabel}
                            </span>
                        </div>
                    )}

                    <div className="mt-2.5 text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing transition-colors">
                        <GripVertical size={14} />
                    </div>
                    
                    <div className={`flex-1 flex flex-col gap-2 p-3 rounded-xl border shadow-sm group-hover:shadow-md transition-all duration-200 ${bgColorClass} ${borderColorClass}`}>
                    
                    {/* Top Header: Position & Actions */}
                    <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                            <div className={`px-2 py-0.5 rounded text-[10px] font-black tracking-widest ${isPositionChanged ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>
                                POS: {idx + 1}
                                {isPositionChanged && (
                                    <span className="ml-1 opacity-60">({origGithubIdx + 1} → {idx + 1})</span>
                                )}
                            </div>
                        </div>
                        {isUnsaved && (
                            <button 
                                onClick={() => revertItem(idx)}
                                className="flex items-center gap-1 text-[10px] uppercase font-bold text-slate-500 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded transition-colors"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg>
                                Undo
                            </button>
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                        <div className="md:col-span-4 flex flex-col gap-1 relative group/field">
                        <label className="text-[9px] font-black text-slate-400 uppercase ml-1">Name</label>
                         <input 
                            placeholder="e.g. React"
                            value={name} 
                            onChange={(e) => handleItemChange(idx, 'name', e.target.value)}
                            onPointerDown={(e) => e.stopPropagation()}
                            onKeyDown={(e) => e.stopPropagation()}
                            className={`w-full px-2 py-1.5 rounded-lg text-sm font-bold outline-none transition-colors border focus:border-slate-100 ${
                                name !== getSavedDocsFlowVal('name')
                                    ? 'bg-amber-100/50 text-amber-900 border-amber-200' 
                                    : name !== getOriginalGithubVal('name')
                                        ? 'bg-orange-100/50 text-orange-900 border-orange-200'
                                        : 'bg-slate-50/50 text-slate-700 border-transparent focus:bg-white'
                            }`}
                        />
                        {/* Tooltip */}
                        {isUnsavedAdded ? (
                            <div className="absolute z-50 bottom-full left-0 mb-1 hidden group-hover/field:block bg-slate-800 text-white text-[10px] font-bold px-2 py-1 rounded shadow-xl whitespace-nowrap">
                                Newly Added
                                <div className="absolute top-full left-4 -translate-y-1/2 rotate-45 w-1.5 h-1.5 bg-slate-800"></div>
                            </div>
                        ) : (name !== getOriginalGithubVal('name')) && (
                            <div className="absolute z-50 bottom-full left-0 mb-1 hidden group-hover/field:block bg-slate-800 text-white text-[10px] font-bold px-2 py-1 rounded shadow-xl whitespace-nowrap">
                                <span className="opacity-50 line-through mr-1.5">{getOriginalGithubVal('name') || 'empty'}</span>
                                <span className="text-amber-400 mr-1.5">→</span>
                                <span className="text-white">{name}</span>
                                <div className="absolute top-full left-4 -translate-y-1/2 rotate-45 w-1.5 h-1.5 bg-slate-800"></div>
                            </div>
                        )}
                        </div>
                        <div className="md:col-span-3 flex flex-col gap-1 relative group/field">
                        <label className="text-[9px] font-black text-slate-400 uppercase ml-1">Version</label>
                         <input 
                            placeholder="v18.2.0"
                            value={version} 
                            onChange={(e) => handleItemChange(idx, 'version', e.target.value)}
                            onPointerDown={(e) => e.stopPropagation()}
                            onKeyDown={(e) => e.stopPropagation()}
                            className={`w-full px-2 py-1.5 rounded-lg text-xs font-mono outline-none transition-colors border focus:border-slate-100 ${
                                version !== getSavedDocsFlowVal('version')
                                    ? 'bg-amber-100/50 text-amber-900 border-amber-200' 
                                    : version !== getOriginalGithubVal('version')
                                        ? 'bg-orange-100/50 text-orange-900 border-orange-200'
                                        : 'bg-slate-50/50 text-slate-500 border-transparent focus:bg-white'
                            }`}
                        />
                        {/* Tooltip */}
                        {!isUnsavedAdded && (version !== getOriginalGithubVal('version')) && (
                            <div className="absolute z-50 bottom-full left-0 mb-1 hidden group-hover/field:block bg-slate-800 text-white text-[10px] font-bold px-2 py-1 rounded shadow-xl whitespace-nowrap">
                                <span className="opacity-50 line-through mr-1.5">{getOriginalGithubVal('version') || 'empty'}</span>
                                <span className="text-amber-400 mr-1.5">→</span>
                                <span className="text-white">{version}</span>
                                <div className="absolute top-full left-4 -translate-y-1/2 rotate-45 w-1.5 h-1.5 bg-slate-800"></div>
                            </div>
                        )}
                        </div>
                        <div className="md:col-span-5 flex flex-col gap-1 relative group/field">
                        <label className="text-[9px] font-black text-slate-400 uppercase ml-1">URL / Link</label>
                        <div className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg group-focus-within:bg-white transition-colors border focus-within:border-slate-100 h-[34px] ${
                             url !== getSavedDocsFlowVal('url')
                                ? 'bg-amber-100/50 border-amber-200' 
                                : url !== getOriginalGithubVal('url')
                                    ? 'bg-orange-100/50 border-orange-200'
                                    : 'bg-slate-50/50 border-transparent'
                        }`}>
                            <LinkIcon size={12} className="text-slate-400" />
                             <input 
                            placeholder="https://..."
                            value={url} 
                            onChange={(e) => handleItemChange(idx, 'url', e.target.value)}
                            onPointerDown={(e) => e.stopPropagation()}
                            onKeyDown={(e) => e.stopPropagation()}
                            className={`w-full bg-transparent text-xs text-blue-600 outline-none`}
                            />
                        </div>
                        {/* Tooltip */}
                        {!isUnsavedAdded && (url !== getOriginalGithubVal('url')) && (
                            <div className="absolute z-50 bottom-full left-0 mb-1 hidden group-hover/field:block bg-slate-800 text-white text-[10px] font-bold px-2 py-1 rounded shadow-xl whitespace-nowrap max-w-xs truncate">
                                <span className="opacity-50 line-through mr-1.5">{getOriginalGithubVal('url') || 'empty'}</span>
                                <span className="text-amber-400 mr-1.5">→</span>
                                <span className="text-white">{url}</span>
                                <div className="absolute top-full left-4 -translate-y-1/2 rotate-45 w-1.5 h-1.5 bg-slate-800"></div>
                            </div>
                        )}
                        </div>
                    </div>
                    <div className="flex flex-col gap-1 relative group/field">
                        <label className="text-[9px] font-black text-slate-400 uppercase ml-1">Description</label>
                         <input 
                        placeholder="Small description about the library..."
                        value={description} 
                        onChange={(e) => handleItemChange(idx, 'description', e.target.value)}
                        onPointerDown={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                        className={`w-full px-2 py-1.5 rounded-lg text-xs outline-none transition-colors border focus:border-slate-100 ${
                            description !== getSavedDocsFlowVal('description')
                                ? 'bg-amber-100/50 text-amber-900 border-amber-200' 
                                : description !== getOriginalGithubVal('description')
                                    ? 'bg-orange-100/50 text-orange-900 border-orange-200'
                                    : 'bg-slate-50/50 text-slate-600 border-transparent focus:bg-white'
                        }`}
                        />
                        {/* Tooltip */}
                        {!isUnsavedAdded && (description !== getOriginalGithubVal('description')) && (
                            <div className="absolute z-50 bottom-full left-0 mb-1 hidden group-hover/field:block bg-slate-800 text-white text-[10px] font-bold px-2 py-1 rounded shadow-xl whitespace-nowrap max-w-md truncate">
                                <span className="opacity-50 line-through mr-1.5">{getOriginalGithubVal('description') || 'empty'}</span>
                                <span className="text-amber-400 mr-1.5">→</span>
                                <span className="text-white">{description}</span>
                                <div className="absolute top-full left-4 -translate-y-1/2 rotate-45 w-1.5 h-1.5 bg-slate-800"></div>
                            </div>
                        )}
                    </div>
                    </div>
                    {CONFIG.enableDeleteSubCategory && (
                        <button 
                        onClick={() => removeItem(idx)}
                        onPointerDown={(e) => e.stopPropagation()}
                        className="mt-2.5 p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                        title="Delete Item"
                        >
                        <Trash2 size={16} />
                        </button>
                    )}
                </div>
            </SortableItem>
            );
        })}
        </div>
    </SortableContext>

    <button 
        onClick={addItem}
        className="w-full py-3 border-2 border-dashed border-slate-200 rounded-xl text-slate-400 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50/50 transition-all flex items-center justify-center gap-2 text-xs font-black uppercase tracking-widest mt-2"
    >
        <Plus size={14} /> Add New Library
    </button>

    {/* Deleted Items Section */}
    {deletedItems.length > 0 && (
        <div className="pt-6 border-t border-slate-100">
            <h4 className="text-[10px] font-black text-slate-400 uppercase mb-4 tracking-widest flex items-center gap-2">
                <Trash2 size={12} /> Deleted Items ({deletedItems.length})
            </h4>
            <div className="space-y-3 opacity-60">
                {deletedItems.map((item: any, dIdx) => {
                    const name = typeof item === 'string' ? item : (item.name || 'Unnamed');
                    const isUnsavedDelete = item.isUnsavedDeletion;
                    const isSavedDelete = item.isSavedDeletion;

                    let delBgClass = 'bg-slate-50/50 border-slate-200';
                    let delBadgeClass = 'bg-slate-400';
                    let delLabel = isUnsavedDelete ? 'Unsaved - D' : 'Saved - D';
                    
                    if (isUnsavedDelete) {
                       delBgClass = 'bg-slate-50/50 border-slate-200 opacity-60';
                       delBadgeClass = 'bg-slate-400';
                    } else if (isSavedDelete) {
                       delBgClass = 'bg-red-50/50 border-red-200';
                       delBadgeClass = 'bg-red-500';
                    }
                    
                    return (
                        <div key={`del-${dIdx}`} className={cn("flex gap-3 items-center p-3 rounded-xl border relative overflow-hidden group/del-card", delBgClass)}>
                            <div className={cn("absolute top-2 right-2 flex items-center justify-center px-2 h-6 rounded-lg text-white text-[10px] font-black shadow-lg", delBadgeClass)}>
                                {delLabel}
                            </div>
                            
                            {/* Hover Tooltip for Deleted Card */}
                            <div className="absolute z-50 bottom-full left-4 mb-2 hidden group-hover/del-card:block bg-slate-800 text-white text-[10px] font-bold px-2 py-1 rounded shadow-xl whitespace-nowrap">
                                {isUnsavedDelete ? 'Unsaved Deletion (Will be removed from draft)' : 'Saved Deletion (Already removed in draft)'}
                                <div className="absolute top-full left-4 -translate-y-1/2 rotate-45 w-1.5 h-1.5 bg-slate-800"></div>
                            </div>
                            
                            <div className="flex-1">
                                <span className={cn("text-sm font-bold line-through", isUnsavedDelete ? 'text-slate-400' : 'text-red-900/40')}>{name}</span>
                                <div className={cn("text-[9px] font-bold uppercase mt-0.5", isUnsavedDelete ? 'text-slate-500' : 'text-red-600')}>
                                    {delLabel}
                                </div>
                            </div>
                            
                            <button 
                                onClick={() => restoreItem(item)}
                                className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] font-black text-slate-600 hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all active:scale-95 shadow-sm"
                            >
                                RESTORE
                            </button>
                        </div>
                    );
                })}
            </div>
        </div>
    )}
    </div>
  );
}

function SubSectionEditor({ 
  data, 
  onUpdate, 
  path, 
  originalGithubData = {}, 
  originalDocsFlowData = {} 
}: { 
  data: any, 
  onUpdate: (data: any) => void, 
  path: string[], 
  originalGithubData?: any,
  originalDocsFlowData?: any
}) {
  const addSubSection = () => {
     const name = prompt("Enter sub-section name:");
     if (name) {
        onUpdate({ ...data, [name]: [] });
     }
  };

  const removeSubSection = (key: string) => {
    const newData = { ...data };
    delete newData[key];
    onUpdate(newData);
  };

  return (
    <div className="space-y-4">
      {Object.entries(data).map(([key, value]) => {
        const isLeafArray = Array.isArray(value);
        return (
          <CollapsibleBlock 
            key={key} 
            title={key} 
            onDelete={CONFIG.enableDeleteSubSection ? () => removeSubSection(key) : undefined}
            isLeaf={isLeafArray}
            defaultOpen={isLeafArray || true} // Ensure true default
          >
             <div className="mt-4">
              <EditorNode 
                node={value} 
                onUpdate={(v) => onUpdate({ ...data, [key]: v })} 
                path={[...path, key]}
                originalGithubNode={originalGithubData?.[key]}
                originalDocsFlowNode={originalDocsFlowData?.[key]} 
              />
             </div>
          </CollapsibleBlock>
        );
      })}
      
      {CONFIG.enableAddSubSection && (
        <button 
          onClick={addSubSection}
          className="w-full py-3 border-2 border-dashed border-slate-200 rounded-xl text-slate-400 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50/50 transition-all flex items-center justify-center gap-2 text-xs font-black uppercase tracking-widest"
        >
          <Plus size={14} /> Add Sub-Section
        </button>
      )}
    </div>
  );
}

export default function TechStackManager() {
  const { 
    versions, 
    selectedVersion, 
    selectedData, 
    isLoading, 
    isLoadingDetails, 
    setSelectedVersion,
    hasSelectedDocUpdate,
    incomingUpdate,
    clearUpdateNotification,
    loadLatestSelectedData
  } = useTechStack();

  const [search, setSearch] = useState("");
  const [localData, setLocalData] = useState<any>(null);
  const [originalGithubData, setOriginalGithubData] = useState<any>(null);
  const [originalDocsFlowData, setOriginalDocsFlowData] = useState<any>(null);
  const [isModified, setIsModified] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [isSyncAllowed, setIsSyncAllowed] = useState(false);

  // New conflict & notification states
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [conflicts, setConflicts] = useState<any[]>([]);
  const [isPublishing, setIsPublishing] = useState(false);

  // Deep diff helper to find modified paths
  const getDeepDiffPaths = (current: any, base: any, path: string[] = []): string[] => {
    if (!current || !base) return [];
    const paths: string[] = [];
    for (const key in current) {
      const fullPath = [...path, key].join('::');
      if (Array.isArray(current[key])) {
        if (!isEqual(current[key], base[key])) paths.push(fullPath);
      } else if (typeof current[key] === 'object' && current[key] !== null) {
        paths.push(...getDeepDiffPaths(current[key], base[key], [...path, key]));
      } else if (current[key] !== base[key]) {
        paths.push(fullPath);
      }
    }
    return paths;
  };

  // Process incoming real-time updates
  useEffect(() => {
    if (!incomingUpdate || !localData || !originalDocsFlowData || !originalGithubData) return;

    const updatedDocument = incomingUpdate.fullDocument;
    const incomingData = updatedDocument.data; // GitHub data
    const incomingDocsFlowData = updatedDocument.docs_flow_data; // DocsFlow data
    const updatedFields = incomingUpdate.updatedFields || {};
    
    // Determine source
    const isGithubUpdate = !!(updatedFields.data || updatedFields.github_last_commit);
    const sourceLabel = isGithubUpdate ? 'GitHub' : 'DocsFlow';

    const remoteDataToCompare = isGithubUpdate ? incomingData : incomingDocsFlowData;
    const baseDataForComparison = isGithubUpdate ? originalGithubData : originalDocsFlowData;
    
    // Identify what changed REMOTELY (Incoming vs Base)
    const remoteChangedPaths = getDeepDiffPaths(remoteDataToCompare, baseDataForComparison);
    // Identify what user changed LOCALLY (Local vs Base)
    const locallyModifiedPaths = getDeepDiffPaths(localData, originalDocsFlowData);

    const foundConflicts: any[] = [];

    // Check for overlapping changes at the ITEM and FIELD level
    const checkConflicts = (currentInc: any, currentLocal: any, currentBase: any, path: string[]) => {
      for (const key in currentInc) {
        const fullPathStr = [...path, key].join('::');
        const inVal = currentInc[key];
        const localVal = currentLocal?.[key];
        const baseVal = currentBase?.[key];

        if (Array.isArray(inVal)) {
          // Conflict only if THIS array changed in both directions
          if (remoteChangedPaths.includes(fullPathStr) && locallyModifiedPaths.includes(fullPathStr)) {
             inVal.forEach((incItem: any, idx: number) => {
                const localItem = localVal?.[idx];
                const baseItem = baseVal?.[idx];
                
                if (localItem && incItem && !isEqual(incItem, localItem)) {
                   const conflictingFields: any = {};
                   const fields = ['name', 'version', 'url', 'link', 'description'];
                   let hasFieldConflict = false;

                   fields.forEach(f => {
                      const fInc = incItem[f] || incItem[f === 'url' ? 'link' : 'url'];
                      const fLoc = localItem[f] || localItem[f === 'url' ? 'link' : 'url'];
                      const fBase = baseItem?.[f] || baseItem?.[f === 'url' ? 'link' : 'url'];

                      // A conflict exists if both remote and local changed a field to DIFFERENT values
                      if (fInc !== fLoc && fInc !== fBase && fLoc !== fBase) {
                         hasFieldConflict = true;
                         conflictingFields[f] = { incoming: fInc, local: fLoc, base: fBase };
                      }
                   });

                   if (hasFieldConflict) {
                      foundConflicts.push({
                         path: fullPathStr,
                         itemIdx: idx,
                         name: incItem.name || localItem.name || `Item ${idx+1}`,
                         fields: conflictingFields
                      });
                   }
                }
             });
          }
        } else if (typeof inVal === 'object' && inVal !== null) {
          checkConflicts(inVal, localVal, baseVal, [...path, key]);
        }
      }
    };

    checkConflicts(remoteDataToCompare, localData, baseDataForComparison, []);

    if (foundConflicts.length > 0) {
      setConflicts(foundConflicts);
      // Banner will show the conflict
    } else {
      // NO CONFLICTS -> Silent Merge
      const mergeSilently = (target: any, incoming: any, base: any, path: string[] = []) => {
        const result = { ...target };
        for (const key in incoming) {
          const fullPathStr = [...path, key].join('::');
          const incValue = incoming[key];
          const baseValue = base?.[key];

          if (Array.isArray(incValue)) {
            if (!locallyModifiedPaths.includes(fullPathStr)) {
               // Safe to take entire incoming array if not touched locally
               result[key] = JSON.parse(JSON.stringify(incValue));
            } else {
               // Partially touched locally. Merge items that were NOT touched locally.
                const merged = incValue.map((incItem: any, idx: number) => {
                  const localItem = target[key]?.[idx];
                  const bItem = baseValue?.[idx];
                  // If local item matches base, it hasn't been touched, so take incoming.
                  if (localItem && bItem && isEqual(localItem, bItem)) {
                     return JSON.parse(JSON.stringify(incItem));
                  }
                  return localItem || incItem;
               });

               // Issue 5: Preserve local items beyond incoming length
               const localArray = target[key] || [];
               if (localArray.length > incValue.length) {
                  merged.push(...JSON.parse(JSON.stringify(localArray.slice(incValue.length))));
               }
               result[key] = merged;
            }
          } else if (typeof incValue === 'object' && incValue !== null) {
            result[key] = mergeSilently(target[key] || {}, incValue, baseValue || {}, [...path, key]);
          } else {
            if (!locallyModifiedPaths.includes(fullPathStr)) {
              result[key] = incValue;
            }
          }
        }
        return result;
      };

      const newLocalData = mergeSilently(localData, remoteDataToCompare, baseDataForComparison);
      setLocalData(newLocalData);
      setOriginalGithubData(JSON.parse(JSON.stringify(incomingData)));
      setOriginalDocsFlowData(JSON.parse(JSON.stringify(incomingDocsFlowData)));
      
      setToast({ message: `Background update from ${sourceLabel} applied`, type: 'info' });
      clearUpdateNotification();
      setTimeout(() => setToast(null), 3000);
    }
  }, [incomingUpdate]);

  // DnD Sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    if (selectedData) {
      // Initialize local state from docs_flow_data (the editable copy)
      const dataToLoad = selectedData.docs_flow_data || selectedData.data;
      setLocalData(JSON.parse(JSON.stringify(dataToLoad)));
      setOriginalGithubData(JSON.parse(JSON.stringify(selectedData.data))); // Store original GitHub data
      setOriginalDocsFlowData(JSON.parse(JSON.stringify(dataToLoad))); // Store original DocsFlow data (what localData started from)
      setIsModified(false);
      const keys = Object.keys(dataToLoad);
      if (keys.length > 0) setActiveCategory(keys[0]);
    } else {
      setLocalData(null);
      setOriginalGithubData(null);
      setOriginalDocsFlowData(null);
      setIsModified(false);
      setActiveCategory(null);
    }
    setConflicts([]); // Clear conflicts when selectedData changes
    setShowConflictModal(false); // Close modal
  }, [selectedData]);

  useEffect(() => {
    if (selectedData && localData && originalDocsFlowData) {
      setIsModified(!isEqual(localData, originalDocsFlowData));
      const isUpdatedFromGithub = !isEqual(selectedData.docs_flow_data, selectedData.data);
      setIsSyncAllowed(!isModified && isUpdatedFromGithub);
    } else {
      setIsModified(false);
      setIsSyncAllowed(false);
    }
  }, [localData, originalDocsFlowData, selectedData, isModified]);


  const handleUpdate = (newData: any) => {
    setLocalData(newData);
    // isModified is now handled by a separate useEffect
  };

  const discardChanges = () => {
    if (selectedData && originalDocsFlowData) {
      setLocalData(JSON.parse(JSON.stringify(originalDocsFlowData)));
      setIsModified(false);
    }
  };

  const onSave = async () => {
    if (!selectedVersion || !localData) return;
    try {
        const res = await updateDocsFlowData(selectedVersion, localData);
        if (res.success) {
            setToast({ message: "Draft saved successfully!", type: 'success' });
            setTimeout(() => setToast(null), 3000);
            
            // Reload the latest data from the server to update the UI
            await loadLatestSelectedData();
        } else {
            alert("Failed to save: " + res.error);
        }
    } catch (err) {
        console.error("Save error:", err);
        alert("An error occurred while saving.");
    }
  };

  const onPublish = async () => {
    if (!selectedVersion || !localData) return;
    
    setIsPublishing(true);
    setToast({ message: "Publishing to GitHub...", type: 'info' });

    try {
        const response = await fetch('/api/github/publish', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                version: selectedVersion,
                data: localData
            })
        });

        const result = await response.json();

        if (response.ok) {
            setToast({ message: `Successfully published to ${result.branch}!`, type: 'success' });
            // Ensure isModified is synced if this was published from unsaved state?
            // Usually we'd want to save draft too, but let's keep it simple.
        } else {
            console.error("Publish failure details:", result.details);
            alert(`Failed to publish: ${result.error}${result.details ? '\n\nDetails: ' + JSON.stringify(result.details) : ''}`);
            setToast({ message: "Publish failed", type: 'error' });
        }
    } catch (err) {
        console.error("Publish error:", err);
        alert("An error occurred while publishing to GitHub.");
        setToast({ message: "Publish error", type: 'error' });
    } finally {
        setIsPublishing(false);
        setTimeout(() => setToast(null), 5000);
    }
  };

  // Handle Drag End
  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    
    if (!over) return;
    if (active.id === over.id) return;

    // Parse IDs: "containerPath::index"
    const activeIdStr = String(active.id);
    const overIdStr = String(over.id);

    const activeParts = activeIdStr.split('::');
    const overParts = overIdStr.split('::');
    
    const activeIndex = parseInt(activeParts.pop() || '0');
    const overIndex = parseInt(overParts.pop() || '0');
    
    // Join back for container path
    const activeContainerPath = activeParts.join('::');
    const overContainerPath = overParts.join('::');

    const newData = JSON.parse(JSON.stringify(localData));

    // Helper to traverse and get array reference
    const getArrayAt = (pathStr: string, root: any) => {
        const segments = pathStr.split('::');
        let current = root;
        for (const k of segments) {
            if (current && current[k]) {
                current = current[k];
            } else {
                return null;
            }
        }
        return Array.isArray(current) ? current : null;
    };

    const sourceArray = getArrayAt(activeContainerPath, newData);
    const destArray = getArrayAt(overContainerPath, newData);

    if (sourceArray && destArray) {
        if (activeContainerPath === overContainerPath) {
             // Reorder in same list
             const newArray = arrayMove(sourceArray, activeIndex, overIndex);
             // We need to write this back. Since sourceArray is a reference to a node in newData tree? 
             // JSON.parse/stringify makes deep copies but getArrayAt returns a reference to the array *inside* that copy? 
             // Yes, objects/arrays are by reference in JS.
             
             // BUT: `arrayMove` returns a NEW array. It does NOT mutate in place.
             // So we need to set it back.
             // We need the parent object and the last key to set it.
             const setArrayAt = (pathStr: string, root: any, val: any[]) => {
                 const segments = pathStr.split('::');
                 const lastKey = segments.pop();
                 let current = root;
                 for (const k of segments) {
                     current = current[k];
                 }
                 if (lastKey) current[lastKey] = val;
             };
             
             setArrayAt(activeContainerPath, newData, newArray);
        } else {
             // Move between lists
             const [movedItem] = sourceArray.splice(activeIndex, 1);
             destArray.splice(overIndex, 0, movedItem);
             // sourceArray and destArray were mutated in place (splice mutates).
             // Wait, `getArrayAt` returns reference to the array in `newData`.
             // `splice` mutates that array. 
             // So `newData` is updated.
        }
        handleUpdate(newData);
    }
  };

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
      <main className="flex-1 overflow-y-auto bg-[#FBFCFD] relative">
        {/* Real-time Update Banner */}
        {hasSelectedDocUpdate && (
          <div className={`sticky top-0 z-40 ${conflicts.length > 0 ? 'bg-amber-600' : 'bg-blue-600'} text-white px-6 py-3 flex items-center justify-between shadow-lg animate-in fade-in slide-in-from-top duration-500`}>
            <div className="flex items-center gap-3">
              <div className="h-2 w-2 rounded-full bg-white animate-pulse" />
              <p className="text-sm font-bold tracking-tight">
                {conflicts.length > 0 
                  ? `Merge Conflict! ${conflicts.length} items have conflicting updates from ${incomingUpdate?.source === 'github' ? 'GitHub' : 'another user'}.`
                  : `Update available! A new version of ${selectedVersion} has been synced from ${incomingUpdate?.source === 'github' ? 'GitHub' : 'DocsFlow'}.`
                }
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => {
                   clearUpdateNotification();
                   setConflicts([]);
                }}
                className="px-3 py-1 text-xs font-bold text-white/70 hover:text-white transition-colors"
              >
                DISMISS
              </button>
              <button 
                onClick={() => {
                  if (conflicts.length > 0) {
                    setShowConflictModal(true);
                  } else {
                    loadLatestSelectedData();
                  }
                }}
                className="px-4 py-1.5 bg-white text-slate-900 text-xs font-black rounded-lg shadow-sm hover:bg-slate-50 transition-all active:scale-95"
              >
                {conflicts.length > 0 ? 'RESOLVE CONFLICTS' : 'LOAD LATEST DATA'}
              </button>
            </div>
          </div>
        )}

        {/* Floating Toast */}
        {toast && (
          <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className={`px-5 py-3 rounded-2xl shadow-2xl border flex items-center gap-3 ${
              toast.type === 'success' ? 'bg-emerald-600 border-emerald-500' : 'bg-slate-800 border-slate-700'
            }`}>
              {toast.type === 'success' ? <CheckCircle2 size={18} className="text-white" /> : <Info size={18} className="text-white" />}
              <span className="text-sm font-bold text-white">{toast.message}</span>
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
          <div>
            {/* Sticky Action Bar */}
            <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200 shadow-sm">
                <div className="px-8 py-4 flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                                <h2 className="text-sm font-black text-slate-900 uppercase tracking-tight">
                                    Editor <span className="text-slate-300 mx-1">/</span> <span className="text-blue-600 underline decoration-blue-200 underline-offset-4">{selectedVersion}</span>
                                </h2>
                            </div>
                            <div className="flex items-center gap-3 mt-1">
                                <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                                    <Calendar size={10} />
                                    {selectedData?.last_update_timestamp ? new Date(selectedData.last_update_timestamp).toLocaleDateString() : 'N/A'}
                                </div>
                                <div className="w-1 h-1 rounded-full bg-slate-200" />
                                <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                                    <UserIcon size={10} />
                                    {selectedData?.last_github_user || 'System'}
                                </div>
                            </div>
                        </div>
                        {isModified && (
                            <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-700 rounded-full border border-amber-100 text-[10px] font-black uppercase tracking-wider animate-in fade-in zoom-in duration-300">
                            <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                            Unsaved Changes
                            </div>
                        )}
                    </div>
                    <div className="flex items-center gap-3">
                        <button 
                            onClick={discardChanges}
                            disabled={!isModified}
                            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-black rounded-xl transition-all ${
                                isModified 
                                    ? 'text-slate-600 hover:bg-slate-100' 
                                    : 'text-slate-300 cursor-not-allowed hidden'
                            }`}
                        >
                            <X size={14} /> DISCARD
                        </button>
                        <button 
                             onClick={onSave}
                             disabled={!isModified}
                            className={`flex items-center gap-2 px-5 py-2.5 text-xs font-black bg-white border border-slate-200 text-slate-900 rounded-xl transition-all ${
                                 isModified
                                     ? 'hover:shadow-md active:scale-95 hover:border-slate-300'
                                     : 'opacity-50 cursor-not-allowed'
                            }`}
                        >
                            <Save size={14} /> SAVE DRAFT
                        </button>
                        <button 
                            disabled={isPublishing}
                            onClick={onPublish}
                            className={`flex items-center gap-2 px-6 py-2.5 text-xs font-black rounded-xl shadow-lg transition-all ${
                                isPublishing
                                    ? 'bg-slate-700 text-white cursor-wait'
                                    : 'bg-slate-900 text-white shadow-slate-200 hover:shadow-xl active:scale-95'
                            }`}
                        >
                            {isPublishing ? (
                                <div className="h-3 w-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <Send size={14} />
                            )}
                            {isPublishing ? 'PUBLISHING...' : 'PUBLISH TECH STACK'}
                        </button>
                    </div>
                </div>

                {/* Horizontal Tab Navigation */}
                {localData && (
                    <div className="px-8 flex items-center gap-1 overflow-x-auto no-scrollbar">
                        {Object.keys(localData).map((key) => (
                            <button
                                key={key}
                                onClick={() => setActiveCategory(key)}
                                className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all whitespace-nowrap ${
                                    activeCategory === key
                                        ? 'border-blue-600 text-blue-600 bg-blue-50/50 rounded-t-lg'
                                        : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded-t-lg'
                                }`}
                            >
                                {key.replace(/_/g, ' ')}
                            </button>
                        ))}
                        {CONFIG.enableAddCategory && (
                            <button 
                                onClick={() => {
                                    const name = prompt("Enter category name:");
                                    if (name) {
                                        handleUpdate({ ...localData, [name]: [] });
                                        setActiveCategory(name);
                                    }
                                }}
                                className="ml-2 p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                                title="Add Category"
                            >
                                <Plus size={16} />
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Editor Content Area */}
            <div className="p-8 max-w-6xl mx-auto w-full space-y-10 pb-32">
                {localData && activeCategory ? (
                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <div className="mb-6 flex items-center justify-between">
                            <h2 className="text-2xl font-black text-slate-900 capitalize tracking-tight flex items-center gap-3">
                                <div className="w-3 h-8 bg-blue-600 rounded-full" />
                                {activeCategory.replace(/_/g, ' ')}
                            </h2>
                            {CONFIG.enableDeleteCategory && (
                                <button 
                                    onClick={() => {
                                        if (confirm(`Are you sure you want to delete ${activeCategory}?`)) {
                                            const newData = { ...localData };
                                            delete newData[activeCategory];
                                            const newKeys = Object.keys(newData);
                                            handleUpdate(newData);
                                            setActiveCategory(newKeys.length > 0 ? newKeys[0] : null);
                                        }
                                    }}
                                    className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold text-red-500 bg-red-50 hover:bg-red-100 rounded-lg transition-all"
                                >
                                    <Trash2 size={14} /> DELETE CATEGORY
                                </button>
                            )}
                        </div>

                        <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
                            <DndContext 
                                sensors={sensors} 
                                collisionDetection={closestCenter} 
                                onDragEnd={handleDragEnd}
                            >
                                <EditorNode 
                                node={localData[activeCategory]} 
                                onUpdate={(val) => handleUpdate({ ...localData, [activeCategory]: val })}
                                path={[activeCategory]}
                                originalGithubNode={originalGithubData?.[activeCategory]}
                                originalDocsFlowNode={originalDocsFlowData?.[activeCategory]}
                            />
                                <DragOverlay>
                                    {/* Optional: Custom drag preview, or DndKit uses screenshot by default/SortableItem style */}
                                </DragOverlay>
                            </DndContext>
                        </div>
                    </div>
                ) : (
                    <div className="bg-white rounded-2xl border border-slate-200 border-dashed p-20 text-center">
                        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
                            <Layers size={32} className="text-slate-200" />
                        </div>
                        <p className="text-slate-400 font-bold">No data payload found for this version.</p>
                        <button 
                            onClick={() => {
                                const initial = { general: [] };
                                handleUpdate(initial);
                                setActiveCategory('general');
                            }}
                            className="mt-6 px-6 py-3 bg-blue-600 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all"
                        >
                            Initialize Data
                        </button>
                    </div>
                )}
            </div>
          </div>
        )}
      </main>

      {/* Conflict Resolution Modal */}
      {showConflictModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
           <div className="bg-white w-full max-w-4xl max-h-[90vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col border border-slate-200">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                 <div className="flex items-center gap-3">
                    <div className="p-2 bg-amber-100 text-amber-600 rounded-xl">
                       <AlertTriangle size={24} />
                    </div>
                    <div>
                       <h2 className="text-lg font-black text-slate-900 uppercase">Merge Conflicts Detected</h2>
                       <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Review and resolve changes to proceed</p>
                    </div>
                 </div>
                 <button 
                   onClick={() => setShowConflictModal(false)}
                   className="p-2 hover:bg-slate-200 rounded-full transition-colors"
                 >
                   <X size={20} className="text-slate-400" />
                 </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-8">
                {conflicts.map((conflict, cIdx) => (
                  <div key={cIdx} className="bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                    <div className="p-4 border-b border-slate-200 bg-white flex items-center justify-between">
                       <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-[10px] font-black uppercase tracking-widest">Conflict</span>
                          <span className="text-sm font-black text-slate-700">{conflict.name}</span>
                          <span className="text-[10px] text-slate-400 font-bold ml-2">in {conflict.path.split('::').join(' > ')}</span>
                       </div>
                    </div>

                    <div className="p-6 space-y-6">
                       {Object.entries(conflict.fields).map(([field, values]: [string, any]) => (
                          <div key={field} className="space-y-3">
                             <div className="flex items-center gap-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{field}</label>
                             </div>
                             
                             <div className="grid grid-cols-2 gap-4">
                                {/* Option 1: Incoming */}
                                <button 
                                  onClick={() => {
                                     const newData = JSON.parse(JSON.stringify(localData));
                                     const setFieldAt = (pathStr: string, idx: number, f: string, val: any) => {
                                        const segments = pathStr.split('::');
                                        let current = newData;
                                        for (const k of segments) current = current[k];
                                        if (current[idx]) current[idx][f] = val;
                                     };
                                     setFieldAt(conflict.path, conflict.itemIdx, field, values.incoming);
                                     setLocalData(newData);
                                     
                                     const newConflicts = [...conflicts];
                                     delete newConflicts[cIdx].fields[field];
                                     if (Object.keys(newConflicts[cIdx].fields).length === 0) {
                                        newConflicts.splice(cIdx, 1);
                                     }
                                     setConflicts(newConflicts);
                                     if (newConflicts.length === 0) {
                                        setShowConflictModal(false);
                                        clearUpdateNotification();
                                        if (incomingUpdate) {
                                           setOriginalGithubData(JSON.parse(JSON.stringify(incomingUpdate.fullDocument.data)));
                                           setOriginalDocsFlowData(JSON.parse(JSON.stringify(incomingUpdate.fullDocument.docs_flow_data)));
                                        }
                                     }
                                  }}
                                  className="group flex flex-col items-start p-4 rounded-xl border bg-white hover:border-emerald-500 hover:ring-2 hover:ring-emerald-500/10 transition-all text-left shadow-sm"
                                >
                                   <div className="flex items-center gap-1.5 mb-1.5 text-[9px] font-black text-emerald-600 uppercase">
                                      <Download size={10} /> Incoming ({incomingUpdate?.source === 'github' ? 'GitHub' : 'Saved Draft'})
                                   </div>
                                   <div className="text-sm font-bold text-slate-900 break-all">{values.incoming || <span className="text-slate-300 italic">empty</span>}</div>
                                </button>

                                {/* Option 2: Local */}
                                <button 
                                  onClick={() => {
                                     // Resolution: Keep local (Remove field from conflict list)
                                     const newConflicts = [...conflicts];
                                     delete newConflicts[cIdx].fields[field];
                                     if (Object.keys(newConflicts[cIdx].fields).length === 0) {
                                        newConflicts.splice(cIdx, 1);
                                     }
                                     setConflicts(newConflicts);
                                     if (newConflicts.length === 0) {
                                        setShowConflictModal(false);
                                        clearUpdateNotification();
                                        if (incomingUpdate) {
                                           setOriginalGithubData(JSON.parse(JSON.stringify(incomingUpdate.fullDocument.data)));
                                           setOriginalDocsFlowData(JSON.parse(JSON.stringify(incomingUpdate.fullDocument.docs_flow_data)));
                                        }
                                     }
                                  }}
                                  className="group flex flex-col items-start p-4 rounded-xl border bg-white hover:border-blue-500 hover:ring-2 hover:ring-blue-500/10 transition-all text-left shadow-sm"
                                >
                                   <div className="flex items-center gap-1.5 mb-1.5 text-[9px] font-black text-blue-600 uppercase">
                                      <User size={10} /> Your local change
                                   </div>
                                   <div className="text-sm font-bold text-slate-900 break-all">{values.local || <span className="text-slate-300 italic">empty</span>}</div>
                                </button>
                             </div>
                          </div>
                       ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end">
                 <button 
                   onClick={() => setShowConflictModal(false)}
                   className="px-6 py-2.5 bg-slate-900 text-white text-[10px] font-black uppercase rounded-xl hover:bg-slate-800 transition-all"
                 >
                   Done
                 </button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}

