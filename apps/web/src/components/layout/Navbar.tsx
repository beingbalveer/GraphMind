"use client";

import React, { useState, useEffect } from "react";
import { Plus, PanelLeft, MessageSquare, LayoutGrid } from "lucide-react";
import { Button } from "@/components/ui/button";

export type ViewMode = "chat" | "canvas";

interface NavbarProps {
  onClearChat?: () => void;
  messageCount: number;
  breadcrumbs?: React.ReactNode;
  isSidebarOpen?: boolean;
  onToggleSidebar?: () => void;
  viewMode?: ViewMode;
  onViewModeChange?: (mode: ViewMode) => void;
}

export function Navbar({
  onClearChat,
  messageCount,
  breadcrumbs,
  isSidebarOpen,
  onToggleSidebar,
  viewMode = "chat",
  onViewModeChange,
}: NavbarProps) {
  const [apiOnline, setApiOnline] = useState<boolean | null>(null);

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8008";
        const res = await fetch(`${apiUrl}/healthz`, { method: "GET" });
        setApiOnline(res.ok);
      } catch {
        setApiOnline(false);
      }
    };
    checkHealth();
    const interval = setInterval(checkHealth, 15000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="h-13 border-b border-zinc-200/80 bg-white/80 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between z-30 shrink-0 select-none">
      {/* Left: Sidebar Toggle + Brand + Connection Status */}
      <div className="flex items-center space-x-2.5 shrink-0">
        {onToggleSidebar && (
          <Button
            variant="ghost"
            size="iconSm"
            onClick={onToggleSidebar}
            className={`h-7 w-7 text-zinc-600 hover:text-zinc-950 transition-colors ${
              isSidebarOpen ? "bg-zinc-100 text-zinc-900" : ""
            }`}
            title="Toggle Conversation Tree (⌘B / Ctrl+B)"
          >
            <PanelLeft className="w-4 h-4" />
          </Button>
        )}

        <div className="w-6 h-6 rounded-md bg-zinc-900 text-white flex items-center justify-center font-bold text-xs shadow-xs">
          🧠
        </div>
        <span className="font-semibold text-zinc-900 text-sm tracking-tight">
          GraphMind
        </span>
        <div
          className={`w-1.5 h-1.5 rounded-full ml-1 transition-colors ${
            apiOnline === true
              ? "bg-emerald-500"
              : apiOnline === false
              ? "bg-rose-500"
              : "bg-zinc-400 animate-pulse"
          }`}
          title={
            apiOnline === true
              ? "Backend API Connected (Port 8008)"
              : apiOnline === false
              ? "Backend API Offline"
              : "Checking backend connection..."
          }
        />
      </div>

      {/* Center: Branch Breadcrumbs */}
      <div className="hidden md:flex items-center px-4 min-w-0">
        {breadcrumbs}
      </div>

      {/* Right Controls: View Switcher + New Chat */}
      <div className="flex items-center space-x-2.5 shrink-0">
        {/* Chat vs Canvas View Switcher */}
        {messageCount > 0 && onViewModeChange && (
          <div className="flex items-center p-0.5 rounded-lg bg-zinc-100/90 border border-zinc-200/80 text-xs">
            <button
              type="button"
              onClick={() => onViewModeChange("chat")}
              className={`px-2.5 py-1 rounded-md font-medium transition-all flex items-center space-x-1.5 cursor-pointer ${
                viewMode === "chat"
                  ? "bg-white text-zinc-900 shadow-2xs font-semibold"
                  : "text-zinc-500 hover:text-zinc-900"
              }`}
              title="Chat Feed View"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Chat</span>
            </button>
            <button
              type="button"
              onClick={() => onViewModeChange("canvas")}
              className={`px-2.5 py-1 rounded-md font-medium transition-all flex items-center space-x-1.5 cursor-pointer ${
                viewMode === "canvas"
                  ? "bg-white text-zinc-900 shadow-2xs font-semibold"
                  : "text-zinc-500 hover:text-zinc-900"
              }`}
              title="2D Spatial Graph Canvas"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Canvas</span>
            </button>
          </div>
        )}

        {messageCount > 0 && onClearChat && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearChat}
            className="text-zinc-500 hover:text-zinc-900 text-xs font-medium flex items-center space-x-1"
            title="Start New Chat"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Chat</span>
          </Button>
        )}
      </div>
    </header>
  );
}
