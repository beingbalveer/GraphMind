"use client";

import React, { useEffect, useCallback } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl" | "2xl" | "4xl" | "5xl" | "full";
  className?: string;
  closeOnClickOutside?: boolean;
}

const sizeClasses: Record<NonNullable<ModalProps["size"]>, string> = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
  "2xl": "max-w-2xl",
  "4xl": "max-w-4xl",
  "5xl": "max-w-5xl",
  full: "max-w-[95vw] h-[90vh]",
};

export function Modal({
  isOpen,
  onClose,
  children,
  size = "lg",
  className = "",
  closeOnClickOutside = true,
}: ModalProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  return (
    <div
      onClick={closeOnClickOutside ? onClose : undefined}
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in-0 duration-150 select-none font-sans"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "w-full bg-white rounded-2xl border border-zinc-200/90 shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-150",
          sizeClasses[size],
          className
        )}
      >
        {children}
      </div>
    </div>
  );
}

interface ModalHeaderProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  onClose?: () => void;
  className?: string;
  children?: React.ReactNode;
}

export function ModalHeader({
  title,
  description,
  icon,
  onClose,
  className = "",
  children,
}: ModalHeaderProps) {
  return (
    <div
      className={cn(
        "h-14 px-5 border-b border-zinc-200/80 flex items-center justify-between shrink-0 bg-zinc-50/70",
        className
      )}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        {icon && (
          <div className="w-7 h-7 rounded-lg bg-zinc-100 border border-zinc-200/90 text-zinc-800 flex items-center justify-center shadow-xs shrink-0">
            {icon}
          </div>
        )}
        <div className="min-w-0">
          <h3 className="font-semibold text-sm text-zinc-900 leading-tight truncate">
            {title}
          </h3>
          {description && (
            <p className="text-xs text-zinc-500 truncate">{description}</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {children}
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-200/60 transition-colors cursor-pointer"
            title="Close"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

interface ModalBodyProps {
  children: React.ReactNode;
  className?: string;
}

export function ModalBody({ children, className = "" }: ModalBodyProps) {
  return (
    <div className={cn("p-5 overflow-y-auto min-h-0 flex-1", className)}>
      {children}
    </div>
  );
}

interface ModalFooterProps {
  children: React.ReactNode;
  className?: string;
}

export function ModalFooter({ children, className = "" }: ModalFooterProps) {
  return (
    <div
      className={cn(
        "px-5 py-3 border-t border-zinc-200/80 flex items-center justify-end gap-2 bg-zinc-50/50 shrink-0",
        className
      )}
    >
      {children}
    </div>
  );
}
