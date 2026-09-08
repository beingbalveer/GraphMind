"use client";

import React, { useEffect, useCallback } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  headerActions?: React.ReactNode;
  hasBackdrop?: boolean;
  widthClassName?: string;
  className?: string;
}

export function Drawer({
  isOpen,
  onClose,
  children,
  title,
  description,
  icon,
  headerActions,
  hasBackdrop = true,
  widthClassName = "w-full sm:w-[480px] md:w-[540px] lg:w-[580px]",
  className = "",
}: DrawerProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    },
    [isOpen, onClose]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <>
      {/* Backdrop */}
      {hasBackdrop && (
        <div
          onClick={onClose}
          className={cn(
            "fixed inset-0 z-30 bg-black/40 backdrop-blur-xs transition-opacity duration-200",
            isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
          )}
          title="Click to close (Esc)"
          aria-hidden="true"
        />
      )}

      {/* Drawer Panel */}
      <aside
        className={cn(
          "fixed inset-y-0 right-0 z-40 bg-surface border-l border-border shadow-2xl flex flex-col font-sans select-text transform transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-transform",
          widthClassName,
          isOpen ? "translate-x-0" : "translate-x-full pointer-events-none",
          className
        )}
      >
        {/* Standardized Header (h-13 matching Navbar and sidebars) */}
        {(Boolean(title) || Boolean(headerActions) || Boolean(onClose)) && (
          <div className="h-13 px-4 border-b border-border flex items-center justify-between shrink-0 bg-surface/95 backdrop-blur-md select-none">
            <div className="flex items-center gap-2.5 min-w-0 pr-2">
              {icon && (
                <div className="w-7 h-7 rounded-lg bg-muted border border-border text-foreground flex items-center justify-center shrink-0 shadow-xs">
                  {icon}
                </div>
              )}
              <div className="min-w-0">
                {title && (
                  <span className="font-semibold text-xs tracking-tight text-foreground truncate block">
                    {title}
                  </span>
                )}
                {description && (
                  <span className="text-2xs text-foreground-muted font-mono truncate block">
                    {description}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {headerActions}
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg text-foreground-muted hover:text-foreground hover:bg-surface-hover transition-colors cursor-pointer"
                title="Close drawer (Esc)"
                aria-label="Close drawer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto min-h-0 flex flex-col">
          {children}
        </div>
      </aside>
    </>
  );
}
