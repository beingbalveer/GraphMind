"use client";

import React, { useEffect, useCallback } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "./button";
import { cn } from "@/lib/utils";

export interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "destructive" | "default";
  isLoading?: boolean;
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "destructive",
  isLoading = false,
}: ConfirmDialogProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isLoading) {
        onClose();
      }
    },
    [onClose, isLoading]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      // Prevent body scrolling while dialog is open
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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in-0 duration-150 select-none"
      onClick={(e) => {
        e.stopPropagation();
        if (!isLoading) onClose();
      }}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl border border-zinc-200 animate-in zoom-in-95 fade-in-0 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start space-x-3.5">
          <div
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
              variant === "destructive"
                ? "bg-rose-50 text-rose-600 border border-rose-100"
                : "bg-zinc-100 text-zinc-800 border border-zinc-200"
            )}
          >
            <AlertTriangle className="h-4 w-4" />
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-zinc-950 leading-tight">
              {title}
            </h3>
            <p className="mt-1.5 text-xs text-zinc-600 leading-relaxed">
              {description}
            </p>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-end space-x-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isLoading}
            onClick={onClose}
            className="cursor-pointer"
          >
            {cancelText}
          </Button>

          <Button
            type="button"
            variant={variant === "destructive" ? "destructive" : "default"}
            size="sm"
            disabled={isLoading}
            onClick={async (e) => {
              e.stopPropagation();
              await onConfirm();
              onClose();
            }}
            className="cursor-pointer"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                <span>Processing...</span>
              </>
            ) : (
              confirmText
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
