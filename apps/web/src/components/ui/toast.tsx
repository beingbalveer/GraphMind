"use client";

import React, { useEffect } from "react";
import { AlertCircle, X } from "lucide-react";
import { IconButton } from "./icon-button";

interface ToastProps {
  message: string | null;
  onDismiss: () => void;
  duration?: number;
}

export function Toast({ message, onDismiss, duration = 6000 }: ToastProps) {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(onDismiss, duration);
    return () => clearTimeout(timer);
  }, [message, onDismiss, duration]);

  if (!message) return null;

  return (
    <div className="z-toast fixed bottom-20 right-4 max-w-sm animate-in fade-in-50 slide-in-from-bottom-3 duration-200 select-none sm:right-6 motion-reduce:animate-none">
      <div role="alert" className="flex items-start gap-3 rounded-2xl border border-destructive bg-destructive-bg p-3.5 text-foreground shadow-xl">
        <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-destructive" />
        <div className="flex-1 min-w-0">
          <h4 className="text-xs font-semibold">Request Error</h4>
          <p className="mt-0.5 break-words text-xs leading-relaxed text-foreground-muted">{message}</p>
        </div>
        <IconButton label="Dismiss error" tooltip="Dismiss error" variant="ghost" onClick={onDismiss}>
          <X aria-hidden="true" className="size-4" />
        </IconButton>
      </div>
    </div>
  );
}
