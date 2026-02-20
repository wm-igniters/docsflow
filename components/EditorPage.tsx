"use client";

import React, { useState } from 'react';
import { 
  History, 
  ChevronRight, 
  Save, 
  Send,
  FileText,
  Folder,
  Clock,
  Search,
  ChevronDown
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { 
  Tooltip, 
  TooltipContent, 
  TooltipProvider, 
  TooltipTrigger 
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface TreeItem {
  path: string;
  type: 'blob' | 'tree';
  sha: string;
  name?: string;
}

interface EditorPageProps {
  title: string;
  tree: TreeItem[];
  selectedPath: string | null;
  onItemClick: (path: string) => void;
  content: string;
  onContentChange: (content: string) => void;
  onSave: () => void;
  onPublish: () => void;
  history: any[];
  isLoading?: boolean;
}

interface TreeNode {
  name: string;
  path: string;
  type: 'blob' | 'tree';
  children: TreeNode[];
}

function buildTree(items: TreeItem[]): TreeNode[] {
  if (items.length === 0) return [];

  // Find the common prefix path parts
  const allPathParts = items.map(item => item.path.split('/'));
  let commonPartsCount = 0;
  const firstPathParts = allPathParts[0];

  for (let i = 0; i < firstPathParts.length - 1; i++) {
    const part = firstPathParts[i];
    const isCommon = allPathParts.every(parts => parts[i] === part);
    if (isCommon) {
      commonPartsCount++;
    } else {
      break;
    }
  }

  const root: TreeNode[] = [];
  const map: { [key: string]: TreeNode } = {};

  const sortedItems = [...items].sort((a, b) => a.path.localeCompare(b.path));

  sortedItems.forEach(item => {
    const parts = item.path.split('/');
    // Skip the common parts
    const relativeParts = parts.slice(commonPartsCount);
    let currentPath = '';
    let currentLevel = root;

    relativeParts.forEach((part, index) => {
      // Reconstruct the full path for the map ID and original link
      const nodePathParts = parts.slice(0, commonPartsCount + index + 1);
      const fullPath = nodePathParts.join('/');
      
      const isLast = index === relativeParts.length - 1;

      if (!map[fullPath]) {
        const newNode: TreeNode = {
          name: part,
          path: fullPath,
          type: isLast ? item.type : 'tree',
          children: []
        };
        map[fullPath] = newNode;
        currentLevel.push(newNode);
      }
      currentLevel = map[fullPath].children;
    });
  });

  return root;
}

function TreeItemNode({ 
  node, 
  selectedPath, 
  onItemClick, 
  level 
}: { 
  node: TreeNode, 
  selectedPath: string | null, 
  onItemClick: (path: string) => void,
  level: number
}) {
  const [isOpen, setIsOpen] = useState(true);
  const isSelected = selectedPath === node.path;

  if (node.type === 'tree') {
    return (
      <div className="flex flex-col">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsOpen(!isOpen)}
          className="w-full justify-start h-8 px-2 font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50"
          style={{ paddingLeft: `${level * 12 + 8}px` }}
        >
          <ChevronRight 
            size={14} 
            className={cn("mr-1.5 transition-transform duration-200", isOpen && "rotate-90")} 
          />
          <Folder size={14} className="mr-2 text-blue-500/70" />
          <span className="truncate">{node.name}</span>
        </Button>
        {isOpen && node.children.length > 0 && (
          <TreeView 
            nodes={node.children} 
            selectedPath={selectedPath} 
            onItemClick={onItemClick} 
            level={level + 1} 
          />
        )}
      </div>
    );
  }

  return (
    <Button
      variant={isSelected ? "secondary" : "ghost"}
      size="sm"
      onClick={() => onItemClick(node.path)}
      className={cn(
        "w-full justify-start h-8 px-2 font-medium",
        isSelected 
          ? "bg-primary/10 text-primary hover:bg-primary/15" 
          : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
      )}
      style={{ paddingLeft: `${level * 12 + 24}px` }}
    >
      <FileText size={14} className={cn("mr-2", isSelected ? "text-primary" : "text-muted-foreground/70")} />
      <span className="truncate">{node.name}</span>
    </Button>
  );
}

function TreeView({ 
  nodes, 
  selectedPath, 
  onItemClick, 
  level = 0 
}: { 
  nodes: TreeNode[], 
  selectedPath: string | null, 
  onItemClick: (path: string) => void,
  level?: number
}) {
  return (
    <div className="space-y-0.5">
      {nodes.map((node) => (
        <TreeItemNode 
          key={node.path}
          node={node}
          selectedPath={selectedPath}
          onItemClick={onItemClick}
          level={level}
        />
      ))}
    </div>
  );
}

export default function EditorPage({
  title,
  tree,
  selectedPath,
  onItemClick,
  content,
  onContentChange,
  onSave,
  onPublish,
  history,
  isLoading = false
}: EditorPageProps) {
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filteredTree = tree.filter(item => 
    item.path.toLowerCase().includes(search.toLowerCase())
  );
  
  const nestedTree = buildTree(filteredTree);

  const handleSave = () => {
    onSave();
    toast.success("Draft saved successfully", {
        description: `Changes to ${selectedPath?.split('/').pop()} have been recorded.`,
    });
  };

  return (
    <TooltipProvider>
      <div className="flex h-full overflow-hidden bg-background">
        {/* Left Sidebar - DocTree */}
        <div className="w-64 border-r flex flex-col bg-muted/20 shrink-0">
          <div className="p-4 border-b space-y-4">
            <h2 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <Folder size={12} /> Explorer
            </h2>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
              <Input 
                type="text"
                placeholder="Search files..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-8 text-[11px] bg-background border-muted shadow-none focus-visible:ring-1 focus-visible:ring-primary/20"
              />
            </div>
          </div>
          <ScrollArea className="flex-1 px-2 py-4">
            <TreeView 
              nodes={nestedTree} 
              selectedPath={selectedPath} 
              onItemClick={onItemClick} 
            />
          </ScrollArea>
        </div>

        {/* Main Area - Editor */}
        <div className="flex-1 flex flex-col min-w-0 bg-background">
          {/* Top bar */}
          <header className="h-14 border-b flex items-center justify-between px-6 shrink-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2 bg-primary/5 rounded-lg text-primary shrink-0">
                 <FileText size={18} />
              </div>
              <div className="min-w-0">
                <h1 className="text-sm font-bold truncate leading-none mb-1">
                  {selectedPath ? selectedPath.split('/').pop() : title}
                </h1>
                <p className="text-[10px] text-muted-foreground truncate font-medium">
                  {selectedPath || 'No active document'}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2 shrink-0">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleSave}
                    disabled={!selectedPath || isLoading}
                    className="h-8 gap-2 rounded-full px-4 text-[11px] font-bold shadow-none hover:bg-muted/50"
                  >
                    <Save size={14} /> Save Draft
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Save local changes</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    size="sm" 
                    onClick={onPublish}
                    disabled={!selectedPath || isLoading}
                    className="h-8 gap-2 rounded-full px-4 text-[11px] font-bold"
                  >
                    <Send size={14} /> Publish
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Push to GitHub</TooltipContent>
              </Tooltip>

              <Separator orientation="vertical" className="h-4 mx-1" />

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => setIsHistoryOpen(true)}
                    className={cn(
                        "h-8 w-8 rounded-full",
                        isHistoryOpen && "bg-muted"
                    )}
                  >
                    <History size={18} className="text-muted-foreground" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>View Revision History</TooltipContent>
              </Tooltip>
            </div>
          </header>

          {/* Editor Area */}
          <main className="flex-1 overflow-hidden p-6 bg-muted/10">
            {isLoading ? (
              <div className="h-full flex flex-col items-center justify-center gap-3 text-muted-foreground">
                <div className="w-8 h-8 border-2 border-muted border-t-primary rounded-full animate-spin"></div>
                <p className="text-[10px] font-bold uppercase tracking-widest">Fetching Content</p>
              </div>
            ) : selectedPath ? (
              <div className="h-full bg-background rounded-xl border shadow-sm flex flex-col overflow-hidden focus-within:ring-1 focus-within:ring-primary/20 transition-all">
                <textarea
                  value={content}
                  onChange={(e) => onContentChange(e.target.value)}
                  placeholder="Start typing..."
                  className="flex-1 p-8 outline-none resize-none bg-transparent font-mono text-[13px] leading-relaxed text-foreground/90 selection:bg-primary/10"
                />
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center gap-6 text-center">
                 <div className="p-8 bg-background border rounded-full shadow-sm">
                    <FileText size={48} className="text-muted-foreground/20" />
                 </div>
                 <div className="space-y-1.5 max-w-[200px]">
                   <h3 className="text-sm font-bold">Workspace Empty</h3>
                   <p className="text-xs text-muted-foreground">Select a file from the explorer to begin editing release notes.</p>
                 </div>
              </div>
            )}
          </main>

          {/* History Sheet */}
          <Sheet open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
            <SheetContent className="w-[350px] sm:w-[400px] p-0 flex flex-col gap-0 border-l">
              <SheetHeader className="p-6 border-b flex-row items-center justify-between space-y-0 shrink-0 bg-background/95 backdrop-blur">
                <div className="space-y-1">
                    <SheetTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2 leading-none">
                        <Clock size={14} /> Revision History
                    </SheetTitle>
                    <p className="text-[10px] text-muted-foreground font-medium">Last 50 changes tracked</p>
                </div>
              </SheetHeader>
              
              <ScrollArea className="flex-1">
                <div className="p-6">
                  {history && history.length > 0 ? (
                    <div className="space-y-6 relative before:absolute before:inset-y-0 before:left-3 before:w-px before:bg-border">
                      {history.map((entry, i) => (
                        <div key={i} className="relative pl-8 group">
                          <div className="absolute left-1.5 top-1 w-3 h-3 rounded-full border-2 border-background bg-muted group-hover:scale-110 transition-transform" />
                          <div className="space-y-3">
                            <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-[9px] h-5 font-bold bg-muted/30">
                                    {new Date(entry.timestamp).toLocaleDateString()}
                                </Badge>
                                <span className="text-[9px] text-muted-foreground font-medium">
                                    {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </div>
                            <div className="bg-muted/30 border rounded-xl p-3 hover:bg-muted/50 transition-colors">
                              <div className="flex items-center gap-2 mb-2">
                                <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary shrink-0 uppercase">
                                  {(entry.user?.name || entry.username || 'S')[0]}
                                </div>
                                <div className="text-[11px] font-bold truncate leading-none">
                                    {entry.user?.name || entry.username || 'System'}
                                </div>
                              </div>
                              <div className="text-[10px] text-muted-foreground leading-relaxed italic bg-background/50 p-2 rounded-lg border border-border/50">
                                {entry.changes ? 'Modified file content' : 'Initial file sync'}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="h-[400px] flex flex-col items-center justify-center text-center gap-4 text-muted-foreground/30">
                      <History size={48} />
                      <div className="space-y-1">
                        <p className="text-xs font-bold uppercase tracking-widest">No Revisions</p>
                        <p className="text-[10px]">Changes will appear here after your first save.</p>
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>
              
              <div className="p-6 border-t bg-muted/5 shrink-0">
                <Button variant="outline" className="w-full text-xs h-9 font-bold" onClick={() => setIsHistoryOpen(false)}>
                    Close History
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </TooltipProvider>
  );
}
