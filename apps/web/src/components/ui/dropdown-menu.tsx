"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";

export interface DropdownMenuItemProps {
  label: string;
  icon?: React.ReactNode;
  variant?: "default" | "destructive";
  onClick: (e: React.MouseEvent) => void;
  disabled?: boolean;
}

interface DropdownMenuProps {
  trigger: React.ReactNode;
  items: DropdownMenuItemProps[];
  align?: "left" | "right";
  className?: string;
  onOpenChange?: (isOpen: boolean) => void;
}

export function DropdownMenu({
  trigger,
  items,
  align = "right",
  className,
  onOpenChange,
}: DropdownMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    onOpenChange?.(isOpen);
  }, [isOpen, onOpenChange]);

  const toggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsOpen((prev) => !prev);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent | PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        close();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        close();
      }
    };

    // Use capture phase so React Flow canvas drag/pan handlers do not swallow outside clicks
    document.addEventListener("pointerdown", handleClickOutside, { capture: true });
    document.addEventListener("mousedown", handleClickOutside, { capture: true });
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handleClickOutside, { capture: true });
      document.removeEventListener("mousedown", handleClickOutside, { capture: true });
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, close]);

  return (
    <div className="relative inline-block text-left" ref={menuRef}>
      <div onClick={toggle} className="cursor-pointer flex items-center justify-center">
        {trigger}
      </div>

      {isOpen && (
        <div
          className={cn(
            "absolute z-50 mt-1 min-w-[140px] rounded-xl bg-white p-1 text-zinc-950 shadow-lg border border-zinc-200/90 backdrop-blur-sm animate-in fade-in-0 zoom-in-95 duration-100",
            align === "right" ? "right-0" : "left-0",
            className
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {items.map((item, index) => (
            <button
              key={index}
              type="button"
              disabled={item.disabled}
              onClick={(e) => {
                e.stopPropagation();
                close();
                item.onClick(e);
              }}
              className={cn(
                "relative flex w-full cursor-pointer select-none items-center rounded-lg px-2.5 py-1.5 text-xs font-medium outline-none transition-colors",
                item.variant === "destructive"
                  ? "text-rose-600 hover:bg-rose-50 hover:text-rose-700 active:bg-rose-100"
                  : "text-zinc-700 hover:bg-zinc-100 hover:text-zinc-950 active:bg-zinc-200",
                item.disabled && "pointer-events-none opacity-50"
              )}
            >
              {item.icon && (
                <span className="mr-2 h-3.5 w-3.5 flex items-center justify-center shrink-0">
                  {item.icon}
                </span>
              )}
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
