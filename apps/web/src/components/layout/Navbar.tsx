"use client";

import React, { useState, useEffect } from "react";
import { BookOpen, Trash2 } from "lucide-react";

interface NavbarProps {
  onClearChat?: () => void;
  messageCount: number;
}

export function Navbar({ onClearChat, messageCount }: NavbarProps) {
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
    <header className="h-14 border-b border-slate-200 bg-white/90 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between z-30 shrink-0 select-none">
      {/* Brand & Identity */}
      <div className="flex items-center space-x-3">
        <div className="w-8 h-8 rounded-lg bg-sky-600 text-white flex items-center justify-center font-bold text-sm shadow-xs">
          🧠
        </div>
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="font-bold text-slate-900 text-sm tracking-tight">GraphMind</h1>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
              Phase 1 Core
            </span>
          </div>
        </div>
      </div>

      {/* Center status indicators */}
      <div className="hidden sm:flex items-center space-x-3 text-xs text-slate-500 font-medium">
        <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-slate-50 border border-slate-200/80">
          <span
            className={`w-2 h-2 rounded-full ${
              apiOnline === true
                ? "bg-emerald-500 animate-pulse"
                : apiOnline === false
                ? "bg-rose-500"
                : "bg-amber-400"
            }`}
          />
          <span className="text-[11px] text-slate-600">
            {apiOnline === true
              ? "API Connected"
              : apiOnline === false
              ? "API Offline (Port 8008)"
              : "Checking API..."}
          </span>
        </div>

        {messageCount > 0 && (
          <span className="text-[11px] text-slate-400 font-mono">
            {messageCount} {messageCount === 1 ? "message" : "messages"}
          </span>
        )}
      </div>

      {/* Right controls */}
      <div className="flex items-center space-x-2">
        {messageCount > 0 && onClearChat && (
          <button
            onClick={onClearChat}
            className="px-2.5 py-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors text-xs font-medium flex items-center space-x-1"
            title="Clear current chat"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Clear</span>
          </button>
        )}

        <a
          href="http://localhost:8008/docs"
          target="_blank"
          rel="noreferrer"
          className="px-2.5 py-1.5 rounded-lg bg-slate-100 text-slate-700 text-xs font-medium hover:bg-slate-200 transition-colors flex items-center space-x-1.5"
        >
          <BookOpen className="w-3.5 h-3.5 text-slate-500" />
          <span className="hidden sm:inline">API Docs ↗</span>
        </a>
      </div>
    </header>
  );
}
