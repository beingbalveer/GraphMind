"use client";

import React, { useState, useEffect } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

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
    <header className="h-14 border-b border-slate-200/80 bg-white/80 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between z-30 shrink-0 select-none">
      {/* Brand */}
      <div className="flex items-center space-x-2.5">
        <div className="w-7 h-7 rounded-lg bg-sky-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
          🧠
        </div>
        <span className="font-semibold text-slate-900 text-sm tracking-tight">
          GraphMind
        </span>
        <div
          className={`w-2 h-2 rounded-full ml-1.5 transition-colors ${
            apiOnline === true
              ? "bg-emerald-500"
              : apiOnline === false
              ? "bg-rose-500"
              : "bg-amber-400 animate-pulse"
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

      {/* Right Controls */}
      <div className="flex items-center space-x-2">
        {messageCount > 0 && onClearChat && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearChat}
            className="text-slate-500 hover:text-slate-800 text-xs font-medium flex items-center space-x-1.5"
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
