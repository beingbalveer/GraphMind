"use client";

import React from "react";
import { Folder, Layers, Sparkles, MessageSquare, Plus, ChevronRight, Settings } from "lucide-react";
import { useGraphStore } from "@/store/useGraphStore";

interface SidebarProps {
  isOpen: boolean;
}

export function Sidebar({ isOpen }: SidebarProps) {
  const { nodes, selectedNodeId, setSelectedNodeId } = useGraphStore();

  if (!isOpen) return null;

  return (
    <aside className="w-64 border-r border-slate-200 bg-white flex flex-col z-20 shrink-0 select-none">
      {/* Workspace Switcher */}
      <div className="p-3 border-b border-slate-100">
        <button className="w-full p-2.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 transition-colors flex items-center justify-between text-xs font-semibold text-slate-800">
          <div className="flex items-center space-x-2 truncate">
            <Folder className="w-4 h-4 text-sky-600 shrink-0" />
            <span className="truncate">Main Workspace</span>
          </div>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        </button>
      </div>

      {/* Node Hierarchy List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        <div>
          <div className="px-2 mb-2 flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            <span>Graph Nodes ({nodes.length})</span>
            <Layers className="w-3 h-3" />
          </div>

          <div className="space-y-1">
            {nodes.map((node) => {
              const isSelected = node.id === selectedNodeId;
              const isPrompt = node.type === "promptNode";
              const label =
                (node.data?.title as string) ||
                (node.data?.prompt as string) ||
                (node.data?.label as string) ||
                node.id;

              return (
                <button
                  key={node.id}
                  onClick={() => setSelectedNodeId(node.id)}
                  className={`w-full text-left px-2.5 py-2 rounded-lg text-xs transition-colors flex items-center space-x-2.5 truncate ${
                    isSelected
                      ? "bg-sky-50 text-sky-900 font-semibold border border-sky-200"
                      : "text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  {isPrompt ? (
                    <MessageSquare className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  )}
                  <span className="truncate">{label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Sidebar Footer */}
      <div className="p-3 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between text-xs text-slate-500">
        <button className="flex items-center space-x-2 hover:text-slate-900 transition-colors p-1.5 rounded">
          <Settings className="w-4 h-4" />
          <span>Workspace Settings</span>
        </button>
      </div>
    </aside>
  );
}
