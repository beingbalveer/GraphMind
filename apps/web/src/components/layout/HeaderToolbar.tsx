"use client";

import React from "react";
import { RotateCcw, PanelLeft, Plus, Share2, Activity } from "lucide-react";
import { useGraphStore } from "@/store/useGraphStore";

interface HeaderToolbarProps {
  sidebarOpen: boolean;
  toggleSidebar: () => void;
}

export function HeaderToolbar({ sidebarOpen, toggleSidebar }: HeaderToolbarProps) {
  const { resetLayout, nodes, edges } = useGraphStore();

  return (
    <header className="h-14 border-b border-slate-200 bg-white/90 backdrop-blur-md px-4 flex items-center justify-between z-30 shrink-0 select-none">
      {/* Left Section: Sidebar toggle & Title */}
      <div className="flex items-center space-x-3">
        <button
          onClick={toggleSidebar}
          className={`p-2 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors ${
            sidebarOpen ? "bg-slate-100 text-slate-900" : ""
          }`}
          title="Toggle Sidebar"
        >
          <PanelLeft className="w-4 h-4" />
        </button>

        <div className="flex items-center space-x-2">
          <div className="w-7 h-7 rounded-md bg-sky-600 text-white flex items-center justify-center font-bold text-sm shadow-xs">
            🧠
          </div>
          <div>
            <h1 className="font-bold text-slate-900 text-sm leading-none flex items-center space-x-2">
              <span>Software Engineering Architecture</span>
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                Live Workspace
              </span>
            </h1>
          </div>
        </div>
      </div>

      {/* Middle Section: Node & Edge counts */}
      <div className="hidden sm:flex items-center space-x-4 text-xs text-slate-500 font-medium bg-slate-100/70 px-3 py-1.5 rounded-lg border border-slate-200/60">
        <div className="flex items-center space-x-1.5">
          <Activity className="w-3.5 h-3.5 text-sky-600" />
          <span>{nodes.length} Nodes</span>
        </div>
        <span className="text-slate-300">•</span>
        <span>{edges.length} Connections</span>
      </div>

      {/* Right Section: Actions */}
      <div className="flex items-center space-x-2">
        <button
          onClick={resetLayout}
          className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 text-xs font-medium hover:bg-slate-50 transition-colors flex items-center space-x-1.5"
          title="Reset graph layout"
        >
          <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
          <span className="hidden md:inline">Reset Layout</span>
        </button>

        <button
          className="px-3 py-1.5 rounded-lg bg-sky-600 text-white text-xs font-medium hover:bg-sky-700 transition-colors shadow-xs flex items-center space-x-1.5"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Branch</span>
        </button>

        <button
          className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
          title="Share workspace"
        >
          <Share2 className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}
