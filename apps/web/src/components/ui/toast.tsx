"use client";

import React, { useEffect } from "react";
import { AlertCircle, X } from "lucide-react";

interface ToastProps {
  message: string | null;
  onDismiss: () => void;
  duration?: number;
}

export function Toast({ message, onDismiss, duration = 6000 }: ToastProps) {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => {
      onDismiss();
    }, duration);
    return () => clearTimeout(timer);
  }, [message, onDismiss, duration]);

  if (!message) return null;

  return (
    <div className="fixed bottom-20 right-4 sm:right-6 max-w-sm z-50 animate-in fade-in-50 slide-in-from-bottom-3 duration-200 select-none">
      <div className="bg-white border border-rose-200 text-zinc-900 shadow-xl rounded-2xl p-3.5 flex items-start space-x-3">
        <div className="pt-0.5 text-rose-600 shrink-0">
          <AlertCircle className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-xs font-semibold text-zinc-900">Request Error</h4>
          <p className="text-xs text-zinc-600 mt-0.5 leading-relaxed break-words">
            {message}
          </p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="text-zinc-400 hover:text-zinc-700 p-1 rounded-md transition-colors shrink-0 cursor-pointer"
          title="Dismiss"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
